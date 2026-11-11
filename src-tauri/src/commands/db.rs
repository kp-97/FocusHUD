use crate::db::DbState;
use rusqlite::Connection;
use tauri::Emitter;

pub fn with_conn<T, F>(state: &tauri::State<'_, DbState>, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> rusqlite::Result<T>,
{
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    f(&conn).map_err(|e| e.to_string())
}

pub fn with_conn_mut<T, F>(state: &tauri::State<'_, DbState>, f: F) -> Result<T, String>
where
    F: FnOnce(&mut Connection) -> rusqlite::Result<T>,
{
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    f(&mut conn).map_err(|e| e.to_string())
}

pub fn emit_db_change(app: &tauri::AppHandle, entity: &str, action: &str, id: Option<String>) {
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: entity.to_string(),
            action: action.to_string(),
            id,
        },
    );
}

macro_rules! crud_commands {
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
    (
        entity: $entity:literal,
        model: $model:ty,
        get: $get_fn:ident => $get_query:path,
        save: $save_fn:ident ( $save_arg:ident ) -> $save_ret:ty => $save_query:path => $save_expr:expr,
        delete: $delete_fn:ident => $delete_query:path,
        sync: $sync_fn:ident ( $sync_arg:ident ) => $sync_query:path $(,)?
    ) => {
        #[tauri::command]
        pub fn $get_fn(state: tauri::State<'_, crate::db::DbState>) -> Result<Vec<$model>, String> {
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
