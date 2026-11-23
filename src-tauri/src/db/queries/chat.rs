use crate::db::models::{ChatMessageDb, ChatSession};
use rusqlite::{Connection, Result, params};

pub fn get_chat_sessions(conn: &Connection) -> Result<Vec<ChatSession>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, provider, model, created_at, updated_at
         FROM chat_sessions
         ORDER BY updated_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        Ok(ChatSession {
            id: row.get(0)?,
            title: row.get(1)?,
            provider: row.get(2)?,
            model: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(row?);
    }
    Ok(sessions)
}

pub fn save_chat_session(conn: &Connection, session: &ChatSession) -> Result<()> {
    conn.execute(
        "INSERT INTO chat_sessions (id, title, provider, model, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            provider = excluded.provider,
            model = excluded.model,
            updated_at = excluded.updated_at",
        params![
            session.id,
            session.title,
            session.provider,
            session.model,
            session.created_at,
            session.updated_at,
        ],
    )?;
    Ok(())
}

pub fn delete_chat_session(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![id])?;
    Ok(())
}

pub fn get_chat_messages(conn: &Connection, session_id: &str) -> Result<Vec<ChatMessageDb>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, tool_calls, created_at
         FROM chat_messages
         WHERE session_id = ?1
         ORDER BY created_at ASC",
    )?;

    let rows = stmt.query_map(params![session_id], |row| {
        Ok(ChatMessageDb {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            tool_calls: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    let mut messages = Vec::new();
    for row in rows {
        messages.push(row?);
    }
    Ok(messages)
}

pub fn save_chat_message(conn: &Connection, msg: &ChatMessageDb) -> Result<()> {
    conn.execute(
        "INSERT INTO chat_messages (id, session_id, role, content, tool_calls, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            content = excluded.content,
            tool_calls = excluded.tool_calls",
        params![
            msg.id,
            msg.session_id,
            msg.role,
            msg.content,
            msg.tool_calls,
            msg.created_at,
        ],
    )?;
    Ok(())
}
