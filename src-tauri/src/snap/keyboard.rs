use std::sync::atomic::Ordering;

use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, SendInput,
    VK_CONTROL, VK_LEFT, VK_LWIN, VK_MENU, VK_RIGHT, VK_RWIN, VK_SHIFT, VK_UP,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, DispatchMessageW, GetForegroundWindow, GetMessageW, HHOOK, KBDLLHOOKSTRUCT,
    MSG, SetWindowsHookExW, TranslateMessage, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
};

use super::LAST_ACTIVE_APP_HWND;
use super::assist::apply_snap_selection;
use super::layout::SnapLayoutTemplate;
use super::win32::is_snappable_app_window;
use crate::dock::{FULLSCREEN_ACTIVE, PANES_RESERVE_ZONES};

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
        && !FULLSCREEN_ACTIVE.load(Ordering::Relaxed)
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

pub fn start_keyboard_hook() {
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
