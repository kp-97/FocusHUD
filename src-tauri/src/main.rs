// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if let Some((pid, left, top, right, bottom)) =
        tauri_app_lib::monitor::parse_watchdog_args(&args)
    {
        tauri_app_lib::monitor::run_watchdog(pid, left, top, right, bottom);
        return;
    }

    tauri_app_lib::monitor::init_console_ctrl_handler();

    std::panic::set_hook(Box::new(|info| {
        tauri_app_lib::monitor::restore_work_area_sync();
        tauri_app_lib::monitor::signal_watchdog_clean_exit();

        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic payload".to_string()
        };
        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_default();
        let msg = format!(
            "PANIC at {} [{}] - {}",
            chrono_like_now(),
            location,
            payload
        );
        let _ = std::fs::write("crash.log", msg);
    }));
    tauri_app_lib::run()
}

fn chrono_like_now() -> String {
    format!("{:?}", std::time::SystemTime::now())
}
