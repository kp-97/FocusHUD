use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    let version: i32 = conn.query_row("PRAGMA user_version;", [], |row| row.get(0))?;

    if version < 1 {
        apply_migration_v1(conn)?;
    }

    if version < 2 {
        apply_migration_v2(conn)?;
    }

    Ok(())
}

fn apply_migration_v1(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;

    tx.execute_batch(
        r#"
        -- 1. Goals (Infinitely Nested via parent_id)
        CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            parent_id TEXT REFERENCES goals(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'active',
            target_date TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        -- 2. Tasks (Infinitely Nested, Optional goal_id)
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
            goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'todo',
            priority INTEGER NOT NULL DEFAULT 3,
            due_date TEXT,
            estimated_minutes INTEGER,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        -- 3. Action Plans (Infinitely Nested, Optional goal_id / task_id)
        CREATE TABLE IF NOT EXISTS action_plans (
            id TEXT PRIMARY KEY,
            parent_id TEXT REFERENCES action_plans(id) ON DELETE CASCADE,
            goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
            task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'draft',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        -- 4. Notes (Infinitely Nested, Optional goal_id / task_id / action_plan_id)
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            parent_id TEXT REFERENCES notes(id) ON DELETE CASCADE,
            goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
            task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
            action_plan_id TEXT REFERENCES action_plans(id) ON DELETE SET NULL,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            is_pinned INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);
        CREATE INDEX IF NOT EXISTS idx_plans_parent ON action_plans(parent_id);
        CREATE INDEX IF NOT EXISTS idx_plans_goal ON action_plans(goal_id);
        CREATE INDEX IF NOT EXISTS idx_plans_task ON action_plans(task_id);
        CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_id);
        CREATE INDEX IF NOT EXISTS idx_notes_goal ON notes(goal_id);
        CREATE INDEX IF NOT EXISTS idx_notes_task ON notes(task_id);
        CREATE INDEX IF NOT EXISTS idx_notes_action_plan ON notes(action_plan_id);
        CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned DESC, updated_at DESC);

        PRAGMA user_version = 1;
        "#,
    )?;

    tx.commit()?;
    Ok(())
}

fn apply_migration_v2(conn: &mut Connection) -> Result<()> {
    let tx = conn.transaction()?;

    tx.execute_batch(
        r#"
        -- 5. Calendar Events
        CREATE TABLE IF NOT EXISTS calendar_events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL DEFAULT '',
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            is_all_day INTEGER NOT NULL DEFAULT 0,
            color TEXT NOT NULL DEFAULT '#00e5ff',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events(date);

        -- Add calendar_event_id to notes table if not present
        ALTER TABLE notes ADD COLUMN calendar_event_id TEXT REFERENCES calendar_events(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_notes_calendar_event ON notes(calendar_event_id);

        PRAGMA user_version = 2;
        "#,
    )?;

    tx.commit()?;
    Ok(())
}
