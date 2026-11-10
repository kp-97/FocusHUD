import React from "react";
import { X, Copy, Square, Minus } from "lucide-react";
import { exitApp, minimizeToTray } from "../../../services/tauriBridge";

export interface RailWindowControlsProps {
  effectiveIsMaximised: boolean;
  effectiveIsFullscreen: boolean;
  onClickRestoreDown?: () => void;
  onClickMaximise?: () => void;
  onToggleMaximizeApp?: () => void;
  handleMaximize?: () => void;
  onClickMinimise?: () => void;
}

export const RailWindowControls: React.FC<RailWindowControlsProps> = ({
  effectiveIsMaximised,
  effectiveIsFullscreen,
  onClickRestoreDown,
  onClickMaximise,
  onToggleMaximizeApp,
  handleMaximize,
  onClickMinimise,
}) => {
  return (
    <div className="flex flex-col items-center gap-1 w-full pt-0.5">
      {/* Top: Exit */}
      <button
        onClick={() => exitApp()}
        data-testid="window-btn-close"
        title="Close FocusHUD (Restores Desktop)"
        aria-label="Close FocusHUD"
        className="text-cyan-500/50 hover:text-red-400 hover:scale-110 transition p-1 cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Maximise / Restore Down */}
      <button
        onClick={
          effectiveIsMaximised || effectiveIsFullscreen
            ? onClickRestoreDown || onToggleMaximizeApp
            : onClickMaximise || onToggleMaximizeApp || handleMaximize
        }
        data-testid={
          effectiveIsMaximised || effectiveIsFullscreen
            ? "window-btn-restore-down"
            : "window-btn-maximise"
        }
        title={
          effectiveIsMaximised || effectiveIsFullscreen
            ? "Click Restore Down (Restore FocusHUD)"
            : "Click Maximise (Maximize FocusHUD)"
        }
        aria-label={
          effectiveIsMaximised || effectiveIsFullscreen
            ? "Restore FocusHUD"
            : "Maximize FocusHUD"
        }
        className="text-cyan-400/70 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
      >
        {effectiveIsMaximised || effectiveIsFullscreen ? (
          <Copy className="w-3.5 h-3.5" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Bottom: Minimize */}
      <button
        onClick={() => {
          if (onClickMinimise) {
            onClickMinimise();
          } else {
            minimizeToTray();
          }
        }}
        data-testid="window-btn-minimise"
        title="Click Minimise (Minimize FocusHUD to Tray)"
        aria-label="Minimize FocusHUD to Tray"
        className="text-cyan-400/70 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

