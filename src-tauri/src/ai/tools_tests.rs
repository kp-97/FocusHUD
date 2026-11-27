use crate::ai::tools::execute_tool;
use crate::db::migrations::run_migrations;
use crate::db::queries::{get_all_goals, get_all_notes, get_all_tasks, get_setting};
use rusqlite::Connection;
use serde_json::Value;

#[test]
fn test_execute_tool_update_and_delete_task() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let create_res = execute_tool(
        &conn,
        "create_task",
        r#"{"title": "Initial Task", "priority": 3}"#,
    )
    .unwrap();
    let task_id = serde_json::from_str::<Value>(&create_res).unwrap()["taskId"]
        .as_str()
        .unwrap()
        .to_string();

    let update_args = format!(
        r#"{{"id": "{}", "status": "in_progress", "title": "Updated Task"}}"#,
        task_id
    );
    let update_res = execute_tool(&conn, "update_task", &update_args).unwrap();
    assert!(update_res.contains("success"));

    let tasks = get_all_tasks(&conn).unwrap();
    assert_eq!(tasks[0].title, "Updated Task");
    assert_eq!(tasks[0].status, "in_progress");

    let delete_args = format!(r#"{{"id": "{}"}}"#, task_id);
    let delete_res = execute_tool(&conn, "delete_task", &delete_args).unwrap();
    assert!(delete_res.contains("success"));

    let remaining = get_all_tasks(&conn).unwrap();
    assert_eq!(remaining.len(), 0);
}

#[test]
fn test_execute_tool_delete_calendar_event_supports_task_ids() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let create_res = execute_tool(&conn, "create_task", r#"{"title": "Calendar Task"}"#).unwrap();
    let task_id = serde_json::from_str::<Value>(&create_res).unwrap()["taskId"]
        .as_str()
        .unwrap()
        .to_string();

    let delete_args = format!(r#"{{"id": "{}"}}"#, task_id);
    let delete_res = execute_tool(&conn, "delete_calendar_event", &delete_args).unwrap();
    assert!(delete_res.contains("Calendar task"));

    let remaining = get_all_tasks(&conn).unwrap();
    assert_eq!(remaining.len(), 0);
}

#[test]
fn test_execute_tool_update_and_delete_goal() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    let create_res = execute_tool(
        &conn,
        "create_goal",
        r#"{"title": "Master Tactical AI", "description": "Core goals"}"#,
    )
    .unwrap();
    let goal_id = serde_json::from_str::<Value>(&create_res).unwrap()["goalId"]
        .as_str()
        .unwrap()
        .to_string();

    let update_args = format!(
        r#"{{"id": "{}", "title": "Master Tactical AI V2", "status": "completed", "progress": 100}}"#,
        goal_id
    );
    let update_res = execute_tool(&conn, "update_goal", &update_args).unwrap();
    assert!(update_res.contains("success"));

    let goals = get_all_goals(&conn).unwrap();
    assert_eq!(goals[0].title, "Master Tactical AI V2");
    assert_eq!(goals[0].status, "completed");
    assert!(goals[0].description.contains("100%"));

    let delete_args = format!(r#"{{"id": "{}"}}"#, goal_id);
    let delete_res = execute_tool(&conn, "delete_goal", &delete_args).unwrap();
    assert!(delete_res.contains("success"));

    let remaining = get_all_goals(&conn).unwrap();
    assert_eq!(remaining.len(), 0);
}

#[test]
fn test_execute_tool_control_pomodoro() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    // Start in focus mode
    let start_res = execute_tool(
        &conn,
        "control_pomodoro",
        r#"{"action": "start", "mode": "focus", "durationMinutes": 25}"#,
    )
    .unwrap();
    let start_v: Value = serde_json::from_str(&start_res).unwrap();
    assert_eq!(start_v["status"], "success");
    assert_eq!(start_v["isRunning"], true);
    assert_eq!(start_v["mode"], "focus");

    // Pause timer
    let pause_res = execute_tool(&conn, "control_pomodoro", r#"{"action": "pause"}"#).unwrap();
    let pause_v: Value = serde_json::from_str(&pause_res).unwrap();
    assert_eq!(pause_v["isRunning"], false);

    // Skip to next phase
    let skip_res = execute_tool(&conn, "control_pomodoro", r#"{"action": "skip"}"#).unwrap();
    let skip_v: Value = serde_json::from_str(&skip_res).unwrap();
    assert_eq!(skip_v["mode"], "short_break");

    // Reset timer
    let reset_res = execute_tool(&conn, "control_pomodoro", r#"{"action": "reset"}"#).unwrap();
    let reset_v: Value = serde_json::from_str(&reset_res).unwrap();
    assert_eq!(reset_v["isRunning"], false);

    // Verify setting persisted in SQLite
    let saved = get_setting(&conn, "focushud_pomodoro_state")
        .unwrap()
        .unwrap();
    let parsed_saved: Value = serde_json::from_str(&saved).unwrap();
    assert_eq!(parsed_saved["mode"], "short_break");
}

#[test]
fn test_execute_tool_notes_crud() {
    let mut conn = Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    // Create note
    let create_res = execute_tool(
        &conn,
        "create_note",
        r##"{"title": "Architecture Blueprint", "content": "Section 1 - Initial notes"}"##,
    )
    .unwrap();
    let create_v: Value = serde_json::from_str(&create_res).unwrap();
    assert_eq!(create_v["status"], "success");
    let note_id = create_v["noteId"].as_str().unwrap().to_string();

    // Search notes
    let search_res = execute_tool(&conn, "search_notes", r#"{"query": "blueprint"}"#).unwrap();
    let search_v: Value = serde_json::from_str(&search_res).unwrap();
    assert_eq!(search_v["count"], 1);
    assert_eq!(search_v["notes"][0]["title"], "Architecture Blueprint");

    // Search nonexistent notes
    let search_empty = execute_tool(&conn, "search_notes", r#"{"query": "assignment 1"}"#).unwrap();
    let empty_v: Value = serde_json::from_str(&search_empty).unwrap();
    assert_eq!(empty_v["count"], 0);
    assert_eq!(
        empty_v["message"],
        "No notes found matching 'assignment 1'."
    );

    // Read note
    let read_res =
        execute_tool(&conn, "read_note", &format!(r#"{{"id": "{}"}}"#, note_id)).unwrap();
    let read_v: Value = serde_json::from_str(&read_res).unwrap();
    assert_eq!(read_v["note"]["title"], "Architecture Blueprint");
    assert!(
        read_v["note"]["content"]
            .as_str()
            .unwrap()
            .contains("Initial notes")
    );

    // Update note with append
    let update_res = execute_tool(
        &conn,
        "update_note",
        &format!(
            r##"{{"id": "{}", "content": "Section 2 - Appended details", "append": true}}"##,
            note_id
        ),
    )
    .unwrap();
    assert!(update_res.contains("success"));

    let notes = get_all_notes(&conn).unwrap();
    assert_eq!(notes.len(), 1);
    assert!(notes[0].content.contains("Initial notes"));
    assert!(notes[0].content.contains("Appended details"));
}
