use rusqlite::Connection;
use std::path::{Path, PathBuf};
use tauri::Manager;

pub fn sanitize_filename(name: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect();
    let trimmed = clean.trim().trim_matches('.');
    if trimmed.is_empty() {
        "untitled".to_string()
    } else {
        trimmed.chars().take(60).collect()
    }
}

pub fn get_default_notes_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    let base = match app_handle.path().local_data_dir() {
        Ok(dir) => dir.join("FocusHUD"),
        Err(_) => app_handle
            .path()
            .app_local_data_dir()
            .unwrap_or_else(|_| PathBuf::from(".")),
    };
    base.join("notes")
}

pub fn get_configured_notes_dir(app_handle: &tauri::AppHandle, conn: &Connection) -> PathBuf {
    if let Ok(Some(saved)) = crate::db::queries::get_setting(conn, "notes_dir") {
        let path = PathBuf::from(saved);
        if path.is_dir() || std::fs::create_dir_all(&path).is_ok() {
            return path;
        }
    }

    let default_dir = get_default_notes_dir(app_handle);
    let _ = std::fs::create_dir_all(&default_dir);
    default_dir
}

pub fn to_relative_path(root: &Path, full_path: &Path) -> Option<String> {
    full_path
        .strip_prefix(root)
        .ok()
        .map(|p| p.to_string_lossy().replace('\\', "/"))
}
