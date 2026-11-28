import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  getCookieConsent,
  initThirdPartyScripts,
  setCookieConsent,
} from "../services/analyticsService";

export interface CookieConsentBannerProps {
  language: "zh" | "en";
  onNavigatePrivacy: () => void;
}

const COPY = {
  zh: {
    title: "隱私與 Cookie 偏好設定",
    description:
      "我們僅使用必要儲存來保存您的本機行程與偏好；若您同意，我們將啟用匿名流量分析以持續改善體驗。",
    privacyLink: "隱私權政策",
    essentialOnly: "僅必要項目",
    acceptAll: "接受全部",
  },
  en: {
    title: "Privacy & Cookie Preferences",
    description:
      "We use essential storage for your trips and preferences. With your consent, we enable anonymous analytics to improve Go Travel.",
    privacyLink: "Privacy Policy",
    essentialOnly: "Essential Only",
    acceptAll: "Accept All",
  },
} as const;

/**
 * Floating Nordic Slate cookie consent bar shown until the visitor selects a preference.
 */
export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  language,
  onNavigatePrivacy,
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(
    () => getCookieConsent() === null
  );

  if (!isVisible) return null;

  const text = COPY[language] ?? COPY.zh;

  const handleChoice = (choice: "accepted" | "essential") => {
    setCookieConsent(choice);
    setIsVisible(false);
    if (choice === "accepted") {
      initThirdPartyScripts();
    }
  };

  return (
    <aside
      aria-label={text.title}
      data-testid="cookie-consent-banner"
      className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-[90] rounded-2xl bg-white/92 dark:bg-[#14171F]/92 backdrop-blur-2xl border border-black/[0.06] dark:border-white/[0.10] shadow-ios-lg p-4 animate-slide-up"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] leading-snug">
              {text.title}
            </p>
            <p className="text-[11px] font-medium text-[#68707D] dark:text-[#8B93A1] leading-relaxed">
              {text.description}{" "}
              <button
                type="button"
                onClick={onNavigatePrivacy}
                className="font-semibold text-ns-blue hover:underline underline-offset-2 cursor-pointer inline"
              >
                {text.privacyLink}
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            data-testid="cookie-essential-btn"
            onClick={() => handleChoice("essential")}
            className="h-9 px-3.5 rounded-xl text-xs font-bold text-[#68707D] dark:text-[#8B93A1] bg-[#F0F2F5] dark:bg-[#1B1F2A] hover:text-[#1A1D23] dark:hover:text-[#ECEFF4] border border-black/[0.06] dark:border-white/[0.10] transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {text.essentialOnly}
          </button>
          <button
            type="button"
            data-testid="cookie-accept-btn"
            onClick={() => handleChoice("accepted")}
            className="h-9 px-4 rounded-xl text-xs font-bold text-white bg-ns-blue hover:bg-ns-blue/90 shadow-sm transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {text.acceptAll}
          </button>
        </div>
      </div>
    </aside>
  );
};
