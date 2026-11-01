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
    activeNav,
    setActiveNav,
    maxLeftWidth,
    magneticSnap,
    isSettingsOpen,
    settingsTab,
    setIsSettingsOpen,
    handleLeftToggleCollapse,
    handleOpenSettings,
    handleLeftDragChange,
    handleLeftDragEnd,
    handleLeftDoubleClick,
    handleResetWidths,
    SNAP_POINTS,
    MIN_LEFT_WIDTH,
  } = layout;

  return (
    <div
      data-testid="left-dock-app"
      className="w-screen h-screen flex justify-start overflow-visible bg-transparent text-cyan-200 select-none relative font-hud"
    >
      <div
        style={{ width: `${leftWidth}px` }}
        className="relative h-full flex flex-row bg-[#03070d] overflow-visible shrink-0"
      >
        <LeftSidebar
          width={leftWidth}
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          isCompact={leftWidth < 220}
          isDockMode={true}
          onToggleCollapse={handleLeftToggleCollapse}
          onOpenSettings={handleOpenSettings}
        />
        <div className="absolute top-0 bottom-0 right-0 w-2.5 z-50">
          <ResizeHandle
            side="left"
            currentWidth={leftWidth}
            minWidth={MIN_LEFT_WIDTH}
            maxWidth={maxLeftWidth}
            snapPoints={magneticSnap ? SNAP_POINTS : []}
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

