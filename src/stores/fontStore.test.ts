import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  FONT_LIST,
  FONT_STORAGE_KEY,
  getStoredFont,
  applyFontToDom,
  broadcastFontChange,
  subscribeFontChange,
} from "./fontStore";

describe("fontStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-font");
    document.documentElement.style.removeProperty("--hud-font-family");
    document.documentElement.style.removeProperty("--hud-user-font-family");
    document.documentElement.style.removeProperty("--hud-font-hud");
    vi.restoreAllMocks();
  });

  it("lists all 8 supported fonts including theme-default", () => {
    expect(FONT_LIST).toHaveLength(8);
    const ids = FONT_LIST.map((f) => f.id);
    expect(ids).toContain("open-sans");
    expect(ids).toContain("lato");
    expect(ids).toContain("poppins");
    expect(ids).toContain("roboto");
    expect(ids).toContain("montserrat");
    expect(ids).toContain("inter");
    expect(ids).toContain("merriweather");
    expect(ids).toContain("theme-default");
  });

  it("returns theme-default when no stored font is found", () => {
    expect(getStoredFont()).toBe("theme-default");
  });

  it("retrieves valid stored font from localStorage", () => {
    localStorage.setItem(FONT_STORAGE_KEY, "poppins");
    expect(getStoredFont()).toBe("poppins");
  });

  it("falls back to theme-default if stored font is invalid", () => {
    localStorage.setItem(FONT_STORAGE_KEY, "comic-sans-nonexistent");
    expect(getStoredFont()).toBe("theme-default");
  });

  it("applies theme-default by removing custom CSS variables from document element", () => {
    document.documentElement.style.setProperty("--hud-font-family", "CustomFont");
    document.documentElement.style.setProperty("--hud-font-hud", "CustomFont");
    applyFontToDom("theme-default");

    expect(document.documentElement.getAttribute("data-font")).toBe("theme-default");
    expect(document.documentElement.style.getPropertyValue("--hud-font-family")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--hud-user-font-family")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--hud-font-hud")).toBe("");
  });

  it("applies specific font to document element with CSS variables", () => {
    applyFontToDom("montserrat");

    expect(document.documentElement.getAttribute("data-font")).toBe("montserrat");
    expect(document.documentElement.style.getPropertyValue("--hud-font-family")).toBe(
      "'Montserrat', sans-serif"
    );
    expect(document.documentElement.style.getPropertyValue("--hud-user-font-family")).toBe(
      "'Montserrat', sans-serif"
    );
    expect(document.documentElement.style.getPropertyValue("--hud-font-hud")).toBe(
      "'Montserrat', sans-serif"
    );
  });

  it("broadcasts font change and updates localStorage", () => {
    broadcastFontChange("merriweather");
    expect(localStorage.getItem(FONT_STORAGE_KEY)).toBe("merriweather");
  });

  it("subscribes and handles storage events", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeFontChange(callback);

    localStorage.setItem(FONT_STORAGE_KEY, "roboto");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: FONT_STORAGE_KEY,
        newValue: "roboto",
      })
    );

    expect(callback).toHaveBeenCalledWith("roboto");
    unsubscribe();
  });
});
