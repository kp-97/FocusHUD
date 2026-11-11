import React from "react";
import { LeftSidebar } from "../LeftSidebar/LeftSidebar";
import { ResizeHandle } from "../ResizeHandle";
import { SettingsModal } from "../../features/settings/SettingsModal";
import { UseDockLayoutReturn } from "../../../hooks/useDockLayout";

interface DockAppProps {
  layout: UseDockLayoutReturn;
}

export const LeftDockApp: React.FC<DockAppProps> = ({ layout }) => {
  const {
    leftWidth,
    rightWidth,
    activeNav,
    setActiveNav,
    isSettingsOpen,
    settingsTab,
    setIsSettingsOpen,
    handleToggleLeftPane,
    handleToggleRightPane,
    handleToggleBothPanes,
    handleLeftToggleCollapse,
    handleClickFullscreen,
    handleClickExitFullscreen,
    handleClickSplit,
    handleClickJoin,
    handleOpenSettings,
    handleLeftDragChange,
    handleLeftDragEnd,
    handleLeftDoubleClick,
    handleResetWidths,
    centerLineWidth,
    snapPoints,
    MIN_LEFT_WIDTH,
  } = layout;

  return (
    <div
      data-testid="left-dock-app"
      className="w-screen h-screen flex justify-start overflow-visible bg-transparent text-cyan-200 select-none relative font-hud pointer-events-none"
    >
      <div
        style={{ width: `${leftWidth}px` }}
        className="relative h-full flex flex-row bg-[#03070d] overflow-visible shrink-0 pointer-events-auto"
      >
        <LeftSidebar
          width={leftWidth}
          leftWidth={leftWidth}
          rightWidth={rightWidth}
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          isCompact={leftWidth < 220}
          isDockMode={true}
          isJoinedMode={false}
          windowState="split"
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
        <div className="absolute top-0 bottom-0 right-0 w-2.5 z-50">
          <ResizeHandle
            side="left"
            currentWidth={leftWidth}
            minWidth={MIN_LEFT_WIDTH}
            maxWidth={centerLineWidth}
            snapPoints={snapPoints}
            className="relative w-full h-full flex items-center justify-center cursor-col-resize select-none touch-none"
            onDragChange={handleLeftDragChange}
            onDragEnd={handleLeftDragEnd}
            onDoubleClick={handleLeftDoubleClick}
          />
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsTab}
        onClose={() => setIsSettingsOpen(false)}
        onResetWidths={handleResetWidths}
      />
    </div>
  );
};

