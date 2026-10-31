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
    expect(screen.getByText("Neon Sakura")).toBeInTheDocument();
    expect(screen.getByText("Retro Terminal")).toBeInTheDocument();
    expect(screen.getByText("Arctic Slate")).toBeInTheDocument();
    expect(screen.getByText("Phosphor Matrix")).toBeInTheDocument();
  });

  it("switches theme when a swatch card is clicked", () => {
    render(<AppearanceTab onResetDefaults={() => {}} resetSuccess={false} />);

    const pinkCard = screen.getByRole("button", { name: /Neon Sakura/i });
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
});
