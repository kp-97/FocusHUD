use std::sync::Mutex;
use std::time::{Duration, Instant};

use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, IsIconic, IsWindow, IsWindowVisible, IsZoomed,
};

use super::layout::{CenterSnapLayoutState, WindowMinMax};
use super::win32::{
    fit_window_to_visible_rect, fit_windows_batch_fast, get_visible_window_rect,
    get_window_min_max_constraints, int_to_rect, is_snappable_app_window, rect_to_int,
    refresh_window_metrics_cache,
};
use super::{CENTER_SNAP_LAYOUT, SnapTargetKind, calculate_snap_rects, is_rect_fitted};

pub static DOCK_DRAG_CAPTURED_WINDOWS: Mutex<Vec<(isize, SnapTargetKind)>> = Mutex::new(Vec::new());
pub static LAST_FAST_REFLOW_INSTANT: Mutex<Option<Instant>> = Mutex::new(None);

pub fn collect_layout_constraints(layout: &CenterSnapLayoutState) -> Vec<Option<WindowMinMax>> {
    layout
        .zones
        .iter()
        .map(|opt_h| {
            opt_h.and_then(|h_val| {
                let h = h_val as HWND;
                unsafe {
                    (IsWindow(h) != 0 && IsWindowVisible(h) != 0 && IsIconic(h) == 0)
                        .then(|| get_window_min_max_constraints(h))
                }
            })
        })
        .collect()
}

pub unsafe fn refresh_layout_window_caches() {
    if let Some(layout) = CENTER_SNAP_LAYOUT.lock().ok().and_then(|l| l.clone()) {
        for h_val in layout.zones.into_iter().flatten() {
            unsafe { refresh_window_metrics_cache(h_val as HWND) };
        }
    }
}

pub unsafe fn apply_active_layout_windows(work_rect: RECT, skip_hwnd: Option<isize>) {
    let Some(mut layout) = CENTER_SNAP_LAYOUT.lock().ok().and_then(|l| l.clone()) else {
        return;
    };
    let constraints = collect_layout_constraints(&layout);
    let work_int = rect_to_int(work_rect);
    layout.clamp_splits(work_int, &constraints);
    let zone_rects = layout.compute_zone_rects(work_int, &constraints);

    if let Ok(mut lock) = CENTER_SNAP_LAYOUT.lock() {
        *lock = Some(layout.clone());
    }

    let mut batch: Vec<(HWND, RECT)> = Vec::with_capacity(layout.zones.len());
    for (idx, opt_hwnd) in layout.zones.iter().enumerate() {
        if let (Some(h_val), Some(&z_int)) = (*opt_hwnd, zone_rects.get(idx)) {
            if skip_hwnd != Some(h_val) {
                let h = h_val as HWND;
                unsafe {
                    if IsWindow(h) != 0 && IsWindowVisible(h) != 0 && IsIconic(h) == 0 {
                        batch.push((h, int_to_rect(z_int)));
                    }
                }
            }
        }
    }
    if !batch.is_empty() {
        unsafe { fit_windows_batch_fast(&batch) };
    }
}

/// Called once when the user starts dragging a FocusHUD dock border (`set_dock_drag_mode(..., true)`).
/// Pre-caches DWM padding for all snapped/maximized windows so that live drag frames never run `EnumWindows`.
pub unsafe fn prepare_for_dock_drag(work_rect: RECT) {
    unsafe { refresh_layout_window_caches() };

    let layout_hwnds: Vec<isize> = CENTER_SNAP_LAYOUT
        .lock()
        .ok()
        .and_then(|l| {
            l.as_ref()
                .map(|s| s.zones.iter().filter_map(|&h| h).collect())
        })
        .unwrap_or_default();

    struct PrepCtx {
        work_rect: RECT,
        layout_hwnds: Vec<isize>,
        captured: Vec<(isize, SnapTargetKind)>,
    }

    unsafe extern "system" fn prep_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let ctx = &mut *(lparam as *mut PrepCtx);
            let h_val = hwnd as isize;
            if ctx.layout_hwnds.contains(&h_val) || !is_snappable_app_window(hwnd) {
                return 1;
            }
            if IsZoomed(hwnd) != 0 {
                refresh_window_metrics_cache(hwnd);
                ctx.captured.push((h_val, SnapTargetKind::Full));
                return 1;
            }
            let Some(vis) = get_visible_window_rect(hwnd) else {
                return 1;
            };
            let (lh, rh) = calculate_snap_rects(ctx.work_rect);
            let kind = if is_rect_fitted(vis, lh, 24) {
                Some(SnapTargetKind::LeftHalf)
            } else if is_rect_fitted(vis, rh, 24) {
                Some(SnapTargetKind::RightHalf)
            } else if is_rect_fitted(vis, ctx.work_rect, 24) {
                Some(SnapTargetKind::Full)
            } else {
                None
            };
            if let Some(k) = kind {
                refresh_window_metrics_cache(hwnd);
                ctx.captured.push((h_val, k));
            }
        }
        1
    }

    let mut ctx = PrepCtx {
        work_rect,
        layout_hwnds,
        captured: Vec::new(),
    };
    unsafe { EnumWindows(Some(prep_cb), &mut ctx as *mut _ as LPARAM) };
    if let Ok(mut lock) = DOCK_DRAG_CAPTURED_WINDOWS.lock() {
        *lock = ctx.captured;
    }
}

/// Fast non-blocking reflow executed during FocusHUD dock border dragging.
/// Rate-limited to ~90 FPS (`11ms`) with `SWP_ASYNCWINDOWPOS` so external apps resize
/// smoothly without blocking FocusHUD or building up a message backlog.
pub unsafe fn reflow_snapped_windows_fast(new_rect: RECT) {
    let now = Instant::now();
    if let Ok(mut lock) = LAST_FAST_REFLOW_INSTANT.lock() {
        if let Some(prev) = *lock {
            if now.duration_since(prev) < Duration::from_millis(11) {
                return;
            }
        }
        *lock = Some(now);
    }

    unsafe { apply_active_layout_windows(new_rect, None) };

    let captured = DOCK_DRAG_CAPTURED_WINDOWS
        .lock()
        .ok()
        .map(|l| l.clone())
        .unwrap_or_default();
    if captured.is_empty() {
        return;
    }

    let (new_l, new_r) = calculate_snap_rects(new_rect);
    let mut batch: Vec<(HWND, RECT)> = Vec::with_capacity(captured.len());
    for (h_val, kind) in captured {
        let target = match kind {
            SnapTargetKind::LeftHalf => new_l,
            SnapTargetKind::RightHalf => new_r,
            SnapTargetKind::Full => new_rect,
        };
        batch.push((h_val as HWND, target));
    }
    unsafe { fit_windows_batch_fast(&batch) };
}

pub unsafe fn reflow_snapped_windows_on_boundary_change(prev_rect: RECT, new_rect: RECT) {
    if let Ok(mut lock) = LAST_FAST_REFLOW_INSTANT.lock() {
        *lock = None;
    }
    if let Ok(mut lock) = DOCK_DRAG_CAPTURED_WINDOWS.lock() {
        lock.clear();
    }
    unsafe { apply_active_layout_windows(new_rect, None) };

    #[repr(C)]
    struct ReflowCtx {
        prev_rect: RECT,
        new_rect: RECT,
    }

    unsafe extern "system" fn reflow_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            if !is_snappable_app_window(hwnd) {
                return 1;
            }
            if CENTER_SNAP_LAYOUT
                .lock()
                .ok()
                .and_then(|l| l.as_ref().map(|s| s.zones.contains(&Some(hwnd as isize))))
                .unwrap_or(false)
            {
                return 1;
            }
            let ctx = &*(lparam as *const ReflowCtx);
            if IsZoomed(hwnd) != 0 {
                fit_windows_batch_fast(&[(hwnd, ctx.new_rect)]);
                return 1;
            }
            let Some(vis) = get_visible_window_rect(hwnd) else {
                return 1;
            };
            let (prev_l, prev_r) = calculate_snap_rects(ctx.prev_rect);
            let (new_l, new_r) = calculate_snap_rects(ctx.new_rect);
            if is_rect_fitted(vis, prev_l, 24) {
                fit_window_to_visible_rect(hwnd, new_l);
            } else if is_rect_fitted(vis, prev_r, 24) {
                fit_window_to_visible_rect(hwnd, new_r);
            } else if is_rect_fitted(vis, ctx.prev_rect, 24) {
                fit_window_to_visible_rect(hwnd, ctx.new_rect);
            }
        }
        1
    }

    let ctx = ReflowCtx {
        prev_rect,
        new_rect,
    };
    unsafe { EnumWindows(Some(reflow_cb), &ctx as *const _ as LPARAM) };
}
