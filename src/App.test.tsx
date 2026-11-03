import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import App from "./App";

vi.mock("./services/tauriBridge", () => ({
  updateDockSizes: vi.fn(),
  restoreWorkArea: vi.fn(),
  openSettingsWindow: vi.fn().mockResolvedValue(true),
  closeSettingsWindow: vi.fn(),
  getScreenMetrics: vi.fn().mockResolvedValue({ primary: { width: 1920, height: 1080 } }),
  getSystemDiagnostics: vi.fn().mockResolvedValue(null),
  setDockPopoutMode: vi.fn(),
  exitApp: vi.fn(),
  minimizeToTray: vi.fn(),
  setFullscreenMode: vi.fn().mockResolvedValue(true),
}));

vi.mock("./components/features/settings/UpdatesTab", () => ({
  UpdatesTab: () => <div data-testid="updates-tab-mock" />,
}));

vi.mock("./services/updaterService", () => ({
  checkForUpdates: vi.fn().mockResolvedValue(null),
  getAppCurrentVersion: vi.fn().mockResolvedValue("0.2.10"),
  APP_VERSION: "0.2.10",
}));

describe("App root window dispatcher", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  const setLocationSearch = (search: string) => {
    window.history.replaceState({}, "", search ? search : "/");
  };

  it("renders FullLayoutApp when no dock query parameter is present", () => {
    setLocationSearch("");
    render(<App />);
    expect(screen.getByTestId("full-layout-app")).toBeInTheDocument();
  });

  it("renders LeftDockApp when ?dock=left is present", () => {
    setLocationSearch("?dock=left");
    render(<App />);
    expect(screen.getByTestId("left-dock-app")).toBeInTheDocument();
    expect(screen.queryByTestId("full-layout-app")).not.toBeInTheDocument();
  });

  it("renders RightDockApp when ?dock=right is present", () => {
    setLocationSearch("?dock=right");
    render(<App />);
    expect(screen.getByTestId("right-dock-app")).toBeInTheDocument();
    expect(screen.queryByTestId("full-layout-app")).not.toBeInTheDocument();
  });

  it("renders SettingsModalApp when ?dock=settings is present", () => {
    setLocationSearch("?dock=settings");
    render(<App />);
    expect(screen.getByTestId("settings-modal-app")).toBeInTheDocument();
    expect(screen.queryByTestId("full-layout-app")).not.toBeInTheDocument();
  });

  it("renders SettingsModalApp when ?view=settings is present", () => {
    setLocationSearch("?view=settings");
    render(<App />);
    expect(screen.getByTestId("settings-modal-app")).toBeInTheDocument();
  });

  it("switches to full screen mode when clicking maximise and returns to docked mode when clicking restore", async () => {
    setLocationSearch("");
    render(<App />);

    // Initially in docked mode: Center workspace is present, full screen view container is not
    expect(screen.getByTestId("center-preview-container")).toBeInTheDocument();
    expect(screen.queryByTestId("full-screen-view-container")).not.toBeInTheDocument();

    const maxBtn = screen.getByLabelText(/Maximize FocusHUD/i);
    expect(maxBtn).toBeInTheDocument();

    // Click Maximise button
    await act(async () => {
      maxBtn.click();
    });

    // In full screen mode:
    // 1. Center workspace is replaced by full-screen view container (merging left & right panes)
    expect(screen.getByTestId("full-screen-view-container")).toBeInTheDocument();
    expect(screen.queryByTestId("center-preview-container")).not.toBeInTheDocument();

    // 2. Left and right rails are still on the left and right
    expect(screen.getByLabelText("System Menu")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-toggle-left")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-toggle-right")).toBeInTheDocument();

    // Clicking a view on the left rail displays its full view version in the center space
    const calendarBtn = screen.getByTestId("left-rail-nav-calendar");
    await act(async () => {
      calendarBtn.click();
    });
    expect(screen.getByText("CALENDAR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Today/i })).toBeInTheDocument();

    // 3. Maximise button switches to Restore button
    const restoreBtn = screen.getByLabelText(/Restore FocusHUD/i);
    expect(restoreBtn).toBeInTheDocument();

    // Click Restore button
    await act(async () => {
      restoreBtn.click();
    });

    // Returns to docked mode
    expect(screen.queryByTestId("full-screen-view-container")).not.toBeInTheDocument();
    expect(screen.getByTestId("center-preview-container")).toBeInTheDocument();
    expect(screen.getByLabelText(/Maximize FocusHUD/i)).toBeInTheDocument();
  });
});
