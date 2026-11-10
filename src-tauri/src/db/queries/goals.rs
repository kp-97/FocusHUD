use super::common::current_timestamp_ms;
use crate::db::models::Goal;
use rusqlite::{Connection, Result, params};

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

pub fn sync_goals(conn: &mut Connection, goals: &[Goal]) -> Result<()> {
    let tx = conn.transaction()?;
    if goals.is_empty() {
        tx.execute("DELETE FROM goals", [])?;
    } else {
        let placeholders = goals.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("DELETE FROM goals WHERE id NOT IN ({})", placeholders);
        let params: Vec<&dyn rusqlite::ToSql> = goals
            .iter()
            .map(|g| &g.id as &dyn rusqlite::ToSql)
            .collect();
        tx.execute(&sql, rusqlite::params_from_iter(params))?;
    }

    for goal in goals {
        let now = current_timestamp_ms();
        let created_at = if goal.created_at > 0 {
            goal.created_at
        } else {
            now
        };
        tx.execute(
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
                now,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}
