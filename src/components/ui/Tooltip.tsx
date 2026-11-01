import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../stores/themeStore";

export type TooltipSide = "right" | "left" | "top" | "bottom";
export type TooltipAlign = "center" | "start" | "end";
export type TooltipTheme = "cyan" | "amber" | "neutral" | "light" | "pink" | "auto";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: TooltipSide;
  align?: TooltipAlign;
  delay?: number;
  disabled?: boolean;
  theme?: TooltipTheme;
  offset?: number;
  shortcut?: string;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

interface TooltipContextType {
  onTooltipOpen?: (id: string) => void;
  onTooltipClose?: (id: string) => void;
}

export const TooltipContext = React.createContext<TooltipContextType | null>(null);

export interface TooltipProviderProps {
  children: React.ReactNode;
  onTooltipOpen?: (id: string) => void;
  onTooltipClose?: (id: string) => void;
}

export const TooltipProvider: React.FC<TooltipProviderProps> = ({
  children,
  onTooltipOpen,
  onTooltipClose,
}) => {
  const value = React.useMemo(
    () => ({ onTooltipOpen, onTooltipClose }),
    [onTooltipOpen, onTooltipClose]
  );
  return (
    <TooltipContext.Provider value={value}>
      {children}
    </TooltipContext.Provider>
  );
};

// Module-level warm-up state (VS Code style instant hover traversal)
let isGlobalWarm = false;
let globalCooldownTimer: ReturnType<typeof setTimeout> | null = null;

function markWarm() {
  if (globalCooldownTimer) {
    clearTimeout(globalCooldownTimer);
    globalCooldownTimer = null;
  }
  isGlobalWarm = true;
}

function scheduleCooldown() {
  if (globalCooldownTimer) clearTimeout(globalCooldownTimer);
  globalCooldownTimer = setTimeout(() => {
    isGlobalWarm = false;
  }, 350);
}

export function resetTooltipWarmup() {
  if (globalCooldownTimer) {
    clearTimeout(globalCooldownTimer);
    globalCooldownTimer = null;
  }
  isGlobalWarm = false;
}

function setRef<T>(ref: React.Ref<T> | undefined, value: T) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref && typeof ref === "object" && "current" in ref) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = "right",
  align = "center",
  delay = 0,
  disabled = false,
  theme = "cyan",
  offset = 8,
  shortcut,
  className = "",
  onOpenChange,
}) => {
  const context = React.useContext(TooltipContext);
  const { effectiveTheme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; transform: string } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let transform = "";

    switch (side) {
      case "right":
        left = rect.right + offset;
        if (align === "start") {
          top = rect.top;
          transform = "none";
        } else if (align === "end") {
          top = rect.bottom;
          transform = "translateY(-100%)";
        } else {
          top = rect.top + rect.height / 2;
          transform = "translateY(-50%)";
        }
        break;

      case "left":
        left = rect.left - offset;
        if (align === "start") {
          top = rect.top;
          transform = "translateX(-100%)";
        } else if (align === "end") {
          top = rect.bottom;
          transform = "translate(-100%, -100%)";
        } else {
          top = rect.top + rect.height / 2;
          transform = "translate(-100%, -50%)";
        }
        break;

      case "bottom":
        top = rect.bottom + offset;
        if (align === "start") {
          left = rect.left;
          transform = "none";
        } else if (align === "end") {
          left = rect.right;
          transform = "translateX(-100%)";
        } else {
          left = rect.left + rect.width / 2;
          transform = "translateX(-50%)";
        }
        break;

      case "top":
        top = rect.top - offset;
        if (align === "start") {
          left = rect.left;
          transform = "translateY(-100%)";
        } else if (align === "end") {
          left = rect.right;
          transform = "translate(-100%, -100%)";
        } else {
          left = rect.left + rect.width / 2;
          transform = "translate(-50%, -100%)";
        }
        break;
    }

    setCoords({ top, left, transform });
  }, [side, align, offset]);

  const showTooltip = useCallback(() => {
    if (disabled || !content) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    updateCoords();

    // Instant show if delay is 0 or if we're in the global warm-up window
    const effectiveDelay = isGlobalWarm ? 0 : delay;

    if (effectiveDelay <= 0) {
      setIsVisible(true);
      markWarm();
      onOpenChange?.(true);
      context?.onTooltipOpen?.(tooltipId);
    } else {
      timerRef.current = setTimeout(() => {
        updateCoords();
        setIsVisible(true);
        markWarm();
        onOpenChange?.(true);
        context?.onTooltipOpen?.(tooltipId);
      }, effectiveDelay);
    }
  }, [disabled, content, delay, updateCoords, onOpenChange, context, tooltipId]);

  const hideTooltip = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsVisible(false);
    scheduleCooldown();
    onOpenChange?.(false);
    context?.onTooltipClose?.(tooltipId);
  }, [onOpenChange, context, tooltipId]);

  useEffect(() => {
    if (!isVisible) return;

    const handleWindowChange = () => {
      updateCoords();
    };

    window.addEventListener("scroll", handleWindowChange, true);
    window.addEventListener("resize", handleWindowChange);

    return () => {
      window.removeEventListener("scroll", handleWindowChange, true);
      window.removeEventListener("resize", handleWindowChange);
    };
  }, [isVisible, updateCoords]);

  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (isVisibleRef.current) {
        onOpenChangeRef.current?.(false);
        contextRef.current?.onTooltipClose?.(tooltipId);
      }
    };
  }, [tooltipId]);

  if (disabled || !content) {
    return children;
  }

  // Compose trigger refs and handlers
  // In React 19, ref is a standard prop on children.props
  const childRef = (children.props as { ref?: React.Ref<HTMLElement> }).ref;
  const mergedRef = (node: HTMLElement | null) => {
    triggerRef.current = node;
    if (childRef) {
      setRef(childRef, node);
    }
  };

  const childProps = children.props as React.HTMLAttributes<HTMLElement>;

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    childProps.onMouseEnter?.(e);
    showTooltip();
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    childProps.onMouseLeave?.(e);
    hideTooltip();
  };

  const handleFocus = (e: React.FocusEvent<HTMLElement>) => {
    childProps.onFocus?.(e);
    showTooltip();
  };

  const handleBlur = (e: React.FocusEvent<HTMLElement>) => {
    childProps.onBlur?.(e);
    hideTooltip();
  };

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    childProps.onClick?.(e);
    hideTooltip();
  };

  const trigger = React.cloneElement(children as React.ReactElement<any>, {
    ref: mergedRef,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onClick: handleClick,
    // Actively strip native title to prevent slow native OS tooltip collision
    title: undefined,
    // Ensure aria-label is preserved or set
    "aria-label": childProps["aria-label"] || (typeof content === "string" ? content : undefined),
    "aria-describedby": isVisible ? tooltipId : childProps["aria-describedby"],
  });

  const isLight = effectiveTheme === "light" || theme === "light";
  const isPink = effectiveTheme === "pink" || theme === "pink";

  const themeStyles = (() => {
    if (isLight) {
      return {
        box: "bg-[#ffffff] border-[#cbd5e1] text-[#0f172a] shadow-[0_4px_16px_rgba(15,23,42,0.12),0_1px_3px_rgba(15,23,42,0.08)]",
        notch: "bg-[#ffffff] border-[#cbd5e1]",
        shortcut: "bg-[#f1f5f9] text-[#0369a1] border-[#cbd5e1]",
      };
    }
    if (isPink) {
      return {
        box: "bg-[#ffffff] border-rose-300/80 text-[#831843] shadow-[0_4px_16px_rgba(244,63,94,0.18),0_1px_3px_rgba(244,63,94,0.08)]",
        notch: "bg-[#ffffff] border-rose-300/80",
        shortcut: "bg-[#fff1f2] text-[#e11d48] border-rose-200",
      };
    }
    if (theme === "amber") {
      return {
        box: "bg-[#0c0802]/95 border-amber-500/50 text-amber-100 shadow-[0_0_12px_rgba(255,179,0,0.3)]",
        notch: "bg-[#0c0802] border-amber-500/50",
        shortcut: "bg-amber-950/70 text-amber-300 border-amber-500/40",
      };
    }
    if (theme === "neutral") {
      return {
        box: "bg-neutral-900/95 border-neutral-700 text-neutral-100 shadow-lg",
        notch: "bg-neutral-900 border-neutral-700",
        shortcut: "bg-neutral-800 text-neutral-300 border-neutral-700",
      };
    }
    // Default cyber / cyan theme
    return {
      box: "bg-[#030812]/95 border-cyan-500/50 text-cyan-100 shadow-[0_0_12px_rgba(0,229,255,0.3)]",
      notch: "bg-[#030812] border-cyan-500/50",
      shortcut: "bg-cyan-950/70 text-cyan-300 border-cyan-500/40",
    };
  })();

  const notchStyles = {
    right: "absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 border-l border-b",
    left: "absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45 border-r border-t",
    bottom: "absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-l border-t",
    top: "absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-r border-b",
  }[side];

  const tooltipElement =
    isVisible && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.transform,
            }}
            className={`hud-tooltip pointer-events-none select-none z-[99999] flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-tech tracking-wider uppercase backdrop-blur-md border animate-in fade-in zoom-in-95 duration-75 ${themeStyles.box} ${className}`}
          >
            <div className={`hud-tooltip-notch ${notchStyles} ${themeStyles.notch}`} />
            <span className="hud-tooltip-content font-semibold">{content}</span>
            {shortcut && (
              <kbd className={`hud-tooltip-shortcut text-[10px] px-1 py-0.5 rounded border ml-1 font-mono ${themeStyles.shortcut}`}>
                {shortcut}
              </kbd>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {trigger}
      {tooltipElement}
    </>
  );
};
