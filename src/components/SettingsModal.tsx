import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { HudBrackets } from "./HudBrackets";
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
} from "../utils/store";
import { NavItemConfig } from "../types/hud";
import { NavViewCustomizationSection } from "./settings/NavViewCustomizationSection";
import { PaneLimitsSection } from "./settings/PaneLimitsSection";
import { PaneSizingMemorySection } from "./settings/PaneSizingMemorySection";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetWidths?: () => void;
  isStandalone?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetWidths,
  isStandalone = false,
}) => {
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [navResetSuccess, setNavResetSuccess] = useState<boolean>(false);
  const [limitsApplied, setLimitsApplied] = useState<boolean>(false);

  const [navConfig, setNavConfig] = useState<NavItemConfig[]>(() => loadNavConfig());
  const [maxLeft, setMaxLeft] = useState<number>(() => getMaxLeftWidth());
  const [maxRight, setMaxRight] = useState<number>(() => getMaxRightWidth());

  useEffect(() => {
    if (isOpen) {
      setResetSuccess(false);
      setNavResetSuccess(false);
      setLimitsApplied(false);
      setNavConfig(loadNavConfig());
      setMaxLeft(getMaxLeftWidth());
      setMaxRight(getMaxRightWidth());
    }
  }, [isOpen]);

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
      className={`w-full ${
        isStandalone ? "h-full max-w-none" : "max-w-xl"
      } bg-[#040d1a] border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(0,229,255,0.25)] overflow-hidden text-cyan-200 relative font-hud flex flex-col`}
    >
      <HudBrackets
        variant="cyan"
        showTicks={true}
        className="p-5 flex flex-col h-full overflow-hidden"
      >
        {/* Header */}
        <div
          data-tauri-drag-region
          className="flex items-center justify-between border-b border-cyan-500/30 pb-3 mb-3 shrink-0 select-none cursor-default"
        >
          <div className="flex items-center gap-2.5 pointer-events-none">
            <div className="w-3 h-3 bg-cyan-400 rotate-45 shadow-[0_0_8px_#00e5ff]" />
            <h2
              id="settings-modal-title"
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

        {/* Scrollable Body Content with Sub-sections */}
        <div className="space-y-4 text-xs font-tech overflow-y-auto flex-1 pr-1">
          {/* Section 1: Navigation View Customization */}
          <NavViewCustomizationSection
            navConfig={navConfig}
            onToggleVisibility={handleToggleVisibility}
            onMoveUp={handleMoveUp}
            onMoveDown={handleMoveDown}
            onResetNav={handleResetNav}
            navResetSuccess={navResetSuccess}
          />

          {/* Section 2: Configurable Pane Max Width Limits */}
          <PaneLimitsSection
            maxLeft={maxLeft}
            maxRight={maxRight}
            onChangeMaxLeft={setMaxLeft}
            onChangeMaxRight={setMaxRight}
            onApplyLimits={handleApplyLimits}
            limitsApplied={limitsApplied}
          />

          {/* Section 3: Pane Sizing & Memory */}
          <PaneSizingMemorySection
            onResetDefaults={handleResetDefaults}
            resetSuccess={resetSuccess}
          />
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
    </div>
  );

  if (isStandalone) {
    return (
      <div className="w-screen h-screen bg-[#03070d]/95 p-2 overflow-hidden flex flex-col justify-center items-center">
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
