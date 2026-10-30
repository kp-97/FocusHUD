import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UpdatesTab } from "./UpdatesTab";
import * as updaterService from "../../../services/updaterService";

describe("UpdatesTab Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders with current version and checks for updates", async () => {
    vi.spyOn(updaterService, "checkForUpdates").mockResolvedValue({
      available: false,
      currentVersion: "0.2.0",
    });

    render(<UpdatesTab />);

    expect(screen.getByTestId("updates-tab")).toBeDefined();
    expect(screen.getByTestId("check-updates-btn")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId("up-to-date-message")).toHaveTextContent(
        "FocusHUD is currently up to date."
      );
    });
  });

  it("displays update available card when an update is found", async () => {
    const mockRawUpdate = {
      downloadAndInstall: vi.fn(),
    };

    vi.spyOn(updaterService, "checkForUpdates").mockResolvedValue({
      available: true,
      currentVersion: "0.2.0",
      version: "0.2.1",
      date: "2026-10-30",
      body: "Fixed calendar note dropdown issue.",
      rawUpdate: mockRawUpdate,
    });

    render(<UpdatesTab />);

    await waitFor(() => {
      expect(screen.getByTestId("update-available-card")).toBeDefined();
      expect(screen.getByText(/New Update Available: v0.2.1/i)).toBeDefined();
      expect(screen.getByTestId("release-notes-box")).toHaveTextContent(
        "Fixed calendar note dropdown issue."
      );
    });

    // Test install button
    const installBtn = screen.getByTestId("install-update-btn");
    expect(installBtn).toBeDefined();
  });
});
