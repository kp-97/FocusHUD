import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UpdateNotificationToast } from "./UpdateNotificationToast";

describe("UpdateNotificationToast Component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("does not render when no update is available", () => {
    const { container } = render(
      <UpdateNotificationToast updateInfo={{ available: false, currentVersion: "0.2.0" }} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders toast when update is available and handles actions", () => {
    const onOpenSettings = vi.fn();
    const onDismiss = vi.fn();

    render(
      <UpdateNotificationToast
        updateInfo={{
          available: true,
          currentVersion: "0.2.0",
          version: "0.2.1",
          body: "Release notes highlights",
        }}
        onOpenSettings={onOpenSettings}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByTestId("update-notification-toast")).toBeDefined();
    expect(screen.getByText(/UPDATE AVAILABLE: v0.2.1/i)).toBeDefined();

    const viewBtn = screen.getByTestId("toast-view-update-btn");
    fireEvent.click(viewBtn);

    expect(onOpenSettings).toHaveBeenCalled();
  });
});

