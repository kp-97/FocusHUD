#[cfg(target_os = "windows")]
use std::collections::HashMap;
#[cfg(target_os = "windows")]
use std::sync::Mutex;
#[cfg(target_os = "windows")]
use std::sync::atomic::Ordering;

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{BOOL, CloseHandle, HWND, LPARAM, POINT, RECT};
#[cfg(target_os = "windows")]
use windows_sys::Win32::Graphics::Dwm::{
    DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS, DwmGetWindowAttribute,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Threading::{
    OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION, QueryFullProcessImageNameW,
};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::Accessibility::{HWINEVENTHOOK, SetWinEventHook};
#[cfg(target_os = "windows")]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    EVENT_OBJECT_LOCATIONCHANGE, EVENT_SYSTEM_MOVESIZEEND, GA_ROOT, GA_ROOTOWNER, GWL_EXSTYLE,
    GWL_STYLE, GetAncestor, GetClassNameW, GetCursorPos, GetWindowLongW, GetWindowRect,
    GetWindowThreadProcessId, IsIconic, IsWindowVisible, IsZoomed, SW_RESTORE, SWP_ASYNCWINDOWPOS,
    SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOZORDER, SetWindowPos, ShowWindow,
    WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS, WS_CAPTION, WS_CHILD, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_THICKFRAME,
};

#[cfg(target_os = "windows")]
use crate::dock::{LEFT_DOCK_HWND, RIGHT_DOCK_HWND};
#[cfg(target_os = "windows")]
use crate::monitor::{get_current_work_area, get_original_work_area, get_previous_work_area};

#[cfg(target_os = "windows")]
static PID_WEBVIEW_CACHE: Mutex<Option<HashMap<u32, bool>>> = Mutex::new(None);

#[cfg(target_os = "windows")]
pub unsafe fn is_webview_or_own_process(pid: u32) -> bool {
    if pid == std::process::id() {
        return true;
    }

    if let Ok(mut lock) = PID_WEBVIEW_CACHE.lock() {
        let cache = lock.get_or_insert_with(HashMap::new);
        if let Some(&is_own) = cache.get(&pid) {
            return is_own;
        }

        let is_own = unsafe { check_pid_is_webview_or_own(pid) };
        if cache.len() > 512 {
            cache.clear();
        }
        cache.insert(pid, is_own);
        is_own
    } else {
        unsafe { check_pid_is_webview_or_own(pid) }
    }
}

#[cfg(target_os = "windows")]
unsafe fn check_pid_is_webview_or_own(pid: u32) -> bool {
    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            return false;
        }
        let mut buf = [0u16; 260];
        let mut size = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(handle, 0, buf.as_mut_ptr(), &mut size);
        CloseHandle(handle);
        if ok != 0 && size > 0 {
            let path = String::from_utf16_lossy(&buf[..size as usize]).to_lowercase();
            if path.ends_with("msedgewebview2.exe")
                || path.ends_with("tauri-app.exe")
                || path.ends_with("focushud.exe")
            {
                return true;
            }
        }
    }
    false
}

#[cfg(target_os = "windows")]
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
    if hr == 0 {
        Some(frame_rect)
    } else {
        Some(win_rect)
    }
}

#[cfg(target_os = "windows")]
pub unsafe fn fit_window_to_visible_rect(hwnd: HWND, target: RECT) {
    let mut win_rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    if unsafe { GetWindowRect(hwnd, &mut win_rect) } == 0 {
        return;
    }

    // If window is maximized, restore it first so SetWindowPos can place it cleanly
    // inside the middle column without Windows 11 maximized overhang.
    if unsafe { IsZoomed(hwnd) } != 0 {
        unsafe {
            ShowWindow(hwnd, SW_RESTORE);
            let _ = GetWindowRect(hwnd, &mut win_rect);
        }
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

    let (pad_left, pad_top, pad_right, pad_bottom) = if hr == 0 {
        (
            (frame_rect.left - win_rect.left).max(0),
            (frame_rect.top - win_rect.top).max(0),
            (win_rect.right - frame_rect.right).max(0),
            (win_rect.bottom - frame_rect.bottom).max(0),
        )
    } else {
        (0, 0, 0, 0)
    };

    let x = target.left - pad_left;
    let y = target.top - pad_top;
    let cx = (target.right - target.left) + pad_left + pad_right;
    let cy = (target.bottom - target.top) + pad_top + pad_bottom;

    // Avoid redundant repositioning if window is already at target dimensions
    if win_rect.left == x
        && win_rect.top == y
        && (win_rect.right - win_rect.left) == cx
        && (win_rect.bottom - win_rect.top) == cy
    {
        return;
    }

    unsafe {
        SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            x,
            y,
            cx,
            cy,
            SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_ASYNCWINDOWPOS,
        );
    }
}

#[cfg(target_os = "windows")]
pub unsafe fn is_snappable_app_window(hwnd: HWND) -> bool {
    if hwnd.is_null() {
        return false;
    }
    let h_val = hwnd as isize;
    if h_val == LEFT_DOCK_HWND.load(Ordering::Relaxed)
        || h_val == RIGHT_DOCK_HWND.load(Ordering::Relaxed)
    {
        return false;
    }

    unsafe {
        // Fast-path 1: Minimized or invisible windows
        if IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
            return false;
        }

        // Fast-path 2: Reject child windows and non-resizable/non-caption frames (cheap user-mode flags)
        let style = GetWindowLongW(hwnd, GWL_STYLE) as u32;
        if (style & WS_CHILD) != 0 || (style & (WS_CAPTION | WS_THICKFRAME)) == 0 {
            return false;
        }

        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE) as u32;
        if (ex_style & (WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE)) != 0 {
            return false;
        }

        // Fast-path 3: Check root / owner against FocusHUD dock HWNDs
        let root = GetAncestor(hwnd, GA_ROOT);
        if !root.is_null() {
            let r_val = root as isize;
            if r_val == LEFT_DOCK_HWND.load(Ordering::Relaxed)
                || r_val == RIGHT_DOCK_HWND.load(Ordering::Relaxed)
            {
                return false;
            }
        }

        let owner = GetAncestor(hwnd, GA_ROOTOWNER);
        if !owner.is_null() {
            let o_val = owner as isize;
            if o_val == LEFT_DOCK_HWND.load(Ordering::Relaxed)
                || o_val == RIGHT_DOCK_HWND.load(Ordering::Relaxed)
            {
                return false;
            }
        }

        // Fast-path 4: Process check with PID caching (skips redundant OpenProcess)
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        if is_webview_or_own_process(pid) {
            return false;
        }

        // Fast-path 5: Cloaked windows (virtual desktops, hidden UWP apps)
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

        // Fast-path 6: Desktop and shell system classes
        let mut class_buf = [0u16; 128];
        let len = GetClassNameW(hwnd, class_buf.as_mut_ptr(), class_buf.len() as i32);
        if len > 0 {
            let class_name = String::from_utf16_lossy(&class_buf[..len as usize]);
            if class_name.starts_with("Chrome_RenderWidgetHost")
                || class_name == "Intermediate D3D Window"
                || matches!(
                    class_name.as_str(),
                    "Progman"
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
    }

    true
}

#[cfg(target_os = "windows")]
pub unsafe extern "system" fn enum_windows_snap_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    unsafe {
        if !is_snappable_app_window(hwnd) {
            return 1;
        }

        let work_rect = *(lparam as *const RECT);
        let work_w = work_rect.right - work_rect.left;
        let work_h = work_rect.bottom - work_rect.top;
        if work_w < 200 || work_h < 200 {
            return 1;
        }

        let prev_rect = get_previous_work_area().unwrap_or(work_rect);

        if IsZoomed(hwnd) != 0 {
            fit_window_to_visible_rect(hwnd, work_rect);
            return 1;
        }

        let Some(vis) = get_visible_window_rect(hwnd) else {
            return 1;
        };

        let vis_w = vis.right - vis.left;
        let vis_h = vis.bottom - vis.top;
        if vis_w < 120 || vis_h < 100 {
            return 1;
        }

        let orig = get_original_work_area().unwrap_or(work_rect);
        let center_x = (vis.left + vis.right) / 2;
        if center_x < orig.left || center_x > orig.right {
            return 1;
        }

        let touches_left =
            vis.left <= work_rect.left + 36 || (vis.left - prev_rect.left).abs() <= 48;
        let touches_right =
            vis.right >= work_rect.right - 36 || (vis.right - prev_rect.right).abs() <= 48;

        let was_full_width = vis_w >= ((prev_rect.right - prev_rect.left) * 65 / 100)
            || (touches_left && touches_right)
            || (vis.left <= prev_rect.left + 36 && vis.right >= prev_rect.right - 36);
        let overlaps_both = vis.left < work_rect.left + 36 && vis.right > work_rect.right - 36;

        if was_full_width || overlaps_both || vis_w >= work_w {
            fit_window_to_visible_rect(hwnd, work_rect);
            return 1;
        }

        let mut target = vis;
        let mut changed = false;

        if touches_left {
            target.left = work_rect.left;
            target.right = (target.left + vis_w).min(work_rect.right);
            if vis_h >= (work_h * 75 / 100) {
                target.top = work_rect.top;
                target.bottom = work_rect.bottom;
            }
            changed = true;
        } else if touches_right {
            target.right = work_rect.right;
            target.left = (target.right - vis_w).max(work_rect.left);
            if vis_h >= (work_h * 75 / 100) {
                target.top = work_rect.top;
                target.bottom = work_rect.bottom;
            }
            changed = true;
        }

        if target.top < work_rect.top {
            target.top = work_rect.top;
            changed = true;
        }
        if target.bottom > work_rect.bottom {
            target.bottom = work_rect.bottom;
            changed = true;
        }

        if changed {
            fit_window_to_visible_rect(hwnd, target);
        }
    }
    1
}

#[cfg(target_os = "windows")]
pub unsafe extern "system" fn win_event_hook_proc(
    _h_win_event_hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    id_object: i32,
    _id_child: i32,
    _id_event_thread: u32,
    _dwms_event_time: u32,
) {
    if id_object != 0 || hwnd.is_null() {
        return;
    }

    unsafe {
        if event == EVENT_OBJECT_LOCATIONCHANGE && IsZoomed(hwnd) == 0 {
            return;
        }
        if !is_snappable_app_window(hwnd) {
            return;
        }

        let Some(work_rect) = get_current_work_area() else {
            return;
        };
        let work_w = work_rect.right - work_rect.left;
        let work_h = work_rect.bottom - work_rect.top;
        if work_w < 200 || work_h < 200 {
            return;
        }

        // If a window just became maximized (IsZoomed), ensure it fits strictly between the bars
        if event == EVENT_OBJECT_LOCATIONCHANGE {
            if IsZoomed(hwnd) != 0 {
                if let Some(vis) = get_visible_window_rect(hwnd) {
                    if vis.left < work_rect.left - 2 || vis.right > work_rect.right + 2 {
                        fit_window_to_visible_rect(hwnd, work_rect);
                    }
                }
            }
            return;
        }

        if event != EVENT_SYSTEM_MOVESIZEEND {
            return;
        }

        let Some(vis) = get_visible_window_rect(hwnd) else {
            return;
        };

        let mut pt = POINT { x: 0, y: 0 };
        let _ = GetCursorPos(&mut pt);

        let vis_w = vis.right - vis.left;
        let vis_h = vis.bottom - vis.top;

        // 1. Dragged titlebar near top of middle column -> Snap to 100% of Middle Column
        if pt.y <= work_rect.top + 45 && pt.x >= work_rect.left - 80 && pt.x <= work_rect.right + 80
        {
            fit_window_to_visible_rect(hwnd, work_rect);
            return;
        }

        // 2. Dragged cursor near inner edge of Left Bar
        if pt.x <= work_rect.left + 48 && pt.x >= work_rect.left - 120 {
            if vis_w >= (work_w * 62 / 100) || work_w < 900 {
                fit_window_to_visible_rect(hwnd, work_rect);
            } else {
                let half_rect = RECT {
                    left: work_rect.left,
                    top: work_rect.top,
                    right: work_rect.left + (work_w / 2),
                    bottom: work_rect.bottom,
                };
                fit_window_to_visible_rect(hwnd, half_rect);
            }
            return;
        }

        // 3. Dragged cursor near inner edge of Right Bar
        if pt.x >= work_rect.right - 48 && pt.x <= work_rect.right + 120 {
            if vis_w >= (work_w * 62 / 100) || work_w < 900 {
                fit_window_to_visible_rect(hwnd, work_rect);
            } else {
                let half_rect = RECT {
                    left: work_rect.left + (work_w / 2),
                    top: work_rect.top,
                    right: work_rect.right,
                    bottom: work_rect.bottom,
                };
                fit_window_to_visible_rect(hwnd, half_rect);
            }
            return;
        }

        // 4. Window dropped overlapping or touching both bars -> Snap to 100% of Middle Column
        let touches_left = vis.left <= work_rect.left + 36;
        let touches_right = vis.right >= work_rect.right - 36;

        if (touches_left && touches_right)
            || (vis.left < work_rect.left + 16 && vis.right > work_rect.right - 16)
        {
            fit_window_to_visible_rect(hwnd, work_rect);
            return;
        }

        // 5. Window dropped partially overlapping Left Bar or Right Bar -> Clamp flush to bar
        let mut target = vis;
        let mut changed = false;

        if touches_left {
            target.left = work_rect.left;
            target.right = (target.left + vis_w).min(work_rect.right);
            if vis_h >= (work_h * 75 / 100) {
                target.top = work_rect.top;
                target.bottom = work_rect.bottom;
            }
            changed = true;
        } else if touches_right {
            target.right = work_rect.right;
            target.left = (target.right - vis_w).max(work_rect.left);
            if vis_h >= (work_h * 75 / 100) {
                target.top = work_rect.top;
                target.bottom = work_rect.bottom;
            }
            changed = true;
        }

        if target.top < work_rect.top {
            target.top = work_rect.top;
            changed = true;
        }
        if target.bottom > work_rect.bottom {
            target.bottom = work_rect.bottom;
            changed = true;
        }

        if changed {
            fit_window_to_visible_rect(hwnd, target);
        }
    }
}

/// Installs OS-level WinEventHooks to automatically snap external user windows.
#[cfg(target_os = "windows")]
pub unsafe fn init_window_snap_hooks() {
    unsafe {
        let _ = SetWinEventHook(
            EVENT_SYSTEM_MOVESIZEEND,
            EVENT_SYSTEM_MOVESIZEEND,
            std::ptr::null_mut(),
            Some(win_event_hook_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );
        let _ = SetWinEventHook(
            EVENT_OBJECT_LOCATIONCHANGE,
            EVENT_OBJECT_LOCATIONCHANGE,
            std::ptr::null_mut(),
            Some(win_event_hook_proc),
            0,
            0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
        );
    }
}
