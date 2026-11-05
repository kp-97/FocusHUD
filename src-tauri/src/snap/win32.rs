use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::Ordering;

use windows_sys::Win32::Foundation::{BOOL, CloseHandle, HWND, LPARAM, POINT, RECT};
use windows_sys::Win32::Graphics::Dwm::{
    DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS, DwmGetWindowAttribute,
};
use windows_sys::Win32::Graphics::Gdi::{
    MONITOR_DEFAULTTONULL, MONITOR_DEFAULTTOPRIMARY, MonitorFromPoint, MonitorFromWindow,
};
use windows_sys::Win32::System::Threading::{
    OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GA_ROOT, GA_ROOTOWNER, GWL_EXSTYLE, GWL_STYLE, GetAncestor, GetClassNameW,
    GetWindowLongW, GetWindowRect, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    HWND_TOP, IsIconic, IsWindow, IsWindowVisible, IsZoomed, SW_RESTORE, SWP_ASYNCWINDOWPOS,
    SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER, SetWindowPos, ShowWindowAsync, WS_CAPTION,
    WS_CHILD, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_THICKFRAME,
};

use super::{IntRect, LAST_ACTIVE_APP_HWND, SnapCandidateWindow, WindowMinMax};
use crate::dock::{LEFT_DOCK_HWND, MAIN_HWND, RIGHT_DOCK_HWND, SNAP_OVERLAY_HWND};
use crate::monitor::get_primary_monitor_rects;

type DwmPadding = (i32, i32, i32, i32);

static PID_WEBVIEW_CACHE: Mutex<Option<HashMap<u32, bool>>> = Mutex::new(None);
static OBSERVED_MIN_MAX_CACHE: Mutex<Option<HashMap<isize, WindowMinMax>>> = Mutex::new(None);
static DWM_PADDING_CACHE: Mutex<Option<HashMap<isize, DwmPadding>>> = Mutex::new(None);
static LAST_TARGET_RECT_CACHE: Mutex<Option<HashMap<isize, RECT>>> = Mutex::new(None);

pub fn rect_to_int(r: RECT) -> IntRect {
    IntRect::new(r.left, r.top, r.right, r.bottom)
}

pub fn int_to_rect(r: IntRect) -> RECT {
    RECT {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
    }
}

unsafe fn query_dwm_frame_padding_uncached(hwnd: HWND) -> DwmPadding {
    let mut win_rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    if unsafe { GetWindowRect(hwnd, &mut win_rect) } == 0 {
        return (0, 0, 0, 0);
    }
    let mut frame_rect = win_rect;
    let hr = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS as u32,
            &mut frame_rect as *mut _ as *mut _,
            std::mem::size_of::<RECT>() as u32,
        )
    };
    if hr == 0 {
        (
            (frame_rect.left - win_rect.left).clamp(0, 32),
            (frame_rect.top - win_rect.top).clamp(0, 32),
            (win_rect.right - frame_rect.right).clamp(0, 32),
            (win_rect.bottom - frame_rect.bottom).clamp(0, 32),
        )
    } else {
        (0, 0, 0, 0)
    }
}

pub unsafe fn get_dwm_frame_padding(hwnd: HWND) -> DwmPadding {
    let key = hwnd as isize;
    if let Ok(lock) = DWM_PADDING_CACHE.lock() {
        if let Some(&cached) = lock.as_ref().and_then(|m| m.get(&key)) {
            return cached;
        }
    }
    let padding = unsafe { query_dwm_frame_padding_uncached(hwnd) };
    if let Ok(mut lock) = DWM_PADDING_CACHE.lock() {
        let map = lock.get_or_insert_with(HashMap::new);
        if map.len() > 256 {
            map.clear();
        }
        map.insert(key, padding);
    }
    padding
}

pub unsafe fn get_visible_window_rect(hwnd: HWND) -> Option<RECT> {
    let mut win_rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    if unsafe { GetWindowRect(hwnd, &mut win_rect) } == 0 {
        return None;
    }
    let mut frame_rect = win_rect;
    let hr = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS as u32,
            &mut frame_rect as *mut _ as *mut _,
            std::mem::size_of::<RECT>() as u32,
        )
    };
    Some(if hr == 0 { frame_rect } else { win_rect })
}

/// Fast-path visible rect query using `GetWindowRect` + cached DWM padding.
/// Avoids cross-process `DwmGetWindowAttribute` RPC and DWM composition frame lag.
pub unsafe fn get_visible_window_rect_fast(hwnd: HWND) -> Option<RECT> {
    let mut win_rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    if unsafe { GetWindowRect(hwnd, &mut win_rect) } == 0 {
        return None;
    }
    let (pad_l, pad_t, pad_r, pad_b) = unsafe { get_dwm_frame_padding(hwnd) };
    Some(RECT {
        left: win_rect.left + pad_l,
        top: win_rect.top + pad_t,
        right: win_rect.right - pad_r,
        bottom: win_rect.bottom - pad_b,
    })
}

/// Returns cached min/max constraints for `hwnd` without sending blocking cross-process
/// `WM_GETMINMAXINFO` messages. Windows enforces a window's `WM_GETMINMAXINFO` natively
/// on its own thread during `SetWindowPos`, and any observed minimum clamp is recorded
/// in `OBSERVED_MIN_MAX_CACHE`.
pub unsafe fn get_window_min_max_constraints(hwnd: HWND) -> WindowMinMax {
    let mut result = WindowMinMax::default();
    if hwnd.is_null() {
        return result;
    }
    let key = hwnd as isize;
    if let Ok(lock) = OBSERVED_MIN_MAX_CACHE.lock() {
        if let Some(obs) = lock.as_ref().and_then(|m| m.get(&key)) {
            result.min_width = result.min_width.max(obs.min_width);
            result.min_height = result.min_height.max(obs.min_height);
            result.max_width = result.max_width.min(obs.max_width).max(result.min_width);
            result.max_height = result.max_height.min(obs.max_height).max(result.min_height);
        }
    }
    result
}

/// Refreshes cached DWM frame padding and clears target rect deduplication for `hwnd`.
/// Completely non-blocking (never sends cross-process messages).
pub unsafe fn refresh_window_metrics_cache(hwnd: HWND) {
    if hwnd.is_null() || unsafe { IsWindow(hwnd) } == 0 {
        return;
    }
    let key = hwnd as isize;
    let padding = unsafe { query_dwm_frame_padding_uncached(hwnd) };
    if let Ok(mut lock) = DWM_PADDING_CACHE.lock() {
        lock.get_or_insert_with(HashMap::new).insert(key, padding);
    }
    if let Ok(mut lock) = LAST_TARGET_RECT_CACHE.lock() {
        if let Some(map) = lock.as_mut() {
            map.remove(&key);
        }
    }
}

unsafe fn compute_outer_window_rect_cached(
    hwnd: HWND,
    target: RECT,
    force: bool,
) -> Option<(i32, i32, i32, i32)> {
    if hwnd.is_null() || unsafe { IsWindow(hwnd) } == 0 {
        return None;
    }
    let c = unsafe { get_window_min_max_constraints(hwnd) };
    let req_w = (target.right - target.left).clamp(c.min_width, c.max_width);
    let req_h = (target.bottom - target.top).clamp(c.min_height, c.max_height);
    let (pad_l, pad_t, pad_r, pad_b) = unsafe { get_dwm_frame_padding(hwnd) };

    let (x, y) = (target.left - pad_l, target.top - pad_t);
    let (cx, cy) = (req_w + pad_l + pad_r, req_h + pad_t + pad_b);
    let desired_win_rect = RECT {
        left: x,
        top: y,
        right: x + cx,
        bottom: y + cy,
    };

    let key = hwnd as isize;
    if let Ok(mut lock) = LAST_TARGET_RECT_CACHE.lock() {
        let map = lock.get_or_insert_with(HashMap::new);
        if !force {
            if let Some(&prev) = map.get(&key) {
                if prev.left == desired_win_rect.left
                    && prev.top == desired_win_rect.top
                    && prev.right == desired_win_rect.right
                    && prev.bottom == desired_win_rect.bottom
                {
                    return None;
                }
            }
        }
        if map.len() > 256 {
            map.clear();
        }
        map.insert(key, desired_win_rect);
    }
    Some((x, y, cx, cy))
}

/// Non-blocking multi-window resize using `SWP_ASYNCWINDOWPOS` (and without `SWP_FRAMECHANGED`).
/// Never blocks on external application message queues.
pub unsafe fn fit_windows_batch_fast(targets: &[(HWND, RECT)]) {
    let flags = SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_ASYNCWINDOWPOS;
    for &(hwnd, target) in targets {
        if let Some((x, y, cx, cy)) =
            unsafe { compute_outer_window_rect_cached(hwnd, target, false) }
        {
            unsafe {
                SetWindowPos(hwnd, std::ptr::null_mut(), x, y, cx, cy, flags);
            }
        }
    }
}

/// Ultra-fast single-window live resize path.
pub unsafe fn fit_window_to_visible_rect_fast(hwnd: HWND, target: RECT) {
    unsafe { fit_windows_batch_fast(&[(hwnd, target)]) };
}

pub unsafe fn fit_window_to_visible_rect_ex(
    hwnd: HWND,
    target: RECT,
    force_apply: bool,
    activate: bool,
) {
    unsafe {
        if !is_snappable_app_window(hwnd) {
            return;
        }
        LAST_ACTIVE_APP_HWND.store(hwnd as isize, Ordering::Relaxed);
        if IsZoomed(hwnd) != 0 {
            let _ = ShowWindowAsync(hwnd, SW_RESTORE);
        }
        if force_apply {
            refresh_window_metrics_cache(hwnd);
        }

        let Some((x, y, cx, cy)) = compute_outer_window_rect_cached(hwnd, target, force_apply)
        else {
            return;
        };

        let mut flags = SWP_NOOWNERZORDER | SWP_ASYNCWINDOWPOS;
        if !activate {
            flags |= SWP_NOZORDER | SWP_NOACTIVATE;
        }

        SetWindowPos(
            hwnd,
            if activate {
                HWND_TOP
            } else {
                std::ptr::null_mut()
            },
            x,
            y,
            cx,
            cy,
            flags,
        );
    }
}

/// Records observed minimum window dimensions if an external app clamped its width/height.
pub unsafe fn observe_window_min_size_if_clamped(hwnd: HWND, requested: RECT) {
    if let Some(actual) = unsafe { get_visible_window_rect_fast(hwnd) } {
        let (aw, ah) = (actual.right - actual.left, actual.bottom - actual.top);
        let (req_w, req_h) = (
            requested.right - requested.left,
            requested.bottom - requested.top,
        );
        if aw > req_w + 6 || ah > req_h + 6 {
            if let Ok(mut lock) = OBSERVED_MIN_MAX_CACHE.lock() {
                let entry = lock
                    .get_or_insert_with(HashMap::new)
                    .entry(hwnd as isize)
                    .or_default();
                if aw > req_w + 6 {
                    entry.min_width = entry.min_width.max(aw.min(2400));
                }
                if ah > req_h + 6 {
                    entry.min_height = entry.min_height.max(ah.min(1600));
                }
            }
        }
    }
}

pub unsafe fn fit_window_to_visible_rect(hwnd: HWND, target: RECT) {
    unsafe { fit_window_to_visible_rect_ex(hwnd, target, false, false) };
}

pub unsafe fn is_window_on_primary_monitor(hwnd: HWND) -> bool {
    unsafe {
        let hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONULL);
        !hmon.is_null() && hmon == MonitorFromPoint(POINT { x: 0, y: 0 }, MONITOR_DEFAULTTOPRIMARY)
    }
}

unsafe fn query_process_exe_path(pid: u32) -> Option<String> {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return None;
        }
        let mut buf = [0u16; 260];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
        CloseHandle(handle);
        (ok != 0 && size > 0).then(|| String::from_utf16_lossy(&buf[..size as usize]))
    }
}

pub unsafe fn is_webview_or_own_process(pid: u32) -> bool {
    if pid == std::process::id() {
        return true;
    }
    if let Ok(mut lock) = PID_WEBVIEW_CACHE.lock() {
        let cache = lock.get_or_insert_with(HashMap::new);
        if let Some(&cached) = cache.get(&pid) {
            return cached;
        }
        let is_own = unsafe { query_process_exe_path(pid) }
            .map(|p| {
                let lower = p.to_lowercase();
                lower.ends_with("msedgewebview2.exe")
                    || lower.ends_with("tauri-app.exe")
                    || lower.ends_with("focushud.exe")
            })
            .unwrap_or(false);
        if cache.len() > 512 {
            cache.clear();
        }
        cache.insert(pid, is_own);
        is_own
    } else {
        false
    }
}

fn is_own_hwnd(h_val: isize) -> bool {
    h_val != 0
        && (h_val == LEFT_DOCK_HWND.load(Ordering::Relaxed)
            || h_val == RIGHT_DOCK_HWND.load(Ordering::Relaxed)
            || h_val == MAIN_HWND.load(Ordering::Relaxed)
            || h_val == SNAP_OVERLAY_HWND.load(Ordering::Relaxed))
}

pub unsafe fn is_snappable_app_window(hwnd: HWND) -> bool {
    if hwnd.is_null() || is_own_hwnd(hwnd as isize) {
        return false;
    }
    unsafe {
        if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
            return false;
        }
        let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
        if (style & WS_CHILD) != 0 || (style & (WS_CAPTION | WS_THICKFRAME)) == 0 {
            return false;
        }
        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        if (ex_style & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE)) != 0 {
            return false;
        }
        let root = GetAncestor(hwnd, GA_ROOT);
        if !root.is_null() && is_own_hwnd(root as isize) {
            return false;
        }
        let owner = GetAncestor(hwnd, GA_ROOTOWNER);
        if !owner.is_null() && (is_own_hwnd(owner as isize) || owner != hwnd) {
            return false;
        }
        if GetWindowTextLengthW(hwnd) == 0 {
            return false;
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if is_webview_or_own_process(pid) {
            return false;
        }
        let mut cloaked: u32 = 0;
        let _ = DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED as u32,
            &mut cloaked as *mut _ as *mut _,
            std::mem::size_of::<u32>() as u32,
        );
        if cloaked != 0 {
            return false;
        }
        let mut class_buf = [0u16; 128];
        let len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32);
        if len > 0 {
            let class_name = String::from_utf16_lossy(&class_buf[..len as usize]);
            if class_name.starts_with("Chrome_RenderWidgetHost")
                || matches!(
                    class_name.as_str(),
                    "Intermediate D3D Window"
                        | "Progman"
                        | "WorkerW"
                        | "Shell_TrayWnd"
                        | "Shell_SecondaryTrayWnd"
                        | "NotifyIconOverflowWindow"
                        | "Windows.UI.Core.CoreWindow"
                        | "XamlExplorerHostIslandWindow"
                )
            {
                return false;
            }
        }
        if !is_window_on_primary_monitor(hwnd) {
            return false;
        }
        if IsZoomed(hwnd) == 0 {
            if let Some(vis) = get_visible_window_rect(hwnd) {
                let (rc_mon, _) = get_primary_monitor_rects();
                if vis.left <= rc_mon.left
                    && vis.top <= rc_mon.top
                    && vis.right >= rc_mon.right
                    && vis.bottom >= rc_mon.bottom
                {
                    return false;
                }
            }
        }
    }
    true
}

pub unsafe fn enumerate_snap_assist_candidates(
    exclude_hwnds: &[isize],
) -> Vec<SnapCandidateWindow> {
    struct EnumCtx {
        exclude: Vec<isize>,
        results: Vec<SnapCandidateWindow>,
    }

    unsafe extern "system" fn enum_cb(hwnd: HWND, lparam: LPARAM) -> BOOL {
        unsafe {
            let ctx = &mut *(lparam as *mut EnumCtx);
            let h_val = hwnd as isize;
            if ctx.exclude.contains(&h_val) || !is_snappable_app_window(hwnd) {
                return 1;
            }
            let len = GetWindowTextLengthW(hwnd);
            if len <= 0 {
                return 1;
            }
            let mut buf = vec![0u16; (len as usize) + 2];
            let read_len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            let title = String::from_utf16_lossy(&buf[..read_len.max(0) as usize])
                .trim()
                .to_string();
            if title.is_empty() {
                return 1;
            }
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let exe_name = query_process_exe_path(pid)
                .and_then(|p| p.rsplit(['\\', '/']).next().map(str::to_string))
                .unwrap_or_else(|| "app.exe".to_string());
            let stem = exe_name.strip_suffix(".exe").unwrap_or(&exe_name);
            let app_name = match stem.to_lowercase().as_str() {
                "code" => "VS Code".to_string(),
                "chrome" => "Google Chrome".to_string(),
                "msedge" => "Microsoft Edge".to_string(),
                "firefox" => "Firefox".to_string(),
                "explorer" => "File Explorer".to_string(),
                "notepad" => "Notepad".to_string(),
                "windowsterminal" | "wt" => "Windows Terminal".to_string(),
                _ => {
                    let mut chars = stem.chars();
                    chars
                        .next()
                        .map(|f| f.to_uppercase().collect::<String>() + chars.as_str())
                        .unwrap_or_else(|| "App".to_string())
                }
            };
            ctx.results.push(SnapCandidateWindow {
                hwnd: h_val,
                title,
                app_name,
                exe_name,
            });
        }
        1
    }

    let mut ctx = EnumCtx {
        exclude: exclude_hwnds.to_vec(),
        results: Vec::new(),
    };
    unsafe { EnumWindows(Some(enum_cb), &mut ctx as *mut _ as LPARAM) };
    ctx.results
}
