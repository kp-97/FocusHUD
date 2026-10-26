use super::ScreenMetrics;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicIsize, AtomicU64, Ordering};
use tauri::Manager;

use windows_sys::Win32::Foundation::{CloseHandle, HWND, LPARAM, POINT, RECT, WAIT_OBJECT_0};
use windows_sys::Win32::Graphics::Gdi::{
    CreateRectRgn, GetMonitorInfoW, MONITOR_DEFAULTTOPRIMARY, MONITORINFO, MonitorFromPoint,
    SetWindowRgn,
};
use windows_sys::Win32::System::Threading::{
    CreateEventW, INFINITE, OpenEventW, OpenProcess, PROCESS_SYNCHRONIZE, WaitForMultipleObjects,
    WaitForSingleObject,
};
use windows_sys::Win32::UI::HiDpi::{
    DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, SetProcessDpiAwarenessContext,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowRect, HWND_TOPMOST, IsWindowVisible, SPI_SETWORKAREA, SPIF_SENDCHANGE,
    SWP_NOACTIVATE, SetWindowPos, SystemParametersInfoW,
};

use crate::dock::{
    CURRENT_LEFT_WIDTH, CURRENT_RIGHT_WIDTH, HANDLE_GUTTER_LOGICAL_PX, LEFT_DRAG_ACTIVE,
    LEFT_POPOUT_ACTIVE, RIGHT_DRAG_ACTIVE, RIGHT_POPOUT_ACTIVE, calculate_canvas_width,
    calculate_right_dock_x, calculate_visible_width, calculate_work_area_margins,
};
use crate::snap::enum_windows_snap_callback;

static ORIGINAL_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);
static CURRENT_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);
static PREVIOUS_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);
static WORK_AREA_SEQ: AtomicU64 = AtomicU64::new(0);

static CLEAN_EXIT_EVENT: AtomicIsize = AtomicIsize::new(0);
static WATCHDOG_SPAWNED: AtomicBool = AtomicBool::new(false);
static CONSOLE_HANDLER_INSTALLED: AtomicBool = AtomicBool::new(false);

pub static LEFT_DOCK_HWND: AtomicIsize = AtomicIsize::new(0);
pub static RIGHT_DOCK_HWND: AtomicIsize = AtomicIsize::new(0);

static LAST_LEFT_REGION: AtomicI64 = AtomicI64::new(-1);
static LAST_RIGHT_REGION: AtomicI64 = AtomicI64::new(-1);

const SYNCHRONIZE: u32 = 0x00100000;

/// Enforces Per-Monitor DPI v2 awareness so Ultrawide and high-DPI displays
/// report true physical resolutions instead of legacy scaled bounds.
pub fn init_dpi_awareness() {
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
}

/// Queries true physical monitor bounds and work area using GetMonitorInfoW
/// in Per-Monitor DPI v2 context so Ultrawide panels are never clipped.
pub unsafe fn get_primary_monitor_rects() -> (RECT, RECT) {
    let pt = POINT { x: 0, y: 0 };
    unsafe {
        let hmon = MonitorFromPoint(pt, MONITOR_DEFAULTTOPRIMARY);
        let mut mi: MONITORINFO = std::mem::zeroed();
        mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
        if GetMonitorInfoW(hmon, &mut mi) != 0 {
            (mi.rcMonitor, mi.rcWork)
        } else {
            (
                RECT {
                    left: 0,
                    top: 0,
                    right: 3440,
                    bottom: 1440,
                },
                RECT {
                    left: 0,
                    top: 0,
                    right: 3440,
                    bottom: 1356,
                },
            )
        }
    }
}

pub fn get_screen_metrics(_app: &tauri::AppHandle) -> Result<ScreenMetrics, String> {
    unsafe {
        let (rc_monitor, rc_work) = get_primary_monitor_rects();
        let orig = get_original_work_area().unwrap_or(rc_work);

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

pub fn init_original_work_area(orig: RECT) {
    let mut lock = ORIGINAL_WORK_AREA.lock().unwrap();
    if lock.is_none() {
        *lock = Some(orig);
    }
}

pub fn get_original_work_area() -> Option<RECT> {
    *ORIGINAL_WORK_AREA.lock().unwrap()
}

pub fn get_current_work_area() -> Option<RECT> {
    *CURRENT_WORK_AREA.lock().unwrap()
}

pub fn get_previous_work_area() -> Option<RECT> {
    *PREVIOUS_WORK_AREA.lock().unwrap()
}

pub fn set_work_area_cache(new_rect: RECT, orig: RECT) {
    let mut cur_lock = CURRENT_WORK_AREA.lock().unwrap();
    let mut prev_lock = PREVIOUS_WORK_AREA.lock().unwrap();
    *prev_lock = (*cur_lock).or(Some(orig));
    *cur_lock = Some(new_rect);
}

pub unsafe fn apply_system_work_area(new_rect: &RECT) {
    let rect_copy = *new_rect;
    let seq = WORK_AREA_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
    unsafe {
        SystemParametersInfoW(SPI_SETWORKAREA, 0, &rect_copy as *const _ as *mut _, 0);
    }

    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(25));
        if WORK_AREA_SEQ.load(Ordering::SeqCst) == seq {
            unsafe {
                SystemParametersInfoW(
                    SPI_SETWORKAREA,
                    0,
                    &rect_copy as *const _ as *mut _,
                    SPIF_SENDCHANGE,
                );
            }
        }
    });
}

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

pub fn configure_dock_windows(app: &tauri::AppHandle) {
    let left_w = CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
    let right_w = CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);
    apply_dock_geometry(app, left_w, right_w);
}

pub fn configure_settings_window(_window: &tauri::WebviewWindow) {}

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

    let left_expanded =
        LEFT_DRAG_ACTIVE.load(Ordering::Relaxed) || LEFT_POPOUT_ACTIVE.load(Ordering::Relaxed);
    let right_expanded =
        RIGHT_DRAG_ACTIVE.load(Ordering::Relaxed) || RIGHT_POPOUT_ACTIVE.load(Ordering::Relaxed);

    let phys_canvas = calculate_canvas_width(scale);
    let left_visible = calculate_visible_width(left_width, left_expanded, scale);
    let right_visible = calculate_visible_width(right_width, right_expanded, scale);

    if let Some(left_win) = app.get_webview_window("left-dock") {
        let _ = left_win.set_position(tauri::PhysicalPosition::new(mon_left, top_y));
        let _ = left_win.set_size(tauri::PhysicalSize::new(
            phys_canvas as u32,
            dock_height as u32,
        ));
        if let Ok(hwnd) = left_win.hwnd() {
            let h = hwnd.0 as HWND;
            LEFT_DOCK_HWND.store(h as isize, Ordering::Relaxed);
            unsafe {
                ensure_window_rect(h, mon_left, top_y, phys_canvas, dock_height);
                set_clip_region(h, &LAST_LEFT_REGION, 0, left_visible, dock_height);
                if IsWindowVisible(h) == 0 {
                    let _ = left_win.show();
                }
            }
        }
    }

    if let Some(right_win) = app.get_webview_window("right-dock") {
        let right_x = calculate_right_dock_x(mon_left, mon_width, phys_canvas);
        let _ = right_win.set_position(tauri::PhysicalPosition::new(right_x, top_y));
        let _ = right_win.set_size(tauri::PhysicalSize::new(
            phys_canvas as u32,
            dock_height as u32,
        ));
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
                if IsWindowVisible(h) == 0 {
                    let _ = right_win.show();
                }
            }
        }
    }
}

pub fn update_dock_work_area(
    app: &tauri::AppHandle,
    left_width: i32,
    right_width: i32,
    snap_open_windows: bool,
) {
    if let Some(orig) = get_original_work_area() {
        let monitor = app.primary_monitor().ok().flatten().or_else(|| {
            app.get_webview_window("left-dock")
                .and_then(|w| w.current_monitor().ok().flatten())
        });
        let scale = monitor.as_ref().map(|m| m.scale_factor()).unwrap_or(1.0);
        let phys_left = (((left_width + HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;
        let phys_right = (((right_width + HANDLE_GUTTER_LOGICAL_PX) as f64) * scale).round() as i32;

        let (new_left, new_right) =
            calculate_work_area_margins(orig.left, orig.right, phys_left, phys_right);
        let new_rect = RECT {
            left: new_left,
            top: orig.top,
            right: new_right,
            bottom: orig.bottom,
        };

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
            if snap_open_windows {
                EnumWindows(
                    Some(enum_windows_snap_callback),
                    &new_rect as *const _ as LPARAM,
                );
            }

            apply_system_work_area(&new_rect);
        }
    }
}

pub fn restore_work_area_sync() {
    let lock = ORIGINAL_WORK_AREA.lock().unwrap();
    if let Some(orig) = *lock {
        unsafe {
            SystemParametersInfoW(
                SPI_SETWORKAREA,
                0,
                &orig as *const _ as *mut _,
                SPIF_SENDCHANGE,
            );
        }
    }
}

pub fn restore_work_area() -> Result<(), String> {
    restore_work_area_sync();
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
    let handle =
        CLEAN_EXIT_EVENT.swap(0, Ordering::SeqCst) as windows_sys::Win32::Foundation::HANDLE;
    if !handle.is_null() {
        unsafe {
            windows_sys::Win32::System::Threading::SetEvent(handle);
            CloseHandle(handle);
        }
    }
}

pub fn spawn_watchdog(orig: RECT) {
    use std::os::windows::process::CommandExt;

    if WATCHDOG_SPAWNED.swap(true, Ordering::SeqCst) {
        return;
    }

    let current_exe = match std::env::current_exe() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("[FocusHUD] Failed to get current_exe for watchdog: {}", e);
            return;
        }
    };

    let pid = std::process::id();
    let event_name: Vec<u16> = format!("Local\\FocusHUD_Exit_{}\0", pid)
        .encode_utf16()
        .collect();
    unsafe {
        let h_event = CreateEventW(std::ptr::null(), 1, 0, event_name.as_ptr());
        if !h_event.is_null() {
            CLEAN_EXIT_EVENT.store(h_event as isize, Ordering::SeqCst);
        }
    }

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const DETACHED_PROCESS: u32 = 0x00000008;

    let mut cmd = std::process::Command::new(current_exe);
    cmd.arg("--watchdog")
        .arg(pid.to_string())
        .arg(orig.left.to_string())
        .arg(orig.top.to_string())
        .arg(orig.right.to_string())
        .arg(orig.bottom.to_string())
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);

    if let Err(e) = cmd.spawn() {
        eprintln!("[FocusHUD] Failed to spawn watchdog process: {}", e);
    }
}

pub fn run_watchdog(pid: u32, left: i32, top: i32, right: i32, bottom: i32) {
    let orig_rect = RECT {
        left,
        top,
        right,
        bottom,
    };

    unsafe {
        let h_process = OpenProcess(PROCESS_SYNCHRONIZE, 0, pid);
        if h_process.is_null() {
            SystemParametersInfoW(
                SPI_SETWORKAREA,
                0,
                &orig_rect as *const _ as *mut _,
                SPIF_SENDCHANGE,
            );
            return;
        }

        let event_name: Vec<u16> = format!("Local\\FocusHUD_Exit_{}\0", pid)
            .encode_utf16()
            .collect();
        let h_event = OpenEventW(SYNCHRONIZE, 0, event_name.as_ptr());

        if !h_event.is_null() {
            let handles = [h_event, h_process];
            let wait_res = WaitForMultipleObjects(2, handles.as_ptr(), 0, INFINITE);
            if wait_res != WAIT_OBJECT_0 {
                SystemParametersInfoW(
                    SPI_SETWORKAREA,
                    0,
                    &orig_rect as *const _ as *mut _,
                    SPIF_SENDCHANGE,
                );
            }
            CloseHandle(h_event);
        } else {
            let _ = WaitForSingleObject(h_process, INFINITE);
            SystemParametersInfoW(
                SPI_SETWORKAREA,
                0,
                &orig_rect as *const _ as *mut _,
                SPIF_SENDCHANGE,
            );
        }

        CloseHandle(h_process);
    }
}

pub fn init_console_ctrl_handler() {
    if !CONSOLE_HANDLER_INSTALLED.swap(true, Ordering::SeqCst) {
        unsafe extern "system" fn console_ctrl_handler(
            ctrl_type: u32,
        ) -> windows_sys::Win32::Foundation::BOOL {
            match ctrl_type {
                windows_sys::Win32::System::Console::CTRL_C_EVENT
                | windows_sys::Win32::System::Console::CTRL_BREAK_EVENT
                | windows_sys::Win32::System::Console::CTRL_CLOSE_EVENT
                | windows_sys::Win32::System::Console::CTRL_LOGOFF_EVENT
                | windows_sys::Win32::System::Console::CTRL_SHUTDOWN_EVENT => {
                    restore_work_area_sync();
                    signal_watchdog_clean_exit();
                    std::process::exit(0);
                }
                _ => 0,
            }
        }

        unsafe {
            windows_sys::Win32::System::Console::SetConsoleCtrlHandler(
                Some(console_ctrl_handler),
                1,
            );
        }
    }
}

pub fn parse_watchdog_args(args: &[String]) -> Option<(u32, i32, i32, i32, i32)> {
    if args.len() >= 7 && args[1] == "--watchdog" {
        if let (Ok(pid), Ok(left), Ok(top), Ok(right), Ok(bottom)) = (
            args[2].parse::<u32>(),
            args[3].parse::<i32>(),
            args[4].parse::<i32>(),
            args[5].parse::<i32>(),
            args[6].parse::<i32>(),
        ) {
            return Some((pid, left, top, right, bottom));
        }
    }
    None
}
