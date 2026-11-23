use crate::ai::models::{normalize_ollama_tags_endpoint, normalize_openai_models_endpoint};
use reqwest::Client;
use serde_json::Value;

pub async fn fetch_available_models(
    provider: &str,
    endpoint: Option<&str>,
    api_key: Option<&str>,
) -> Result<Vec<String>, String> {
    let client = Client::new();

    match provider.to_lowercase().as_str() {
        "ollama" => fetch_ollama_models(&client, endpoint).await,
        "anthropic" => fetch_anthropic_models(&client, api_key).await,
        "gemini" => fetch_gemini_models(&client, api_key).await,
        _ => fetch_openai_compatible_models(&client, endpoint, api_key).await,
    }
}

async fn fetch_ollama_models(
    client: &Client,
    endpoint: Option<&str>,
) -> Result<Vec<String>, String> {
    let raw_endpoint = endpoint.unwrap_or("http://localhost:11434/api/tags");
    let target_url = normalize_ollama_tags_endpoint(raw_endpoint);

    let res = client
        .get(&target_url)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama at {target_url}: {e}"))?;

    if !res.status().is_success() {
        return Err(format!("Ollama returned HTTP {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama JSON: {e}"))?;

    let mut models = Vec::new();
    if let Some(arr) = json.get("models").and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                models.push(name.to_string());
            }
        }
    }

    if models.is_empty() {
        return Err("Connected to Ollama, but no models are currently installed.".to_string());
    }

    Ok(models)
}

async fn fetch_openai_compatible_models(
    client: &Client,
    endpoint: Option<&str>,
    api_key: Option<&str>,
) -> Result<Vec<String>, String> {
    let raw_endpoint = endpoint.unwrap_or("https://api.openai.com/v1/models");
    let target_url = normalize_openai_models_endpoint(raw_endpoint);

    let mut req = client.get(&target_url);
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            req = req.header("Authorization", format!("Bearer {}", key.trim()));
        }
    }

    let res = req
        .send()
        .await
        .map_err(|e| format!("Failed to connect to server at {target_url}: {e}"))?;

    if !res.status().is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return Err(format!("Server returned error: {err_body}"));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse models response: {e}"))?;

    let mut models = Vec::new();
    if let Some(arr) = json.get("data").and_then(|v| v.as_array()) {
        for item in arr {
            if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                models.push(id.to_string());
            }
        }
    }

    if models.is_empty() {
        return Err("Server reachable, but returned 0 available models.".to_string());
    }

    models.sort();
    Ok(models)
}

async fn fetch_anthropic_models(
    client: &Client,
    api_key: Option<&str>,
) -> Result<Vec<String>, String> {
    let default_models = vec![
        "claude-3-5-sonnet-20241022".to_string(),
        "claude-3-5-haiku-20241022".to_string(),
        "claude-3-opus-20240229".to_string(),
    ];

    let key = match api_key {
        Some(k) if !k.trim().is_empty() => k.trim(),
        _ => return Ok(default_models),
    };

    let res = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", key)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await;

    if let Ok(resp) = res {
        if resp.status().is_success() {
            if let Ok(json) = resp.json::<Value>().await {
                if let Some(arr) = json.get("data").and_then(|v| v.as_array()) {
                    let mut list = Vec::new();
                    for item in arr {
                        if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                            list.push(id.to_string());
                        }
                    }
                    if !list.is_empty() {
                        return Ok(list);
                    }
                }
            }
        }
    }

    Ok(default_models)
}

async fn fetch_gemini_models(
    client: &Client,
    api_key: Option<&str>,
) -> Result<Vec<String>, String> {
    let default_models = vec![
        "gemini-1.5-flash".to_string(),
        "gemini-1.5-pro".to_string(),
        "gemini-2.0-flash-exp".to_string(),
    ];

    let key = match api_key {
        Some(k) if !k.trim().is_empty() => k.trim(),
        _ => return Ok(default_models),
    };

    let url = format!("https://generativelanguage.googleapis.com/v1beta/models?key={key}");
    let res = client.get(&url).send().await;

    if let Ok(resp) = res {
        if resp.status().is_success() {
            if let Ok(json) = resp.json::<Value>().await {
                if let Some(arr) = json.get("models").and_then(|v| v.as_array()) {
                    let mut list = Vec::new();
                    for item in arr {
                        if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                            let clean_name = name.strip_prefix("models/").unwrap_or(name);
                            if clean_name.contains("gemini") {
                                list.push(clean_name.to_string());
                            }
                        }
                    }
                    if !list.is_empty() {
                        return Ok(list);
                    }
                }
            }
        }
    }

    Ok(default_models)
}
