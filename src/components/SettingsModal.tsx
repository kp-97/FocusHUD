import React, { useState, useEffect } from "react";
import { X, Settings, Sliders, Check, RotateCcw } from "lucide-react";
import { HudBrackets } from "./HudBrackets";
import {
  getMaxLeftWidth,
  getMaxRightWidth,
  setMaxLeftWidth,
  setMaxRightWidth,
} from "../utils/store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMaxDimensions?: (maxLeft: number, maxRight: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onApplyMaxDimensions,
}) => {
  const [leftMax, setLeftMax] = useState<number>(getMaxLeftWidth());
  const [rightMax, setRightMax] = useState<number>(getMaxRightWidth());
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setLeftMax(getMaxLeftWidth());
      setRightMax(getMaxRightWidth());
      setSavedSuccess(false);
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

  const handleApply = () => {
    const validLeft = Math.max(220, Math.min(500, Math.round(leftMax)));
    const validRight = Math.max(220, Math.min(500, Math.round(rightMax)));

    setMaxLeftWidth(validLeft);
    setMaxRightWidth(validRight);

    setLeftMax(validLeft);
    setRightMax(validRight);

    if (onApplyMaxDimensions) {
      onApplyMaxDimensions(validLeft, validRight);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleResetDefaults = () => {
    setLeftMax(360);
    setRightMax(360);
    setMaxLeftWidth(360);
    setMaxRightWidth(360);
    if (onApplyMaxDimensions) {
      onApplyMaxDimensions(360, 360);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

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
      <div className="w-full max-w-md bg-[#040d1a] border border-cyan-500/40 rounded-lg shadow-[0_0_30px_rgba(0,229,255,0.25)] overflow-hidden text-cyan-200 relative font-hud">
        <HudBrackets variant="cyan" showTicks={true} className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
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
              className="text-cyan-400/60 hover:text-red-400 hover:scale-110 transition p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="space-y-4 text-xs font-tech">
            {/* Maximum Pane Width Configuration */}
            <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3 space-y-3">
              <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  MAXIMUM PANE WIDTHS
                </span>
                <span className="text-[10px] text-cyan-400/60">220px - 500px</span>
              </div>

              {/* Left Sidebar Max Width */}
              <div className="space-y-1">
                <div className="flex justify-between text-cyan-300/80">
                  <span>Left Sidebar Max Width:</span>
                  <span className="font-bold text-cyan-100 font-tech">{leftMax}px</span>
                </div>
                <input
                  type="range"
                  min="220"
                  max="500"
                  step="10"
                  value={leftMax}
                  onChange={(e) => setLeftMax(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Right Sidebar Max Width */}
              <div className="space-y-1">
                <div className="flex justify-between text-cyan-300/80">
                  <span>Right Sidebar Max Width:</span>
                  <span className="font-bold text-cyan-100 font-tech">{rightMax}px</span>
                </div>
                <input
                  type="range"
                  min="220"
                  max="500"
                  step="10"
                  value={rightMax}
                  onChange={(e) => setRightMax(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Action Buttons for Max Width */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="hud-btn px-2.5 py-1 rounded text-[10.5px] font-tech text-cyan-400/70 hover:text-cyan-200 border-cyan-500/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Default (360px)
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  className="hud-btn hud-btn-active px-3 py-1 rounded text-[11px] font-tech font-bold text-cyan-100 border-cyan-400 flex items-center gap-1.5 cursor-pointer shadow-[0_0_10px_rgba(0,229,255,0.3)]"
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-cyan-300" />
                      Applied!
                    </>
                  ) : (
                    "Apply Widths"
                  )}
                </button>
              </div>
            </div>

            {/* View Reordering Preview Section */}
            <div className="border border-cyan-500/20 bg-cyan-950/20 rounded p-3 text-[11px] text-cyan-400/70 space-y-1">
              <div className="font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                VIEW REORDERING & CUSTOMIZATION
              </div>
              <p className="leading-relaxed">
                Full drag-and-drop navigation ordering and view visibility selectors will be fully configured in Issue #6.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-cyan-500/20 flex justify-end">
            <button
              onClick={onClose}
              className="hud-btn px-4 py-1.5 rounded text-xs font-hud tracking-wider text-cyan-300 hover:text-cyan-100 border-cyan-500/40 cursor-pointer"
            >
              DONE
            </button>
          </div>
        </HudBrackets>
      </div>
    </div>
  );
};
