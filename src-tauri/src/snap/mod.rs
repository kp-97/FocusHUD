#[cfg(target_os = "windows")]
pub mod hooks;
pub mod layout;
#[cfg(target_os = "windows")]
pub mod win32;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
#[cfg(target_os = "windows")]
use std::sync::atomic::AtomicIsize;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{POINT, RECT};

#[cfg(target_os = "windows")]
pub use hooks::{
    apply_snap_selection, hide_snap_overlay, init_window_snap_hooks, prepare_for_dock_drag,
    reflow_snapped_windows_fast, reflow_snapped_windows_on_boundary_change, win_event_hook_proc,
};
pub use layout::{
    CenterSnapLayoutState, IntRect, LogicalRect, SnapLayoutTemplate, TopBarGeometry,
    TopBarLayoutGroup, WindowMinMax, compute_top_bar_geometry, hit_test_top_bar,
    rect_contains_point,
};
#[cfg(target_os = "windows")]
pub use win32::{
    enumerate_snap_assist_candidates, fit_window_to_visible_rect, get_visible_window_rect,
    get_window_min_max_constraints, is_snappable_app_window, is_webview_or_own_process,
    is_window_on_primary_monitor,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SnapCandidateWindow {
    pub hwnd: isize,
    pub title: String,
    pub app_name: String,
    pub exe_name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapOverlayMode {
    Hidden,
    Pill,
    Expanded,
    Assist,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SnapOverlayState {
    pub mode: SnapOverlayMode,
    pub work_width_logical: f64,
    pub work_height_logical: f64,
    pub top_bar: TopBarGeometry,
    pub hovered_template: Option<SnapLayoutTemplate>,
    pub hovered_zone_index: Option<usize>,
    pub preview_rect: Option<LogicalRect>,
    pub active_template: Option<SnapLayoutTemplate>,
    pub assist_zone_index: Option<usize>,
    pub assist_zone_rect: Option<LogicalRect>,
    pub assist_all_zone_rects: Vec<LogicalRect>,
    pub assist_filled_zones: Vec<bool>,
    pub assist_candidates: Vec<SnapCandidateWindow>,
}

impl SnapOverlayState {
    pub fn with_bar(mode: SnapOverlayMode, w_log: f64, h_log: f64) -> Self {
        Self {
            mode,
            work_width_logical: w_log,
            work_height_logical: h_log,
            top_bar: compute_top_bar_geometry(w_log),
            hovered_template: None,
            hovered_zone_index: None,
            preview_rect: None,
            active_template: None,
            assist_zone_index: None,
            assist_zone_rect: None,
            assist_all_zone_rects: Vec::new(),
            assist_filled_zones: Vec::new(),
            assist_candidates: Vec::new(),
        }
    }
}

impl Default for SnapOverlayState {
    fn default() -> Self {
        Self::with_bar(SnapOverlayMode::Hidden, 1200.0, 900.0)
    }
}

pub(crate) static OVERLAY_STATE: Mutex<Option<SnapOverlayState>> = Mutex::new(None);
pub(crate) static CENTER_SNAP_LAYOUT: Mutex<Option<CenterSnapLayoutState>> = Mutex::new(None);
#[cfg(target_os = "windows")]
pub static LAST_ACTIVE_APP_HWND: AtomicIsize = AtomicIsize::new(0);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapTargetKind {
    Full,
    LeftHalf,
    RightHalf,
}

pub fn get_snap_overlay_state_snapshot() -> SnapOverlayState {
    OVERLAY_STATE
        .lock()
        .ok()
        .and_then(|l| l.clone())
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
pub fn calculate_snap_rects(work_rect: RECT) -> (RECT, RECT) {
    let mid_x = work_rect.left + ((work_rect.right - work_rect.left) / 2);
    (
        RECT {
            left: work_rect.left,
            top: work_rect.top,
            right: mid_x,
            bottom: work_rect.bottom,
        },
        RECT {
            left: mid_x,
            top: work_rect.top,
            right: work_rect.right,
            bottom: work_rect.bottom,
        },
    )
}

#[cfg(target_os = "windows")]
pub fn is_rect_fitted(current: RECT, target: RECT, tolerance: i32) -> bool {
    (current.left - target.left).abs() <= tolerance
        && (current.right - target.right).abs() <= tolerance
        && (current.top - target.top).abs() <= tolerance
        && (current.bottom - target.bottom).abs() <= tolerance
}

#[cfg(target_os = "windows")]
pub fn evaluate_boundary_drag_snap(
    end_cursor: POINT,
    start_cursor: Option<POINT>,
    work_rect: RECT,
) -> Option<SnapTargetKind> {
    if let Some(s) = start_cursor {
        if (end_cursor.x - s.x).abs() < 8 && (end_cursor.y - s.y).abs() < 8 {
            return None;
        }
    }
    if end_cursor.x <= work_rect.left + 64 {
        return Some(SnapTargetKind::LeftHalf);
    }
    if end_cursor.x >= work_rect.right - 64 {
        return Some(SnapTargetKind::RightHalf);
    }
    if end_cursor.y <= work_rect.top + 36
        && end_cursor.x >= work_rect.left - 60
        && end_cursor.x <= work_rect.right + 60
    {
        return Some(SnapTargetKind::Full);
    }
    None
}

pub fn select_snap_assist_window_impl(
    hwnd_val: isize,
    zone_index: usize,
) -> Result<SnapOverlayState, String> {
    #[cfg(target_os = "windows")]
    {
        hooks::select_snap_assist_window_win32(hwnd_val, zone_index)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (hwnd_val, zone_index);
        Ok(get_snap_overlay_state_snapshot())
    }
}

pub fn skip_snap_assist_zone_impl(zone_index: usize) -> Result<SnapOverlayState, String> {
    if let Ok(mut lock) = CENTER_SNAP_LAYOUT.lock() {
        if let Some(ref mut layout) = *lock {
            if zone_index < layout.skipped_zones.len() {
                layout.skipped_zones[zone_index] = true;
            }
        }
    }
    #[cfg(target_os = "windows")]
    unsafe {
        hooks::advance_or_finish_snap_assist();
    }
    Ok(get_snap_overlay_state_snapshot())
}

pub fn dismiss_snap_assist_impl() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    hooks::hide_snap_overlay();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_top_bar_geometry_and_hit_testing() {
        let geom = compute_top_bar_geometry(1920.0);
        assert_eq!(geom.groups.len(), 7);
        assert_eq!(hit_test_top_bar(&geom, 100.0, 300.0, false), (false, None));

        let pill_cx = geom.pill_trigger_rect.x + geom.pill_trigger_rect.width / 2.0;
        assert!(hit_test_top_bar(&geom, pill_cx, 10.0, false).0);

        for group in &geom.groups {
            for (z_idx, z_rect) in group.zones.iter().enumerate() {
                let (cx, cy) = (
                    z_rect.x + z_rect.width / 2.0,
                    z_rect.y + z_rect.height / 2.0,
                );
                assert_eq!(
                    hit_test_top_bar(&geom, cx, cy, true),
                    (true, Some((group.template, z_idx)))
                );
            }
        }
    }

    #[test]
    fn test_center_snap_layout_zones_and_min_max_clamping() {
        let work = IntRect::new(300, 0, 2300, 1200);
        let layout = CenterSnapLayoutState::new(SnapLayoutTemplate::Split50_50);
        let rects = layout.compute_zone_rects(work, &[None, None]);
        assert_eq!(
            (rects[0].left, rects[0].right, rects[1].left, rects[1].right),
            (300, 1300, 1300, 2300)
        );

        let right_min = WindowMinMax {
            min_width: 1400,
            min_height: 200,
            max_width: 16384,
            max_height: 16384,
        };
        let clamped = layout.compute_zone_rects(work, &[None, Some(right_min)]);
        assert_eq!((clamped[0].width(), clamped[1].width()), (600, 1400));
    }

    #[test]
    fn test_coupled_border_drag_updates_split_and_respects_min_width() {
        let work = IntRect::new(300, 0, 2300, 1200);
        let mut layout = CenterSnapLayoutState::new(SnapLayoutTemplate::Split50_50);
        let updated = layout.update_split_from_border_drag(
            0,
            IntRect::new(300, 0, 1600, 1200),
            IntRect::new(300, 0, 1300, 1200),
            work,
            &[None, None],
        );
        assert!(updated);
        let rects = layout.compute_zone_rects(work, &[None, None]);
        assert_eq!((rects[0].right, rects[1].left), (1600, 1600));
    }

    #[test]
    #[cfg(target_os = "windows")]
    fn test_calculate_snap_rects_and_boundary_eval() {
        let work = RECT {
            left: 280,
            top: 0,
            right: 3160,
            bottom: 1356,
        };
        let (lh, rh) = calculate_snap_rects(work);
        assert_eq!(
            (lh.left, lh.right, rh.left, rh.right),
            (280, 1720, 1720, 3160)
        );

        let start = Some(POINT { x: 400, y: 300 });
        assert_eq!(
            evaluate_boundary_drag_snap(POINT { x: 300, y: 310 }, start, work),
            Some(SnapTargetKind::LeftHalf)
        );
        assert_eq!(
            evaluate_boundary_drag_snap(POINT { x: 3120, y: 310 }, start, work),
            Some(SnapTargetKind::RightHalf)
        );
        assert_eq!(
            evaluate_boundary_drag_snap(POINT { x: 1500, y: 12 }, start, work),
            Some(SnapTargetKind::Full)
        );
        assert_eq!(
            evaluate_boundary_drag_snap(POINT { x: 1400, y: 500 }, start, work),
            None
        );
    }
}
