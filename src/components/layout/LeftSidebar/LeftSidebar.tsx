import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  MessageSquare,
  Calendar,
  Target,
  CheckSquare,
  Columns3,
  Workflow,
  Timer,
  Menu,
  Settings,
  FileText,
} from "lucide-react";
import { HudBrackets } from "../../ui/HudBrackets";
import { WaveformVisualizer } from "../../ui/WaveformVisualizer";
import { SidebarToggleIcon } from "../../ui/SidebarToggleIcon";
import { getSystemDiagnostics, setDockPopoutMode } from "../../../services/tauriBridge";
import type { SystemDiagnostics } from "../../../types/diagnostics";
import { broadcastNavChange, loadNavConfig, subscribeLayoutAction } from "../../../stores/layoutStore";
import { NavViewId, NavItemConfig } from "../../../types/hud";
import { SystemMenuDropdown } from "./SystemMenuDropdown";
import { DiagnosticsCard } from "./DiagnosticsCard";
import { NotesView } from "../../views/NotesView";

const NAV_ICON_MAP: Record<NavViewId, React.ComponentType<{ className?: string }>> = {
  home: Home,
  chat: MessageSquare,
  calendar: Calendar,
  goals: Target,
  tasks: CheckSquare,
  notes: FileText,
  action_plans: Workflow,
  timer: Timer,
  kanban: Columns3,
};

interface LeftSidebarProps {
  width: number;
  activeNav: string;
  onSelectNav: (id: string) => void;
  isCompact?: boolean;
  isDockMode?: boolean;
  onToggleCollapse?: () => void;
  onOpenSettings?: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  width,
  activeNav,
  onSelectNav,
  isCompact = false,
  onToggleCollapse,
  onOpenSettings,
}) => {
  const [diag, setDiag] = useState<SystemDiagnostics | null>(null);
  const [diagnosticsCollapsed, setDiagnosticsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("hud_diag_collapsed") === "true";
  });
  const [dockMode, setDockMode] = useState<"monitoring" | "notes">("monitoring");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  // Sync dock popout mode with native window and close when clicking outside, pressing Escape, or window blur
  useEffect(() => {
    setDockPopoutMode("left", isMenuOpen);

    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !menuBtnRef.current?.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    const handleBlur = () => {
      setIsMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleBlur);
      setDockPopoutMode("left", false);
    };
  }, [isMenuOpen]);

  const toggleDiagnosticsCollapsed = () => {
    setDiagnosticsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("hud_diag_collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    let mounted = true;
    const fetchDiag = async () => {
      const data = await getSystemDiagnostics();
      if (mounted && data) {
        setDiag(data);
      }
    };

    fetchDiag();
    const interval = setInterval(fetchDiag, 1200);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const [navConfig, setNavConfig] = useState<NavItemConfig[]>(() => loadNavConfig());

  // Listen for navigation configuration changes across windows
  useEffect(() => {
    const unsubscribe = subscribeLayoutAction((action) => {
      if (action.type === "NAV_CONFIG_CHANGE") {
        setNavConfig(action.config);
      }
    });
    return unsubscribe;
  }, []);

  // If the currently selected navigation view was toggled off, fallback to home
  useEffect(() => {
    const isCurrentVisible = navConfig.some(
      (item) => item.id === activeNav && item.visible
    );
    if (!isCurrentVisible) {
      onSelectNav("home");
      broadcastNavChange("home");
    }
  }, [navConfig, activeNav, onSelectNav]);

  const visibleNavItems = navConfig
    .filter((item) => item.visible)
    .map((item) => ({
      id: item.id,
      label: item.label,
      icon: NAV_ICON_MAP[item.id] || Home,
    }));

  const isIconOnly = width < 120;
  const compactMode = isCompact || width < 220;

  return (
    <aside
      style={{ width: `${width}px` }}
      className="h-full shrink-0 flex flex-col p-2 bg-[#03070d] border-r border-cyan-500/30 text-cyan-300 select-none overflow-visible relative z-30"
    >
      <HudBrackets className="h-full flex flex-col justify-between p-2 overflow-visible">
        {/* Top Header: FocusHUD & Controls (Pinned) */}
        <div className="shrink-0 flex flex-col w-full relative">
          {/* Header Row: Dual Expand/Collapse Button + Title & Controls */}
          <div className="border-b border-cyan-500/30 pb-1 mb-1">
            <div className="flex items-center">
              {/* Left Column: Fixed Left-Right Pane Expand/Collapse Button */}
              <div className="w-8 shrink-0 flex items-center justify-center h-7">
                {onToggleCollapse && (
                  <SidebarToggleIcon
                    side="both"
                    isCollapsed={isIconOnly}
                    onToggle={onToggleCollapse}
                    theme="cyan"
                  />
                )}
              </div>

              {/* Expanded Section: FocusHUD Title + Settings + Menu */}
              {!isIconOnly && (
                <div className="flex-1 min-w-0 flex items-center justify-between h-7 pl-2">
                  <h1 className="font-orbitron font-bold text-sm tracking-wider text-cyan-200 hud-glow-cyan truncate">
                    FocusHUD
                  </h1>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      ref={menuBtnRef}
                      onClick={() => setIsMenuOpen((prev) => !prev)}
                      title="System Menu"
                      aria-label="System Menu"
                      aria-expanded={isMenuOpen}
                      className="text-cyan-400/80 hover:text-cyan-200 hover:scale-110 transition p-1 cursor-pointer"
                    >
                      <Menu className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Hamburger Dropdown Menu (Extracted Component) */}
          <SystemMenuDropdown
            isOpen={isMenuOpen}
            menuRef={menuRef}
            onClose={() => setIsMenuOpen(false)}
            onOpenSettings={onOpenSettings}
          />

          {/* Diagnostic Waveform Banner */}
          {!isIconOnly && (
            <div className="my-1">
              <WaveformVisualizer isCompact={compactMode} />
            </div>
          )}

          {/* Dock Mode Switcher: Monitoring vs Notes Scratchpad */}
          {!isIconOnly && (
            <div className="flex items-center gap-1 my-1 p-0.5 rounded bg-black/60 border border-cyan-500/30 text-[10px] font-tech shrink-0">
              <button
                type="button"
                onClick={() => setDockMode("monitoring")}
                className={`flex-1 py-0.5 rounded text-center uppercase tracking-wider font-semibold transition cursor-pointer ${
                  dockMode === "monitoring"
                    ? "bg-cyan-500/20 text-cyan-100 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,229,255,0.2)]"
                    : "text-cyan-400/60 hover:text-cyan-200"
                }`}
              >
                MONITORING
              </button>
              <button
                type="button"
                onClick={() => setDockMode("notes")}
                className={`flex-1 py-0.5 rounded text-center uppercase tracking-wider font-semibold transition cursor-pointer ${
                  dockMode === "notes"
                    ? "bg-cyan-500/20 text-cyan-100 border border-cyan-500/40 shadow-[0_0_8px_rgba(0,229,255,0.2)]"
                    : "text-cyan-400/60 hover:text-cyan-200"
                }`}
              >
                NOTES
              </button>
            </div>
          )}
        </div>

        {/* Content Section: Notes View OR Navigation Views & Diagnostics with smooth transition */}
        {dockMode === "notes" && !isIconOnly ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden transition-all duration-300 animate-in fade-in">
            <NotesView isLeftDock={true} onBackToMonitoring={() => setDockMode("monitoring")} />
          </div>
        ) : (
          <>
            {/* Scrollable Navigation Views: Starts at HOME and ends above DIAGNOSTICS */}
            <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden my-2 pr-0.5 transition-all duration-300">
              <nav className={`flex flex-col ${isIconOnly ? "gap-2 items-center w-full" : "gap-2"}`}>
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.id;

                  return (
                    <div key={item.id} className={`flex flex-col ${isIconOnly ? "w-full items-center" : ""}`}>
                      <button
                        onClick={() => {
                          onSelectNav(item.id);
                          broadcastNavChange(item.id as NavViewId);
                        }}
                        className={`hud-btn flex items-center rounded text-xs font-hud tracking-widest uppercase cursor-pointer transition-all ${
                          isActive ? "hud-btn-active text-cyan-100" : "text-cyan-300/80"
                        } ${
                          isIconOnly
                            ? "w-full aspect-square justify-center p-0 max-w-[44px]"
                            : "justify-start px-3 py-2.5"
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? "text-cyan-200" : "text-cyan-400/80"}`} />
                          {!isIconOnly && <span className="font-semibold">{item.label}</span>}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </nav>
            </div>
          </>
        )}

        {/* Bottom Section: System Stats & Settings Button */}
        <div className="shrink-0 w-full flex flex-col border-t border-cyan-500/30 pt-2">
          {dockMode === "monitoring" && !isIconOnly && (
            <DiagnosticsCard
              diag={diag}
              collapsed={diagnosticsCollapsed}
              onToggleCollapse={toggleDiagnosticsCollapsed}
            />
          )}

          {/* Pinned Bottom Left Settings Button (both contracted and expanded views) */}
          <div
            className={`w-full flex items-center ${
              isIconOnly ? "justify-center pt-0" : "justify-start border-t border-cyan-500/20 pt-1.5"
            }`}
          >
            <button
              onClick={onOpenSettings}
              title="Settings"
              aria-label="Settings"
              className={`hud-btn flex items-center rounded text-xs font-hud tracking-widest uppercase cursor-pointer transition-all text-cyan-300/80 hover:text-cyan-100 hover:bg-cyan-500/20 ${
                isIconOnly
                  ? "w-full aspect-square justify-center p-0 max-w-[44px]"
                  : "w-full justify-start px-2.5 py-1.5"
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400 shrink-0" />
                {!isIconOnly && <span className="font-semibold text-xs tracking-wider">SETTINGS</span>}
              </div>
            </button>
          </div>
        </div>
      </HudBrackets>
    </aside>
  );
};
