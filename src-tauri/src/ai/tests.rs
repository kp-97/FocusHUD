use crate::ai::models::{self, ChatCompletionRequest, ChatMessageParam, StreamChunkEvent};
use crate::ai::tools::{execute_tool, get_default_tools};
use crate::db::migrations::run_migrations;
use crate::db::queries::{get_all_goals, get_all_tasks};
use rusqlite::Connection;

#[test]
fn test_get_default_tools_returns_core_tools() {
    let tools = get_default_tools();
    assert_eq!(tools.len(), 3);

    let names: Vec<String> = tools.into_iter().map(|t| t.name).collect();
    assert!(names.contains(&"create_task".to_string()));
    assert!(names.contains(&"create_goal".to_string()));
    assert!(names.contains(&"get_system_diagnostics".to_string()));
}

#[test]
fn test_execute_tool_create_task() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let args = r#"{"title": "Implement AI Chat", "priority": 1, "dueDate": "2026-12-01"}"#;
    let res = execute_tool(&conn, "create_task", args).unwrap();

    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["status"], "success");
    assert!(parsed["message"].as_str().unwrap().contains("Implement AI Chat"));

    let tasks = get_all_tasks(&conn).unwrap();
    assert_eq!(tasks.len(), 1);
    assert_eq!(tasks[0].title, "Implement AI Chat");
    assert_eq!(tasks[0].priority, 1);
    assert_eq!(tasks[0].due_date.as_deref(), Some("2026-12-01"));
}

#[test]
fn test_execute_tool_create_goal() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let args = r#"{"title": "Launch FocusHUD 1.0", "targetDate": "2027-01-01"}"#;
    let res = execute_tool(&conn, "create_goal", args).unwrap();

    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["status"], "success");

    let goals = get_all_goals(&conn).unwrap();
    assert_eq!(goals.len(), 1);
    assert_eq!(goals[0].title, "Launch FocusHUD 1.0");
    assert_eq!(goals[0].target_date.as_deref(), Some("2027-01-01"));
}

#[test]
fn test_execute_tool_get_system_diagnostics() {
    let conn = Connection::open_in_memory().unwrap();
    let res = execute_tool(&conn, "get_system_diagnostics", "{}").unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert!(parsed.is_object());
}

#[test]
fn test_execute_tool_unknown_errors() {
    let conn = Connection::open_in_memory().unwrap();
    let err = execute_tool(&conn, "non_existent_tool", "{}").unwrap_err();
    assert!(err.contains("Unknown tool"));
}

#[test]
fn test_chat_request_and_event_serialization() {
    let req = ChatCompletionRequest {
        session_id: "s1".to_string(),
        provider: "ollama".to_string(),
        model: "llama3.2".to_string(),
        api_key: None,
        endpoint: Some("http://localhost:11434/api/chat".to_string()),
        system_prompt: Some("You are an assistant".to_string()),
        messages: vec![ChatMessageParam {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }],
        temperature: Some(0.7),
        tools: None,
    };

    let serialized = serde_json::to_string(&req).unwrap();
    let deserialized: ChatCompletionRequest = serde_json::from_str(&serialized).unwrap();
    assert_eq!(deserialized.model, "llama3.2");

    let event = StreamChunkEvent {
        session_id: "s1".to_string(),
        chunk_type: "text".to_string(),
        delta: "World".to_string(),
        tool_call: None,
    };
    let event_json = serde_json::to_string(&event).unwrap();
    assert!(event_json.contains("World"));
}

#[test]
fn test_endpoint_normalization() {
    // OpenAI chat completions normalizer
    assert_eq!(
        models::normalize_openai_chat_endpoint("http://localhost:1234"),
        "http://localhost:1234/v1/chat/completions"
    );
    assert_eq!(
        models::normalize_openai_chat_endpoint("http://localhost:1234/"),
        "http://localhost:1234/v1/chat/completions"
    );
    assert_eq!(
        models::normalize_openai_chat_endpoint("http://localhost:1234/v1"),
        "http://localhost:1234/v1/chat/completions"
    );
    assert_eq!(
        models::normalize_openai_chat_endpoint("http://localhost:1234/v1/chat/completions"),
        "http://localhost:1234/v1/chat/completions"
    );

    // OpenAI models normalizer
    assert_eq!(
        models::normalize_openai_models_endpoint("http://localhost:1234"),
        "http://localhost:1234/v1/models"
    );
    assert_eq!(
        models::normalize_openai_models_endpoint("http://localhost:1234/v1"),
        "http://localhost:1234/v1/models"
    );
    assert_eq!(
        models::normalize_openai_models_endpoint("http://localhost:1234/v1/chat/completions"),
        "http://localhost:1234/v1/models"
    );

    // Ollama chat and tags normalizers
    assert_eq!(
        models::normalize_ollama_chat_endpoint("http://localhost:11434"),
        "http://localhost:11434/api/chat"
    );
    assert_eq!(
        models::normalize_ollama_tags_endpoint("http://localhost:11434"),
        "http://localhost:11434/api/tags"
    );
}
