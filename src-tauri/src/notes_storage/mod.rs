pub mod file_io;
pub mod paths;
pub mod sync;
pub mod watcher;

pub use file_io::*;
pub use paths::*;
pub use sync::*;
pub use watcher::*;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::Note;
    use std::fs;
    use std::path::PathBuf;

    fn create_test_dir(name: &str) -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("focushud_{}_{}", name, unique));
        let _ = fs::create_dir_all(&dir);
        dir
    }

    #[test]
    fn test_serialize_and_parse_note_roundtrip() {
        let root = create_test_dir("note_roundtrip");

        let note = Note {
            id: "note_abc123".into(),
            parent_id: None,
            goal_id: Some("goal_1".into()),
            task_id: None,
            action_plan_id: None,
            calendar_event_id: None,
            title: "Architecture Decisions".into(),
            content: "Markdown body with details.".into(),
            is_pinned: true,
            sort_order: 0,
            created_at: 1000,
            updated_at: 1000,
            file_path: None,
            relative_path: None,
        };

        let (path, rel_path) = write_note_to_disk(&root, &note).unwrap();
        assert!(path.exists());
        assert_eq!(rel_path, "Architecture Decisions.md");

        let parsed = parse_note_file(&path, &root).unwrap();
        assert_eq!(parsed.id, "note_abc123");
        assert_eq!(parsed.title, "Architecture Decisions");
        assert_eq!(parsed.content, "Markdown body with details.");
        assert!(parsed.is_pinned);
        assert_eq!(parsed.goal_id, Some("goal_1".into()));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_folder_crud_and_note_moving() {
        let root = create_test_dir("folder_crud");

        create_folder(&root, "Work/Projects").unwrap();
        let folders = list_folders(&root);
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].name, "Work");
        assert_eq!(folders[0].children.len(), 1);
        assert_eq!(folders[0].children[0].name, "Projects");

        let note = Note {
            id: "note_move_test".into(),
            parent_id: None,
            goal_id: None,
            task_id: None,
            action_plan_id: None,
            calendar_event_id: None,
            title: "Project Plan".into(),
            content: "Initial plan".into(),
            is_pinned: false,
            sort_order: 0,
            created_at: 100,
            updated_at: 100,
            file_path: None,
            relative_path: None,
        };

        let (path, _) = write_note_to_disk(&root, &note).unwrap();
        assert!(path.exists());

        let (moved_path, moved_rel) = move_note_file(&root, &path, "Work/Projects").unwrap();
        assert!(moved_path.exists());
        assert_eq!(moved_rel, "Work/Projects/Project Plan.md");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_migrate_sqlite_to_disk() {
        let root = create_test_dir("migrate_test");
        let conn = crate::db::init_memory_db().unwrap();

        let note = Note {
            id: "n_legacy_1".into(),
            parent_id: None,
            goal_id: None,
            task_id: None,
            action_plan_id: None,
            calendar_event_id: None,
            title: "Pre-existing Note".into(),
            content: "Hello from database".into(),
            is_pinned: false,
            sort_order: 0,
            created_at: 100,
            updated_at: 100,
            file_path: None,
            relative_path: None,
        };
        crate::db::queries::upsert_note(&conn, &note).unwrap();

        migrate_sqlite_to_disk(&conn, &root).unwrap();

        let md_file = root.join("Pre-existing Note.md");
        assert!(md_file.exists());

        let notes = crate::db::queries::get_all_notes(&conn).unwrap();
        assert_eq!(notes[0].relative_path, Some("Pre-existing Note.md".into()));
        assert!(notes[0].file_path.is_some());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_write_note_cleans_up_old_file_on_rename_and_disambiguates() {
        let root = create_test_dir("rename_test");

        let mut note1 = Note {
            id: "note_1".into(),
            parent_id: None,
            goal_id: None,
            task_id: None,
            action_plan_id: None,
            calendar_event_id: None,
            title: "Original Title".into(),
            content: "Note 1 content".into(),
            is_pinned: false,
            sort_order: 0,
            created_at: 100,
            updated_at: 100,
            file_path: None,
            relative_path: None,
        };

        let (path1, rel1) = write_note_to_disk(&root, &note1).unwrap();
        assert!(path1.exists());
        assert_eq!(rel1, "Original Title.md");
        note1.file_path = Some(path1.to_string_lossy().to_string());
        note1.relative_path = Some(rel1);

        // Rename note1 to "Renamed Title"
        note1.title = "Renamed Title".into();
        let (renamed_path, renamed_rel) = write_note_to_disk(&root, &note1).unwrap();
        assert!(renamed_path.exists());
        assert_eq!(renamed_rel, "Renamed Title.md");
        // Old file must have been deleted!
        assert!(!path1.exists());

        // Now create note2 with the same title "Renamed Title"
        let note2 = Note {
            id: "note_2".into(),
            parent_id: None,
            goal_id: None,
            task_id: None,
            action_plan_id: None,
            calendar_event_id: None,
            title: "Renamed Title".into(),
            content: "Note 2 content".into(),
            is_pinned: false,
            sort_order: 0,
            created_at: 200,
            updated_at: 200,
            file_path: None,
            relative_path: None,
        };

        let (path2, rel2) = write_note_to_disk(&root, &note2).unwrap();
        assert!(path2.exists());
        assert_eq!(rel2, "Renamed Title_1.md");
        // note1's file should still exist!
        assert!(renamed_path.exists());

        let _ = fs::remove_dir_all(&root);
    }
}
