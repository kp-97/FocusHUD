import React from "react";
import { ListOrdered, Check, RotateCcw, ChevronUp, ChevronDown } from "lucide-react";
import { NavItemConfig } from "../../types/hud";

interface NavViewCustomizationSectionProps {
  navConfig: NavItemConfig[];
  onToggleVisibility: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onResetNav: () => void;
  navResetSuccess: boolean;
}

export const NavViewCustomizationSection: React.FC<NavViewCustomizationSectionProps> = ({
  navConfig,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onResetNav,
  navResetSuccess,
}) => {
  return (
    <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3 space-y-3">
      <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
          NAVIGATION VIEWS & ORDERING
        </span>
        <button
          type="button"
          onClick={onResetNav}
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
                  onChange={() => onToggleVisibility(item.id)}
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
                onClick={() => onMoveUp(idx)}
                aria-label={`Move ${item.label} Up`}
                className="p-1 text-cyan-400/80 hover:text-cyan-100 disabled:opacity-30 disabled:pointer-events-none rounded hover:bg-cyan-500/20 transition cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={idx === navConfig.length - 1}
                onClick={() => onMoveDown(idx)}
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
  );
};
