//! Coordinate geometry calculations for display monitors, docks, and work areas.
//!
//! Pure mathematical functions with no native OS dependencies, fully unit-testable
//! across all platforms.

/// Cross-platform rectangular representation for display and window geometry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct MonitorRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl MonitorRect {
    pub const fn new(left: i32, top: i32, right: i32, bottom: i32) -> Self {
        Self {
            left,
            top,
            right,
            bottom,
        }
    }

    pub fn width(&self) -> i32 {
        self.right - self.left
    }

    pub fn height(&self) -> i32 {
        self.bottom - self.top
    }

    pub fn contains_point(&self, x: i32, y: i32) -> bool {
        x >= self.left && x < self.right && y >= self.top && y < self.bottom
    }

    pub fn intersects(&self, other: &MonitorRect) -> bool {
        self.left < other.right
            && self.right > other.left
            && self.top < other.bottom
            && self.bottom > other.top
    }

    pub fn intersection(&self, other: &MonitorRect) -> Option<MonitorRect> {
        let left = self.left.max(other.left);
        let top = self.top.max(other.top);
        let right = self.right.min(other.right);
        let bottom = self.bottom.min(other.bottom);

        if left < right && top < bottom {
            Some(MonitorRect::new(left, top, right, bottom))
        } else {
            None
        }
    }
}

#[cfg(target_os = "windows")]
impl From<windows_sys::Win32::Foundation::RECT> for MonitorRect {
    fn from(r: windows_sys::Win32::Foundation::RECT) -> Self {
        Self {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
        }
    }
}

#[cfg(target_os = "windows")]
impl From<MonitorRect> for windows_sys::Win32::Foundation::RECT {
    fn from(r: MonitorRect) -> Self {
        windows_sys::Win32::Foundation::RECT {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
        }
    }
}

/// Computes desktop work area margins for left and right docks.
/// Protects against inverted boundaries if physical widths overlap.
pub fn calculate_work_area_margins(
    orig_left: i32,
    orig_right: i32,
    phys_left: i32,
    phys_right: i32,
) -> (i32, i32) {
    let mut left = orig_left + phys_left;
    let mut right = orig_right - phys_right;
    if left >= right {
        left = left.min(orig_right - 1);
        right = right.max(left + 1);
    }
    (left, right)
}

/// Computes the X coordinate of the right-side dock window on the primary monitor.
pub fn calculate_right_dock_x(mon_left: i32, mon_width: i32, phys_canvas: i32) -> i32 {
    mon_left + mon_width - phys_canvas
}

/// Calculates physical canvas width given a DPI scaling factor and maximum logical width.
pub fn calculate_canvas_width(max_dock_logical_width: i32, scale: f64) -> i32 {
    ((max_dock_logical_width as f64) * scale).round() as i32
}

/// Calculates stationary physical canvas width for a dock considering monitor width and base canvas.
/// Ensures the dock window can physically span across the monitor to connect with the opposite rail.
pub fn calculate_dock_canvas_width(mon_width: i32, base_canvas: i32) -> i32 {
    mon_width.max(base_canvas)
}

/// Calculates visible physical width for a dock considering dragging state, handle gutter, and DPI scale.
pub fn calculate_visible_width(
    logical_width: i32,
    handle_gutter: i32,
    is_drag_active: bool,
    scale: f64,
    max_dock_logical_width: i32,
) -> i32 {
    let phys_canvas = calculate_canvas_width(max_dock_logical_width, scale);
    if is_drag_active {
        phys_canvas
    } else {
        (((logical_width + handle_gutter) as f64) * scale).round() as i32
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_monitor_rect_dimensions() {
        let rect = MonitorRect::new(100, 200, 500, 600);
        assert_eq!(rect.width(), 400);
        assert_eq!(rect.height(), 400);
    }

    #[test]
    fn test_monitor_rect_contains_point() {
        let rect = MonitorRect::new(0, 0, 1920, 1080);
        assert!(rect.contains_point(0, 0));
        assert!(rect.contains_point(1000, 500));
        assert!(!rect.contains_point(1920, 1080));
        assert!(!rect.contains_point(-1, 0));
    }

    #[test]
    fn test_monitor_rect_intersection() {
        let r1 = MonitorRect::new(0, 0, 1000, 1000);
        let r2 = MonitorRect::new(500, 500, 1500, 1500);
        let inter = r1.intersection(&r2).unwrap();
        assert_eq!(inter, MonitorRect::new(500, 500, 1000, 1000));

        let r3 = MonitorRect::new(2000, 2000, 3000, 3000);
        assert_eq!(r1.intersection(&r3), None);
        assert!(!r1.intersects(&r3));
        assert!(r1.intersects(&r2));
    }

    #[test]
    fn test_calculate_work_area_margins_normal() {
        let (left, right) = calculate_work_area_margins(0, 3440, 300, 300);
        assert_eq!(left, 300);
        assert_eq!(right, 3140);
    }

    #[test]
    fn test_calculate_work_area_margins_prevents_inversion() {
        let (left, right) = calculate_work_area_margins(0, 1920, 1000, 1000);
        assert!(left < right);
    }

    #[test]
    fn test_calculate_right_dock_x() {
        let x = calculate_right_dock_x(0, 3440, 800);
        assert_eq!(x, 2640);

        let x_offset = calculate_right_dock_x(1920, 1920, 800);
        assert_eq!(x_offset, 3040);
    }

    #[test]
    fn test_calculate_canvas_width() {
        assert_eq!(calculate_canvas_width(800, 1.0), 800);
        assert_eq!(calculate_canvas_width(800, 1.25), 1000);
        assert_eq!(calculate_canvas_width(800, 1.5), 1200);
    }

    #[test]
    fn test_calculate_dock_canvas_width() {
        let base = calculate_canvas_width(800, 1.0);
        assert_eq!(calculate_dock_canvas_width(3440, base), 3440);
        assert_eq!(calculate_dock_canvas_width(600, base), 800);
    }

    #[test]
    fn test_calculate_visible_width() {
        assert_eq!(calculate_visible_width(280, 0, false, 1.0, 800), 280);
        assert_eq!(calculate_visible_width(280, 0, true, 1.0, 800), 800);
        assert_eq!(calculate_visible_width(280, 0, false, 1.5, 800), 420);
    }
}
