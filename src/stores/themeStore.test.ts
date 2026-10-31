import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getStoredTheme,
  getStoredAutoSync,
  resolveEffectiveTheme,
  applyThemeToDom,
  broadcastThemeChange,
  subscribeThemeChange,
  THEMES,
  THEME_LIST,
  THEME_STORAGE_KEY,
  THEME_AUTO_SYNC_KEY,
} from "./themeStore";

describe("themeStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("theme-light", "theme-dark");
    vi.restoreAllMocks();
  });

  it("returns default theme 'cyber' when localStorage is empty", () => {
    expect(getStoredTheme()).toBe("cyber");
    expect(getStoredAutoSync()).toBe(false);
  });

  it("contains all 7 supported themes", () => {
    expect(THEME_LIST).toHaveLength(7);
    const ids = THEME_LIST.map((t) => t.id);
    expect(ids).toContain("cyber");
    expect(ids).toContain("dark");
    expect(ids).toContain("light");
    expect(ids).toContain("pink");
    expect(ids).toContain("amber");
    expect(ids).toContain("nord");
    expect(ids).toContain("matrix");
  });

  it("applies theme attribute and classes to document element", () => {
    applyThemeToDom("pink");
    expect(document.documentElement.getAttribute("data-theme")).toBe("pink");
    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);

    applyThemeToDom("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.classList.contains("theme-light")).toBe(true);
  });

  it("resolves effective theme when autoSync is enabled", () => {
    // Mock matchMedia returning light preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false, // light
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(resolveEffectiveTheme("cyber", true)).toBe("light");

    // Mock matchMedia returning dark preference
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true, // dark
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    expect(resolveEffectiveTheme("pink", true)).toBe("pink");
    expect(resolveEffectiveTheme("light", true)).toBe("cyber");
  });

  it("broadcasts theme changes and updates localStorage", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeThemeChange(listener);

    broadcastThemeChange("amber", true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("amber");
    expect(localStorage.getItem(THEME_AUTO_SYNC_KEY)).toBe("true");

    expect(THEMES.amber.name).toBe("Retro Terminal");
    expect(THEMES.matrix.name).toBe("Phosphor Matrix");

    unsubscribe();
  });
});
