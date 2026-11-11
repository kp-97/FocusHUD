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

    if active {
        platform::prepare_dock_drag();
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

    if !crate::dock::FULLSCREEN_ACTIVE.load(Ordering::Relaxed) {
        platform::apply_dock_geometry(&app, l_w, r_w);

        if commit {
            platform::update_dock_work_area(&app, l_w, r_w, true);
        } else {
            platform::live_resize_active_window(&app, l_w, r_w);
        }
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
    platform::restore_work_area_sync();
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
pub fn set_panes_reserve_zones(app: tauri::AppHandle, reserve: bool) -> Result<(), String> {
    platform::set_panes_reserve_zones(&app, reserve)
}
