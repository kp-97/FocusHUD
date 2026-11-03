use super::ScreenMetrics;
use std::sync::atomic::Ordering;
use tauri::Manager;

pub use crate::dock::apply_dock_geometry;
pub use crate::monitor::{init_dpi_awareness, restore_work_area, restore_work_area_sync};

fn get_physical_dock_widths(
    app: &tauri::AppHandle,
    left_width: i32,
    right_width: i32,
) -> (i32, i32) {
    let monitor = app.primary_monitor().ok().flatten().or_else(|| {
        app.get_webview_window("left-dock")
            .and_then(|w| w.current_monitor().ok().flatten())
    });
    let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
    let phys_left =
        (((left_width + crate::dock::HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;
    let phys_right =
        (((right_width + crate::dock::HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;
    (phys_left, phys_right)
}

pub fn get_screen_metrics(_app: &tauri::AppHandle) -> Result<ScreenMetrics, String> {
    unsafe {
        let (rc_monitor, rc_work) = crate::monitor::get_primary_monitor_rects();
        let orig = crate::monitor::get_original_work_area().unwrap_or(rc_work);

        Ok(ScreenMetrics {
            screen_width: rc_monitor.right - rc_monitor.left,
            screen_height: rc_monitor.bottom - rc_monitor.top,
            original_left: orig.left,
            original_top: orig.top,
            original_right: orig.right,
            original_bottom: orig.bottom,
        })
    }
}

pub fn configure_dock_windows(app: &tauri::AppHandle) {
    unsafe {
        let (rc_monitor, rc_work) = crate::monitor::get_primary_monitor_rects();
        let mut orig_work = rc_work;
        orig_work.left = rc_monitor.left;
        orig_work.right = rc_monitor.right;

        crate::monitor::init_original_work_area(orig_work);
        crate::monitor::spawn_watchdog(orig_work);

        let left_w = crate::dock::CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
        let right_w = crate::dock::CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);

        crate::dock::apply_dock_geometry(app, left_w, right_w);

        let (phys_left, phys_right) = get_physical_dock_widths(app, left_w, right_w);
        crate::dock::update_dock_work_area(orig_work, phys_left, phys_right, true);
    }
}

pub fn configure_settings_window(_window: &tauri::WebviewWindow) {}

pub fn update_dock_work_area(
    app: &tauri::AppHandle,
    left_width: i32,
    right_width: i32,
    snap_open_windows: bool,
) {
    if let Some(orig) = crate::monitor::get_original_work_area() {
        let (phys_left, phys_right) = get_physical_dock_widths(app, left_width, right_width);
        unsafe {
            crate::dock::update_dock_work_area(orig, phys_left, phys_right, snap_open_windows);
        }
    }
}

pub fn live_resize_active_window(app: &tauri::AppHandle, left_width: i32, right_width: i32) {
    if let Some(orig) = crate::monitor::get_original_work_area() {
        let (phys_left, phys_right) = get_physical_dock_widths(app, left_width, right_width);
        let (new_left, new_right) =
            crate::dock::calculate_work_area_margins(orig.left, orig.right, phys_left, phys_right);
        let prospective_rect = windows_sys::Win32::Foundation::RECT {
            left: new_left,
            top: orig.top,
            right: new_right,
            bottom: orig.bottom,
        };

        unsafe {
            if let Some(hwnd) = crate::snap::get_target_app_window() {
                crate::snap::fit_window_to_visible_rect(hwnd, prospective_rect);
            }
        }
    }
}

pub fn set_fullscreen_mode(app: &tauri::AppHandle, fullscreen: bool) -> Result<(), String> {
    crate::dock::FULLSCREEN_ACTIVE.store(fullscreen, Ordering::Relaxed);

    if fullscreen {
        if let Some(w) = app.get_webview_window("main") {
            unsafe {
                let (rc_monitor, _) = crate::monitor::get_primary_monitor_rects();
                let mon_left = rc_monitor.left;
                let mon_top = rc_monitor.top;
                let mon_width = rc_monitor.right - rc_monitor.left;
                let mon_height = rc_monitor.bottom - rc_monitor.top;

                if let Ok(hwnd) = w.hwnd() {
                    let h = hwnd.0 as windows_sys::Win32::Foundation::HWND;
                    crate::dock::MAIN_HWND.store(h as isize, Ordering::Relaxed);
                    windows_sys::Win32::UI::WindowsAndMessaging::SetWindowPos(
                        h,
                        windows_sys::Win32::UI::WindowsAndMessaging::HWND_TOPMOST,
                        mon_left,
                        mon_top,
                        mon_width,
                        mon_height,
                        windows_sys::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW,
                    );
                } else {
                    let _ = w.set_position(tauri::PhysicalPosition::new(mon_left, mon_top));
                    let _ = w.set_size(tauri::PhysicalSize::new(
                        mon_width as u32,
                        mon_height as u32,
                    ));
                }
            }
            let _ = w.show();
            let _ = w.set_focus();
        }

        if let Some(w) = app.get_webview_window("left-dock") {
            let _ = w.hide();
        }
        if let Some(w) = app.get_webview_window("right-dock") {
            let _ = w.hide();
        }

        let _ = crate::monitor::restore_work_area();
    } else {
        crate::dock::MAIN_HWND.store(0, Ordering::Relaxed);
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
        }
        if let Some(w) = app.get_webview_window("left-dock") {
            let _ = w.show();
        }
        if let Some(w) = app.get_webview_window("right-dock") {
            let _ = w.show();
        }

        let l_w = crate::dock::CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
        let r_w = crate::dock::CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);
        crate::dock::apply_dock_geometry(app, l_w, r_w);
        update_dock_work_area(app, l_w, r_w, true);
    }
    Ok(())
}

pub fn init_window_snapping(_app: &tauri::AppHandle) {
    unsafe {
        crate::snap::init_window_snap_hooks();
    }
}

pub fn check_accessibility_permissions() -> bool {
    true
}

pub fn signal_watchdog_clean_exit() {
    crate::monitor::signal_watchdog_clean_exit();
}

pub fn spawn_watchdog(orig: windows_sys::Win32::Foundation::RECT) {
    crate::monitor::spawn_watchdog(orig);
}

pub fn run_watchdog(pid: u32, left: i32, top: i32, right: i32, bottom: i32) {
    crate::monitor::run_watchdog(pid, left, top, right, bottom);
}

pub fn init_console_ctrl_handler() {
    crate::monitor::init_console_ctrl_handler();
}

pub fn parse_watchdog_args(args: &[String]) -> Option<(u32, i32, i32, i32, i32)> {
    crate::monitor::parse_watchdog_args(args)
}
