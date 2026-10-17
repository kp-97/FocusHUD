#![allow(clippy::missing_safety_doc, clippy::collapsible_if)]

pub mod commands;
pub mod diagnostics;
pub mod dock;
pub mod monitor;
pub mod snap;

use std::sync::atomic::Ordering;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    monitor::init_dpi_awareness();
    diagnostics::start_diagnostics_worker();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_screen_metrics,
            commands::set_dock_drag_mode,
            commands::update_dock_sizes,
            commands::restore_work_area,
            commands::exit_app,
            commands::get_system_diagnostics
        ])
        .setup(|app| {
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
