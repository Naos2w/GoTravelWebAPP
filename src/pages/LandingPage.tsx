import React from "react";
import {
  Plane,
  Mail,
  Loader2,
  MapPin,
  Wallet,
  Lock,
  Compass,
  BookOpen,
  Printer,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { useTranslation } from "../shared/contexts/LocalizationContext";
import { SiteFooter } from "./LegalPages";

export interface LandingPageProps {
  isLoggingIn: boolean;
  pendingTripId: string | null;
  onGoogleLogin: () => void;
  onOpenEmailLogin: () => void;
  onOpenPendingTripLogin: () => void;
  onNavigatePublic?: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  isLoggingIn,
  pendingTripId,
  onGoogleLogin,
  onOpenEmailLogin,
  onOpenPendingTripLogin,
  onNavigatePublic,
}) => {
  const { t, language } = useTranslation();
  const isEn = language === "en";

  const highlights = [
    {
      icon: Plane,
      tone: "bg-ns-blue/12 text-ns-blue border-ns-blue/20",
      title: isEn ? "Aviation Boarding Passes" : "航班與登機證卡片",
      desc: isEn
        ? "Import flights to generate Apple Wallet style passes with baggage & terminal tracking."
        : "自動帶入航班時刻、航廈與行李額度，生成航空等級登機證。",
    },
    {
      icon: MapPin,
      tone: "bg-ns-green/12 text-ns-green border-ns-green/20",
      title: isEn ? "Timeline & Route Maps" : "時間軸與互動路線圖",
      desc: isEn
        ? "Paste Google Maps links to pin coordinates and inspect daily numbered paths."
        : "貼上 Google Maps 連結自動解析座標，每日景點依序連線不錯過。",
    },
    {
      icon: Wallet,
      tone: "bg-ns-amber/12 text-ns-amber border-ns-amber/20",
      title: isEn ? "Multi-Currency AA Split" : "多幣別記帳與 AA 分帳",
      desc: isEn
        ? "Lock live exchange rates per entry and settle group balances in minimal transfers."
        : "支援 12 種幣別即時鎖定匯率，自動精算旅伴最少筆數轉帳方案。",
    },
    {
      icon: Printer,
      tone: "bg-ns-indigo/12 text-ns-indigo border-ns-indigo/20",
      title: isEn ? "Print & Offline PWA" : "手冊匯出與離線 PWA",
      desc: isEn
        ? "Export A4 PDF booklets, lockscreen schedules, Apple Notes, .ics, and .kml maps."
        : "一鍵輸出 A4 PDF 手冊、鎖屏時刻表、Apple 備忘錄與行事曆檔案。",
    },
  ];

  const miniFaqs = [
    {
      q: isEn ? "Can I try it without logging in first?" : "登入前可以先預覽範例嗎？",
      a: isEn
        ? "Yes. Browse Tokyo, Kyoto & Osaka, and Swiss Alps templates or read the full guide with zero sign-up wall."
        : "可以。無需登入即可直接瀏覽東京、京阪與瑞士範例行程，或閱讀完整使用教學。",
    },
    {
      q: isEn ? "Is it free for collaborative trips?" : "多人協作與分帳需要付費嗎？",
      a: isEn
        ? "Core trip planning, collaborator invites, AA split settlement, and all export formats are completely free."
        : "行程規劃、邀請旅伴共同編輯、AA 智慧分帳與全格式匯出皆完全免費。",
    },
    {
      q: isEn ? "Does it work offline while flying?" : "搭飛機沒有網路也能看行程嗎？",
      a: isEn
        ? "Install the PWA to cache recent trips locally, or save an A4 PDF booklet and lockscreen image before takeoff."
        : "加入主畫面安裝 PWA 即可快取近期行程，也可預先匯出 PDF 手冊與鎖屏圖片離線查閱。",
    },
  ];

  return (
    <>
      <div className="min-h-[100dvh] flex flex-col justify-between relative overflow-hidden aviation-grid-bg bg-[#F5F6F8] dark:bg-[#0B0D11]">
        <div className="flex-1 flex flex-col justify-center w-full max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-14 gap-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Left Column: Hero Copy & Auth Actions */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ios27-card text-[11px] font-semibold tracking-wider text-ns-blue uppercase">
                <Plane size={13} className="shrink-0" />
                <span>{t("flightReadyBadge")}</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter text-[#1A1D23] dark:text-[#ECEFF4] whitespace-pre-line leading-[1.08]">
                  {t("heroTitle")}
                </h1>
                <p className="text-lg sm:text-xl text-[#68707D] dark:text-[#8B93A1] font-medium tracking-tight max-w-lg mx-auto lg:mx-0">
                  {t("heroSubtitle")}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto bg-ns-blue hover:bg-ns-blue/90 text-white px-7 py-4 rounded-2xl font-bold text-base shadow-sm hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>{t("loggingIn")}</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>{t("login")}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onOpenEmailLogin}
                  className="w-full sm:w-auto ios27-card hover:bg-[#F0F2F5] dark:hover:bg-white/[0.08] text-[#1A1D23] dark:text-[#ECEFF4] px-6 py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer"
                >
                  <Mail size={19} />
                  <span>{t("emailLogin")}</span>
                </button>
              </div>

              {/* Public Discovery Quick-Link Row (No Login Wall) */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1">
                <button
                  type="button"
                  data-testid="landing-templates-link"
                  onClick={() => onNavigatePublic?.("/templates")}
                  className="h-9 px-3.5 rounded-full bg-white/85 dark:bg-[#14171F]/85 hover:bg-[#F0F2F5] dark:hover:bg-[#1B1F2A] border border-black/[0.07] dark:border-white/[0.10] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Compass size={14} className="text-ns-blue shrink-0" />
                  <span>{isEn ? "Explore Templates" : "探索範例行程"}</span>
                </button>
                <button
                  type="button"
                  data-testid="landing-guide-link"
                  onClick={() => onNavigatePublic?.("/guide")}
                  className="h-9 px-3.5 rounded-full bg-white/85 dark:bg-[#14171F]/85 hover:bg-[#F0F2F5] dark:hover:bg-[#1B1F2A] border border-black/[0.07] dark:border-white/[0.10] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <BookOpen size={14} className="text-ns-green shrink-0" />
                  <span>{isEn ? "User Guide" : "使用教學"}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Flighty x Apple Wallet Showcase Card */}
            <div className="lg:col-span-6 w-full max-w-md mx-auto lg:max-w-none">
              <div className="ios27-card rounded-[28px] p-6 sm:p-7 relative overflow-hidden space-y-5">
                {/* Top Aviation Pass Header */}
                <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.08] pb-4 relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center">
                      <Plane size={17} />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#68707D] dark:text-[#8B93A1]">
                        FLIGHTY PASS
                      </div>
                      <div className="font-mono font-bold text-sm text-[#1A1D23] dark:text-[#ECEFF4] tabular-nums">
                        BR198 • ON TIME
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ns-green bg-ns-green/12 border border-ns-green/20 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-ns-green" />
                    LIVE
                  </span>
                </div>

                {/* Route Display */}
                <div className="flex items-center justify-between py-2 relative z-10">
                  <div>
                    <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-tight text-[#1A1D23] dark:text-[#ECEFF4] tabular-nums">
                      TPE
                    </div>
                    <div className="text-xs font-mono font-bold text-ns-blue tabular-nums mt-0.5">
                      08:50
                    </div>
                  </div>

                  <div className="flex-1 px-4 flex flex-col items-center">
                    <div className="w-full border-t-2 border-dashed border-black/[0.12] dark:border-white/[0.14] relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-[#14171F] border border-black/[0.08] dark:border-white/[0.14] flex items-center justify-center text-ns-blue">
                        <Plane size={13} className="rotate-90" />
                      </div>
                    </div>
                    <div className="text-[10px] font-mono font-semibold text-[#68707D] dark:text-[#8B93A1] mt-3 tabular-nums">
                      3h 25m • GATE C7
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-tight text-[#1A1D23] dark:text-[#ECEFF4] tabular-nums">
                      NRT
                    </div>
                    <div className="text-xs font-mono font-bold text-ns-blue tabular-nums mt-0.5">
                      13:15
                    </div>
                  </div>
                </div>

                {/* Mini Bento Feature Chips */}
                <div className="grid grid-cols-2 gap-3 pt-1 relative z-10">
                  <div className="ios27-subcard rounded-2xl p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#68707D] dark:text-[#8B93A1] mb-1">
                      <MapPin size={11} className="text-ns-blue" />
                      <span>{t("itinerary")}</span>
                    </div>
                    <div className="font-bold text-xs text-[#1A1D23] dark:text-[#ECEFF4] truncate">
                      Senso-ji • Shibuya Sky
                    </div>
                  </div>
                  <div className="ios27-subcard rounded-2xl p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#68707D] dark:text-[#8B93A1] mb-1">
                      <Wallet size={11} className="text-ns-green" />
                      <span>{t("expenses")}</span>
                    </div>
                    <div className="font-mono font-bold text-xs text-[#1A1D23] dark:text-[#ECEFF4] tabular-nums">
                      NT$ 24,800
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Nordic Slate Product Highlights & FAQ Section */}
          <section
            aria-label={isEn ? "Workspace highlights and FAQ" : "核心特色與常見問答"}
            data-testid="landing-highlights-section"
            className="space-y-6 pt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {highlights.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="ios27-card rounded-[22px] p-4 sm:p-5 space-y-2.5"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center ${item.tone}`}
                    >
                      <Icon size={17} />
                    </div>
                    <h2 className="text-sm font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
                      {item.title}
                    </h2>
                    <p className="text-xs leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="ios27-card rounded-[24px] p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-ns-indigo/12 text-ns-indigo border border-ns-indigo/20 flex items-center justify-center shrink-0">
                    <HelpCircle size={15} />
                  </span>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
                    {isEn ? "Quick Answers" : "快速問答"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigatePublic?.("/guide")}
                  className="text-xs font-bold text-ns-blue hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>{isEn ? "Read full guide" : "查看完整使用教學"}</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {miniFaqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.05] dark:border-white/[0.08] p-4 space-y-1.5"
                  >
                    <h3 className="text-xs sm:text-sm font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
                      {faq.q}
                    </h3>
                    <p className="text-xs leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <SiteFooter
          language={language}
          onNavigate={(path) => onNavigatePublic?.(path)}
        />
      </div>

      {pendingTripId && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white/95 dark:bg-[#14171F]/95 backdrop-blur-xl border border-ns-blue/25 shadow-2xl px-5 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4 max-w-[90vw]">
          <div className="w-8 h-8 rounded-full bg-ns-blue/12 flex items-center justify-center text-ns-blue shrink-0">
            <Lock size={16} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
              {t("loginToViewTrip")}
            </div>
            <div className="text-[10px] text-[#68707D] dark:text-[#8B93A1]">
              {t("targetTripSaved")}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPendingTripLogin}
            className="bg-ns-blue hover:bg-ns-blue/90 text-white text-xs font-black px-4 py-2 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0 ml-2 shadow-sm"
          >
            {t("login")}
          </button>
        </div>
      )}
    </>
  );
};
