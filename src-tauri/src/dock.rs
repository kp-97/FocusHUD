use std::sync::atomic::{AtomicBool, AtomicI32, AtomicI64, AtomicIsize, Ordering};
use tauri::Manager;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{HWND, LPARAM, RECT};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Graphics::Gdi::{CreateRectRgn, SetWindowRgn};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowRect, SetWindowPos, HWND_TOPMOST, SWP_NOACTIVATE,
};

#[cfg(target_os = "windows")]
use crate::monitor::{
    apply_system_work_area, get_primary_monitor_rects, set_work_area_cache,
};
#[cfg(target_os = "windows")]
use crate::snap::enum_windows_snap_callback;

pub const MAX_DOCK_LOGICAL_WIDTH: i32 = 520;
pub const HANDLE_GUTTER_LOGICAL_PX: i32 = 0;

pub static CURRENT_LEFT_WIDTH: AtomicI32 = AtomicI32::new(280);
pub static CURRENT_RIGHT_WIDTH: AtomicI32 = AtomicI32::new(280);
pub static LEFT_DRAG_ACTIVE: AtomicBool = AtomicBool::new(false);
pub static RIGHT_DRAG_ACTIVE: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
pub static LEFT_DOCK_HWND: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
pub static RIGHT_DOCK_HWND: AtomicIsize = AtomicIsize::new(0);

#[cfg(target_os = "windows")]
static LAST_LEFT_REGION: AtomicI64 = AtomicI64::new(-1);
#[cfg(target_os = "windows")]
static LAST_RIGHT_REGION: AtomicI64 = AtomicI64::new(-1);

/// Position/size the window only if it differs from the target (no-op otherwise).
#[cfg(target_os = "windows")]
pub unsafe fn ensure_window_rect(h: HWND, x: i32, y: i32, w: i32, hgt: i32) {
    let mut r = RECT { left: 0, top: 0, right: 0, bottom: 0 };
    unsafe {
        GetWindowRect(h, &mut r);
        if r.left != x || r.top != y || (r.right - r.left) != w || (r.bottom - r.top) != hgt {
            SetWindowPos(h, HWND_TOPMOST, x, y, w, hgt, SWP_NOACTIVATE);
        }
    }
}

/// Clip the window's visible + hit-testable area. Unlike resizing, this does NOT
/// trigger a WebView2 relayout, so content never shifts.
#[cfg(target_os = "windows")]
pub unsafe fn set_clip_region(h: HWND, last: &AtomicI64, left: i32, right: i32, hgt: i32) {
    let key = ((left as i64) << 32) | (right as u32 as i64);
    if last.swap(key, Ordering::Relaxed) == key {
        return;
    }
    unsafe {
        let rgn = CreateRectRgn(left, 0, right, hgt);
        SetWindowRgn(h, rgn, 1);
    }
}

/// Computes physical dock layout, synchronizing both Tauri window positioning
/// and Win32 stationary canvas clipping.
#[cfg(target_os = "windows")]
pub fn apply_dock_geometry(app: &tauri::AppHandle, left_width: i32, right_width: i32) {
    let (rc_monitor, rc_work) = unsafe { get_primary_monitor_rects() };
    let monitor = app.primary_monitor().ok().flatten().or_else(|| {
        app.get_webview_window("left-dock")
            .and_then(|w| w.current_monitor().ok().flatten())
    });

    let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
    let mon_width = rc_monitor.right - rc_monitor.left;
    let mon_left = rc_monitor.left;
    let top_y = rc_work.top;
    let dock_height = rc_work.bottom - rc_work.top;

    let left_drag = LEFT_DRAG_ACTIVE.load(Ordering::Relaxed);
    let right_drag = RIGHT_DRAG_ACTIVE.load(Ordering::Relaxed);

    // The OS windows are ALWAYS the full canvas size and never move/resize during drag.
    let phys_canvas = ((MAX_DOCK_LOGICAL_WIDTH as f64) * scale).round() as i32;

    // Visible + clickable area is clipped with a window region.
    let left_visible = if left_drag {
        phys_canvas
    } else {
        (((left_width + HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32
    };
    let right_visible = if right_drag {
        phys_canvas
    } else {
        (((right_width + HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32
    };

    if let Some(left_win) = app.get_webview_window("left-dock") {
        let _ = left_win.set_position(tauri::PhysicalPosition::new(mon_left, top_y));
        let _ = left_win.set_size(tauri::PhysicalSize::new(phys_canvas as u32, dock_height as u32));
        if let Ok(hwnd) = left_win.hwnd() {
            let h = hwnd.0 as HWND;
            LEFT_DOCK_HWND.store(h as isize, Ordering::Relaxed);
            unsafe {
                ensure_window_rect(h, mon_left, top_y, phys_canvas, dock_height);
                set_clip_region(h, &LAST_LEFT_REGION, 0, left_visible, dock_height);
                if windows_sys::Win32::UI::WindowsAndMessaging::IsWindowVisible(h) == 0 {
                    let _ = left_win.show();
                }
            }
        }
    }

    if let Some(right_win) = app.get_webview_window("right-dock") {
        let right_x = mon_left + mon_width - phys_canvas;
        let _ = right_win.set_position(tauri::PhysicalPosition::new(right_x, top_y));
        let _ = right_win.set_size(tauri::PhysicalSize::new(phys_canvas as u32, dock_height as u32));
        if let Ok(hwnd) = right_win.hwnd() {
            let h = hwnd.0 as HWND;
            RIGHT_DOCK_HWND.store(h as isize, Ordering::Relaxed);
            unsafe {
                ensure_window_rect(h, right_x, top_y, phys_canvas, dock_height);
                set_clip_region(
                    h,
                    &LAST_RIGHT_REGION,
                    phys_canvas - right_visible,
                    phys_canvas,
                    dock_height,
                );
                if windows_sys::Win32::UI::WindowsAndMessaging::IsWindowVisible(h) == 0 {
                    let _ = right_win.show();
                }
            }
        }
    }
}

/// Updates the desktop work area reservation so external apps snap cleanly between docks.
#[cfg(target_os = "windows")]
pub unsafe fn update_dock_work_area(
    orig: RECT,
    phys_left: i32,
    phys_right: i32,
    snap_open_windows: bool,
) {
    let new_rect = RECT {
        left: orig.left + phys_left,
        top: orig.top,
        right: orig.right - phys_right,
        bottom: orig.bottom,
    };

    set_work_area_cache(new_rect, orig);

    unsafe {
        apply_system_work_area(&new_rect);

        if snap_open_windows {
            EnumWindows(
                Some(enum_windows_snap_callback),
                &new_rect as *const _ as LPARAM,
            );
        }
    }
}
