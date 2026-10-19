import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsModal } from "./SettingsModal";
import * as store from "../utils/store";

describe("SettingsModal component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <SettingsModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal dialog when isOpen is true", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /HUD PREFERENCES & SETTINGS/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/PANE SIZING & MEMORY/i)).toBeInTheDocument();
    expect(screen.getByText(/AUTO-MEMORY ACTIVE/i)).toBeInTheDocument();
  });

  it("resets remembered widths to defaults when clicking Reset Widths button", () => {
    const handleReset = vi.fn();
    store.setRememberedLeftWidth(450);
    store.setRememberedRightWidth(420);

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onResetWidths={handleReset}
      />
    );

    const resetBtn = screen.getByRole("button", { name: /Reset Widths/i });
    fireEvent.click(resetBtn);

    expect(handleReset).toHaveBeenCalledTimes(1);
    expect(store.getRememberedLeftWidth()).toBe(store.DEFAULT_LEFT_WIDTH);
    expect(store.getRememberedRightWidth()).toBe(store.DEFAULT_RIGHT_WIDTH);
    expect(screen.getByText(/Reset to Defaults!/i)).toBeInTheDocument();
  });

  it("closes modal on Done or close button click", () => {
    const handleClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={handleClose} />);

    const doneBtn = screen.getByRole("button", { name: /DONE/i });
    fireEvent.click(doneBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByTitle(/Close Settings \(Esc\)/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it("closes modal when pressing Escape key", () => {
    const handleClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
