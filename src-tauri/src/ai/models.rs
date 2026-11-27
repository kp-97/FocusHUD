use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageParam {
    pub role: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub tool_calls: Option<Vec<Value>>,
    #[serde(default)]
    pub tool_call_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolParameterProperty {
    #[serde(rename = "type")]
    pub param_type: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolParametersSchema {
    #[serde(rename = "type")]
    pub schema_type: String,
    pub properties: serde_json::Map<String, Value>,
    pub required: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatCompletionRequest {
    pub session_id: String,
    pub provider: String,
    pub model: String,
    pub api_key: Option<String>,
    pub endpoint: Option<String>,
    pub system_prompt: Option<String>,
    pub messages: Vec<ChatMessageParam>,
    pub temperature: Option<f32>,
    pub tools: Option<Vec<ToolDefinition>>,
    pub context_size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallPayload {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamChunkEvent {
    pub session_id: String,
    pub chunk_type: String, // "text" | "tool_call" | "done" | "error"
    pub delta: String,
    pub tool_call: Option<ToolCallPayload>,
}

pub fn normalize_openai_chat_endpoint(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/chat/completions")
    } else {
        format!("{trimmed}/v1/chat/completions")
    }
}

pub fn normalize_openai_models_endpoint(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.replace("/chat/completions", "/models")
    } else if trimmed.ends_with("/models") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/models")
    } else {
        format!("{trimmed}/v1/models")
    }
}

pub fn normalize_ollama_chat_endpoint(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.ends_with("/api/chat") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/api/chat")
    }
}

pub fn normalize_ollama_tags_endpoint(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.ends_with("/api/chat") {
        trimmed.replace("/api/chat", "/api/tags")
    } else if trimmed.ends_with("/api/tags") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/api/tags")
    }
}
