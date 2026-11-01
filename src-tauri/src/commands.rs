use std::sync::atomic::Ordering;
use tauri::Manager;

use crate::dock::{
    CURRENT_LEFT_WIDTH, CURRENT_RIGHT_WIDTH, LEFT_DRAG_ACTIVE, LEFT_POPOUT_ACTIVE,
    RIGHT_DRAG_ACTIVE, RIGHT_POPOUT_ACTIVE,
};
use crate::platform::{self, ScreenMetrics};

#[tauri::command]
pub fn get_screen_metrics(app: tauri::AppHandle) -> Result<ScreenMetrics, String> {
    platform::get_screen_metrics(&app)
}

#[tauri::command]
pub fn set_dock_drag_mode(app: tauri::AppHandle, side: String, active: bool) -> Result<(), String> {
    if side == "left" {
        LEFT_DRAG_ACTIVE.store(active, Ordering::Relaxed);
    } else if side == "right" {
        RIGHT_DRAG_ACTIVE.store(active, Ordering::Relaxed);
    }

    let l_w = CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
    let r_w = CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);

    platform::apply_dock_geometry(&app, l_w, r_w);
    Ok(())
}

#[tauri::command]
pub fn set_dock_popout_mode(
    app: tauri::AppHandle,
    side: String,
    active: bool,
) -> Result<(), String> {
    if side == "left" {
        LEFT_POPOUT_ACTIVE.store(active, Ordering::Relaxed);
    } else if side == "right" {
        RIGHT_POPOUT_ACTIVE.store(active, Ordering::Relaxed);
    }

    let l_w = CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
    let r_w = CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);

    platform::apply_dock_geometry(&app, l_w, r_w);
    Ok(())
}

#[tauri::command]
pub fn update_dock_sizes(
    app: tauri::AppHandle,
    left_width: Option<i32>,
    right_width: Option<i32>,
    commit: bool,
) -> Result<(), String> {
    let l_w = left_width.unwrap_or_else(|| CURRENT_LEFT_WIDTH.load(Ordering::Relaxed));
    let r_w = right_width.unwrap_or_else(|| CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed));

    CURRENT_LEFT_WIDTH.store(l_w, Ordering::Relaxed);
    CURRENT_RIGHT_WIDTH.store(r_w, Ordering::Relaxed);

    if commit {
        LEFT_DRAG_ACTIVE.store(false, Ordering::Relaxed);
        RIGHT_DRAG_ACTIVE.store(false, Ordering::Relaxed);
    }

    platform::apply_dock_geometry(&app, l_w, r_w);

    if commit {
        platform::update_dock_work_area(&app, l_w, r_w, true);
    } else {
        platform::live_resize_active_window(&app, l_w, r_w);
    }

    Ok(())
}

#[tauri::command]
pub fn restore_work_area() -> Result<(), String> {
    platform::restore_work_area()
}

#[tauri::command]
pub fn minimize_to_tray(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("left-dock") {
        let _ = w.hide();
    }
    if let Some(w) = app.get_webview_window("right-dock") {
        let _ = w.hide();
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    platform::restore_work_area()
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    let _ = platform::restore_work_area();
    platform::signal_watchdog_clean_exit();
    app.exit(0);
}

#[tauri::command]
pub fn check_accessibility_permission() -> bool {
    platform::check_accessibility_permissions()
}

#[tauri::command]
pub fn get_system_diagnostics() -> Result<crate::diagnostics::SystemDiagnostics, String> {
    Ok(crate::diagnostics::get_latest_diagnostics())
}

#[tauri::command]
pub fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        platform::configure_settings_window(&w);
        let _ = w.center();
        let _ = w.show();
        let _ = w.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub fn close_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.hide();
    }
    Ok(())
}

// ========================================================
// SQLite Database Commands & Helpers
// ========================================================

fn with_conn<T, F>(state: &tauri::State<'_, crate::db::DbState>, f: F) -> Result<T, String>
where
    F: FnOnce(&rusqlite::Connection) -> Result<T, rusqlite::Error>,
{
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    f(&conn).map_err(|e| e.to_string())
}

fn with_conn_mut<T, F>(state: &tauri::State<'_, crate::db::DbState>, f: F) -> Result<T, String>
where
    F: FnOnce(&mut rusqlite::Connection) -> Result<T, rusqlite::Error>,
{
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    f(&mut conn).map_err(|e| e.to_string())
}

fn emit_db_change(
    app: &tauri::AppHandle,
    entity: &'static str,
    action: &'static str,
    id: Option<String>,
) {
    use tauri::Emitter;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: entity.into(),
            action: action.into(),
            id,
        },
    );
}

macro_rules! crud_commands {
    // Standard entity where save returns the model
    (
        entity: $entity:literal,
        model: $model:ty,
        get: $get_fn:ident => $get_query:path,
        save: $save_fn:ident ( $save_arg:ident ) => $save_query:path,
        delete: $delete_fn:ident => $delete_query:path,
        sync: $sync_fn:ident ( $sync_arg:ident ) => $sync_query:path $(,)?
    ) => {
        crud_commands! {
            entity: $entity,
            model: $model,
            get: $get_fn => $get_query,
            save: $save_fn($save_arg) -> $model => $save_query => $save_arg,
            delete: $delete_fn => $delete_query,
            sync: $sync_fn($sync_arg) => $sync_query,
        }
    };

    // Generic entity with explicit save return type and expression
    (
        entity: $entity:literal,
        model: $model:ty,
        get: $get_fn:ident => $get_query:path,
        save: $save_fn:ident ( $save_arg:ident ) -> $save_ret:ty => $save_query:path => $save_expr:expr,
        delete: $delete_fn:ident => $delete_query:path,
        sync: $sync_fn:ident ( $sync_arg:ident ) => $sync_query:path $(,)?
    ) => {
        #[tauri::command]
        pub fn $get_fn(
            state: tauri::State<'_, crate::db::DbState>,
        ) -> Result<Vec<$model>, String> {
            with_conn(&state, $get_query)
        }

        #[tauri::command]
        pub fn $save_fn(
            app: tauri::AppHandle,
            state: tauri::State<'_, crate::db::DbState>,
            $save_arg: $model,
        ) -> Result<$save_ret, String> {
            with_conn(&state, |conn| $save_query(conn, &$save_arg))?;
            emit_db_change(&app, $entity, "save", Some($save_arg.id.clone()));
            Ok($save_expr)
        }

        #[tauri::command]
        pub fn $delete_fn(
            app: tauri::AppHandle,
            state: tauri::State<'_, crate::db::DbState>,
            id: String,
        ) -> Result<(), String> {
            with_conn(&state, |conn| $delete_query(conn, &id))?;
            emit_db_change(&app, $entity, "delete", Some(id));
            Ok(())
        }

        #[tauri::command]
        pub fn $sync_fn(
            app: tauri::AppHandle,
            state: tauri::State<'_, crate::db::DbState>,
            $sync_arg: Vec<$model>,
        ) -> Result<(), String> {
            with_conn_mut(&state, |conn| $sync_query(conn, &$sync_arg))?;
            emit_db_change(&app, $entity, "save", None);
            Ok(())
        }
    };
}

#[tauri::command]
pub fn check_db_is_empty(state: tauri::State<'_, crate::db::DbState>) -> Result<bool, String> {
    with_conn(&state, crate::db::queries::is_database_empty)
}

crud_commands! {
    entity: "goals",
    model: crate::db::models::Goal,
    get: get_goals => crate::db::queries::get_all_goals,
    save: save_goal(goal) => crate::db::queries::upsert_goal,
    delete: delete_goal => crate::db::queries::delete_goal,
    sync: sync_goals(goals) => crate::db::queries::sync_goals,
}

crud_commands! {
    entity: "tasks",
    model: crate::db::models::Task,
    get: get_tasks => crate::db::queries::get_all_tasks,
    save: save_task(task) => crate::db::queries::upsert_task,
    delete: delete_task => crate::db::queries::delete_task,
    sync: sync_tasks(tasks) => crate::db::queries::sync_tasks,
}

crud_commands! {
    entity: "action_plans",
    model: crate::db::models::ActionPlan,
    get: get_action_plans => crate::db::queries::get_all_action_plans,
    save: save_action_plan(plan) => crate::db::queries::upsert_action_plan,
    delete: delete_action_plan => crate::db::queries::delete_action_plan,
    sync: sync_action_plans(plans) => crate::db::queries::sync_action_plans,
}

crud_commands! {
    entity: "notes",
    model: crate::db::models::Note,
    get: get_notes => crate::db::queries::get_all_notes,
    save: save_note(note) => crate::db::queries::upsert_note,
    delete: delete_note => crate::db::queries::delete_note,
    sync: sync_notes(notes) => crate::db::queries::sync_notes,
}

crud_commands! {
    entity: "calendar_events",
    model: crate::db::models::CalendarEvent,
    get: get_calendar_events => crate::db::queries::get_all_calendar_events,
    save: save_calendar_event(event) -> () => crate::db::queries::upsert_calendar_event => (),
    delete: delete_calendar_event => crate::db::queries::delete_calendar_event,
    sync: sync_calendar_events(events) => crate::db::queries::sync_calendar_events,
}

#[tauri::command]
pub fn migrate_legacy_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    data: crate::db::models::LegacyStorageData,
) -> Result<(), String> {
    with_conn_mut(&state, |conn| {
        crate::db::queries::migrate_legacy_data(conn, &data)
    })?;
    emit_db_change(&app, "all", "migrate", None);
    Ok(())
}
