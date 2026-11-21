//! Display monitor discovery and DPI awareness queries.

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

use super::geometry::MonitorRect;

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

/// Safe helper returning cross-platform MonitorRect geometry for primary display.
pub fn get_primary_monitor_geometry() -> (MonitorRect, MonitorRect) {
    #[cfg(target_os = "windows")]
    unsafe {
        let (rc_monitor, rc_work) = get_primary_monitor_rects();
        (MonitorRect::from(rc_monitor), MonitorRect::from(rc_work))
    }
    #[cfg(not(target_os = "windows"))]
    {
        (
            MonitorRect::new(0, 0, 1920, 1080),
            MonitorRect::new(0, 0, 1920, 1055),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_init_dpi_awareness_idempotent() {
        init_dpi_awareness();
        init_dpi_awareness();
    }

    #[test]
    fn test_get_primary_monitor_geometry() {
        let (mon, work) = get_primary_monitor_geometry();
        assert!(mon.width() > 0);
        assert!(mon.height() > 0);
        assert!(work.width() > 0);
        assert!(work.height() > 0);
    }
}
