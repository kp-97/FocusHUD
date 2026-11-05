import { useState, useEffect, useRef } from "react";
import {
  updateDockSizes,
  restoreWorkArea,
  openSettingsWindow,
  setFullscreenMode,
  setPanesReserveZonesMode,
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

  const [isAppMaximized, setIsAppMaximized] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("focushud_is_app_maximized");
      if (saved !== null) return saved === "true";
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("dock") === "full") return true;
    }
    return false;
  });
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
        setIsAppMaximized(true);
        if (typeof window !== "undefined") {
          localStorage.setItem("focushud_is_app_maximized", "true");
        }
      } else if (action.type === "RESTORE_APP") {
        setIsAppMaximized(false);
        if (typeof window !== "undefined") {
          localStorage.setItem("focushud_is_app_maximized", "false");
        }
        setLeftWidth(action.leftWidth);
        setRightWidth(action.rightWidth);
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

  const handleToggleMaximizeApp = async () => {
    if (!isAppMaximized) {
      preMaximizedLayoutRef.current = { left: leftWidth, right: rightWidth };
      setIsAppMaximized(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("focushud_is_app_maximized", "true");
      }
      broadcastLayoutAction({
        type: "MAXIMIZE_APP",
        sender: dockWindowType,
      });
      await setFullscreenMode(true);
    } else {
      setIsAppMaximized(false);
      if (typeof window !== "undefined") {
        localStorage.setItem("focushud_is_app_maximized", "false");
      }
      const restored = preMaximizedLayoutRef.current || {
        left: getRememberedLeftWidth(),
        right: getRememberedRightWidth(),
      };
      setLeftWidth(restored.left);
      setRightWidth(restored.right);
      broadcastLayoutAction({
        type: "RESTORE_APP",
        leftWidth: restored.left,
        rightWidth: restored.right,
        sender: dockWindowType,
      });
      await setFullscreenMode(false);
      if (getPanesReserveZones() && (dockWindowType !== "full" || desktopDockActive)) {
        await updateDockSizes(restored.left, restored.right, true);
      }
    }
  };

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
    isAppMaximized,
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

