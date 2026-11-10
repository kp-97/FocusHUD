use super::common::current_timestamp_ms;
use crate::db::models::Task;
use rusqlite::{Connection, Result, params};

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

pub fn sync_tasks(conn: &mut Connection, tasks: &[Task]) -> Result<()> {
    let tx = conn.transaction()?;
    if tasks.is_empty() {
        tx.execute("DELETE FROM tasks", [])?;
    } else {
        let placeholders = tasks.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("DELETE FROM tasks WHERE id NOT IN ({})", placeholders);
        let params: Vec<&dyn rusqlite::ToSql> = tasks
            .iter()
            .map(|t| &t.id as &dyn rusqlite::ToSql)
            .collect();
        tx.execute(&sql, rusqlite::params_from_iter(params))?;
    }

    for task in tasks {
        let now = current_timestamp_ms();
        let created_at = if task.created_at > 0 {
            task.created_at
        } else {
            now
        };
        tx.execute(
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
                now,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}
