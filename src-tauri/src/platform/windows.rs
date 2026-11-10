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

        if let Some(snap_win) = app.get_webview_window("snap-overlay") {
            if let Ok(hwnd) = snap_win.hwnd() {
                let h = hwnd.0 as windows_sys::Win32::Foundation::HWND;
                crate::dock::SNAP_OVERLAY_HWND.store(h as isize, Ordering::Relaxed);
            }
        }

        let mon_w = (rc_monitor.right - rc_monitor.left) as f64;
        let mon_h = (rc_monitor.bottom - rc_monitor.top) as f64;
        let is_ultrawide = mon_h > 0.0 && (mon_w / mon_h) > (16.0 / 9.0 + 0.01);
        let boot_state = if is_ultrawide { "split" } else { "maximised" };
        let _ = set_window_state(app, boot_state);
    }
}

pub fn configure_settings_window(_window: &tauri::WebviewWindow) {}

pub fn update_dock_work_area(
    app: &tauri::AppHandle,
    left_width: i32,
    right_width: i32,
    snap_open_windows: bool,
) {
    if !crate::dock::PANES_RESERVE_ZONES.load(Ordering::Relaxed) {
        let _ = crate::monitor::restore_work_area();
        return;
    }
    if let Some(orig) = crate::monitor::get_original_work_area() {
        let (phys_left, phys_right) = get_physical_dock_widths(app, left_width, right_width);
        unsafe {
            crate::dock::update_dock_work_area(orig, phys_left, phys_right, snap_open_windows);
        }
    }
}

pub fn prepare_dock_drag() {
    if !crate::dock::PANES_RESERVE_ZONES.load(Ordering::Relaxed) {
        return;
    }
    if let Some(work_rect) = crate::monitor::get_current_work_area() {
        unsafe {
            crate::snap::prepare_for_dock_drag(work_rect);
        }
    }
}

pub fn live_resize_active_window(app: &tauri::AppHandle, left_width: i32, right_width: i32) {
    if !crate::dock::PANES_RESERVE_ZONES.load(Ordering::Relaxed) {
        return;
    }
    update_dock_work_area(app, left_width, right_width, false);
}

pub fn set_panes_reserve_zones(app: &tauri::AppHandle, reserve: bool) -> Result<(), String> {
    crate::dock::PANES_RESERVE_ZONES.store(reserve, Ordering::Relaxed);
    if !reserve {
        crate::snap::hide_snap_overlay();
    }
    if crate::dock::FULLSCREEN_ACTIVE.load(Ordering::Relaxed) {
        return Ok(());
    }
    if reserve {
        let l_w = crate::dock::CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
        let r_w = crate::dock::CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);
        update_dock_work_area(app, l_w, r_w, true);
    } else {
        let _ = crate::monitor::restore_work_area();
    }
    Ok(())
}

unsafe fn set_window_resizable_win32(h: windows_sys::Win32::Foundation::HWND, resizable: bool) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GWL_STYLE, GetWindowLongW, SetWindowLongW, WS_MAXIMIZEBOX, WS_THICKFRAME,
    };
    let style = unsafe { GetWindowLongW(h, GWL_STYLE) } as u32;
    let new_style = if resizable {
        style | WS_THICKFRAME
    } else {
        style & !(WS_THICKFRAME | WS_MAXIMIZEBOX)
    };
    if new_style != style {
        unsafe {
            SetWindowLongW(h, GWL_STYLE, new_style as i32);
        }
    }
}

pub fn set_window_state(app: &tauri::AppHandle, state: &str) -> Result<(), String> {
    let prev = crate::dock::CURRENT_WINDOW_STATE.load(Ordering::Relaxed);
    let was_split = prev == crate::dock::WINDOW_STATE_SPLIT;

    match state {
        "windowed" => {
            crate::dock::CURRENT_WINDOW_STATE
                .store(crate::dock::WINDOW_STATE_WINDOWED, Ordering::Relaxed);
            crate::dock::FULLSCREEN_ACTIVE.store(true, Ordering::Relaxed);
            crate::snap::hide_snap_overlay();

            if was_split {
                if let Some(w) = app.get_webview_window("left-dock") {
                    let _ = w.hide();
                }
                if let Some(w) = app.get_webview_window("right-dock") {
                    let _ = w.hide();
                }
                let _ = crate::monitor::restore_work_area();
            }

            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_always_on_top(false);
                let _ = w.set_skip_taskbar(false);
                let _ = w.set_resizable(true);
                unsafe {
                    let (_, rc_work) = crate::monitor::get_primary_monitor_rects();
                    let work_w = rc_work.right - rc_work.left;
                    let work_h = rc_work.bottom - rc_work.top;
                    let win_w = ((work_w as f64) * 0.82).round() as i32;
                    let win_h = ((work_h as f64) * 0.85).round() as i32;
                    let win_x = rc_work.left + (work_w - win_w) / 2;
                    let win_y = rc_work.top + (work_h - win_h) / 2;

                    if let Ok(hwnd) = w.hwnd() {
                        let h = hwnd.0 as windows_sys::Win32::Foundation::HWND;
                        crate::dock::MAIN_HWND.store(h as isize, Ordering::Relaxed);
                        set_window_resizable_win32(h, true);
                        windows_sys::Win32::UI::WindowsAndMessaging::SetWindowPos(
                            h,
                            windows_sys::Win32::UI::WindowsAndMessaging::HWND_NOTOPMOST,
                            win_x,
                            win_y,
                            win_w,
                            win_h,
                            windows_sys::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW
                                | windows_sys::Win32::UI::WindowsAndMessaging::SWP_FRAMECHANGED,
                        );
                    } else {
                        let _ = w.set_position(tauri::PhysicalPosition::new(win_x, win_y));
                        let _ = w.set_size(tauri::PhysicalSize::new(win_w as u32, win_h as u32));
                    }
                }
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
        "maximised" => {
            crate::dock::CURRENT_WINDOW_STATE
                .store(crate::dock::WINDOW_STATE_MAXIMISED, Ordering::Relaxed);
            crate::dock::FULLSCREEN_ACTIVE.store(true, Ordering::Relaxed);
            crate::snap::hide_snap_overlay();

            if was_split {
                if let Some(w) = app.get_webview_window("left-dock") {
                    let _ = w.hide();
                }
                if let Some(w) = app.get_webview_window("right-dock") {
                    let _ = w.hide();
                }
                let _ = crate::monitor::restore_work_area();
            }

            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_always_on_top(false);
                let _ = w.set_skip_taskbar(false);
                let _ = w.set_resizable(false);
                unsafe {
                    let (_, rc_work) = crate::monitor::get_primary_monitor_rects();
                    let work_left = rc_work.left;
                    let work_top = rc_work.top;
                    let work_width = rc_work.right - rc_work.left;
                    let work_height = rc_work.bottom - rc_work.top;

                    if let Ok(hwnd) = w.hwnd() {
                        let h = hwnd.0 as windows_sys::Win32::Foundation::HWND;
                        crate::dock::MAIN_HWND.store(h as isize, Ordering::Relaxed);
                        set_window_resizable_win32(h, false);
                        windows_sys::Win32::UI::WindowsAndMessaging::SetWindowPos(
                            h,
                            windows_sys::Win32::UI::WindowsAndMessaging::HWND_NOTOPMOST,
                            work_left,
                            work_top,
                            work_width,
                            work_height,
                            windows_sys::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW
                                | windows_sys::Win32::UI::WindowsAndMessaging::SWP_FRAMECHANGED,
                        );
                    } else {
                        let _ = w.set_position(tauri::PhysicalPosition::new(work_left, work_top));
                        let _ = w.set_size(tauri::PhysicalSize::new(
                            work_width as u32,
                            work_height as u32,
                        ));
                    }
                }
                let _ = w.show();
                let _ = w.set_focus();
            }
        }
        "fullscreen" => {
            if prev != crate::dock::WINDOW_STATE_FULLSCREEN {
                crate::dock::PRIOR_FULLSCREEN_STATE.store(prev, Ordering::Relaxed);
            }
            crate::dock::CURRENT_WINDOW_STATE
                .store(crate::dock::WINDOW_STATE_FULLSCREEN, Ordering::Relaxed);
            crate::dock::FULLSCREEN_ACTIVE.store(true, Ordering::Relaxed);
            crate::snap::hide_snap_overlay();

            if was_split {
                if let Some(w) = app.get_webview_window("left-dock") {
                    let _ = w.hide();
                }
                if let Some(w) = app.get_webview_window("right-dock") {
                    let _ = w.hide();
                }
                let _ = crate::monitor::restore_work_area();
            }

            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_always_on_top(false);
                let _ = w.set_skip_taskbar(false);
                let _ = w.set_resizable(false);
                unsafe {
                    let (rc_monitor, _) = crate::monitor::get_primary_monitor_rects();
                    let mon_left = rc_monitor.left;
                    let mon_top = rc_monitor.top;
                    let mon_width = rc_monitor.right - rc_monitor.left;
                    let mon_height = rc_monitor.bottom - rc_monitor.top;

                    if let Ok(hwnd) = w.hwnd() {
                        let h = hwnd.0 as windows_sys::Win32::Foundation::HWND;
                        crate::dock::MAIN_HWND.store(h as isize, Ordering::Relaxed);
                        set_window_resizable_win32(h, false);
                        windows_sys::Win32::UI::WindowsAndMessaging::SetWindowPos(
                            h,
                            windows_sys::Win32::UI::WindowsAndMessaging::HWND_NOTOPMOST,
                            mon_left,
                            mon_top,
                            mon_width,
                            mon_height,
                            windows_sys::Win32::UI::WindowsAndMessaging::SWP_SHOWWINDOW
                                | windows_sys::Win32::UI::WindowsAndMessaging::SWP_FRAMECHANGED,
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
        }
        "minimised" => {
            crate::dock::CURRENT_WINDOW_STATE
                .store(crate::dock::WINDOW_STATE_MINIMISED, Ordering::Relaxed);
            crate::snap::hide_snap_overlay();

            if let Some(w) = app.get_webview_window("left-dock") {
                let _ = w.hide();
            }
            if let Some(w) = app.get_webview_window("right-dock") {
                let _ = w.hide();
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
            }
            let _ = crate::monitor::restore_work_area();
        }
        "split" => {
            crate::dock::CURRENT_WINDOW_STATE
                .store(crate::dock::WINDOW_STATE_SPLIT, Ordering::Relaxed);
            crate::dock::FULLSCREEN_ACTIVE.store(false, Ordering::Relaxed);
            crate::dock::MAIN_HWND.store(0, Ordering::Relaxed);
            crate::snap::hide_snap_overlay();

            if let Some(w) = app.get_webview_window("main") {
                let _ = w.hide();
                if let Ok(hwnd) = w.hwnd() {
                    let h = hwnd.0 as windows_sys::Win32::Foundation::HWND;
                    unsafe {
                        use windows_sys::Win32::UI::WindowsAndMessaging::{
                            HWND_BOTTOM, SW_HIDE, SWP_HIDEWINDOW, SWP_NOACTIVATE, SWP_NOMOVE,
                            SWP_NOSIZE, SWP_NOZORDER, SetWindowPos, ShowWindow,
                        };
                        ShowWindow(h, SW_HIDE);
                        SetWindowPos(
                            h,
                            HWND_BOTTOM,
                            -32000,
                            -32000,
                            0,
                            0,
                            SWP_HIDEWINDOW
                                | SWP_NOACTIVATE
                                | SWP_NOMOVE
                                | SWP_NOSIZE
                                | SWP_NOZORDER,
                        );
                    }
                }
            }

            // Invalidate cached clip regions so SetWindowRgn is guaranteed fresh on split
            crate::dock::LAST_LEFT_REGION.store(-1, Ordering::Relaxed);
            crate::dock::LAST_RIGHT_REGION.store(-1, Ordering::Relaxed);

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
        _ => {}
    }
    Ok(())
}

pub fn set_fullscreen_mode(app: &tauri::AppHandle, fullscreen: bool) -> Result<(), String> {
    crate::dock::FULLSCREEN_ACTIVE.store(fullscreen, Ordering::Relaxed);
    if fullscreen {
        crate::snap::hide_snap_overlay();
    }

    if fullscreen {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.set_always_on_top(false);
            let _ = w.set_skip_taskbar(false);
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
                        windows_sys::Win32::UI::WindowsAndMessaging::HWND_NOTOPMOST,
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

pub fn init_window_snapping(app: &tauri::AppHandle) {
    unsafe {
        crate::snap::init_window_snap_hooks(app);
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
