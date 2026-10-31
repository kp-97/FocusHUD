/**
 * Theme Store for FocusHUD
 * Manages active theme selection, system dark/light synchronization, and cross-window theme broadcasting.
 */

import { useState, useEffect, useCallback } from "react";

export type ThemeId =
  | "cyber"
  | "dark"
  | "light"
  | "pink"
  | "amber"
  | "nord"
  | "matrix";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  category: "dark" | "light";
  description: string;
  accentColor: string;
  secondaryColor: string;
  bgColor: string;
  borderColor: string;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  cyber: {
    id: "cyber",
    name: "Cyber HUD",
    category: "dark",
    description: "Electric cyan HUD on obsidian navy with scanline glows.",
    accentColor: "#00e5ff",
    secondaryColor: "#ff9100",
    bgColor: "#03070d",
    borderColor: "rgba(0, 229, 255, 0.3)",
  },
  dark: {
    id: "dark",
    name: "Stealth Dark",
    category: "dark",
    description: "Minimalist OLED black with clean monochrome slate accents.",
    accentColor: "#f1f5f9",
    secondaryColor: "#94a3b8",
    bgColor: "#0a0a0c",
    borderColor: "rgba(148, 163, 184, 0.25)",
  },
  light: {
    id: "light",
    name: "Lab Light",
    category: "light",
    description: "Crisp daylight theme with frosted slate panels & high contrast.",
    accentColor: "#0284c7",
    secondaryColor: "#ea580c",
    bgColor: "#f8fafc",
    borderColor: "rgba(2, 132, 199, 0.25)",
  },
  pink: {
    id: "pink",
    name: "Pastel Sakura",
    category: "light",
    description: "Cute pastel pink aesthetic with rounded typography and soft white cards.",
    accentColor: "#f43f5e",
    secondaryColor: "#fb7185",
    bgColor: "#fce7f3",
    borderColor: "rgba(244, 63, 94, 0.3)",
  },
  amber: {
    id: "amber",
    name: "Retro Terminal",
    category: "dark",
    description: "Tactical warm phosphor amber CRT for late-night eye comfort.",
    accentColor: "#ffb000",
    secondaryColor: "#ff7700",
    bgColor: "#100d08",
    borderColor: "rgba(255, 176, 0, 0.3)",
  },
  nord: {
    id: "nord",
    name: "Arctic Slate",
    category: "dark",
    description: "Calming low-saturation arctic blue-gray for deep focus blocks.",
    accentColor: "#88c0d0",
    secondaryColor: "#ebcb8b",
    bgColor: "#242933",
    borderColor: "rgba(136, 192, 208, 0.25)",
  },
  matrix: {
    id: "matrix",
    name: "Phosphor Matrix",
    category: "dark",
    description: "Classic monochrome green cyber-deck terminal glow.",
    accentColor: "#00ff66",
    secondaryColor: "#a3e635",
    bgColor: "#020803",
    borderColor: "rgba(0, 255, 102, 0.28)",
  },
};

export const THEME_LIST = Object.values(THEMES);

export const THEME_STORAGE_KEY = "focushud_theme";
export const THEME_AUTO_SYNC_KEY = "focushud_theme_auto_sync";
export const THEME_CHANNEL_NAME = "focushud_theme_channel";

export const getStoredTheme = (): ThemeId => {
  if (typeof localStorage === "undefined") return "cyber";
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved && saved in THEMES) {
    return saved as ThemeId;
  }
  return "cyber";
};

export const getStoredAutoSync = (): boolean => {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(THEME_AUTO_SYNC_KEY) === "true";
};

export const getSystemPrefersDark = (): boolean => {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return true;
    }
  }
  return true;
};

export const resolveEffectiveTheme = (theme: ThemeId, autoSync: boolean): ThemeId => {
  if (autoSync) {
    const isDark = getSystemPrefersDark();
    if (!isDark) {
      return "light";
    }
    // If OS is dark and current theme was light, default to cyber; otherwise keep dark theme choice
    return theme === "light" ? "cyber" : theme;
  }
  return theme;
};

export const applyThemeToDom = (theme: ThemeId) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const config = THEMES[theme] || THEMES.cyber;
  if (config.category === "light") {
    root.classList.add("theme-light");
    root.classList.remove("theme-dark");
  } else {
    root.classList.add("theme-dark");
    root.classList.remove("theme-light");
  }
};

const themeChannel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(THEME_CHANNEL_NAME) : null;

export const broadcastThemeChange = (theme: ThemeId, autoSync: boolean) => {
  if (themeChannel) {
    themeChannel.postMessage({ type: "THEME_CHANGE", theme, autoSync });
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(THEME_AUTO_SYNC_KEY, String(autoSync));
  } catch {}
};

export const subscribeThemeChange = (
  callback: (baseTheme: ThemeId, autoSync: boolean) => void
): (() => void) => {
  const channelHandler = (e: MessageEvent) => {
    if (e.data && e.data.type === "THEME_CHANGE") {
      callback(e.data.theme as ThemeId, Boolean(e.data.autoSync));
    }
  };

  const storageHandler = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY || e.key === THEME_AUTO_SYNC_KEY) {
      callback(getStoredTheme(), getStoredAutoSync());
    }
  };

  if (themeChannel) {
    themeChannel.addEventListener("message", channelHandler);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", storageHandler);
  }

  return () => {
    if (themeChannel) {
      themeChannel.removeEventListener("message", channelHandler);
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", storageHandler);
    }
  };
};

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(getStoredTheme);
  const [autoSync, setAutoSyncState] = useState<boolean>(getStoredAutoSync);

  const effectiveTheme = resolveEffectiveTheme(theme, autoSync);

  // Apply to DOM on mount and effectiveTheme change
  useEffect(() => {
    applyThemeToDom(effectiveTheme);
  }, [effectiveTheme]);

  // Sync across windows
  useEffect(() => {
    const unsubscribe = subscribeThemeChange((newTheme, newAutoSync) => {
      setThemeState(newTheme);
      setAutoSyncState(newAutoSync);
    });
    return () => unsubscribe();
  }, []);

  // Listen to OS dark/light changes if autoSync is active
  useEffect(() => {
    if (!autoSync || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    try {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const changeHandler = () => {
        applyThemeToDom(resolveEffectiveTheme(theme, true));
      };
      media.addEventListener("change", changeHandler);
      return () => media.removeEventListener("change", changeHandler);
    } catch {
      return;
    }
  }, [autoSync, theme]);

  const setTheme = useCallback(
    (newTheme: ThemeId) => {
      setThemeState(newTheme);
      broadcastThemeChange(newTheme, autoSync);
      applyThemeToDom(resolveEffectiveTheme(newTheme, autoSync));
    },
    [autoSync]
  );

  const setAutoSync = useCallback(
    (enabled: boolean) => {
      setAutoSyncState(enabled);
      broadcastThemeChange(theme, enabled);
      applyThemeToDom(resolveEffectiveTheme(theme, enabled));
    },
    [theme]
  );

  return {
    theme,
    effectiveTheme,
    autoSync,
    setTheme,
    setAutoSync,
    themeConfig: THEMES[effectiveTheme],
  };
}

