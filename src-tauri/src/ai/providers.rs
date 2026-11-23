use crate::ai::models::{
    ChatCompletionRequest, StreamChunkEvent, ToolCallPayload, normalize_ollama_chat_endpoint,
    normalize_openai_chat_endpoint,
};
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter};

pub async fn stream_provider(
    app: &AppHandle,
    request: &ChatCompletionRequest,
) -> Result<(), String> {
    let client = Client::new();

    match request.provider.to_lowercase().as_str() {
        "anthropic" => stream_anthropic(app, &client, request).await,
        "gemini" => stream_gemini(app, &client, request).await,
        "ollama" => stream_ollama(app, &client, request).await,
        _ => stream_openai(app, &client, request).await,
    }
}

async fn stream_openai(
    app: &AppHandle,
    client: &Client,
    request: &ChatCompletionRequest,
) -> Result<(), String> {
    let raw_endpoint = request
        .endpoint
        .as_deref()
        .unwrap_or("https://api.openai.com/v1/chat/completions");
    let endpoint = normalize_openai_chat_endpoint(raw_endpoint);

    let mut body_messages = Vec::new();

    if let Some(sys) = &request.system_prompt {
        body_messages.push(json!({
            "role": "system",
            "content": sys
        }));
    }

    for msg in &request.messages {
        body_messages.push(json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    let mut payload = json!({
        "model": request.model,
        "messages": body_messages,
        "stream": true,
        "temperature": request.temperature.unwrap_or(0.7),
    });

    if let Some(tools) = &request.tools {
        if !tools.is_empty() {
            let tools_json: Vec<Value> = tools
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
                .collect();
            payload["tools"] = json!(tools_json);
        }
    }

    let mut req_builder = client.post(&endpoint).json(&payload);

    if let Some(key) = &request.api_key {
        if !key.is_empty() {
            req_builder = req_builder.header("Authorization", format!("Bearer {key}"));
        }
    }

    let res = req_builder
        .send()
        .await
        .map_err(|e| format!("Network request failed: {e}"))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        emit_error(app, &request.session_id, &format!("API Error: {err_text}"));
        return Ok(());
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk_bytes = chunk.map_err(|e| format!("Error receiving stream chunk: {e}"))?;
        let text = String::from_utf8_lossy(&chunk_bytes);
        buffer.push_str(&text);

        while let Some(idx) = buffer.find('\n') {
            let line = buffer[..idx].trim().to_string();
            buffer = buffer[idx + 1..].to_string();

            if let Some(data_str) = line.strip_prefix("data: ") {
                if data_str == "[DONE]" {
                    emit_done(app, &request.session_id);
                    return Ok(());
                }

                if let Ok(v) = serde_json::from_str::<Value>(data_str) {
                    if let Some(choices) = v["choices"].as_array() {
                        if let Some(first) = choices.first() {
                            if let Some(delta_content) = first["delta"]["content"].as_str() {
                                emit_text(app, &request.session_id, delta_content);
                            }

                            if let Some(tool_calls) = first["delta"]["tool_calls"].as_array() {
                                for tc in tool_calls {
                                    if let Some(func) = tc["function"].as_object() {
                                        let name = func
                                            .get("name")
                                            .and_then(|n| n.as_str())
                                            .unwrap_or_default()
                                            .to_string();
                                        let args = func
                                            .get("arguments")
                                            .and_then(|a| a.as_str())
                                            .unwrap_or_default()
                                            .to_string();
                                        emit_tool_call(
                                            app,
                                            &request.session_id,
                                            &format!("tc_{}", tc["index"]),
                                            &name,
                                            &args,
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    emit_done(app, &request.session_id);
    Ok(())
}

async fn stream_anthropic(
    app: &AppHandle,
    client: &Client,
    request: &ChatCompletionRequest,
) -> Result<(), String> {
    let endpoint = request
        .endpoint
        .clone()
        .unwrap_or_else(|| "https://api.anthropic.com/v1/messages".to_string());

    let messages_json: Vec<Value> = request
        .messages
        .iter()
        .map(|m| {
            json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let mut payload = json!({
        "model": request.model,
        "messages": messages_json,
        "max_tokens": 2048,
        "stream": true,
    });

    if let Some(sys) = &request.system_prompt {
        payload["system"] = json!(sys);
    }

    let mut req_builder = client
        .post(&endpoint)
        .header("anthropic-version", "2023-06-01")
        .json(&payload);

    if let Some(key) = &request.api_key {
        req_builder = req_builder.header("x-api-key", key);
    }

    let res = req_builder
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {e}"))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        emit_error(
            app,
            &request.session_id,
            &format!("Anthropic API Error: {err_text}"),
        );
        return Ok(());
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk_bytes = chunk.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk_bytes));

        while let Some(idx) = buffer.find('\n') {
            let line = buffer[..idx].trim().to_string();
            buffer = buffer[idx + 1..].to_string();

            if let Some(data_str) = line.strip_prefix("data: ") {
                if let Ok(v) = serde_json::from_str::<Value>(data_str) {
                    if v["type"] == "content_block_delta" {
                        if let Some(text) = v["delta"]["text"].as_str() {
                            emit_text(app, &request.session_id, text);
                        }
                    } else if v["type"] == "message_stop" {
                        emit_done(app, &request.session_id);
                        return Ok(());
                    }
                }
            }
        }
    }

    emit_done(app, &request.session_id);
    Ok(())
}

async fn stream_gemini(
    app: &AppHandle,
    client: &Client,
    request: &ChatCompletionRequest,
) -> Result<(), String> {
    let key = request.api_key.clone().unwrap_or_default();
    let endpoint = request.endpoint.clone().unwrap_or_else(|| {
        format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:streamGenerateContent?alt=sse&key={}",
            request.model, key
        )
    });

    let contents: Vec<Value> = request
        .messages
        .iter()
        .map(|m| {
            json!({
                "role": if m.role == "assistant" { "model" } else { "user" },
                "parts": [{ "text": m.content }]
            })
        })
        .collect();

    let mut payload = json!({
        "contents": contents
    });

    if let Some(sys) = &request.system_prompt {
        payload["systemInstruction"] = json!({
            "parts": [{ "text": sys }]
        });
    }

    let res = client
        .post(&endpoint)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {e}"))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        emit_error(
            app,
            &request.session_id,
            &format!("Gemini API Error: {err_text}"),
        );
        return Ok(());
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk_bytes = chunk.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk_bytes));

        while let Some(idx) = buffer.find('\n') {
            let line = buffer[..idx].trim().to_string();
            buffer = buffer[idx + 1..].to_string();

            if let Some(data_str) = line.strip_prefix("data: ") {
                if let Ok(v) = serde_json::from_str::<Value>(data_str) {
                    if let Some(candidates) = v["candidates"].as_array() {
                        if let Some(first) = candidates.first() {
                            if let Some(parts) = first["content"]["parts"].as_array() {
                                for part in parts {
                                    if let Some(text) = part["text"].as_str() {
                                        emit_text(app, &request.session_id, text);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    emit_done(app, &request.session_id);
    Ok(())
}

async fn stream_ollama(
    app: &AppHandle,
    client: &Client,
    request: &ChatCompletionRequest,
) -> Result<(), String> {
    let raw_endpoint = request
        .endpoint
        .as_deref()
        .unwrap_or("http://localhost:11434/api/chat");
    let endpoint = normalize_ollama_chat_endpoint(raw_endpoint);

    let mut messages_json = Vec::new();
    if let Some(sys) = &request.system_prompt {
        messages_json.push(json!({
            "role": "system",
            "content": sys
        }));
    }

    for msg in &request.messages {
        messages_json.push(json!({
            "role": msg.role,
            "content": msg.content
        }));
    }

    let payload = json!({
        "model": request.model,
        "messages": messages_json,
        "stream": true
    });

    let res = client
        .post(&endpoint)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama (is it running?): {e}"))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        emit_error(
            app,
            &request.session_id,
            &format!("Ollama Error: {err_text}"),
        );
        return Ok(());
    }

    let mut stream = res.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk_bytes = chunk.map_err(|e| format!("Stream error: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk_bytes));

        while let Some(idx) = buffer.find('\n') {
            let line = buffer[..idx].trim().to_string();
            buffer = buffer[idx + 1..].to_string();

            if !line.is_empty() {
                if let Ok(v) = serde_json::from_str::<Value>(&line) {
                    if let Some(content) = v["message"]["content"].as_str() {
                        emit_text(app, &request.session_id, content);
                    }
                    if v["done"].as_bool().unwrap_or(false) {
                        emit_done(app, &request.session_id);
                        return Ok(());
                    }
                }
            }
        }
    }

    emit_done(app, &request.session_id);
    Ok(())
}

fn emit_text(app: &AppHandle, session_id: &str, delta: &str) {
    let event = StreamChunkEvent {
        session_id: session_id.to_string(),
        chunk_type: "text".to_string(),
        delta: delta.to_string(),
        tool_call: None,
    };
    let _ = app.emit("ai:stream-chunk", event);
}

fn emit_tool_call(app: &AppHandle, session_id: &str, id: &str, name: &str, args: &str) {
    let event = StreamChunkEvent {
        session_id: session_id.to_string(),
        chunk_type: "tool_call".to_string(),
        delta: String::new(),
        tool_call: Some(ToolCallPayload {
            id: id.to_string(),
            name: name.to_string(),
            arguments: args.to_string(),
        }),
    };
    let _ = app.emit("ai:stream-chunk", event);
}

fn emit_done(app: &AppHandle, session_id: &str) {
    let event = StreamChunkEvent {
        session_id: session_id.to_string(),
        chunk_type: "done".to_string(),
        delta: String::new(),
        tool_call: None,
    };
    let _ = app.emit("ai:stream-chunk", event);
}

fn emit_error(app: &AppHandle, session_id: &str, err: &str) {
    let event = StreamChunkEvent {
        session_id: session_id.to_string(),
        chunk_type: "error".to_string(),
        delta: err.to_string(),
        tool_call: None,
    };
    let _ = app.emit("ai:stream-chunk", event);
}
