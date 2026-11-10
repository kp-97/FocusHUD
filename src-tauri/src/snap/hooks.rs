use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use windows_sys::Win32::Foundation::{HWND, POINT, RECT};
use windows_sys::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EVENT_SYSTEM_MOVESIZEEND, EVENT_SYSTEM_MOVESIZESTART, GWL_EXSTYLE, GetCursorPos,
    GetWindowLongW, HWND_TOPMOST, IsWindow, IsZoomed, SW_HIDE, SW_SHOWNA, SWP_ASYNCWINDOWPOS,
    SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_SHOWWINDOW, SetWindowLongW, SetWindowPos,
    ShowWindowAsync, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS, WS_EX_LAYERED,
    WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_EX_TRANSPARENT,
};

use super::layout::{
    CenterSnapLayoutState, SnapLayoutTemplate, compute_top_bar_geometry, hit_test_top_bar,
};
use super::win32::{
    fit_windows_batch_fast, get_visible_window_rect, get_visible_window_rect_fast, int_to_rect,
    is_snappable_app_window, rect_to_int, refresh_window_metrics_cache,
};
use super::{
    CENTER_SNAP_LAYOUT, LAST_ACTIVE_APP_HWND, OVERLAY_STATE, SnapOverlayMode, SnapOverlayState,
    SnapTargetKind, calculate_snap_rects, evaluate_boundary_drag_snap,
    get_snap_overlay_state_snapshot, is_rect_fitted,
};
use crate::dock::{PANES_RESERVE_ZONES, SNAP_OVERLAY_HWND, get_primary_scale_factor};
use crate::monitor::get_current_work_area;

pub use super::assist::*;
pub use super::keyboard::*;
pub use super::reflow::*;

static SNAP_APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();
static DRAG_SESSION_ID: AtomicU64 = AtomicU64::new(0);

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

pub(crate) fn update_and_broadcast_overlay_state(new_state: SnapOverlayState) {
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
    start_keyboard_hook();
}
