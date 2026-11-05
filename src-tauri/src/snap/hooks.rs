use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use windows_sys::Win32::Foundation::{BOOL, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM};
use windows_sys::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, SendInput,
    VK_CONTROL, VK_LBUTTON, VK_LEFT, VK_LWIN, VK_MENU, VK_RIGHT, VK_RWIN, VK_SHIFT, VK_UP,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, EVENT_SYSTEM_MOVESIZEEND, EVENT_SYSTEM_MOVESIZESTART,
    EnumWindows, GWL_EXSTYLE, GetCursorPos, GetForegroundWindow, GetMessageW, GetWindowLongW,
    HHOOK, HWND_TOPMOST, IsIconic, IsWindow, IsWindowVisible, IsZoomed, KBDLLHOOKSTRUCT, MSG,
    SW_HIDE, SW_SHOWNA, SWP_ASYNCWINDOWPOS, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_SHOWWINDOW,
    SetWindowLongW, SetWindowPos, SetWindowsHookExW, ShowWindowAsync, TranslateMessage,
    WH_KEYBOARD_LL, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS, WM_KEYDOWN, WM_SYSKEYDOWN,
    WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT,
};

use super::layout::{
    CenterSnapLayoutState, LogicalRect, SnapLayoutTemplate, WindowMinMax, compute_top_bar_geometry,
    hit_test_top_bar,
};
use super::win32::{
    enumerate_snap_assist_candidates, fit_window_to_visible_rect, fit_window_to_visible_rect_ex,
    fit_windows_batch_fast, get_visible_window_rect, get_visible_window_rect_fast,
    get_window_min_max_constraints, int_to_rect, is_snappable_app_window,
    observe_window_min_size_if_clamped, rect_to_int, refresh_window_metrics_cache,
};
use super::{
    CENTER_SNAP_LAYOUT, LAST_ACTIVE_APP_HWND, OVERLAY_STATE, SnapOverlayMode, SnapOverlayState,
    SnapTargetKind, calculate_snap_rects, evaluate_boundary_drag_snap,
    get_snap_overlay_state_snapshot, is_rect_fitted,
};
use crate::dock::{PANES_RESERVE_ZONES, PRIMARY_SCALE_MILLI, SNAP_OVERLAY_HWND};
use crate::monitor::get_current_work_area;

static SNAP_APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static DRAG_SESSION_ID: AtomicU64 = AtomicU64::new(0);
static DOCK_DRAG_CAPTURED_WINDOWS: Mutex<Vec<(isize, SnapTargetKind)>> = Mutex::new(Vec::new());
static LAST_FAST_REFLOW_INSTANT: Mutex<Option<Instant>> = Mutex::new(None);

#[derive(Clone, Copy, PartialEq, Eq)]
struct OverlayWindowConfig {
    visible: bool,
    interactive: bool,
    left: i32,
    top: i32,
    width: i32,
    height: i32,
}

static LAST_OVERLAY_CONFIG: Mutex<Option<OverlayWindowConfig>> = Mutex::new(None);

#[derive(Clone, Copy, PartialEq, Eq)]
enum DragGestureKind {
    Undetermined,
    WindowMove,
    BorderResize,
}

#[derive(Clone, Copy)]
struct DragStartState {
    session_id: u64,
    hwnd: isize,
    cursor: POINT,
    rect: RECT,
    gesture: DragGestureKind,
}

static ACTIVE_DRAG_START: Mutex<Option<DragStartState>> = Mutex::new(None);

fn get_primary_scale_factor() -> f64 {
    let milli = PRIMARY_SCALE_MILLI.load(Ordering::Relaxed);
    if milli > 100 {
        (milli as f64) / 1000.0
    } else {
        1.0
    }
}

fn collect_layout_constraints(layout: &CenterSnapLayoutState) -> Vec<Option<WindowMinMax>> {
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

unsafe fn refresh_layout_window_caches() {
    if let Some(layout) = CENTER_SNAP_LAYOUT.lock().ok().and_then(|l| l.clone()) {
        for h_val in layout.zones.into_iter().flatten() {
            unsafe { refresh_window_metrics_cache(h_val as HWND) };
        }
    }
}

fn resolve_snap_overlay_hwnd(app: &tauri::AppHandle) -> Option<HWND> {
    let cached = SNAP_OVERLAY_HWND.load(Ordering::Relaxed);
    if cached != 0 {
        return Some(cached as HWND);
    }
    use tauri::Manager;
    let win = app.get_webview_window("snap-overlay")?;
    let hwnd = win.hwnd().ok()?;
    let h = hwnd.0 as HWND;
    SNAP_OVERLAY_HWND.store(h as isize, Ordering::Relaxed);
    Some(h)
}

unsafe fn configure_and_sync_snap_overlay_window(state: &SnapOverlayState) {
    let Some(app) = SNAP_APP_HANDLE.get() else {
        return;
    };
    use tauri::Emitter;
    let _ = app.emit_to("snap-overlay", "snap-overlay-state", state);

    let Some(h) = resolve_snap_overlay_hwnd(app) else {
        return;
    };

    if state.mode == SnapOverlayMode::Hidden {
        let should_hide = if let Ok(mut lock) = LAST_OVERLAY_CONFIG.lock() {
            let was_vis = lock.map(|c| c.visible).unwrap_or(true);
            if let Some(ref mut cfg) = *lock {
                cfg.visible = false;
            }
            was_vis
        } else {
            true
        };
        if should_hide {
            unsafe {
                let _ = ShowWindowAsync(h, SW_HIDE);
            }
        }
        return;
    }

    let Some(work_rect) = get_current_work_area() else {
        return;
    };
    let (w, hgt) = (
        (work_rect.right - work_rect.left).max(200),
        (work_rect.bottom - work_rect.top).max(200),
    );
    let interactive = matches!(state.mode, SnapOverlayMode::Assist);
    let desired = OverlayWindowConfig {
        visible: true,
        interactive,
        left: work_rect.left,
        top: work_rect.top,
        width: w,
        height: hgt,
    };

    if let Ok(mut lock) = LAST_OVERLAY_CONFIG.lock() {
        if *lock == Some(desired) {
            return;
        }
        *lock = Some(desired);
    }

    unsafe {
        let mut ex_style = (GetWindowLongW(h, GWL_EXSTYLE) as u32)
            | WS_EX_LAYERED
            | WS_EX_TOOLWINDOW
            | WS_EX_TOPMOST;
        if !interactive {
            ex_style |= WS_EX_TRANSPARENT | WS_EX_NOACTIVATE;
        } else {
            ex_style &= !(WS_EX_TRANSPARENT | WS_EX_NOACTIVATE);
        }
        SetWindowLongW(h, GWL_EXSTYLE, ex_style as i32);
        SetWindowPos(
            h,
            HWND_TOPMOST,
            work_rect.left,
            work_rect.top,
            w,
            hgt,
            SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_SHOWWINDOW | SWP_ASYNCWINDOWPOS,
        );
        let _ = ShowWindowAsync(h, SW_SHOWNA);
    }
}

fn update_and_broadcast_overlay_state(new_state: SnapOverlayState) {
    let changed = if let Ok(mut lock) = OVERLAY_STATE.lock() {
        let diff = lock.as_ref() != Some(&new_state);
        *lock = Some(new_state.clone());
        diff
    } else {
        true
    };
    if changed {
        unsafe { configure_and_sync_snap_overlay_window(&new_state) };
    }
}

pub fn hide_snap_overlay() {
    let scale = get_primary_scale_factor();
    let wr = get_current_work_area().unwrap_or(RECT {
        left: 280,
        top: 0,
        right: 1640,
        bottom: 900,
    });
    let w_log = ((wr.right - wr.left).max(360) as f64) / scale;
    let h_log = ((wr.bottom - wr.top).max(240) as f64) / scale;
    update_and_broadcast_overlay_state(SnapOverlayState::with_bar(
        SnapOverlayMode::Hidden,
        w_log,
        h_log,
    ));
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

fn detect_initial_gesture(cursor: POINT, rect: RECT, was_zoomed: bool) -> DragGestureKind {
    if was_zoomed {
        return DragGestureKind::WindowMove;
    }
    if (cursor.x - rect.left).abs() <= 10
        || (cursor.x - rect.right).abs() <= 10
        || (cursor.y - rect.bottom).abs() <= 10
        || (cursor.y - rect.top).abs() <= 6
    {
        return DragGestureKind::Undetermined;
    }
    DragGestureKind::WindowMove
}

unsafe fn handle_live_coupled_border_resize(
    hwnd: HWND,
    current_vis: RECT,
    start_rect: RECT,
    work_rect: RECT,
    include_dragged: bool,
) {
    let h_val = hwnd as isize;
    let Some((mut layout, zone_idx)) = CENTER_SNAP_LAYOUT.lock().ok().and_then(|l| {
        let layout = l.as_ref()?;
        let idx = layout.zones.iter().position(|&z| z == Some(h_val))?;
        Some((layout.clone(), idx))
    }) else {
        return;
    };

    let constraints = collect_layout_constraints(&layout);
    let work_int = rect_to_int(work_rect);
    if layout.update_split_from_border_drag(
        zone_idx,
        rect_to_int(current_vis),
        rect_to_int(start_rect),
        work_int,
        &constraints,
    ) {
        let zone_rects = layout.compute_zone_rects(work_int, &constraints);
        if let Ok(mut lock) = CENTER_SNAP_LAYOUT.lock() {
            *lock = Some(layout.clone());
        }
        let mut batch: Vec<(HWND, RECT)> = Vec::with_capacity(layout.zones.len());
        for (idx, opt_other) in layout.zones.iter().enumerate() {
            let (Some(other_val), Some(&zr)) = (*opt_other, zone_rects.get(idx)) else {
                continue;
            };
            if other_val != h_val
                || (include_dragged && !is_rect_fitted(current_vis, int_to_rect(zr), 4))
            {
                batch.push((other_val as HWND, int_to_rect(zr)));
            }
        }
        if !batch.is_empty() {
            unsafe { fit_windows_batch_fast(&batch) };
        }
    }
}

unsafe fn poll_active_drag_tick(session_id: u64) {
    let Some(mut start) = ACTIVE_DRAG_START
        .lock()
        .ok()
        .and_then(|l| *l)
        .filter(|s| s.session_id == session_id)
    else {
        return;
    };
    let hwnd = start.hwnd as HWND;
    if unsafe { IsWindow(hwnd) } == 0 {
        return;
    }
    let (Some(work_rect), Some(vis)) = (get_current_work_area(), unsafe {
        get_visible_window_rect_fast(hwnd)
    }) else {
        return;
    };
    let mut pt = POINT { x: 0, y: 0 };
    unsafe { GetCursorPos(&mut pt) };

    if start.gesture == DragGestureKind::Undetermined {
        let w_diff = ((vis.right - vis.left) - (start.rect.right - start.rect.left)).abs() > 4;
        let h_diff = ((vis.bottom - vis.top) - (start.rect.bottom - start.rect.top)).abs() > 4;
        if !w_diff
            && !h_diff
            && (pt.x - start.cursor.x).abs() < 6
            && (pt.y - start.cursor.y).abs() < 6
        {
            return;
        }
        let l_fix = (vis.left - start.rect.left).abs() <= 3;
        let r_fix = (vis.right - start.rect.right).abs() <= 3;
        let t_fix = (vis.top - start.rect.top).abs() <= 3;
        let b_fix = (vis.bottom - start.rect.bottom).abs() <= 3;
        start.gesture = if (w_diff && (l_fix ^ r_fix)) || (h_diff && (t_fix ^ b_fix)) {
            DragGestureKind::BorderResize
        } else {
            DragGestureKind::WindowMove
        };
        if let Ok(mut lock) = ACTIVE_DRAG_START.lock() {
            if let Some(ref mut s) = *lock {
                if s.session_id == session_id {
                    s.gesture = start.gesture;
                }
            }
        }
    }

    if start.gesture == DragGestureKind::BorderResize {
        unsafe { handle_live_coupled_border_resize(hwnd, vis, start.rect, work_rect, false) };
        return;
    }

    let scale = get_primary_scale_factor();
    let work_int = rect_to_int(work_rect);
    let (w_log, h_log) = (
        (work_int.width() as f64) / scale,
        (work_int.height() as f64) / scale,
    );
    let (cx_log, cy_log) = (
        ((pt.x - work_rect.left) as f64) / scale,
        ((pt.y - work_rect.top) as f64) / scale,
    );

    let was_expanded = get_snap_overlay_state_snapshot().mode == SnapOverlayMode::Expanded;
    let top_bar = compute_top_bar_geometry(w_log);
    let (is_expanded, bar_hit) = hit_test_top_bar(&top_bar, cx_log, cy_log, was_expanded);

    if is_expanded {
        let mut state = SnapOverlayState::with_bar(SnapOverlayMode::Expanded, w_log, h_log);
        if let Some((tpl, z_idx)) = bar_hit {
            state.hovered_template = Some(tpl);
            state.hovered_zone_index = Some(z_idx);
            state.preview_rect = CenterSnapLayoutState::new(tpl)
                .compute_zone_rects(work_int, &[])
                .get(z_idx)
                .map(|zr| zr.to_logical(work_rect.left, work_rect.top, scale));
        }
        update_and_broadcast_overlay_state(state);
        return;
    }

    let mut state = SnapOverlayState::with_bar(SnapOverlayMode::Pill, w_log, h_log);
    let (lh, rh) = calculate_snap_rects(work_rect);
    match evaluate_boundary_drag_snap(pt, Some(start.cursor), work_rect) {
        Some(SnapTargetKind::LeftHalf) => {
            state.hovered_template = Some(SnapLayoutTemplate::Split50_50);
            state.hovered_zone_index = Some(0);
            state.preview_rect =
                Some(rect_to_int(lh).to_logical(work_rect.left, work_rect.top, scale));
        }
        Some(SnapTargetKind::RightHalf) => {
            state.hovered_template = Some(SnapLayoutTemplate::Split50_50);
            state.hovered_zone_index = Some(1);
            state.preview_rect =
                Some(rect_to_int(rh).to_logical(work_rect.left, work_rect.top, scale));
        }
        Some(SnapTargetKind::Full) => {
            state.hovered_template = Some(SnapLayoutTemplate::SingleFull);
            state.hovered_zone_index = Some(0);
            state.preview_rect = Some(work_int.to_logical(work_rect.left, work_rect.top, scale));
        }
        None => {}
    }
    update_and_broadcast_overlay_state(state);
}

unsafe fn finalize_drag_session(start: DragStartState) {
    let hwnd = start.hwnd as HWND;
    let Some(work_rect) = get_current_work_area() else {
        hide_snap_overlay();
        return;
    };
    if start.gesture == DragGestureKind::BorderResize {
        if let Some(vis) = unsafe { get_visible_window_rect_fast(hwnd) } {
            unsafe { handle_live_coupled_border_resize(hwnd, vis, start.rect, work_rect, true) };
        }
        return;
    }

    let mut pt = POINT { x: 0, y: 0 };
    unsafe { GetCursorPos(&mut pt) };
    if (pt.x - start.cursor.x).abs() < 8 && (pt.y - start.cursor.y).abs() < 8 {
        hide_snap_overlay();
        return;
    }

    let snap_state = get_snap_overlay_state_snapshot();
    if snap_state.mode == SnapOverlayMode::Expanded {
        let scale = get_primary_scale_factor();
        let (_, hit) = hit_test_top_bar(
            &snap_state.top_bar,
            ((pt.x - work_rect.left) as f64) / scale,
            ((pt.y - work_rect.top) as f64) / scale,
            true,
        );
        if let Some((tpl, z_idx)) = hit.or(snap_state
            .hovered_template
            .zip(snap_state.hovered_zone_index))
        {
            unsafe { apply_snap_selection(hwnd, tpl, z_idx) };
            return;
        }
    }

    if let Some(edge_kind) = evaluate_boundary_drag_snap(pt, Some(start.cursor), work_rect) {
        let (tpl, z_idx) = match edge_kind {
            SnapTargetKind::LeftHalf => (SnapLayoutTemplate::Split50_50, 0),
            SnapTargetKind::RightHalf => (SnapLayoutTemplate::Split50_50, 1),
            SnapTargetKind::Full => (SnapLayoutTemplate::SingleFull, 0),
        };
        unsafe { apply_snap_selection(hwnd, tpl, z_idx) };
        return;
    }

    if let Ok(mut lock) = CENTER_SNAP_LAYOUT.lock() {
        if let Some(ref mut layout) = *lock {
            for slot in &mut layout.zones {
                if *slot == Some(start.hwnd) {
                    *slot = None;
                }
            }
        }
    }
    hide_snap_overlay();
}

pub unsafe extern "system" fn win_event_hook_proc(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    id_object: i32,
    _id_child: i32,
    _thread: u32,
    _time: u32,
) {
    if id_object != 0
        || hwnd.is_null()
        || crate::dock::FULLSCREEN_ACTIVE.load(Ordering::Relaxed)
        || !PANES_RESERVE_ZONES.load(Ordering::Relaxed)
    {
        return;
    }
    unsafe {
        if !is_snappable_app_window(hwnd) {
            return;
        }
        LAST_ACTIVE_APP_HWND.store(hwnd as isize, Ordering::Relaxed);

        if event == EVENT_SYSTEM_MOVESIZESTART {
            refresh_window_metrics_cache(hwnd);
            refresh_layout_window_caches();

            let mut pt = POINT { x: 0, y: 0 };
            let _ = GetCursorPos(&mut pt);
            let Some(vis) = get_visible_window_rect(hwnd) else {
                return;
            };
            let gesture = detect_initial_gesture(pt, vis, IsZoomed(hwnd) != 0);
            let session_id = DRAG_SESSION_ID.fetch_add(1, Ordering::SeqCst) + 1;
            if let Ok(mut lock) = ACTIVE_DRAG_START.lock() {
                *lock = Some(DragStartState {
                    session_id,
                    hwnd: hwnd as isize,
                    cursor: pt,
                    rect: vis,
                    gesture,
                });
            }

            std::thread::spawn(move || {
                let mut up_ticks = 0;
                while DRAG_SESSION_ID.load(Ordering::SeqCst) == session_id {
                    if (GetAsyncKeyState(VK_LBUTTON as i32) as u16 & 0x8000) == 0 {
                        up_ticks += 1;
                        // Fallback only if EVENT_SYSTEM_MOVESIZEEND was not emitted by custom frame after ~180ms
                        if up_ticks >= 15 {
                            let taken = ACTIVE_DRAG_START.lock().ok().and_then(|mut l| {
                                (l.as_ref().map(|s| s.session_id) == Some(session_id))
                                    .then(|| l.take())
                                    .flatten()
                            });
                            if let Some(s) = taken {
                                DRAG_SESSION_ID.fetch_add(1, Ordering::SeqCst);
                                finalize_drag_session(s);
                            }
                            break;
                        }
                    } else {
                        up_ticks = 0;
                        poll_active_drag_tick(session_id);
                    }
                    std::thread::sleep(Duration::from_millis(12));
                }
            });
        } else if event == EVENT_SYSTEM_MOVESIZEEND {
            DRAG_SESSION_ID.fetch_add(1, Ordering::SeqCst);
            let start = ACTIVE_DRAG_START
                .lock()
                .ok()
                .and_then(|mut l| l.take())
                .filter(|s| s.hwnd == hwnd as isize);
            if let Some(s) = start {
                finalize_drag_session(s);
            } else {
                hide_snap_overlay();
            }
        }
    }
}

unsafe fn suppress_start_menu_on_win_release() {
    let make = |flags: u32| INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: 0xFF,
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let inputs = [make(0), make(KEYEVENTF_KEYUP)];
    unsafe { SendInput(2, inputs.as_ptr(), std::mem::size_of::<INPUT>() as i32) };
}

unsafe extern "system" fn keyboard_ll_hook_proc(
    n_code: i32,
    w_param: WPARAM,
    l_param: LPARAM,
) -> LRESULT {
    if n_code >= 0
        && (w_param == WM_KEYDOWN as usize || w_param == WM_SYSKEYDOWN as usize)
        && PANES_RESERVE_ZONES.load(Ordering::Relaxed)
        && !crate::dock::FULLSCREEN_ACTIVE.load(Ordering::Relaxed)
    {
        unsafe {
            let vk = (*(l_param as *const KBDLLHOOKSTRUCT)).vkCode as u16;
            if matches!(vk, VK_LEFT | VK_RIGHT | VK_UP) {
                let down = |k: u16| (GetAsyncKeyState(k as i32) as u16 & 0x8000) != 0;
                if (down(VK_LWIN) || down(VK_RWIN))
                    && !down(VK_SHIFT)
                    && !down(VK_CONTROL)
                    && !down(VK_MENU)
                {
                    let fg = GetForegroundWindow();
                    let last = LAST_ACTIVE_APP_HWND.load(Ordering::Relaxed) as HWND;
                    let target = if is_snappable_app_window(fg) {
                        Some(fg)
                    } else if is_snappable_app_window(last) {
                        Some(last)
                    } else {
                        None
                    };
                    if let Some(hwnd) = target {
                        let hwnd_val = hwnd as isize;
                        suppress_start_menu_on_win_release();
                        std::thread::spawn(move || {
                            let h = hwnd_val as HWND;
                            let (tpl, idx) = match vk {
                                VK_LEFT => (SnapLayoutTemplate::Split50_50, 0),
                                VK_RIGHT => (SnapLayoutTemplate::Split50_50, 1),
                                _ => (SnapLayoutTemplate::SingleFull, 0),
                            };
                            apply_snap_selection(h, tpl, idx);
                        });
                        return 1;
                    }
                }
            }
        }
    }
    unsafe { CallNextHookEx(std::ptr::null_mut() as HHOOK, n_code, w_param, l_param) }
}

pub unsafe fn init_window_snap_hooks(app: &tauri::AppHandle) {
    let _ = SNAP_APP_HANDLE.set(app.clone());
    unsafe {
        let _ = SetWinEventHook(
            EVENT_SYSTEM_MOVESIZESTART,
            EVENT_SYSTEM_MOVESIZEEND,
            std::ptr::null_mut(),
            Some(win_event_hook_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );
    }
    std::thread::spawn(|| unsafe {
        let _hook = SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(keyboard_ll_hook_proc),
            std::ptr::null_mut(),
            0,
        );
        let mut msg: MSG = std::mem::zeroed();
        while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    });
}
