use super::ID_COUNTER;
use crate::db::models::{Goal, Task};
use crate::db::queries::common::current_timestamp_ms;
use crate::db::queries::{
    delete_goal as db_delete_goal, delete_task as db_delete_task, get_all_calendar_events,
    get_all_goals, get_all_tasks, get_setting, set_setting, upsert_goal, upsert_task,
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

pub fn update_task(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let id = args["id"].as_str().ok_or("Missing required field 'id'")?;
    let tasks = get_all_tasks(conn).map_err(|e| format!("Failed to read tasks: {e}"))?;
    let mut task = tasks
        .into_iter()
        .find(|t| t.id == id)
        .ok_or_else(|| format!("Task '{id}' not found"))?;

    if let Some(title) = args["title"].as_str() {
        task.title = title.to_string();
    }
    if let Some(desc) = args["description"].as_str() {
        task.description = desc.to_string();
    }
    if let Some(status) = args["status"].as_str() {
        task.status = status.to_string();
    }
    if let Some(p) = args["priority"].as_i64() {
        task.priority = p as i32;
    }
    if let Some(due) = args["dueDate"].as_str() {
        task.due_date = Some(due.to_string());
    }
    task.updated_at = current_timestamp_ms();

    upsert_task(conn, &task).map_err(|e| format!("Failed to update task: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Task '{id}' updated successfully"),
        "taskId": id
    })
    .to_string())
}

pub fn delete_task(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let id = args["id"].as_str().ok_or("Missing required field 'id'")?;
    db_delete_task(conn, id).map_err(|e| format!("Failed to delete task: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Task '{id}' deleted successfully"),
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

pub fn update_goal(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let id = args["id"].as_str().ok_or("Missing required field 'id'")?;
    let all = get_all_goals(conn).map_err(|e| format!("Failed to read goals: {e}"))?;
    let mut goal = all
        .into_iter()
        .find(|g| g.id == id)
        .ok_or_else(|| format!("Goal with id '{id}' not found"))?;

    if let Some(title) = args["title"].as_str() {
        goal.title = title.to_string();
    }
    if let Some(desc) = args["description"].as_str() {
        goal.description = desc.to_string();
    }
    if let Some(status) = args["status"].as_str() {
        goal.status = status.to_string();
    }
    if let Some(target) = args["targetDate"].as_str() {
        goal.target_date = Some(target.to_string());
    }
    if let Some(prog) = args["progress"].as_i64() {
        if !goal.description.contains("Progress:") {
            if goal.description.is_empty() {
                goal.description = format!("Progress: {prog}%");
            } else {
                goal.description = format!("{} (Progress: {prog}%)", goal.description);
            }
        }
    }
    goal.updated_at = current_timestamp_ms();

    upsert_goal(conn, &goal).map_err(|e| format!("Failed to update goal: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Goal '{id}' updated successfully"),
        "goalId": id
    })
    .to_string())
}

pub fn delete_goal(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let id = args["id"].as_str().ok_or("Missing required field 'id'")?;
    db_delete_goal(conn, id).map_err(|e| format!("Failed to delete goal: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Goal '{id}' deleted successfully"),
        "goalId": id
    })
    .to_string())
}

pub fn control_pomodoro(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let action = args["action"]
        .as_str()
        .ok_or("Missing required field 'action'")?
        .trim()
        .to_lowercase();

    let raw = get_setting(conn, "focushud_pomodoro_state").unwrap_or(None);
    let mut state: serde_json::Value = raw
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| {
            json!({
                "mode": "focus",
                "isRunning": false,
                "timeLeft": 1500,
                "totalSeconds": 1500,
                "cycle": 1,
                "totalCycles": 4
            })
        });

    if let Some(req_mode) = args["mode"].as_str() {
        let norm_mode = match req_mode.to_lowercase().replace('_', "").as_str() {
            "shortbreak" => "short_break",
            "longbreak" => "long_break",
            _ => "focus",
        };
        let default_secs = match norm_mode {
            "short_break" => 300,
            "long_break" => 900,
            _ => 1500,
        };
        state["mode"] = json!(norm_mode);
        state["totalSeconds"] = json!(default_secs);
        state["timeLeft"] = json!(default_secs);
    }

    if let Some(custom_mins) = args["durationMinutes"].as_i64() {
        let secs = custom_mins.max(1) * 60;
        state["totalSeconds"] = json!(secs);
        state["timeLeft"] = json!(secs);
    }

    let message = match action.as_str() {
        "start" => {
            state["isRunning"] = json!(true);
            let mins = state["timeLeft"].as_i64().unwrap_or(1500) / 60;
            let mode = state["mode"].as_str().unwrap_or("focus");
            format!("Pomodoro timer started in {mode} mode ({mins}m remaining).")
        }
        "pause" => {
            state["isRunning"] = json!(false);
            "Pomodoro timer paused.".to_string()
        }
        "reset" => {
            state["isRunning"] = json!(false);
            let total = state["totalSeconds"].as_i64().unwrap_or(1500);
            state["timeLeft"] = json!(total);
            format!("Pomodoro timer reset to {}m.", total / 60)
        }
        "skip" => {
            state["isRunning"] = json!(false);
            let cur_mode = state["mode"].as_str().unwrap_or("focus");
            let cur_cycle = state["cycle"].as_i64().unwrap_or(1);
            let total_cycles = state["totalCycles"].as_i64().unwrap_or(4);

            let (next_mode, next_cycle, next_secs) = if cur_mode == "focus" {
                if cur_cycle >= total_cycles {
                    ("long_break", 1, 900)
                } else {
                    ("short_break", cur_cycle + 1, 300)
                }
            } else {
                ("focus", cur_cycle, 1500)
            };

            state["mode"] = json!(next_mode);
            state["cycle"] = json!(next_cycle);
            state["totalSeconds"] = json!(next_secs);
            state["timeLeft"] = json!(next_secs);
            format!("Skipped to {next_mode} mode ({cur_cycle}/{total_cycles}).")
        }
        "stop" => {
            state["isRunning"] = json!(false);
            let total = state["totalSeconds"].as_i64().unwrap_or(1500);
            state["timeLeft"] = json!(total);
            "Pomodoro timer stopped.".to_string()
        }
        other => {
            return Err(format!(
                "Unknown Pomodoro action '{other}'. Must be start, pause, reset, skip, or stop."
            ));
        }
    };

    let serialized = serde_json::to_string(&state).map_err(|e| e.to_string())?;
    let _ = set_setting(conn, "focushud_pomodoro_state", &serialized);

    Ok(json!({
        "status": "success",
        "action": action,
        "mode": state["mode"],
        "isRunning": state["isRunning"],
        "timeLeft": state["timeLeft"],
        "totalSeconds": state["totalSeconds"],
        "message": message
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
