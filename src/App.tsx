import { useMemo } from "react";
import { useTheme } from "./stores/themeStore";
import { useSpellcheck } from "./stores/spellcheckStore";
import { useDockLayout, DockWindowType } from "./hooks/useDockLayout";
import {
  LeftDockApp,
  RightDockApp,
  SettingsModalApp,
  FullLayoutApp,
} from "./components/layout/apps";

export default function App() {
  // Initialize and synchronize HUD multi-theme engine and spellcheck dictionary
  useTheme();
  useSpellcheck();

  // Check if opened as dedicated dock window (e.g. ?dock=left or ?dock=right or ?dock=settings)
  const dockWindowType = useMemo<DockWindowType>(() => {
    if (typeof window === "undefined") return "full";
    const urlParams = new URLSearchParams(window.location.search);
    const dockParam = urlParams.get("dock");
    const viewParam = urlParams.get("view");
    if (dockParam === "settings" || viewParam === "settings") return "settings";
    if (dockParam === "left") return "left";
    if (dockParam === "right") return "right";
    return "full";
  }, []);

  const layout = useDockLayout(dockWindowType);

  // Dedicated Centered Settings window
  if (dockWindowType === "settings") {
    return <SettingsModalApp layout={layout} />;
  }

  // Dedicated Left Dock window
  if (dockWindowType === "left") {
    return <LeftDockApp layout={layout} />;
  }

  // Dedicated Right Dock window
  if (dockWindowType === "right") {
    return <RightDockApp layout={layout} />;
  }

  // Default Unified 3-Column Layout (Full workspace / browser fallback)
  return <FullLayoutApp layout={layout} />;
}
