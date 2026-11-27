import React from "react";
import {
  Plane,
  ChevronLeft,
  LogOut,
  Loader2,
  Moon,
  Sun,
  Languages,
  Share2,
  Users,
  X,
  FileText,
  MoreHorizontal,
  User as UserIcon,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { Trip, Theme, Language, User } from "../../types";
import { useTranslation } from "../../shared/contexts/LocalizationContext";
import { SyncStatus } from "../hooks/useTripRealtime";
import { DetailTabId, FloatingDockTab } from "./FloatingDock";

export interface ProfileMenuContentProps {
  user: User | null;
  showDetailOptions: boolean;
  isCreator: boolean;
  theme: Theme;
  language: Language;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onOpenExport: () => void;
  onLogout: () => void;
  onOpenLogin: () => void;
  onCloseMenu: () => void;
}

export const ProfileMenuContent: React.FC<ProfileMenuContentProps> = ({
  user,
  showDetailOptions,
  isCreator,
  theme,
  language,
  onToggleTheme,
  onToggleLanguage,
  onOpenExport,
  onLogout,
  onOpenLogin,
  onCloseMenu,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {user && (
        <>
          <div className="px-3 py-2.5 flex items-center gap-2.5">
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name || "User"}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/20"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                {user.name ? user.name[0].toUpperCase() : <UserIcon size={18} />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
                {user.name || "User"}
              </div>
              {user.email && (
                <div className="text-[11px] text-slate-400 truncate">
                  {user.email}
                </div>
              )}
              {showDetailOptions && (
                <div className="mt-0.5 inline-block text-[9px] font-bold text-primary uppercase tracking-wider">
                  {isCreator ? t("permissionEditor") : t("permissionGuest")}
                </div>
              )}
            </div>
          </div>
          <div className="h-px my-1 bg-black/[0.06] dark:bg-white/[0.08]" />
        </>
      )}

      <button
        type="button"
        role="menuitem"
        onClick={onToggleTheme}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          {theme === "light" ? (
            <Moon size={15} className="text-slate-500 dark:text-slate-400" />
          ) : (
            <Sun size={15} className="text-amber-400" />
          )}
          <span>{t("theme")}</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {theme === "dark" ? t("themeDark") : t("themeLight")}
        </span>
      </button>

      <button
        type="button"
        role="menuitem"
        onClick={onToggleLanguage}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Languages size={15} className="text-slate-500 dark:text-slate-400" />
          <span>{t("language")}</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          {language === "zh" ? "繁體中文" : "English"}
        </span>
      </button>

      {showDetailOptions && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onCloseMenu();
            onOpenExport();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <FileText size={15} className="text-amber-500" />
            <span>{t("exportTrip")}</span>
          </div>
          <span className="text-[10px] font-medium text-slate-400">
            iOS / 日曆
          </span>
        </button>
      )}

      <div className="h-px my-1 bg-black/[0.06] dark:bg-white/[0.08]" />
      {user ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onCloseMenu();
            onLogout();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
        >
          <LogOut size={15} />
          <span>{t("logout")}</span>
        </button>
      ) : (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onCloseMenu();
            onOpenLogin();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <UserIcon size={15} />
          <span>{t("loginToJoin")}</span>
        </button>
      )}
    </>
  );
};

export interface HeaderProfileMenuProps {
  user: User | null;
  isOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuContent: React.ReactNode;
  onToggle: () => void;
  onOpenLogin: () => void;
}

export const HeaderProfileMenu: React.FC<HeaderProfileMenuProps> = ({
  user,
  isOpen,
  menuRef,
  menuContent,
  onToggle,
  onOpenLogin,
}) => {
  const { t } = useTranslation();

  return (
    <div className="relative flex items-center" ref={menuRef}>
      {!user ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label={t("more")}
            aria-expanded={isOpen}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-95"
          >
            <MoreHorizontal size={18} />
          </button>
          <button
            type="button"
            onClick={onOpenLogin}
            className="bg-primary hover:bg-primary/90 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{t("loginToJoin")}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-label={user.name || "User Profile"}
          aria-expanded={isOpen}
          className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-black/5 dark:hover:ring-white/10 transition-all cursor-pointer active:scale-95"
        >
          {user.picture ? (
            <img
              src={user.picture}
              alt={user.name || "User"}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/20 shadow-sm"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs ring-1 ring-black/10 dark:ring-white/20">
              {user.name ? user.name[0].toUpperCase() : <UserIcon size={16} />}
            </div>
          )}
        </button>
      )}

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2.5 w-64 rounded-2xl p-1.5 shadow-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-2xl text-slate-900 dark:text-slate-100 z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right select-none"
          role="menu"
        >
          {menuContent}
        </div>
      )}
    </div>
  );
};

export interface TripHeaderProps {
  trip: Trip;
  collaboratorCount: number;
  syncStatus: SyncStatus;
  showMobilePriceCta: boolean;
  tabs: FloatingDockTab[];
  activeTab: DetailTabId;
  isGuest: boolean;
  headerProfileElement: React.ReactNode;
  onBack: () => void;
  onManualResync: () => void;
  onGuideGoToPrice: () => void;
  onDismissPricePrompt: () => void;
  onSelectTab: (tabId: DetailTabId) => void;
  onOpenShare: () => void;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  trip,
  collaboratorCount,
  syncStatus,
  showMobilePriceCta,
  tabs,
  activeTab,
  isGuest,
  headerProfileElement,
  onBack,
  onManualResync,
  onGuideGoToPrice,
  onDismissPricePrompt,
  onSelectTab,
  onOpenShare,
}) => {
  const { t } = useTranslation();

  return (
    <nav className="bg-white/80 dark:bg-[#060709]/80 backdrop-blur-3xl border-b border-black/[0.06] dark:border-white/[0.08] sticky top-0 z-40 h-[60px] flex items-center px-4 sm:px-6">
      <div className="max-w-7xl mx-auto w-full flex justify-between items-center gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-all -ml-1 shrink-0 cursor-pointer"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="min-w-0 truncate">
            <div className="text-sm font-bold truncate text-slate-900 dark:text-slate-100">
              {trip.name}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-semibold text-slate-400 truncate min-w-0">
                {trip.destination}
              </span>
              <span className="hidden sm:inline-block w-0.5 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
              <span className="hidden sm:flex text-[10px] font-semibold text-slate-400 items-center gap-0.5">
                <Users size={9} /> {collaboratorCount}
              </span>
              <span className="hidden sm:inline-block w-0.5 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
              {syncStatus === "error" ? (
                <button
                  type="button"
                  data-testid="sync-retry-btn"
                  data-sync-status="error"
                  onClick={onManualResync}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 dark:bg-rose-500/20 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/25 whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                  title={t("syncRetry")}
                >
                  <RefreshCw size={10} className="shrink-0" />
                  <span>
                    {t("syncError")} · {t("syncRetry")}
                  </span>
                </button>
              ) : syncStatus === "offline" ? (
                <span
                  role="status"
                  data-testid="sync-status-pill"
                  data-sync-status="offline"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 dark:bg-amber-400/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 whitespace-nowrap shrink-0"
                >
                  <WifiOff size={10} className="shrink-0" />
                  <span>{t("syncOffline")}</span>
                </span>
              ) : (
                <span
                  role="status"
                  data-testid="sync-status-pill"
                  data-sync-status={syncStatus}
                  className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-medium whitespace-nowrap shrink-0 ${
                    syncStatus === "syncing"
                      ? "text-primary"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {syncStatus === "syncing" ? (
                    <Loader2 size={10} className="animate-spin shrink-0" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  <span>
                    {syncStatus === "syncing" ? t("syncing") : t("syncSynced")}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 sm:gap-3">
          {showMobilePriceCta && (
            <div
              data-testid="mobile-itinerary-price-cta"
              className="sm:hidden flex items-center gap-0.5 animate-in fade-in duration-300"
            >
              <button
                type="button"
                onClick={onGuideGoToPrice}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-full bg-primary text-white shadow-sm whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
              >
                <Plane size={12} />
                {t("guideGoEnterPrice")}
              </button>
              <button
                type="button"
                onClick={onDismissPricePrompt}
                aria-label={t("guideBannerDismiss")}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="hidden md:flex bg-black/[0.04] dark:bg-white/[0.06] p-1 rounded-2xl gap-0.5 border border-black/[0.04] dark:border-white/[0.1] backdrop-blur-2xl shadow-sm">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative px-4 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all duration-300 ease-spring active:scale-95 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? "ios27-dock-active text-primary shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  <tab.icon size={14} strokeWidth={isActive ? 2.5 : 1.8} />
                  <span className="hidden lg:inline">{tab.label}</span>
                  {tab.alert && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => (!isGuest ? onOpenShare() : null)}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0 cursor-pointer ${
              isGuest
                ? "opacity-30 cursor-not-allowed text-slate-400"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 active:scale-95"
            }`}
            disabled={isGuest}
            title={t("shareTrip")}
          >
            <Share2 size={18} />
          </button>

          <div className="hidden md:block">{headerProfileElement}</div>
        </div>
      </div>
    </nav>
  );
};
