#![allow(clippy::missing_safety_doc, clippy::collapsible_if)]

pub mod commands;
pub mod db;
pub mod diagnostics;
pub mod dock;
pub mod monitor;
pub mod platform;
pub mod snap;

use std::sync::atomic::Ordering;
use tauri::Manager;

pub fn restore_from_tray(app: &tauri::AppHandle) {
    let l_w = dock::CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
    let r_w = dock::CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);

    platform::apply_dock_geometry(app, l_w, r_w);
    platform::update_dock_work_area(app, l_w, r_w, true);

    if let Some(w) = app.get_webview_window("left-dock") {
        let _ = w.show();
        let _ = w.set_focus();
    }
    if let Some(w) = app.get_webview_window("right-dock") {
        let _ = w.show();
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    platform::init_dpi_awareness();
    diagnostics::start_diagnostics_worker();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_screen_metrics,
            commands::set_dock_drag_mode,
            commands::set_dock_popout_mode,
            commands::update_dock_sizes,
            commands::restore_work_area,
            commands::minimize_to_tray,
            commands::exit_app,
            commands::check_accessibility_permission,
            commands::get_system_diagnostics,
            commands::open_settings_window,
            commands::close_settings_window,
            commands::check_db_is_empty,
            commands::get_goals,
            commands::save_goal,
            commands::delete_goal,
            commands::sync_goals,
            commands::get_tasks,
            commands::save_task,
            commands::delete_task,
            commands::sync_tasks,
            commands::get_action_plans,
            commands::save_action_plan,
            commands::delete_action_plan,
            commands::sync_action_plans,
            commands::get_notes,
            commands::save_note,
            commands::delete_note,
            commands::sync_notes,
            commands::migrate_legacy_data
        ])
        .setup(|app| {
            let conn = db::init_db(app.handle())?;
            app.manage(db::DbState(std::sync::Mutex::new(conn)));

            platform::configure_dock_windows(app.handle());
            platform::init_window_snapping(app.handle());

            let tray_builder = tauri::tray::TrayIconBuilder::new()
                .tooltip("FocusHUD")
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        restore_from_tray(app);
                    }
                });

            let tray_builder = if let Some(icon) = app.default_window_icon() {
                tray_builder.icon(icon.clone())
            } else {
                tray_builder
            };

            let _ = tray_builder.build(app)?;

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let _ = platform::restore_work_area();
                platform::signal_watchdog_clean_exit();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
