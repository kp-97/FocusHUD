import React from "react";

interface HudBracketsProps {
  children: React.ReactNode;
  className?: string;
  variant?: "cyan" | "amber";
  showTicks?: boolean;
}

export const HudBrackets: React.FC<HudBracketsProps> = ({
  children,
  className = "",
  variant = "cyan",
  showTicks = true,
}) => {
  const borderColor = variant === "cyan" ? "border-cyan-400" : "border-amber-400";
  const glowClass = variant === "cyan" ? "shadow-[0_0_12px_rgba(0,229,255,0.2)]" : "shadow-[0_0_12px_rgba(255,145,0,0.2)]";

  return (
    <div className={`relative hud-panel rounded-sm ${glowClass} ${className}`}>
      {/* Top Left Bracket */}
      <div className={`absolute -top-[2px] -left-[2px] w-3 h-3 border-t-2 border-l-2 ${borderColor} pointer-events-none z-20`} />
      <div className="absolute top-1 left-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

      {/* Top Right Bracket */}
      <div className={`absolute -top-[2px] -right-[2px] w-3 h-3 border-t-2 border-r-2 ${borderColor} pointer-events-none z-20`} />
      <div className="absolute top-1 right-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

      {/* Bottom Left Bracket */}
      <div className={`absolute -bottom-[2px] -left-[2px] w-3 h-3 border-b-2 border-l-2 ${borderColor} pointer-events-none z-20`} />
      <div className="absolute bottom-1 left-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

      {/* Bottom Right Bracket */}
      <div className={`absolute -bottom-[2px] -right-[2px] w-3 h-3 border-b-2 border-r-2 ${borderColor} pointer-events-none z-20`} />
      <div className="absolute bottom-1 right-1 w-1 h-1 bg-cyan-400/80 pointer-events-none z-20" />

      {/* Vertical ruler ticks */}
      {showTicks && (
        <>
          <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 flex flex-col gap-1.5 pointer-events-none opacity-60">
            <div className="w-1.5 h-[1px] bg-cyan-400" />
            <div className="w-1 h-[1px] bg-cyan-400/50" />
            <div className="w-2.5 h-[1px] bg-cyan-400" />
            <div className="w-1 h-[1px] bg-cyan-400/50" />
            <div className="w-1.5 h-[1px] bg-cyan-400" />
          </div>

          <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 flex flex-col gap-1.5 pointer-events-none opacity-60">
            <div className="w-1.5 h-[1px] bg-cyan-400" />
            <div className="w-1 h-[1px] bg-cyan-400/50" />
            <div className="w-2.5 h-[1px] bg-cyan-400" />
            <div className="w-1 h-[1px] bg-cyan-400/50" />
            <div className="w-1.5 h-[1px] bg-cyan-400" />
          </div>
        </>
      )}

      {children}
    </div>
  );
};
