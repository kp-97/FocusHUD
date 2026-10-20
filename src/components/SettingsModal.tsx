import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  Check,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Maximize2,
  ListOrdered,
} from "lucide-react";
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
  MIN_PANE_MAX_WIDTH,
  MAX_PANE_MAX_WIDTH,
} from "../utils/store";
import { NavItemConfig } from "../types/hud";

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

        {/* Scrollable Body Content */}
        <div className="space-y-4 text-xs font-tech overflow-y-auto flex-1 pr-1">
          {/* Section 1: Navigation View Customization */}
          <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3 space-y-3">
            <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
                NAVIGATION VIEWS & ORDERING
              </span>
              <button
                type="button"
                onClick={handleResetNav}
                className="hud-btn px-2 py-0.5 rounded text-[10px] font-tech text-cyan-300 hover:text-cyan-100 border-cyan-500/40 flex items-center gap-1 cursor-pointer"
              >
                {navResetSuccess ? (
                  <>
                    <Check className="w-3 h-3 text-cyan-300" />
                    Reset to Default!
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3" />
                    Reset to Default
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-cyan-300/70">
              Reorder navigation items and toggle sidebar visibility. Views are updated instantly.
            </p>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border border-cyan-500/10 rounded p-1.5 bg-[#020813]/60">
              {navConfig.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded bg-cyan-950/30 border border-cyan-500/20 hover:border-cyan-400/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={() => handleToggleVisibility(item.id)}
                        aria-label={`Toggle ${item.label} visibility`}
                        className="w-3.5 h-3.5 rounded border border-cyan-500 bg-cyan-950/80 text-cyan-400 focus:ring-0 cursor-pointer accent-cyan-400"
                      />
                      <span
                        className={`font-semibold tracking-wider text-xs ${
                          item.visible ? "text-cyan-200" : "text-cyan-500/40 line-through"
                        }`}
                      >
                        {item.label}
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveUp(idx)}
                      aria-label={`Move ${item.label} Up`}
                      className="p-1 text-cyan-400/80 hover:text-cyan-100 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-cyan-500/20 transition cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === navConfig.length - 1}
                      onClick={() => handleMoveDown(idx)}
                      aria-label={`Move ${item.label} Down`}
                      className="p-1 text-cyan-400/80 hover:text-cyan-100 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-cyan-500/20 transition cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Configurable Pane Max Width Limits */}
          <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3 space-y-3">
            <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                MAXIMUM PANE WIDTH LIMITS
              </span>
              <span className="text-[10px] text-cyan-400/70 font-tech">280px - 800px</span>
            </div>

            <p className="text-[11px] text-cyan-300/70">
              Set the maximum draggable width for the left and right docking panes.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Left Max Width */}
              <div className="space-y-1.5 bg-[#020813]/60 p-2.5 rounded border border-cyan-500/20">
                <div className="flex justify-between items-center text-cyan-300 text-[11px]">
                  <span>LEFT PANE MAX</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={MIN_PANE_MAX_WIDTH}
                      max={MAX_PANE_MAX_WIDTH}
                      value={maxLeft}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val))
                          setMaxLeft(Math.max(MIN_PANE_MAX_WIDTH, Math.min(MAX_PANE_MAX_WIDTH, val)));
                      }}
                      aria-label="Left Pane Max Width"
                      className="w-14 px-1.5 py-0.5 bg-black/60 border border-cyan-500/40 rounded text-right text-cyan-200 font-tech text-xs focus:outline-none focus:border-cyan-400"
                    />
                    <span className="text-[10px] text-cyan-500/70">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={MIN_PANE_MAX_WIDTH}
                  max={MAX_PANE_MAX_WIDTH}
                  step={10}
                  value={maxLeft}
                  onChange={(e) => setMaxLeft(Number(e.target.value))}
                  aria-label="Left Pane Max Width Slider"
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Right Max Width */}
              <div className="space-y-1.5 bg-[#020813]/60 p-2.5 rounded border border-cyan-500/20">
                <div className="flex justify-between items-center text-cyan-300 text-[11px]">
                  <span>RIGHT PANE MAX</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={MIN_PANE_MAX_WIDTH}
                      max={MAX_PANE_MAX_WIDTH}
                      value={maxRight}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (!isNaN(val))
                          setMaxRight(Math.max(MIN_PANE_MAX_WIDTH, Math.min(MAX_PANE_MAX_WIDTH, val)));
                      }}
                      aria-label="Right Pane Max Width"
                      className="w-14 px-1.5 py-0.5 bg-black/60 border border-cyan-500/40 rounded text-right text-cyan-200 font-tech text-xs focus:outline-none focus:border-cyan-400"
                    />
                    <span className="text-[10px] text-cyan-500/70">px</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={MIN_PANE_MAX_WIDTH}
                  max={MAX_PANE_MAX_WIDTH}
                  step={10}
                  value={maxRight}
                  onChange={(e) => setMaxRight(Number(e.target.value))}
                  aria-label="Right Pane Max Width Slider"
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={handleApplyLimits}
                className="hud-btn px-3 py-1 rounded text-[11px] font-tech text-cyan-200 hover:text-cyan-100 border-cyan-500/40 flex items-center gap-1.5 cursor-pointer bg-cyan-950/40 hover:bg-cyan-500/20"
              >
                {limitsApplied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-cyan-300" />
                    Applied!
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                    Apply Limits
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Section 3: Pane Sizing & Memory */}
          <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3 space-y-3">
            <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                PANE SIZING & MEMORY
              </span>
              <span className="text-[10px] text-cyan-400/70 font-tech">AUTO-MEMORY ACTIVE</span>
            </div>

            <p className="text-[11px] leading-relaxed text-cyan-200/80">
              FocusHUD automatically remembers your customized left and right pane widths when
              resizing. Expanding either pane seamlessly restores it to the exact width you last
              adjusted it to.
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-cyan-500/20">
              <div className="text-[10px] text-cyan-400/60">
                Defaults: {DEFAULT_LEFT_WIDTH}px (Left) / {DEFAULT_RIGHT_WIDTH}px (Right)
              </div>

              <button
                type="button"
                onClick={handleResetDefaults}
                className="hud-btn px-2.5 py-1 rounded text-[10.5px] font-tech text-cyan-300 hover:text-cyan-100 border-cyan-500/40 flex items-center gap-1.5 cursor-pointer"
              >
                {resetSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-cyan-300" />
                    Reset to Defaults!
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3" />
                    Reset Widths
                  </>
                )}
              </button>
            </div>
          </div>
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
