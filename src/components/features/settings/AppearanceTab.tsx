import React from "react";
import { Sliders, RotateCcw, Check, Palette } from "lucide-react";
import { DEFAULT_LEFT_WIDTH, DEFAULT_RIGHT_WIDTH } from "../../../stores/layoutStore";
import { useTheme, THEME_LIST } from "../../../stores/themeStore";

interface AppearanceTabProps {
  onResetDefaults: () => void;
  resetSuccess: boolean;
}

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  onResetDefaults,
  resetSuccess,
}) => {
  const { theme, effectiveTheme, autoSync, setTheme, setAutoSync } = useTheme();

  return (
    <div className="space-y-4">
      {/* THEME SELECTION SECTION */}
      <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            HUD THEME & PALETTE
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10.5px] text-cyan-300/80 cursor-pointer font-tech select-none hover:text-cyan-200">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                aria-label="Toggle Auto (Sync OS)"
              />
              AUTO (SYNC OS)
            </label>
            <span className="text-[10px] text-cyan-400/70 font-tech">
              ACTIVE: {THEME_LIST.find((t) => t.id === effectiveTheme)?.name.toUpperCase()}
            </span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-cyan-200/80">
          Customize the visual aesthetic across all HUD monitors and docks. Real-time shader glow,
          accents, and telemetry colors update instantly across all panes.
        </p>

        {/* Theme Swatch Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
          {THEME_LIST.map((t) => {
            const isSelected = autoSync ? effectiveTheme === t.id : theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (autoSync) setAutoSync(false);
                  setTheme(t.id);
                }}
                className={`relative p-2.5 rounded border text-left transition-all duration-150 flex flex-col justify-between cursor-pointer group ${
                  isSelected
                    ? "border-cyan-400 bg-cyan-900/30 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(0,229,255,0.25)]"
                    : "border-cyan-500/20 hover:border-cyan-500/50 bg-black/40 hover:bg-cyan-950/20"
                }`}
                style={{
                  borderColor: isSelected ? t.accentColor : undefined,
                }}
                aria-label={`Select theme ${t.name}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-[11px] font-bold tracking-wider font-tech uppercase"
                      style={{ color: t.accentColor }}
                    >
                      {t.name}
                    </span>
                    {isSelected && (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-black"
                        style={{ backgroundColor: t.accentColor }}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <p className="text-[9.5px] line-clamp-2 text-cyan-200/60 leading-tight mb-2">
                    {t.description}
                  </p>
                </div>

                {/* Swatch color preview bar */}
                <div className="flex items-center gap-1.5 mt-auto pt-1.5 border-t border-cyan-500/15">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-inner shrink-0"
                    style={{ backgroundColor: t.bgColor }}
                    title={`Background: ${t.bgColor}`}
                  />
                  <div
                    className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0"
                    style={{ backgroundColor: t.accentColor }}
                    title={`Accent: ${t.accentColor}`}
                  />
                  <div
                    className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0"
                    style={{ backgroundColor: t.secondaryColor }}
                    title={`Secondary: ${t.secondaryColor}`}
                  />
                  <span className="text-[8.5px] font-tech text-cyan-400/50 ml-auto uppercase">
                    {t.category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PANE SIZING & MEMORY */}
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
    </div>
  );
};
