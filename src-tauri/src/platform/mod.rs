pub mod fallback;
#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "windows")]
pub use self::windows::*;

#[cfg(target_os = "macos")]
pub use self::macos::*;

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
pub use self::fallback::*;

use serde::Serialize;

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct ScreenMetrics {
    pub screen_width: i32,
    pub screen_height: i32,
    pub original_left: i32,
    pub original_top: i32,
    pub original_right: i32,
    pub original_bottom: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_metrics_equality_and_json() {
        let m1 = ScreenMetrics {
            screen_width: 3440,
            screen_height: 1440,
            original_left: 0,
            original_top: 28,
            original_right: 3440,
            original_bottom: 1440,
        };
        let m2 = m1;
        assert_eq!(m1, m2);

        let json = serde_json::to_string(&m1).unwrap();
        assert!(json.contains("\"screen_width\":3440"));
        assert!(json.contains("\"original_top\":28"));
    }

    #[test]
    fn test_platform_check_accessibility_permissions() {
        // On Windows and fallback, returns true
        #[cfg(not(target_os = "macos"))]
        assert!(check_accessibility_permissions());
    }

    #[test]
    fn test_platform_parse_watchdog_args() {
        let args = vec![
            "FocusHUD".to_string(),
            "--watchdog".to_string(),
            "4567".to_string(),
            "0".to_string(),
            "0".to_string(),
            "2560".to_string(),
            "1440".to_string(),
        ];
        assert_eq!(parse_watchdog_args(&args), Some((4567, 0, 0, 2560, 1440)));
    }
}
