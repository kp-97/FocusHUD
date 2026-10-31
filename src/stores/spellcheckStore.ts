/**
 * Spellcheck Store for FocusHUD
 * Manages active spellchecker dictionary locale, enabled/disabled state,
 * DOM language synchronization, and cross-window broadcasting.
 */

import { useState, useEffect, useCallback } from "react";

export type SpellcheckLocale =
  | "en-AU"
  | "en-US"
  | "en-GB"
  | "en-CA"
  | "en-NZ";

export interface SpellcheckOption {
  id: SpellcheckLocale;
  label: string;
  region: string;
  flag: string;
  exampleWords: { standard: string; alternate: string };
}

export const SPELLCHECK_OPTIONS: SpellcheckOption[] = [
  {
    id: "en-AU",
    label: "English (Australia)",
    region: "Australia",
    flag: "🇦🇺",
    exampleWords: { standard: "colour, flavour, organise", alternate: "color, flavor, organize" },
  },
  {
    id: "en-US",
    label: "English (United States)",
    region: "United States",
    flag: "🇺🇸",
    exampleWords: { standard: "color, flavor, organize", alternate: "colour, flavour, organise" },
  },
  {
    id: "en-GB",
    label: "English (United Kingdom)",
    region: "United Kingdom",
    flag: "🇬🇧",
    exampleWords: { standard: "colour, flavour, organise", alternate: "color, flavor, organize" },
  },
  {
    id: "en-CA",
    label: "English (Canada)",
    region: "Canada",
    flag: "🇨🇦",
    exampleWords: { standard: "colour, flavour, organize", alternate: "color, flavor, organise" },
  },
  {
    id: "en-NZ",
    label: "English (New Zealand)",
    region: "New Zealand",
    flag: "🇳🇿",
    exampleWords: { standard: "colour, flavour, organise", alternate: "color, flavor, organize" },
  },
];

export const SPELLCHECK_LOCALE_KEY = "focushud_spellcheck_locale";
export const SPELLCHECK_ENABLED_KEY = "focushud_spellcheck_enabled";
export const SPELLCHECK_CHANNEL_NAME = "focushud_spellcheck_channel";
export const DEFAULT_SPELLCHECK_LOCALE: SpellcheckLocale = "en-AU";

export const getStoredSpellcheckLocale = (): SpellcheckLocale => {
  if (typeof localStorage === "undefined") return DEFAULT_SPELLCHECK_LOCALE;
  const saved = localStorage.getItem(SPELLCHECK_LOCALE_KEY);
  if (saved && SPELLCHECK_OPTIONS.some((opt) => opt.id === saved)) {
    return saved as SpellcheckLocale;
  }
  return DEFAULT_SPELLCHECK_LOCALE;
};

export const getStoredSpellcheckEnabled = (): boolean => {
  if (typeof localStorage === "undefined") return true;
  const saved = localStorage.getItem(SPELLCHECK_ENABLED_KEY);
  if (saved === null) return true;
  return saved === "true";
};

export const applySpellcheckToDom = (locale: SpellcheckLocale, enabled: boolean) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.lang = locale;
  root.setAttribute("data-spellcheck", String(enabled));
};

const spellcheckChannel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(SPELLCHECK_CHANNEL_NAME)
    : null;

const listeners = new Set<(locale: SpellcheckLocale, enabled: boolean) => void>();

export const broadcastSpellcheckChange = (locale: SpellcheckLocale, enabled: boolean) => {
  if (spellcheckChannel) {
    try {
      spellcheckChannel.postMessage({ type: "SPELLCHECK_CHANGE", locale, enabled });
    } catch {}
  }
  try {
    localStorage.setItem(SPELLCHECK_LOCALE_KEY, locale);
    localStorage.setItem(SPELLCHECK_ENABLED_KEY, String(enabled));
  } catch {}
  applySpellcheckToDom(locale, enabled);

  // Notify all in-process subscribers
  listeners.forEach((cb) => {
    try {
      cb(locale, enabled);
    } catch {}
  });
};

export const subscribeSpellcheckChange = (
  callback: (locale: SpellcheckLocale, enabled: boolean) => void
): (() => void) => {
  listeners.add(callback);

  const channelHandler = (e: MessageEvent) => {
    if (e.data && e.data.type === "SPELLCHECK_CHANGE") {
      callback(e.data.locale as SpellcheckLocale, Boolean(e.data.enabled));
    }
  };

  const storageHandler = (e: StorageEvent) => {
    if (e.key === SPELLCHECK_LOCALE_KEY || e.key === SPELLCHECK_ENABLED_KEY) {
      callback(getStoredSpellcheckLocale(), getStoredSpellcheckEnabled());
    }
  };

  if (spellcheckChannel) {
    spellcheckChannel.addEventListener("message", channelHandler);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", storageHandler);
  }

  return () => {
    listeners.delete(callback);
    if (spellcheckChannel) {
      spellcheckChannel.removeEventListener("message", channelHandler);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", storageHandler);
    }
  };
};

export const initSpellcheck = () => {
  const locale = getStoredSpellcheckLocale();
  const enabled = getStoredSpellcheckEnabled();
  applySpellcheckToDom(locale, enabled);
};

export const useSpellcheck = () => {
  const [locale, setLocaleState] = useState<SpellcheckLocale>(() => getStoredSpellcheckLocale());
  const [enabled, setEnabledState] = useState<boolean>(() => getStoredSpellcheckEnabled());

  useEffect(() => {
    applySpellcheckToDom(locale, enabled);
  }, [locale, enabled]);

  useEffect(() => {
    const unsubscribe = subscribeSpellcheckChange((newLocale, newEnabled) => {
      setLocaleState(newLocale);
      setEnabledState(newEnabled);
      applySpellcheckToDom(newLocale, newEnabled);
    });
    return unsubscribe;
  }, []);

  const setLocale = useCallback(
    (newLocale: SpellcheckLocale) => {
      setLocaleState(newLocale);
      broadcastSpellcheckChange(newLocale, enabled);
    },
    [enabled]
  );

  const setEnabled = useCallback(
    (newEnabled: boolean) => {
      setEnabledState(newEnabled);
      broadcastSpellcheckChange(locale, newEnabled);
    },
    [locale]
  );

  const selectedOption =
    SPELLCHECK_OPTIONS.find((opt) => opt.id === locale) || SPELLCHECK_OPTIONS[0];

  return {
    locale,
    enabled,
    setLocale,
    setEnabled,
    selectedOption,
    options: SPELLCHECK_OPTIONS,
  };
};
