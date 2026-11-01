import React from "react";
import { RightSidebar } from "../RightSidebar/RightSidebar";
import { ResizeHandle } from "../ResizeHandle";
import { SettingsModal } from "../../features/settings/SettingsModal";
import { UseDockLayoutReturn } from "../../../hooks/useDockLayout";

interface DockAppProps {
  layout: UseDockLayoutReturn;
}

export const RightDockApp: React.FC<DockAppProps> = ({ layout }) => {
  const {
    rightWidth,
    activeNav,
    maxRightWidth,
    magneticSnap,
    isSettingsOpen,
    settingsTab,
    setIsSettingsOpen,
    handleRightToggleCollapse,
    handleMaximizePanes,
    handleOpenSettings,
    handleRightDragChange,
    handleRightDragEnd,
    handleRightDoubleClick,
    handleResetWidths,
    SNAP_POINTS,
    MIN_LEFT_WIDTH,
  } = layout;

  return (
    <div
      data-testid="right-dock-app"
      className="w-screen h-screen flex justify-end overflow-visible bg-transparent text-cyan-200 select-none relative font-hud"
    >
      <div
        style={{ width: `${rightWidth}px` }}
        className="relative h-full flex flex-row bg-[#03070d] overflow-visible shrink-0"
      >
        <div className="absolute top-0 bottom-0 left-0 w-2.5 z-50">
          <ResizeHandle
            side="right"
            currentWidth={rightWidth}
            minWidth={MIN_LEFT_WIDTH}
            maxWidth={maxRightWidth}
            snapPoints={magneticSnap ? SNAP_POINTS : []}
            className="relative w-full h-full flex items-center justify-center cursor-col-resize select-none touch-none"
            onDragChange={handleRightDragChange}
            onDragEnd={handleRightDragEnd}
            onDoubleClick={handleRightDoubleClick}
          />
        </div>
        <RightSidebar
          width={rightWidth}
          activeNav={activeNav}
          isCompact={rightWidth < 220}
          isDockMode={true}
          onExpand={handleRightToggleCollapse}
          onCollapse={handleRightToggleCollapse}
          onMaximizePanes={handleMaximizePanes}
          onOpenSettings={handleOpenSettings}
        />
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

