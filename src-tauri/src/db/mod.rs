pub mod migrations;
pub mod models;
pub mod queries;

use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

pub fn get_db_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("Failed to resolve app_local_data_dir: {e}"))?;

    fs::create_dir_all(&app_dir)?;
    Ok(app_dir.join("focushud.db"))
}

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let db_path = get_db_path(app_handle)?;
    let mut conn = Connection::open(&db_path)?;

    // Enable WAL mode and foreign keys for high-performance concurrent reads/writes
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        "#,
    )?;

    migrations::run_migrations(&mut conn)?;

    Ok(conn)
}

#[cfg(test)]
pub fn init_memory_db() -> Result<Connection, Box<dyn std::error::Error>> {
    let mut conn = Connection::open_in_memory()?;
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        "#,
    )?;
    migrations::run_migrations(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::{
        ActionPlan, Goal, LegacyActionPlanNode, LegacyGoalNode, LegacyStorageData, LegacyTaskItem,
        Note, Task,
    };
    use crate::db::queries;

    #[test]
    fn test_migrations_and_initial_empty_state() {
        let conn = init_memory_db().expect("init memory db failed");
        assert!(queries::is_database_empty(&conn).unwrap());
    }

    #[test]
    fn test_goal_crud_and_nesting() {
        let conn = init_memory_db().expect("init memory db failed");

        let parent_goal = Goal {
            id: "g1".into(),
            parent_id: None,
            title: "Master Rust".into(),
            description: "Deep dive into systems programming".into(),
            status: "active".into(),
            target_date: Some("2026-12-31".into()),
            sort_order: 0,
            created_at: 1000,
            updated_at: 1000,
        };
        queries::upsert_goal(&conn, &parent_goal).unwrap();

        let child_goal = Goal {
            id: "g1-1".into(),
            parent_id: Some("g1".into()),
            title: "Async Rust".into(),
            description: "Tokio and concurrency".into(),
            status: "active".into(),
            target_date: None,
            sort_order: 1,
            created_at: 1001,
            updated_at: 1001,
        };
        queries::upsert_goal(&conn, &child_goal).unwrap();

        let all = queries::get_all_goals(&conn).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].id, "g1");
        assert_eq!(all[1].parent_id, Some("g1".into()));

        // Delete parent cascades to child
        queries::delete_goal(&conn, "g1").unwrap();
        let remaining = queries::get_all_goals(&conn).unwrap();
        assert_eq!(remaining.len(), 0);
    }

    #[test]
    fn test_task_and_action_plan_linkages() {
        let conn = init_memory_db().expect("init memory db failed");

        let goal = Goal {
            id: "g_alpha".into(),
            parent_id: None,
            title: "Product Launch".into(),
            description: "".into(),
            status: "active".into(),
            target_date: None,
            sort_order: 0,
            created_at: 100,
            updated_at: 100,
        };
        queries::upsert_goal(&conn, &goal).unwrap();

        let task = Task {
            id: "t_core".into(),
            parent_id: None,
            goal_id: Some("g_alpha".into()),
            title: "Build SQLite Backend".into(),
            description: "Zero external dependencies".into(),
            status: "todo".into(),
            priority: 1,
            due_date: Some("2026-10-30".into()),
            estimated_minutes: Some(120),
            sort_order: 0,
            created_at: 200,
            updated_at: 200,
        };
        queries::upsert_task(&conn, &task).unwrap();

        let plan = ActionPlan {
            id: "ap_1".into(),
            parent_id: None,
            goal_id: Some("g_alpha".into()),
            task_id: Some("t_core".into()),
            title: "Execution Steps".into(),
            content: "1. Models\n2. Migrations\n3. Queries".into(),
            status: "draft".into(),
            sort_order: 0,
            created_at: 300,
            updated_at: 300,
        };
        queries::upsert_action_plan(&conn, &plan).unwrap();

        let note = Note {
            id: "n_scratch".into(),
            parent_id: None,
            goal_id: Some("g_alpha".into()),
            task_id: Some("t_core".into()),
            action_plan_id: Some("ap_1".into()),
            title: "Design Notes".into(),
            content: "Remember to check WAL mode".into(),
            is_pinned: true,
            sort_order: 0,
            created_at: 400,
            updated_at: 400,
        };
        queries::upsert_note(&conn, &note).unwrap();

        let notes = queries::get_all_notes(&conn).unwrap();
        assert_eq!(notes.len(), 1);
        assert!(notes[0].is_pinned);
        assert_eq!(notes[0].action_plan_id, Some("ap_1".into()));

        // Deleting goal sets goal_id to null on task (ON DELETE SET NULL)
        queries::delete_goal(&conn, "g_alpha").unwrap();
        let tasks = queries::get_all_tasks(&conn).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].goal_id, None);
    }

    #[test]
    fn test_legacy_data_migration() {
        let mut conn = init_memory_db().expect("init memory db failed");

        let legacy = LegacyStorageData {
            goals: Some(vec![LegacyGoalNode {
                id: "old_g1".into(),
                title: "Legacy Goal".into(),
                completed: false,
                completed_at: None,
                parent_id: None,
                children: Some(vec![LegacyGoalNode {
                    id: "old_g1_sub".into(),
                    title: "Legacy Sub Goal".into(),
                    completed: true,
                    completed_at: Some("2026-10-20".into()),
                    parent_id: None,
                    children: None,
                }]),
            }]),
            tasks: Some(vec![LegacyTaskItem {
                id: "old_t1".into(),
                title: "Legacy Task".into(),
                completed: true,
                completed_at: None,
                goal_id: Some("old_g1".into()),
                parent_id: None,
                status: Some("done".into()),
                subtasks: None,
            }]),
            action_plans: Some(vec![LegacyActionPlanNode {
                id: "old_p1".into(),
                title: "Legacy Plan".into(),
                completed: false,
                completed_at: None,
                parent_id: None,
                children: None,
            }]),
        };

        queries::migrate_legacy_data(&mut conn, &legacy).unwrap();

        let goals = queries::get_all_goals(&conn).unwrap();
        assert_eq!(goals.len(), 2);
        assert_eq!(goals[1].parent_id, Some("old_g1".into()));
        assert_eq!(goals[1].status, "completed");

        let tasks = queries::get_all_tasks(&conn).unwrap();
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].goal_id, Some("old_g1".into()));
        assert_eq!(tasks[0].status, "done");

        let plans = queries::get_all_action_plans(&conn).unwrap();
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].title, "Legacy Plan");
    }
}
