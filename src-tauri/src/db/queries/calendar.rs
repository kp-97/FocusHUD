use super::common::current_timestamp_ms;
use crate::db::models::CalendarEvent;
use rusqlite::{Connection, Result, params};

pub fn get_all_calendar_events(conn: &Connection) -> Result<Vec<CalendarEvent>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, location, date, start_time, end_time, is_all_day, color, created_at, updated_at, recurrence
         FROM calendar_events
         ORDER BY date ASC, start_time ASC",
    )?;

    let rows = stmt.query_map([], |row| {
        let is_all_day_int: i32 = row.get(7)?;
        Ok(CalendarEvent {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            location: row.get(3)?,
            date: row.get(4)?,
            start_time: row.get(5)?,
            end_time: row.get(6)?,
            is_all_day: is_all_day_int != 0,
            color: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            recurrence: row.get(11)?,
        })
    })?;

    let mut events = Vec::new();
    for r in rows {
        events.push(r?);
    }
    Ok(events)
}

pub fn upsert_calendar_event(conn: &Connection, event: &CalendarEvent) -> Result<()> {
    let now = current_timestamp_ms();
    let created_at = if event.created_at > 0 {
        event.created_at
    } else {
        now
    };
    let updated_at = now;
    let is_all_day_int = if event.is_all_day { 1 } else { 0 };
    let recurrence_str = event.recurrence.as_deref().unwrap_or("none");

    conn.execute(
        "INSERT INTO calendar_events (id, title, description, location, date, start_time, end_time, is_all_day, color, created_at, updated_at, recurrence)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            location = excluded.location,
            date = excluded.date,
            start_time = excluded.start_time,
            end_time = excluded.end_time,
            is_all_day = excluded.is_all_day,
            color = excluded.color,
            updated_at = excluded.updated_at,
            recurrence = excluded.recurrence",
        params![
            event.id,
            event.title,
            event.description,
            event.location,
            event.date,
            event.start_time,
            event.end_time,
            is_all_day_int,
            event.color,
            created_at,
            updated_at,
            recurrence_str,
        ],
    )?;
    Ok(())
}

pub fn delete_calendar_event(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM calendar_events WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn sync_calendar_events(conn: &mut Connection, events: &[CalendarEvent]) -> Result<()> {
    let tx = conn.transaction()?;
    if events.is_empty() {
        tx.execute("DELETE FROM calendar_events", [])?;
    } else {
        let placeholders = events.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "DELETE FROM calendar_events WHERE id NOT IN ({})",
            placeholders
        );
        let params: Vec<&dyn rusqlite::ToSql> = events
            .iter()
            .map(|e| &e.id as &dyn rusqlite::ToSql)
            .collect();
        tx.execute(&sql, rusqlite::params_from_iter(params))?;
    }

    for event in events {
        let now = current_timestamp_ms();
        let created_at = if event.created_at > 0 {
            event.created_at
        } else {
            now
        };
        let updated_at = if event.updated_at > 0 {
            event.updated_at
        } else {
            now
        };
        let is_all_day_int = if event.is_all_day { 1 } else { 0 };
        let recurrence_str = event.recurrence.as_deref().unwrap_or("none");
        tx.execute(
            "INSERT INTO calendar_events (id, title, description, location, date, start_time, end_time, is_all_day, color, created_at, updated_at, recurrence)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                location = excluded.location,
                date = excluded.date,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                is_all_day = excluded.is_all_day,
                color = excluded.color,
                updated_at = excluded.updated_at,
                recurrence = excluded.recurrence",
            params![
                event.id,
                event.title,
                event.description,
                event.location,
                event.date,
                event.start_time,
                event.end_time,
                is_all_day_int,
                event.color,
                created_at,
                updated_at,
                recurrence_str,
            ],
        )?;
    }

    tx.commit()?;
    Ok(())
}
