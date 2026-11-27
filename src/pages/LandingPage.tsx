import React from "react";
import { Plane, Mail, Loader2, MapPin, Wallet, Lock } from "lucide-react";
import { useTranslation } from "../shared/contexts/LocalizationContext";
import { APP_VERSION } from "../shared/services/version";

export interface LandingPageProps {
  isLoggingIn: boolean;
  pendingTripId: string | null;
  onGoogleLogin: () => void;
  onOpenEmailLogin: () => void;
  onOpenPendingTripLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  isLoggingIn,
  pendingTripId,
  onGoogleLogin,
  onOpenEmailLogin,
  onOpenPendingTripLogin,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="min-h-[100dvh] flex flex-col justify-between p-6 sm:p-10 relative overflow-hidden aviation-grid-bg">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] bg-primary/15 dark:bg-primary/20 rounded-full blur-[140px] -z-10 pointer-events-none" />

        <div className="flex-1 flex items-center justify-center w-full max-w-6xl mx-auto py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Left Column: Hero Copy & Auth Actions */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full ios27-card text-[11px] font-semibold tracking-wider text-primary uppercase">
                <Plane size={13} className="shrink-0" />
                <span>{t("flightReadyBadge")}</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tighter text-slate-900 dark:text-white whitespace-pre-line leading-[1.08]">
                  {t("heroTitle")}
                </h1>
                <p className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 font-medium tracking-tight max-w-lg mx-auto lg:mx-0">
                  {t("heroSubtitle")}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={onGoogleLogin}
                  disabled={isLoggingIn}
                  className="w-full sm:w-auto bg-primary text-white px-7 py-4 rounded-2xl font-bold text-base shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 whitespace-nowrap shrink-0 cursor-pointer"
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
                  className="w-full sm:w-auto ios27-card hover:bg-slate-100/80 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 px-6 py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 active:scale-95 cursor-pointer"
                >
                  <Mail size={19} />
                  <span>{t("emailLogin")}</span>
                </button>
              </div>
            </div>

            {/* Right Column: Flighty x Apple Wallet Showcase Card */}
            <div className="lg:col-span-6 w-full max-w-md mx-auto lg:max-w-none">
              <div className="ios27-card rounded-[28px] p-6 sm:p-7 relative overflow-hidden space-y-5">
                <div className="absolute -right-12 -top-12 w-44 h-44 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

                {/* Top Aviation Pass Header */}
                <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.08] pb-4 relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Plane size={17} />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        FLIGHTY PASS
                      </div>
                      <div className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                        BR198 • ON TIME
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                </div>

                {/* Route Display */}
                <div className="flex items-center justify-between py-2 relative z-10">
                  <div>
                    <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                      TPE
                    </div>
                    <div className="text-xs font-mono font-bold text-primary dark:text-sky-400 tabular-nums mt-0.5">
                      08:50
                    </div>
                  </div>

                  <div className="flex-1 px-4 flex flex-col items-center">
                    <div className="w-full border-t-2 border-dashed border-slate-200 dark:border-white/[0.14] relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white dark:bg-[#12141C] border border-slate-200 dark:border-white/[0.14] flex items-center justify-center text-primary">
                        <Plane size={13} className="rotate-90" />
                      </div>
                    </div>
                    <div className="text-[10px] font-mono font-semibold text-slate-400 mt-3 tabular-nums">
                      3h 25m • GATE C7
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                      NRT
                    </div>
                    <div className="text-xs font-mono font-bold text-primary dark:text-sky-400 tabular-nums mt-0.5">
                      13:15
                    </div>
                  </div>
                </div>

                {/* Mini Bento Feature Chips */}
                <div className="grid grid-cols-2 gap-3 pt-1 relative z-10">
                  <div className="ios27-subcard rounded-2xl p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">
                      <MapPin size={11} className="text-primary" />
                      <span>{t("itinerary")}</span>
                    </div>
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                      Senso-ji • Shibuya Sky
                    </div>
                  </div>
                  <div className="ios27-subcard rounded-2xl p-3.5">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">
                      <Wallet size={11} className="text-emerald-500" />
                      <span>{t("expenses")}</span>
                    </div>
                    <div className="font-mono font-bold text-xs text-slate-800 dark:text-slate-100 tabular-nums">
                      NT$ 24,800
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="text-center text-[10px] font-semibold text-slate-400 uppercase tracking-[0.25em] flex items-center justify-center gap-2 pt-4">
          <span>{t("appName")}</span>
          <span>•</span>
          <span className="font-mono tabular-nums">v{APP_VERSION}</span>
        </footer>
      </div>

      {pendingTripId && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white/95 dark:bg-[#2C2C2E]/95 backdrop-blur-xl border border-primary/30 shadow-2xl px-5 py-3 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-4 max-w-[90vw]">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Lock size={16} />
          </div>
          <div className="text-left min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
              {t("loginToViewTrip")}
            </div>
            <div className="text-[10px] text-slate-400">
              {t("targetTripSaved")}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPendingTripLogin}
            className="bg-primary text-white text-xs font-black px-4 py-2 rounded-xl hover:scale-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0 ml-2 shadow-md shadow-primary/20"
          >
            {t("login")}
          </button>
        </div>
      )}
    </>
  );
};
