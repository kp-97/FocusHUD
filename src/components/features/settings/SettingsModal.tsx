import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { HudBrackets } from "../../ui/HudBrackets";
import {
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  setRememberedLeftWidth,
  setRememberedRightWidth,
  loadNavConfig,
  saveNavConfig,
  resetNavConfig,
  getMaxLeftWidth,
  getMaxRightWidth,
  applyMaxPaneWidths,
} from "../../../stores/layoutStore";
import { NavItemConfig } from "../../../types/hud";
import { ViewCustomizationTab } from "./ViewCustomizationTab";
import { PaneLimitsTab } from "./PaneLimitsTab";
import { AppearanceTab } from "./AppearanceTab";
import { EditorTab } from "./EditorTab";
import { NotesTab } from "./NotesTab";
import { UpdatesTab } from "./UpdatesTab";
import { startDraggingWindow, moveWindowByDelta } from "../../../services/tauriBridge";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetWidths?: () => void;
  isStandalone?: boolean;
  initialTab?: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetWidths,
  isStandalone = false,
  initialTab = "all",
}) => {
  const [activeTab, setActiveTab] = useState<string>(() => initialTab || "all");
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [navResetSuccess, setNavResetSuccess] = useState<boolean>(false);
  const [limitsApplied, setLimitsApplied] = useState<boolean>(false);

  const [navConfig, setNavConfig] = useState<NavItemConfig[]>(() => loadNavConfig());
  const [maxLeft, setMaxLeft] = useState<number>(() => getMaxLeftWidth());
  const [maxRight, setMaxRight] = useState<number>(() => getMaxRightWidth());

  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState<{ width: number; height: number } | null>(null);
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const isDraggingModalRef = React.useRef(false);
  const isDraggingStandaloneRef = React.useRef(false);
  const isResizingModalRef = React.useRef<false | "right" | "bottom" | "corner">(false);
  const resizeStartRef = React.useRef<{
    mouseX: number;
    mouseY: number;
    startW: number;
    startH: number;
  }>({ mouseX: 0, mouseY: 0, startW: 600, startH: 600 });
  const lastScreenPosRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handleResizePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    direction: "right" | "bottom" | "corner"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = modalRef.current?.getBoundingClientRect();
    const defaultH = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.8) : 640;
    isResizingModalRef.current = direction;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: modalSize?.width ?? (rect ? Math.round(rect.width) : 620),
      startH: modalSize?.height ?? (rect ? Math.round(rect.height) : defaultH),
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const dir = isResizingModalRef.current;
    if (!dir) return;
    const maxW = typeof window !== "undefined" ? Math.max(420, window.innerWidth - 32) : 1400;
    const maxH = typeof window !== "undefined" ? Math.max(360, window.innerHeight - 32) : 1000;
    const dX = e.clientX - resizeStartRef.current.mouseX;
    const dY = e.clientY - resizeStartRef.current.mouseY;
    const nextW =
      dir === "right" || dir === "corner"
        ? Math.max(400, Math.min(maxW, resizeStartRef.current.startW + dX))
        : resizeStartRef.current.startW;
    const nextH =
      dir === "bottom" || dir === "corner"
        ? Math.max(340, Math.min(maxH, resizeStartRef.current.startH + dY))
        : resizeStartRef.current.startH;
    setModalSize({ width: Math.round(nextW), height: Math.round(nextH) });
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingModalRef.current) return;
    isResizingModalRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button") || e.button !== 0) return;
    if (isStandalone) {
      isDraggingStandaloneRef.current = true;
      lastScreenPosRef.current = { x: e.screenX, y: e.screenY };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      void startDraggingWindow();
      return;
    }
    isDraggingModalRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isStandalone) {
      if (!isDraggingStandaloneRef.current) return;
      const dX = e.screenX - lastScreenPosRef.current.x;
      const dY = e.screenY - lastScreenPosRef.current.y;
      const scale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const physDX = Math.round(dX * scale);
      const physDY = Math.round(dY * scale);
      if (physDX !== 0 || physDY !== 0) {
        lastScreenPosRef.current.x += physDX / scale;
        lastScreenPosRef.current.y += physDY / scale;
        void moveWindowByDelta(physDX, physDY);
      }
      return;
    }
    if (!isDraggingModalRef.current) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;
    setPosition({
      x: dragStartRef.current.startX + deltaX,
      y: dragStartRef.current.startY + deltaY,
    });
  };

  const handleHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isStandalone) {
      isDraggingStandaloneRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      return;
    }
    isDraggingModalRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || "all");
      setResetSuccess(false);
      setNavResetSuccess(false);
      setLimitsApplied(false);
      setNavConfig(loadNavConfig());
      setMaxLeft(getMaxLeftWidth());
      setMaxRight(getMaxRightWidth());
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetDefaults = () => {
    setRememberedLeftWidth(DEFAULT_LEFT_WIDTH);
    setRememberedRightWidth(DEFAULT_RIGHT_WIDTH);

    if (onResetWidths) {
      onResetWidths();
    }

    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 2000);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...navConfig];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setNavConfig(next);
    saveNavConfig(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= navConfig.length - 1) return;
    const next = [...navConfig];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setNavConfig(next);
    saveNavConfig(next);
  };

  const handleToggleVisibility = (id: string) => {
    const next = navConfig.map((item) =>
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    setNavConfig(next);
    saveNavConfig(next);
  };

  const handleResetNav = () => {
    const reset = resetNavConfig();
    setNavConfig(reset);
    setNavResetSuccess(true);
    setTimeout(() => setNavResetSuccess(false), 2000);
  };

  const handleApplyLimits = () => {
    applyMaxPaneWidths(maxLeft, maxRight);
    setLimitsApplied(true);
    setTimeout(() => setLimitsApplied(false), 2000);
  };

  const modalContent = (
    <div
      ref={modalRef}
      data-testid="settings-modal-content"
      style={
        isStandalone
          ? undefined
          : {
              transform: `translate(${position.x}px, ${position.y}px)`,
              height: modalSize ? `${modalSize.height}px` : "80vh",
              width: modalSize ? `${modalSize.width}px` : "620px",
            }
      }
      className={`${
        isStandalone
          ? "w-full h-full max-w-none rounded-none border border-cyan-500/40 shadow-none"
          : "max-w-[95vw] max-h-[95vh] min-w-[380px] min-h-[340px] rounded-lg border border-cyan-500/40 shadow-[0_0_30px_rgba(0,229,255,0.25)]"
      } bg-[#040d1a] overflow-hidden text-cyan-200 relative font-hud flex flex-col`}
    >
      <HudBrackets
        variant="cyan"
        showTicks={true}
        className="p-5 flex-1 min-h-0 flex flex-col h-full overflow-hidden"
      >
        {/* Header (Draggable) */}
        <div
          data-tauri-drag-region
          onPointerDown={handleHeaderPointerDown}
          onPointerMove={handleHeaderPointerMove}
          onPointerUp={handleHeaderPointerUp}
          className="flex items-center justify-between border-b border-cyan-500/30 pb-3 mb-3 shrink-0 select-none cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2.5 pointer-events-none" data-tauri-drag-region>
            <div className="w-3 h-3 bg-cyan-400 rotate-45 shadow-[0_0_8px_#00e5ff]" />
            <h2
              id="settings-modal-title"
              data-tauri-drag-region
              className="font-orbitron font-bold text-sm tracking-wider text-cyan-100 uppercase"
            >
              HUD PREFERENCES & SETTINGS
            </h2>
          </div>
          <button
            onClick={onClose}
            title="Close Settings (Esc)"
            aria-label="Close Settings"
            className="text-cyan-400/60 hover:text-red-400 hover:scale-110 transition p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2.5 mb-2 border-b border-cyan-500/20 shrink-0 select-none">
          {[
            { id: "all", label: "ALL" },
            { id: "notes", label: "NOTES STORAGE" },
            { id: "appearance", label: "THEMES & PALETTE" },
            { id: "editor", label: "EDITOR & SPELLCHECK" },
            { id: "views", label: "VIEWS" },
            { id: "limits", label: "LIMITS" },
            { id: "updates", label: "UPDATES" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`hud-btn px-2.5 py-1 rounded text-[10.5px] font-tech uppercase tracking-wider transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === tab.id
                  ? "hud-btn-active text-cyan-100 border-cyan-400"
                  : "text-cyan-400/70 hover:text-cyan-200 border-cyan-500/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Body Content with Tabs */}
        <div
          data-testid="settings-scroll-body"
          className="space-y-4 text-xs font-tech overflow-y-auto flex-1 min-h-0 pr-1 select-text"
        >
          {/* Notes Storage Settings */}
          {(activeTab === "all" || activeTab === "notes") && <NotesTab />}

          {/* Editor & Spellcheck Settings */}
          {(activeTab === "all" || activeTab === "editor") && <EditorTab />}

          {/* View Customization */}
          {(activeTab === "all" || activeTab === "views") && (
            <ViewCustomizationTab
              navConfig={navConfig}
              onToggleVisibility={handleToggleVisibility}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onResetNav={handleResetNav}
              navResetSuccess={navResetSuccess}
            />
          )}

          {/* Pane Limits */}
          {(activeTab === "all" || activeTab === "limits") && (
            <PaneLimitsTab
              maxLeft={maxLeft}
              maxRight={maxRight}
              onChangeMaxLeft={setMaxLeft}
              onChangeMaxRight={setMaxRight}
              onApplyLimits={handleApplyLimits}
              limitsApplied={limitsApplied}
            />
          )}

          {/* Sizing Memory & Appearance */}
          {(activeTab === "all" || activeTab === "appearance") && (
            <AppearanceTab
              onResetDefaults={handleResetDefaults}
              resetSuccess={resetSuccess}
            />
          )}

          {/* Software Updates & Build */}
          {(activeTab === "all" || activeTab === "updates") && <UpdatesTab />}
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-cyan-500/20 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="hud-btn px-4 py-1.5 rounded text-xs font-hud tracking-wider text-cyan-300 hover:text-cyan-100 border-cyan-500/40 cursor-pointer"
          >
            DONE
          </button>
        </div>
      </HudBrackets>

      {/* Interactive Resize Handles for Popup Settings Modal */}
      {!isStandalone && (
        <>
          <div
            data-testid="settings-modal-resize-right"
            onPointerDown={(e) => handleResizePointerDown(e, "right")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute top-0 bottom-4 right-0 w-2 cursor-ew-resize z-30"
          />
          <div
            data-testid="settings-modal-resize-bottom"
            onPointerDown={(e) => handleResizePointerDown(e, "bottom")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute bottom-0 left-0 right-4 h-2 cursor-ns-resize z-30"
          />
          <div
            data-testid="settings-modal-resize-handle"
            aria-label="Resize Settings Modal"
            onPointerDown={(e) => handleResizePointerDown(e, "corner")}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-40 flex items-end justify-end p-0.5 text-cyan-400/60 hover:text-cyan-200"
          >
            <div className="w-2 h-2 border-r-2 border-b-2 border-cyan-400/70" />
          </div>
        </>
      )}
    </div>
  );

  if (isStandalone) {
    return (
      <div className="w-screen h-screen m-0 p-0 overflow-hidden bg-[#040d1a] flex flex-col">
        {modalContent}
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {modalContent}
    </div>
  );
};
