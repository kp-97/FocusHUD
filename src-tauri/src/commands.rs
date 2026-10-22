use std::sync::atomic::Ordering;
use tauri::Manager;

use crate::dock::{
    CURRENT_LEFT_WIDTH, CURRENT_RIGHT_WIDTH, HANDLE_GUTTER_LOGICAL_PX, LEFT_DRAG_ACTIVE,
    LEFT_POPOUT_ACTIVE, RIGHT_DRAG_ACTIVE, RIGHT_POPOUT_ACTIVE, apply_dock_geometry,
    update_dock_work_area,
};
use crate::monitor::{
    ScreenMetrics, get_original_work_area, get_primary_monitor_rects,
    restore_work_area as restore_monitor_work_area,
};

#[tauri::command]
pub fn get_screen_metrics(_app: tauri::AppHandle) -> Result<ScreenMetrics, String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let (rc_monitor, rc_work) = get_primary_monitor_rects();
        let orig = get_original_work_area().unwrap_or(rc_work);

        Ok(ScreenMetrics {
            screen_width: rc_monitor.right - rc_monitor.left,
            screen_height: rc_monitor.bottom - rc_monitor.top,
            original_left: orig.left,
            original_top: orig.top,
            original_right: orig.right,
            original_bottom: orig.bottom,
        })
    }

    #[cfg(not(target_os = "windows"))]
    Ok(ScreenMetrics {
        screen_width: 3440,
        screen_height: 1440,
        original_left: 0,
        original_top: 0,
        original_right: 3440,
        original_bottom: 1356,
    })
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

    #[cfg(target_os = "windows")]
    apply_dock_geometry(&app, l_w, r_w);

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

    #[cfg(target_os = "windows")]
    apply_dock_geometry(&app, l_w, r_w);

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

    #[cfg(target_os = "windows")]
    {
        if commit {
            LEFT_DRAG_ACTIVE.store(false, Ordering::Relaxed);
            RIGHT_DRAG_ACTIVE.store(false, Ordering::Relaxed);
        }

        apply_dock_geometry(&app, l_w, r_w);

        if commit {
            if let Some(orig) = get_original_work_area() {
                let monitor = app.primary_monitor().ok().flatten().or_else(|| {
                    app.get_webview_window("left-dock")
                        .and_then(|w| w.current_monitor().ok().flatten())
                });
                let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
                let phys_left = (((l_w + HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;
                let phys_right = (((r_w + HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;

                unsafe {
                    update_dock_work_area(orig, phys_left, phys_right, true);
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn restore_work_area() -> Result<(), String> {
    restore_monitor_work_area()
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
    restore_monitor_work_area()
}

#[tauri::command]
pub fn exit_app(app: tauri::AppHandle) {
    let _ = restore_monitor_work_area();
    app.exit(0);
}

#[tauri::command]
pub fn get_system_diagnostics() -> Result<crate::diagnostics::SystemDiagnostics, String> {
    Ok(crate::diagnostics::get_latest_diagnostics())
}

#[tauri::command]
pub fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
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
// SQLite Database Commands
// ========================================================

#[tauri::command]
pub fn check_db_is_empty(state: tauri::State<'_, crate::db::DbState>) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::is_database_empty(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_goals(
    state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<crate::db::models::Goal>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::get_all_goals(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_goal(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    goal: crate::db::models::Goal,
) -> Result<crate::db::models::Goal, String> {
    use tauri::Emitter;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::upsert_goal(&conn, &goal).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "goals".into(),
            action: "save".into(),
            id: Some(goal.id.clone()),
        },
    );
    Ok(goal)
}

#[tauri::command]
pub fn delete_goal(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<(), String> {
    use tauri::Emitter;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::delete_goal(&conn, &id).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "goals".into(),
            action: "delete".into(),
            id: Some(id),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn sync_goals(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    goals: Vec<crate::db::models::Goal>,
) -> Result<(), String> {
    use tauri::Emitter;
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::sync_goals(&mut conn, &goals).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "goals".into(),
            action: "save".into(),
            id: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn get_tasks(
    state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<crate::db::models::Task>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::get_all_tasks(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_task(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    task: crate::db::models::Task,
) -> Result<crate::db::models::Task, String> {
    use tauri::Emitter;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::upsert_task(&conn, &task).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "tasks".into(),
            action: "save".into(),
            id: Some(task.id.clone()),
        },
    );
    Ok(task)
}

#[tauri::command]
pub fn delete_task(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<(), String> {
    use tauri::Emitter;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::delete_task(&conn, &id).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "tasks".into(),
            action: "delete".into(),
            id: Some(id),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn sync_tasks(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    tasks: Vec<crate::db::models::Task>,
) -> Result<(), String> {
    use tauri::Emitter;
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::sync_tasks(&mut conn, &tasks).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "tasks".into(),
            action: "save".into(),
            id: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn get_action_plans(
    state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<crate::db::models::ActionPlan>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::get_all_action_plans(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_action_plan(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    plan: crate::db::models::ActionPlan,
) -> Result<crate::db::models::ActionPlan, String> {
    use tauri::Emitter;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::upsert_action_plan(&conn, &plan).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "action_plans".into(),
            action: "save".into(),
            id: Some(plan.id.clone()),
        },
    );
    Ok(plan)
}

#[tauri::command]
pub fn delete_action_plan(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<(), String> {
    use tauri::Emitter;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::delete_action_plan(&conn, &id).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "action_plans".into(),
            action: "delete".into(),
            id: Some(id),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn sync_action_plans(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    plans: Vec<crate::db::models::ActionPlan>,
) -> Result<(), String> {
    use tauri::Emitter;
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::sync_action_plans(&mut conn, &plans).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "action_plans".into(),
            action: "save".into(),
            id: None,
        },
    );
    Ok(())
}

#[tauri::command]
pub fn get_notes(
    state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<crate::db::models::Note>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::get_all_notes(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_note(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    note: crate::db::models::Note,
) -> Result<crate::db::models::Note, String> {
    use tauri::Emitter;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::upsert_note(&conn, &note).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "notes".into(),
            action: "save".into(),
            id: Some(note.id.clone()),
        },
    );
    Ok(note)
}

#[tauri::command]
pub fn delete_note(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    id: String,
) -> Result<(), String> {
    use tauri::Emitter;
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::delete_note(&conn, &id).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "notes".into(),
            action: "delete".into(),
            id: Some(id),
        },
    );
    Ok(())
}

#[tauri::command]
pub fn migrate_legacy_data(
    app: tauri::AppHandle,
    state: tauri::State<'_, crate::db::DbState>,
    data: crate::db::models::LegacyStorageData,
) -> Result<(), String> {
    use tauri::Emitter;
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    crate::db::queries::migrate_legacy_data(&mut conn, &data).map_err(|e| e.to_string())?;
    let _ = app.emit(
        "db-change",
        crate::db::models::DbChangePayload {
            entity: "all".into(),
            action: "migrate".into(),
            id: None,
        },
    );
    Ok(())
}
