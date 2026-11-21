//! Monitor subsystem module.
//!
//! Decomposed into:
//! - `geometry`: Pure mathematical functions for calculating display rectangles and dock bounds.
//! - `discovery`: Native display enumeration and Per-Monitor DPI v2 queries.
//! - `work_area`: Win32 work area reservation, snap layout suppression, and safe restoration.

pub mod discovery;
pub mod geometry;
pub mod work_area;

pub use discovery::*;
pub use geometry::*;
pub use work_area::*;

pub use crate::platform::ScreenMetrics;
pub use crate::watchdog::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_screen_metrics_serialization() {
        let metrics = ScreenMetrics {
            screen_width: 3440,
            screen_height: 1440,
            original_left: 0,
            original_top: 0,
            original_right: 3440,
            original_bottom: 1400,
        };
        let json = serde_json::to_string(&metrics).unwrap();
        assert!(json.contains("screen_width"));
        assert!(json.contains("3440"));
    }

    #[test]
    fn test_signal_clean_exit_idempotent() {
        signal_watchdog_clean_exit();
        signal_watchdog_clean_exit();
    }

    #[test]
    fn test_parse_watchdog_args_valid() {
        let args = vec![
            "FocusHUD.exe".to_string(),
            "--watchdog".to_string(),
            "12345".to_string(),
            "0".to_string(),
            "0".to_string(),
            "3440".to_string(),
            "1400".to_string(),
        ];
        let parsed = parse_watchdog_args(&args);
        assert_eq!(parsed, Some((12345, 0, 0, 3440, 1400)));
    }

    #[test]
    fn test_parse_watchdog_args_normal_run() {
        let args = vec!["FocusHUD.exe".to_string()];
        assert_eq!(parse_watchdog_args(&args), None);
    }

    #[test]
    fn test_parse_watchdog_args_malformed_number() {
        let args = vec![
            "FocusHUD.exe".to_string(),
            "--watchdog".to_string(),
            "not_a_number".to_string(),
            "0".to_string(),
            "0".to_string(),
            "3440".to_string(),
            "1400".to_string(),
        ];
        assert_eq!(parse_watchdog_args(&args), None);
    }

    #[test]
    fn test_parse_watchdog_args_insufficient_params() {
        let args = vec![
            "FocusHUD.exe".to_string(),
            "--watchdog".to_string(),
            "12345".to_string(),
        ];
        assert_eq!(parse_watchdog_args(&args), None);
    }

    #[test]
    fn test_init_console_ctrl_handler_idempotent() {
        init_console_ctrl_handler();
        init_console_ctrl_handler();
    }
}
