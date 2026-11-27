import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  Compass,
  Download,
  ExternalLink,
  MoreHorizontal,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from "lucide-react";
import { useTranslation } from "../contexts/LocalizationContext";
import { InfoTip } from "./InfoTip";
import {
  detectPwaEnvironment,
  PwaEnvironment,
} from "../services/pwaService";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface UsePwaInstallResult {
  env: PwaEnvironment;
  isStandalone: boolean;
  canNativeInstall: boolean;
  triggerNativeInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
}

/**
 * Captures `beforeinstallprompt`, tracks standalone PWA display mode,
 * and exposes environment details + a 1-tap native install trigger.
 */
export function usePwaInstall(): UsePwaInstallResult {
  const [env, setEnv] = useState<PwaEnvironment>(() => detectPwaEnvironment());
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setEnv((prev) => ({ ...prev, isStandalone: true }));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    let mediaQuery: MediaQueryList | null = null;
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setEnv((prev) => ({ ...prev, isStandalone: e.matches }));
    };

    if (typeof window.matchMedia === "function") {
      mediaQuery = window.matchMedia("(display-mode: standalone)");
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", handleDisplayModeChange);
      }
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (mediaQuery && typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleDisplayModeChange);
      }
    };
  }, []);

  const triggerNativeInstall = useCallback(async (): Promise<
    "accepted" | "dismissed" | "unavailable"
  > => {
    if (!deferredPrompt) return "unavailable";
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
      return choice.outcome;
    } catch {
      return "unavailable";
    }
  }, [deferredPrompt]);

  return {
    env,
    isStandalone: env.isStandalone,
    canNativeInstall: Boolean(deferredPrompt) && !env.isStandalone,
    triggerNativeInstall,
  };
}

export interface InstallPwaPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  canNativeInstall?: boolean;
  onNativeInstall?: () =>
    | Promise<"accepted" | "dismissed" | "unavailable">
    | void;
  envOverride?: PwaEnvironment;
}

export const InstallPwaPromptModal: React.FC<InstallPwaPromptModalProps> = ({
  isOpen,
  onClose,
  canNativeInstall = false,
  onNativeInstall,
  envOverride,
}) => {
  const { t } = useTranslation();
  const [isTriggering, setIsTriggering] = useState(false);

  const effectiveEnv = envOverride ?? detectPwaEnvironment();

  useEffect(() => {
    if (!isOpen || effectiveEnv.isStandalone) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, effectiveEnv.isStandalone, onClose]);

  if (!isOpen || effectiveEnv.isStandalone) return null;

  const handleNativeInstallClick = async () => {
    if (!onNativeInstall || isTriggering) return;
    setIsTriggering(true);
    try {
      const outcome = await onNativeInstall();
      if (outcome === "accepted") {
        onClose();
      }
    } finally {
      setIsTriggering(false);
    }
  };

  const browserLabel = effectiveEnv.inAppBrowserName || "In-App";

  const modalContent = (
    <div
      data-testid="install-pwa-backdrop"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-[#F5F6F8]/90 dark:bg-[#0B0D11]/85 backdrop-blur-2xl p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-pwa-title"
        data-testid="install-pwa-modal"
        className="w-full sm:max-w-md bg-white/95 dark:bg-[#14171F]/95 backdrop-blur-3xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-6 space-y-5">
          {/* Grabber handle on mobile */}
          <div className="w-12 h-1.5 rounded-full bg-[#68707D]/30 dark:bg-white/20 mx-auto sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0">
                <Smartphone size={22} />
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <h3
                  id="install-pwa-title"
                  className="text-base font-black text-[#1A1D23] dark:text-[#ECEFF4] tracking-tight truncate"
                >
                  {t("pwaInstallTitle")}
                </h3>
                <InfoTip
                  text={t("pwaInstallTip")}
                  align="left"
                  testId="infotip-install-pwa"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("pwaClose")}
              className="w-9 h-9 rounded-full flex items-center justify-center text-[#68707D] dark:text-[#8B93A1] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/[0.06] dark:border-white/[0.10] transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* State 1: In-App Browser Guard (LINE / Instagram / Facebook / WeChat) */}
          {effectiveEnv.isInAppBrowser ? (
            <div
              data-testid="pwa-inapp-guard"
              className="space-y-3"
            >
              <div className="p-3.5 rounded-2xl bg-ns-amber/10 dark:bg-ns-amber/12 border border-ns-amber/25 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-ns-amber/15 text-ns-amber border border-ns-amber/25 flex items-center justify-center shrink-0">
                  <Compass size={18} />
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm font-black text-[#1A1D23] dark:text-[#ECEFF4] truncate">
                    {t("pwaInAppTitle").replace("{browser}", browserLabel)}
                  </span>
                  <InfoTip
                    text={t("pwaInAppInstruction")}
                    align="left"
                    testId="infotip-pwa-inapp"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="p-3.5 rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.10] text-[#1A1D23] dark:text-[#ECEFF4] flex items-center justify-center shrink-0">
                    <MoreHorizontal size={18} />
                  </div>
                  <div className="min-w-0 flex-1 text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
                    <span className="font-mono tabular-nums text-ns-amber mr-1.5">
                      01
                    </span>
                    {t("pwaInAppStep1")}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0">
                    <ExternalLink size={17} />
                  </div>
                  <div className="min-w-0 flex-1 text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
                    <span className="font-mono tabular-nums text-ns-amber mr-1.5">
                      02
                    </span>
                    {t("pwaInAppStep2")}
                  </div>
                </div>
              </div>
            </div>
          ) : canNativeInstall ? (
            /* State 2: Android / Desktop 1-Tap Native Install */
            <div data-testid="pwa-native-install-panel" className="space-y-3">
              <button
                type="button"
                data-testid="pwa-native-install-btn"
                onClick={() => void handleNativeInstallClick()}
                disabled={isTriggering}
                className="w-full h-12 px-5 rounded-2xl bg-ns-blue hover:bg-ns-blue/90 text-white font-black text-sm shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <Download size={18} className="shrink-0" />
                <span>
                  {isTriggering ? t("pwaInstalling") : t("pwaInstallNow")}
                </span>
              </button>
            </div>
          ) : effectiveEnv.isIos ? (
            /* State 3: iOS Safari 2-Step Visual Guide */
            <div data-testid="pwa-ios-guide" className="space-y-3">
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0">
                    <Share size={18} />
                  </div>
                  <div className="min-w-0 flex-1 text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
                    <span className="font-mono tabular-nums text-ns-blue mr-1.5">
                      01
                    </span>
                    {t("pwaIosStep1")}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-ns-green/12 text-ns-green border border-ns-green/20 flex items-center justify-center shrink-0">
                    <PlusSquare size={18} />
                  </div>
                  <div className="min-w-0 flex-1 text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
                    <span className="font-mono tabular-nums text-ns-green mr-1.5">
                      02
                    </span>
                    {t("pwaIosStep2")}
                  </div>
                </div>
              </div>

              <div className="pt-1 flex flex-col items-center gap-1 text-ns-blue">
                <span className="text-[11px] font-bold text-[#68707D] dark:text-[#8B93A1]">
                  {t("pwaIosPointHint")}
                </span>
                <ArrowDown
                  size={18}
                  aria-hidden="true"
                  className="animate-bounce motion-reduce:animate-none"
                />
              </div>
            </div>
          ) : (
            /* Fallback: Desktop / Android browser without beforeinstallprompt */
            <div data-testid="pwa-fallback-guide" className="space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0">
                  <MoreHorizontal size={18} />
                </div>
                <div className="min-w-0 flex-1 text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
                  <span className="font-mono tabular-nums text-ns-blue mr-1.5">
                    01
                  </span>
                  {t("pwaFallbackStep1")}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ns-green/12 text-ns-green border border-ns-green/20 flex items-center justify-center shrink-0">
                  <PlusSquare size={18} />
                </div>
                <div className="min-w-0 flex-1 text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
                  <span className="font-mono tabular-nums text-ns-green mr-1.5">
                    02
                  </span>
                  {t("pwaFallbackStep2")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
};
