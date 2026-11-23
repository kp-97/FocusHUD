use crate::ai::models::ToolDefinition;
use crate::db::models::{Goal, Task};
use crate::db::queries::common::current_timestamp_ms;
use crate::db::queries::{upsert_goal, upsert_task};
use crate::diagnostics;
use rusqlite::Connection;
use serde_json::json;

pub fn get_default_tools() -> Vec<ToolDefinition> {
    vec![
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
        "create_task" => {
            let title = args["title"]
                .as_str()
                .ok_or("Missing required field 'title'")?
                .to_string();
            let description = args["description"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let priority = args["priority"].as_i64().unwrap_or(3) as i32;
            let due_date = args["dueDate"].as_str().map(|s| s.to_string());

            let now = current_timestamp_ms();
            let id = format!("task_{now}");

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
            let description = args["description"]
                .as_str()
                .unwrap_or_default()
                .to_string();
            let target_date = args["targetDate"].as_str().map(|s| s.to_string());

            let now = current_timestamp_ms();
            let id = format!("goal_{now}");

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
