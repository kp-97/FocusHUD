use super::common::current_timestamp_ms;
use crate::db::models::{LegacyActionPlanNode, LegacyGoalNode, LegacyStorageData, LegacyTaskItem};
use rusqlite::{Connection, Result, params};

pub fn is_database_empty(conn: &Connection) -> Result<bool> {
    let goal_count: i64 = conn.query_row("SELECT COUNT(*) FROM goals", [], |r| r.get(0))?;
    let task_count: i64 = conn.query_row("SELECT COUNT(*) FROM tasks", [], |r| r.get(0))?;
    let plan_count: i64 = conn.query_row("SELECT COUNT(*) FROM action_plans", [], |r| r.get(0))?;
    let note_count: i64 = conn.query_row("SELECT COUNT(*) FROM notes", [], |r| r.get(0))?;

    Ok(goal_count == 0 && task_count == 0 && plan_count == 0 && note_count == 0)
}

pub fn migrate_legacy_data(conn: &mut Connection, data: &LegacyStorageData) -> Result<()> {
    let tx = conn.transaction()?;
    let now = current_timestamp_ms();

    // Helper to recursively insert goals and their children
    fn insert_legacy_goals(
        tx: &rusqlite::Transaction,
        goals: &[LegacyGoalNode],
        parent_id: Option<String>,
        now: i64,
    ) -> Result<()> {
        for (i, g) in goals.iter().enumerate() {
            let status = if g.completed { "completed" } else { "active" };
            let pid = g.parent_id.clone().or_else(|| parent_id.clone());

            tx.execute(
                "INSERT OR IGNORE INTO goals (id, parent_id, title, description, status, target_date, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, '', ?4, NULL, ?5, ?6, ?6)",
                params![g.id, pid, g.title, status, i as i32, now],
            )?;

            if let Some(ref children) = g.children {
                insert_legacy_goals(tx, children, Some(g.id.clone()), now)?;
            }
        }
        Ok(())
    }

    // Helper to recursively insert tasks and their subtasks
    fn insert_legacy_tasks(
        tx: &rusqlite::Transaction,
        tasks: &[LegacyTaskItem],
        parent_id: Option<String>,
        now: i64,
    ) -> Result<()> {
        for (i, t) in tasks.iter().enumerate() {
            let status = if let Some(ref s) = t.status {
                s.as_str()
            } else if t.completed {
                "done"
            } else {
                "todo"
            };
            let pid = t.parent_id.clone().or_else(|| parent_id.clone());

            tx.execute(
                "INSERT OR IGNORE INTO tasks (id, parent_id, goal_id, title, description, status, priority, due_date, estimated_minutes, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, '', ?5, 3, NULL, NULL, ?6, ?7, ?7)",
                params![t.id, pid, t.goal_id, t.title, status, i as i32, now],
            )?;

            if let Some(ref subtasks) = t.subtasks {
                insert_legacy_tasks(tx, subtasks, Some(t.id.clone()), now)?;
            }
        }
        Ok(())
    }

    // Helper to recursively insert action plans and their children
    fn insert_legacy_plans(
        tx: &rusqlite::Transaction,
        plans: &[LegacyActionPlanNode],
        parent_id: Option<String>,
        now: i64,
    ) -> Result<()> {
        for (i, p) in plans.iter().enumerate() {
            let status = if p.completed { "completed" } else { "draft" };
            let pid = p.parent_id.clone().or_else(|| parent_id.clone());

            tx.execute(
                "INSERT OR IGNORE INTO action_plans (id, parent_id, goal_id, task_id, title, content, status, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, NULL, NULL, ?3, '', ?4, ?5, ?6, ?6)",
                params![p.id, pid, p.title, status, i as i32, now],
            )?;

            if let Some(ref children) = p.children {
                insert_legacy_plans(tx, children, Some(p.id.clone()), now)?;
            }
        }
        Ok(())
    }

    if let Some(ref goals) = data.goals {
        insert_legacy_goals(&tx, goals, None, now)?;
    }

    if let Some(ref tasks) = data.tasks {
        insert_legacy_tasks(&tx, tasks, None, now)?;
    }

    if let Some(ref plans) = data.action_plans {
        insert_legacy_plans(&tx, plans, None, now)?;
    }

    tx.commit()?;
    Ok(())
}
