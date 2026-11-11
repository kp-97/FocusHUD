use crate::platform;
use tauri::Manager;

#[tauri::command]
pub fn set_fullscreen_mode(app: tauri::AppHandle, fullscreen: bool) -> Result<(), String> {
    platform::set_fullscreen_mode(&app, fullscreen)
}

#[tauri::command]
pub fn set_window_state(app: tauri::AppHandle, state: String) -> Result<(), String> {
    platform::set_window_state(&app, &state)
}

#[tauri::command]
pub fn get_snap_overlay_state() -> Result<crate::snap::SnapOverlayState, String> {
    Ok(crate::snap::get_snap_overlay_state_snapshot())
}

#[tauri::command]
pub fn select_snap_assist_window(
    hwnd: isize,
    zone_index: usize,
) -> Result<crate::snap::SnapOverlayState, String> {
    crate::snap::select_snap_assist_window_impl(hwnd, zone_index)
}

#[tauri::command]
pub fn skip_snap_assist_zone(zone_index: usize) -> Result<crate::snap::SnapOverlayState, String> {
    crate::snap::skip_snap_assist_zone_impl(zone_index)
}

#[tauri::command]
pub fn dismiss_snap_assist() -> Result<(), String> {
    crate::snap::dismiss_snap_assist_impl()
}

#[tauri::command]
pub fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.set_resizable(true);
        if let Ok(metrics) = platform::get_screen_metrics(&app) {
            let screen_h = metrics.screen_height.max(600);
            let target_h = ((screen_h as f64) * 0.80).round() as u32;
            let _ = w.set_size(tauri::PhysicalSize::new(620, target_h));
        }
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

#[tauri::command]
pub fn get_window_state() -> Result<String, String> {
    let state = match crate::dock::CURRENT_WINDOW_STATE.load(std::sync::atomic::Ordering::Relaxed) {
        crate::dock::WINDOW_STATE_WINDOWED => "windowed",
        crate::dock::WINDOW_STATE_MAXIMISED => "maximised",
        crate::dock::WINDOW_STATE_FULLSCREEN => "fullscreen",
        crate::dock::WINDOW_STATE_MINIMISED => "minimised",
        crate::dock::WINDOW_STATE_SPLIT => "split",
        _ => "windowed",
    };
    Ok(state.to_string())
}

#[tauri::command]
pub fn start_dragging_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_resize_window(window: tauri::WebviewWindow, edge: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                use windows_sys::Win32::UI::Input::KeyboardAndMouse::ReleaseCapture;
                use windows_sys::Win32::UI::WindowsAndMessaging::{PostMessageW, WM_SYSCOMMAND};
                let cmd = match edge.as_str() {
                    "left" => 0xF001,
                    "right" => 0xF002,
                    "top" => 0xF003,
                    "top_left" => 0xF004,
                    "top_right" => 0xF005,
                    "bottom" => 0xF006,
                    "bottom_left" => 0xF007,
                    "bottom_right" => 0xF008,
                    _ => return Err("Invalid edge".to_string()),
                };
                ReleaseCapture();
                PostMessageW(hwnd.0 as _, WM_SYSCOMMAND, cmd, 0);
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, edge);
    }
    Ok(())
}

#[tauri::command]
pub fn resize_window_by_delta(
    window: tauri::WebviewWindow,
    edge: String,
    delta_x: i32,
    delta_y: i32,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                use windows_sys::Win32::UI::WindowsAndMessaging::{
                    GetWindowRect, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER, SetWindowPos,
                };
                let mut r = windows_sys::Win32::Foundation::RECT {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                };
                GetWindowRect(hwnd.0 as _, &mut r);
                let mut new_left = r.left;
                let mut new_top = r.top;
                let mut new_w = r.right - r.left;
                let mut new_h = r.bottom - r.top;

                match edge.as_str() {
                    "left" => {
                        new_left += delta_x;
                        new_w = (new_w - delta_x).max(400);
                    }
                    "right" => {
                        new_w = (new_w + delta_x).max(400);
                    }
                    "top" => {
                        new_top += delta_y;
                        new_h = (new_h - delta_y).max(300);
                    }
                    "bottom" => {
                        new_h = (new_h + delta_y).max(300);
                    }
                    "top_left" => {
                        new_left += delta_x;
                        new_w = (new_w - delta_x).max(400);
                        new_top += delta_y;
                        new_h = (new_h - delta_y).max(300);
                    }
                    "top_right" => {
                        new_w = (new_w + delta_x).max(400);
                        new_top += delta_y;
                        new_h = (new_h - delta_y).max(300);
                    }
                    "bottom_left" => {
                        new_left += delta_x;
                        new_w = (new_w - delta_x).max(400);
                        new_h = (new_h + delta_y).max(300);
                    }
                    "bottom_right" => {
                        new_w = (new_w + delta_x).max(400);
                        new_h = (new_h + delta_y).max(300);
                    }
                    _ => {}
                }

                SetWindowPos(
                    hwnd.0 as _,
                    std::ptr::null_mut(),
                    new_left,
                    new_top,
                    new_w,
                    new_h,
                    SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
                );
            }
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, edge, delta_x, delta_y);
    }
    Ok(())
}

#[tauri::command]
pub fn move_window_by_delta(
    window: tauri::WebviewWindow,
    delta_x: i32,
    delta_y: i32,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                use windows_sys::Win32::UI::WindowsAndMessaging::{
                    GetWindowRect, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOSIZE, SWP_NOZORDER,
                    SetWindowPos,
                };
                let mut rect = windows_sys::Win32::Foundation::RECT {
                    left: 0,
                    top: 0,
                    right: 0,
                    bottom: 0,
                };
                GetWindowRect(hwnd.0 as _, &mut rect);
                SetWindowPos(
                    hwnd.0 as _,
                    std::ptr::null_mut(),
                    rect.left + delta_x,
                    rect.top + delta_y,
                    0,
                    0,
                    SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER,
                );
                return Ok(());
            }
        }
    }
    #[allow(unreachable_code)]
    if let Ok(pos) = window.outer_position() {
        let _ = window.set_position(tauri::PhysicalPosition::new(
            pos.x + delta_x,
            pos.y + delta_y,
        ));
    }
    Ok(())
}
