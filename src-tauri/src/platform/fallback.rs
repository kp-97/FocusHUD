use super::ScreenMetrics;

pub fn init_dpi_awareness() {}

pub fn get_screen_metrics(app: &tauri::AppHandle) -> Result<ScreenMetrics, String> {
    #[allow(unused_imports)]
    use tauri::Manager;
    if let Ok(Some(mon)) = app.primary_monitor() {
        let size = mon.size();
        Ok(ScreenMetrics {
            screen_width: size.width as i32,
            screen_height: size.height as i32,
            original_left: 0,
            original_top: 0,
            original_right: size.width as i32,
            original_bottom: size.height as i32,
        })
    } else {
        Ok(ScreenMetrics {
            screen_width: 3440,
            screen_height: 1440,
            original_left: 0,
            original_top: 0,
            original_right: 3440,
            original_bottom: 1440,
        })
    }
}

pub fn configure_dock_windows(_app: &tauri::AppHandle) {}

pub fn configure_settings_window(_window: &tauri::WebviewWindow) {}

pub fn apply_dock_geometry(_app: &tauri::AppHandle, _left_width: i32, _right_width: i32) {}

pub fn update_dock_work_area(
    _app: &tauri::AppHandle,
    _left_width: i32,
    _right_width: i32,
    _snap_open_windows: bool,
) {
}

pub fn live_resize_active_window(_app: &tauri::AppHandle, _left_width: i32, _right_width: i32) {}

pub fn restore_work_area_sync() {}

pub fn restore_work_area() -> Result<(), String> {
    Ok(())
}

pub fn init_window_snapping(_app: &tauri::AppHandle) {}

pub fn check_accessibility_permissions() -> bool {
    true
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
