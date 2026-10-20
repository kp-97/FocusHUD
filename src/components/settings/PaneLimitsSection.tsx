import React from "react";
import { Maximize2, Check } from "lucide-react";
import { MIN_PANE_MAX_WIDTH, MAX_PANE_MAX_WIDTH } from "../../utils/store";

interface PaneLimitsSectionProps {
  maxLeft: number;
  maxRight: number;
  onChangeMaxLeft: (val: number) => void;
  onChangeMaxRight: (val: number) => void;
  onApplyLimits: () => void;
  limitsApplied: boolean;
}

export const PaneLimitsSection: React.FC<PaneLimitsSectionProps> = ({
  maxLeft,
  maxRight,
  onChangeMaxLeft,
  onChangeMaxRight,
  onApplyLimits,
  limitsApplied,
}) => {
  return (
    <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3 space-y-3">
      <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
          MAXIMUM PANE WIDTH LIMITS
        </span>
        <span className="text-[10px] text-cyan-400/70 font-tech">
          {MIN_PANE_MAX_WIDTH}px - {MAX_PANE_MAX_WIDTH}px
        </span>
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
                  if (!isNaN(val)) {
                    onChangeMaxLeft(Math.max(MIN_PANE_MAX_WIDTH, Math.min(MAX_PANE_MAX_WIDTH, val)));
                  }
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
            onChange={(e) => onChangeMaxLeft(Number(e.target.value))}
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
                  if (!isNaN(val)) {
                    onChangeMaxRight(Math.max(MIN_PANE_MAX_WIDTH, Math.min(MAX_PANE_MAX_WIDTH, val)));
                  }
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
            onChange={(e) => onChangeMaxRight(Number(e.target.value))}
            aria-label="Right Pane Max Width Slider"
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onApplyLimits}
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
  );
};
