import React from "react";
import { Type, RotateCcw, Check } from "lucide-react";
import { useFont, FONT_LIST, FontConfig } from "../../../stores/fontStore";

export const TypographySection: React.FC = () => {
  const { font, setFont, fontConfig } = useFont();

  const isDefaultActive = font === "theme-default";

  const renderFontCard = (f: FontConfig) => {
    const isSelected = font === f.id;

    return (
      <button
        key={f.id}
        type="button"
        onClick={() => setFont(f.id)}
        className={`relative p-2.5 rounded border text-left transition-all duration-150 flex flex-col justify-between cursor-pointer group ${
          isSelected
            ? "border-cyan-400 bg-cyan-900/30 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(0,229,255,0.25)]"
            : "border-cyan-500/20 hover:border-cyan-500/50 bg-black/40 hover:bg-cyan-950/20"
        }`}
        aria-label={`Select font ${f.name}`}
      >
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[12px] font-bold tracking-wide text-cyan-200"
              style={{
                fontFamily: f.fontFamily !== "inherit" ? f.fontFamily : undefined,
              }}
            >
              {f.name}
            </span>
            {isSelected && (
              <span className="w-4 h-4 rounded-full flex items-center justify-center bg-cyan-400 text-black shrink-0">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            )}
          </div>
          <p className="text-[9.5px] line-clamp-2 text-cyan-200/60 leading-tight mb-2">
            {f.description}
          </p>
        </div>

        {/* Live Font Sample Preview */}
        <div className="mt-auto pt-1.5 border-t border-cyan-500/15 flex flex-col gap-1">
          <div
            className="text-[11px] text-cyan-100 font-medium truncate"
            style={{
              fontFamily: f.fontFamily !== "inherit" ? f.fontFamily : undefined,
            }}
          >
            HUD Preview • Aa Bb 123
          </div>
          <span className="text-[8.5px] font-tech text-cyan-400/50 uppercase">
            {f.category}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5 text-cyan-400" />
          HUD TYPOGRAPHY & FONT
        </span>
        <div className="flex items-center gap-3">
          {!isDefaultActive && (
            <button
              type="button"
              onClick={() => setFont("theme-default")}
              className="flex items-center gap-1 text-[10px] text-cyan-300/80 hover:text-cyan-200 font-tech uppercase cursor-pointer"
              title="Reset font to current theme default"
              aria-label="Reset font to theme default"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              THEME DEFAULT
            </button>
          )}
          <span className="text-[10px] text-cyan-400/70 font-tech">
            ACTIVE: {fontConfig.name.toUpperCase()}
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-cyan-200/80">
        Choose a global typography style for notes, tasks, calendar events, and HUD panels.
        Broadcasts instantaneously across all multi-window monitors. Telemetry and countdown
        timers preserve specialized tech font styling.
      </p>

      {/* Font Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
        {FONT_LIST.map(renderFontCard)}
      </div>
    </div>
  );
};
