import React from "react";
import { Sliders, RotateCcw, Check } from "lucide-react";
import { DEFAULT_LEFT_WIDTH, DEFAULT_RIGHT_WIDTH } from "../../utils/store";

interface PaneSizingMemorySectionProps {
  onResetDefaults: () => void;
  resetSuccess: boolean;
}

export const PaneSizingMemorySection: React.FC<PaneSizingMemorySectionProps> = ({
  onResetDefaults,
  resetSuccess,
}) => {
  return (
    <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3 space-y-3">
      <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          PANE SIZING & MEMORY
        </span>
        <span className="text-[10px] text-cyan-400/70 font-tech">AUTO-MEMORY ACTIVE</span>
      </div>

      <p className="text-[11px] leading-relaxed text-cyan-200/80">
        FocusHUD automatically remembers your customized left and right pane widths when
        resizing. Expanding either pane seamlessly restores it to the exact width you last
        adjusted it to.
      </p>

      <div className="flex items-center justify-between pt-2 border-t border-cyan-500/20">
        <div className="text-[10px] text-cyan-400/60">
          Defaults: {DEFAULT_LEFT_WIDTH}px (Left) / {DEFAULT_RIGHT_WIDTH}px (Right)
        </div>

        <button
          type="button"
          onClick={onResetDefaults}
          className="hud-btn px-2.5 py-1 rounded text-[10.5px] font-tech text-cyan-300 hover:text-cyan-100 border-cyan-500/40 flex items-center gap-1.5 cursor-pointer"
        >
          {resetSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-cyan-300" />
              Reset to Defaults!
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Widths
            </>
          )}
        </button>
      </div>
    </div>
  );
};
