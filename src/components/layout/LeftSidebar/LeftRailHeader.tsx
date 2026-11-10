import React from "react";
import { Menu, Maximize2, Minimize2, Columns2, Combine } from "lucide-react";
import { WindowModeState } from "../../../types/hud";
import { Tooltip } from "../../ui/Tooltip";
import { ThemeConfig } from "../../../stores/themeStore";

export interface LeftRailHeaderProps {
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  menuBtnRef: React.RefObject<HTMLButtonElement | null>;
  windowState?: WindowModeState;
  isJoinedMode?: boolean;
  onClickFullscreen?: () => void;
  onClickExitFullscreen?: () => void;
  onClickSplit?: () => void;
  onClickJoin?: () => void;
  themeConfig?: ThemeConfig;
}

export const LeftRailHeader: React.FC<LeftRailHeaderProps> = ({
  isMenuOpen,
  onToggleMenu,
  menuBtnRef,
  windowState,
  isJoinedMode,
  onClickFullscreen,
  onClickExitFullscreen,
  onClickSplit,
  onClickJoin,
  themeConfig,
}) => {
  return (
    <div className="shrink-0 flex flex-col items-center w-full border-b border-cyan-500/30 pb-1.5 mb-1 gap-1">
      <Tooltip content="System Menu" side="right" theme="cyan" disabled={isMenuOpen}>
        <button
          ref={menuBtnRef}
          onClick={onToggleMenu}
          aria-label="System Menu"
          aria-expanded={isMenuOpen}
          className="hover:scale-110 transition p-1 cursor-pointer w-8 h-8 flex items-center justify-center rounded"
          style={{
            color:
              themeConfig?.category === "light"
                ? "var(--hud-text-primary)"
                : (themeConfig?.accentColor || "#00e5ff"),
          }}
        >
          <Menu className="w-4 h-4" />
        </button>
      </Tooltip>

      {/* Fullscreen / Exit Fullscreen (fixed directly underneath Hamburger) */}
      <Tooltip
        content={
          windowState === "fullscreen"
            ? "Exit Fullscreen (F11)"
            : "Fullscreen (F11)"
        }
        side="right"
        theme="cyan"
      >
        <button
          onClick={
            windowState === "fullscreen"
              ? onClickExitFullscreen
              : onClickFullscreen
          }
          data-testid={
            windowState === "fullscreen"
              ? "window-btn-exit-fullscreen"
              : "window-btn-fullscreen"
          }
          aria-label={
            windowState === "fullscreen"
              ? "Exit Fullscreen"
              : "Fullscreen"
          }
          className="w-8 h-8 flex items-center justify-center rounded text-cyan-400/70 hover:text-cyan-200 hover:bg-cyan-500/10 hover:scale-110 transition cursor-pointer"
        >
          {windowState === "fullscreen" ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </Tooltip>

      {/* Split / Join (fixed directly underneath Fullscreen / Exit Fullscreen) */}
      <Tooltip
        content={
          isJoinedMode || (windowState && windowState !== "split")
            ? "Split Mode"
            : "Join Mode"
        }
        side="right"
        theme="cyan"
      >
        <button
          onClick={
            isJoinedMode || (windowState && windowState !== "split")
              ? onClickSplit
              : onClickJoin
          }
          data-testid={
            isJoinedMode || (windowState && windowState !== "split")
              ? "window-btn-split"
              : "window-btn-join"
          }
          aria-label={
            isJoinedMode || (windowState && windowState !== "split")
              ? "Split FocusHUD"
              : "Join FocusHUD"
          }
          className="w-8 h-8 flex items-center justify-center rounded text-cyan-400/70 hover:text-cyan-200 hover:bg-cyan-500/10 hover:scale-110 transition cursor-pointer"
        >
          {isJoinedMode || (windowState && windowState !== "split") ? (
            <Columns2 className="w-4 h-4" />
          ) : (
            <Combine className="w-4 h-4" />
          )}
        </button>
      </Tooltip>
    </div>
  );
};

