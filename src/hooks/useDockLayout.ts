import { useState, useEffect, useRef, useCallback } from "react";
import {
  updateDockSizes,
  restoreWorkArea,
  openSettingsWindow,
  setWindowState as invokeSetWindowState,
  setPanesReserveZonesMode,
  minimizeToTray,
} from "../services/tauriBridge";
import {
  getRememberedLeftWidth,
  getRememberedRightWidth,
  setRememberedLeftWidth,
  setRememberedRightWidth,
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  broadcastLayoutAction,
  subscribeLayoutAction,
  getMaxLeftWidth,
  getMaxRightWidth,
  getPanesReserveZones,
} from "../stores/layoutStore";
import { WindowModeState } from "../types/hud";
import { runLegacyStorageMigrationIfNeeded } from "../services/storageMigration";
import { checkForUpdates, AppUpdateInfo } from "../services/updaterService";

export const SNAP_POINTS = [
  { value: 68, label: "SQUARE ICONS" },
  { value: 220, label: "COMPACT" },
  { value: 280, label: "DEFAULT" },
  { value: 360, label: "EXPANDED" },
];

export const MIN_LEFT_WIDTH = 68;
export const MIN_MIDDLE_WIDTH = 340;

export type DockWindowType = "left" | "right" | "settings" | "snap-overlay" | "full";

export function useDockLayout(dockWindowType: DockWindowType = "full") {
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    const saved = localStorage.getItem("hud_left_width");
    return saved ? Math.round(Number(saved)) : 280;
  });

  const [rightWidth, setRightWidth] = useState<number>(() => {
    const saved = localStorage.getItem("hud_right_width");
    return saved ? Math.round(Number(saved)) : 280;
  });

  const [magneticSnap, setMagneticSnap] = useState<boolean>(true);
  const [desktopDockActive, setDesktopDockActive] = useState<boolean>(false);
  const [snapMode, setSnapMode] = useState<"fluid" | "grid-snap" | "ratio-16-9">("fluid");
  const [activeNav, setActiveNavState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("focushud_active_nav") || "home";
    }
    return "home";
  });

  const setActiveNav = (nav: string) => {
    if (nav === activeNav) return;
    setActiveNavState(nav);
    if (typeof window !== "undefined") {
      localStorage.setItem("focushud_active_nav", nav);
    }
    broadcastLayoutAction({ type: "SET_ACTIVE_NAV", nav, sender: dockWindowType });
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<string>("all");
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);

  const [maxLeftWidth, setMaxLeftWidth] = useState<number>(() => getMaxLeftWidth());
  const [maxRightWidth, setMaxRightWidth] = useState<number>(() => getMaxRightWidth());

  const [windowState, setWindowState] = useState<WindowModeState>(() => {
    if (typeof window !== "undefined") {
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
      const savedMax = localStorage.getItem("focushud_is_app_maximized");
      if (savedMax === "true") return "maximised";
      if (dockWindowType === "left" || dockWindowType === "right") return "split";
    }
    return "windowed";
  });

  const [priorFullscreenState, setPriorFullscreenState] = useState<WindowModeState>(() => {
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
  });

  const isJoinedMode = windowState !== "split";
  const isAppMaximized = windowState === "maximised";
  const isFullscreen = windowState === "fullscreen";
  const isMinimised = windowState === "minimised";

  const preMaximizedLayoutRef = useRef<{ left: number; right: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  // Check for updates on startup
  useEffect(() => {
    checkForUpdates(false)
      .then((info) => {
        if (info && info.available) {
          setUpdateInfo(info);
        }
      })
      .catch(() => {});
  }, []);

  // Track container width and run storage migration on mount
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      } else if (typeof window !== "undefined") {
        setContainerWidth(window.innerWidth);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      handleResize();
    }
    runLegacyStorageMigrationIfNeeded();
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, []);

  // Save widths to localStorage and remember expanded widths when >= 120px
  useEffect(() => {
    localStorage.setItem("hud_left_width", String(leftWidth));
    if (leftWidth >= 120) {
      setRememberedLeftWidth(leftWidth);
    }
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem("hud_right_width", String(rightWidth));
    if (rightWidth >= 120) {
      setRememberedRightWidth(rightWidth);
    }
  }, [rightWidth]);

  // Initial sync of dock sizes and reserve-zones mode on startup
  useEffect(() => {
    const reserve = getPanesReserveZones();
    if (dockWindowType === "left") {
      setPanesReserveZonesMode(reserve);
      updateDockSizes(leftWidth, null, true);
    } else if (dockWindowType === "right") {
      updateDockSizes(null, rightWidth, true);
    } else if (desktopDockActive) {
      setPanesReserveZonesMode(reserve);
      updateDockSizes(leftWidth, rightWidth, true);
    }
  }, [dockWindowType, desktopDockActive]);

  // Cross-window layout command listener (e.g. Maximize Panes)
  useEffect(() => {
    const unsubscribe = subscribeLayoutAction((action) => {
      // If the action was sent by another window, update local state only.
      // Do NOT re-invoke updateDockSizes to avoid duplicate Win32 work area / snap calculations.
      const isRemote = Boolean(action.sender && action.sender !== dockWindowType);

      if (action.type === "MAXIMIZE_APP") {
        setWindowState("maximised");
        if (typeof window !== "undefined") {
          localStorage.setItem("focushud_window_state", "maximised");
          localStorage.setItem("focushud_is_app_maximized", "true");
        }
      } else if (action.type === "RESTORE_APP") {
        setWindowState("windowed");
        if (typeof window !== "undefined") {
          localStorage.setItem("focushud_window_state", "windowed");
          localStorage.setItem("focushud_is_app_maximized", "false");
        }
        setLeftWidth(action.leftWidth);
        setRightWidth(action.rightWidth);
      } else if (action.type === "SET_WINDOW_STATE") {
        setWindowState(action.state);
        if (action.priorFullscreenState) {
          setPriorFullscreenState(action.priorFullscreenState);
          if (typeof window !== "undefined") {
            localStorage.setItem(
              "focushud_prior_fullscreen_state",
              action.priorFullscreenState
            );
          }
        }
        if (typeof window !== "undefined") {
          localStorage.setItem("focushud_window_state", action.state);
          localStorage.setItem(
            "focushud_is_app_maximized",
            String(action.state === "maximised")
          );
        }
        if (action.leftWidth !== undefined) setLeftWidth(action.leftWidth);
        if (action.rightWidth !== undefined) setRightWidth(action.rightWidth);
      } else if (action.type === "SET_ACTIVE_NAV") {
        setActiveNavState(action.nav);
        if (typeof window !== "undefined") {
          localStorage.setItem("focushud_active_nav", action.nav);
        }
      } else if (action.type === "MAXIMIZE_PANES") {
        const prevL = getRememberedLeftWidth();
        const prevR = getRememberedRightWidth();
        setLeftWidth(prevL);
        setRightWidth(prevR);
        if (!isRemote && (dockWindowType !== "full" || desktopDockActive)) {
          updateDockSizes(prevL, prevR, true);
        }
      } else if (action.type === "SET_PANES_WIDTH") {
        setLeftWidth(action.leftWidth);
        setRightWidth(action.rightWidth);
        if (!isRemote && (dockWindowType !== "full" || desktopDockActive)) {
          updateDockSizes(action.leftWidth, action.rightWidth, true);
        }
      } else if (action.type === "SET_LEFT_WIDTH") {
        setLeftWidth(action.width);
        if (!isRemote && (dockWindowType !== "full" || desktopDockActive)) {
          updateDockSizes(action.width, null, true);
        }
      } else if (action.type === "SET_RIGHT_WIDTH") {
        setRightWidth(action.width);
        if (!isRemote && (dockWindowType !== "full" || desktopDockActive)) {
          updateDockSizes(null, action.width, true);
        }
      } else if (action.type === "SET_MAX_WIDTHS") {
        setMaxLeftWidth(action.maxLeftWidth);
        setMaxRightWidth(action.maxRightWidth);
      } else if (action.type === "SET_PANES_RESERVE_ZONES") {
        if (dockWindowType === "left" || (dockWindowType === "full" && desktopDockActive)) {
          setPanesReserveZonesMode(action.reserve);
        }
      }
    });
    return () => unsubscribe();
  }, [dockWindowType, desktopDockActive]);

  const handleOpenSettings = async (tab: string = "all") => {
    setSettingsTab(tab);
    try {
      localStorage.setItem("hud_settings_tab", tab);
    } catch {
      // ignore
    }
    if (dockWindowType !== "full") {
      const opened = await openSettingsWindow();
      if (!opened) {
        setIsSettingsOpen(true);
      }
    } else {
      setIsSettingsOpen(true);
    }
  };

  const handleToggleDesktopDock = async () => {
    if (desktopDockActive) {
      await restoreWorkArea();
      setDesktopDockActive(false);
    } else {
      await updateDockSizes(leftWidth, rightWidth, true);
      setDesktopDockActive(true);
    }
  };

  // Drag handlers for Left Bar
  const handleLeftDragChange = (newWidth: number) => {
    setLeftWidth(newWidth);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(newWidth, null, false);
    }
  };

  const handleLeftDragEnd = (finalWidth: number) => {
    setLeftWidth(finalWidth);
    if (finalWidth >= 120) {
      setRememberedLeftWidth(finalWidth);
    }
    broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: finalWidth, sender: dockWindowType });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(finalWidth, null, true);
    }
  };

  const handleLeftDoubleClick = () => {
    if (leftWidth <= 70) {
      const next = getRememberedLeftWidth();
      setLeftWidth(next);
      broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: next, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(next, null, true);
      }
    } else {
      setRememberedLeftWidth(leftWidth);
      setLeftWidth(68);
      broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: 68, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(68, null, true);
      }
    }
  };

  // Toggle expand / collapse both panes simultaneously
  const handleToggleBothPanes = () => {
    if (leftWidth < 120 || rightWidth < 120) {
      const prevLeft = getRememberedLeftWidth();
      const prevRight = getRememberedRightWidth();
      setLeftWidth(prevLeft);
      setRightWidth(prevRight);
      broadcastLayoutAction({
        type: "SET_PANES_WIDTH",
        leftWidth: prevLeft,
        rightWidth: prevRight,
        sender: dockWindowType,
      });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(prevLeft, prevRight, true);
      }
    } else {
      setRememberedLeftWidth(leftWidth);
      setRememberedRightWidth(rightWidth);
      setLeftWidth(68);
      setRightWidth(68);
      broadcastLayoutAction({
        type: "SET_PANES_WIDTH",
        leftWidth: 68,
        rightWidth: 68,
        sender: dockWindowType,
      });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(68, 68, true);
      }
    }
  };

  // Toggle left pane individually
  const handleToggleLeftPane = () => {
    if (leftWidth < 120) {
      const next = getRememberedLeftWidth();
      setLeftWidth(next);
      broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: next, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(next, null, true);
      }
    } else {
      setRememberedLeftWidth(leftWidth);
      setLeftWidth(68);
      broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: 68, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(68, null, true);
      }
    }
  };

  // Toggle right pane individually
  const handleToggleRightPane = () => {
    if (rightWidth < 120) {
      const next = getRememberedRightWidth();
      setRightWidth(next);
      broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: next, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(null, next, true);
      }
    } else {
      setRememberedRightWidth(rightWidth);
      setRightWidth(68);
      broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: 68, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(null, 68, true);
      }
    }
  };

  const handleLeftToggleCollapse = handleToggleLeftPane;
  const handleRightToggleCollapse = handleToggleRightPane;

  const handleMaximizePanes = () => {
    const prevLeft = getRememberedLeftWidth();
    const prevRight = getRememberedRightWidth();
    setLeftWidth(prevLeft);
    setRightWidth(prevRight);
    broadcastLayoutAction({ type: "MAXIMIZE_PANES", sender: dockWindowType });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(prevLeft, prevRight, true);
    }
  };

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
    });
    await invokeSetWindowState("maximised");
  }, [windowState, leftWidth, rightWidth, dockWindowType]);

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
  }, [dockWindowType]);

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
  }, [windowState, leftWidth, rightWidth, dockWindowType]);

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
  }, [dockWindowType, desktopDockActive]);

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
  }, [priorFullscreenState, dockWindowType, handleClickSplit]);

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

  const handleClickJoin = handleClickMaximise;

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
  }, [dockWindowType]);

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
  }, [dockWindowType]);

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
    });
    await invokeSetWindowState("maximised");
  }, [dockWindowType]);

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
  }, [dockWindowType]);

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

  // Drag handlers for Right Bar
  const handleRightDragChange = (newWidth: number) => {
    setRightWidth(newWidth);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(null, newWidth, false);
    }
  };

  const handleRightDragEnd = (finalWidth: number) => {
    setRightWidth(finalWidth);
    if (finalWidth >= 120) {
      setRememberedRightWidth(finalWidth);
    }
    broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: finalWidth, sender: dockWindowType });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(null, finalWidth, true);
    }
  };

  const handleRightDoubleClick = () => {
    if (rightWidth <= 70) {
      const next = getRememberedRightWidth();
      setRightWidth(next);
      broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: next, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(null, next, true);
      }
    } else {
      setRememberedRightWidth(rightWidth);
      setRightWidth(68);
      broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: 68, sender: dockWindowType });
      if (dockWindowType !== "full" || desktopDockActive) {
        updateDockSizes(null, 68, true);
      }
    }
  };

  const handleResetWidths = () => {
    setRememberedLeftWidth(DEFAULT_LEFT_WIDTH);
    setRememberedRightWidth(DEFAULT_RIGHT_WIDTH);
    setLeftWidth(DEFAULT_LEFT_WIDTH);
    setRightWidth(DEFAULT_RIGHT_WIDTH);
    broadcastLayoutAction({
      type: "SET_PANES_WIDTH",
      leftWidth: DEFAULT_LEFT_WIDTH,
      rightWidth: DEFAULT_RIGHT_WIDTH,
      sender: dockWindowType,
    });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(DEFAULT_LEFT_WIDTH, DEFAULT_RIGHT_WIDTH, true);
    }
  };

  const handleApplyPreset = (left: number, right: number) => {
    setLeftWidth(left);
    setRightWidth(right);
    broadcastLayoutAction({
      type: "SET_PANES_WIDTH",
      leftWidth: left,
      rightWidth: right,
      sender: dockWindowType,
    });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(left, right, true);
    }
  };

  const handleReset = () => {
    setLeftWidth(280);
    setRightWidth(280);
    setMagneticSnap(true);
    restoreWorkArea();
    setDesktopDockActive(false);
    broadcastLayoutAction({
      type: "SET_PANES_WIDTH",
      leftWidth: 280,
      rightWidth: 280,
      sender: dockWindowType,
    });
  };

  const middleWidth = Math.max(
    MIN_MIDDLE_WIDTH,
    containerWidth - leftWidth - rightWidth
  );

  return {
    dockWindowType,
    leftWidth,
    setLeftWidth,
    rightWidth,
    setRightWidth,
    maxLeftWidth,
    maxRightWidth,
    containerRef,
    containerWidth,
    middleWidth,
    magneticSnap,
    setMagneticSnap,
    desktopDockActive,
    setDesktopDockActive,
    handleToggleDesktopDock,
    snapMode,
    setSnapMode,
    activeNav,
    setActiveNav,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    updateInfo,
    setUpdateInfo,
    handleOpenSettings,
    handleLeftDragChange,
    handleLeftDragEnd,
    handleLeftDoubleClick,
    handleLeftToggleCollapse,
    handleToggleLeftPane,
    handleRightDragChange,
    handleRightDragEnd,
    handleRightDoubleClick,
    handleRightToggleCollapse,
    handleToggleRightPane,
    handleToggleBothPanes,
    handleMaximizePanes,
    windowState,
    setWindowState,
    priorFullscreenState,
    isJoinedMode,
    isAppMaximized,
    isFullscreen,
    isMinimised,
    handleClickMaximise,
    handleClickRestoreDown,
    handleClickFullscreen,
    handleClickExitFullscreen,
    handleToggleFullscreen,
    handleClickSplit,
    handleClickJoin,
    handleClickMinimise,
    handleTrayOpenWindowed,
    handleTrayOpenMaximised,
    handleTrayOpenFullscreen,
    handleToggleMaximizeApp,
    handleResetWidths,
    handleApplyPreset,
    handleReset,
    SNAP_POINTS,
    MIN_LEFT_WIDTH,
    MIN_MIDDLE_WIDTH,
  };
}

export type UseDockLayoutReturn = ReturnType<typeof useDockLayout>;

