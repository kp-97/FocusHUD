import {
  updateDockSizes,
  restoreWorkArea,
} from "../services/tauriBridge";
import {
  getRememberedLeftWidth,
  getRememberedRightWidth,
  setRememberedLeftWidth,
  setRememberedRightWidth,
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  broadcastLayoutAction,
} from "../stores/layoutStore";
import type { WindowModeState } from "../types/hud";
import type { DockWindowType } from "./useDockLayout";

export interface PaneResizeHandlersParams {
  leftWidth: number;
  setLeftWidth: (width: number) => void;
  rightWidth: number;
  setRightWidth: (width: number) => void;
  dockWindowType: DockWindowType;
  desktopDockActive: boolean;
  setDesktopDockActive: (active: boolean) => void;
  setMagneticSnap: (snap: boolean) => void;
  windowState?: WindowModeState;
  onJoin?: (dual?: boolean, targetNav?: string, jointWidth?: number) => Promise<void> | void;
  centerLineWidth?: number;
  containerWidth?: number;
  activeNav?: string;
  currentRightNav?: string;
}

export function usePaneResizeHandlers({
  leftWidth,
  setLeftWidth,
  rightWidth,
  setRightWidth,
  dockWindowType,
  desktopDockActive,
  setDesktopDockActive,
  setMagneticSnap,
  windowState,
  onJoin,
  containerWidth,
  activeNav,
  currentRightNav,
}: PaneResizeHandlersParams) {
  // Drag handlers for Left Bar
  const handleLeftDragChange = (newWidth: number) => {
    setLeftWidth(newWidth);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(newWidth, null, false);
    }
  };

  const handleLeftDragEnd = (finalWidth: number) => {
    const isSplit =
      windowState === "split" || dockWindowType === "left" || dockWindowType === "right";
    const totalWidth =
      containerWidth ||
      (typeof window !== "undefined"
        ? window.screen?.availWidth || window.screen?.width || window.innerWidth || 1920
        : 1920);

    const isRightCollapsed = rightWidth <= 70;
    const connectTargetWidth = isRightCollapsed ? totalWidth - 68 : totalWidth - rightWidth;
    const isConnecting = Boolean(onJoin && isSplit && finalWidth >= connectTargetWidth - 14);

    setLeftWidth(finalWidth);
    if (finalWidth >= 120 && !isConnecting) {
      setRememberedLeftWidth(finalWidth);
    }
    broadcastLayoutAction({ type: "SET_LEFT_WIDTH", width: finalWidth, sender: dockWindowType });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(finalWidth, null, true);
    }
    if (isConnecting && onJoin) {
      if (isRightCollapsed) {
        onJoin(false, activeNav);
      } else {
        const dividerPos = Math.max(200, Math.min(totalWidth - 200, finalWidth));
        onJoin(true, undefined, dividerPos);
      }
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

  // Drag handlers for Right Bar
  const handleRightDragChange = (newWidth: number) => {
    setRightWidth(newWidth);
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(null, newWidth, false);
    }
  };

  const handleRightDragEnd = (finalWidth: number) => {
    const isSplit =
      windowState === "split" || dockWindowType === "left" || dockWindowType === "right";
    const totalWidth =
      containerWidth ||
      (typeof window !== "undefined"
        ? window.screen?.availWidth || window.screen?.width || window.innerWidth || 1920
        : 1920);

    const isLeftCollapsed = leftWidth <= 70;
    const connectTargetWidth = isLeftCollapsed ? totalWidth - 68 : totalWidth - leftWidth;
    const isConnecting = Boolean(onJoin && isSplit && finalWidth >= connectTargetWidth - 14);

    setRightWidth(finalWidth);
    if (finalWidth >= 120 && !isConnecting) {
      setRememberedRightWidth(finalWidth);
    }
    broadcastLayoutAction({ type: "SET_RIGHT_WIDTH", width: finalWidth, sender: dockWindowType });
    if (dockWindowType !== "full" || desktopDockActive) {
      updateDockSizes(null, finalWidth, true);
    }
    if (isConnecting && onJoin) {
      if (isLeftCollapsed) {
        onJoin(false, currentRightNav);
      } else {
        const dividerPos = Math.max(200, Math.min(totalWidth - 200, totalWidth - finalWidth));
        onJoin(true, undefined, dividerPos);
      }
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

  return {
    handleLeftDragChange,
    handleLeftDragEnd,
    handleLeftDoubleClick,
    handleLeftToggleCollapse: handleToggleLeftPane,
    handleToggleLeftPane,
    handleRightDragChange,
    handleRightDragEnd,
    handleRightDoubleClick,
    handleRightToggleCollapse: handleToggleRightPane,
    handleToggleRightPane,
    handleToggleBothPanes,
    handleMaximizePanes,
    handleResetWidths,
    handleApplyPreset,
    handleReset,
  };
}

