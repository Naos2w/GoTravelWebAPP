import React, { useRef } from "react";
import { User as UserIcon } from "lucide-react";
import { User } from "../types";
import { useTranslation } from "../contexts/LocalizationContext";

export type DetailTabId =
  | "dashboard"
  | "itinerary"
  | "checklist"
  | "expenses"
  | "flights";

export interface FloatingDockTab {
  id: DetailTabId;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  alert?: boolean;
}

export interface FloatingDockProps {
  tabs: FloatingDockTab[];
  activeTab: DetailTabId;
  user: User | null;
  isProfileMenuOpen: boolean;
  dockDragSlot: number | null;
  mobileProfileMenuRef: React.RefObject<HTMLDivElement | null>;
  profileMenuContent: React.ReactNode;
  onSelectTab: (tabId: DetailTabId) => void;
  onCloseProfileMenu: () => void;
  onOpenProfileMenu: () => void;
  onToggleProfileMenu: () => void;
  onDockDragSlotChange: (slot: number | null) => void;
  onScrubbingChange?: (isScrubbing: boolean) => void;
}

export const FloatingDock: React.FC<FloatingDockProps> = ({
  tabs,
  activeTab,
  user,
  isProfileMenuOpen,
  dockDragSlot,
  mobileProfileMenuRef,
  profileMenuContent,
  onSelectTab,
  onCloseProfileMenu,
  onOpenProfileMenu,
  onToggleProfileMenu,
  onDockDragSlotChange,
  onScrubbingChange,
}) => {
  const { t } = useTranslation();
  const mobileDockNavRef = useRef<HTMLElement>(null);
  const dockScrubStateRef = useRef<{
    pointerId: number;
    startX: number;
    moved: boolean;
  } | null>(null);
  const lastScrubEndTimeRef = useRef<number>(0);

  const activeDockIndex = isProfileMenuOpen
    ? tabs.length
    : Math.max(
        0,
        tabs.findIndex((tab) => tab.id === activeTab)
      );
  const effectiveDockSlot =
    dockDragSlot !== null ? dockDragSlot : activeDockIndex;

  const handleDockPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    dockScrubStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      moved: false,
    };
  };

  const handleDockPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const scrub = dockScrubStateRef.current;
    if (!scrub || scrub.pointerId !== e.pointerId || !mobileDockNavRef.current)
      return;
    if (!scrub.moved) {
      if (Math.abs(e.clientX - scrub.startX) <= 4) return;
      scrub.moved = true;
      onScrubbingChange?.(true);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // Ignore if pointer capture is unsupported in test/browser environment
      }
    }
    const rect = mobileDockNavRef.current.getBoundingClientRect();
    const paddingX = 6;
    const totalSlots = tabs.length + 1;
    const slotWidth = Math.max(1, (rect.width - paddingX * 2) / totalSlots);
    const rawSlot = (e.clientX - rect.left - paddingX) / slotWidth - 0.5;
    const clampedSlot = Math.max(0, Math.min(totalSlots - 1, rawSlot));
    onDockDragSlotChange(clampedSlot);

    const nearestIdx = Math.round(clampedSlot);
    if (nearestIdx < tabs.length) {
      const targetTab = tabs[nearestIdx];
      if (isProfileMenuOpen) {
        onCloseProfileMenu();
      }
      if (activeTab !== targetTab.id) {
        onSelectTab(targetTab.id);
      }
    } else if (nearestIdx === tabs.length) {
      if (!isProfileMenuOpen) {
        onOpenProfileMenu();
      }
    }
  };

  const handleDockPointerUpOrCancel = (e: React.PointerEvent<HTMLElement>) => {
    const scrub = dockScrubStateRef.current;
    if (!scrub || scrub.pointerId !== e.pointerId) return;
    if (scrub.moved) {
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore if pointer capture is unsupported
      }
      lastScrubEndTimeRef.current = Date.now();
      onDockDragSlotChange(null);
      onScrubbingChange?.(false);
    }
    dockScrubStateRef.current = null;
  };

  return (
    <div className="md:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] inset-x-4 max-w-[360px] mx-auto z-50 pointer-events-none">
      <nav
        ref={mobileDockNavRef}
        aria-label="Mobile Navigation"
        onPointerDown={handleDockPointerDown}
        onPointerMove={handleDockPointerMove}
        onPointerUp={handleDockPointerUpOrCancel}
        onPointerCancel={handleDockPointerUpOrCancel}
        className="pointer-events-auto ios27-dock rounded-full p-1.5 relative grid grid-cols-6 items-center transition-all duration-200 touch-none select-none"
      >
        <div
          aria-hidden="true"
          data-testid="mobile-dock-active-pill"
          className={`absolute top-1.5 bottom-1.5 left-1.5 rounded-full dock-pill-active ${
            dockDragSlot !== null ? "dock-pill-scrubbing" : ""
          } pointer-events-none z-0`}
          style={{
            width: `calc((100% - 12px) / ${tabs.length + 1})`,
            transform: `translate3d(${(effectiveDockSlot * 100).toFixed(2)}%, 0, 0) scale(${
              dockDragSlot !== null ? 1.06 : 1
            })`,
          }}
        />

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (Date.now() - lastScrubEndTimeRef.current < 250) return;
                onCloseProfileMenu();
                onSelectTab(tab.id);
              }}
              aria-label={tab.label}
              title={tab.label}
              className={`relative z-10 flex items-center justify-center h-11 rounded-full transition-colors duration-200 select-none cursor-pointer active:scale-90 ${
                isActive && !isProfileMenuOpen
                  ? "text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <div
                className={`relative flex items-center justify-center transition-transform duration-300 ease-spring ${
                  isActive && !isProfileMenuOpen ? "scale-110" : "scale-100"
                }`}
              >
                <tab.icon
                  size={21}
                  strokeWidth={isActive && !isProfileMenuOpen ? 2.5 : 1.9}
                />
                {tab.alert && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-[#FF3B30] rounded-full ring-2 ring-white dark:ring-[#18181b]" />
                )}
              </div>
            </button>
          );
        })}

        {/* 6th Tab: Instagram-Style Profile Avatar Button */}
        <button
          type="button"
          data-testid="mobile-dock-profile-btn"
          onClick={() => {
            if (Date.now() - lastScrubEndTimeRef.current < 250) return;
            onToggleProfileMenu();
          }}
          aria-label={user ? user.name || "User Profile" : t("more")}
          aria-expanded={isProfileMenuOpen}
          className={`relative z-10 flex items-center justify-center h-11 rounded-full transition-colors duration-200 select-none cursor-pointer active:scale-90 ${
            isProfileMenuOpen
              ? "text-slate-900 dark:text-white"
              : "text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <div
            className={`flex items-center justify-center transition-transform duration-300 ease-spring ${
              isProfileMenuOpen ? "scale-110" : "scale-100"
            }`}
          >
            {user ? (
              user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name || "User"}
                  referrerPolicy="no-referrer"
                  className={`w-6 h-6 rounded-full object-cover transition-all ${
                    isProfileMenuOpen
                      ? "ring-2 ring-primary"
                      : "ring-1 ring-black/10 dark:ring-white/25"
                  }`}
                />
              ) : (
                <div
                  className={`w-6 h-6 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] ${
                    isProfileMenuOpen
                      ? "ring-2 ring-primary"
                      : "ring-1 ring-black/10 dark:ring-white/25"
                  }`}
                >
                  {user.name ? (
                    user.name[0].toUpperCase()
                  ) : (
                    <UserIcon size={13} />
                  )}
                </div>
              )
            ) : (
              <UserIcon size={20} strokeWidth={isProfileMenuOpen ? 2.5 : 1.9} />
            )}
          </div>
        </button>
      </nav>

      {/* Mobile Profile Popover floating above dock */}
      {isProfileMenuOpen && (
        <div
          ref={mobileProfileMenuRef}
          className="pointer-events-auto absolute bottom-full mb-3 right-0 w-64 rounded-3xl p-1.5 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl text-slate-900 dark:text-slate-100 z-50 animate-in slide-in-from-bottom-3 fade-in duration-200 origin-bottom-right select-none"
          role="menu"
        >
          {profileMenuContent}
        </div>
      )}
    </div>
  );
};
