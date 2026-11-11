use super::file_io::{parse_note_file, write_note_to_disk};
use crate::db::models::Note;
use rusqlite::Connection;
use std::fs;
use std::path::Path;

pub fn migrate_sqlite_to_disk(conn: &Connection, root: &Path) -> rusqlite::Result<()> {
    let notes = crate::db::queries::get_all_notes(conn)?;
    for mut note in notes {
        match &note.file_path {
            None => {
                if let Ok((full_path, rel_path)) = write_note_to_disk(root, &note) {
                    note.file_path = Some(full_path.to_string_lossy().to_string());
                    note.relative_path = Some(rel_path);
                    let _ = crate::db::queries::upsert_note(conn, &note);
                }
            }
            Some(p) => {
                let file_exists = Path::new(p).exists()
                    || note
                        .relative_path
                        .as_ref()
                        .map(|rel| root.join(rel.trim_start_matches(['/', '\\'])).exists())
                        .unwrap_or(false);

                if !file_exists {
                    let _ = crate::db::queries::delete_note(conn, &note.id);
                }
            }
        }
    }
    Ok(())
}

pub fn scan_and_index_directory(conn: &Connection, root: &Path) -> rusqlite::Result<Vec<Note>> {
    let mut indexed = Vec::new();
    scan_dir_recursive(root, root, conn, &mut indexed);
    Ok(indexed)
}

fn scan_dir_recursive(current: &Path, root: &Path, conn: &Connection, results: &mut Vec<Note>) {
    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.filter_map(|r| r.ok()) {
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.starts_with('.') {
                scan_dir_recursive(&path, root, conn, results);
            }
        } else if path.is_file() {
            if let Some(ext) = path.extension() {
                if ext.to_string_lossy().eq_ignore_ascii_case("md") {
                    if let Some(note) = parse_note_file(&path, root) {
                        let _ = crate::db::queries::upsert_note(conn, &note);
                        results.push(note);
                    }
                }
            }
        }
    }
}
