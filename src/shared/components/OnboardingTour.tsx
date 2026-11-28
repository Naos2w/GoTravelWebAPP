import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Map,
  MapPin,
  Printer,
  Wallet,
  X,
} from "lucide-react";
import { Language } from "../../types";

export const ONBOARDING_STORAGE_KEY = "gotravel_onboarding_tour_done";

export function isOnboardingTourDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function markOnboardingTourDone(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function resetOnboardingTour(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export type OnboardingTourTab =
  | "itinerary"
  | "flights"
  | "expenses"
  | "checklist";

export interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  language?: Language;
  onNavigateTab?: (tab: OnboardingTourTab) => void;
}

interface TourStepConfig {
  id: string;
  tab: OnboardingTourTab;
  tone: "blue" | "green" | "amber" | "indigo";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  highlights: { zh: string[]; en: string[] };
}

const TOUR_STEPS: TourStepConfig[] = [
  {
    id: "itinerary-schedule",
    tab: "itinerary",
    tone: "blue",
    icon: MapPin,
    title: {
      zh: "新增景點與行程排程",
      en: "Add Places & Daily Schedule",
    },
    summary: {
      zh: "依天數安排景點、餐廳與交通移動，直接貼上 Google Maps 連結即可自動解析名稱與座標。",
      en: "Organize places, dining, and transit day by day. Paste any Google Maps link to capture coordinates automatically.",
    },
    highlights: {
      zh: [
        "支援景點、餐飲與交通時間軸快速排序",
        "貼上 Google Maps 網址自動帶入精準經緯度",
      ],
      en: [
        "Arrange places, restaurants, and transit on a clean daily timeline",
        "Auto-parse place names and coordinates from Google Maps URLs",
      ],
    },
  },
  {
    id: "map-flight-routes",
    tab: "itinerary",
    tone: "green",
    icon: Map,
    title: {
      zh: "切換地圖檢視路線與航線",
      en: "Switch to Map View & Flight Arcs",
    },
    summary: {
      zh: "一鍵切換互動式地圖，檢視當日景點順序、順路動線與機場航班連線，快速調整行程節奏。",
      en: "Toggle interactive Map View to visualize daily pin order, walking routes, and flight paths at a glance.",
    },
    highlights: {
      zh: [
        "每日標記依序編號，直覺檢查路線是否繞路",
        "點擊標記可直接開啟手機 Google Maps 導航",
      ],
      en: [
        "Numbered pins reveal routing flow and prevent backtracking",
        "Tap any pin to launch turn-by-turn Google Maps navigation",
      ],
    },
  },
  {
    id: "expenses-aa-split",
    tab: "expenses",
    tone: "amber",
    icon: Wallet,
    title: {
      zh: "記帳與 AA 旅伴分帳",
      en: "Track Expenses & Smart AA Split",
    },
    summary: {
      zh: "支援多幣別即時鎖定匯率折算台幣，自動計算每位旅伴的代墊淨額與最少筆數平帳方案。",
      en: "Log multi-currency spending with locked exchange rates and compute minimum AA settlement transfers automatically.",
    },
    highlights: {
      zh: [
        "機票與當地消費整合追蹤，隨時掌握預算餘額",
        "自訂代墊人與分攤對象，旅伴結帳零爭議",
      ],
      en: [
        "Combine flights and local expenses against your trip budget",
        "Assign payers and split participants for effortless settlement",
      ],
    },
  },
  {
    id: "print-export-studio",
    tab: "itinerary",
    tone: "indigo",
    icon: Printer,
    title: {
      zh: "列印與匯出分享",
      en: "Print & Export Studio",
    },
    summary: {
      zh: "一鍵輸出高畫質登機證、結算收據圖、鎖屏時刻表、A4 旅遊手冊 PDF，並同步至 Apple 備忘錄或日曆。",
      en: "Export boarding passes, thermal receipts, lockscreen schedules, A4 PDF booklets, Apple Notes, and calendar files.",
    },
    highlights: {
      zh: [
        "支援 .ics 行事曆、Google My Maps .kml 與 Markdown",
        "離線保存手冊與登機證，飛行途中隨時查閱",
      ],
      en: [
        "Supports .ics calendars, Google My Maps .kml, and Markdown",
        "Keep offline booklets and boarding passes ready in flight",
      ],
    },
  },
];

const TONE_BADGE_STYLES: Record<TourStepConfig["tone"], string> = {
  blue: "bg-ns-blue/12 text-ns-blue border-ns-blue/20",
  green: "bg-ns-green/12 text-ns-green border-ns-green/20",
  amber: "bg-ns-amber/12 text-ns-amber border-ns-amber/20",
  indigo: "bg-ns-indigo/12 text-ns-indigo border-ns-indigo/20",
};

const TONE_DOT_STYLES: Record<TourStepConfig["tone"], string> = {
  blue: "bg-ns-blue",
  green: "bg-ns-green",
  amber: "bg-ns-amber",
  indigo: "bg-ns-indigo",
};

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  language = "zh",
  onNavigateTab,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
    }
  }, [isOpen]);

  const finishAndClose = useCallback(() => {
    markOnboardingTourDone();
    onClose();
  }, [onClose]);

  const goToStep = useCallback(
    (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(TOUR_STEPS.length - 1, nextIdx));
      setStepIndex(clamped);
      onNavigateTab?.(TOUR_STEPS[clamped].tab);
    },
    [onNavigateTab]
  );

  const handleNext = useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finishAndClose();
      return;
    }
    goToStep(stepIndex + 1);
  }, [stepIndex, finishAndClose, goToStep]);

  const handlePrev = useCallback(() => {
    if (stepIndex > 0) {
      goToStep(stepIndex - 1);
    }
  }, [stepIndex, goToStep]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finishAndClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, finishAndClose, handleNext, handlePrev]);

  if (!isOpen) return null;

  const isEn = language === "en";
  const currentStep = TOUR_STEPS[stepIndex];
  const StepIcon = currentStep.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const modalContent = (
    <div
      data-testid="onboarding-tour-backdrop"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-[#F5F6F8]/90 dark:bg-[#0B0D11]/85 backdrop-blur-2xl p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={finishAndClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-tour-title"
        data-testid="onboarding-tour-modal"
        className="w-full sm:max-w-lg bg-white/95 dark:bg-[#14171F]/95 backdrop-blur-3xl rounded-t-[32px] sm:rounded-[32px] shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden animate-in slide-in-from-bottom-3 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sm:p-7 space-y-6">
          {/* Mobile grabber */}
          <div className="w-12 h-1.5 rounded-full bg-[#68707D]/30 dark:bg-white/20 mx-auto sm:hidden" />

          {/* Header Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center px-2.5 h-7 rounded-full bg-[#F0F2F5] dark:bg-[#1B1F2A] border border-black/[0.06] dark:border-white/[0.10] text-[11px] font-mono font-bold tabular-nums text-[#68707D] dark:text-[#8B93A1] whitespace-nowrap shrink-0">
                {String(stepIndex + 1).padStart(2, "0")} /{" "}
                {String(TOUR_STEPS.length).padStart(2, "0")}
              </span>
              <span className="text-xs font-bold tracking-tight text-[#68707D] dark:text-[#8B93A1] truncate">
                {isEn ? "Quick Tour" : "新手快速導覽"}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                data-testid="onboarding-skip-btn"
                onClick={finishAndClose}
                className="h-9 px-3 rounded-full text-xs font-bold text-[#68707D] dark:text-[#8B93A1] hover:text-[#1A1D23] dark:hover:text-[#ECEFF4] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isEn ? "Skip" : "跳過"}
              </button>
              <button
                type="button"
                data-testid="onboarding-close-btn"
                onClick={finishAndClose}
                aria-label={isEn ? "Close tour" : "關閉導覽"}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[#68707D] dark:text-[#8B93A1] bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/[0.06] dark:border-white/[0.10] transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Step Body */}
          <div className="space-y-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_BADGE_STYLES[currentStep.tone]}`}
              >
                <StepIcon size={22} />
              </div>
              <h2
                id="onboarding-tour-title"
                data-testid="onboarding-step-title"
                className="text-lg sm:text-xl font-extrabold tracking-tight text-[#1A1D23] dark:text-[#ECEFF4] leading-snug"
              >
                {currentStep.title[language]}
              </h2>
            </div>

            <p className="text-sm leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
              {currentStep.summary[language]}
            </p>

            <div className="rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.06] dark:border-white/[0.08] p-4 space-y-2.5">
              {currentStep.highlights[language].map((point, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${TONE_BADGE_STYLES[currentStep.tone]}`}
                  >
                    <Check size={12} />
                  </span>
                  <span className="text-xs sm:text-sm font-medium text-[#1A1D23] dark:text-[#ECEFF4] leading-relaxed">
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer: Progress Dots & Navigation Buttons */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div
              className="flex items-center gap-1.5"
              role="tablist"
              aria-label={isEn ? "Tour progress" : "導覽進度"}
            >
              {TOUR_STEPS.map((step, idx) => {
                const active = idx === stepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-label={`${isEn ? "Step" : "步驟"} ${idx + 1}`}
                    data-testid={`onboarding-dot-${idx}`}
                    onClick={() => goToStep(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      active
                        ? `w-6 ${TONE_DOT_STYLES[step.tone]}`
                        : "w-2 bg-black/15 dark:bg-white/20 hover:bg-black/25 dark:hover:bg-white/35"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isFirst && (
                <button
                  type="button"
                  data-testid="onboarding-prev-btn"
                  onClick={handlePrev}
                  className="h-10 px-3.5 rounded-xl bg-white dark:bg-[#1B1F2A] hover:bg-[#F0F2F5] dark:hover:bg-white/[0.10] border border-black/[0.08] dark:border-white/[0.12] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeft size={14} className="shrink-0" />
                  <span>{isEn ? "Back" : "上一步"}</span>
                </button>
              )}

              <button
                type="button"
                data-testid={
                  isLast ? "onboarding-finish-btn" : "onboarding-next-btn"
                }
                onClick={handleNext}
                className="h-10 px-4 rounded-xl bg-ns-blue hover:bg-ns-blue/90 text-white text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>
                  {isLast
                    ? isEn
                      ? "Get Started"
                      : "開始使用"
                    : isEn
                    ? "Next"
                    : "下一步"}
                </span>
                {isLast ? (
                  <Check size={14} className="shrink-0" />
                ) : (
                  <ArrowRight size={14} className="shrink-0" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
};
