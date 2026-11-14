/**
 * Font Store for FocusHUD (Issue #92)
 * Manages active typography/font-family selection, persistence, and cross-window broadcasting.
 */

import { useState, useEffect, useCallback } from "react";

export type FontId =
  | "open-sans"
  | "lato"
  | "poppins"
  | "roboto"
  | "montserrat"
  | "inter"
  | "merriweather"
  | "theme-default";

export interface FontConfig {
  id: FontId;
  name: string;
  category: "Humanist Sans" | "Geometric Sans" | "Neo-grotesque" | "Modern Serif" | "Dynamic";
  description: string;
  fontFamily: string;
}

export const FONTS: Record<FontId, FontConfig> = {
  "open-sans": {
    id: "open-sans",
    name: "Open Sans",
    category: "Humanist Sans",
    description: "High aperture, universally accessible, exceptionally low eye fatigue.",
    fontFamily: "'Open Sans', sans-serif",
  },
  lato: {
    id: "lato",
    name: "Lato",
    category: "Humanist Sans",
    description: "Warm, semi-rounded curves with a solid, trustworthy UI structure.",
    fontFamily: "'Lato', sans-serif",
  },
  poppins: {
    id: "poppins",
    name: "Poppins",
    category: "Geometric Sans",
    description: "Modern, circular curves; friendly and approachable aesthetic.",
    fontFamily: "'Poppins', sans-serif",
  },
  roboto: {
    id: "roboto",
    name: "Roboto",
    category: "Neo-grotesque",
    description: "Familiar, balanced screen reading with zero cognitive friction.",
    fontFamily: "'Roboto', sans-serif",
  },
  montserrat: {
    id: "montserrat",
    name: "Montserrat",
    category: "Geometric Sans",
    description: "Wide, premium proportions with strong visual presence.",
    fontFamily: "'Montserrat', sans-serif",
  },
  inter: {
    id: "inter",
    name: "Inter",
    category: "Neo-grotesque",
    description: "High x-height, engineered specifically for high-density HUD telemetry.",
    fontFamily: "'Inter', sans-serif",
  },
  merriweather: {
    id: "merriweather",
    name: "Merriweather",
    category: "Modern Serif",
    description: "Engineered for low-strain, long-form reading on digital displays.",
    fontFamily: "'Merriweather', serif",
  },
  "theme-default": {
    id: "theme-default",
    name: "Theme Default",
    category: "Dynamic",
    description: "Preserves current theme defaults (e.g. Rajdhani for Cyber, Inter for Dark).",
    fontFamily: "inherit",
  },
};

export const FONT_LIST = Object.values(FONTS);

export const FONT_MAP: Record<FontId, string> = {
  "open-sans": "'Open Sans', sans-serif",
  lato: "'Lato', sans-serif",
  poppins: "'Poppins', sans-serif",
  roboto: "'Roboto', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  inter: "'Inter', sans-serif",
  merriweather: "'Merriweather', serif",
  "theme-default": "var(--hud-theme-font-default)",
};

export const FONT_STORAGE_KEY = "focushud_font_family";
export const FONT_CHANNEL_NAME = "focushud_font_channel";

export const getStoredFont = (): FontId => {
  if (typeof localStorage === "undefined") return "theme-default";
  const saved = localStorage.getItem(FONT_STORAGE_KEY);
  if (saved && saved in FONTS) {
    return saved as FontId;
  }
  return "theme-default";
};

export const applyFontToDom = (fontId: FontId) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-font", fontId);

  if (fontId === "theme-default") {
    root.style.removeProperty("--hud-font-family");
    root.style.removeProperty("--hud-user-font-family");
    root.style.removeProperty("--hud-font-hud");
  } else {
    const family = FONT_MAP[fontId] || "'Inter', sans-serif";
    root.style.setProperty("--hud-font-family", family);
    root.style.setProperty("--hud-user-font-family", family);
    root.style.setProperty("--hud-font-hud", family);
  }
};

const fontChannel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(FONT_CHANNEL_NAME) : null;

export const broadcastFontChange = (fontId: FontId) => {
  if (fontChannel) {
    fontChannel.postMessage({ type: "FONT_CHANGE", font: fontId });
  }
  try {
    localStorage.setItem(FONT_STORAGE_KEY, fontId);
  } catch {}
};

export const subscribeFontChange = (callback: (fontId: FontId) => void): (() => void) => {
  const channelHandler = (e: MessageEvent) => {
    if (e.data && e.data.type === "FONT_CHANGE") {
      callback(e.data.font as FontId);
    }
  };

  const storageHandler = (e: StorageEvent) => {
    if (e.key === FONT_STORAGE_KEY) {
      callback(getStoredFont());
    }
  };

  if (fontChannel) {
    fontChannel.addEventListener("message", channelHandler);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", storageHandler);
  }

  return () => {
    if (fontChannel) {
      fontChannel.removeEventListener("message", channelHandler);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", storageHandler);
    }
  };
};

export function useFont() {
  const [font, setFontState] = useState<FontId>(getStoredFont);

  // Apply to DOM on mount and font change
  useEffect(() => {
    applyFontToDom(font);
  }, [font]);

  // Sync across windows
  useEffect(() => {
    const unsubscribe = subscribeFontChange((newFont) => {
      setFontState(newFont);
      applyFontToDom(newFont);
    });
    return () => unsubscribe();
  }, []);

  const setFont = useCallback((newFont: FontId) => {
    setFontState(newFont);
    broadcastFontChange(newFont);
    applyFontToDom(newFont);
  }, []);

  return {
    font,
    setFont,
    fontConfig: FONTS[font] || FONTS["theme-default"],
  };
}

