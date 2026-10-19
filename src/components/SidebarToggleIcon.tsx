import React, { useState, useId } from "react";

export interface SidebarToggleIconProps {
  side: "left" | "right" | "both";
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
  theme?: "cyan" | "amber";
}

export const SidebarToggleIcon: React.FC<SidebarToggleIconProps> = ({
  side,
  isCollapsed,
  onToggle,
  className = "",
  theme = "cyan",
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const clipId = useId();

  // If collapsed: default shows thin bar; hover previews wide bar.
  // If expanded: default shows wide bar; hover previews thin bar.
  const visuallyExpanded = isCollapsed ? isHovered : !isHovered;

  const title = isCollapsed
    ? isHovered
      ? side === "both"
        ? "Click to expand left and right panels"
        : `Click to expand ${side} panel to previous width`
      : side === "both"
      ? "Panels collapsed (hover to preview expand)"
      : `${side === "left" ? "Left" : "Right"} panel collapsed (hover to preview expand)`
    : isHovered
    ? side === "both"
      ? "Click to collapse left and right panels to 68px"
      : `Click to collapse ${side} panel to 68px`
    : side === "both"
    ? "Panels expanded (hover to preview collapse)"
    : `${side === "left" ? "Left" : "Right"} panel expanded (hover to preview collapse)`;

  const themeClasses =
    theme === "amber"
      ? "text-amber-400 hover:text-amber-200 hover:bg-amber-500/20"
      : "text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/20";

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={title}
      className={`relative w-6 h-6 flex items-center justify-center rounded transition-all duration-150 cursor-pointer ${themeClasses} ${className}`}
      aria-label={title}
      data-testid={`sidebar-toggle-${side}`}
    >
      <svg
        viewBox="0 0 18 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-3.5"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="1" y="1" width="16" height="12" rx="2.5" />
          </clipPath>
        </defs>

        {/* Outer window outline */}
        <rect
          x="1"
          y="1"
          width="16"
          height="12"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* Filled sidebar bar inside clipped rounded rectangle */}
        <g clipPath={`url(#${clipId})`}>
          {(side === "left" || side === "both") && (
            <rect
              x="1"
              y="1"
              width={side === "both" ? (visuallyExpanded ? 4.5 : 2.5) : (visuallyExpanded ? 7 : 4)}
              height="12"
              fill="currentColor"
              className="transition-all duration-150"
            />
          )}
          {(side === "right" || side === "both") && (
            <rect
              x={side === "both" ? (visuallyExpanded ? 12.5 : 14.5) : (visuallyExpanded ? 10 : 13)}
              y="1"
              width={side === "both" ? (visuallyExpanded ? 4.5 : 2.5) : (visuallyExpanded ? 7 : 4)}
              height="12"
              fill="currentColor"
              className="transition-all duration-150"
            />
          )}
        </g>
      </svg>
    </button>
  );
};
