#![allow(clippy::missing_safety_doc, clippy::collapsible_if)]

pub mod commands;
pub mod db;
pub mod diagnostics;
pub mod dock;
pub mod monitor;
pub mod notes_storage;
pub mod platform;
pub mod snap;
pub mod watchdog;

use std::sync::atomic::Ordering;
use tauri::{Emitter, Manager};

pub fn open_from_tray(app: &tauri::AppHandle, target_state: &str) {
    if target_state == "fullscreen" {
        dock::PRIOR_FULLSCREEN_STATE.store(dock::WINDOW_STATE_MINIMISED, Ordering::Relaxed);
    }
    let _ = platform::set_window_state(app, target_state);
    let _ = app.emit("tray-window-state", target_state);
}

pub fn restore_from_tray(app: &tauri::AppHandle) {
    open_from_tray(app, "windowed");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    platform::init_dpi_awareness();
    diagnostics::start_diagnostics_worker();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
            commands::start_dragging_window,
            commands::move_window_by_delta,
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
            commands::get_calendar_events,
            commands::save_calendar_event,
            commands::delete_calendar_event,
            commands::sync_calendar_events,
            commands::migrate_legacy_data,
            commands::set_fullscreen_mode,
            commands::set_window_state,
            commands::get_window_state,
            commands::start_resize_window,
            commands::resize_window_by_delta,
            commands::set_panes_reserve_zones,
            commands::get_snap_overlay_state,
            commands::select_snap_assist_window,
            commands::skip_snap_assist_zone,
            commands::dismiss_snap_assist,
            commands::get_notes_dir,
            commands::set_notes_dir,
            commands::pick_notes_dir,
            commands::list_note_folders,
            commands::create_note_folder,
            commands::rename_note_folder,
            commands::delete_note_folder,
            commands::move_note_to_folder,
            commands::read_note_file
        ])
        .setup(|app| {
            let conn = db::init_db(app.handle())?;
            let notes_dir = notes_storage::get_configured_notes_dir(app.handle(), &conn);
            let _ = notes_storage::migrate_sqlite_to_disk(&conn, &notes_dir);
            let _ = notes_storage::scan_and_index_directory(&conn, &notes_dir);
            let watcher = notes_storage::start_notes_watcher(app.handle().clone(), notes_dir);
            app.manage(notes_storage::NotesWatcherState(std::sync::Arc::new(
                std::sync::Mutex::new(watcher.ok()),
            )));
            app.manage(db::DbState(std::sync::Mutex::new(conn)));

            platform::configure_dock_windows(app.handle());
            platform::init_window_snapping(app.handle());

            let open_item =
                tauri::menu::MenuItem::with_id(app, "tray_open", "Open", true, None::<&str>)?;
            let open_max_item = tauri::menu::MenuItem::with_id(
                app,
                "tray_open_maximised",
                "Open Maximised",
                true,
                None::<&str>,
            )?;
            let open_fs_item = tauri::menu::MenuItem::with_id(
                app,
                "tray_open_fullscreen",
                "Open in Fullscreen (Immersive)",
                true,
                None::<&str>,
            )?;
            let quit_item =
                tauri::menu::MenuItem::with_id(app, "tray_quit", "Quit", true, None::<&str>)?;
            let tray_menu = tauri::menu::Menu::with_items(
                app,
                &[&open_item, &open_max_item, &open_fs_item, &quit_item],
            )?;

            let tray_builder = tauri::tray::TrayIconBuilder::new()
                .tooltip("FocusHUD")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "tray_open" => open_from_tray(app, "windowed"),
                    "tray_open_maximised" => open_from_tray(app, "maximised"),
                    "tray_open_fullscreen" => open_from_tray(app, "fullscreen"),
                    "tray_quit" => commands::exit_app(app.clone()),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        open_from_tray(app, "windowed");
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
                platform::restore_work_area_sync();
                platform::signal_watchdog_clean_exit();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
