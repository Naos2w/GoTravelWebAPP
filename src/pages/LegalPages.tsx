import React, { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Clock,
  Compass,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Languages,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  Moon,
  Plane,
  Shield,
  Sparkles,
  Sun,
} from "lucide-react";
import { Language, Theme } from "../types";
import { APP_VERSION } from "../shared/services/version";

export const SUPPORT_EMAIL = "support@gotravel.app";
export const GITHUB_FEEDBACK_URL =
  "https://github.com/Naos2w/GoTravelWebAPP/issues";

export interface SiteFooterProps {
  language: Language;
  onNavigate: (path: string) => void;
}

const FOOTER_LINKS: Array<{
  path: string;
  zh: string;
  en: string;
}> = [
  { path: "/guide", zh: "使用教學", en: "Guide" },
  { path: "/templates", zh: "精選範本", en: "Templates" },
  { path: "/about", zh: "關於我們", en: "About" },
  { path: "/privacy", zh: "隱私權政策", en: "Privacy" },
  { path: "/terms", zh: "服務條款", en: "Terms" },
  { path: "/contact", zh: "聯絡我們", en: "Contact" },
];

export const SiteFooter: React.FC<SiteFooterProps> = ({
  language,
  onNavigate,
}) => {
  const isEn = language === "en";

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    path: string
  ) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <footer
      data-testid="site-footer"
      className="w-full border-t border-black/[0.06] dark:border-white/[0.08] bg-white/75 dark:bg-[#14171F]/75 backdrop-blur-xl"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-7 flex flex-col sm:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0">
            <Plane size={15} />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4]">
            <span>Go Travel</span>
            <span className="text-[#68707D] dark:text-[#8B93A1]">·</span>
            <span className="font-mono tabular-nums text-[11px] text-[#68707D] dark:text-[#8B93A1]">
              v{APP_VERSION}
            </span>
          </div>
        </div>

        <nav
          aria-label={isEn ? "Site footer links" : "網站頁尾導覽"}
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        >
          {FOOTER_LINKS.map((item) => (
            <a
              key={item.path}
              href={item.path}
              data-testid={`footer-link-${item.path.slice(1)}`}
              onClick={(e) => handleLinkClick(e, item.path)}
              className="text-xs font-semibold text-[#68707D] dark:text-[#8B93A1] hover:text-ns-blue transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isEn ? item.en : item.zh}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
};

export interface PublicPageShellProps {
  title: string;
  subtitle?: string;
  language: Language;
  theme?: Theme;
  onToggleTheme?: () => void;
  onToggleLanguage?: () => void;
  onBack: () => void;
  onNavigate: (path: string) => void;
  activePath?: string;
  children: React.ReactNode;
}

const TOP_NAV_LINKS: Array<{
  path: string;
  zh: string;
  en: string;
}> = [
  { path: "/guide", zh: "使用教學", en: "Guide" },
  { path: "/templates", zh: "精選範本", en: "Templates" },
  { path: "/about", zh: "關於", en: "About" },
];

export const PublicPageShell: React.FC<PublicPageShellProps> = ({
  title,
  subtitle,
  language,
  theme = "light",
  onToggleTheme,
  onToggleLanguage,
  onBack,
  onNavigate,
  activePath,
  children,
}) => {
  const isEn = language === "en";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F5F6F8] dark:bg-[#0B0D11] text-[#1A1D23] dark:text-[#ECEFF4]">
      {/* Sticky Nordic Slate Top Bar */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#14171F]/85 backdrop-blur-2xl border-b border-black/[0.06] dark:border-white/[0.08]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            data-testid="public-shell-back-btn"
            onClick={onBack}
            className="h-9 px-3.5 rounded-full bg-[#F0F2F5] dark:bg-[#1B1F2A] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.10] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft size={14} className="shrink-0" />
            <span>{isEn ? "Back to Go Travel" : "返回 Go Travel"}</span>
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <nav
              aria-label={isEn ? "Quick navigation" : "快速導覽"}
              className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar"
            >
              {TOP_NAV_LINKS.map((item) => {
                const isActive = activePath === item.path;
                return (
                  <a
                    key={item.path}
                    href={item.path}
                    data-testid={`topnav-link-${item.path.slice(1)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(item.path);
                    }}
                    className={`h-9 px-3 rounded-full text-xs font-bold flex items-center transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? "bg-ns-blue/12 text-ns-blue border border-ns-blue/25"
                        : "text-[#68707D] dark:text-[#8B93A1] hover:text-[#1A1D23] dark:hover:text-[#ECEFF4] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] border border-transparent"
                    }`}
                  >
                    {isEn ? item.en : item.zh}
                  </a>
                );
              })}
            </nav>

            {(onToggleTheme || onToggleLanguage) && (
              <div className="flex items-center gap-1.5 shrink-0 pl-1.5 border-l border-black/[0.06] dark:border-white/[0.08]">
                {onToggleTheme && (
                  <button
                    type="button"
                    data-testid="public-shell-theme-toggle"
                    onClick={onToggleTheme}
                    aria-label={isEn ? "Toggle theme" : "切換深淺色"}
                    title={isEn ? "Toggle theme" : "切換深淺色"}
                    className="w-9 h-9 rounded-xl bg-[#F0F2F5] dark:bg-[#1B1F2A] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.10] text-[#1A1D23] dark:text-[#ECEFF4] flex items-center justify-center transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {theme === "dark" ? (
                      <Sun size={15} className="shrink-0" />
                    ) : (
                      <Moon size={15} className="shrink-0" />
                    )}
                  </button>
                )}
                {onToggleLanguage && (
                  <button
                    type="button"
                    data-testid="public-shell-lang-toggle"
                    onClick={onToggleLanguage}
                    aria-label={isEn ? "Switch to Chinese" : "切換為英文"}
                    title={isEn ? "Switch to Chinese" : "切換為英文"}
                    className="h-9 min-w-[2.25rem] px-2.5 rounded-xl bg-[#F0F2F5] dark:bg-[#1B1F2A] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.10] text-xs font-bold font-mono text-[#1A1D23] dark:text-[#ECEFF4] flex items-center justify-center gap-1 transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Languages
                      size={13}
                      className="shrink-0 text-[#68707D] dark:text-[#8B93A1]"
                    />
                    <span>{isEn ? "zh" : "EN"}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Page Title & Main Body */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-14">
        <div className="space-y-3 mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#1A1D23] dark:text-[#ECEFF4] leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm sm:text-base text-[#68707D] dark:text-[#8B93A1] max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {children}
      </main>

      <SiteFooter language={language} onNavigate={onNavigate} />
    </div>
  );
};

export interface LegalPageProps {
  page: "about" | "privacy" | "terms" | "contact";
  language: Language;
  theme?: Theme;
  onToggleTheme?: () => void;
  onToggleLanguage?: () => void;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

const AboutContent: React.FC<{
  language: Language;
  onNavigate: (path: string) => void;
}> = ({ language, onNavigate }) => {
  const isEn = language === "en";

  const pillars = [
    {
      icon: Compass,
      tone: "bg-ns-blue/12 text-ns-blue border-ns-blue/20",
      title: isEn ? "Built for Real Journeys" : "為真實旅途而生",
      body: isEn
        ? "Go Travel brings flights, day-by-day itineraries, maps, multi-currency expenses, and packing lists into one calm workspace—replacing scattered spreadsheets and chat threads."
        : "Go Travel 將航班登機證、每日行程、路線地圖、多幣別記帳與行李清單整合在同一個清爽空間，告別散落各處的試算表與群組訊息。",
    },
    {
      icon: Sparkles,
      tone: "bg-ns-green/12 text-ns-green border-ns-green/20",
      title: isEn ? "Free-First, Zero-Bloat" : "免費優先、零冗餘干擾",
      body: isEn
        ? "Core planning, real-time collaboration, AA split settlement, and offline PWA access are free without paywalls or dark-pattern popups. Lightweight ads on public resource pages keep the service sustainable."
        : "核心行程規劃、多人即時協作、AA 旅伴分帳與離線 PWA 皆免費開放，不設繁瑣付費牆或干擾彈窗，僅於公開資源頁面以輕量方式維持營運。",
    },
    {
      icon: Layers,
      tone: "bg-ns-indigo/12 text-ns-indigo border-ns-indigo/20",
      title: isEn ? "Nordic Slate Design Craft" : "北歐航空灰工藝設計",
      body: isEn
        ? "Inspired by aviation instrumentation and tactile boarding passes, every surface balances low-saturation Nordic Slate contrast, tabular numerals, and responsive mobile ergonomics."
        : "汲取航空儀表板與實體登機證的克制美學，全站採用低飽和北歐灰藍語彙、等寬數字對齊與單手友善的行動介面，在淺色與深色模式下皆保持清晰耐看。",
    },
  ];

  return (
    <div data-testid="legal-page-about" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pillars.map((pillar, idx) => {
          const Icon = pillar.icon;
          return (
            <section
              key={idx}
              className="ios27-card rounded-[24px] p-5 sm:p-6 space-y-3"
            >
              <div
                className={`w-10 h-10 rounded-xl border flex items-center justify-center ${pillar.tone}`}
              >
                <Icon size={19} />
              </div>
              <h2 className="text-base font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
                {pillar.title}
              </h2>
              <p className="text-sm leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
                {pillar.body}
              </p>
            </section>
          );
        })}
      </div>

      <section className="ios27-card rounded-[24px] p-6 sm:p-7 space-y-4">
        <h2 className="text-lg font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
          {isEn ? "Ready to Plan Your Next Trip?" : "準備好展開下一趟旅程了嗎？"}
        </h2>
        <p className="text-sm leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
          {isEn
            ? "Explore curated Tokyo, Kyoto & Osaka, and Swiss Alps templates or walk through our step-by-step product guide."
            : "歡迎直接瀏覽東京、京阪與瑞士阿爾卑斯精選範本，或查看完整功能教學，三分鐘上手所有規劃工具。"}
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => onNavigate("/templates")}
            className="h-10 px-4 rounded-xl bg-ns-blue hover:bg-ns-blue/90 text-white text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe size={15} className="shrink-0" />
            <span>{isEn ? "Explore Templates" : "瀏覽精選範本"}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("/guide")}
            className="h-10 px-4 rounded-xl bg-white dark:bg-[#1B1F2A] hover:bg-[#F0F2F5] dark:hover:bg-white/[0.10] border border-black/[0.08] dark:border-white/[0.12] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen size={15} className="shrink-0" />
            <span>{isEn ? "Read User Guide" : "閱讀使用教學"}</span>
          </button>
        </div>
      </section>
    </div>
  );
};

const PrivacyContent: React.FC<{ language: Language }> = ({ language }) => {
  const isEn = language === "en";

  const sections = isEn
    ? [
        {
          icon: Database,
          title: "1. Data Storage & Supabase Authentication",
          body: "Go Travel uses Supabase (PostgreSQL database and authentication services) to securely store your account profile and trip records—including itineraries, flights, expenses, checklists, and invited collaborator emails. Access is enforced through Row-Level Security (RLS) so only trip owners and explicitly invited collaborators can view or edit private trips.",
        },
        {
          icon: Lock,
          title: "2. Google OAuth Sign-In",
          body: "When you choose Google OAuth to sign in, Go Travel requests only basic identity profile information (name, email address, and profile avatar) required to create your account and identify trip collaborators. We never access your Gmail, Google Drive, Contacts, or Calendar without an explicit user-triggered export action.",
        },
        {
          icon: Globe,
          title: "3. Google Analytics 4 (GA4)",
          body: "We use Google Analytics 4 (GA4) to measure anonymized page views, navigation performance, and feature usage so we can improve reliability and user experience. Analytics data does not include your private trip notes or financial records. You may opt out via browser privacy settings or the Google Analytics Opt-out Browser Add-on.",
        },
        {
          icon: Shield,
          title: "4. Google AdSense & Third-Party Cookies",
          body: "Public informational pages (such as our Guide and Templates) may display advertisements served by Google AdSense. Google and its third-party vendors use cookies to serve ads based on a user's prior visits to Go Travel or other websites. Users may opt out of personalized advertising at any time through Google Ads Settings (https://adssettings.google.com) or learn more at Google's Partner Sites Privacy Policy (https://policies.google.com/technologies/partner-sites).",
        },
        {
          icon: Layers,
          title: "5. Local Storage & Offline PWA Caching",
          body: "Go Travel stores lightweight preferences in browser localStorage (such as light/dark theme, interface language, onboarding completion status, and cached trip snapshots) and uses a Service Worker to enable fast offline viewing when installed as a Progressive Web App (PWA).",
        },
        {
          icon: FileText,
          title: "6. Your Data Export & Deletion Rights",
          body: `You retain full ownership of your travel plans. You can export trips at any time (Markdown, .ics, .kml, or PDF) and delete individual trips directly inside the app. To request complete account and personal data deletion from Supabase, contact us at ${SUPPORT_EMAIL} and we will process your request promptly.`,
        },
      ]
    : [
        {
          icon: Database,
          title: "一、資料儲存與 Supabase 驗證服務",
          body: "Go Travel 採用 Supabase 雲端資料庫與身分驗證服務，安全儲存您的帳號資訊與旅程資料（包含每日行程、航班紀錄、記帳明細、行李清單與受邀協作者 Email）。資料庫全面啟用列層級安全存取控制（Row-Level Security, RLS），確保僅有旅程擁有者與經授權的協作者可檢視或編輯私人行程。",
        },
        {
          icon: Lock,
          title: "二、Google OAuth 第三方登入",
          body: "當您使用 Google OAuth 登入時，Go Travel 僅會向 Google 請求建立帳號與辨識旅伴所需的基本資料（姓名、Email 地址與頭像連結）。除非您主動點擊匯出功能，否則我們絕不會存取您的 Gmail、雲端硬碟、聯絡人或行事曆內容。",
        },
        {
          icon: Globe,
          title: "三、Google Analytics 4 (GA4) 使用分析",
          body: "我們使用 Google Analytics 4 (GA4) 收集去識別化的頁面瀏覽與功能使用統計，以持續改善網站效能與操作體驗。分析資料不會包含您的私人行程備註或帳務明細。您可透過瀏覽器隱私設定或 Google Analytics 停用外掛程式選擇退出。",
        },
        {
          icon: Shield,
          title: "四、Google AdSense 與第三方 Cookie 聲明",
          body: "本網站之公開教學與範本頁面可能刊登由 Google AdSense 提供的廣告服務。Google 與第三方廣告供應商會使用 Cookie，依據使用者先前造訪本網站或其他網站的紀錄放送廣告。您可隨時前往 Google 廣告設定（https://adssettings.google.com）停用個人化廣告，或查閱 Google 合作夥伴網站隱私權說明（https://policies.google.com/technologies/partner-sites）。",
        },
        {
          icon: Layers,
          title: "五、本機儲存空間（Local Storage）與離線快取",
          body: "Go Travel 會於您的瀏覽器 localStorage 保存偏好設定（例如深淺色外觀模式、介面語言、新手導覽完成狀態與旅程離線快取），並透過 PWA Service Worker 協助您在飛行或無網路環境下快速開啟行程。",
        },
        {
          icon: FileText,
          title: "六、資料匯出與刪除權利",
          body: `您對所建立的旅程內容保有完整所有權，可隨時將行程匯出為 Markdown、.ics、.kml 或 PDF，亦可在應用程式內即時刪除個別旅程。若需申請永久刪除帳號與 Supabase 內所有個人資料，請來信至 ${SUPPORT_EMAIL}，我們將於確認身分後盡速完成刪除作業。`,
        },
      ];

  return (
    <div data-testid="legal-page-privacy" className="space-y-4">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F0F2F5] dark:bg-[#1B1F2A] border border-black/[0.06] dark:border-white/[0.08] text-xs font-mono font-semibold tabular-nums text-[#68707D] dark:text-[#8B93A1]">
        <Clock size={13} className="text-ns-blue shrink-0" />
        <span>
          {isEn ? "Last Updated: 2026-04-01" : "最後更新日期：2026-04-01"}
        </span>
      </div>

      <div className="space-y-4">
        {sections.map((section, idx) => {
          const Icon = section.icon;
          return (
            <section
              key={idx}
              className="ios27-card rounded-[24px] p-5 sm:p-6 space-y-2.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <h2 className="text-base font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
                  {section.title}
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
                {section.body}
              </p>
            </section>
          );
        })}
      </div>
    </div>
  );
};

const TermsContent: React.FC<{ language: Language }> = ({ language }) => {
  const isEn = language === "en";

  const sections = isEn
    ? [
        {
          title: "1. Acceptance & Personal Use",
          body: "Go Travel is provided as a personal travel planning workspace for organizing itineraries, flights, shared budgets, and packing checklists. By using the service, you agree to use it lawfully and refrain from automated scraping, abuse, or unauthorized access to other users' trips.",
        },
        {
          title: "2. Third-Party Flight, Weather & Map Data Disclaimer",
          body: "Flight schedules, terminal and gate details, weather forecasts, currency exchange rates, and map coordinates shown inside Go Travel are sourced from third-party providers for planning convenience only. Real-time aviation and travel conditions can change without notice; always verify final boarding times, visa rules, and transit schedules with your airline or official authorities.",
        },
        {
          title: "3. User Content & Collaboration",
          body: "You remain the owner of all itineraries, notes, and expense logs you create. When you invite collaborators to a trip via email or a share link, you are responsible for managing collaborator access and ensuring shared content respects privacy and applicable laws.",
        },
        {
          title: "4. Intellectual Property",
          body: "The Go Travel brand, interface design, curated templates, and software source code are protected by applicable intellectual property laws. You may freely use and customize curated trip templates for your own personal travels.",
        },
        {
          title: "5. Service Availability & Updates",
          body: "We strive to keep Go Travel fast, accurate, and available, including offline PWA support, but the service is provided on an 'as-is' basis without warranties of uninterrupted availability. We may update these terms as new features roll out.",
        },
      ]
    : [
        {
          title: "一、服務範圍與個人使用原則",
          body: "Go Travel 提供個人與同行旅伴進行旅程規劃、航班整理、分帳記帳與行李清單管理之數位工作空間。使用本服務即表示您同意遵守相關法令，不得進行自動化爬蟲、惡意干擾或未經授權存取他人旅程資料。",
        },
        {
          title: "二、第三方航班、天氣與地圖資料免責聲明",
          body: "Go Travel 所呈現之航班時刻、航廈與登機門資訊、天氣預報、即時匯率及地圖座標皆來自第三方公開或合作資料源，僅供行程規劃參考。實際航班異動、出入境規定與交通班次請務必以航空公司及官方機構公告為準。",
        },
        {
          title: "三、使用者內容與多人協作責任",
          body: "您對自行建立的行程文字、備註與支出紀錄擁有完整權利。當您透過 Email 或分享連結邀請旅伴共同編輯時，請妥善管理協作者名單並確保分享內容符合相關法規。",
        },
        {
          title: "四、智慧財產權",
          body: "Go Travel 之品牌識別、介面設計、精選行程範本與程式碼受智慧財產權法保護。您可自由套用與修改本站提供的精選範本作為個人旅遊規劃使用，惟未經授權不得作為商業轉售。",
        },
        {
          title: "五、服務可用性與條款修訂",
          body: "我們致力維持服務穩定與離線可用性，但本服務係依現況提供，不保證任何時刻均不中斷。若未來因功能演進修訂條款，將直接公告於本頁面。",
        },
      ];

  return (
    <div data-testid="legal-page-terms" className="space-y-4">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F0F2F5] dark:bg-[#1B1F2A] border border-black/[0.06] dark:border-white/[0.08] text-xs font-mono font-semibold tabular-nums text-[#68707D] dark:text-[#8B93A1]">
        <Clock size={13} className="text-ns-blue shrink-0" />
        <span>
          {isEn ? "Effective Date: 2026-04-01" : "生效日期：2026-04-01"}
        </span>
      </div>

      <div className="space-y-4">
        {sections.map((section, idx) => (
          <section
            key={idx}
            className="ios27-card rounded-[24px] p-5 sm:p-6 space-y-2"
          >
            <h2 className="text-base font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
              {section.title}
            </h2>
            <p className="text-sm leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
};

const ContactContent: React.FC<{
  language: Language;
  onNavigate: (path: string) => void;
}> = ({ language, onNavigate }) => {
  const isEn = language === "en";
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(SUPPORT_EMAIL);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div data-testid="legal-page-contact" className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Email Support Card */}
        <section className="ios27-card rounded-[24px] p-6 space-y-4">
          <div className="w-11 h-11 rounded-2xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center">
            <Mail size={20} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
              {isEn ? "Email Support" : "電子郵件客服"}
            </h2>
            <p className="text-sm leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
              {isEn
                ? "Questions about your account, privacy/data deletion requests, or partnership inquiries."
                : "帳號問題、隱私與資料刪除申請、或任何合作洽詢，歡迎直接來信。"}
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-[#F0F2F5] dark:bg-[#1B1F2A] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2">
            <span className="font-mono text-xs sm:text-sm font-bold text-[#1A1D23] dark:text-[#ECEFF4] truncate">
              {SUPPORT_EMAIL}
            </span>
            <button
              type="button"
              data-testid="contact-copy-email-btn"
              onClick={() => void handleCopyEmail()}
              className="h-9 px-3 rounded-xl bg-white dark:bg-[#14171F] hover:bg-black/[0.04] dark:hover:bg-white/[0.08] border border-black/[0.08] dark:border-white/[0.12] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-ns-green shrink-0" />
                  <span>{isEn ? "Copied" : "已複製"}</span>
                </>
              ) : (
                <>
                  <Copy size={14} className="shrink-0" />
                  <span>{isEn ? "Copy" : "複製"}</span>
                </>
              )}
            </button>
          </div>

          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              isEn ? "Go Travel Support Inquiry" : "Go Travel 使用諮詢"
            )}`}
            data-testid="contact-mailto-link"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-ns-blue hover:bg-ns-blue/90 text-white text-xs font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Mail size={14} className="shrink-0" />
            <span>{isEn ? "Open Mail App" : "開啟郵件軟體寄信"}</span>
          </a>
        </section>

        {/* GitHub Feedback Card */}
        <section className="ios27-card rounded-[24px] p-6 space-y-4">
          <div className="w-11 h-11 rounded-2xl bg-ns-indigo/12 text-ns-indigo border border-ns-indigo/20 flex items-center justify-center">
            <MessageSquare size={20} />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
              {isEn ? "GitHub Issue & Feature Feedback" : "GitHub 問題回報與功能建議"}
            </h2>
            <p className="text-sm leading-relaxed text-[#68707D] dark:text-[#8B93A1]">
              {isEn
                ? "Spotted a bug or want to suggest a new export format, airline parser, or template? Open an issue directly on GitHub."
                : "發現介面異常，或想許願新的匯出格式、旅遊範本與功能？歡迎透過 GitHub Issues 提交回報。"}
            </p>
          </div>

          <a
            href={GITHUB_FEEDBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="contact-github-link"
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-white dark:bg-[#1B1F2A] hover:bg-[#F0F2F5] dark:hover:bg-white/[0.10] border border-black/[0.08] dark:border-white/[0.12] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ExternalLink size={14} className="shrink-0" />
            <span>{isEn ? "Open GitHub Feedback" : "前往 GitHub 回報"}</span>
          </a>
        </section>
      </div>

      {/* Response Expectations */}
      <section className="ios27-card rounded-[24px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-ns-green/12 text-ns-green border border-ns-green/20 flex items-center justify-center shrink-0 mt-0.5">
            <Clock size={17} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
              {isEn ? "Response Time: 1–3 Business Days" : "回覆時效：1–3 個工作天"}
            </h3>
            <p className="text-xs sm:text-sm text-[#68707D] dark:text-[#8B93A1] leading-relaxed">
              {isEn
                ? "Including your device model, browser version, and steps to reproduce helps us resolve issues much faster."
                : "來信回報問題時，若能附上您的裝置型號、瀏覽器版本與操作步驟，將有助於我們更快速協助排解。"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("/guide")}
          className="h-9 px-3.5 rounded-xl bg-[#F0F2F5] dark:bg-[#1B1F2A] hover:bg-black/[0.06] dark:hover:bg-white/[0.10] border border-black/[0.06] dark:border-white/[0.10] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isEn ? "Check FAQ First" : "先看常見問題"}
        </button>
      </section>
    </div>
  );
};

export const LegalPage: React.FC<LegalPageProps> = ({
  page,
  language,
  theme,
  onToggleTheme,
  onToggleLanguage,
  onBack,
  onNavigate,
}) => {
  const isEn = language === "en";

  const meta: Record<
    LegalPageProps["page"],
    { title: string; subtitle: string }
  > = {
    about: {
      title: isEn ? "About Go Travel" : "關於 Go Travel",
      subtitle: isEn
        ? "A calm, flight-ready workspace designed for modern travelers who want clarity without clutter."
        : "為現代旅人打造的極簡行程規劃空間——從航班、地圖、分帳到離線手冊，一站就緒。",
    },
    privacy: {
      title: isEn ? "Privacy Policy" : "隱私權政策",
      subtitle: isEn
        ? "How Go Travel handles your trip records, Google OAuth sign-in, Supabase storage, analytics, and third-party ad cookies."
        : "透明說明 Go Travel 如何處理您的旅程資料、Supabase 雲端儲存、Google OAuth 登入、GA4 分析與 Google AdSense 相關 Cookie。",
    },
    terms: {
      title: isEn ? "Terms of Service" : "服務條款",
      subtitle: isEn
        ? "Clear guidelines on personal travel planning use, third-party aviation and map data disclaimers, and content ownership."
        : "關於 Go Travel 個人使用規範、第三方航班與地圖資料免責說明，以及您所建立資料之所有權保障。",
    },
    contact: {
      title: isEn ? "Contact & Support" : "聯絡我們與意見回饋",
      subtitle: isEn
        ? "Reach our team for technical support, privacy requests, or product suggestions."
        : "需要技術支援、資料刪除協助或想分享功能建議？透過以下管道隨時與我們聯繫。",
    },
  };

  return (
    <PublicPageShell
      title={meta[page].title}
      subtitle={meta[page].subtitle}
      language={language}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onToggleLanguage={onToggleLanguage}
      onBack={onBack}
      onNavigate={onNavigate}
      activePath={`/${page}`}
    >
      {page === "about" && (
        <AboutContent language={language} onNavigate={onNavigate} />
      )}
      {page === "privacy" && <PrivacyContent language={language} />}
      {page === "terms" && <TermsContent language={language} />}
      {page === "contact" && (
        <ContactContent language={language} onNavigate={onNavigate} />
      )}
    </PublicPageShell>
  );
};
