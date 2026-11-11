use super::common::current_timestamp_ms;
use crate::db::models::Note;
use rusqlite::{Connection, Result, params};

pub fn get_all_notes(conn: &Connection) -> Result<Vec<Note>> {
    let mut stmt = conn.prepare(
        "SELECT id, parent_id, goal_id, task_id, action_plan_id, title, content, is_pinned, sort_order, created_at, updated_at, calendar_event_id, file_path, relative_path
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
            calendar_event_id: row.get(11)?,
            file_path: row.get(12)?,
            relative_path: row.get(13)?,
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
        "INSERT INTO notes (id, parent_id, goal_id, task_id, action_plan_id, title, content, is_pinned, sort_order, created_at, updated_at, calendar_event_id, file_path, relative_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(id) DO UPDATE SET
            parent_id = excluded.parent_id,
            goal_id = excluded.goal_id,
            task_id = excluded.task_id,
            action_plan_id = excluded.action_plan_id,
            title = excluded.title,
            content = excluded.content,
            is_pinned = excluded.is_pinned,
            sort_order = excluded.sort_order,
            updated_at = excluded.updated_at,
            calendar_event_id = excluded.calendar_event_id,
            file_path = excluded.file_path,
            relative_path = excluded.relative_path",
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
            note.calendar_event_id,
            note.file_path,
            note.relative_path,
        ],
    )?;
    Ok(())
}

pub fn delete_note(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn sync_notes(conn: &mut Connection, notes: &[Note]) -> Result<()> {
    let tx = conn.transaction()?;
    if notes.is_empty() {
        tx.execute("DELETE FROM notes", [])?;
    } else {
        let placeholders = notes.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!("DELETE FROM notes WHERE id NOT IN ({})", placeholders);
        let params: Vec<&dyn rusqlite::ToSql> = notes
            .iter()
            .map(|n| &n.id as &dyn rusqlite::ToSql)
            .collect();
        tx.execute(&sql, rusqlite::params_from_iter(params))?;
    }

    for note in notes {
        let now = current_timestamp_ms();
        let created_at = if note.created_at > 0 {
            note.created_at
        } else {
            now
        };
        let updated_at = if note.updated_at > 0 {
            note.updated_at
        } else {
            now
        };
        let is_pinned_int = if note.is_pinned { 1 } else { 0 };
        tx.execute(
            "INSERT INTO notes (id, parent_id, goal_id, task_id, action_plan_id, title, content, is_pinned, sort_order, created_at, updated_at, calendar_event_id, file_path, relative_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
             ON CONFLICT(id) DO UPDATE SET
                parent_id = excluded.parent_id,
                goal_id = excluded.goal_id,
                task_id = excluded.task_id,
                action_plan_id = excluded.action_plan_id,
                title = excluded.title,
                content = excluded.content,
                is_pinned = excluded.is_pinned,
                sort_order = excluded.sort_order,
                updated_at = excluded.updated_at,
                calendar_event_id = excluded.calendar_event_id,
                file_path = excluded.file_path,
                relative_path = excluded.relative_path",
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
                note.calendar_event_id,
                note.file_path,
                note.relative_path,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}
