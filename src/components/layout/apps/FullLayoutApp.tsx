import React, { useRef } from "react";
import { LeftSidebar } from "../LeftSidebar/LeftSidebar";
import { RightSidebar } from "../RightSidebar/RightSidebar";
import { ResizeHandle } from "../ResizeHandle";
import { UpdateNotificationToast } from "../../ui/UpdateNotificationToast";
import { SettingsModal } from "../../features/settings/SettingsModal";
import { JointDualViewContainer } from "./JointDualViewContainer";
import { UseDockLayoutReturn } from "../../../hooks/useDockLayout";
import {
  startDraggingWindow,
  moveWindowByDelta,
  startResizeWindow,
  resizeWindowByDelta,
} from "../../../services/tauriBridge";
import { HomeView } from "../../views/HomeView";
import { ChatView } from "../../views/ChatView";
import { CalendarView } from "../../views/CalendarView";
import { GoalsView } from "../../views/GoalsView";
import { TasksView } from "../../views/TasksView";
import { NotesView } from "../../views/NotesView";
import { KanbanView } from "../../views/KanbanView";
import { ActionPlansView } from "../../views/ActionPlansView";
import { PomodoroDial } from "../../features/pomodoro/PomodoroDial";

interface FullLayoutAppProps {
  layout: UseDockLayoutReturn;
}

export const FullLayoutApp: React.FC<FullLayoutAppProps> = ({ layout }) => {
  const {
    leftWidth,
    rightWidth,
    containerRef,
    containerWidth,
    middleWidth,
    activeNav,
    setActiveNav,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
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
    isJoinedMode,
    isAppMaximized,
    handleClickMaximise,
    handleClickRestoreDown,
    handleClickFullscreen,
    handleClickExitFullscreen,
    handleClickSplit,
    handleClickJoin,
    handleClickMinimise,
    handleToggleMaximizeApp,
    handleResetWidths,
    centerLineWidth,
    snapPoints,
    leftMaxWidth,
    leftSnapPoints,
    rightMaxWidth,
    rightSnapPoints,
    isDualView,
    jointLeftWidth,
    currentRightNav,
    setCurrentRightNav,
    handleToggleJointDualView,
    handleJointDividerChange,
    handleJointDividerEnd,
    MIN_LEFT_WIDTH,
  } = layout;

  const renderFullScreenView = (nav: string) => {
    switch (nav) {
      case "home":
        return <HomeView />;
      case "chat":
        return <ChatView />;
      case "calendar":
        return <CalendarView />;
      case "goals":
        return <GoalsView />;
      case "tasks":
        return <TasksView />;
      case "notes":
        return <NotesView />;
      case "kanban":
        return <KanbanView />;
      case "action_plans":
        return <ActionPlansView />;
      case "timer":
        return <PomodoroDial isCompact={false} />;
      default:
        return <HomeView />;
    }
  };

  const isDraggingWindowRef = useRef(false);
  const lastDragPosRef = useRef({ x: 0, y: 0 });

  const handleTopBarPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") || e.button !== 0) return;
    isDraggingWindowRef.current = true;
    lastDragPosRef.current = { x: e.screenX, y: e.screenY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    void startDraggingWindow();
  };

  const handleTopBarPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWindowRef.current) return;
    const dX = e.screenX - lastDragPosRef.current.x;
    const dY = e.screenY - lastDragPosRef.current.y;
    const scale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const physDX = Math.round(dX * scale);
    const physDY = Math.round(dY * scale);
    if (physDX !== 0 || physDY !== 0) {
      lastDragPosRef.current.x += physDX / scale;
      lastDragPosRef.current.y += physDY / scale;
      void moveWindowByDelta(physDX, physDY);
    }
  };

  const handleTopBarPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingWindowRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const activeResizeEdgeRef = useRef<string | null>(null);
  const lastResizePosRef = useRef({ x: 0, y: 0 });

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    edge: string
  ) => {
    if (e.button !== 0) return;
    activeResizeEdgeRef.current = edge;
    lastResizePosRef.current = { x: e.screenX, y: e.screenY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    void startResizeWindow(edge);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const edge = activeResizeEdgeRef.current;
    if (!edge) return;
    const dX = e.screenX - lastResizePosRef.current.x;
    const dY = e.screenY - lastResizePosRef.current.y;
    const scale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const physDX = Math.round(dX * scale);
    const physDY = Math.round(dY * scale);
    if (physDX !== 0 || physDY !== 0) {
      lastResizePosRef.current.x += physDX / scale;
      lastResizePosRef.current.y += physDY / scale;
      void resizeWindowByDelta(edge, physDX, physDY);
    }
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activeResizeEdgeRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div
      data-testid="full-layout-app"
      data-window-state={windowState}
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#03070d] text-cyan-200 select-none relative font-hud"
    >
      {/* Subtle futuristic scanline overlay across whole UI */}
      <div className="absolute inset-0 scanlines pointer-events-none z-50" />

      {/* Draggable HUD Window Header Bar (Active when restored down / windowed) */}
      {windowState === "windowed" && (
        <div
          data-testid="windowed-top-drag-bar"
          data-tauri-drag-region
          onPointerDown={handleTopBarPointerDown}
          onPointerMove={handleTopBarPointerMove}
          onPointerUp={handleTopBarPointerUp}
          className="h-7 w-full flex items-center justify-between px-3 bg-neutral-950/90 border-b border-cyan-500/30 select-none cursor-move shrink-0 z-40 text-[10px] tracking-widest uppercase font-mono text-cyan-400/80"
        >
          <div className="flex items-center gap-2 pointer-events-none" data-tauri-drag-region>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>FOCUS // HUD &mdash; WINDOWED</span>
          </div>
          <div className="flex items-center gap-1.5 pointer-events-none text-cyan-500/50" data-tauri-drag-region>
            <span>::: DRAG TOP TO MOVE :::</span>
          </div>
          <div className="flex items-center gap-2 pointer-events-none text-[9px] text-cyan-400/60" data-tauri-drag-region>
            <span>RESTORED DOWN</span>
          </div>
        </div>
      )}

      {/* Native border resize handles when in windowed / restored down mode */}
      {windowState === "windowed" && (
        <>
          <div
            data-testid="window-resize-top"
            className="absolute top-0 left-3 right-3 h-2 cursor-ns-resize z-50 select-none"
            onPointerDown={(e) => handleResizePointerDown(e, "top")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-testid="window-resize-bottom"
            className="absolute bottom-0 left-3 right-3 h-2 cursor-ns-resize z-50 select-none"
            onPointerDown={(e) => handleResizePointerDown(e, "bottom")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-testid="window-resize-left"
            className="absolute left-0 top-3 bottom-3 w-2 cursor-ew-resize z-50 select-none"
            onPointerDown={(e) => handleResizePointerDown(e, "left")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-testid="window-resize-right"
            className="absolute right-0 top-3 bottom-3 w-2 cursor-ew-resize z-50 select-none"
            onPointerDown={(e) => handleResizePointerDown(e, "right")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-testid="window-resize-top-left"
            className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-50 select-none"
            onPointerDown={(e) => handleResizePointerDown(e, "top_left")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-testid="window-resize-top-right"
            className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-50 select-none"
            onPointerDown={(e) => handleResizePointerDown(e, "top_right")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-testid="window-resize-bottom-left"
            className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-50 select-none"
            onPointerDown={(e) => handleResizePointerDown(e, "bottom_left")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
          <div
            data-testid="window-resize-bottom-right"
            className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-50 select-none"
            onPointerDown={(e) => handleResizePointerDown(e, "bottom_right")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
          />
        </>
      )}

      {/* Main Resizable 3-Column HUD Layout / Joined Whole-Canvas Mode */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-row overflow-hidden relative z-10"
      >
        {/* Left Sidebar (fixed to compact rail 68px in Joined mode) */}
        <LeftSidebar
          width={isJoinedMode ? 68 : leftWidth}
          leftWidth={leftWidth}
          rightWidth={rightWidth}
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          isCompact={isJoinedMode || leftWidth < 220}
          isJoinedMode={isJoinedMode}
          windowState={windowState}
          onToggleCollapse={handleLeftToggleCollapse}
          onToggleLeftPane={handleToggleLeftPane}
          onToggleRightPane={handleToggleRightPane}
          onToggleBothPanes={handleToggleBothPanes}
          onClickFullscreen={handleClickFullscreen}
          onClickExitFullscreen={handleClickExitFullscreen}
          onClickSplit={handleClickSplit}
          onClickJoin={handleClickJoin}
          onOpenSettings={handleOpenSettings}
        />

        {/* Center: In Joined mode, merges the left & right panes and displays the full view (or dual views) across the whole canvas. In Split mode, displays resizers & center workspace. */}
        {isJoinedMode ? (
          <div
            data-testid="full-screen-view-container"
            data-window-state={windowState}
            className="flex-1 h-full min-w-0 p-2 bg-[#03070d] text-cyan-200 overflow-hidden flex flex-col"
          >
            <JointDualViewContainer
              isDualView={isDualView}
              jointLeftWidth={jointLeftWidth}
              activeNav={activeNav}
              currentRightNav={currentRightNav}
              containerWidth={containerWidth}
              onSelectRightNav={setCurrentRightNav}
              onToggleDualView={handleToggleJointDualView}
              onDividerChange={handleJointDividerChange}
              onDividerEnd={handleJointDividerEnd}
              renderView={renderFullScreenView}
            />
          </div>
        ) : (
          <>
            <ResizeHandle
              side="left"
              currentWidth={leftWidth}
              minWidth={MIN_LEFT_WIDTH}
              maxWidth={leftMaxWidth || centerLineWidth || (containerWidth - MIN_LEFT_WIDTH)}
              snapPoints={leftSnapPoints || snapPoints}
              onDragChange={handleLeftDragChange}
              onDragEnd={handleLeftDragEnd}
              onDoubleClick={handleLeftDoubleClick}
            />

            <div
              data-testid="center-preview-container"
              className="flex-1 h-full min-w-0 p-4 flex flex-col items-center justify-center bg-black/40 text-cyan-400/60 font-mono text-xs border-x border-cyan-500/20 select-none"
            >
              <div className="text-center space-y-1">
                <div className="uppercase tracking-widest text-cyan-500/50">Desktop Work Area ({middleWidth}px)</div>
                <div className="text-[11px] text-neutral-500">External application windows snap here</div>
              </div>
            </div>

            <ResizeHandle
              side="right"
              currentWidth={rightWidth}
              minWidth={MIN_LEFT_WIDTH}
              maxWidth={rightMaxWidth || centerLineWidth || (containerWidth - MIN_LEFT_WIDTH)}
              snapPoints={rightSnapPoints || snapPoints}
              onDragChange={handleRightDragChange}
              onDragEnd={handleRightDragEnd}
              onDoubleClick={handleRightDoubleClick}
            />
          </>
        )}

        {/* Right Sidebar (fixed to compact rail 68px in Joined mode) */}
        <RightSidebar
          width={isJoinedMode ? 68 : rightWidth}
          leftWidth={leftWidth}
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          isCompact={isJoinedMode || rightWidth < 220}
          isJoinedMode={isJoinedMode}
          windowState={windowState}
          isAppMaximized={isAppMaximized}
          onExpand={handleRightToggleCollapse}
          onCollapse={handleRightToggleCollapse}
          onToggleLeftPane={handleToggleLeftPane}
          onToggleRightPane={handleToggleRightPane}
          onToggleBothPanes={handleToggleBothPanes}
          onToggleMaximizeApp={handleToggleMaximizeApp}
          onClickMaximise={handleClickMaximise}
          onClickRestoreDown={handleClickRestoreDown}
          onClickFullscreen={handleClickFullscreen}
          onClickExitFullscreen={handleClickExitFullscreen}
          onClickSplit={handleClickSplit}
          onClickMinimise={handleClickMinimise}
          onMaximizePanes={handleMaximizePanes}
          onOpenSettings={handleOpenSettings}
        />
      </div>

      {/* Update Notification Toast */}
      {updateInfo && updateInfo.available && (
        <UpdateNotificationToast
          updateInfo={updateInfo}
          onOpenSettings={handleOpenSettings}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}

      {/* Settings Modal Dialog */}
      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        onResetWidths={handleResetWidths}
      />

      {/* Outer Sci-Fi Crosshairs overlay (matching picture crosshairs) */}
      <div className="absolute top-12 left-2 text-cyan-500/40 text-xs font-mono pointer-events-none z-40">
        +
      </div>
      <div className="absolute top-12 right-2 text-cyan-500/40 text-xs font-mono pointer-events-none z-40">
        +
      </div>
      <div className="absolute bottom-2 left-2 text-cyan-500/40 text-xs font-mono pointer-events-none z-40">
        +
      </div>
      <div className="absolute bottom-2 right-2 text-cyan-500/40 text-xs font-mono pointer-events-none z-40">
        +
      </div>
    </div>
  );
};

