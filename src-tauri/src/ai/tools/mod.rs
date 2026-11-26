pub mod calendar;
pub mod definitions;
pub mod workspace;

pub use definitions::get_default_tools;
use rusqlite::Connection;
use std::sync::atomic::AtomicU64;

pub(crate) static ID_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn execute_tool(conn: &Connection, name: &str, arguments: &str) -> Result<String, String> {
    let trimmed_args = arguments.trim();
    let mut actual_name = name.trim().to_string();
    let mut args: serde_json::Value = if trimmed_args.is_empty() {
        serde_json::json!({})
    } else {
        serde_json::from_str(trimmed_args).unwrap_or_else(|_| serde_json::json!({}))
    };

    if actual_name.starts_with('{') {
        if let Ok(parsed_name_obj) = serde_json::from_str::<serde_json::Value>(&actual_name) {
            if let Some(embedded_name) = parsed_name_obj.get("name").and_then(|n| n.as_str()) {
                actual_name = embedded_name.to_string();
                if let Some(embedded_args) = parsed_name_obj
                    .get("arguments")
                    .or_else(|| parsed_name_obj.get("parameters"))
                {
                    if args.as_object().is_none_or(|o| o.is_empty()) {
                        args = embedded_args.clone();
                    }
                }
            }
        }
    }

    let normalized = actual_name.to_lowercase();
    match normalized.as_str() {
        "get_current_time" | "get_current_datetime" => workspace::get_current_time(),
        "get_workspace_summary" => workspace::get_workspace_summary(conn),
        "get_tasks" => workspace::get_tasks(conn, &args),
        "get_goals" => workspace::get_goals(conn, &args),
        "get_pomodoro_status" => workspace::get_pomodoro_status(conn),
        "create_task" => workspace::create_task(conn, &args),
        "update_task" => workspace::update_task(conn, &args),
        "delete_task" => workspace::delete_task(conn, &args),
        "create_goal" => workspace::create_goal(conn, &args),
        "get_system_diagnostics" => workspace::get_system_diagnostics(),
        "get_calendar_events" => calendar::get_calendar_events(conn, &args),
        "create_calendar_event" => calendar::create_calendar_event(conn, &args),
        "update_calendar_event" => calendar::update_calendar_event(conn, &args),
        "delete_calendar_event" => calendar::delete_calendar_event(conn, &args),
        _ => Err(format!("Unknown tool: {actual_name}")),
    }
}
