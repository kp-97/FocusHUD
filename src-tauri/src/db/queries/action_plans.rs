use super::common::current_timestamp_ms;
use crate::db::models::ActionPlan;
use rusqlite::{Connection, Result, params};

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

pub fn sync_action_plans(conn: &mut Connection, plans: &[ActionPlan]) -> Result<()> {
    let tx = conn.transaction()?;
    if plans.is_empty() {
        tx.execute("DELETE FROM action_plans", [])?;
    } else {
        let placeholders = plans.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "DELETE FROM action_plans WHERE id NOT IN ({})",
            placeholders
        );
        let params: Vec<&dyn rusqlite::ToSql> = plans
            .iter()
            .map(|p| &p.id as &dyn rusqlite::ToSql)
            .collect();
        tx.execute(&sql, rusqlite::params_from_iter(params))?;
    }

    for plan in plans {
        let now = current_timestamp_ms();
        let created_at = if plan.created_at > 0 {
            plan.created_at
        } else {
            now
        };
        tx.execute(
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
                now,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}
