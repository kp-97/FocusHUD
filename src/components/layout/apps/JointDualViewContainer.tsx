import React, { useState, useRef, useEffect } from "react";
import { HudBrackets } from "../../ui/HudBrackets";
import { ResizeHandle } from "../ResizeHandle";
import { ChevronDown, Columns3, X } from "lucide-react";
import { AVAILABLE_RIGHT_VIEWS } from "../RightSidebar/RightSidebar";

export interface JointDualViewContainerProps {
  isDualView: boolean;
  jointLeftWidth: number;
  activeNav: string;
  currentRightNav: string;
  containerWidth: number;
  onSelectRightNav: (nav: string) => void;
  onToggleDualView: (dual: boolean) => void;
  onDividerChange: (newWidth: number) => void;
  onDividerEnd: (finalWidth: number) => void;
  renderView: (nav: string) => React.ReactNode;
}

export const JointDualViewContainer: React.FC<JointDualViewContainerProps> = ({
  isDualView,
  jointLeftWidth,
  activeNav,
  currentRightNav,
  containerWidth,
  onSelectRightNav,
  onToggleDualView,
  onDividerChange,
  onDividerEnd,
  renderView,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  const availableWidth = Math.max(400, containerWidth - 136);
  const clampedLeftWidth = Math.max(180, Math.min(availableWidth - 180, jointLeftWidth));

  const currentRightItem =
    AVAILABLE_RIGHT_VIEWS.find((item) => item.id === currentRightNav) || AVAILABLE_RIGHT_VIEWS[0];
  const RightIcon = currentRightItem.icon;

  if (!isDualView) {
    return (
      <HudBrackets variant="cyan" showTicks={false} className="h-full w-full flex flex-col overflow-hidden">
        <div className="h-7 shrink-0 flex items-center justify-between px-3 border-b border-cyan-500/20 bg-cyan-950/20 text-cyan-400 font-mono text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00e5ff]" />
            <span className="uppercase tracking-wider font-semibold">{activeNav}</span>
          </div>
          <button
            data-testid="toggle-dual-view-button"
            onClick={() => onToggleDualView(true)}
            title="Split into two views"
            className="flex items-center gap-1.5 text-[11px] text-cyan-400/80 hover:text-cyan-200 hover:bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded transition cursor-pointer"
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span className="font-tech uppercase">Split View</span>
          </button>
        </div>
        <div className="flex-1 flex flex-col p-2 min-w-0 overflow-y-auto">
          {renderView(activeNav)}
        </div>
      </HudBrackets>
    );
  }

  return (
    <div
      data-testid="dual-view-container"
      className="flex-1 h-full min-w-0 flex flex-row relative overflow-hidden"
    >
      {/* View 1 (Left) */}
      <div
        data-testid="dual-view-left-pane"
        style={{ width: `${clampedLeftWidth}px` }}
        className="h-full shrink-0 flex flex-col overflow-hidden pr-0.5"
      >
        <HudBrackets variant="cyan" showTicks={false} className="h-full w-full flex flex-col overflow-hidden">
          <div className="h-7 shrink-0 flex items-center justify-between px-3 border-b border-cyan-500/20 bg-cyan-950/20 text-cyan-400 font-mono text-xs select-none">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#00e5ff]" />
              <span className="uppercase tracking-wider font-semibold truncate">VIEW 1: {activeNav}</span>
            </div>
            <span className="text-[10px] text-cyan-500/60 uppercase tracking-widest">SYS.01</span>
          </div>
          <div className="flex-1 flex flex-col p-2 min-w-0 overflow-y-auto">
            {renderView(activeNav)}
          </div>
        </HudBrackets>
      </div>

      {/* Resizer Divider */}
      <ResizeHandle
        side="left"
        currentWidth={clampedLeftWidth}
        minWidth={180}
        maxWidth={availableWidth - 180}
        snapPoints={[{ value: Math.round(availableWidth / 2), label: "CENTER (50%)" }]}
        onDragChange={onDividerChange}
        onDragEnd={onDividerEnd}
        onDoubleClick={() => onDividerEnd(Math.round(availableWidth / 2))}
      />

      {/* View 2 (Right) */}
      <div
        data-testid="dual-view-right-pane"
        className="flex-1 h-full min-w-0 flex flex-col overflow-hidden pl-0.5"
      >
        <HudBrackets variant="amber" showTicks={false} className="h-full w-full flex flex-col overflow-hidden">
          <div className="h-7 shrink-0 flex items-center justify-between px-3 border-b border-amber-500/20 bg-amber-950/20 text-amber-400 font-mono text-xs select-none relative z-30">
            <div className="relative" ref={dropdownRef}>
              <button
                data-testid="dual-view-right-selector-button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-[11px] text-amber-300 font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded transition cursor-pointer"
              >
                <RightIcon className="w-3.5 h-3.5" />
                <span>{currentRightItem.label}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {isDropdownOpen && (
                <div
                  role="menu"
                  aria-label="Select View 2"
                  className="absolute top-full left-0 mt-1 w-44 bg-[#050b14] border border-amber-500/40 rounded shadow-[0_4px_16px_rgba(0,0,0,0.8)] z-50 py-1 font-tech select-none"
                >
                  {AVAILABLE_RIGHT_VIEWS.map((item) => {
                    const Icon = item.icon;
                    const isSelected = currentRightNav === item.id;
                    return (
                      <button
                        key={item.id}
                        role="menuitem"
                        onClick={() => {
                          onSelectRightNav(item.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] transition cursor-pointer ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-300 font-bold border-l-2 border-amber-400"
                            : "text-amber-200/80 hover:bg-amber-500/10 hover:text-amber-100"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-amber-500/60 uppercase tracking-widest">SYS.02</span>
              <button
                data-testid="close-dual-view-button"
                onClick={() => onToggleDualView(false)}
                title="Close View 2 (Single View)"
                className="text-amber-400/70 hover:text-amber-200 hover:bg-amber-500/20 p-0.5 rounded transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 flex flex-col p-2 min-w-0 overflow-y-auto">
            {renderView(currentRightNav)}
          </div>
        </HudBrackets>
      </div>
    </div>
  );
};

