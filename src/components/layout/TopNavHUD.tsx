import React from "react";
import {
  Magnet,
  RefreshCw,
  Radio,
  Monitor,
} from "lucide-react";
import { Tooltip } from "../ui/Tooltip";

interface TopNavHUDProps {
  leftWidth: number;
  rightWidth: number;
  magneticSnap: boolean;
  onToggleMagneticSnap: () => void;
  desktopDockActive: boolean;
  onToggleDesktopDock: () => void;
  onApplyPreset: (left: number, right: number) => void;
  onReset: () => void;
}

export const TopNavHUD: React.FC<TopNavHUDProps> = ({
  leftWidth,
  rightWidth,
  magneticSnap,
  onToggleMagneticSnap,
  desktopDockActive,
  onToggleDesktopDock,
  onApplyPreset,
  onReset,
}) => {
  return (
    <header className="h-9 w-full bg-black/85 border-b border-cyan-500/30 flex items-center justify-between px-3 text-cyan-300 font-tech text-xs select-none relative z-40 backdrop-blur-md">
      {/* Left indicator & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="font-orbitron font-bold text-xs tracking-widest text-cyan-200 hud-glow-cyan">
            OVERLAY HUD // v1.0
          </span>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[11px] text-cyan-500/70 border-l border-cyan-500/30 pl-3">
          <Radio className="w-3 h-3 text-cyan-400" />
          <span>LINK: SYNCED</span>
        </div>
      </div>

      {/* Middle Layout Presets */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-cyan-500/60 mr-1 hidden sm:inline">PRESETS:</span>
        <button
          onClick={() => onApplyPreset(280, 280)}
          className={`px-2 py-0.5 rounded text-[10px] border transition ${
            leftWidth === 280 && rightWidth === 280
              ? "bg-cyan-500/30 border-cyan-400 text-cyan-100 shadow-[0_0_8px_#00e5ff]"
              : "bg-black/40 border-cyan-500/30 text-cyan-400/80 hover:border-cyan-400 hover:text-cyan-200"
          }`}
        >
          Default (280/280)
        </button>

        <button
          onClick={() => onApplyPreset(220, 220)}
          className={`px-2 py-0.5 rounded text-[10px] border transition ${
            leftWidth === 220 && rightWidth === 220
              ? "bg-cyan-500/30 border-cyan-400 text-cyan-100 shadow-[0_0_8px_#00e5ff]"
              : "bg-black/40 border-cyan-500/30 text-cyan-400/80 hover:border-cyan-400 hover:text-cyan-200"
          }`}
        >
          Wide Middle
        </button>

        <button
          onClick={() => onApplyPreset(68, 68)}
          className={`px-2 py-0.5 rounded text-[10px] border transition ${
            leftWidth === 68 && rightWidth === 68
              ? "bg-cyan-500/30 border-cyan-400 text-cyan-100 shadow-[0_0_8px_#00e5ff]"
              : "bg-black/40 border-cyan-500/30 text-cyan-400/80 hover:border-cyan-400 hover:text-cyan-200"
          }`}
        >
          Square Icons (68/68)
        </button>

        {/* Magnetic Snap Toggle */}
        <Tooltip
          content={magneticSnap ? "Magnetic Snap is ON (Snaps to 64, 220, 280, 360px)" : "Magnetic Snap is OFF"}
          side="bottom"
          theme="cyan"
        >
          <button
            onClick={onToggleMagneticSnap}
            aria-label={magneticSnap ? "Magnetic Snap is ON" : "Magnetic Snap is OFF"}
            className={`flex items-center gap-1 ml-2 px-2 py-0.5 rounded text-[10px] border transition cursor-pointer ${
              magneticSnap
                ? "bg-cyan-400/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,229,255,0.3)]"
                : "bg-black/40 border-neutral-700 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Magnet className="w-3 h-3 text-cyan-400" />
            <span>SNAP: {magneticSnap ? "ON" : "OFF"}</span>
          </button>
        </Tooltip>

        {/* Windows Desktop Docking Toggle (Native Desktop Work Area Snapping) */}
        <Tooltip
          content={
            desktopDockActive
              ? "Desktop Dock ACTIVE: Windows Work Area is constrained so all open programs snap into the middle!"
              : "Click to activate native Windows Desktop Docking (snaps open apps to middle column)"
          }
          side="bottom"
          theme="cyan"
        >
          <button
            onClick={onToggleDesktopDock}
            aria-label={desktopDockActive ? "Desktop Dock ACTIVE" : "Desktop Dock STANDBY"}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition cursor-pointer ${
              desktopDockActive
                ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                : "bg-black/40 border-cyan-500/30 text-cyan-400/80 hover:border-cyan-400 hover:text-cyan-200"
            }`}
          >
            <Monitor className={`w-3 h-3 ${desktopDockActive ? "text-emerald-300 animate-pulse" : "text-cyan-400"}`} />
            <span>DESKTOP DOCK: {desktopDockActive ? "ACTIVE" : "STANDBY"}</span>
          </button>
        </Tooltip>
      </div>

      {/* Right Actions & Metrics */}
      <div className="flex items-center gap-2">
        <Tooltip content="Reset to default dimensions" side="bottom" theme="cyan">
          <button
            onClick={onReset}
            aria-label="Reset to default dimensions"
            className="p-1 rounded bg-black/40 border border-cyan-500/30 text-cyan-400 hover:text-white hover:border-cyan-400 transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </Tooltip>

        <div className="hidden lg:flex items-center gap-2 text-[10px] text-cyan-400/70 border-l border-cyan-500/30 pl-2">
          <span>LEFT: {Math.round(leftWidth)}px</span>
          <span>|</span>
          <span>RIGHT: {Math.round(rightWidth)}px</span>
        </div>
      </div>
    </header>
  );
};
