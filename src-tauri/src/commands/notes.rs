use super::db::{emit_db_change, with_conn, with_conn_mut};
use crate::db::models::Note;
use crate::notes_storage::{self, NoteFolder};
use std::path::PathBuf;

#[tauri::command]
pub fn get_notes(state: tauri::State<'_, crate::db::DbState>) -> Result<Vec<Note>, String> {
    with_conn(&state, crate::db::queries::get_all_notes)
}

#[tauri::command]
pub fn save_note(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    mut note: Note,
) -> Result<Note, String> {
    notes_storage::set_internal_write(true);

    let res: Result<(PathBuf, String), String> = with_conn(&state, |conn| {
        let root = notes_storage::get_configured_notes_dir(&app, conn);
        notes_storage::write_note_to_disk(&root, &note)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))
    });

    let (saved_path, rel_path) = match res {
        Ok(paths) => paths,
        Err(e) => {
            notes_storage::set_internal_write(false);
            return Err(format!("Failed to write note file: {e}"));
        }
    };

    note.file_path = Some(saved_path.to_string_lossy().to_string());
    note.relative_path = Some(rel_path);

    let db_res = with_conn(&state, |conn| crate::db::queries::upsert_note(conn, &note));
    notes_storage::set_internal_write(false);
    db_res?;

    emit_db_change(&app, "notes", "save", Some(note.id.clone()));
    Ok(note)
}

#[tauri::command]
pub fn delete_note(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<(), String> {
    notes_storage::set_internal_write(true);

    let (target_file, rel_path, title): (Option<String>, Option<String>, Option<String>) =
        with_conn(&state, |conn| {
            let mut stmt =
                conn.prepare("SELECT file_path, relative_path, title FROM notes WHERE id = ?1")?;
            stmt.query_row(rusqlite::params![id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })
        })
        .unwrap_or((None, None, None));

    let root = with_conn(&state, |conn| {
        Ok(notes_storage::get_configured_notes_dir(&app, conn))
    })
    .ok();

    if let Some(path_str) = target_file {
        let path = PathBuf::from(&path_str);
        if path.exists() {
            let _ = notes_storage::delete_note_from_disk(&path);
        }
    }

    if let (Some(r), Some(rel)) = (&root, &rel_path) {
        let path = r.join(rel.trim_start_matches(['/', '\\']));
        if path.exists() {
            let _ = notes_storage::delete_note_from_disk(&path);
        }
    }

    if let (Some(r), Some(t)) = (&root, &title) {
        let clean = notes_storage::sanitize_filename(t);
        let path = r.join(format!("{}.md", clean));
        if path.exists() {
            let _ = notes_storage::delete_note_from_disk(&path);
        }
    }

    let db_res = with_conn(&state, |conn| crate::db::queries::delete_note(conn, &id));
    notes_storage::set_internal_write(false);
    db_res?;

    emit_db_change(&app, "notes", "delete", Some(id));
    Ok(())
}

#[tauri::command]
pub fn sync_notes(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    notes: Vec<Note>,
) -> Result<(), String> {
    notes_storage::set_internal_write(true);

    let root = with_conn(&state, |conn| {
        Ok(notes_storage::get_configured_notes_dir(&app, conn))
    })?;

    let mut synced_notes = Vec::new();
    for mut note in notes {
        if let Ok((full_path, rel_path)) = notes_storage::write_note_to_disk(&root, &note) {
            note.file_path = Some(full_path.to_string_lossy().to_string());
            note.relative_path = Some(rel_path);
        }
        synced_notes.push(note);
    }

    let db_res = with_conn_mut(&state, |conn| {
        crate::db::queries::sync_notes(conn, &synced_notes)
    });
    notes_storage::set_internal_write(false);
    db_res?;

    emit_db_change(&app, "notes", "save", None);
    Ok(())
}

#[tauri::command]
pub fn get_notes_dir(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
) -> Result<String, String> {
    with_conn(&state, |conn| {
        let dir = notes_storage::get_configured_notes_dir(&app, conn);
        Ok(dir.to_string_lossy().to_string())
    })
}

#[tauri::command]
pub fn set_notes_dir(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    watcher_state: tauri::State<'_, notes_storage::NotesWatcherState>,
    path: String,
    migrate_existing: bool,
) -> Result<(), String> {
    let target = PathBuf::from(&path);
    std::fs::create_dir_all(&target).map_err(|e| format!("Failed to create directory: {e}"))?;

    with_conn(&state, |conn| {
        crate::db::queries::set_setting(conn, "notes_dir", &path)?;
        if migrate_existing {
            notes_storage::migrate_sqlite_to_disk(conn, &target)?;
        }
        notes_storage::scan_and_index_directory(conn, &target)?;
        Ok(())
    })?;

    if let Ok(mut lock) = watcher_state.0.lock() {
        *lock = notes_storage::start_notes_watcher(app.clone(), target).ok();
    }

    emit_db_change(&app, "notes", "save", None);
    Ok(())
}

#[tauri::command]
pub fn pick_notes_dir() -> Result<Option<String>, String> {
    let dialog = rfd::FileDialog::new().set_title("Select Notes Storage Folder");
    let folder = dialog.pick_folder();
    Ok(folder.map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn list_note_folders(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<NoteFolder>, String> {
    with_conn(&state, |conn| {
        let root = notes_storage::get_configured_notes_dir(&app, conn);
        Ok(notes_storage::list_folders(&root))
    })
}

#[tauri::command]
pub fn create_note_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    relative_path: String,
) -> Result<(), String> {
    notes_storage::set_internal_write(true);
    let root = with_conn(&state, |conn| {
        Ok(notes_storage::get_configured_notes_dir(&app, conn))
    })?;
    let res = notes_storage::create_folder(&root, &relative_path)
        .map(|_| ())
        .map_err(|e| e.to_string());
    notes_storage::set_internal_write(false);
    emit_db_change(&app, "notes", "save", None);
    res
}

#[tauri::command]
pub fn rename_note_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    notes_storage::set_internal_write(true);
    let root = with_conn(&state, |conn| {
        Ok(notes_storage::get_configured_notes_dir(&app, conn))
    })?;

    let res = notes_storage::rename_folder(&root, &old_path, &new_path).map_err(|e| e.to_string());

    if res.is_ok() {
        // Update all notes in SQLite whose relative_path started with old_path
        let _ = with_conn(&state, |conn| {
            let notes = crate::db::queries::get_all_notes(conn)?;
            for mut note in notes {
                if let Some(ref rel) = note.relative_path {
                    if rel.starts_with(&old_path) {
                        let updated_rel = format!("{}{}", new_path, &rel[old_path.len()..]);
                        note.relative_path = Some(updated_rel.clone());
                        note.file_path = Some(root.join(updated_rel).to_string_lossy().to_string());
                        let _ = crate::db::queries::upsert_note(conn, &note);
                    }
                }
            }
            Ok(())
        });
    }

    notes_storage::set_internal_write(false);
    emit_db_change(&app, "notes", "save", None);
    res
}

#[tauri::command]
pub fn delete_note_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    relative_path: String,
) -> Result<(), String> {
    notes_storage::set_internal_write(true);
    let root = with_conn(&state, |conn| {
        Ok(notes_storage::get_configured_notes_dir(&app, conn))
    })?;

    let res = notes_storage::delete_folder(&root, &relative_path);

    if res.is_ok() {
        let _ = with_conn(&state, |conn| {
            let notes = crate::db::queries::get_all_notes(conn)?;
            for note in notes {
                if let Some(ref rel) = note.relative_path {
                    if rel.starts_with(&relative_path) {
                        let _ = crate::db::queries::delete_note(conn, &note.id);
                    }
                }
            }
            Ok(())
        });
    }

    notes_storage::set_internal_write(false);
    emit_db_change(&app, "notes", "delete", None);
    res
}

#[tauri::command]
pub fn move_note_to_folder(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    note_id: String,
    target_folder: String,
) -> Result<Note, String> {
    notes_storage::set_internal_write(true);

    let mut note = with_conn(&state, |conn| {
        let notes = crate::db::queries::get_all_notes(conn)?;
        notes
            .into_iter()
            .find(|n| n.id == note_id)
            .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)
    })?;

    let root = with_conn(&state, |conn| {
        Ok(notes_storage::get_configured_notes_dir(&app, conn))
    })?;

    let (new_path, new_rel) = if let Some(ref curr_path_str) = note.file_path {
        let curr = PathBuf::from(curr_path_str);
        if curr.exists() {
            notes_storage::move_note_file(&root, &curr, &target_folder)
                .map_err(|e| format!("Failed to move file: {e}"))?
        } else {
            let filename = curr
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| format!("{}.md", notes_storage::sanitize_filename(&note.title)));
            let clean_folder = target_folder.trim_matches(['/', '\\']);
            let rel = if clean_folder.is_empty() {
                filename
            } else {
                format!("{}/{}", clean_folder, filename)
            };
            note.relative_path = Some(rel);
            notes_storage::write_note_to_disk(&root, &note)
                .map_err(|e| format!("Failed to write note: {e}"))?
        }
    } else {
        let clean_folder = target_folder.trim_matches(['/', '\\']);
        let filename = format!("{}.md", notes_storage::sanitize_filename(&note.title));
        let rel = if clean_folder.is_empty() {
            filename
        } else {
            format!("{}/{}", clean_folder, filename)
        };
        note.relative_path = Some(rel);
        notes_storage::write_note_to_disk(&root, &note)
            .map_err(|e| format!("Failed to write note: {e}"))?
    };

    note.file_path = Some(new_path.to_string_lossy().to_string());
    note.relative_path = Some(new_rel);

    let db_res = with_conn(&state, |conn| crate::db::queries::upsert_note(conn, &note));
    notes_storage::set_internal_write(false);
    db_res?;

    emit_db_change(&app, "notes", "save", Some(note.id.clone()));
    Ok(note)
}

#[tauri::command]
pub fn read_note_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read note file: {e}"))
}
