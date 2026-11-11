use super::file_io::parse_note_file;
use super::paths::to_relative_path;
use crate::db::DbState;
use notify::{Event, EventKind, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

static INTERNAL_WRITE_ACTIVE: AtomicBool = AtomicBool::new(false);

pub fn set_internal_write(active: bool) {
    INTERNAL_WRITE_ACTIVE.store(active, Ordering::SeqCst);
}

pub struct NotesWatcher {
    _watcher: notify::RecommendedWatcher,
    pub root: PathBuf,
}

pub struct NotesWatcherState(pub Arc<Mutex<Option<NotesWatcher>>>);

pub fn start_notes_watcher(
    app_handle: tauri::AppHandle,
    root: PathBuf,
) -> Result<NotesWatcher, notify::Error> {
    let app = app_handle.clone();
    let root_for_events = root.clone();

    let mut watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if INTERNAL_WRITE_ACTIVE.load(Ordering::SeqCst) {
            return;
        }

        let event = match res {
            Ok(e) => e,
            Err(_) => return,
        };

        handle_watcher_event(&app, &root_for_events, event);
    })?;

    if root.exists() {
        let _ = watcher.watch(&root, RecursiveMode::Recursive);
    }

    Ok(NotesWatcher {
        _watcher: watcher,
        root,
    })
}

fn handle_watcher_event(app: &tauri::AppHandle, root: &Path, event: Event) {
    for path in event.paths {
        if path
            .extension()
            .and_then(|s| s.to_str())
            .map(|ext| ext.eq_ignore_ascii_case("md"))
            != Some(true)
        {
            continue;
        }

        let is_removal = matches!(event.kind, EventKind::Remove(_)) || !path.exists();

        if is_removal {
            let rel = to_relative_path(root, &path);
            let rel_alt = rel.as_ref().map(|r| r.replace('/', "\\"));
            let path_str = path.to_string_lossy().to_string();
            let path_alt = path_str.replace('\\', "/");

            if let Some(state) = app.try_state::<DbState>() {
                if let Ok(conn) = state.0.lock() {
                    let mut deleted_id = None;
                    if let Ok(mut stmt) = conn.prepare(
                        "SELECT id FROM notes WHERE relative_path = ?1 OR relative_path = ?2 OR file_path = ?3 OR file_path = ?4",
                    ) {
                        if let Ok(found_id) = stmt.query_row(
                            rusqlite::params![rel, rel_alt, path_str, path_alt],
                            |r| r.get::<_, String>(0),
                        ) {
                            deleted_id = Some(found_id);
                        }
                    }

                    let _ = conn.execute(
                        "DELETE FROM notes WHERE relative_path = ?1 OR relative_path = ?2 OR file_path = ?3 OR file_path = ?4",
                        rusqlite::params![rel, rel_alt, path_str, path_alt],
                    );

                    let _ = app.emit(
                        "db-change",
                        crate::db::models::DbChangePayload {
                            entity: "notes".to_string(),
                            action: "delete".to_string(),
                            id: deleted_id,
                        },
                    );
                }
            }
        } else if let Some(note) = parse_note_file(&path, root) {
            if let Some(state) = app.try_state::<DbState>() {
                if let Ok(conn) = state.0.lock() {
                    let _ = crate::db::queries::upsert_note(&conn, &note);
                    let _ = app.emit(
                        "db-change",
                        crate::db::models::DbChangePayload {
                            entity: "notes".to_string(),
                            action: "save".to_string(),
                            id: Some(note.id),
                        },
                    );
                }
            }
        }
    }
}
