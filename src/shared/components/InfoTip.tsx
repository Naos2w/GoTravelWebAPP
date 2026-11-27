import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface InfoTipProps {
  /** Explanatory text displayed inside the floating popover. */
  text: string;
  /** Preferred horizontal alignment relative to the trigger button. */
  align?: "left" | "right" | "center";
  /** Accessible label for the trigger button. */
  ariaLabel?: string;
  /** Optional test ID prefix for unit/smoke testing. */
  testId?: string;
}

const ALIGN_CLASS_MAP: Record<NonNullable<InfoTipProps["align"]>, string> = {
  left: "left-0",
  right: "right-0",
  center: "left-1/2 -translate-x-1/2",
};

/**
 * Compact `?` info popover trigger designed for Nordic Slate cards and rows.
 * Stops click/keyboard propagation so it can safely live inside clickable rows or cards.
 */
export const InfoTip: React.FC<InfoTipProps> = ({
  text,
  align = "left",
  ariaLabel = "查看說明",
  testId,
}) => {
  const [open, setOpen] = useState(false);
  const [placeAbove, setPlaceAbove] = useState(false);
  const [shiftX, setShiftX] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleEscape, true);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPlaceAbove(false);
      setShiftX(0);
      return;
    }

    const popoverEl = popoverRef.current;
    if (!popoverEl || typeof window === "undefined") return;

    const rect = popoverEl.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const viewportPad = 12;
    let nextShiftX = 0;
    if (rect.left < viewportPad) {
      nextShiftX = viewportPad - rect.left;
    } else if (rect.right > window.innerWidth - viewportPad) {
      nextShiftX = window.innerWidth - viewportPad - rect.right;
    }
    setShiftX(nextShiftX);

    if (rect.bottom > window.innerHeight - viewportPad) {
      setPlaceAbove(true);
    }
  }, [open]);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.stopPropagation();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        data-testid={testId ? `${testId}-trigger` : undefined}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[11px] font-bold leading-none transition-colors shrink-0 cursor-pointer border active:scale-95 ${
          open
            ? "bg-ns-blue/15 text-ns-blue border-ns-blue/30"
            : "bg-black/[0.05] dark:bg-white/[0.08] text-[#68707D] dark:text-[#8B93A1] border-black/[0.06] dark:border-white/[0.10] hover:bg-ns-blue/12 hover:text-ns-blue"
        }`}
      >
        <span aria-hidden="true">?</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="tooltip"
          data-testid={testId ? `${testId}-popover` : "infotip-popover"}
          onClick={(e) => e.stopPropagation()}
          style={
            shiftX !== 0
              ? { marginLeft: `${shiftX}px` }
              : undefined
          }
          className={`absolute z-50 ${ALIGN_CLASS_MAP[align]} ${
            placeAbove ? "bottom-full mb-2" : "top-full mt-2"
          } w-56 sm:w-64 max-w-[calc(100vw-2rem)] p-2.5 rounded-xl bg-white dark:bg-[#1E222D] border border-black/10 dark:border-white/15 shadow-ios-md text-xs font-medium leading-relaxed text-[#1A1D23] dark:text-[#ECEFF4] whitespace-normal text-left`}
        >
          {text}
        </div>
      )}
    </div>
  );
};
