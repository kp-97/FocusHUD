use crate::ai::models::{self, ChatCompletionRequest, ChatMessageParam, StreamChunkEvent};
use crate::ai::tools::{execute_tool, get_default_tools};
use crate::db::migrations::run_migrations;
use crate::db::queries::{get_all_calendar_events, get_all_goals, get_all_tasks, set_setting};
use rusqlite::Connection;

#[test]
fn test_get_default_tools_returns_core_tools() {
    let tools = get_default_tools();
    assert_eq!(tools.len(), 21);

    let names: Vec<String> = tools.into_iter().map(|t| t.name).collect();
    assert!(names.contains(&"get_current_time".to_string()));
    assert!(names.contains(&"create_task".to_string()));
    assert!(names.contains(&"update_task".to_string()));
    assert!(names.contains(&"delete_task".to_string()));
    assert!(names.contains(&"create_goal".to_string()));
    assert!(names.contains(&"update_goal".to_string()));
    assert!(names.contains(&"delete_goal".to_string()));
    assert!(names.contains(&"get_tasks".to_string()));
    assert!(names.contains(&"get_goals".to_string()));
    assert!(names.contains(&"get_workspace_summary".to_string()));
    assert!(names.contains(&"get_pomodoro_status".to_string()));
    assert!(names.contains(&"control_pomodoro".to_string()));
    assert!(names.contains(&"search_notes".to_string()));
    assert!(names.contains(&"read_note".to_string()));
    assert!(names.contains(&"create_note".to_string()));
    assert!(names.contains(&"update_note".to_string()));
    assert!(names.contains(&"get_system_diagnostics".to_string()));
    assert!(names.contains(&"get_calendar_events".to_string()));
    assert!(names.contains(&"create_calendar_event".to_string()));
    assert!(names.contains(&"update_calendar_event".to_string()));
    assert!(names.contains(&"delete_calendar_event".to_string()));
}

#[test]
fn test_execute_tool_get_current_time() {
    let conn = Connection::open_in_memory().unwrap();
    let res = execute_tool(&conn, "get_current_time", "").unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert!(parsed["date"].is_string());
    assert!(parsed["time"].is_string());
    assert!(parsed["dayOfWeek"].is_string());
    assert!(parsed["formatted"].is_string());
}

#[test]
fn test_execute_tool_empty_arguments_and_case_insensitive() {
    let conn = Connection::open_in_memory().unwrap();
    let res = execute_tool(&conn, "GET_CURRENT_TIME", "").unwrap();
    assert!(res.contains("formatted"));

    let res_diag = execute_tool(&conn, "Get_System_Diagnostics", "   ").unwrap();
    assert!(res_diag.starts_with('{'));
}

#[test]
fn test_execute_tool_create_task() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let args = r#"{"title": "Implement AI Chat", "priority": 1, "dueDate": "2026-12-01"}"#;
    let res = execute_tool(&conn, "create_task", args).unwrap();

    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["status"], "success");
    assert!(
        parsed["message"]
            .as_str()
            .unwrap()
            .contains("Implement AI Chat")
    );

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
fn test_execute_tool_get_tasks_and_filtering() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    execute_tool(
        &conn,
        "create_task",
        r#"{"title": "Pending Task", "priority": 1}"#,
    )
    .unwrap();
    execute_tool(
        &conn,
        "create_task",
        r#"{"title": "Low Priority Task", "priority": 4}"#,
    )
    .unwrap();

    let res = execute_tool(&conn, "get_tasks", r#"{"status": "pending"}"#).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["count"], 2);

    let priority_res = execute_tool(&conn, "get_tasks", r#"{"priority": 1}"#).unwrap();
    let priority_parsed: serde_json::Value = serde_json::from_str(&priority_res).unwrap();
    assert_eq!(priority_parsed["count"], 1);
    assert_eq!(priority_parsed["tasks"][0]["title"], "Pending Task");
}

#[test]
fn test_execute_tool_get_goals() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    execute_tool(&conn, "create_goal", r#"{"title": "Strategic Goal 1"}"#).unwrap();

    let res = execute_tool(&conn, "get_goals", r#"{"status": "active"}"#).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["count"], 1);
    assert_eq!(parsed["goals"][0]["title"], "Strategic Goal 1");
}

#[test]
fn test_execute_tool_get_workspace_summary() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    execute_tool(
        &conn,
        "create_task",
        r#"{"title": "Urgent Bug", "priority": 1}"#,
    )
    .unwrap();
    execute_tool(&conn, "create_goal", r#"{"title": "Q4 Deliverables"}"#).unwrap();

    let res = execute_tool(&conn, "get_workspace_summary", "{}").unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();

    assert_eq!(parsed["tasks"]["total"], 1);
    assert_eq!(parsed["tasks"]["urgent"], 1);
    assert_eq!(parsed["goals"]["active"], 1);
    assert_eq!(parsed["pomodoro"]["mode"], "focus");
}

#[test]
fn test_execute_tool_get_pomodoro_status() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    // Default status
    let res = execute_tool(&conn, "get_pomodoro_status", "{}").unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["mode"], "focus");
    assert_eq!(parsed["state"], "idle");

    // After state is saved
    set_setting(
        &conn,
        "focushud_pomodoro_state",
        r#"{"mode": "shortBreak", "isRunning": true, "isPaused": false, "timeLeft": 300, "currentCycle": 2, "totalCycles": 4}"#,
    )
    .unwrap();

    let synced_res = execute_tool(&conn, "get_pomodoro_status", "{}").unwrap();
    let synced_parsed: serde_json::Value = serde_json::from_str(&synced_res).unwrap();
    assert_eq!(synced_parsed["mode"], "shortBreak");
    assert_eq!(synced_parsed["isRunning"], true);
    assert_eq!(synced_parsed["timeLeft"], 300);
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
            content: Some("Hello".to_string()),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        }],
        temperature: Some(0.7),
        tools: None,
        context_size: Some(8192),
    };

    let serialized = serde_json::to_string(&req).unwrap();
    let deserialized: ChatCompletionRequest = serde_json::from_str(&serialized).unwrap();
    assert_eq!(deserialized.model, "llama3.2");
    assert_eq!(deserialized.context_size, Some(8192));

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

#[test]
fn test_execute_tool_create_calendar_event() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let args = r#"{
        "title": "Sprint Planning",
        "date": "2026-12-01",
        "startTime": "10:00",
        "endTime": "11:00",
        "description": "Bi-weekly sprint planning meeting",
        "location": "Room 404"
    }"#;
    let res = execute_tool(&conn, "create_calendar_event", args).unwrap();

    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["status"], "success");
    assert!(
        parsed["message"]
            .as_str()
            .unwrap()
            .contains("Sprint Planning")
    );
    let event_id = parsed["eventId"].as_str().unwrap();

    let events = get_all_calendar_events(&conn).unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].id, event_id);
    assert_eq!(events[0].title, "Sprint Planning");
    assert_eq!(events[0].date, "2026-12-01");
    assert_eq!(events[0].start_time, "10:00");
    assert_eq!(events[0].end_time, "11:00");
    assert_eq!(events[0].location, "Room 404");
}

#[test]
fn test_execute_tool_get_calendar_events_and_filtering() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    execute_tool(
        &conn,
        "create_calendar_event",
        r#"{"title": "Team Standup", "date": "2026-12-01", "startTime": "09:00", "endTime": "09:30"}"#,
    )
    .unwrap();
    execute_tool(
        &conn,
        "create_calendar_event",
        r#"{"title": "Client Review", "date": "2026-12-05", "startTime": "14:00", "endTime": "15:00"}"#,
    )
    .unwrap();

    // Query all
    let res = execute_tool(&conn, "get_calendar_events", "{}").unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["count"], 2);

    // Query with date range
    let range_res = execute_tool(
        &conn,
        "get_calendar_events",
        r#"{"startDate": "2026-12-02", "endDate": "2026-12-06"}"#,
    )
    .unwrap();
    let range_parsed: serde_json::Value = serde_json::from_str(&range_res).unwrap();
    assert_eq!(range_parsed["count"], 1);
    assert_eq!(range_parsed["events"][0]["title"], "Client Review");

    // Query with keyword search
    let search_res = execute_tool(&conn, "get_calendar_events", r#"{"query": "standup"}"#).unwrap();
    let search_parsed: serde_json::Value = serde_json::from_str(&search_res).unwrap();
    assert_eq!(search_parsed["count"], 1);
    assert_eq!(search_parsed["events"][0]["title"], "Team Standup");
}

#[test]
fn test_execute_tool_get_calendar_events_recurrence() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    // Recurring weekly on Thursday (e.g. 2026-10-29 was Thursday, daysOfWeek [3])
    execute_tool(
        &conn,
        "create_calendar_event",
        r#"{"title": "Weekly Lecture", "date": "2026-10-29", "startTime": "16:15", "endTime": "19:15", "recurrence": "custom:{\"interval\":1,\"unit\":\"week\",\"daysOfWeek\":[3],\"endType\":\"on\",\"endDate\":\"2026-12-20\"}"}"#,
    )
    .unwrap();

    // Query on 2026-11-26 (which is Thursday)
    let res = execute_tool(
        &conn,
        "get_calendar_events",
        r#"{"startDate": "2026-11-26", "endDate": "2026-11-26"}"#,
    )
    .unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&res).unwrap();
    assert_eq!(parsed["count"], 1);
    assert_eq!(parsed["events"][0]["title"], "Weekly Lecture");
    assert_eq!(parsed["events"][0]["date"], "2026-11-26");

    // Query on 2026-11-27 (Friday - should not match)
    let friday_res = execute_tool(
        &conn,
        "get_calendar_events",
        r#"{"startDate": "2026-11-27", "endDate": "2026-11-27"}"#,
    )
    .unwrap();
    let friday_parsed: serde_json::Value = serde_json::from_str(&friday_res).unwrap();
    assert_eq!(friday_parsed["count"], 0);
}

#[test]
fn test_execute_tool_update_calendar_event() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let create_res = execute_tool(
        &conn,
        "create_calendar_event",
        r#"{"title": "Focus Block", "date": "2026-12-01", "startTime": "08:00", "endTime": "10:00"}"#,
    )
    .unwrap();
    let create_parsed: serde_json::Value = serde_json::from_str(&create_res).unwrap();
    let event_id = create_parsed["eventId"].as_str().unwrap();

    let update_args = format!(
        r##"{{"id": "{}", "title": "Deep Focus Session", "startTime": "08:30", "color": "#ff007f"}}"##,
        event_id
    );
    let update_res = execute_tool(&conn, "update_calendar_event", &update_args).unwrap();
    let update_parsed: serde_json::Value = serde_json::from_str(&update_res).unwrap();
    assert_eq!(update_parsed["status"], "success");

    let events = get_all_calendar_events(&conn).unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].title, "Deep Focus Session");
    assert_eq!(events[0].start_time, "08:30");
    assert_eq!(events[0].end_time, "10:00");
    assert_eq!(events[0].color, "#ff007f");
}

#[test]
fn test_execute_tool_delete_calendar_event() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let create_res = execute_tool(
        &conn,
        "create_calendar_event",
        r#"{"title": "Temporary Meeting", "date": "2026-12-01", "startTime": "11:00", "endTime": "11:30"}"#,
    )
    .unwrap();
    let create_parsed: serde_json::Value = serde_json::from_str(&create_res).unwrap();
    let event_id = create_parsed["eventId"].as_str().unwrap();

    let delete_args = format!(r#"{{"id": "{}"}}"#, event_id);
    let delete_res = execute_tool(&conn, "delete_calendar_event", &delete_args).unwrap();
    let delete_parsed: serde_json::Value = serde_json::from_str(&delete_res).unwrap();
    assert_eq!(delete_parsed["status"], "success");

    let events = get_all_calendar_events(&conn).unwrap();
    assert_eq!(events.len(), 0);
}
