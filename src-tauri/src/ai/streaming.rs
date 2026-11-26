use crate::ai::models::{StreamChunkEvent, ToolCallPayload, ToolDefinition};
use serde_json::{Value, json};
use std::collections::{BTreeMap, HashSet};
use std::sync::{LazyLock, Mutex};
use tauri::{AppHandle, Emitter};

static CANCELLED_SESSIONS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

pub fn cancel_stream(session_id: &str) {
    if let Ok(mut set) = CANCELLED_SESSIONS.lock() {
        set.insert(session_id.to_string());
    }
}

pub fn is_stream_cancelled(session_id: &str) -> bool {
    if let Ok(set) = CANCELLED_SESSIONS.lock() {
        set.contains(session_id)
    } else {
        false
    }
}

pub fn clear_cancelled_stream(session_id: &str) {
    if let Ok(mut set) = CANCELLED_SESSIONS.lock() {
        set.remove(session_id);
    }
}

#[derive(Default)]
pub struct PendingTool {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

pub fn convert_tools(tools: &[ToolDefinition]) -> Vec<Value> {
    tools
        .iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters
                }
            })
        })
        .collect()
}

pub fn convert_message_param_to_json(msg: &crate::ai::models::ChatMessageParam) -> Value {
    let mut obj = json!({
        "role": msg.role,
    });
    if let Some(c) = &msg.content {
        obj["content"] = json!(c);
    } else {
        obj["content"] = Value::Null;
    }
    if let Some(tcs) = &msg.tool_calls {
        obj["tool_calls"] = json!(tcs);
    }
    if let Some(tcid) = &msg.tool_call_id {
        obj["tool_call_id"] = json!(tcid);
    }
    if let Some(n) = &msg.name {
        obj["name"] = json!(n);
    }
    obj
}

pub fn flush_pending_tools(
    app: &AppHandle,
    session_id: &str,
    pending: &mut BTreeMap<usize, PendingTool>,
) {
    for (idx, tool) in pending.iter() {
        let name = tool.name.trim();
        if !name.is_empty() {
            let call_id = if tool.id.is_empty() {
                format!("tc_{idx}")
            } else {
                tool.id.clone()
            };
            let args = if tool.arguments.trim().is_empty() {
                "{}".to_string()
            } else {
                tool.arguments.clone()
            };
            emit_tool_call(app, session_id, &call_id, name, &args);
        }
    }
    pending.clear();
}

pub fn emit_chunk(
    app: &AppHandle,
    s: &str,
    chunk_type: &str,
    delta: &str,
    tc: Option<ToolCallPayload>,
) {
    let _ = app.emit(
        "ai:stream-chunk",
        StreamChunkEvent {
            session_id: s.to_string(),
            chunk_type: chunk_type.to_string(),
            delta: delta.to_string(),
            tool_call: tc,
        },
    );
}

pub fn emit_text(app: &AppHandle, s: &str, delta: &str) {
    emit_chunk(app, s, "text", delta, None);
}

pub fn emit_tool_call(app: &AppHandle, s: &str, id: &str, name: &str, args: &str) {
    emit_chunk(
        app,
        s,
        "tool_call",
        "",
        Some(ToolCallPayload {
            id: id.to_string(),
            name: name.to_string(),
            arguments: args.to_string(),
        }),
    );
}

pub fn emit_done(app: &AppHandle, s: &str) {
    emit_chunk(app, s, "done", "", None);
}

pub fn emit_error(app: &AppHandle, s: &str, err: &str) {
    emit_chunk(app, s, "error", err, None);
}
