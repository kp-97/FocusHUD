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
}: PaneResizeHandlersParams) {
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

