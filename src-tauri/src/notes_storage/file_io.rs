use super::paths::{sanitize_filename, to_relative_path};
use crate::db::models::Note;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NoteFolder {
    pub name: String,
    pub relative_path: String,
    pub children: Vec<NoteFolder>,
}

pub fn list_folders(root: &Path) -> Vec<NoteFolder> {
    if !root.is_dir() {
        return Vec::new();
    }
    list_folders_recursive(root, root)
}

fn list_folders_recursive(current: &Path, root: &Path) -> Vec<NoteFolder> {
    let mut folders = Vec::new();
    let entries = match fs::read_dir(current) {
        Ok(e) => e,
        Err(_) => return folders,
    };

    let mut sorted_entries: Vec<_> = entries.filter_map(|r| r.ok()).collect();
    sorted_entries.sort_by_key(|e| e.file_name());

    for entry in sorted_entries {
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                continue;
            }
            if let Some(rel) = to_relative_path(root, &path) {
                let children = list_folders_recursive(&path, root);
                folders.push(NoteFolder {
                    name,
                    relative_path: rel,
                    children,
                });
            }
        }
    }
    folders
}

pub fn create_folder(root: &Path, rel_path: &str) -> std::io::Result<PathBuf> {
    let target = root.join(rel_path.trim_start_matches(['/', '\\']));
    fs::create_dir_all(&target)?;
    Ok(target)
}

pub fn rename_folder(root: &Path, old_rel: &str, new_rel: &str) -> std::io::Result<()> {
    let old_path = root.join(old_rel.trim_start_matches(['/', '\\']));
    let new_path = root.join(new_rel.trim_start_matches(['/', '\\']));
    if let Some(parent) = new_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(old_path, new_path)
}

pub fn delete_folder(root: &Path, rel_path: &str) -> Result<(), String> {
    let target = root.join(rel_path.trim_start_matches(['/', '\\']));
    if !target.exists() {
        return Ok(());
    }
    if let Err(e) = trash::delete(&target) {
        fs::remove_dir_all(&target).map_err(|io_err| {
            format!("Failed to delete folder (trash: {e}, fallback: {io_err})")
        })?;
    }
    Ok(())
}

pub fn serialize_note(note: &Note) -> String {
    let title = if note.title.trim().is_empty() {
        "UNTITLED NOTE"
    } else {
        note.title.trim()
    };

    let mut frontmatter = format!(
        "---\nid: {}\ntitle: {}\n",
        note.id,
        title.replace('\n', " ")
    );

    if let Some(ref gid) = note.goal_id {
        frontmatter.push_str(&format!("goalId: {}\n", gid));
    }
    if let Some(ref tid) = note.task_id {
        frontmatter.push_str(&format!("taskId: {}\n", tid));
    }
    if let Some(ref pid) = note.action_plan_id {
        frontmatter.push_str(&format!("actionPlanId: {}\n", pid));
    }
    if let Some(ref cid) = note.calendar_event_id {
        frontmatter.push_str(&format!("calendarEventId: {}\n", cid));
    }
    if note.is_pinned {
        frontmatter.push_str("isPinned: true\n");
    }
    frontmatter.push_str("---\n\n");
    frontmatter.push_str(&note.content);
    frontmatter
}

pub fn parse_note_file(path: &Path, root: &Path) -> Option<Note> {
    let raw = fs::read_to_string(path).ok()?;
    let rel_path = to_relative_path(root, path)?;
    let filename_title = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "UNTITLED NOTE".to_string());

    let (id, title, content, is_pinned, goal_id, task_id, action_plan_id, calendar_event_id) =
        if let Some(stripped) = raw.strip_prefix("---") {
            if let Some(end_idx) = stripped.find("\n---") {
                let fm_text = &stripped[..end_idx];
                let body = stripped[end_idx + 4..].trim_start_matches(['\r', '\n']);

                let mut n_id = None;
                let mut n_title = None;
                let mut n_pin = false;
                let mut n_goal = None;
                let mut n_task = None;
                let mut n_plan = None;
                let mut n_cal = None;

                for line in fm_text.lines() {
                    let parts: Vec<&str> = line.splitn(2, ':').collect();
                    if parts.len() == 2 {
                        let k = parts[0].trim();
                        let v = parts[1].trim();
                        match k {
                            "id" => n_id = Some(v.to_string()),
                            "title" => n_title = Some(v.to_string()),
                            "isPinned" => n_pin = v == "true" || v == "1",
                            "goalId" => n_goal = Some(v.to_string()),
                            "taskId" => n_task = Some(v.to_string()),
                            "actionPlanId" => n_plan = Some(v.to_string()),
                            "calendarEventId" => n_cal = Some(v.to_string()),
                            _ => {}
                        }
                    }
                }

                let final_id = n_id.unwrap_or_else(|| format!("note_{}", filename_title));
                let final_title = n_title.unwrap_or(filename_title);
                (
                    final_id,
                    final_title,
                    body.to_string(),
                    n_pin,
                    n_goal,
                    n_task,
                    n_plan,
                    n_cal,
                )
            } else {
                (
                    format!("note_{}", filename_title),
                    filename_title,
                    raw,
                    false,
                    None,
                    None,
                    None,
                    None,
                )
            }
        } else {
            // No frontmatter: title from first markdown heading '# ' if exists
            let first_line = raw.lines().next().unwrap_or("").trim();
            let heading_title = if first_line.starts_with("# ") {
                first_line.trim_start_matches("# ").trim().to_string()
            } else {
                filename_title
            };

            (
                format!("note_{}", sanitize_filename(&heading_title)),
                heading_title,
                raw,
                false,
                None,
                None,
                None,
                None,
            )
        };

    let metadata = fs::metadata(path).ok();
    let updated_at = metadata
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or_else(crate::db::queries::common::current_timestamp_ms);

    Some(Note {
        id,
        parent_id: None,
        goal_id,
        task_id,
        action_plan_id,
        calendar_event_id,
        title,
        content,
        is_pinned,
        sort_order: 0,
        created_at: updated_at,
        updated_at,
        file_path: Some(path.to_string_lossy().to_string()),
        relative_path: Some(rel_path),
    })
}

fn resolve_target_file_path(
    root: &Path,
    parent_dir: &str,
    clean_title: &str,
    note_id: &str,
) -> (PathBuf, String) {
    let make_paths = |name: &str| -> (PathBuf, String) {
        let rel = if parent_dir.is_empty() {
            format!("{}.md", name)
        } else {
            format!("{}/{}.md", parent_dir, name)
        };
        let full = root.join(&rel);
        (full, rel)
    };

    let (full, rel) = make_paths(clean_title);
    if !full.exists() {
        return (full, rel);
    }

    if let Some(existing) = parse_note_file(&full, root) {
        if existing.id == note_id {
            return (full, rel);
        }
    }

    let mut counter = 1;
    loop {
        let candidate_title = format!("{}_{}", clean_title, counter);
        let (cand_full, cand_rel) = make_paths(&candidate_title);
        if !cand_full.exists() {
            return (cand_full, cand_rel);
        }
        if let Some(existing) = parse_note_file(&cand_full, root) {
            if existing.id == note_id {
                return (cand_full, cand_rel);
            }
        }
        counter += 1;
    }
}

pub fn write_note_to_disk(root: &Path, note: &Note) -> std::io::Result<(PathBuf, String)> {
    let clean_title = sanitize_filename(&note.title);

    let parent_dir = note
        .relative_path
        .as_ref()
        .and_then(|rel| {
            Path::new(rel)
                .parent()
                .filter(|p| !p.as_os_str().is_empty())
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        })
        .unwrap_or_default();

    let (target_path, rel_path) =
        resolve_target_file_path(root, &parent_dir, &clean_title, &note.id);

    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Clean up old file if title changed or note moved
    if let Some(ref old_path_str) = note.file_path {
        let old_path = PathBuf::from(old_path_str);
        if old_path.exists() && old_path != target_path {
            let _ = fs::remove_file(&old_path);
        }
    }
    if let Some(ref old_rel) = note.relative_path {
        let old_from_rel = root.join(old_rel.trim_start_matches(['/', '\\']));
        if old_from_rel.exists() && old_from_rel != target_path {
            let _ = fs::remove_file(&old_from_rel);
        }
    }

    let payload = serialize_note(note);
    fs::write(&target_path, payload)?;

    Ok((target_path, rel_path))
}

pub fn delete_note_from_disk(file_path: &Path) -> Result<(), String> {
    if !file_path.exists() {
        return Ok(());
    }
    if let Err(e) = trash::delete(file_path) {
        fs::remove_file(file_path)
            .map_err(|io_err| format!("Failed to delete file (trash: {e}, fallback: {io_err})"))?;
    }
    Ok(())
}

pub fn move_note_file(
    root: &Path,
    current_path: &Path,
    target_folder_rel: &str,
) -> std::io::Result<(PathBuf, String)> {
    let filename = current_path
        .file_name()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid filename"))?;

    let clean_folder = target_folder_rel.trim_matches(['/', '\\']);
    let target_dir = if clean_folder.is_empty() {
        root.to_path_buf()
    } else {
        root.join(clean_folder)
    };

    fs::create_dir_all(&target_dir)?;
    let new_path = target_dir.join(filename);
    if current_path != new_path {
        fs::rename(current_path, &new_path)?;
    }

    let new_rel =
        to_relative_path(root, &new_path).unwrap_or_else(|| filename.to_string_lossy().to_string());
    Ok((new_path, new_rel))
}
