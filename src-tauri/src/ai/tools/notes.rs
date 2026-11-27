use super::ID_COUNTER;
use crate::db::models::Note;
use crate::db::queries::common::current_timestamp_ms;
use crate::db::queries::{get_all_notes, get_setting, upsert_note};
use crate::notes_storage::{self, write_note_to_disk};
use rusqlite::Connection;
use serde_json::json;
use std::path::PathBuf;
use std::sync::atomic::Ordering;

fn resolve_notes_dir(conn: &Connection) -> Option<PathBuf> {
    if let Ok(Some(saved)) = get_setting(conn, "notes_dir") {
        let p = PathBuf::from(saved);
        if p.is_dir() || std::fs::create_dir_all(&p).is_ok() {
            return Some(p);
        }
    }
    #[cfg(windows)]
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        let p = PathBuf::from(local).join("FocusHUD").join("notes");
        if p.is_dir() || std::fs::create_dir_all(&p).is_ok() {
            return Some(p);
        }
    }
    #[cfg(not(windows))]
    if let Some(home) = std::env::var_os("HOME") {
        let p = PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("FocusHUD")
            .join("notes");
        if p.is_dir() || std::fs::create_dir_all(&p).is_ok() {
            return Some(p);
        }
    }
    None
}

pub fn search_notes(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let query = args["query"].as_str().map(|q| q.to_lowercase());
    let limit = args["limit"].as_i64().unwrap_or(10).max(1) as usize;

    let all_notes = get_all_notes(conn).map_err(|e| format!("Failed to fetch notes: {e}"))?;
    let filtered: Vec<serde_json::Value> = all_notes
        .into_iter()
        .filter(|n| match &query {
            Some(q) if !q.is_empty() => {
                n.title.to_lowercase().contains(q) || n.content.to_lowercase().contains(q)
            }
            _ => true,
        })
        .take(limit)
        .map(|n| {
            let snippet = if n.content.chars().count() > 160 {
                let truncated: String = n.content.chars().take(160).collect();
                format!("{}...", truncated.replace('\n', " "))
            } else {
                n.content.replace('\n', " ")
            };
            json!({
                "id": n.id,
                "title": n.title,
                "snippet": snippet,
                "isPinned": n.is_pinned,
                "relativePath": n.relative_path,
                "updatedAt": n.updated_at
            })
        })
        .collect();

    let message = if filtered.is_empty() {
        match &query {
            Some(q) if !q.is_empty() => format!("No notes found matching '{q}'."),
            _ => "No notes found in workspace.".to_string(),
        }
    } else {
        format!("Found {} matching note(s).", filtered.len())
    };

    Ok(json!({
        "status": "success",
        "notes": filtered,
        "count": filtered.len(),
        "message": message
    })
    .to_string())
}

pub fn read_note(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let id_opt = args["id"].as_str();
    let title_opt = args["title"].as_str();

    if id_opt.is_none() && title_opt.is_none() {
        return Err("Missing required argument: 'id' or 'title' must be provided.".to_string());
    }

    let all_notes = get_all_notes(conn).map_err(|e| format!("Failed to fetch notes: {e}"))?;
    let note = all_notes
        .into_iter()
        .find(|n| {
            if let Some(id) = id_opt {
                if n.id == id {
                    return true;
                }
            }
            if let Some(t) = title_opt {
                if n.title.eq_ignore_ascii_case(t) {
                    return true;
                }
            }
            false
        })
        .ok_or_else(|| {
            format!(
                "Note not found with {}",
                id_opt
                    .map(|id| format!("id '{id}'"))
                    .or_else(|| title_opt.map(|t| format!("title '{t}'")))
                    .unwrap_or_default()
            )
        })?;

    let content = if let Some(ref fp) = note.file_path {
        let p = std::path::Path::new(fp);
        if p.is_file() {
            std::fs::read_to_string(p).unwrap_or_else(|_| note.content.clone())
        } else {
            note.content.clone()
        }
    } else {
        note.content.clone()
    };

    Ok(json!({
        "status": "success",
        "note": {
            "id": note.id,
            "title": note.title,
            "content": content,
            "filePath": note.file_path,
            "relativePath": note.relative_path,
            "isPinned": note.is_pinned,
            "updatedAt": note.updated_at
        }
    })
    .to_string())
}

pub fn create_note(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let title = args["title"]
        .as_str()
        .ok_or("Missing required field 'title'")?
        .trim()
        .to_string();
    if title.is_empty() {
        return Err("Note 'title' cannot be empty.".to_string());
    }

    let content = args["content"].as_str().unwrap_or_default().to_string();
    let folder = args["folder"].as_str().map(|f| f.trim().to_string());

    let now = current_timestamp_ms();
    let c = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    let id = format!("note_{now}_{c}");

    let mut note = Note {
        id: id.clone(),
        parent_id: None,
        goal_id: None,
        task_id: None,
        action_plan_id: None,
        calendar_event_id: None,
        title: title.clone(),
        content,
        is_pinned: false,
        sort_order: 0,
        created_at: now,
        updated_at: now,
        file_path: None,
        relative_path: folder.map(|f| format!("{f}/{title}.md")),
    };

    if let Some(dir) = resolve_notes_dir(conn) {
        notes_storage::set_internal_write(true);
        if let Ok((saved_path, rel_path)) = write_note_to_disk(&dir, &note) {
            note.file_path = Some(saved_path.to_string_lossy().to_string());
            note.relative_path = Some(rel_path);
        }
        notes_storage::set_internal_write(false);
    }

    upsert_note(conn, &note).map_err(|e| format!("Failed to save note to database: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Note '{title}' created successfully"),
        "noteId": id,
        "filePath": note.file_path,
        "relativePath": note.relative_path
    })
    .to_string())
}

pub fn update_note(conn: &Connection, args: &serde_json::Value) -> Result<String, String> {
    let id = args["id"].as_str().ok_or("Missing required field 'id'")?;
    let all = get_all_notes(conn).map_err(|e| format!("Failed to fetch notes: {e}"))?;
    let mut note = all
        .into_iter()
        .find(|n| n.id == id)
        .ok_or_else(|| format!("Note with id '{id}' not found"))?;

    if let Some(t) = args["title"].as_str() {
        if !t.trim().is_empty() {
            note.title = t.trim().to_string();
        }
    }

    if let Some(new_content) = args["content"].as_str() {
        let append = args["append"].as_bool().unwrap_or(false);
        if append && !note.content.is_empty() {
            note.content = format!("{}\n\n{}", note.content, new_content);
        } else {
            note.content = new_content.to_string();
        }
    }

    note.updated_at = current_timestamp_ms();

    if let Some(dir) = resolve_notes_dir(conn) {
        notes_storage::set_internal_write(true);
        if let Ok((saved_path, rel_path)) = write_note_to_disk(&dir, &note) {
            note.file_path = Some(saved_path.to_string_lossy().to_string());
            note.relative_path = Some(rel_path);
        }
        notes_storage::set_internal_write(false);
    }

    upsert_note(conn, &note).map_err(|e| format!("Failed to update note in database: {e}"))?;

    Ok(json!({
        "status": "success",
        "message": format!("Note '{}' updated successfully", note.title),
        "noteId": id
    })
    .to_string())
}
