import React from "react";
import { TopNavHUD } from "../TopNavHUD";
import { LeftSidebar } from "../LeftSidebar/LeftSidebar";
import { RightSidebar } from "../RightSidebar/RightSidebar";
import { CenterWorkspace } from "../CenterWorkspace";
import { ResizeHandle } from "../ResizeHandle";
import { UpdateNotificationToast } from "../../ui/UpdateNotificationToast";
import { SettingsModal } from "../../features/settings/SettingsModal";
import { UseDockLayoutReturn } from "../../../hooks/useDockLayout";

interface FullLayoutAppProps {
  layout: UseDockLayoutReturn;
}

export const FullLayoutApp: React.FC<FullLayoutAppProps> = ({ layout }) => {
  const {
    leftWidth,
    rightWidth,
    maxLeftWidth,
    maxRightWidth,
    containerRef,
    containerWidth,
    middleWidth,
    magneticSnap,
    setMagneticSnap,
    desktopDockActive,
    handleToggleDesktopDock,
    snapMode,
    setSnapMode,
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
    handleRightDragChange,
    handleRightDragEnd,
    handleRightDoubleClick,
    handleRightToggleCollapse,
    handleMaximizePanes,
    handleResetWidths,
    handleApplyPreset,
    handleReset,
    SNAP_POINTS,
    MIN_LEFT_WIDTH,
    MIN_MIDDLE_WIDTH,
  } = layout;

  return (
    <div
      data-testid="full-layout-app"
      className="flex flex-col h-screen w-screen overflow-hidden bg-[#03070d] text-cyan-200 select-none relative font-hud"
    >
      {/* Subtle futuristic scanline overlay across whole UI */}
      <div className="absolute inset-0 scanlines pointer-events-none z-50" />

      {/* Top HUD control toolbar */}
      <TopNavHUD
        leftWidth={leftWidth}
        rightWidth={rightWidth}
        magneticSnap={magneticSnap}
        onToggleMagneticSnap={() => setMagneticSnap(!magneticSnap)}
        desktopDockActive={desktopDockActive}
        onToggleDesktopDock={handleToggleDesktopDock}
        onApplyPreset={handleApplyPreset}
        onReset={handleReset}
      />

      {/* Main Resizable 3-Column HUD Layout */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-row overflow-hidden relative z-10"
      >
        {/* Left Sidebar */}
        <LeftSidebar
          width={leftWidth}
          activeNav={activeNav}
          onSelectNav={setActiveNav}
          isCompact={leftWidth < 220}
          onToggleCollapse={handleLeftToggleCollapse}
          onOpenSettings={handleOpenSettings}
        />

        {/* Left Resize Splitter Handle */}
        <ResizeHandle
          side="left"
          currentWidth={leftWidth}
          minWidth={MIN_LEFT_WIDTH}
          maxWidth={Math.min(maxLeftWidth, containerWidth - rightWidth - MIN_MIDDLE_WIDTH)}
          snapPoints={magneticSnap ? SNAP_POINTS : []}
          onDragChange={handleLeftDragChange}
          onDragEnd={handleLeftDragEnd}
          onDoubleClick={handleLeftDoubleClick}
        />

        {/* Center Workspace (Contents snap nicely) */}
        <CenterWorkspace
          middleWidth={middleWidth}
          snapMode={snapMode}
          onToggleSnapMode={setSnapMode}
        />

        {/* Right Resize Splitter Handle */}
        <ResizeHandle
          side="right"
          currentWidth={rightWidth}
          minWidth={MIN_LEFT_WIDTH}
          maxWidth={Math.min(maxRightWidth, containerWidth - leftWidth - MIN_MIDDLE_WIDTH)}
          snapPoints={magneticSnap ? SNAP_POINTS : []}
          onDragChange={handleRightDragChange}
          onDragEnd={handleRightDragEnd}
          onDoubleClick={handleRightDoubleClick}
        />

        {/* Right Sidebar */}
        <RightSidebar
          width={rightWidth}
          activeNav={activeNav}
          isCompact={rightWidth < 220}
          onExpand={handleRightToggleCollapse}
          onCollapse={handleRightToggleCollapse}
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

