import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkForUpdates,
  isUpdateSnoozed,
  snoozeUpdate,
  downloadAndInstallUpdate,
} from "./updaterService";
import * as dbService from "./dbService";

describe("updaterService", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("handles non-Tauri environment gracefully", async () => {
    vi.spyOn(dbService, "isTauriEnvironment").mockReturnValue(false);
    const result = await checkForUpdates();
    expect(result.available).toBe(false);
    expect(result.currentVersion).toContain("web preview");
  });

  it("snoozes a version and respects active snooze period", () => {
    expect(isUpdateSnoozed("0.2.1")).toBe(false);

    snoozeUpdate("0.2.1", 48);
    expect(isUpdateSnoozed("0.2.1")).toBe(true);

    // Another version is not snoozed
    expect(isUpdateSnoozed("0.2.2")).toBe(false);
  });

  it("tracks download and install progress callback", async () => {
    const progressEvents: number[] = [];
    const mockRawUpdate = {
      downloadAndInstall: vi.fn().mockImplementation(async (callback) => {
        callback({ event: "Started", data: { contentLength: 1000 } });
        callback({ event: "Progress", data: { chunkLength: 500 } });
        callback({ event: "Progress", data: { chunkLength: 500 } });
        callback({ event: "Finished" });
      }),
    };

    await downloadAndInstallUpdate(mockRawUpdate, (percent) => {
      progressEvents.push(percent);
    });

    expect(mockRawUpdate.downloadAndInstall).toHaveBeenCalled();
    expect(progressEvents).toContain(0);
    expect(progressEvents).toContain(50);
    expect(progressEvents).toContain(100);
  });
});

