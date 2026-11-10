use std::time::Duration;

use windows_sys::Win32::Foundation::HWND;
use windows_sys::Win32::UI::WindowsAndMessaging::IsWindow;

use super::hooks::{hide_snap_overlay, update_and_broadcast_overlay_state};
use super::layout::{CenterSnapLayoutState, LogicalRect, SnapLayoutTemplate};
use super::reflow::{apply_active_layout_windows, collect_layout_constraints};
use super::win32::{
    enumerate_snap_assist_candidates, fit_window_to_visible_rect_ex, int_to_rect,
    is_snappable_app_window, observe_window_min_size_if_clamped, rect_to_int,
};
use super::{
    CENTER_SNAP_LAYOUT, SnapOverlayMode, SnapOverlayState, get_snap_overlay_state_snapshot,
};
use crate::dock::get_primary_scale_factor;
use crate::monitor::get_current_work_area;

pub unsafe fn advance_or_finish_snap_assist() {
    let Some(work_rect) = get_current_work_area() else {
        hide_snap_overlay();
        return;
    };
    let Some(layout) = CENTER_SNAP_LAYOUT.lock().ok().and_then(|l| l.clone()) else {
        hide_snap_overlay();
        return;
    };
    let Some(next_idx) = layout.first_unassigned_zone() else {
        hide_snap_overlay();
        return;
    };

    let scale = get_primary_scale_factor();
    let work_int = rect_to_int(work_rect);
    let constraints = collect_layout_constraints(&layout);
    let zone_rects = layout.compute_zone_rects(work_int, &constraints);
    let Some(&target_int) = zone_rects.get(next_idx) else {
        hide_snap_overlay();
        return;
    };

    let assigned: Vec<isize> = layout.zones.iter().filter_map(|&h| h).collect();
    let candidates = unsafe { enumerate_snap_assist_candidates(&assigned) };
    let all_logical: Vec<LogicalRect> = zone_rects
        .iter()
        .map(|r| r.to_logical(work_rect.left, work_rect.top, scale))
        .collect();
    let filled: Vec<bool> = layout
        .zones
        .iter()
        .enumerate()
        .map(|(i, h)| h.is_some() || layout.skipped_zones.get(i).copied().unwrap_or(false))
        .collect();

    let (w_log, h_log) = (
        (work_int.width() as f64) / scale,
        (work_int.height() as f64) / scale,
    );
    let mut state = SnapOverlayState::with_bar(SnapOverlayMode::Assist, w_log, h_log);
    state.active_template = Some(layout.template);
    state.assist_zone_index = Some(next_idx);
    state.assist_zone_rect = Some(target_int.to_logical(work_rect.left, work_rect.top, scale));
    state.assist_all_zone_rects = all_logical;
    state.assist_filled_zones = filled;
    state.assist_candidates = candidates;
    update_and_broadcast_overlay_state(state);
}

pub unsafe fn apply_snap_selection(hwnd: HWND, template: SnapLayoutTemplate, zone_index: usize) {
    let Some(work_rect) = get_current_work_area() else {
        return;
    };
    if !unsafe { is_snappable_app_window(hwnd) } {
        return;
    }

    let mut layout = CenterSnapLayoutState::new(template);
    let safe_idx = zone_index.min(layout.zones.len().saturating_sub(1));
    layout.zones[safe_idx] = Some(hwnd as isize);

    let constraints = collect_layout_constraints(&layout);
    let work_int = rect_to_int(work_rect);
    layout.clamp_splits(work_int, &constraints);
    let zone_rects = layout.compute_zone_rects(work_int, &constraints);

    if let Ok(mut lock) = CENTER_SNAP_LAYOUT.lock() {
        *lock = Some(layout);
    }

    if let Some(&target_int) = zone_rects.get(safe_idx) {
        let target_rect = int_to_rect(target_int);
        unsafe { fit_window_to_visible_rect_ex(hwnd, target_rect, true, false) };
        let hwnd_val = hwnd as isize;
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(35));
            unsafe {
                let h = hwnd_val as HWND;
                if IsWindow(h) != 0 {
                    observe_window_min_size_if_clamped(h, target_rect);
                    apply_active_layout_windows(work_rect, Some(hwnd_val));
                }
            }
        });
    }

    if template.zone_count() > 1 {
        std::thread::spawn(|| unsafe {
            advance_or_finish_snap_assist();
        });
    } else {
        hide_snap_overlay();
    }
}

pub fn select_snap_assist_window_win32(
    hwnd_val: isize,
    zone_index: usize,
) -> Result<SnapOverlayState, String> {
    let Some(work_rect) = get_current_work_area() else {
        hide_snap_overlay();
        return Ok(get_snap_overlay_state_snapshot());
    };
    let hwnd = hwnd_val as HWND;
    if unsafe { !is_snappable_app_window(hwnd) } {
        unsafe { advance_or_finish_snap_assist() };
        return Ok(get_snap_overlay_state_snapshot());
    }
    if let Ok(mut lock) = CENTER_SNAP_LAYOUT.lock() {
        if let Some(ref mut layout) = *lock {
            if zone_index < layout.zones.len() {
                layout.zones[zone_index] = Some(hwnd_val);
            }
        }
    }
    unsafe {
        if let Some(layout) = CENTER_SNAP_LAYOUT.lock().ok().and_then(|l| l.clone()) {
            let constraints = collect_layout_constraints(&layout);
            let rects = layout.compute_zone_rects(rect_to_int(work_rect), &constraints);
            if let Some(&target_int) = rects.get(zone_index) {
                let target_rect = int_to_rect(target_int);
                fit_window_to_visible_rect_ex(hwnd, target_rect, true, true);
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(35));
                    let h = hwnd_val as HWND;
                    if IsWindow(h) != 0 {
                        observe_window_min_size_if_clamped(h, target_rect);
                        apply_active_layout_windows(work_rect, None);
                    }
                });
            }
        }
        apply_active_layout_windows(work_rect, Some(hwnd_val));
        advance_or_finish_snap_assist();
    }
    Ok(get_snap_overlay_state_snapshot())
}
