import React from "react";
import { Settings, Palette, Puzzle, LogOut } from "lucide-react";
import { exitApp } from "../../../services/tauriBridge";

interface SystemMenuDropdownProps {
  isOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onOpenSettings?: () => void;
}

export const SystemMenuDropdown: React.FC<SystemMenuDropdownProps> = ({
  isOpen,
  menuRef,
  onClose,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-1 left-[calc(100%+24px)] w-52 bg-[#040d1a]/95 backdrop-blur-md border border-cyan-500/40 rounded-lg shadow-[0_0_20px_rgba(0,229,255,0.25)] z-50 p-1.5 flex flex-col gap-1 font-hud text-xs animate-in fade-in zoom-in-95 duration-150"
      role="menu"
      aria-label="System Menu"
    >
      {/* Pointing notch back to sidebar */}
      <div className="absolute -left-1.5 top-3 w-2.5 h-2.5 bg-[#040d1a] rotate-45 border-l border-b border-cyan-500/50" />
      <div className="px-2.5 py-1 text-[9px] font-tech text-cyan-400/60 uppercase tracking-widest border-b border-cyan-500/20">
        SYSTEM MENU
      </div>

      {/* 1. Settings */}
      <button
        onClick={() => {
          onClose();
          if (onOpenSettings) onOpenSettings();
        }}
        className="flex items-center gap-2.5 px-2.5 py-2 rounded text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/20 transition-all text-left cursor-pointer"
        role="menuitem"
      >
        <Settings className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <div className="flex flex-col">
          <span className="font-semibold tracking-wider">SETTINGS</span>
          <span className="text-[9px] font-tech text-cyan-400/70">Preferences & Panes</span>
        </div>
      </button>

      {/* 2. Themes */}
      <button
        onClick={onClose}
        className="flex items-center gap-2.5 px-2.5 py-2 rounded text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/20 transition-all text-left cursor-pointer"
        role="menuitem"
      >
        <Palette className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <div className="flex flex-col">
          <span className="font-semibold tracking-wider">THEMES</span>
          <span className="text-[9px] font-tech text-cyan-400/70">Cyan Cyberpunk (Active)</span>
        </div>
      </button>

      {/* 3. Extensions */}
      <button
        onClick={onClose}
        className="flex items-center gap-2.5 px-2.5 py-2 rounded text-cyan-300 hover:text-cyan-100 hover:bg-cyan-500/20 transition-all text-left cursor-pointer"
        role="menuitem"
      >
        <Puzzle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <div className="flex flex-col">
          <span className="font-semibold tracking-wider">EXTENSIONS</span>
          <span className="text-[9px] font-tech text-cyan-400/70">Plugins & Integrations</span>
        </div>
      </button>

      <div className="my-0.5 border-t border-cyan-500/20" />

      {/* 4. Log out */}
      <button
        onClick={() => {
          onClose();
          exitApp();
        }}
        className="flex items-center gap-2.5 px-2.5 py-2 rounded text-red-400/80 hover:text-red-300 hover:bg-red-500/15 transition-all text-left cursor-pointer"
        role="menuitem"
      >
        <LogOut className="w-3.5 h-3.5 text-red-400 shrink-0" />
        <div className="flex flex-col">
          <span className="font-semibold tracking-wider">LOG OUT</span>
          <span className="text-[9px] font-tech text-red-400/60">Lock HUD & Exit</span>
        </div>
      </button>
    </div>
  );
};
