#[cfg(target_os = "windows")]
use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::RECT;

#[cfg(target_os = "windows")]
static CLEAN_EXIT_EVENT: AtomicIsize = AtomicIsize::new(0);
#[cfg(target_os = "windows")]
static WATCHDOG_SPAWNED: AtomicBool = AtomicBool::new(false);
#[cfg(target_os = "windows")]
static CONSOLE_HANDLER_INSTALLED: AtomicBool = AtomicBool::new(false);

/// Signals the sentinel watchdog process that FocusHUD has performed a clean,
/// graceful shutdown and that the original work area was already restored.
pub fn signal_watchdog_clean_exit() {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::Threading::SetEvent;

        let handle =
            CLEAN_EXIT_EVENT.swap(0, Ordering::SeqCst) as windows_sys::Win32::Foundation::HANDLE;
        if !handle.is_null() {
            unsafe {
                SetEvent(handle);
                CloseHandle(handle);
            }
        }
    }
}

/// Spawns a lightweight background watchdog sentinel process that monitors the main
/// FocusHUD process. If FocusHUD terminates abruptly (crash, taskkill /F, terminal kill),
/// the watchdog detects the kernel process handle signal and immediately restores
/// the original desktop work area and re-enables the native Windows layout selector.
#[cfg(target_os = "windows")]
pub fn spawn_watchdog(orig: RECT) {
    use std::os::windows::process::CommandExt;

    if WATCHDOG_SPAWNED.swap(true, Ordering::SeqCst) {
        return;
    }

    let current_exe = match std::env::current_exe() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("[FocusHUD] Failed to get current_exe for watchdog: {}", e);
            return;
        }
    };

    let pid = std::process::id();

    // Create session-scoped named event for graceful exit signaling
    let event_name: Vec<u16> = format!("Local\\FocusHUD_Exit_{}\0", pid)
        .encode_utf16()
        .collect();
    unsafe {
        let h_event = windows_sys::Win32::System::Threading::CreateEventW(
            std::ptr::null(),
            1, // bManualReset: TRUE
            0, // bInitialState: FALSE
            event_name.as_ptr(),
        );
        if !h_event.is_null() {
            CLEAN_EXIT_EVENT.store(h_event as isize, Ordering::SeqCst);
        }
    }

    // CREATE_NO_WINDOW (0x08000000) | DETACHED_PROCESS (0x00000008)
    // Ensures the watchdog runs silently without a console window and is detached
    // from the parent's console so Ctrl+C or terminal closing won't terminate it.
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    const DETACHED_PROCESS: u32 = 0x00000008;

    let mut cmd = std::process::Command::new(current_exe);
    cmd.arg("--watchdog")
        .arg(pid.to_string())
        .arg(orig.left.to_string())
        .arg(orig.top.to_string())
        .arg(orig.right.to_string())
        .arg(orig.bottom.to_string())
        .creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);

    if let Err(e) = cmd.spawn() {
        eprintln!("[FocusHUD] Failed to spawn watchdog process: {}", e);
    }
}

/// Fallback stub for non-Windows platforms
#[cfg(not(target_os = "windows"))]
pub fn spawn_watchdog(_orig: ()) {}

/// Entry point executed when FocusHUD is invoked in watchdog mode:
/// `FocusHUD.exe --watchdog <PID> <left> <top> <right> <bottom>`
/// This runs headlessly with minimal memory (< 2 MB) and 0% CPU.
pub fn run_watchdog(pid: u32, left: i32, top: i32, right: i32, bottom: i32) {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::Foundation::{CloseHandle, RECT, WAIT_OBJECT_0};
        use windows_sys::Win32::System::Threading::{
            INFINITE, OpenEventW, OpenProcess, PROCESS_SYNCHRONIZE, WaitForMultipleObjects,
            WaitForSingleObject,
        };
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            SPI_SETWORKAREA, SPIF_SENDCHANGE, SystemParametersInfoW,
        };

        const SYNCHRONIZE: u32 = 0x00100000;

        let orig_rect = RECT {
            left,
            top,
            right,
            bottom,
        };

        unsafe {
            let h_process = OpenProcess(PROCESS_SYNCHRONIZE, 0, pid);
            if h_process.is_null() {
                // Parent already terminated or cannot be opened; restore work area and Windows snap immediately.
                crate::monitor::set_windows_snap_enabled_raw(true);
                SystemParametersInfoW(
                    SPI_SETWORKAREA,
                    0,
                    &orig_rect as *const _ as *mut _,
                    SPIF_SENDCHANGE,
                );
                return;
            }

            let event_name: Vec<u16> = format!("Local\\FocusHUD_Exit_{}\0", pid)
                .encode_utf16()
                .collect();
            let h_event = OpenEventW(SYNCHRONIZE, 0, event_name.as_ptr());

            if !h_event.is_null() {
                let handles = [h_event, h_process];
                let wait_res = WaitForMultipleObjects(2, handles.as_ptr(), 0, INFINITE);
                if wait_res == WAIT_OBJECT_0 {
                    // h_event was signaled: parent process exited cleanly.
                    // Work area and Windows snap were already restored by parent.
                } else {
                    // h_process was signaled without h_event: abnormal termination!
                    crate::monitor::set_windows_snap_enabled_raw(true);
                    SystemParametersInfoW(
                        SPI_SETWORKAREA,
                        0,
                        &orig_rect as *const _ as *mut _,
                        SPIF_SENDCHANGE,
                    );
                }
                CloseHandle(h_event);
            } else {
                // Event handle could not be opened; wait directly for process termination.
                let _ = WaitForSingleObject(h_process, INFINITE);
                crate::monitor::set_windows_snap_enabled_raw(true);
                SystemParametersInfoW(
                    SPI_SETWORKAREA,
                    0,
                    &orig_rect as *const _ as *mut _,
                    SPIF_SENDCHANGE,
                );
            }

            CloseHandle(h_process);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (pid, left, top, right, bottom);
    }
}

/// Registers a Windows Console Control Handler to capture Ctrl+C, Ctrl+Break,
/// and terminal window close events (e.g. during `npm run tauri dev`), restoring
/// the original desktop work area before the console process terminates.
pub fn init_console_ctrl_handler() {
    #[cfg(target_os = "windows")]
    {
        if !CONSOLE_HANDLER_INSTALLED.swap(true, Ordering::SeqCst) {
            unsafe extern "system" fn console_ctrl_handler(
                ctrl_type: u32,
            ) -> windows_sys::Win32::Foundation::BOOL {
                match ctrl_type {
                    windows_sys::Win32::System::Console::CTRL_C_EVENT
                    | windows_sys::Win32::System::Console::CTRL_BREAK_EVENT
                    | windows_sys::Win32::System::Console::CTRL_CLOSE_EVENT
                    | windows_sys::Win32::System::Console::CTRL_LOGOFF_EVENT
                    | windows_sys::Win32::System::Console::CTRL_SHUTDOWN_EVENT => {
                        crate::monitor::restore_work_area_sync();
                        signal_watchdog_clean_exit();
                        std::process::exit(0);
                    }
                    _ => 0,
                }
            }

            unsafe {
                windows_sys::Win32::System::Console::SetConsoleCtrlHandler(
                    Some(console_ctrl_handler),
                    1,
                );
            }
        }
    }
}

/// Parses command line arguments to determine if the process is being invoked
/// in sentinel watchdog mode (`--watchdog <pid> <left> <top> <right> <bottom>`).
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
