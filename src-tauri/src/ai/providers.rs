use crate::ai::models::{
    ChatCompletionRequest, normalize_ollama_chat_endpoint, normalize_openai_chat_endpoint,
};
use crate::ai::streaming::{
    PendingTool, clear_cancelled_stream, convert_message_param_to_json, convert_tools, emit_done,
    emit_error, emit_text, emit_tool_call, flush_pending_tools, is_stream_cancelled,
};
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::{Value, json};
use tauri::AppHandle;

pub async fn stream_provider(
    app: &AppHandle,
    request: &ChatCompletionRequest,
) -> Result<(), String> {
    clear_cancelled_stream(&request.session_id);
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
        body_messages.push(convert_message_param_to_json(msg));
    }

    let mut payload = json!({
        "model": request.model,
        "messages": body_messages,
        "stream": true,
        "temperature": request.temperature.unwrap_or(0.7),
    });

    if let Some(tools) = &request.tools {
        if !tools.is_empty() {
            payload["tools"] = json!(convert_tools(tools));
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
    let mut pending_tools: std::collections::BTreeMap<usize, PendingTool> =
        std::collections::BTreeMap::new();

    while let Some(chunk) = stream.next().await {
        if is_stream_cancelled(&request.session_id) {
            break;
        }
        let chunk_bytes = chunk.map_err(|e| format!("Error receiving stream chunk: {e}"))?;
        let text = String::from_utf8_lossy(&chunk_bytes);
        buffer.push_str(&text);

        while let Some(idx) = buffer.find('\n') {
            let line = buffer[..idx].trim().to_string();
            buffer = buffer[idx + 1..].to_string();

            if let Some(data_str) = line.strip_prefix("data: ") {
                if data_str == "[DONE]" {
                    flush_pending_tools(app, &request.session_id, &mut pending_tools);
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
                                    let index = tc["index"].as_u64().unwrap_or(0) as usize;
                                    let entry = pending_tools.entry(index).or_default();
                                    if let Some(id) = tc["id"].as_str() {
                                        if !id.is_empty() {
                                            entry.id = id.to_string();
                                        }
                                    }
                                    if let Some(func) = tc["function"].as_object() {
                                        if let Some(n) = func.get("name").and_then(|v| v.as_str()) {
                                            if !n.is_empty() {
                                                entry.name.push_str(n);
                                            }
                                        }
                                        if let Some(a) =
                                            func.get("arguments").and_then(|v| v.as_str())
                                        {
                                            entry.arguments.push_str(a);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    flush_pending_tools(app, &request.session_id, &mut pending_tools);
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
            if m.role == "tool" {
                json!({
                    "role": "user",
                    "content": format!("[Tool Result for {}: {}]", m.name.as_deref().unwrap_or("function"), m.content.as_deref().unwrap_or(""))
                })
            } else {
                json!({
                    "role": m.role,
                    "content": m.content.as_deref().unwrap_or("")
                })
            }
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
        if is_stream_cancelled(&request.session_id) {
            break;
        }
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
            if m.role == "tool" {
                json!({
                    "role": "user",
                    "parts": [{ "text": format!("[Tool Result for {}: {}]", m.name.as_deref().unwrap_or("function"), m.content.as_deref().unwrap_or("")) }]
                })
            } else {
                json!({
                    "role": if m.role == "assistant" { "model" } else { "user" },
                    "parts": [{ "text": m.content.as_deref().unwrap_or("") }]
                })
            }
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
        if is_stream_cancelled(&request.session_id) {
            break;
        }
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
        messages_json.push(convert_message_param_to_json(msg));
    }

    let mut payload = json!({
        "model": request.model,
        "messages": messages_json,
        "stream": true
    });
    let mut options = serde_json::Map::new();
    if let Some(ctx) = request.context_size {
        options.insert("num_ctx".to_string(), json!(ctx));
    }
    if let Some(temp) = request.temperature {
        options.insert("temperature".to_string(), json!(temp));
    }
    if !options.is_empty() {
        payload["options"] = Value::Object(options);
    }

    if let Some(tools) = &request.tools {
        if !tools.is_empty() {
            payload["tools"] = json!(convert_tools(tools));
        }
    }

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
        if is_stream_cancelled(&request.session_id) {
            break;
        }
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
                    if let Some(tool_calls) = v["message"]["tool_calls"].as_array() {
                        for (i, tc) in tool_calls.iter().enumerate() {
                            if let Some(func) = tc["function"].as_object() {
                                let name = func
                                    .get("name")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or_default();
                                let args_val =
                                    func.get("arguments").unwrap_or(&serde_json::Value::Null);
                                let args_str = if args_val.is_string() {
                                    args_val.as_str().unwrap().to_string()
                                } else if args_val.is_object() {
                                    args_val.to_string()
                                } else {
                                    "{}".to_string()
                                };
                                if !name.is_empty() {
                                    emit_tool_call(
                                        app,
                                        &request.session_id,
                                        &format!("tc_{i}"),
                                        name,
                                        &args_str,
                                    );
                                }
                            }
                        }
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
