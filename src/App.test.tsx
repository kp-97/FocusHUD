import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
});
