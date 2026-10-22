#![allow(clippy::missing_safety_doc, clippy::collapsible_if)]

pub mod commands;
pub mod db;
pub mod diagnostics;
pub mod dock;
pub mod monitor;
pub mod snap;

use std::sync::atomic::Ordering;
use tauri::Manager;

pub fn restore_from_tray(app: &tauri::AppHandle) {
    let l_w = dock::CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
    let r_w = dock::CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);

    #[cfg(target_os = "windows")]
    {
        dock::apply_dock_geometry(app, l_w, r_w);
        if let Some(orig) = monitor::get_original_work_area() {
            let monitor = app.primary_monitor().ok().flatten().or_else(|| {
                app.get_webview_window("left-dock")
                    .and_then(|w| w.current_monitor().ok().flatten())
            });
            let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
            let phys_left =
                (((l_w + dock::HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;
            let phys_right =
                (((r_w + dock::HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;
            unsafe {
                dock::update_dock_work_area(orig, phys_left, phys_right, true);
            }
        }
    }

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
    monitor::init_dpi_awareness();
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
            commands::get_system_diagnostics,
            commands::open_settings_window,
            commands::close_settings_window,
            commands::check_db_is_empty,
            commands::get_goals,
            commands::save_goal,
            commands::delete_goal,
            commands::get_tasks,
            commands::save_task,
            commands::delete_task,
            commands::get_action_plans,
            commands::save_action_plan,
            commands::delete_action_plan,
            commands::get_notes,
            commands::save_note,
            commands::delete_note,
            commands::migrate_legacy_data
        ])
        .setup(|app| {
            let conn = db::init_db(app.handle())?;
            app.manage(db::DbState(std::sync::Mutex::new(conn)));
            #[cfg(target_os = "windows")]
            unsafe {
                let (rc_monitor, rc_work) = monitor::get_primary_monitor_rects();
                let mut orig_work = rc_work;
                orig_work.left = rc_monitor.left;
                orig_work.right = rc_monitor.right;

                monitor::init_original_work_area(orig_work);

                let left_w = dock::CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
                let right_w = dock::CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);

                // Position both windows using physical monitor dimensions
                dock::apply_dock_geometry(app.handle(), left_w, right_w);

                // Apply initial work area & snap existing open windows into middle column
                let monitor = app.primary_monitor().ok().flatten().or_else(|| {
                    app.get_webview_window("left-dock")
                        .and_then(|w| w.current_monitor().ok().flatten())
                });
                let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
                let phys_left =
                    (((left_w + dock::HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;
                let phys_right =
                    (((right_w + dock::HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;
                dock::update_dock_work_area(orig_work, phys_left, phys_right, true);

                // Install lightweight WinEventHooks to snap external user windows
                snap::init_window_snap_hooks();
            }

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
                let _ = monitor::restore_work_area();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
