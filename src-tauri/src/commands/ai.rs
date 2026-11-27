use crate::ai::models::{ChatCompletionRequest, ToolDefinition};
use crate::ai::{execute_tool, get_default_tools, stream_provider};
use crate::db::init_db;
use crate::db::models::{ChatMessageDb, ChatSession};
use crate::db::queries::{
    delete_chat_session as db_delete_session, get_chat_messages as db_get_messages,
    get_chat_sessions as db_get_sessions, replace_chat_messages as db_replace_messages,
    save_chat_message as db_save_message, save_chat_session as db_save_session,
};
use tauri::{AppHandle, command};

#[command]
pub async fn stream_chat_completion(
    app: AppHandle,
    request: ChatCompletionRequest,
) -> Result<(), String> {
    stream_provider(&app, &request).await
}

#[command]
pub fn abort_chat_stream(session_id: String) -> Result<(), String> {
    crate::ai::cancel_stream(&session_id);
    Ok(())
}

#[command]
pub fn get_chat_sessions(app: AppHandle) -> Result<Vec<ChatSession>, String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    db_get_sessions(&conn).map_err(|e| e.to_string())
}

#[command]
pub fn save_chat_session(app: AppHandle, session: ChatSession) -> Result<(), String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    db_save_session(&conn, &session).map_err(|e| e.to_string())
}

#[command]
pub fn delete_chat_session(app: AppHandle, id: String) -> Result<(), String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    db_delete_session(&conn, &id).map_err(|e| e.to_string())
}

#[command]
pub fn get_chat_messages(app: AppHandle, session_id: String) -> Result<Vec<ChatMessageDb>, String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    db_get_messages(&conn, &session_id).map_err(|e| e.to_string())
}

#[command]
pub fn save_chat_message(app: AppHandle, message: ChatMessageDb) -> Result<(), String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    db_save_message(&conn, &message).map_err(|e| e.to_string())
}

#[command]
pub fn replace_chat_messages(
    app: AppHandle,
    session_id: String,
    messages: Vec<ChatMessageDb>,
) -> Result<(), String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    db_replace_messages(&conn, &session_id, &messages).map_err(|e| e.to_string())
}

#[command]
pub fn execute_ai_tool(app: AppHandle, name: String, arguments: String) -> Result<String, String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    let result_str = execute_tool(&conn, &name, &arguments)?;

    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&result_str) {
        if v.get("status").and_then(|s| s.as_str()) == Some("success") {
            let normalized = name.trim().to_lowercase();
            match normalized.as_str() {
                "create_calendar_event" => {
                    let id = v.get("eventId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "calendar_events", "create", id);
                }
                "update_calendar_event" => {
                    let id = v.get("eventId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "calendar_events", "update", id);
                }
                "delete_calendar_event" => {
                    let id = v.get("eventId").and_then(|i| i.as_str()).map(String::from);
                    if let Some(id_str) = &id {
                        if id_str.starts_with("task_") {
                            crate::commands::db::emit_db_change(
                                &app,
                                "tasks",
                                "delete",
                                Some(id_str.clone()),
                            );
                        }
                    }
                    crate::commands::db::emit_db_change(&app, "calendar_events", "delete", id);
                }
                "create_task" => {
                    let id = v.get("taskId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "tasks", "create", id);
                    crate::commands::db::emit_db_change(&app, "calendar_events", "update", None);
                }
                "update_task" => {
                    let id = v.get("taskId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "tasks", "update", id);
                    crate::commands::db::emit_db_change(&app, "calendar_events", "update", None);
                }
                "delete_task" => {
                    let id = v.get("taskId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "tasks", "delete", id);
                    crate::commands::db::emit_db_change(&app, "calendar_events", "update", None);
                }
                "create_goal" => {
                    let id = v.get("goalId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "goals", "create", id);
                }
                "update_goal" => {
                    let id = v.get("goalId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "goals", "update", id);
                }
                "delete_goal" => {
                    let id = v.get("goalId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "goals", "delete", id);
                }
                "create_note" => {
                    let id = v.get("noteId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "notes", "create", id);
                }
                "update_note" => {
                    let id = v.get("noteId").and_then(|i| i.as_str()).map(String::from);
                    crate::commands::db::emit_db_change(&app, "notes", "update", id);
                }
                "control_pomodoro" => {
                    use tauri::Emitter;
                    let _ = app.emit("focushud:pomodoro-control", &v);
                }
                _ => {}
            }
        }
    }

    Ok(result_str)
}

#[command]
pub fn get_ai_tools() -> Vec<ToolDefinition> {
    get_default_tools()
}

#[command]
pub async fn fetch_ai_models(
    provider: String,
    endpoint: Option<String>,
    api_key: Option<String>,
) -> Result<Vec<String>, String> {
    crate::ai::fetch_available_models(&provider, endpoint.as_deref(), api_key.as_deref()).await
}

#[command]
pub fn get_ai_config(app: AppHandle) -> Result<Option<String>, String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    crate::db::queries::get_setting(&conn, "focushud_ai_settings").map_err(|e| e.to_string())
}

#[command]
pub fn save_ai_config(app: AppHandle, config: String) -> Result<(), String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    crate::db::queries::set_setting(&conn, "focushud_ai_settings", &config)
        .map_err(|e| e.to_string())
}

#[command]
pub fn sync_pomodoro_state(app: AppHandle, state: String) -> Result<(), String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    crate::db::queries::set_setting(&conn, "focushud_pomodoro_state", &state)
        .map_err(|e| e.to_string())
}
