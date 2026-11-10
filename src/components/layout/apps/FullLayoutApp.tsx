import React from "react";
import { LeftSidebar } from "../LeftSidebar/LeftSidebar";
import { RightSidebar } from "../RightSidebar/RightSidebar";
import { ResizeHandle } from "../ResizeHandle";
import { UpdateNotificationToast } from "../../ui/UpdateNotificationToast";
import { SettingsModal } from "../../features/settings/SettingsModal";
import { UseDockLayoutReturn } from "../../../hooks/useDockLayout";
import { HomeView } from "../../views/HomeView";
import { ChatView } from "../../views/ChatView";
import { CalendarView } from "../../views/CalendarView";
import { GoalsView } from "../../views/GoalsView";
import { TasksView } from "../../views/TasksView";
import { NotesView } from "../../views/NotesView";
import { KanbanView } from "../../views/KanbanView";
import { ActionPlansView } from "../../views/ActionPlansView";
import { PomodoroDial } from "../../features/pomodoro/PomodoroDial";
import { HudBrackets } from "../../ui/HudBrackets";

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
    magneticSnap,
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
    SNAP_POINTS,
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

  return (
    <div
      data-testid="full-layout-app"
      data-window-state={windowState}
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#03070d] text-cyan-200 select-none relative font-hud"
    >
      {/* Subtle futuristic scanline overlay across whole UI */}
      <div className="absolute inset-0 scanlines pointer-events-none z-50" />

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

        {/* Center: In Joined mode, merges the left & right panes and displays the full view across the whole canvas. In Split mode, displays resizers & center workspace. */}
        {isJoinedMode ? (
          <div
            data-testid="full-screen-view-container"
            data-window-state={windowState}
            className="flex-1 h-full min-w-0 p-2 bg-[#03070d] text-cyan-200 overflow-hidden flex flex-col"
          >
            <HudBrackets variant="cyan" showTicks={false} className="h-full w-full flex flex-col overflow-hidden">
              <div className="flex-1 flex flex-col p-2 min-w-0 overflow-y-auto">
                {renderFullScreenView(activeNav)}
              </div>
            </HudBrackets>
          </div>
        ) : (
          <>
            <ResizeHandle
              side="left"
              currentWidth={leftWidth}
              minWidth={MIN_LEFT_WIDTH}
              maxWidth={containerWidth - MIN_LEFT_WIDTH}
              snapPoints={magneticSnap ? SNAP_POINTS : []}
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
              maxWidth={containerWidth - MIN_LEFT_WIDTH}
              snapPoints={magneticSnap ? SNAP_POINTS : []}
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

