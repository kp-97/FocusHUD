import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SnapOverlayApp } from "./SnapOverlayApp";
import * as tauriBridge from "../../../services/tauriBridge";

vi.mock("../../../services/tauriBridge", () => ({
  getSnapOverlayState: vi.fn(),
  selectSnapAssistWindow: vi.fn(),
  skipSnapAssistZone: vi.fn(),
  dismissSnapAssist: vi.fn().mockResolvedValue(true),
}));

const mockTopBar: tauriBridge.TopBarGeometry = {
  pill_rect: { x: 500, y: 0, width: 188, height: 14 },
  pill_trigger_rect: { x: 460, y: 0, width: 280, height: 44 },
  bar_rect: { x: 200, y: 8, width: 760, height: 82 },
  groups: [
    {
      template: "split50_50",
      label: "50 / 50 Split",
      rect: { x: 214, y: 20, width: 96, height: 58 },
      zones: [
        { x: 214, y: 20, width: 46, height: 58 },
        { x: 264, y: 20, width: 46, height: 58 },
      ],
    },
    {
      template: "cols3_equal",
      label: "3 Equal Columns",
      rect: { x: 322, y: 20, width: 96, height: 58 },
      zones: [
        { x: 322, y: 20, width: 29, height: 58 },
        { x: 355, y: 20, width: 29, height: 58 },
        { x: 388, y: 20, width: 29, height: 58 },
      ],
    },
  ],
};

describe("SnapOverlayApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders collapsed top pill and zone preview when mode is pill", async () => {
    vi.mocked(tauriBridge.getSnapOverlayState).mockResolvedValue({
      mode: "pill",
      work_width_logical: 1200,
      work_height_logical: 900,
      top_bar: mockTopBar,
      hovered_template: "split50_50",
      hovered_zone_index: 0,
      preview_rect: { x: 0, y: 0, width: 600, height: 900 },
      active_template: null,
      assist_zone_index: null,
      assist_zone_rect: null,
      assist_all_zone_rects: [],
      assist_filled_zones: [],
      assist_candidates: [],
    });

    render(<SnapOverlayApp />);
    expect(await screen.findByTestId("snap-top-pill")).toBeInTheDocument();
    expect(screen.getByTestId("snap-zone-preview")).toBeInTheDocument();
  });

  it("renders expanded Snap Layouts bar and highlights hovered zone", async () => {
    vi.mocked(tauriBridge.getSnapOverlayState).mockResolvedValue({
      mode: "expanded",
      work_width_logical: 1200,
      work_height_logical: 900,
      top_bar: mockTopBar,
      hovered_template: "cols3_equal",
      hovered_zone_index: 2,
      preview_rect: { x: 800, y: 0, width: 400, height: 900 },
      active_template: null,
      assist_zone_index: null,
      assist_zone_rect: null,
      assist_all_zone_rects: [],
      assist_filled_zones: [],
      assist_candidates: [],
    });

    render(<SnapOverlayApp />);
    expect(await screen.findByTestId("snap-expanded-bar")).toBeInTheDocument();
    const hoveredZone = screen.getByTestId("snap-zone-cols3_equal-2");
    expect(hoveredZone).toHaveStyle({ backgroundColor: "rgb(214, 157, 248)" });
  });

  it("renders Snap Assist Picker in remaining empty pane and snaps selected window", async () => {
    vi.mocked(tauriBridge.getSnapOverlayState).mockResolvedValue({
      mode: "assist",
      work_width_logical: 1200,
      work_height_logical: 900,
      top_bar: mockTopBar,
      hovered_template: null,
      hovered_zone_index: null,
      preview_rect: null,
      active_template: "cols3_equal",
      assist_zone_index: 1,
      assist_zone_rect: { x: 400, y: 0, width: 400, height: 900 },
      assist_all_zone_rects: [
        { x: 0, y: 0, width: 400, height: 900 },
        { x: 400, y: 0, width: 400, height: 900 },
        { x: 800, y: 0, width: 400, height: 900 },
      ],
      assist_filled_zones: [true, false, false],
      assist_candidates: [
        {
          hwnd: 100200,
          title: "FocusHUD - Visual Studio Code",
          app_name: "VS Code",
          exe_name: "Code.exe",
        },
      ],
    });

    render(<SnapOverlayApp />);
    expect(await screen.findByTestId("snap-assist-picker")).toBeInTheDocument();
    expect(screen.getByText(/Select App for Pane 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Up Next: Pane 3 of 3/i)).toBeInTheDocument();

    const candidateBtn = screen.getByTestId("snap-candidate-100200");
    fireEvent.click(candidateBtn);

    await waitFor(() => {
      expect(tauriBridge.selectSnapAssistWindow).toHaveBeenCalledWith(100200, 1);
    });
  });
});
