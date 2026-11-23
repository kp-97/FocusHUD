pub mod migrations;
pub mod models;
pub mod queries;

use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbState(pub Mutex<Connection>);

pub fn get_db_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    // Resolves to %LOCALAPPDATA%\FocusHUD on Windows and ~/Library/Application Support/FocusHUD on macOS
    let app_dir = match app_handle.path().local_data_dir() {
        Ok(base) => base.join("FocusHUD"),
        Err(_) => app_handle
            .path()
            .app_local_data_dir()
            .map_err(|e| format!("Failed to resolve app data directory: {e}"))?,
    };

    fs::create_dir_all(&app_dir)?;
    Ok(app_dir.join("focushud.db"))
}

pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, Box<dyn std::error::Error>> {
    let db_path = get_db_path(app_handle)?;
    let mut conn = Connection::open(&db_path)?;

    // Enable WAL mode and foreign keys for high-performance concurrent reads/writes
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        "#,
    )?;

    migrations::run_migrations(&mut conn)?;

    Ok(conn)
}

#[cfg(test)]
pub fn init_memory_db() -> Result<Connection, Box<dyn std::error::Error>> {
    let mut conn = Connection::open_in_memory()?;
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;
        "#,
    )?;
    migrations::run_migrations(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests;
