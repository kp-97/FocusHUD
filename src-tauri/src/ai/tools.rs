use crate::ai::models::ToolDefinition;
use crate::db::models::{Goal, Task};
use crate::db::queries::common::current_timestamp_ms;
use crate::db::queries::{
    get_all_calendar_events, get_all_goals, get_all_tasks, get_setting, upsert_goal, upsert_task,
};
use crate::diagnostics;
use rusqlite::Connection;
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};

static ID_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn get_default_tools() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "get_workspace_summary".to_string(),
            description: "Retrieves a summary of the current FocusHUD workspace including task counts, active goals, and scheduled events".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolDefinition {
            name: "get_tasks".to_string(),
            description: "Retrieves tasks from FocusHUD with optional filters for status or priority".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filter by status: 'todo', 'in_progress', 'done', 'pending', or 'all' (default: 'pending')",
                        "enum": ["all", "pending", "todo", "in_progress", "done"]
                    },
                    "priority": {
                        "type": "integer",
                        "description": "Optional priority filter: 1 (Urgent), 2 (High), 3 (Medium), 4 (Low)"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of tasks to return (default: 20)"
                    }
                }
            }),
        },
        ToolDefinition {
            name: "get_goals".to_string(),
            description: "Retrieves high-level strategic goals from FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "status": {
                        "type": "string",
                        "description": "Filter by status: 'active', 'completed', or 'all' (default: 'active')",
                        "enum": ["all", "active", "completed"]
                    }
                }
            }),
        },
        ToolDefinition {
            name: "get_pomodoro_status".to_string(),
            description: "Retrieves the current status of the FocusHUD Pomodoro focus timer".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {}
            }),
        },
        ToolDefinition {
            name: "create_task".to_string(),
            description: "Creates a new task in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Title of the task" },
                    "description": { "type": "string", "description": "Optional details about the task" },
                    "priority": { "type": "integer", "description": "Priority: 1 (Urgent), 2 (High), 3 (Medium), 4 (Low)" },
                    "dueDate": { "type": "string", "description": "Due date in YYYY-MM-DD format" }
                },
                "required": ["title"]
            }),
        },
        ToolDefinition {
            name: "create_goal".to_string(),
            description: "Creates a top-level or strategic goal in FocusHUD".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "description": "Title of the goal" },
                    "description": { "type": "string", "description": "Optional details about the goal" },
                    "targetDate": { "type": "string", "description": "Target completion date in YYYY-MM-DD format" }
                },
                "required": ["title"]
            }),
        },
        ToolDefinition {
            name: "get_system_diagnostics".to_string(),
            description: "Retrieves real-time system performance telemetry (CPU, RAM, GPU utilization and temperature)".to_string(),
            parameters: json!({
                "type": "object",
                "properties": {}
            }),
        },
    ]
}

pub fn execute_tool(conn: &Connection, name: &str, arguments: &str) -> Result<String, String> {
    let args: serde_json::Value =
        serde_json::from_str(arguments).map_err(|e| format!("Invalid JSON arguments: {e}"))?;

    match name {
        "get_workspace_summary" => {
            let tasks = get_all_tasks(conn).map_err(|e| format!("Failed to read tasks: {e}"))?;
            let goals = get_all_goals(conn).map_err(|e| format!("Failed to read goals: {e}"))?;
            let events = get_all_calendar_events(conn).unwrap_or_default();

            let total_tasks = tasks.len();
            let pending_tasks = tasks.iter().filter(|t| t.status != "done").count();
            let urgent_tasks = tasks
                .iter()
                .filter(|t| t.status != "done" && t.priority <= 2)
                .count();
            let completed_tasks = tasks.iter().filter(|t| t.status == "done").count();

            let total_goals = goals.len();
            let active_goals = goals.iter().filter(|g| g.status != "completed").count();

            let pomodoro_raw = get_setting(conn, "focushud_pomodoro_state").unwrap_or(None);
            let pomodoro_val: Option<serde_json::Value> =
                pomodoro_raw.and_then(|s| serde_json::from_str(&s).ok());

            Ok(json!({
                "tasks": {
                    "total": total_tasks,
                    "pending": pending_tasks,
                    "urgent": urgent_tasks,
                    "completed": completed_tasks,
                },
                "goals": {
                    "total": total_goals,
                    "active": active_goals,
                },
                "calendarEventsCount": events.len(),
                "pomodoro": pomodoro_val.unwrap_or_else(|| json!({
                    "mode": "focus",
                    "state": "idle"
                }))
            })
            .to_string())
        }
        "get_tasks" => {
            let tasks = get_all_tasks(conn).map_err(|e| format!("Failed to read tasks: {e}"))?;
            let status_filter = args["status"].as_str().unwrap_or("pending");
            let priority_filter = args["priority"].as_i64();
            let limit = args["limit"].as_u64().unwrap_or(20) as usize;

            let filtered: Vec<serde_json::Value> = tasks
                .into_iter()
                .filter(|t| {
                    let matches_status = match status_filter {
                        "all" => true,
                        "pending" | "todo" => t.status != "done",
                        "done" | "completed" => t.status == "done",
                        other => t.status == other,
                    };
                    let matches_priority = match priority_filter {
                        Some(p) => t.priority == p as i32,
                        None => true,
                    };
                    matches_status && matches_priority
                })
                .take(limit)
                .map(|t| {
                    json!({
                        "id": t.id,
                        "title": t.title,
                        "description": t.description,
                        "status": t.status,
                        "priority": t.priority,
                        "dueDate": t.due_date,
                    })
                })
                .collect();

            Ok(json!({
                "count": filtered.len(),
                "tasks": filtered,
            })
            .to_string())
        }
        "get_goals" => {
            let goals = get_all_goals(conn).map_err(|e| format!("Failed to read goals: {e}"))?;
            let status_filter = args["status"].as_str().unwrap_or("active");

            let filtered: Vec<serde_json::Value> = goals
                .into_iter()
                .filter(|g| match status_filter {
                    "all" => true,
                    "active" => g.status != "completed",
                    "completed" => g.status == "completed",
                    other => g.status == other,
                })
                .map(|g| {
                    json!({
                        "id": g.id,
                        "title": g.title,
                        "description": g.description,
                        "status": g.status,
                        "targetDate": g.target_date,
                    })
                })
                .collect();

            Ok(json!({
                "count": filtered.len(),
                "goals": filtered,
            })
            .to_string())
        }
        "get_pomodoro_status" => {
            let pomodoro_raw = get_setting(conn, "focushud_pomodoro_state").unwrap_or(None);
            let status_val: serde_json::Value = match pomodoro_raw {
                Some(s) => serde_json::from_str(&s).unwrap_or_else(|_| {
                    json!({
                        "mode": "focus",
                        "state": "idle",
                        "message": "Pomodoro state stored is not valid JSON"
                    })
                }),
                None => json!({
                    "mode": "focus",
                    "state": "idle",
                    "message": "Timer is currently idle or not synced yet"
                }),
            };
            Ok(status_val.to_string())
        }
        "create_task" => {
            let title = args["title"]
                .as_str()
                .ok_or("Missing required field 'title'")?
                .to_string();
            let description = args["description"].as_str().unwrap_or_default().to_string();
            let priority = args["priority"].as_i64().unwrap_or(3) as i32;
            let due_date = args["dueDate"].as_str().map(|s| s.to_string());

            let now = current_timestamp_ms();
            let c = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
            let id = format!("task_{now}_{c}");

            let task = Task {
                id: id.clone(),
                parent_id: None,
                goal_id: None,
                title: title.clone(),
                description,
                status: "todo".to_string(),
                priority,
                due_date,
                estimated_minutes: None,
                sort_order: 0,
                created_at: now,
                updated_at: now,
            };

            upsert_task(conn, &task).map_err(|e| format!("Failed to save task: {e}"))?;

            Ok(json!({
                "status": "success",
                "message": format!("Task '{title}' created successfully"),
                "taskId": id
            })
            .to_string())
        }
        "create_goal" => {
            let title = args["title"]
                .as_str()
                .ok_or("Missing required field 'title'")?
                .to_string();
            let description = args["description"].as_str().unwrap_or_default().to_string();
            let target_date = args["targetDate"].as_str().map(|s| s.to_string());

            let now = current_timestamp_ms();
            let c = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
            let id = format!("goal_{now}_{c}");

            let goal = Goal {
                id: id.clone(),
                parent_id: None,
                title: title.clone(),
                description,
                status: "active".to_string(),
                target_date,
                sort_order: 0,
                created_at: now,
                updated_at: now,
            };

            upsert_goal(conn, &goal).map_err(|e| format!("Failed to save goal: {e}"))?;

            Ok(json!({
                "status": "success",
                "message": format!("Goal '{title}' created successfully"),
                "goalId": id
            })
            .to_string())
        }
        "get_system_diagnostics" => {
            let diag = diagnostics::get_latest_diagnostics();
            serde_json::to_string(&diag).map_err(|e| format!("Serialization error: {e}"))
        }
        _ => Err(format!("Unknown tool: {name}")),
    }
}
