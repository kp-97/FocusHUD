import React, { useState } from "react";
import { Check, Languages, Sparkles } from "lucide-react";
import {
  useSpellcheck,
  SpellcheckLocale,
  SPELLCHECK_OPTIONS,
} from "../../../stores/spellcheckStore";

export const EditorTab: React.FC = () => {
  const { locale, enabled, setLocale, setEnabled, selectedOption } = useSpellcheck();
  const [testText, setTestText] = useState(
    "The colour and flavour of the tea are marvellous."
  );

  return (
    <div className="space-y-4">
      {/* SPELLCHECK & LANGUAGE CONFIGURATION SECTION */}
      <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5 text-cyan-400" />
            SPELLCHECK & DICTIONARY
          </span>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10.5px] text-cyan-300/80 cursor-pointer font-tech select-none hover:text-cyan-200">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
                aria-label="Toggle Spellcheck"
              />
              ENABLE SPELLCHECK
            </label>
            <span className="text-[10px] text-cyan-400/70 font-tech">
              ACTIVE: {selectedOption.label.toUpperCase()}
            </span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-cyan-200/80">
          Select your regional dictionary for real-time spellchecking in Notes and text editors.
          Dictionary changes apply immediately across all open windows and docks.
        </p>

        {/* Locale Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
          {SPELLCHECK_OPTIONS.map((opt) => {
            const isSelected = locale === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLocale(opt.id as SpellcheckLocale)}
                disabled={!enabled}
                className={`relative p-2.5 rounded border text-left transition-all duration-150 flex flex-col justify-between cursor-pointer group ${
                  !enabled ? "opacity-45 cursor-not-allowed" : ""
                } ${
                  isSelected && enabled
                    ? "border-cyan-400 bg-cyan-900/30 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(0,229,255,0.25)]"
                    : "border-cyan-500/20 hover:border-cyan-500/50 bg-black/40 hover:bg-cyan-950/20"
                }`}
                aria-label={`Select spellcheck language ${opt.label}`}
                aria-pressed={isSelected}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold tracking-wider font-tech uppercase text-cyan-100 flex items-center gap-1.5">
                      <span className="text-sm">{opt.flag}</span>
                      <span>{opt.label}</span>
                    </span>
                    {isSelected && enabled && (
                      <span className="w-4 h-4 rounded-full flex items-center justify-center bg-cyan-400 text-black">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="text-[9.5px] text-cyan-300/70 space-y-0.5">
                    <div>
                      <span className="font-semibold text-cyan-200">Standard: </span>
                      <span className="font-mono">{opt.exampleWords.standard}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-cyan-500/15 text-[9px] text-cyan-400/60 font-mono">
                  <span>LOCALE: {opt.id}</span>
                  <span>{opt.region}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* LIVE SPELLCHECK TEST AREA */}
      <div className="bg-cyan-950/30 border border-cyan-500/20 rounded p-3.5 space-y-2.5">
        <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider text-[11px]">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            LIVE SPELLCHECK TEST BENCH
          </span>
          <span className="text-[10px] font-mono text-cyan-400/70">
            LANG=&quot;{enabled ? locale : "disabled"}&quot;
          </span>
        </div>

        <p className="text-[10.5px] text-cyan-200/70">
          Type or edit the sentence below to verify that your selected dictionary highlights
          unrecognized words. For example, <em>colour</em> and <em>flavour</em> are recognized in{" "}
          <strong>en-AU</strong> and <strong>en-GB</strong>, but flagged in <strong>en-US</strong>.
        </p>

        <textarea
          value={testText}
          onChange={(e) => setTestText(e.target.value)}
          spellCheck={enabled}
          lang={enabled ? locale : undefined}
          aria-label="Spellcheck test area"
          rows={2}
          className="w-full bg-black/60 border border-cyan-500/30 rounded p-2 text-xs font-tech text-cyan-100 placeholder:text-cyan-700/50 focus:outline-none focus:border-cyan-400 transition"
        />
      </div>
    </div>
  );
};
