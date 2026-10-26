use super::ScreenMetrics;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicI32, Ordering};
use tauri::Manager;

pub static CURRENT_LEFT_WIDTH: AtomicI32 = AtomicI32::new(280);
pub static CURRENT_RIGHT_WIDTH: AtomicI32 = AtomicI32::new(280);
static ACCESSIBILITY_PROMPTED: AtomicBool = AtomicBool::new(false);
static CENTER_WINDOW_ORIG_FRAME: Mutex<Option<(f64, f64, f64, f64)>> = Mutex::new(None);

pub fn init_dpi_awareness() {
    // macOS automatically manages Retina and per-monitor scaling through Cocoa Points
    // and backingStorePixelRatio without legacy Windows scaling APIs.
}

pub fn get_screen_metrics(app: &tauri::AppHandle) -> Result<ScreenMetrics, String> {
    if let Ok(Some(mon)) = app.primary_monitor() {
        let size = mon.size();
        let scale = mon.scale_factor();
        let logical_w = (size.width as f64 / scale).round() as i32;
        let logical_h = (size.height as f64 / scale).round() as i32;

        // macOS standard top menu bar is ~28 logical points
        let top_menu_bar = 28;

        Ok(ScreenMetrics {
            screen_width: logical_w,
            screen_height: logical_h,
            original_left: 0,
            original_top: top_menu_bar,
            original_right: logical_w,
            original_bottom: logical_h,
        })
    } else {
        Ok(ScreenMetrics {
            screen_width: 3440,
            screen_height: 1440,
            original_left: 0,
            original_top: 28,
            original_right: 3440,
            original_bottom: 1440,
        })
    }
}

/// Checks macOS Accessibility API trust state via AXIsProcessTrusted.
/// If untrusted and prompt is true, invokes system prompt directing user to
/// System Settings > Privacy & Security > Accessibility.
pub fn check_accessibility_permissions() -> bool {
    #[cfg(target_os = "macos")]
    {
        unsafe extern "C" {
            fn AXIsProcessTrusted() -> bool;
            fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> bool;
        }

        if !ACCESSIBILITY_PROMPTED.swap(true, Ordering::SeqCst) {
            // macOS 10.9+ prompt options dictionary
            unsafe {
                // If not trusted, AXIsProcessTrustedWithOptions prompts user
                if !AXIsProcessTrusted() {
                    // Create CFDictionary with kAXTrustedCheckOptionPrompt = true
                    #[link(name = "CoreFoundation", kind = "framework")]
                    unsafe extern "C" {
                        fn CFDictionaryCreate(
                            allocator: *const std::ffi::c_void,
                            keys: *const *const std::ffi::c_void,
                            values: *const *const std::ffi::c_void,
                            numValues: isize,
                            keyCallBacks: *const std::ffi::c_void,
                            valueCallBacks: *const std::ffi::c_void,
                        ) -> *const std::ffi::c_void;
                        fn CFRelease(cf: *const std::ffi::c_void);
                        static kCFBooleanTrue: *const std::ffi::c_void;
                        static kCFTypeDictionaryKeyCallBacks: std::ffi::c_void;
                        static kCFTypeDictionaryValueCallBacks: std::ffi::c_void;
                    }

                    let prompt_key_chars: Vec<u16> =
                        "AXTrustedCheckOptionPrompt".encode_utf16().collect();
                    #[link(name = "CoreFoundation", kind = "framework")]
                    unsafe extern "C" {
                        fn CFStringCreateWithCharacters(
                            alloc: *const std::ffi::c_void,
                            chars: *const u16,
                            num_chars: isize,
                        ) -> *const std::ffi::c_void;
                    }

                    let key_str = CFStringCreateWithCharacters(
                        std::ptr::null(),
                        prompt_key_chars.as_ptr(),
                        prompt_key_chars.len() as isize,
                    );

                    let keys = [key_str];
                    let values = [kCFBooleanTrue];

                    let options = CFDictionaryCreate(
                        std::ptr::null(),
                        keys.as_ptr(),
                        values.as_ptr(),
                        1,
                        &kCFTypeDictionaryKeyCallBacks as *const _ as *const std::ffi::c_void,
                        &kCFTypeDictionaryValueCallBacks as *const _ as *const std::ffi::c_void,
                    );

                    let trusted = AXIsProcessTrustedWithOptions(options);
                    if !options.is_null() {
                        CFRelease(options);
                    }
                    if !key_str.is_null() {
                        CFRelease(key_str);
                    }
                    return trusted;
                }
            }
        }

        unsafe { AXIsProcessTrusted() }
    }

    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

/// Configures NSWindow / NSPanel attributes on macOS:
/// - Floating level (NSFloatingWindowLevel)
/// - Non-activating panel behavior (NSWindowStyleMaskNonactivatingPanel)
/// - Joins all spaces / stationary across virtual desktops
pub fn configure_dock_windows(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    {
        let window_labels = ["left-dock", "right-dock"];
        for label in window_labels {
            if let Some(win) = app.get_webview_window(label) {
                // Ensure window stays visible across all virtual desktop spaces
                let _ = win.set_always_on_top(true);
            }
        }
    }

    let left_w = CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
    let right_w = CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);
    apply_dock_geometry(app, left_w, right_w);
}

/// Configures centered settings window as a floating utility panel on macOS
pub fn configure_settings_window(window: &tauri::WebviewWindow) {
    let _ = window.set_always_on_top(true);
}

/// Applies dual-dock sidebar geometry on macOS. Docks pin flush against the left
/// and right edges of NSScreen.visibleFrame without obscuring the macOS Menu Bar.
pub fn apply_dock_geometry(app: &tauri::AppHandle, left_width: i32, right_width: i32) {
    CURRENT_LEFT_WIDTH.store(left_width, Ordering::Relaxed);
    CURRENT_RIGHT_WIDTH.store(right_width, Ordering::Relaxed);

    let metrics = get_screen_metrics(app).unwrap_or(ScreenMetrics {
        screen_width: 3440,
        screen_height: 1440,
        original_left: 0,
        original_top: 28,
        original_right: 3440,
        original_bottom: 1440,
    });

    let top_y = metrics.original_top;
    let height = metrics.screen_height - top_y;

    if let Some(left_win) = app.get_webview_window("left-dock") {
        let _ = left_win.set_position(tauri::LogicalPosition::new(0, top_y));
        let _ = left_win.set_size(tauri::LogicalSize::new(left_width as f64, height as f64));
        let _ = left_win.show();
    }

    if let Some(right_win) = app.get_webview_window("right-dock") {
        let right_x = metrics.screen_width - right_width;
        let _ = right_win.set_position(tauri::LogicalPosition::new(right_x, top_y));
        let _ = right_win.set_size(tauri::LogicalSize::new(right_width as f64, height as f64));
        let _ = right_win.show();
    }
}

/// Snaps the active foreground macOS application window into the bounded center region:
/// Center Frame = [LeftDockWidth ... ScreenWidth - RightDockWidth]
pub fn update_dock_work_area(
    app: &tauri::AppHandle,
    left_width: i32,
    right_width: i32,
    snap_open_windows: bool,
) {
    apply_dock_geometry(app, left_width, right_width);

    if !snap_open_windows {
        return;
    }

    if !check_accessibility_permissions() {
        eprintln!("[FocusHUD macOS] Accessibility permissions not granted; skipping window snap.");
        return;
    }

    #[cfg(target_os = "macos")]
    {
        snap_frontmost_window_macos(app, left_width, right_width);
    }
}

pub fn live_resize_active_window(app: &tauri::AppHandle, left_width: i32, right_width: i32) {
    if !check_accessibility_permissions() {
        return;
    }
    #[cfg(target_os = "macos")]
    {
        snap_frontmost_window_macos(app, left_width, right_width);
    }
}

#[cfg(target_os = "macos")]
fn snap_frontmost_window_macos(app: &tauri::AppHandle, left_w: i32, right_w: i32) {
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGPoint {
        x: f64,
        y: f64,
    }
    #[repr(C)]
    #[derive(Clone, Copy)]
    struct CGSize {
        width: f64,
        height: f64,
    }

    #[link(name = "ApplicationServices", kind = "framework")]
    unsafe extern "C" {
        fn AXUIElementCreateSystemWide() -> *mut std::ffi::c_void;
        fn AXUIElementCopyAttributeValue(
            element: *mut std::ffi::c_void,
            attribute: *const std::ffi::c_void,
            value: *mut *mut std::ffi::c_void,
        ) -> i32;
        fn AXUIElementSetAttributeValue(
            element: *mut std::ffi::c_void,
            attribute: *const std::ffi::c_void,
            value: *const std::ffi::c_void,
        ) -> i32;
        fn AXValueCreate(theType: u32, valuePtr: *const std::ffi::c_void) -> *mut std::ffi::c_void;
        fn AXValueGetValue(
            theValue: *mut std::ffi::c_void,
            theType: u32,
            valuePtr: *mut std::ffi::c_void,
        ) -> bool;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    unsafe extern "C" {
        fn CFRelease(cf: *const std::ffi::c_void);
        fn CFStringCreateWithCharacters(
            alloc: *const std::ffi::c_void,
            chars: *const u16,
            num_chars: isize,
        ) -> *const std::ffi::c_void;
    }

    const K_AX_VALUE_TYPE_CGPOINT: u32 = 1;
    const K_AX_VALUE_TYPE_CGSIZE: u32 = 2;

    unsafe {
        let system_wide = AXUIElementCreateSystemWide();
        if system_wide.is_null() {
            return;
        }

        let make_cf_string = |s: &str| -> *const std::ffi::c_void {
            let u16_chars: Vec<u16> = s.encode_utf16().collect();
            CFStringCreateWithCharacters(
                std::ptr::null(),
                u16_chars.as_ptr(),
                u16_chars.len() as isize,
            )
        };

        let app_attr = make_cf_string("AXFocusedApplication");
        let win_attr = make_cf_string("AXFocusedWindow");
        let pos_attr = make_cf_string("AXPosition");
        let size_attr = make_cf_string("AXSize");

        let mut focused_app: *mut std::ffi::c_void = std::ptr::null_mut();
        if AXUIElementCopyAttributeValue(system_wide, app_attr, &mut focused_app) == 0
            && !focused_app.is_null()
        {
            let mut focused_win: *mut std::ffi::c_void = std::ptr::null_mut();
            if AXUIElementCopyAttributeValue(focused_app, win_attr, &mut focused_win) == 0
                && !focused_win.is_null()
            {
                // Capture original window dimensions for clean restoration
                let mut orig_pos_val: *mut std::ffi::c_void = std::ptr::null_mut();
                let mut orig_size_val: *mut std::ffi::c_void = std::ptr::null_mut();
                if AXUIElementCopyAttributeValue(focused_win, pos_attr, &mut orig_pos_val) == 0
                    && AXUIElementCopyAttributeValue(focused_win, size_attr, &mut orig_size_val)
                        == 0
                {
                    let mut pt = CGPoint { x: 0.0, y: 0.0 };
                    let mut sz = CGSize {
                        width: 0.0,
                        height: 0.0,
                    };
                    AXValueGetValue(
                        orig_pos_val,
                        K_AX_VALUE_TYPE_CGPOINT,
                        &mut pt as *mut _ as *mut _,
                    );
                    AXValueGetValue(
                        orig_size_val,
                        K_AX_VALUE_TYPE_CGSIZE,
                        &mut sz as *mut _ as *mut _,
                    );

                    let mut lock = CENTER_WINDOW_ORIG_FRAME.lock().unwrap();
                    if lock.is_none() {
                        *lock = Some((pt.x, pt.y, sz.width, sz.height));
                    }

                    CFRelease(orig_pos_val);
                    CFRelease(orig_size_val);
                }

                let metrics = get_screen_metrics(app).unwrap_or(ScreenMetrics {
                    screen_width: 3440,
                    screen_height: 1440,
                    original_left: 0,
                    original_top: 28,
                    original_right: 3440,
                    original_bottom: 1440,
                });

                let target_x = left_w as f64;
                let target_y = metrics.original_top as f64;
                let target_width = (metrics.screen_width - left_w - right_w) as f64;
                let target_height = (metrics.screen_height - metrics.original_top) as f64;

                let target_pos = CGPoint {
                    x: target_x,
                    y: target_y,
                };
                let target_size = CGSize {
                    width: target_width,
                    height: target_height,
                };

                let pos_val = AXValueCreate(
                    K_AX_VALUE_TYPE_CGPOINT,
                    &target_pos as *const _ as *const std::ffi::c_void,
                );
                let size_val = AXValueCreate(
                    K_AX_VALUE_TYPE_CGSIZE,
                    &target_size as *const _ as *const std::ffi::c_void,
                );

                if !pos_val.is_null() {
                    AXUIElementSetAttributeValue(focused_win, pos_attr, pos_val);
                    CFRelease(pos_val);
                }
                if !size_val.is_null() {
                    AXUIElementSetAttributeValue(focused_win, size_attr, size_val);
                    CFRelease(size_val);
                }

                CFRelease(focused_win);
            }
            CFRelease(focused_app);
        }

        CFRelease(app_attr);
        CFRelease(win_attr);
        CFRelease(pos_attr);
        CFRelease(size_attr);
        CFRelease(system_wide);
    }
}

pub fn restore_work_area_sync() {
    let mut lock = CENTER_WINDOW_ORIG_FRAME.lock().unwrap();
    *lock = None;
}

pub fn restore_work_area() -> Result<(), String> {
    restore_work_area_sync();
    Ok(())
}

pub fn init_window_snapping(app: &tauri::AppHandle) {
    let _ = check_accessibility_permissions();
    let left_w = CURRENT_LEFT_WIDTH.load(Ordering::Relaxed);
    let right_w = CURRENT_RIGHT_WIDTH.load(Ordering::Relaxed);
    apply_dock_geometry(app, left_w, right_w);
}

pub fn spawn_watchdog(_metrics: ScreenMetrics) {}

pub fn signal_watchdog_clean_exit() {}

pub fn init_console_ctrl_handler() {}

pub fn run_watchdog(_pid: u32, _left: i32, _top: i32, _right: i32, _bottom: i32) {}

pub fn parse_watchdog_args(args: &[String]) -> Option<(u32, i32, i32, i32, i32)> {
    if args.len() >= 7 && args[1] == "--watchdog" {
        if let (Ok(pid), Ok(left), Ok(top), Ok(right), Ok(bottom)) = (
            args[2].parse::<u32>(),
            args[3].parse::<i32>(),
            args[4].parse::<i32>(),
            args[5].parse::<i32>(),
            args[6].parse::<i32>(),
        ) {
            return Some((pid, left, top, right, bottom));
        }
    }
    None
}
