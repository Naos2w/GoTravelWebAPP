import React, { useState } from "react";
import {
  X as CloseIcon,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { useTranslation } from "../contexts/LocalizationContext";
import {
  signInWithGoogle,
  signInWithEmail,
  isSupabaseConfigured,
} from "../services/authService";

export type LoginReason = "session_expired" | "trip_access" | null;

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTripId?: string | null;
  reason?: LoginReason;
  onSuccess?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  redirectTripId,
  reason,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    if (isGoogleLoading) return;
    setErrorMessage(null);

    if (!isSupabaseConfigured()) {
      setErrorMessage(t("configMissing"));
      return;
    }

    setIsGoogleLoading(true);
    try {
      await signInWithGoogle(redirectTripId);
    } catch (err: any) {
      console.error("Google login failed:", err);
      setIsGoogleLoading(false);
      setErrorMessage(err?.message || t("loginFailed"));
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEmailSending) return;
    setErrorMessage(null);

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setErrorMessage(t("invalidEmail"));
      return;
    }

    if (!isSupabaseConfigured()) {
      setErrorMessage(t("configMissing"));
      return;
    }

    setIsEmailSending(true);
    try {
      await signInWithEmail(trimmed, redirectTripId);
      setIsEmailSent(true);
    } catch (err: any) {
      console.error("Email magic link failed:", err);
      setErrorMessage(err?.message || t("loginFailed"));
    } finally {
      setIsEmailSending(false);
    }
  };

  const isSessionExpired = reason === "session_expired";
  const isTripAccess =
    reason === "trip_access" || (!!redirectTripId && !isSessionExpired);

  const title = isSessionExpired
    ? t("sessionExpiredTitle")
    : isTripAccess
    ? t("loginRequiredTitle")
    : t("loginModalTitle");

  const subtitle = isSessionExpired
    ? t("sessionExpiredDesc")
    : isTripAccess
    ? t("loginRequiredDesc")
    : t("loginModalSubtitle");

  const googleButtonText = isSessionExpired
    ? t("reloginAndContinue")
    : isTripAccess
    ? t("loginAndContinue")
    : t("googleLogin");

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#121318]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.14] w-full max-w-md rounded-[32px] p-7 shadow-2xl flex flex-col gap-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div
          className={`absolute top-0 right-0 w-36 h-36 ${
            isSessionExpired ? "bg-amber-500/15" : "bg-primary/10"
          } rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none`}
        />

        {/* Modal Header */}
        <div className="flex justify-between items-start relative z-10">
          <div>
            {isSessionExpired ? (
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mb-3 animate-in zoom-in-75">
                <ShieldAlert size={26} />
              </div>
            ) : isTripAccess ? (
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mb-3 animate-in zoom-in-75">
                <Lock size={26} />
              </div>
            ) : (
              <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">
                {t("appName")}
              </div>
            )}
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 leading-relaxed">
              {subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Redirect Notice when accessing a trip */}
        {redirectTripId && (
          <div className="bg-primary/10 border border-primary/20 text-primary p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2">
            <Lock size={16} className="shrink-0" />
            <span className="flex-1 font-bold leading-relaxed">
              {t("targetTripSaved")}
            </span>
          </div>
        )}

        {/* Error message alert */}
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-2xl text-xs flex items-center gap-2.5 animate-in slide-in-from-top-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="space-y-4 relative z-10">
          <button
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isEmailSending}
            className="w-full bg-primary hover:bg-primary/95 text-white py-4 px-6 rounded-2xl font-black text-sm shadow-lg shadow-primary/25 hover:shadow-primary/35 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3 cursor-pointer"
          >
            {isGoogleLoading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
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
                <span>{googleButtonText}</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
            <span className="flex-shrink mx-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              {t("orDivider")}
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
          </div>

          {/* Email Magic Link Section */}
          {isEmailSent ? (
            <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-5 rounded-2xl text-center space-y-2 animate-in fade-in zoom-in-95">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
              <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                {t("magicLinkSent")}
              </div>
              <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 font-mono">
                {email}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsEmailSent(false);
                  setEmail("");
                }}
                className="text-xs text-primary font-bold hover:underline pt-2 inline-block"
              >
                ← 使用其他 Email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("enterEmail")}
                  disabled={isGoogleLoading || isEmailSending}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-white/[0.1] bg-slate-50 dark:bg-white/[0.05] text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isGoogleLoading || isEmailSending || !email.trim()}
                className="w-full bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 py-3 px-6 rounded-2xl font-bold text-sm shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isEmailSending ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>{t("sendingMagicLink")}</span>
                  </>
                ) : (
                  <span>{t("sendMagicLink")}</span>
                )}
              </button>
            </form>
          )}
          {isTripAccess && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors cursor-pointer"
              >
                {t("exploreLanding")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
