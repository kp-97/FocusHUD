import React, { useState, useEffect } from "react";
import { X, Settings, Sliders, Check, RotateCcw } from "lucide-react";
import { HudBrackets } from "./HudBrackets";
import {
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  setRememberedLeftWidth,
  setRememberedRightWidth,
} from "../utils/store";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetWidths?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onResetWidths,
}) => {
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setResetSuccess(false);
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
            {/* Automatic Pane Sizing & Memory */}
            <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3 space-y-3">
              <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  PANE SIZING & MEMORY
                </span>
                <span className="text-[10px] text-cyan-400/70 font-tech">AUTO-MEMORY ACTIVE</span>
              </div>

              <p className="text-[11.5px] leading-relaxed text-cyan-200/80">
                FocusHUD automatically remembers your customized left and right pane widths when resizing.
                Expanding either pane seamlessly restores it to the exact width you last adjusted it to.
              </p>

              {/* Reset to Defaults Option */}
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
