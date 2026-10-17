use serde::Serialize;
use std::sync::Mutex;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{POINT, RECT};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MONITOR_DEFAULTTOPRIMARY, MONITORINFO, MonitorFromPoint,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::HiDpi::{
    DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2, SetProcessDpiAwarenessContext,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SPI_SETWORKAREA, SPIF_SENDCHANGE, SystemParametersInfoW,
};

#[cfg(target_os = "windows")]
static ORIGINAL_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);
#[cfg(target_os = "windows")]
static CURRENT_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);
#[cfg(target_os = "windows")]
static PREVIOUS_WORK_AREA: Mutex<Option<RECT>> = Mutex::new(None);

#[derive(Serialize)]
pub struct ScreenMetrics {
    pub screen_width: i32,
    pub screen_height: i32,
    pub original_left: i32,
    pub original_top: i32,
    pub original_right: i32,
    pub original_bottom: i32,
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
pub unsafe fn apply_system_work_area(new_rect: &RECT) {
    unsafe {
        SystemParametersInfoW(
            SPI_SETWORKAREA,
            0,
            new_rect as *const _ as *mut _,
            SPIF_SENDCHANGE,
        );
    }
}

pub fn restore_work_area() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    unsafe {
        let lock = ORIGINAL_WORK_AREA.lock().unwrap();
        if let Some(orig) = *lock {
            SystemParametersInfoW(
                SPI_SETWORKAREA,
                0,
                &orig as *const _ as *mut _,
                SPIF_SENDCHANGE,
            );
        }
    }
    Ok(())
}
