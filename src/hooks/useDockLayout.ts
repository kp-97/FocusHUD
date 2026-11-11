import { useState, useEffect, useRef } from "react";
import {
  updateDockSizes,
  restoreWorkArea,
  openSettingsWindow,
  getWindowState,
  setPanesReserveZonesMode,
} from "../services/tauriBridge";
import {
  useWindowModeManager,
  getInitialWindowState,
  getInitialPriorFullscreenState,
} from "./useWindowModeManager";
import { usePaneResizeHandlers } from "./usePaneResizeHandlers";
import {
  getRememberedLeftWidth,
  getRememberedRightWidth,
  setRememberedLeftWidth,
  setRememberedRightWidth,
  getInitialNav,
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
  const [activeNav, setActiveNavState] = useState<string>(() => getInitialNav());

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

  const [windowState, setWindowState] = useState<WindowModeState>(() =>
    getInitialWindowState(dockWindowType)
  );

  const [priorFullscreenState, setPriorFullscreenState] = useState<WindowModeState>(() =>
    getInitialPriorFullscreenState()
  );

  const isJoinedMode = windowState !== "split";
  const isAppMaximized = windowState === "maximised";
  const isFullscreen = windowState === "fullscreen";
  const isMinimised = windowState === "minimised";

  const preMaximizedLayoutRef = useRef<{ left: number; right: number } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  const centerLineWidth =
    typeof window !== "undefined"
      ? Math.round(
          (dockWindowType === "full"
            ? containerWidth
            : window.screen?.availWidth || window.screen?.width || window.innerWidth || 1920) / 2
        )
      : 960;

  // Check for updates on startup
  useEffect(() => {
    checkForUpdates(false)
      .then((info) => {
        if (info && info.available) {
          setUpdateInfo(info);
        }
      })
      .catch(() => {});

    getWindowState()
      .then((st) => {
        if (st) {
          setWindowState(st);
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

  // Save widths to localStorage and remember expanded widths when >= 120px (unless near center line joining)
  useEffect(() => {
    localStorage.setItem("hud_left_width", String(leftWidth));
    if (leftWidth >= 120 && (!centerLineWidth || leftWidth < centerLineWidth - 14)) {
      setRememberedLeftWidth(leftWidth);
    }
  }, [leftWidth, centerLineWidth]);

  useEffect(() => {
    localStorage.setItem("hud_right_width", String(rightWidth));
    if (rightWidth >= 120 && (!centerLineWidth || rightWidth < centerLineWidth - 14)) {
      setRememberedRightWidth(rightWidth);
    }
  }, [rightWidth, centerLineWidth]);

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

  const {
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
  } = useWindowModeManager({
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
  });

  const {
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
    handleResetWidths,
    handleApplyPreset,
    handleReset,
  } = usePaneResizeHandlers({
    leftWidth,
    setLeftWidth,
    rightWidth,
    setRightWidth,
    dockWindowType,
    desktopDockActive,
    setDesktopDockActive,
    setMagneticSnap,
    windowState,
    onJoin: handleClickJoin,
    centerLineWidth,
  });

  const snapPoints = magneticSnap
    ? [
        ...SNAP_POINTS,
        { value: centerLineWidth, label: isJoinedMode ? "CENTER (50%)" : "JOIN APP" },
      ]
    : [];

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
    centerLineWidth,
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
    snapPoints,
    MIN_LEFT_WIDTH,
    MIN_MIDDLE_WIDTH,
  };
}

export type UseDockLayoutReturn = ReturnType<typeof useDockLayout>;

