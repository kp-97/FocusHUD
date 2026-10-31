import React from "react";
import { Settings, Palette, Puzzle, LogOut } from "lucide-react";
import { exitApp } from "../../../services/tauriBridge";
import { useTheme } from "../../../stores/themeStore";

interface SystemMenuDropdownProps {
  isOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onOpenSettings?: (tab?: string) => void;
  side?: "left" | "right";
}

interface MenuThemeConfig {
  containerBg: string;
  borderColor: string;
  borderRadius?: string;
  boxShadow: string;
  notchBg: string;
  notchBorderColor: string;
  headerColor: string;
  headerBorderColor: string;
  itemTitleColor: string;
  itemSubtextColor: string;
  itemHoverClass: string;
  iconColor: string;
  dividerColor: string;
  logoutTitleColor: string;
  logoutSubtextColor: string;
  logoutHoverClass: string;
  logoutIconColor: string;
}

const THEME_MENU_STYLES: Record<string, MenuThemeConfig> = {
  cyber: {
    containerBg: "rgba(4, 13, 26, 0.96)",
    borderColor: "rgba(0, 229, 255, 0.4)",
    borderRadius: "8px",
    boxShadow: "0 0 20px rgba(0, 229, 255, 0.25)",
    notchBg: "#040d1a",
    notchBorderColor: "rgba(0, 229, 255, 0.5)",
    headerColor: "rgba(0, 229, 255, 0.7)",
    headerBorderColor: "rgba(0, 229, 255, 0.2)",
    itemTitleColor: "#a5f3fc",
    itemSubtextColor: "rgba(0, 229, 255, 0.7)",
    itemHoverClass: "hover:bg-cyan-500/20",
    iconColor: "#00e5ff",
    dividerColor: "rgba(0, 229, 255, 0.2)",
    logoutTitleColor: "#f87171",
    logoutSubtextColor: "rgba(248, 113, 113, 0.7)",
    logoutHoverClass: "hover:bg-red-500/15",
    logoutIconColor: "#f87171",
  },
  light: {
    containerBg: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: "10px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.14), 0 2px 6px rgba(15, 23, 42, 0.08)",
    notchBg: "#ffffff",
    notchBorderColor: "#cbd5e1",
    headerColor: "#64748b",
    headerBorderColor: "#e2e8f0",
    itemTitleColor: "#0f172a",
    itemSubtextColor: "#64748b",
    itemHoverClass: "hover:bg-slate-100",
    iconColor: "#0284c7",
    dividerColor: "#e2e8f0",
    logoutTitleColor: "#dc2626",
    logoutSubtextColor: "#ef4444",
    logoutHoverClass: "hover:bg-red-50",
    logoutIconColor: "#dc2626",
  },
  pink: {
    containerBg: "rgba(255, 255, 255, 0.98)",
    borderColor: "rgba(244, 63, 94, 0.3)",
    borderRadius: "16px",
    boxShadow: "0 12px 32px rgba(244, 63, 94, 0.18), 0 2px 8px rgba(244, 63, 94, 0.08)",
    notchBg: "#ffffff",
    notchBorderColor: "rgba(244, 63, 94, 0.3)",
    headerColor: "#9d174d",
    headerBorderColor: "rgba(244, 63, 94, 0.2)",
    itemTitleColor: "#831843",
    itemSubtextColor: "#9d174d",
    itemHoverClass: "hover:bg-rose-50",
    iconColor: "#f43f5e",
    dividerColor: "rgba(244, 63, 94, 0.2)",
    logoutTitleColor: "#e11d48",
    logoutSubtextColor: "#f43f5e",
    logoutHoverClass: "hover:bg-rose-100/60",
    logoutIconColor: "#e11d48",
  },
  nord: {
    containerBg: "rgba(46, 52, 64, 0.98)",
    borderColor: "rgba(136, 192, 208, 0.35)",
    borderRadius: "10px",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(136, 192, 208, 0.2)",
    notchBg: "#2e3440",
    notchBorderColor: "rgba(136, 192, 208, 0.35)",
    headerColor: "#88c0d0",
    headerBorderColor: "rgba(136, 192, 208, 0.2)",
    itemTitleColor: "#eceff4",
    itemSubtextColor: "#d8dee9",
    itemHoverClass: "hover:bg-[#3b4252]",
    iconColor: "#88c0d0",
    dividerColor: "rgba(136, 192, 208, 0.2)",
    logoutTitleColor: "#bf616a",
    logoutSubtextColor: "#d08770",
    logoutHoverClass: "hover:bg-red-950/40",
    logoutIconColor: "#bf616a",
  },
  amber: {
    containerBg: "rgba(16, 13, 8, 0.96)",
    borderColor: "rgba(255, 176, 0, 0.4)",
    borderRadius: "8px",
    boxShadow: "0 0 20px rgba(255, 176, 0, 0.25)",
    notchBg: "#100d08",
    notchBorderColor: "rgba(255, 176, 0, 0.5)",
    headerColor: "rgba(255, 176, 0, 0.7)",
    headerBorderColor: "rgba(255, 176, 0, 0.2)",
    itemTitleColor: "#fef3c7",
    itemSubtextColor: "rgba(255, 176, 0, 0.7)",
    itemHoverClass: "hover:bg-amber-500/20",
    iconColor: "#ffb000",
    dividerColor: "rgba(255, 176, 0, 0.2)",
    logoutTitleColor: "#f87171",
    logoutSubtextColor: "rgba(248, 113, 113, 0.7)",
    logoutHoverClass: "hover:bg-red-500/15",
    logoutIconColor: "#f87171",
  },
  matrix: {
    containerBg: "rgba(2, 8, 3, 0.96)",
    borderColor: "rgba(0, 255, 102, 0.4)",
    borderRadius: "8px",
    boxShadow: "0 0 20px rgba(0, 255, 102, 0.25)",
    notchBg: "#020803",
    notchBorderColor: "rgba(0, 255, 102, 0.5)",
    headerColor: "rgba(0, 255, 102, 0.7)",
    headerBorderColor: "rgba(0, 255, 102, 0.2)",
    itemTitleColor: "#dcfce7",
    itemSubtextColor: "rgba(0, 255, 102, 0.7)",
    itemHoverClass: "hover:bg-emerald-500/20",
    iconColor: "#00ff66",
    dividerColor: "rgba(0, 255, 102, 0.2)",
    logoutTitleColor: "#f87171",
    logoutSubtextColor: "rgba(248, 113, 113, 0.7)",
    logoutHoverClass: "hover:bg-red-500/15",
    logoutIconColor: "#f87171",
  },
  dark: {
    containerBg: "rgba(10, 10, 12, 0.96)",
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderRadius: "8px",
    boxShadow: "0 0 20px rgba(0, 0, 0, 0.5)",
    notchBg: "#0a0a0c",
    notchBorderColor: "rgba(148, 163, 184, 0.35)",
    headerColor: "#94a3b8",
    headerBorderColor: "rgba(148, 163, 184, 0.2)",
    itemTitleColor: "#f1f5f9",
    itemSubtextColor: "#94a3b8",
    itemHoverClass: "hover:bg-slate-800/60",
    iconColor: "#f1f5f9",
    dividerColor: "rgba(148, 163, 184, 0.2)",
    logoutTitleColor: "#f87171",
    logoutSubtextColor: "rgba(248, 113, 113, 0.7)",
    logoutHoverClass: "hover:bg-red-500/15",
    logoutIconColor: "#f87171",
  },
};

export const SystemMenuDropdown: React.FC<SystemMenuDropdownProps> = ({
  isOpen,
  menuRef,
  onClose,
  onOpenSettings,
  side = "left",
}) => {
  const { themeConfig, effectiveTheme } = useTheme();
  const style = THEME_MENU_STYLES[effectiveTheme] || THEME_MENU_STYLES.cyber;

  if (!isOpen) return null;

  const positionClasses =
    side === "left"
      ? "top-1 left-[calc(100%+24px)]"
      : "top-1 right-[calc(100%+20px)]";

  const notchClasses =
    side === "left"
      ? "-left-1.5 top-3 border-l border-b"
      : "-right-1.5 top-3 border-r border-t";

  return (
    <div
      ref={menuRef}
      className={`absolute ${positionClasses} w-52 z-50 p-1.5 flex flex-col gap-1 font-hud text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-150`}
      style={{
        backgroundColor: style.containerBg,
        border: `1px solid ${style.borderColor}`,
        borderRadius: style.borderRadius || "8px",
        boxShadow: style.boxShadow,
      }}
      role="menu"
      aria-label="System Menu"
    >
      {/* Pointing notch back to sidebar */}
      <div
        className={`absolute w-2.5 h-2.5 rotate-45 ${notchClasses}`}
        style={{
          backgroundColor: style.notchBg,
          borderColor: style.notchBorderColor,
        }}
      />

      <div
        className="px-2.5 py-1 text-[9px] font-tech uppercase tracking-widest border-b"
        style={{
          color: style.headerColor,
          borderColor: style.headerBorderColor,
        }}
      >
        SYSTEM MENU
      </div>

      {/* 1. Settings */}
      <button
        onClick={() => {
          onClose();
          if (onOpenSettings) onOpenSettings("all");
        }}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded transition-all text-left cursor-pointer ${style.itemHoverClass}`}
        role="menuitem"
      >
        <Settings className="w-3.5 h-3.5 shrink-0" style={{ color: style.iconColor }} />
        <div className="flex flex-col">
          <span className="font-semibold tracking-wider" style={{ color: style.itemTitleColor }}>
            SETTINGS
          </span>
          <span className="text-[9px] font-tech" style={{ color: style.itemSubtextColor }}>
            Preferences & Panes
          </span>
        </div>
      </button>

      {/* 2. Themes */}
      <button
        onClick={() => {
          onClose();
          if (onOpenSettings) onOpenSettings("appearance");
        }}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded transition-all text-left cursor-pointer ${style.itemHoverClass}`}
        role="menuitem"
      >
        <Palette className="w-3.5 h-3.5 shrink-0" style={{ color: style.iconColor }} />
        <div className="flex flex-col">
          <span className="font-semibold tracking-wider" style={{ color: style.itemTitleColor }}>
            THEMES
          </span>
          <span className="text-[9px] font-tech" style={{ color: style.itemSubtextColor }}>
            {themeConfig?.name || "Cyber HUD"} (Active)
          </span>
        </div>
      </button>

      {/* 3. Extensions */}
      <button
        onClick={onClose}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded transition-all text-left cursor-pointer ${style.itemHoverClass}`}
        role="menuitem"
      >
        <Puzzle className="w-3.5 h-3.5 shrink-0" style={{ color: style.iconColor }} />
        <div className="flex flex-col">
          <span className="font-semibold tracking-wider" style={{ color: style.itemTitleColor }}>
            EXTENSIONS
          </span>
          <span className="text-[9px] font-tech" style={{ color: style.itemSubtextColor }}>
            Plugins & Integrations
          </span>
        </div>
      </button>

      <div className="my-0.5 border-t" style={{ borderColor: style.dividerColor }} />

      {/* 4. Log out */}
      <button
        onClick={() => {
          onClose();
          exitApp();
        }}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded transition-all text-left cursor-pointer ${style.logoutHoverClass}`}
        role="menuitem"
      >
        <LogOut className="w-3.5 h-3.5 shrink-0" style={{ color: style.logoutIconColor }} />
        <div className="flex flex-col">
          <span className="font-semibold tracking-wider" style={{ color: style.logoutTitleColor }}>
            LOG OUT
          </span>
          <span className="text-[9px] font-tech" style={{ color: style.logoutSubtextColor }}>
            Lock HUD & Exit
          </span>
        </div>
      </button>
    </div>
  );
};
