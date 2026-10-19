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
    expect(screen.getByText(/MAXIMUM PANE WIDTHS/i)).toBeInTheDocument();
  });

  it("adjusts max width sliders and applies dimensions", () => {
    const handleApply = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onApplyMaxDimensions={handleApply}
      />
    );

    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(2);

    // Change left slider to 400
    fireEvent.change(sliders[0], { target: { value: "400" } });
    // Change right slider to 420
    fireEvent.change(sliders[1], { target: { value: "420" } });

    const applyBtn = screen.getByRole("button", { name: /Apply Widths/i });
    fireEvent.click(applyBtn);

    expect(handleApply).toHaveBeenCalledWith(400, 420);
    expect(store.getMaxLeftWidth()).toBe(400);
    expect(store.getMaxRightWidth()).toBe(420);
  });

  it("resets to defaults when clicking Default button", () => {
    const handleApply = vi.fn();
    store.setMaxLeftWidth(450);
    store.setMaxRightWidth(450);

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onApplyMaxDimensions={handleApply}
      />
    );

    const resetBtn = screen.getByRole("button", { name: /Default \(360px\)/i });
    fireEvent.click(resetBtn);

    expect(handleApply).toHaveBeenCalledWith(360, 360);
    expect(store.getMaxLeftWidth()).toBe(360);
    expect(store.getMaxRightWidth()).toBe(360);
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
});
