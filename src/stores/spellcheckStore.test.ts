import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getStoredSpellcheckLocale,
  getStoredSpellcheckEnabled,
  broadcastSpellcheckChange,
  applySpellcheckToDom,
  initSpellcheck,
  subscribeSpellcheckChange,
  SPELLCHECK_LOCALE_KEY,
  SPELLCHECK_ENABLED_KEY,
  SPELLCHECK_OPTIONS,
  DEFAULT_SPELLCHECK_LOCALE,
  SpellcheckLocale,
} from "./spellcheckStore";

describe("spellcheckStore", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
    document.documentElement.removeAttribute("data-spellcheck");
  });

  it("returns default locale 'en-AU' and enabled true when nothing is stored", () => {
    expect(getStoredSpellcheckLocale()).toBe(DEFAULT_SPELLCHECK_LOCALE);
    expect(getStoredSpellcheckEnabled()).toBe(true);
  });

  it("retrieves valid stored locale and enabled flag from localStorage", () => {
    localStorage.setItem(SPELLCHECK_LOCALE_KEY, "en-US");
    localStorage.setItem(SPELLCHECK_ENABLED_KEY, "false");

    expect(getStoredSpellcheckLocale()).toBe("en-US");
    expect(getStoredSpellcheckEnabled()).toBe(false);
  });

  it("falls back to default locale if stored value is invalid", () => {
    localStorage.setItem(SPELLCHECK_LOCALE_KEY, "invalid-locale");
    expect(getStoredSpellcheckLocale()).toBe(DEFAULT_SPELLCHECK_LOCALE);
  });

  it("applies locale and enabled attribute to document root", () => {
    applySpellcheckToDom("en-GB", false);
    expect(document.documentElement.lang).toBe("en-GB");
    expect(document.documentElement.getAttribute("data-spellcheck")).toBe("false");

    applySpellcheckToDom("en-AU", true);
    expect(document.documentElement.lang).toBe("en-AU");
    expect(document.documentElement.getAttribute("data-spellcheck")).toBe("true");
  });

  it("initializes document attributes via initSpellcheck", () => {
    localStorage.setItem(SPELLCHECK_LOCALE_KEY, "en-CA");
    localStorage.setItem(SPELLCHECK_ENABLED_KEY, "true");

    initSpellcheck();
    expect(document.documentElement.lang).toBe("en-CA");
    expect(document.documentElement.getAttribute("data-spellcheck")).toBe("true");
  });

  it("broadcasts spellcheck changes to localStorage and applies to DOM", () => {
    broadcastSpellcheckChange("en-US", false);

    expect(localStorage.getItem(SPELLCHECK_LOCALE_KEY)).toBe("en-US");
    expect(localStorage.getItem(SPELLCHECK_ENABLED_KEY)).toBe("false");
    expect(document.documentElement.lang).toBe("en-US");
    expect(document.documentElement.getAttribute("data-spellcheck")).toBe("false");
  });

  it("notifies listeners on storage event", () => {
    const callback = vi.fn();
    const unsubscribe = subscribeSpellcheckChange(callback);

    localStorage.setItem(SPELLCHECK_LOCALE_KEY, "en-NZ");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SPELLCHECK_LOCALE_KEY,
        newValue: "en-NZ",
      })
    );

    expect(callback).toHaveBeenCalledWith("en-NZ", true);
    unsubscribe();
  });

  it("provides comprehensive spellcheck options including en-AU, en-US, and en-GB", () => {
    const localeIds = SPELLCHECK_OPTIONS.map((opt) => opt.id);
    expect(localeIds).toContain<SpellcheckLocale>("en-AU");
    expect(localeIds).toContain<SpellcheckLocale>("en-US");
    expect(localeIds).toContain<SpellcheckLocale>("en-GB");
    expect(localeIds).toContain<SpellcheckLocale>("en-CA");
    expect(localeIds).toContain<SpellcheckLocale>("en-NZ");
  });
});
