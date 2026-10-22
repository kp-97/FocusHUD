use rusqlite::{Connection, Result, params};
use std::time::{SystemTime, UNIX_EPOCH};

use super::models::{
    ActionPlan, Goal, LegacyActionPlanNode, LegacyGoalNode, LegacyStorageData, LegacyTaskItem,
    Note, Task,
};

fn current_timestamp_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ========================================================
// Goals Queries
// ========================================================

pub fn get_all_goals(conn: &Connection) -> Result<Vec<Goal>> {
    let mut stmt = conn.prepare(
        "SELECT id, parent_id, title, description, status, target_date, sort_order, created_at, updated_at
         FROM goals
         ORDER BY sort_order ASC, created_at ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Goal {
            id: row.get(0)?,
            parent_id: row.get(1)?,
            title: row.get(2)?,
            description: row.get(3)?,
            status: row.get(4)?,
            target_date: row.get(5)?,
            sort_order: row.get(6)?,
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    })?;

    let mut goals = Vec::new();
    for r in rows {
        goals.push(r?);
    }
    Ok(goals)
}

pub fn upsert_goal(conn: &Connection, goal: &Goal) -> Result<()> {
    let now = current_timestamp_ms();
    let created_at = if goal.created_at > 0 {
        goal.created_at
    } else {
        now
    };
    let updated_at = now;

    conn.execute(
        "INSERT INTO goals (id, parent_id, title, description, status, target_date, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
            parent_id = excluded.parent_id,
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            target_date = excluded.target_date,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at",
        params![
            goal.id,
            goal.parent_id,
            goal.title,
            goal.description,
            goal.status,
            goal.target_date,
            goal.sort_order,
            created_at,
            updated_at,
        ],
    )?;
    Ok(())
}

pub fn delete_goal(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM goals WHERE id = ?1", params![id])?;
    Ok(())
}

// ========================================================
// Tasks Queries
// ========================================================

pub fn get_all_tasks(conn: &Connection) -> Result<Vec<Task>> {
    let mut stmt = conn.prepare(
        "SELECT id, parent_id, goal_id, title, description, status, priority, due_date, estimated_minutes, sort_order, created_at, updated_at
         FROM tasks
         ORDER BY sort_order ASC, created_at ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(Task {
            id: row.get(0)?,
            parent_id: row.get(1)?,
            goal_id: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            status: row.get(5)?,
            priority: row.get(6)?,
            due_date: row.get(7)?,
            estimated_minutes: row.get(8)?,
            sort_order: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;

    let mut tasks = Vec::new();
    for r in rows {
        tasks.push(r?);
    }
    Ok(tasks)
}

pub fn upsert_task(conn: &Connection, task: &Task) -> Result<()> {
    let now = current_timestamp_ms();
    let created_at = if task.created_at > 0 {
        task.created_at
    } else {
        now
    };
    let updated_at = now;

    conn.execute(
        "INSERT INTO tasks (id, parent_id, goal_id, title, description, status, priority, due_date, estimated_minutes, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET
            parent_id = excluded.parent_id,
            goal_id = excluded.goal_id,
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            priority = excluded.priority,
            due_date = excluded.due_date,
            estimated_minutes = excluded.estimated_minutes,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at",
        params![
            task.id,
            task.parent_id,
            task.goal_id,
            task.title,
            task.description,
            task.status,
            task.priority,
            task.due_date,
            task.estimated_minutes,
            task.sort_order,
            created_at,
            updated_at,
        ],
    )?;
    Ok(())
}

pub fn delete_task(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    Ok(())
}

// ========================================================
// Action Plans Queries
// ========================================================

pub fn get_all_action_plans(conn: &Connection) -> Result<Vec<ActionPlan>> {
    let mut stmt = conn.prepare(
        "SELECT id, parent_id, goal_id, task_id, title, content, status, sort_order, created_at, updated_at
         FROM action_plans
         ORDER BY sort_order ASC, created_at ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(ActionPlan {
            id: row.get(0)?,
            parent_id: row.get(1)?,
            goal_id: row.get(2)?,
            task_id: row.get(3)?,
            title: row.get(4)?,
            content: row.get(5)?,
            status: row.get(6)?,
            sort_order: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;

    let mut plans = Vec::new();
    for r in rows {
        plans.push(r?);
    }
    Ok(plans)
}

pub fn upsert_action_plan(conn: &Connection, plan: &ActionPlan) -> Result<()> {
    let now = current_timestamp_ms();
    let created_at = if plan.created_at > 0 {
        plan.created_at
    } else {
        now
    };
    let updated_at = now;

    conn.execute(
        "INSERT INTO action_plans (id, parent_id, goal_id, task_id, title, content, status, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
            parent_id = excluded.parent_id,
            goal_id = excluded.goal_id,
            task_id = excluded.task_id,
            title = excluded.title,
            content = excluded.content,
            status = excluded.status,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at",
        params![
            plan.id,
            plan.parent_id,
            plan.goal_id,
            plan.task_id,
            plan.title,
            plan.content,
            plan.status,
            plan.sort_order,
            created_at,
            updated_at,
        ],
    )?;
    Ok(())
}

pub fn delete_action_plan(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM action_plans WHERE id = ?1", params![id])?;
    Ok(())
}

// ========================================================
// Notes Queries
// ========================================================

pub fn get_all_notes(conn: &Connection) -> Result<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT id, parent_id, goal_id, task_id, action_plan_id, title, content, is_pinned, sort_order, created_at, updated_at
         FROM notes
         ORDER BY is_pinned DESC, sort_order ASC, updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        let is_pinned_int: i32 = row.get(7)?;
        Ok(Note {
            id: row.get(0)?,
            parent_id: row.get(1)?,
            goal_id: row.get(2)?,
            task_id: row.get(3)?,
            action_plan_id: row.get(4)?,
            title: row.get(5)?,
            content: row.get(6)?,
            is_pinned: is_pinned_int != 0,
            sort_order: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;

    let mut notes = Vec::new();
    for r in rows {
        notes.push(r?);
    }
    Ok(notes)
}

pub fn upsert_note(conn: &Connection, note: &Note) -> Result<()> {
    let now = current_timestamp_ms();
    let created_at = if note.created_at > 0 {
        note.created_at
    } else {
        now
    };
    let updated_at = now;
    let is_pinned_int = if note.is_pinned { 1 } else { 0 };

    conn.execute(
        "INSERT INTO notes (id, parent_id, goal_id, task_id, action_plan_id, title, content, is_pinned, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
            parent_id = excluded.parent_id,
            goal_id = excluded.goal_id,
            task_id = excluded.task_id,
            action_plan_id = excluded.action_plan_id,
            title = excluded.title,
            content = excluded.content,
            is_pinned = excluded.is_pinned,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at",
        params![
            note.id,
            note.parent_id,
            note.goal_id,
            note.task_id,
            note.action_plan_id,
            note.title,
            note.content,
            is_pinned_int,
            note.sort_order,
            created_at,
            updated_at,
        ],
    )?;
    Ok(())
}

pub fn delete_note(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}

// ========================================================
// Database State & Migration Queries
// ========================================================

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
