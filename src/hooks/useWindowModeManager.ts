import { useCallback, useEffect, MutableRefObject } from "react";
import {
  setWindowState as invokeSetWindowState,
  minimizeToTray,
  updateDockSizes,
} from "../services/tauriBridge";
import {
  broadcastLayoutAction,
  getRememberedLeftWidth,
  getRememberedRightWidth,
  getPanesReserveZones,
} from "../stores/layoutStore";
import { WindowModeState } from "../types/hud";
import type { DockWindowType } from "./useDockLayout";

export function getInitialWindowState(dockWindowType: DockWindowType): WindowModeState {
  if (typeof window !== "undefined") {
    if (dockWindowType === "left" || dockWindowType === "right") {
      return "split";
    }

    const isUltrawide =
      window.screen.width / Math.max(1, window.screen.height) > 16 / 9 + 0.01;
    const bootState: WindowModeState = isUltrawide ? "split" : "maximised";

    const hasBooted = sessionStorage.getItem("focushud_booted");
    if (!hasBooted) {
      sessionStorage.setItem("focushud_booted", "true");
      localStorage.setItem("focushud_window_state", bootState);
      localStorage.setItem(
        "focushud_is_app_maximized",
        String(bootState === "maximised")
      );
      return bootState;
    }

    const savedState = localStorage.getItem("focushud_window_state") as WindowModeState | null;
    if (
      savedState === "windowed" ||
      savedState === "maximised" ||
      savedState === "fullscreen" ||
      savedState === "minimised" ||
      savedState === "split"
    ) {
      return savedState;
    }
    return bootState;
  }
  return "maximised";
}

export function getInitialPriorFullscreenState(): WindowModeState {
  if (typeof window !== "undefined") {
    const savedPrior = localStorage.getItem(
      "focushud_prior_fullscreen_state"
    ) as WindowModeState | null;
    if (
      savedPrior === "windowed" ||
      savedPrior === "maximised" ||
      savedPrior === "minimised" ||
      savedPrior === "split"
    ) {
      return savedPrior;
    }
  }
  return "windowed";
}

export interface WindowModeManagerParams {
  windowState: WindowModeState;
  setWindowState: (state: WindowModeState) => void;
  priorFullscreenState: WindowModeState;
  setPriorFullscreenState: (state: WindowModeState) => void;
  leftWidth: number;
  setLeftWidth: (width: number) => void;
  rightWidth: number;
  setRightWidth: (width: number) => void;
  dockWindowType: DockWindowType;
  desktopDockActive: boolean;
  preMaximizedLayoutRef: MutableRefObject<{ left: number; right: number } | null>;
  setIsDualView?: (dual: boolean) => void;
  setJointLeftWidth?: (width: number) => void;
}

export function useWindowModeManager({
  windowState,
  setWindowState,
  priorFullscreenState,
  setPriorFullscreenState,
  leftWidth,
  setLeftWidth,
  rightWidth,
  setRightWidth,
  dockWindowType,
  desktopDockActive,
  preMaximizedLayoutRef,
  setIsDualView,
  setJointLeftWidth,
}: WindowModeManagerParams) {
  const handleClickMaximise = useCallback(async () => {
    if (windowState === "split") {
      preMaximizedLayoutRef.current = { left: leftWidth, right: rightWidth };
    }
    setWindowState("maximised");
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_window_state", "maximised");
      localStorage.setItem("focushud_is_app_maximized", "true");
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: "maximised",
      sender: dockWindowType,
      leftWidth,
      rightWidth,
    });
    await invokeSetWindowState("maximised");
  }, [windowState, leftWidth, rightWidth, dockWindowType, preMaximizedLayoutRef, setWindowState]);

  const handleClickRestoreDown = useCallback(async () => {
    setWindowState("windowed");
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_window_state", "windowed");
      localStorage.setItem("focushud_is_app_maximized", "false");
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: "windowed",
      sender: dockWindowType,
    });
    await invokeSetWindowState("windowed");
  }, [dockWindowType, setWindowState]);

  const handleClickFullscreen = useCallback(async () => {
    if (windowState === "split") {
      preMaximizedLayoutRef.current = { left: leftWidth, right: rightWidth };
    }
    const prior: WindowModeState =
      windowState === "maximised"
        ? "maximised"
        : windowState === "minimised"
        ? "minimised"
        : windowState === "split"
        ? "split"
        : "windowed";
    setPriorFullscreenState(prior);
    setWindowState("fullscreen");
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_prior_fullscreen_state", prior);
      localStorage.setItem("focushud_window_state", "fullscreen");
      localStorage.setItem("focushud_is_app_maximized", "false");
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: "fullscreen",
      priorFullscreenState: prior,
      sender: dockWindowType,
    });
    await invokeSetWindowState("fullscreen");
  }, [windowState, leftWidth, rightWidth, dockWindowType, preMaximizedLayoutRef, setPriorFullscreenState, setWindowState]);

  const handleClickSplit = useCallback(async () => {
    const restored = preMaximizedLayoutRef.current || {
      left: getRememberedLeftWidth(),
      right: getRememberedRightWidth(),
    };
    setWindowState("split");
    setLeftWidth(restored.left);
    setRightWidth(restored.right);
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_window_state", "split");
      localStorage.setItem("focushud_is_app_maximized", "false");
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: "split",
      leftWidth: restored.left,
      rightWidth: restored.right,
      sender: dockWindowType,
    });
    await invokeSetWindowState("split");
    if (getPanesReserveZones() && (dockWindowType !== "full" || desktopDockActive)) {
      await updateDockSizes(restored.left, restored.right, true);
    }
  }, [dockWindowType, desktopDockActive, preMaximizedLayoutRef, setWindowState, setLeftWidth, setRightWidth]);

  const handleClickExitFullscreen = useCallback(async () => {
    const target: WindowModeState = priorFullscreenState || "windowed";
    if (target === "split") {
      await handleClickSplit();
      return;
    }
    setWindowState(target);
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_window_state", target);
      localStorage.setItem(
        "focushud_is_app_maximized",
        String(target === "maximised")
      );
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: target,
      sender: dockWindowType,
    });
    if (target === "minimised") {
      await minimizeToTray();
      await invokeSetWindowState("minimised");
    } else {
      await invokeSetWindowState(target);
    }
  }, [priorFullscreenState, dockWindowType, handleClickSplit, setWindowState]);

  const handleToggleFullscreen = useCallback(async () => {
    if (windowState === "fullscreen") {
      await handleClickExitFullscreen();
    } else if (
      windowState === "windowed" ||
      windowState === "maximised" ||
      windowState === "split"
    ) {
      await handleClickFullscreen();
    }
  }, [windowState, handleClickExitFullscreen, handleClickFullscreen]);

  const handleClickJoin = useCallback(
    async (dual?: boolean, targetNav?: string, jointWidth?: number) => {
      if (windowState === "split") {
        preMaximizedLayoutRef.current = { left: leftWidth, right: rightWidth };
      }
      setWindowState("maximised");
      if (typeof window !== "undefined") {
        localStorage.setItem("focushud_window_state", "maximised");
        localStorage.setItem("focushud_is_app_maximized", "true");
        if (typeof dual === "boolean") {
          localStorage.setItem("focushud_joint_dual_view", String(dual));
        }
        if (typeof jointWidth === "number") {
          localStorage.setItem("focushud_joint_left_width", String(Math.round(jointWidth)));
        }
        if (targetNav) {
          localStorage.setItem("focushud_active_nav", targetNav);
        }
      }
      if (typeof dual === "boolean" && setIsDualView) {
        setIsDualView(dual);
      }
      if (typeof jointWidth === "number" && setJointLeftWidth) {
        setJointLeftWidth(jointWidth);
      }
      broadcastLayoutAction({
        type: "SET_WINDOW_STATE",
        state: "maximised",
        sender: dockWindowType,
        leftWidth,
        rightWidth,
        isDualView: dual,
        jointLeftWidth: jointWidth,
      });
      if (targetNav) {
        broadcastLayoutAction({
          type: "SET_ACTIVE_NAV",
          nav: targetNav,
          sender: dockWindowType,
        });
      }
      await invokeSetWindowState("maximised");
    },
    [windowState, leftWidth, rightWidth, dockWindowType, preMaximizedLayoutRef, setWindowState, setIsDualView, setJointLeftWidth]
  );

  const handleClickMinimise = useCallback(async () => {
    setWindowState("minimised");
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_window_state", "minimised");
      localStorage.setItem("focushud_is_app_maximized", "false");
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: "minimised",
      sender: dockWindowType,
    });
    await minimizeToTray();
    await invokeSetWindowState("minimised");
  }, [dockWindowType, setWindowState]);

  const handleTrayOpenWindowed = useCallback(async () => {
    setWindowState("windowed");
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_window_state", "windowed");
      localStorage.setItem("focushud_is_app_maximized", "false");
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: "windowed",
      sender: dockWindowType,
    });
    await invokeSetWindowState("windowed");
  }, [dockWindowType, setWindowState]);

  const handleTrayOpenMaximised = useCallback(async () => {
    setWindowState("maximised");
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_window_state", "maximised");
      localStorage.setItem("focushud_is_app_maximized", "true");
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: "maximised",
      sender: dockWindowType,
      leftWidth,
      rightWidth,
    });
    await invokeSetWindowState("maximised");
  }, [dockWindowType, setWindowState]);

  const handleTrayOpenFullscreen = useCallback(async () => {
    setPriorFullscreenState("minimised");
    setWindowState("fullscreen");
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_prior_fullscreen_state", "minimised");
      localStorage.setItem("focushud_window_state", "fullscreen");
      localStorage.setItem("focushud_is_app_maximized", "false");
    }
    broadcastLayoutAction({
      type: "SET_WINDOW_STATE",
      state: "fullscreen",
      priorFullscreenState: "minimised",
      sender: dockWindowType,
    });
    await invokeSetWindowState("fullscreen");
  }, [dockWindowType, setPriorFullscreenState, setWindowState]);

  const handleToggleMaximizeApp = async () => {
    if (windowState === "maximised" || windowState === "fullscreen") {
      await handleClickRestoreDown();
    } else {
      await handleClickMaximise();
    }
  };

  // F11 shortcut for toggling Fullscreen from Windowed, Maximised, or Split
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        if (windowState === "fullscreen") {
          void handleClickExitFullscreen();
        } else if (
          windowState === "windowed" ||
          windowState === "maximised" ||
          windowState === "split"
        ) {
          void handleClickFullscreen();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [windowState, handleClickExitFullscreen, handleClickFullscreen]);

  // Listen for system tray restore events (Open, Open Maximised, Open in Fullscreen)
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    let mounted = true;
    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<string>("tray-window-state", (event) => {
          if (!mounted) return;
          const target = event.payload;
          if (target === "windowed") {
            void handleTrayOpenWindowed();
          } else if (target === "maximised") {
            void handleTrayOpenMaximised();
          } else if (target === "fullscreen") {
            void handleTrayOpenFullscreen();
          }
        })
      )
      .then((fn) => {
        if (mounted) {
          unlisten = fn;
        } else {
          fn();
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (unlisten) unlisten();
    };
  }, [handleTrayOpenWindowed, handleTrayOpenMaximised, handleTrayOpenFullscreen]);

  return {
    handleClickMaximise,
    handleClickRestoreDown,
    handleClickFullscreen,
    handleClickSplit,
    handleClickExitFullscreen,
    handleToggleFullscreen,
    handleClickJoin,
    handleClickMinimise,
    handleToggleMaximizeApp,
    handleTrayOpenWindowed,
    handleTrayOpenMaximised,
    handleTrayOpenFullscreen,
  };
}
