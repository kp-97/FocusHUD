#[cfg(target_os = "windows")]
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicI64, AtomicIsize};
#[cfg(target_os = "windows")]
use tauri::Manager;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{HWND, RECT};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Graphics::Gdi::{CreateRectRgn, SetWindowRgn};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GetWindowRect, HWND_TOPMOST, SWP_NOACTIVATE, SetWindowPos,
};

#[cfg(target_os = "windows")]
use crate::monitor::{
    apply_system_work_area, apply_system_work_area_no_broadcast, get_current_work_area,
    get_primary_monitor_rects, restore_work_area, set_work_area_cache,
};

pub const MAX_DOCK_LOGICAL_WIDTH: i32 = 800;
pub const HANDLE_GUTTER_LOGICAL_PX: i32 = 0;

pub static CURRENT_LEFT_WIDTH: AtomicI32 = AtomicI32::new(280);
pub static CURRENT_RIGHT_WIDTH: AtomicI32 = AtomicI32::new(280);
pub static PRIMARY_SCALE_MILLI: AtomicI32 = AtomicI32::new(1000);

pub fn get_primary_scale_factor() -> f64 {
    let milli = PRIMARY_SCALE_MILLI.load(Ordering::Relaxed);
    if milli > 100 {
        (milli as f64) / 1000.0
    } else {
        1.0
    }
}
pub static LEFT_DRAG_ACTIVE: AtomicBool = AtomicBool::new(false);
pub static RIGHT_DRAG_ACTIVE: AtomicBool = AtomicBool::new(false);
pub static LEFT_POPOUT_ACTIVE: AtomicBool = AtomicBool::new(false);
pub static RIGHT_POPOUT_ACTIVE: AtomicBool = AtomicBool::new(false);
pub static FULLSCREEN_ACTIVE: AtomicBool = AtomicBool::new(true);
pub static PANES_RESERVE_ZONES: AtomicBool = AtomicBool::new(true);

pub const WINDOW_STATE_WINDOWED: i32 = 0;
pub const WINDOW_STATE_MAXIMISED: i32 = 1;
pub const WINDOW_STATE_FULLSCREEN: i32 = 2;
pub const WINDOW_STATE_MINIMISED: i32 = 3;
pub const WINDOW_STATE_SPLIT: i32 = 4;

pub static CURRENT_WINDOW_STATE: AtomicI32 = AtomicI32::new(WINDOW_STATE_WINDOWED);
pub static PRIOR_FULLSCREEN_STATE: AtomicI32 = AtomicI32::new(WINDOW_STATE_WINDOWED);

#[cfg(target_os = "windows")]
pub static LEFT_DOCK_HWND: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
pub static RIGHT_DOCK_HWND: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
pub static MAIN_HWND: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
pub static SNAP_OVERLAY_HWND: AtomicIsize = AtomicIsize::new(0);

#[cfg(target_os = "windows")]
pub static LAST_LEFT_REGION: AtomicI64 = AtomicI64::new(-1);
#[cfg(target_os = "windows")]
pub static LAST_RIGHT_REGION: AtomicI64 = AtomicI64::new(-1);
#[cfg(target_os = "windows")]
static DOCK_LIVE_RESIZE_ACTIVE: AtomicBool = AtomicBool::new(false);
#[cfg(target_os = "windows")]
static PRE_DRAG_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);

/// Position/size the window only if it differs from the target (no-op otherwise).
#[cfg(target_os = "windows")]
pub unsafe fn ensure_window_rect(h: HWND, x: i32, y: i32, w: i32, hgt: i32) {
    let mut r = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
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

/// Calculates physical canvas width given a DPI scaling factor
pub fn calculate_canvas_width(scale: f64) -> i32 {
    ((MAX_DOCK_LOGICAL_WIDTH as f64) * scale).round() as i32
}

/// Calculates visible physical width for a dock considering dragging state and DPI scale
pub fn calculate_visible_width(logical_width: i32, is_drag_active: bool, scale: f64) -> i32 {
    let phys_canvas = calculate_canvas_width(scale);
    if is_drag_active {
        phys_canvas
    } else {
        (((logical_width + HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32
    }
}

/// Computes the X coordinate of the right-side dock window
pub fn calculate_right_dock_x(mon_left: i32, mon_width: i32, phys_canvas: i32) -> i32 {
    mon_left + mon_width - phys_canvas
}

/// Computes desktop work area margins for left and right docks
pub fn calculate_work_area_margins(
    orig_left: i32,
    orig_right: i32,
    phys_left: i32,
    phys_right: i32,
) -> (i32, i32) {
    (orig_left + phys_left, orig_right - phys_right)
}

/// Computes physical dock layout, synchronizing both Tauri window positioning
/// and Win32 stationary canvas clipping.
#[cfg(target_os = "windows")]
pub fn apply_dock_geometry(app: &tauri::AppHandle, left_width: i32, right_width: i32) {
    if FULLSCREEN_ACTIVE.load(Ordering::Relaxed) {
        return;
    }
    let (rc_monitor, rc_work) = unsafe { get_primary_monitor_rects() };
    let monitor = app.primary_monitor().ok().flatten().or_else(|| {
        app.get_webview_window("left-dock")
            .and_then(|w| w.current_monitor().ok().flatten())
    });

    let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
    PRIMARY_SCALE_MILLI.store(
        ((scale * 1000.0).round() as i32).max(100),
        Ordering::Relaxed,
    );
    let mon_width = rc_monitor.right - rc_monitor.left;
    let mon_left = rc_monitor.left;
    let top_y = rc_work.top;
    let dock_height = rc_work.bottom - rc_work.top;

    let left_expanded =
        LEFT_DRAG_ACTIVE.load(Ordering::Relaxed) || LEFT_POPOUT_ACTIVE.load(Ordering::Relaxed);
    let right_expanded =
        RIGHT_DRAG_ACTIVE.load(Ordering::Relaxed) || RIGHT_POPOUT_ACTIVE.load(Ordering::Relaxed);

    // The OS windows are ALWAYS the full canvas size and never move/resize during drag.
    let phys_canvas = calculate_canvas_width(scale);

    // Visible + clickable area is clipped with a window region.
    let left_visible = calculate_visible_width(left_width, left_expanded, scale);
    let right_visible = calculate_visible_width(right_width, right_expanded, scale);

    if let Some(left_win) = app.get_webview_window("left-dock") {
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
        } else {
            let _ = left_win.set_position(tauri::PhysicalPosition::new(mon_left, top_y));
            let _ = left_win.set_size(tauri::PhysicalSize::new(
                phys_canvas as u32,
                dock_height as u32,
            ));
        }
    }

    if let Some(right_win) = app.get_webview_window("right-dock") {
        let right_x = calculate_right_dock_x(mon_left, mon_width, phys_canvas);
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
        } else {
            let _ = right_win.set_position(tauri::PhysicalPosition::new(right_x, top_y));
            let _ = right_win.set_size(tauri::PhysicalSize::new(
                phys_canvas as u32,
                dock_height as u32,
            ));
        }
    }
}

/// Updates the desktop work area reservation so external apps snap cleanly between docks.
/// During live dock border dragging (`commit_system_work_area == false`), updates the
/// in-memory work area cache and resizes center-column windows via the fast path without
/// `SPI_SETWORKAREA` broadcast spam or `EnumWindows`. When `commit_system_work_area == true`,
/// commits the OS work area via `SPI_SETWORKAREA`.
#[cfg(target_os = "windows")]
pub unsafe fn update_dock_work_area(
    orig: RECT,
    phys_left: i32,
    phys_right: i32,
    commit_system_work_area: bool,
) {
    if !PANES_RESERVE_ZONES.load(Ordering::Relaxed) {
        let _ = restore_work_area();
        return;
    }

    let (new_left, new_right) =
        calculate_work_area_margins(orig.left, orig.right, phys_left, phys_right);
    let new_rect = RECT {
        left: new_left,
        top: orig.top,
        right: new_right,
        bottom: orig.bottom,
    };

    if !commit_system_work_area {
        if !DOCK_LIVE_RESIZE_ACTIVE.swap(true, Ordering::SeqCst) {
            let start_work = get_current_work_area().unwrap_or(orig);
            if let Ok(mut lock) = PRE_DRAG_WORK_AREA.lock() {
                *lock = Some(start_work);
            }
            unsafe {
                crate::snap::prepare_for_dock_drag(start_work);
            }
        }
        if let Some(curr) = get_current_work_area() {
            if curr.left == new_rect.left
                && curr.top == new_rect.top
                && curr.right == new_rect.right
                && curr.bottom == new_rect.bottom
            {
                return;
            }
        }
        set_work_area_cache(new_rect, orig);
        unsafe {
            apply_system_work_area_no_broadcast(&new_rect);
            crate::snap::reflow_snapped_windows_fast(new_rect);
        }
        return;
    }

    let was_dragging = DOCK_LIVE_RESIZE_ACTIVE.swap(false, Ordering::SeqCst);
    let prev_rect = if was_dragging {
        PRE_DRAG_WORK_AREA.lock().ok().and_then(|mut l| l.take())
    } else {
        None
    }
    .or_else(get_current_work_area)
    .unwrap_or(orig);
    set_work_area_cache(new_rect, orig);

    unsafe {
        apply_system_work_area(&new_rect);
        crate::snap::reflow_snapped_windows_on_boundary_change(prev_rect, new_rect);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_canvas_width_scaling() {
        assert_eq!(calculate_canvas_width(1.0), 800);
        assert_eq!(calculate_canvas_width(1.25), 1000);
        assert_eq!(calculate_canvas_width(1.5), 1200);
    }

    #[test]
    fn test_visible_width_drag_vs_idle() {
        let scale = 1.0;
        let idle = calculate_visible_width(280, false, scale);
        assert_eq!(idle, 280);

        let dragging = calculate_visible_width(280, true, scale);
        assert_eq!(dragging, 800);
    }

    #[test]
    fn test_right_dock_x_position() {
        // Ultrawide 3440x1440
        let mon_left = 0;
        let mon_width = 3440;
        let canvas = 800;
        let right_x = calculate_right_dock_x(mon_left, mon_width, canvas);
        assert_eq!(right_x, 2640);
    }

    #[test]
    fn test_work_area_margins() {
        let (new_left, new_right) = calculate_work_area_margins(0, 3440, 280, 280);
        assert_eq!(new_left, 280);
        assert_eq!(new_right, 3160);
    }
}
