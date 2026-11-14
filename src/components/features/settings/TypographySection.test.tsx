import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TypographySection } from "./TypographySection";
import { FONT_STORAGE_KEY } from "../../../stores/fontStore";

describe("TypographySection component", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-font");
    vi.restoreAllMocks();
  });

  it("renders heading and all 8 font options", () => {
    render(<TypographySection />);

    expect(screen.getByText("HUD TYPOGRAPHY & FONT")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE: THEME DEFAULT")).toBeInTheDocument();

    expect(screen.getByLabelText("Select font Open Sans")).toBeInTheDocument();
    expect(screen.getByLabelText("Select font Lato")).toBeInTheDocument();
    expect(screen.getByLabelText("Select font Poppins")).toBeInTheDocument();
    expect(screen.getByLabelText("Select font Roboto")).toBeInTheDocument();
    expect(screen.getByLabelText("Select font Montserrat")).toBeInTheDocument();
    expect(screen.getByLabelText("Select font Inter")).toBeInTheDocument();
    expect(screen.getByLabelText("Select font Merriweather")).toBeInTheDocument();
    expect(screen.getByLabelText("Select font Theme Default")).toBeInTheDocument();
  });

  it("selects a font and updates active indicator and localStorage", () => {
    render(<TypographySection />);

    const poppinsCard = screen.getByLabelText("Select font Poppins");
    fireEvent.click(poppinsCard);

    expect(screen.getByText("ACTIVE: POPPINS")).toBeInTheDocument();
    expect(localStorage.getItem(FONT_STORAGE_KEY)).toBe("poppins");
    expect(document.documentElement.getAttribute("data-font")).toBe("poppins");
  });

  it("restores theme default when clicking THEME DEFAULT reset button", () => {
    localStorage.setItem(FONT_STORAGE_KEY, "roboto");
    render(<TypographySection />);

    expect(screen.getByText("ACTIVE: ROBOTO")).toBeInTheDocument();

    const resetButton = screen.getByRole("button", { name: /Reset font to theme default/i });
    fireEvent.click(resetButton);

    expect(screen.getByText("ACTIVE: THEME DEFAULT")).toBeInTheDocument();
    expect(localStorage.getItem(FONT_STORAGE_KEY)).toBe("theme-default");
    expect(document.documentElement.getAttribute("data-font")).toBe("theme-default");
  });
});
