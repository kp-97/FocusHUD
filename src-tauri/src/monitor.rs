#[cfg(target_os = "windows")]
use std::sync::Mutex;
#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{POINT, RECT};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MONITOR_DEFAULTTOPRIMARY, MONITORINFO, MonitorFromPoint,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Registry::{
    HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE, REG_DWORD, RegCloseKey, RegOpenKeyExW, RegSetValueExW,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::HiDpi::{
    DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, SetProcessDpiAwarenessContext,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    HWND_BROADCAST, SMTO_ABORTIFHUNG, SPI_SETDOCKMOVING, SPI_SETSNAPSIZING, SPI_SETWINARRANGING,
    SPI_SETWORKAREA, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SendMessageTimeoutW,
    SystemParametersInfoW, WM_SETTINGCHANGE,
};

#[cfg(target_os = "windows")]
static ORIGINAL_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);
#[cfg(target_os = "windows")]
static CURRENT_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);
#[cfg(target_os = "windows")]
static PREVIOUS_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);
#[cfg(target_os = "windows")]
static WORK_AREA_SEQ: AtomicU64 = AtomicU64::new(0);
#[cfg(target_os = "windows")]
static WINDOWS_SNAP_SUPPRESSED: AtomicBool = AtomicBool::new(false);

pub use crate::platform::ScreenMetrics;
pub use crate::watchdog::*;

/// Low-level helper that enables (`true`) or disables (`false`) the native Windows 11
/// Snap Layouts bar (`EnableSnapBar`), hover flyout (`EnableSnapAssistFlyout`),
/// Snap Assist (`SnapAssist`), and OS window arranging (`SPI_SETWINARRANGING`,
/// `SPI_SETDOCKMOVING`, `SPI_SETSNAPSIZING`), then broadcasts `WM_SETTINGCHANGE` so
/// `explorer.exe` and `win32k` apply the change immediately without restarting Explorer.
#[cfg(target_os = "windows")]
pub unsafe fn set_windows_snap_enabled_raw(enabled: bool) {
    let val: u32 = if enabled { 1 } else { 0 };

    let subkey: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced\0"
        .encode_utf16()
        .collect();
    let mut hkey: HKEY = std::ptr::null_mut();
    unsafe {
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            subkey.as_ptr(),
            0,
            KEY_SET_VALUE,
            &mut hkey,
        ) == 0
            && !hkey.is_null()
        {
            for name in [
                "EnableSnapBar\0",
                "EnableSnapAssistFlyout\0",
                "SnapAssist\0",
            ] {
                let name_w: Vec<u16> = name.encode_utf16().collect();
                let _ = RegSetValueExW(
                    hkey,
                    name_w.as_ptr(),
                    0,
                    REG_DWORD,
                    &val as *const u32 as *const u8,
                    std::mem::size_of::<u32>() as u32,
                );
            }
            let _ = RegCloseKey(hkey);
        }

        let flags = SPIF_UPDATEINIFILE | SPIF_SENDCHANGE;
        let _ = SystemParametersInfoW(SPI_SETWINARRANGING, val, std::ptr::null_mut(), flags);
        let _ = SystemParametersInfoW(SPI_SETDOCKMOVING, val, std::ptr::null_mut(), flags);
        let _ = SystemParametersInfoW(SPI_SETSNAPSIZING, val, std::ptr::null_mut(), flags);

        for param in ["ShellState\0", "Policy\0"] {
            let param_w: Vec<u16> = param.encode_utf16().collect();
            let mut result: usize = 0;
            let _ = SendMessageTimeoutW(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                0,
                param_w.as_ptr() as isize,
                SMTO_ABORTIFHUNG,
                50,
                &mut result,
            );
        }
    }
}

/// Idempotently suppresses or restores the native Windows layout selector and Aero Snap.
#[cfg(target_os = "windows")]
pub fn set_windows_snap_enabled(enabled: bool) {
    let should_suppress = !enabled;
    if WINDOWS_SNAP_SUPPRESSED.swap(should_suppress, Ordering::SeqCst) != should_suppress {
        unsafe {
            set_windows_snap_enabled_raw(enabled);
        }
    }
}

/// Enforces Per-Monitor DPI v2 awareness so Ultrawide and high-DPI displays
/// report true physical resolutions instead of legacy scaled bounds.
pub fn init_dpi_awareness() {
    #[cfg(target_os = "windows")]
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }
}

/// Queries true physical monitor bounds and work area using GetMonitorInfoW
/// in Per-Monitor DPI v2 context so Ultrawide panels are never clipped.
#[cfg(target_os = "windows")]
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

#[cfg(target_os = "windows")]
pub fn init_original_work_area(orig: RECT) {
    let mut lock = ORIGINAL_WORK_AREA.lock().unwrap();
    if lock.is_none() {
        *lock = Some(orig);
    }
}

#[cfg(target_os = "windows")]
pub fn get_original_work_area() -> Option<RECT> {
    *ORIGINAL_WORK_AREA.lock().unwrap()
}

#[cfg(target_os = "windows")]
pub fn get_current_work_area() -> Option<RECT> {
    *CURRENT_WORK_AREA.lock().unwrap()
}

#[cfg(target_os = "windows")]
pub fn get_previous_work_area() -> Option<RECT> {
    *PREVIOUS_WORK_AREA.lock().unwrap()
}

#[cfg(target_os = "windows")]
pub fn set_work_area_cache(new_rect: RECT, orig: RECT) {
    let mut cur_lock = CURRENT_WORK_AREA.lock().unwrap();
    let mut prev_lock = PREVIOUS_WORK_AREA.lock().unwrap();
    *prev_lock = (*cur_lock).or(Some(orig));
    *cur_lock = Some(new_rect);
}

#[cfg(target_os = "windows")]
pub unsafe fn apply_system_work_area_no_broadcast(_new_rect: &RECT) {
    // Intentionally do NOT call SystemParametersInfoW(SPI_SETWORKAREA) during live resize.
    // Changing the OS work area during resize causes Windows Explorer to shift and scramble
    // desktop icons. FocusHUD reflows snapped windows directly via SetWindowPos.
}

#[cfg(target_os = "windows")]
pub unsafe fn apply_system_work_area(_new_rect: &RECT) {
    // Intentionally do NOT mutate OS SPI_SETWORKAREA when resizing or updating docks.
    // Keeping the OS work area at its original bounds ensures Windows Explorer never
    // moves or shifts the user's desktop icons. FocusHUD manages window snapping directly.
}

/// Synchronously restores the desktop work area to the captured original dimensions,
/// re-enables the native Windows layout selector, and broadcasts the change immediately.
pub fn restore_work_area_sync() {
    #[cfg(target_os = "windows")]
    {
        set_windows_snap_enabled(true);

        let lock = ORIGINAL_WORK_AREA.lock().unwrap();
        if let Some(orig) = *lock {
            let mut cur_lock = CURRENT_WORK_AREA.lock().unwrap();
            let mut prev_lock = PREVIOUS_WORK_AREA.lock().unwrap();
            *prev_lock = *cur_lock;
            *cur_lock = Some(orig);

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
}

pub fn restore_work_area() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        set_windows_snap_enabled(true);

        let lock = ORIGINAL_WORK_AREA.lock().unwrap();
        if let Some(orig) = *lock {
            let mut cur_lock = CURRENT_WORK_AREA.lock().unwrap();
            let mut prev_lock = PREVIOUS_WORK_AREA.lock().unwrap();
            *prev_lock = *cur_lock;
            *cur_lock = Some(orig);

            let seq = WORK_AREA_SEQ.fetch_add(1, Ordering::SeqCst) + 1;
            unsafe {
                // Immediate application without blocking broadcast delay
                SystemParametersInfoW(SPI_SETWORKAREA, 0, &orig as *const _ as *mut _, 0);
            }

            // Non-blocking detached thread for broadcast to external windows and taskbars
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(25));
                if WORK_AREA_SEQ.load(Ordering::SeqCst) == seq {
                    unsafe {
                        SystemParametersInfoW(
                            SPI_SETWORKAREA,
                            0,
                            &orig as *const _ as *mut _,
                            SPIF_SENDCHANGE,
                        );
                    }
                }
            });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_metrics_serialization() {
        let metrics = ScreenMetrics {
            screen_width: 3440,
            screen_height: 1440,
            original_left: 0,
            original_top: 0,
            original_right: 3440,
            original_bottom: 1400,
        };
        let json = serde_json::to_string(&metrics).unwrap();
        assert!(json.contains("screen_width"));
        assert!(json.contains("3440"));
    }

    #[test]
    fn test_signal_clean_exit_idempotent() {
        signal_watchdog_clean_exit();
        signal_watchdog_clean_exit();
    }

    #[test]
    fn test_parse_watchdog_args_valid() {
        let args = vec![
            "FocusHUD.exe".to_string(),
            "--watchdog".to_string(),
            "12345".to_string(),
            "0".to_string(),
            "0".to_string(),
            "3440".to_string(),
            "1400".to_string(),
        ];
        let parsed = parse_watchdog_args(&args);
        assert_eq!(parsed, Some((12345, 0, 0, 3440, 1400)));
    }

    #[test]
    fn test_parse_watchdog_args_normal_run() {
        let args = vec!["FocusHUD.exe".to_string()];
        assert_eq!(parse_watchdog_args(&args), None);
    }

    #[test]
    fn test_parse_watchdog_args_malformed_number() {
        let args = vec![
            "FocusHUD.exe".to_string(),
            "--watchdog".to_string(),
            "not_a_number".to_string(),
            "0".to_string(),
            "0".to_string(),
            "3440".to_string(),
            "1400".to_string(),
        ];
        assert_eq!(parse_watchdog_args(&args), None);
    }

    #[test]
    fn test_parse_watchdog_args_insufficient_params() {
        let args = vec![
            "FocusHUD.exe".to_string(),
            "--watchdog".to_string(),
            "12345".to_string(),
        ];
        assert_eq!(parse_watchdog_args(&args), None);
    }

    #[test]
    fn test_init_console_ctrl_handler_idempotent() {
        init_console_ctrl_handler();
        init_console_ctrl_handler();
    }
}
