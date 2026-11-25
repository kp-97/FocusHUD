use super::ID_COUNTER;
use crate::db::models::{Goal, Task};
use crate::db::queries::common::current_timestamp_ms;
use crate::db::queries::{
    get_all_calendar_events, get_all_goals, get_all_tasks, get_setting, upsert_goal, upsert_task,
};
use crate::diagnostics;
use rusqlite::Connection;
use serde_json::json;
use std::sync::atomic::Ordering;

pub fn get_workspace_summary(conn: &Connection) -> Result<String, String> {
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

pub fn get_tasks(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
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

pub fn get_goals(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
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

pub fn get_pomodoro_status(conn: &Connection) -> Result<String, String> {
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

pub fn create_task(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
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

pub fn create_goal(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
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

pub fn get_system_diagnostics() -> Result<String, String> {
    let diag = diagnostics::get_latest_diagnostics();
    serde_json::to_string(&diag).map_err(|e| format!("Serialization error: {e}"))
}

pub fn get_current_time() -> Result<String, String> {
    let now = chrono::Local::now();
    Ok(json!({
        "iso": now.to_rfc3339(),
        "date": now.format("%Y-%m-%d").to_string(),
        "time": now.format("%H:%M").to_string(),
        "dayOfWeek": now.format("%A").to_string(),
        "formatted": now.format("%A, %B %d, %Y %I:%M %p").to_string(),
        "timezone": now.format("%Z").to_string(),
        "timestampMs": now.timestamp_millis(),
    })
    .to_string())
}
