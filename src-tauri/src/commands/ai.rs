use crate::ai::models::{ChatCompletionRequest, ToolDefinition};
use crate::ai::{execute_tool, get_default_tools, stream_provider};
use crate::db::init_db;
use crate::db::models::{ChatMessageDb, ChatSession};
use crate::db::queries::{
    delete_chat_session as db_delete_session, get_chat_messages as db_get_messages,
    get_chat_sessions as db_get_sessions, save_chat_message as db_save_message,
    save_chat_session as db_save_session,
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
pub fn execute_ai_tool(app: AppHandle, name: String, arguments: String) -> Result<String, String> {
    let conn = init_db(&app).map_err(|e| e.to_string())?;
    execute_tool(&conn, &name, &arguments)
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
