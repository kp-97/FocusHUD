import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppearanceTab } from "./AppearanceTab";
import { THEME_STORAGE_KEY, THEME_AUTO_SYNC_KEY } from "../../../stores/themeStore";

describe("AppearanceTab", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders theme selection and all 7 theme options", () => {
    render(<AppearanceTab onResetDefaults={() => {}} resetSuccess={false} />);

    expect(screen.getByText("HUD THEME & PALETTE")).toBeInTheDocument();
    expect(screen.getByText("Cyber HUD")).toBeInTheDocument();
    expect(screen.getByText("Stealth Dark")).toBeInTheDocument();
    expect(screen.getByText("Lab Light")).toBeInTheDocument();
    expect(screen.getByText("Pastel Sakura")).toBeInTheDocument();
    expect(screen.getByText("Retro Terminal")).toBeInTheDocument();
    expect(screen.getByText("Arctic Slate")).toBeInTheDocument();
    expect(screen.getByText("Phosphor Matrix")).toBeInTheDocument();
  });

  it("switches theme when a swatch card is clicked", () => {
    render(<AppearanceTab onResetDefaults={() => {}} resetSuccess={false} />);

    const pinkCard = screen.getByRole("button", { name: /Pastel Sakura/i });
    fireEvent.click(pinkCard);

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("pink");
    expect(document.documentElement.getAttribute("data-theme")).toBe("pink");
  });

  it("toggles auto-sync checkbox and updates storage", () => {
    render(<AppearanceTab onResetDefaults={() => {}} resetSuccess={false} />);

    const autoSyncCheckbox = screen.getByRole("checkbox", { name: /Toggle Auto \(Sync OS\)/i });
    expect(autoSyncCheckbox).not.toBeChecked();

    fireEvent.click(autoSyncCheckbox);
    expect(autoSyncCheckbox).toBeChecked();
    expect(localStorage.getItem(THEME_AUTO_SYNC_KEY)).toBe("true");
  });

  it("renders pane sizing section and handles reset click", () => {
    const handleReset = vi.fn();
    render(<AppearanceTab onResetDefaults={handleReset} resetSuccess={false} />);

    expect(screen.getByText("PANE SIZING & MEMORY")).toBeInTheDocument();
    const resetBtn = screen.getByRole("button", { name: /Reset Widths/i });
    fireEvent.click(resetBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it("toggles desktop work area zone reservation", () => {
    render(<AppearanceTab onResetDefaults={() => {}} resetSuccess={false} />);

    const reserveToggle = screen.getByRole("checkbox", { name: /Toggle Reserve Desktop Zones/i });
    expect(reserveToggle).toBeChecked();

    fireEvent.click(reserveToggle);
    expect(reserveToggle).not.toBeChecked();
    expect(localStorage.getItem("hud_panes_reserve_zones")).toBe("false");
  });

  it("switches pane sizing mode to custom defaults and updates default widths", () => {
    render(<AppearanceTab onResetDefaults={() => {}} resetSuccess={false} />);

    // Default mode is remember
    const rememberRadio = screen.getByLabelText(/Remember expanded independent widths/i);
    const customRadio = screen.getByLabelText(/Set default pane widths via settings/i);
    expect(rememberRadio).toBeChecked();
    expect(customRadio).not.toBeChecked();

    // Switch to custom default mode
    fireEvent.click(customRadio);
    expect(customRadio).toBeChecked();
    expect(localStorage.getItem("hud_remember_pane_widths")).toBe("false");

    // Inputs for default left and right pane widths become visible
    const leftInput = screen.getByLabelText(/Default Left Pane Width \(px\)/i);
    const rightInput = screen.getByLabelText(/Default Right Pane Width \(px\)/i);
    expect(leftInput).toBeInTheDocument();
    expect(rightInput).toBeInTheDocument();

    fireEvent.change(leftInput, { target: { value: "320" } });
    expect(localStorage.getItem("hud_custom_default_left_width")).toBe("320");

    fireEvent.change(rightInput, { target: { value: "350" } });
    expect(localStorage.getItem("hud_custom_default_right_width")).toBe("350");
  });
});

