use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct LogicalRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct IntRect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl IntRect {
    pub const fn new(left: i32, top: i32, right: i32, bottom: i32) -> Self {
        Self {
            left,
            top,
            right,
            bottom,
        }
    }

    pub fn width(self) -> i32 {
        (self.right - self.left).max(0)
    }

    pub fn height(self) -> i32 {
        (self.bottom - self.top).max(0)
    }

    pub fn to_logical(self, origin_x: i32, origin_y: i32, scale: f64) -> LogicalRect {
        let s = if scale <= 0.01 { 1.0 } else { scale };
        LogicalRect {
            x: ((self.left - origin_x) as f64) / s,
            y: ((self.top - origin_y) as f64) / s,
            width: (self.width() as f64) / s,
            height: (self.height() as f64) / s,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct WindowMinMax {
    pub min_width: i32,
    pub min_height: i32,
    pub max_width: i32,
    pub max_height: i32,
}

impl Default for WindowMinMax {
    fn default() -> Self {
        Self {
            min_width: 240,
            min_height: 150,
            max_width: 16384,
            max_height: 16384,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SnapLayoutTemplate {
    SingleFull,
    Split50_50,
    Split65_35,
    Split35_65,
    Left1Right2,
    Grid2x2,
    Cols3Equal,
    Cols3WideCenter,
}

impl SnapLayoutTemplate {
    pub fn zone_count(self) -> usize {
        match self {
            Self::SingleFull => 1,
            Self::Split50_50 | Self::Split65_35 | Self::Split35_65 => 2,
            Self::Left1Right2 | Self::Cols3Equal | Self::Cols3WideCenter => 3,
            Self::Grid2x2 => 4,
        }
    }

    pub fn default_splits(self) -> (f64, f64, f64) {
        match self {
            Self::SingleFull => (1.0, 1.0, 1.0),
            Self::Split50_50 | Self::Left1Right2 | Self::Grid2x2 => (0.50, 1.0, 0.50),
            Self::Split65_35 => (0.65, 1.0, 0.50),
            Self::Split35_65 => (0.35, 1.0, 0.50),
            Self::Cols3Equal => (1.0 / 3.0, 2.0 / 3.0, 0.50),
            Self::Cols3WideCenter => (0.25, 0.75, 0.50),
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::SingleFull => "Full Center",
            Self::Split50_50 => "50 / 50 Split",
            Self::Split65_35 => "65 / 35 Split",
            Self::Split35_65 => "35 / 65 Split",
            Self::Left1Right2 => "Main + 2 Stacked",
            Self::Grid2x2 => "2x2 Grid",
            Self::Cols3Equal => "3 Equal Columns",
            Self::Cols3WideCenter => "Wide Center (3 Cols)",
        }
    }

    pub fn bar_templates() -> [Self; 7] {
        [
            Self::Split50_50,
            Self::Split65_35,
            Self::Split35_65,
            Self::Left1Right2,
            Self::Grid2x2,
            Self::Cols3Equal,
            Self::Cols3WideCenter,
        ]
    }
}

fn clamp_split_ratio(
    ratio: f64,
    total: i32,
    min_a: i32,
    max_a: i32,
    min_b: i32,
    max_b: i32,
) -> f64 {
    let lo = min_a.max(total - max_b);
    let hi = (total - min_b).min(max_a);
    let cur = ((total as f64) * ratio).round() as i32;
    let clamped = if lo <= hi {
        cur.clamp(lo, hi)
    } else {
        total / 2
    };
    (clamped as f64) / (total.max(1) as f64)
}

#[derive(Debug, Clone)]
pub struct CenterSnapLayoutState {
    pub template: SnapLayoutTemplate,
    pub v_split1: f64,
    pub v_split2: f64,
    pub h_split: f64,
    pub zones: Vec<Option<isize>>,
    pub skipped_zones: Vec<bool>,
}

impl CenterSnapLayoutState {
    pub fn new(template: SnapLayoutTemplate) -> Self {
        let count = template.zone_count();
        let (v1, v2, h) = template.default_splits();
        Self {
            template,
            v_split1: v1,
            v_split2: v2,
            h_split: h,
            zones: vec![None; count],
            skipped_zones: vec![false; count],
        }
    }

    pub fn first_unassigned_zone(&self) -> Option<usize> {
        (0..self.zones.len()).find(|&i| self.zones[i].is_none() && !self.skipped_zones[i])
    }

    pub fn clamp_splits(&mut self, work: IntRect, constraints: &[Option<WindowMinMax>]) {
        let w = work.width().max(1);
        let h = work.height().max(1);
        let c = |idx: usize| constraints.get(idx).and_then(|x| *x).unwrap_or_default();
        let min_w = |i: usize| c(i).min_width.min((w - 180).max(180));
        let max_w = |i: usize| c(i).max_width.max(240);
        let min_h = |i: usize| c(i).min_height.min((h - 120).max(120));
        let max_h = |i: usize| c(i).max_height.max(160);

        match self.template {
            SnapLayoutTemplate::SingleFull => self.v_split1 = 1.0,
            SnapLayoutTemplate::Split50_50
            | SnapLayoutTemplate::Split65_35
            | SnapLayoutTemplate::Split35_65 => {
                self.v_split1 =
                    clamp_split_ratio(self.v_split1, w, min_w(0), max_w(0), min_w(1), max_w(1));
            }
            SnapLayoutTemplate::Left1Right2 => {
                self.v_split1 = clamp_split_ratio(
                    self.v_split1,
                    w,
                    min_w(0),
                    max_w(0),
                    min_w(1).max(min_w(2)),
                    max_w(1).min(max_w(2)),
                );
                self.h_split =
                    clamp_split_ratio(self.h_split, h, min_h(1), max_h(1), min_h(2), max_h(2));
            }
            SnapLayoutTemplate::Grid2x2 => {
                self.v_split1 = clamp_split_ratio(
                    self.v_split1,
                    w,
                    min_w(0).max(min_w(2)),
                    max_w(0).min(max_w(2)),
                    min_w(1).max(min_w(3)),
                    max_w(1).min(max_w(3)),
                );
                self.h_split = clamp_split_ratio(
                    self.h_split,
                    h,
                    min_h(0).max(min_h(1)),
                    max_h(0).min(max_h(1)),
                    min_h(2).max(min_h(3)),
                    max_h(2).min(max_h(3)),
                );
            }
            SnapLayoutTemplate::Cols3Equal | SnapLayoutTemplate::Cols3WideCenter => {
                let (m0, m1, m2) = (
                    min_w(0).min(w / 3),
                    min_w(1).min(w / 3),
                    min_w(2).min(w / 3),
                );
                let x1 =
                    (((w as f64) * self.v_split1).round() as i32).clamp(m0, (w - m1 - m2).max(m0));
                let x2 = (((w as f64) * self.v_split2).round() as i32)
                    .clamp((x1 + m1).min(w - m2), (w - m2).max(m0 + m1));
                self.v_split1 = (x1 as f64) / (w as f64);
                self.v_split2 = (x2 as f64) / (w as f64);
            }
        }
    }

    pub fn compute_zone_rects(
        &self,
        work: IntRect,
        constraints: &[Option<WindowMinMax>],
    ) -> Vec<IntRect> {
        let mut copy = self.clone();
        copy.clamp_splits(work, constraints);
        let (l, t, r, b) = (work.left, work.top, work.right, work.bottom);
        let x1 = l + ((work.width() as f64) * copy.v_split1).round() as i32;
        let x2 = l + ((work.width() as f64) * copy.v_split2).round() as i32;
        let y1 = t + ((work.height() as f64) * copy.h_split).round() as i32;

        match copy.template {
            SnapLayoutTemplate::SingleFull => vec![work],
            SnapLayoutTemplate::Split50_50
            | SnapLayoutTemplate::Split65_35
            | SnapLayoutTemplate::Split35_65 => {
                vec![IntRect::new(l, t, x1, b), IntRect::new(x1, t, r, b)]
            }
            SnapLayoutTemplate::Left1Right2 => {
                vec![
                    IntRect::new(l, t, x1, b),
                    IntRect::new(x1, t, r, y1),
                    IntRect::new(x1, y1, r, b),
                ]
            }
            SnapLayoutTemplate::Grid2x2 => vec![
                IntRect::new(l, t, x1, y1),
                IntRect::new(x1, t, r, y1),
                IntRect::new(l, y1, x1, b),
                IntRect::new(x1, y1, r, b),
            ],
            SnapLayoutTemplate::Cols3Equal | SnapLayoutTemplate::Cols3WideCenter => {
                vec![
                    IntRect::new(l, t, x1, b),
                    IntRect::new(x1, t, x2, b),
                    IntRect::new(x2, t, r, b),
                ]
            }
        }
    }

    pub fn update_split_from_border_drag(
        &mut self,
        zone_idx: usize,
        dragged: IntRect,
        start: IntRect,
        work: IntRect,
        constraints: &[Option<WindowMinMax>],
    ) -> bool {
        let (w, h) = (work.width().max(1) as f64, work.height().max(1) as f64);
        let l_mov = (dragged.left - start.left).abs() > 4;
        let r_mov = (dragged.right - start.right).abs() > 4;
        let t_mov = (dragged.top - start.top).abs() > 4;
        let b_mov = (dragged.bottom - start.bottom).abs() > 4;
        let mut updated = false;

        match self.template {
            SnapLayoutTemplate::SingleFull => {}
            SnapLayoutTemplate::Split50_50
            | SnapLayoutTemplate::Split65_35
            | SnapLayoutTemplate::Split35_65 => {
                if zone_idx == 0 && r_mov && !l_mov {
                    self.v_split1 = ((dragged.right - work.left) as f64) / w;
                    updated = true;
                } else if zone_idx == 1 && l_mov && !r_mov {
                    self.v_split1 = ((dragged.left - work.left) as f64) / w;
                    updated = true;
                }
            }
            SnapLayoutTemplate::Left1Right2 | SnapLayoutTemplate::Grid2x2 => {
                let is_left_col = zone_idx == 0
                    || (self.template == SnapLayoutTemplate::Grid2x2 && zone_idx == 2);
                if is_left_col && r_mov && !l_mov {
                    self.v_split1 = ((dragged.right - work.left) as f64) / w;
                    updated = true;
                } else if !is_left_col && l_mov && !r_mov {
                    self.v_split1 = ((dragged.left - work.left) as f64) / w;
                    updated = true;
                }
                let is_top_row = zone_idx == 1
                    || (self.template == SnapLayoutTemplate::Grid2x2 && zone_idx == 0);
                let is_bot_row = zone_idx >= 2;
                if is_top_row && b_mov && !t_mov {
                    self.h_split = ((dragged.bottom - work.top) as f64) / h;
                    updated = true;
                } else if is_bot_row && t_mov && !b_mov {
                    self.h_split = ((dragged.top - work.top) as f64) / h;
                    updated = true;
                }
            }
            SnapLayoutTemplate::Cols3Equal | SnapLayoutTemplate::Cols3WideCenter => {
                if zone_idx == 0 && r_mov && !l_mov {
                    self.v_split1 = ((dragged.right - work.left) as f64) / w;
                    updated = true;
                } else if zone_idx == 1 && l_mov && !r_mov {
                    self.v_split1 = ((dragged.left - work.left) as f64) / w;
                    updated = true;
                } else if zone_idx == 1 && r_mov && !l_mov {
                    self.v_split2 = ((dragged.right - work.left) as f64) / w;
                    updated = true;
                } else if zone_idx == 2 && l_mov && !r_mov {
                    self.v_split2 = ((dragged.left - work.left) as f64) / w;
                    updated = true;
                }
            }
        }

        if updated {
            self.clamp_splits(work, constraints);
        }
        updated
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TopBarLayoutGroup {
    pub template: SnapLayoutTemplate,
    pub label: String,
    pub rect: LogicalRect,
    pub zones: Vec<LogicalRect>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TopBarGeometry {
    pub pill_rect: LogicalRect,
    pub pill_trigger_rect: LogicalRect,
    pub bar_rect: LogicalRect,
    pub groups: Vec<TopBarLayoutGroup>,
}

pub fn compute_top_bar_geometry(work_width_logical: f64) -> TopBarGeometry {
    let safe_w = work_width_logical.max(360.0);
    let center_x = safe_w / 2.0;
    let pill_rect = LogicalRect {
        x: (center_x - 94.0).max(0.0),
        y: 0.0,
        width: 188.0,
        height: 14.0,
    };
    let pill_trigger_rect = LogicalRect {
        x: (center_x - 140.0).max(0.0),
        y: 0.0,
        width: 280.0,
        height: 44.0,
    };

    let templates = SnapLayoutTemplate::bar_templates();
    let (pad_x, pad_y, gap, box_h) = (14.0, 12.0, 12.0, 58.0);
    let box_w = if safe_w >= 860.0 {
        96.0
    } else {
        ((safe_w - 40.0 - pad_x * 2.0 - gap * ((templates.len() - 1) as f64))
            / (templates.len() as f64))
            .clamp(56.0, 96.0)
    };

    let total_bar_w =
        pad_x * 2.0 + box_w * (templates.len() as f64) + gap * ((templates.len() - 1) as f64);
    let bar_x = (center_x - total_bar_w / 2.0).max(8.0);
    let bar_y = 8.0;
    let bar_rect = LogicalRect {
        x: bar_x,
        y: bar_y,
        width: total_bar_w,
        height: pad_y * 2.0 + box_h,
    };

    let groups = templates
        .iter()
        .enumerate()
        .map(|(idx, &tpl)| {
            let gx = bar_x + pad_x + (idx as f64) * (box_w + gap);
            let gy = bar_y + pad_y;
            let group_rect = LogicalRect {
                x: gx,
                y: gy,
                width: box_w,
                height: box_h,
            };

            // Reuse CenterSnapLayoutState split ratios scaled to 1000x1000 basis for zero duplication
            let raw_zones = CenterSnapLayoutState::new(tpl)
                .compute_zone_rects(IntRect::new(0, 0, 1000, 1000), &[]);
            let zones = raw_zones
                .into_iter()
                .map(|zr| {
                    let l = (zr.left as f64) / 1000.0;
                    let r = (zr.right as f64) / 1000.0;
                    let t = (zr.top as f64) / 1000.0;
                    let b = (zr.bottom as f64) / 1000.0;
                    let pad_l = if zr.left > 0 { 2.0 } else { 0.0 };
                    let pad_r = if zr.right < 1000 { 2.0 } else { 0.0 };
                    let pad_t = if zr.top > 0 { 2.0 } else { 0.0 };
                    let pad_b = if zr.bottom < 1000 { 2.0 } else { 0.0 };
                    LogicalRect {
                        x: gx + l * box_w + pad_l,
                        y: gy + t * box_h + pad_t,
                        width: ((r - l) * box_w - pad_l - pad_r).max(8.0),
                        height: ((b - t) * box_h - pad_t - pad_b).max(8.0),
                    }
                })
                .collect();

            TopBarLayoutGroup {
                template: tpl,
                label: tpl.label().to_string(),
                rect: group_rect,
                zones,
            }
        })
        .collect();

    TopBarGeometry {
        pill_rect,
        pill_trigger_rect,
        bar_rect,
        groups,
    }
}

pub fn rect_contains_point(r: &LogicalRect, x: f64, y: f64, margin: f64) -> bool {
    x >= r.x - margin
        && x <= r.x + r.width + margin
        && y >= r.y - margin
        && y <= r.y + r.height + margin
}

pub fn hit_test_top_bar(
    geom: &TopBarGeometry,
    cursor_x: f64,
    cursor_y: f64,
    is_already_expanded: bool,
) -> (bool, Option<(SnapLayoutTemplate, usize)>) {
    let should_expand = if is_already_expanded {
        rect_contains_point(&geom.bar_rect, cursor_x, cursor_y, 18.0)
            || rect_contains_point(&geom.pill_trigger_rect, cursor_x, cursor_y, 8.0)
    } else {
        rect_contains_point(&geom.pill_trigger_rect, cursor_x, cursor_y, 4.0)
    };
    if !should_expand {
        return (false, None);
    }
    for group in &geom.groups {
        for (z_idx, z_rect) in group.zones.iter().enumerate() {
            if rect_contains_point(z_rect, cursor_x, cursor_y, 1.5) {
                return (true, Some((group.template, z_idx)));
            }
        }
    }
    (true, None)
}
