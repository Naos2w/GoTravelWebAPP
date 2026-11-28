import React, { useState } from "react";
import {
  ChevronDown,
  Compass,
  HelpCircle,
  MapPin,
  Plane,
  Play,
  Share2,
  Smartphone,
  Users,
} from "lucide-react";
import { Language } from "../types";
import { PublicPageShell } from "./LegalPages";

export interface GuidePageProps {
  language: Language;
  onBack: () => void;
  onNavigate: (path: string) => void;
  onReplayTour: () => void;
  bottomSlot?: React.ReactNode;
}

interface WorkflowSection {
  step: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  bullets: { zh: string[]; en: string[] };
}

const CORE_WORKFLOWS: WorkflowSection[] = [
  {
    step: "01",
    icon: Plane,
    tone: "bg-ns-blue/12 text-ns-blue border-ns-blue/20",
    title: {
      zh: "快速建立旅程",
      en: "Quick Trip Creation",
    },
    summary: {
      zh: "輸入目的地與日期即可秒速開團，或透過航班匯入自動產生登機證卡片與機場行程節點。",
      en: "Create a trip in seconds with dates and an optional starting budget, or import flights to generate boarding passes automatically.",
    },
    bullets: {
      zh: [
        "支援「快速建立」與「航班匯入」雙模式，轉機多航段同樣適用",
        "沒有靈感時可先至精選範本一鍵複製完整東京、京阪或瑞士行程",
      ],
      en: [
        "Switch freely between Quick Create and multi-leg Flight Import",
        "Clone a curated Tokyo, Kyoto & Osaka, or Swiss Alps template in one tap",
      ],
    },
  },
  {
    step: "02",
    icon: MapPin,
    tone: "bg-ns-green/12 text-ns-green border-ns-green/20",
    title: {
      zh: "貼 Google Maps 連結加景點",
      en: "Add Places via Google Maps Links",
    },
    summary: {
      zh: "直接貼上 Google Maps 分享網址，或從手機地圖「分享」至 Go Travel，系統會自動帶入景點名稱與精準經緯度。",
      en: "Paste a Google Maps link or share directly from the Google Maps app to auto-fill place names and exact coordinates.",
    },
    bullets: {
      zh: [
        "每個景點自動同步至互動式地圖並依時間軸編號連線",
        "單日景點超過 10 站時，多點導航匯出會自動分段避免遺漏",
      ],
      en: [
        "Every saved stop appears on Map View with numbered daily markers",
        "Daily multi-stop Google Maps navigation splits automatically beyond 10 stops",
      ],
    },
  },
  {
    step: "03",
    icon: Users,
    tone: "bg-ns-amber/12 text-ns-amber border-ns-amber/20",
    title: {
      zh: "多人即時協作與 AA 分帳",
      en: "Real-Time Collaboration & Smart AA Split",
    },
    summary: {
      zh: "輸入旅伴 Email 即可共同編輯行程、管理各自機票，並以多幣別即時鎖定匯率自動平帳結算。",
      en: "Invite travel buddies by email to co-edit schedules, add individual flight tickets, and settle multi-currency expenses effortlessly.",
    },
    bullets: {
      zh: [
        "支援 JPY、CHF、EUR、USD 等 12 種幣別並自動鎖定當下換算匯率",
        "可指定實際代墊人與參與分攤成員，自動精算最少筆數轉帳建議",
      ],
      en: [
        "Supports 12 currencies with locked exchange rates at entry time",
        "Tracks who paid and who split each item to compute minimum transfer pairs",
      ],
    },
  },
  {
    step: "04",
    icon: Share2,
    tone: "bg-ns-indigo/12 text-ns-indigo border-ns-indigo/20",
    title: {
      zh: "匯出至 iPhone 備忘錄／Google 日曆",
      en: "Export to Apple Notes & Google Calendar",
    },
    summary: {
      zh: "在「列印與匯出中心」一鍵輸出熱感應收據圖、鎖屏時刻表、A4 旅遊手冊 PDF，或同步到系統行事曆與備忘錄。",
      en: "Use Print & Export Studio to generate boarding passes, lockscreen timetables, A4 PDF booklets, Apple Notes Markdown, and calendar files.",
    },
    bullets: {
      zh: [
        "支援 Apple Notes 原生分享、Google Calendar 單鍵加入與標準 .ics 檔",
        "可下載依天數分層的 .kml 地圖檔，直接匯入 Google My Maps 離線標記",
      ],
      en: [
        "Native Apple Notes share sheet, 1-tap Google Calendar flights, and .ics files",
        "Download day-layered .kml files for Google My Maps offline pins",
      ],
    },
  },
  {
    step: "05",
    icon: Smartphone,
    tone: "bg-ns-blue/12 text-ns-blue border-ns-blue/20",
    title: {
      zh: "安裝 PWA 到主畫面",
      en: "Install PWA to Home Screen",
    },
    summary: {
      zh: "無需透過商店下載，從 Safari 或 Chrome 將 Go Travel 加入主畫面即可享全螢幕體驗與離線檢視。",
      en: "Add Go Travel directly from Safari or Chrome for full-screen launch, offline trip viewing, and Apple Shortcuts deep links.",
    },
    bullets: {
      zh: [
        "iPhone：於 Safari 點擊底部「分享」按鈕，選擇「加入主畫面」",
        "Android：點擊選單「加入主畫面」或「立即安裝 App」，並支援地圖直接分享收錄",
      ],
      en: [
        "iOS: Tap Safari's Share button and choose Add to Home Screen",
        "Android: Tap Install App for native home-screen launch and Share Target support",
      ],
    },
  },
];

interface FaqItem {
  question: { zh: string; en: string };
  answer: { zh: string; en: string };
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: {
      zh: "Go Travel 是否完全免費？需要綁定信用卡嗎？",
      en: "Is Go Travel free to use? Do I need a credit card?",
    },
    answer: {
      zh: "Go Travel 的核心行程規劃、航班登機證、多人協作、AA 智慧分帳與匯出功能皆完全免費，無需綁定任何信用卡。",
      en: "Yes. Core itinerary planning, boarding passes, real-time collaboration, AA expense splitting, and exports are completely free with no credit card required.",
    },
  },
  {
    question: {
      zh: "搭飛機或沒有網路時，還能查看已安排的行程嗎？",
      en: "Can I view my itinerary offline during a flight?",
    },
    answer: {
      zh: "可以。將 Go Travel 安裝為 PWA 主畫面應用後，近期開啟過的旅程會自動快取於本機；此外您也可提前匯出 A4 旅遊手冊 PDF 或鎖屏時刻表圖片保存在相簿中。",
      en: "Yes. Installing Go Travel as a PWA caches recently opened trips locally, and you can also export an A4 PDF booklet or lockscreen schedule image to Photos before boarding.",
    },
  },
  {
    question: {
      zh: "如何邀請旅伴共同編輯同一趟旅程？",
      en: "How do I invite friends to co-edit a trip?",
    },
    answer: {
      zh: "進入旅程後點擊上方「分享旅程」，輸入旅伴的登入 Email 加入協作者名單，並傳送專屬分享連結即可即時同步編輯。",
      en: "Open any trip, tap Share Trip in the header, add your travel buddy's email to the collaborator list, and send them the trip permalink for instant real-time sync.",
    },
  },
  {
    question: {
      zh: "多幣別記帳的匯率是如何計算的？",
      en: "How does multi-currency expense conversion work?",
    },
    answer: {
      zh: "新增外幣支出時系統會自動套用即時匯率並鎖定於該筆紀錄，避免日後匯率波動影響旅伴分帳金額；您也可隨時手動微調實際刷卡匯率。",
      en: "When you log a foreign-currency expense, Go Travel locks the current exchange rate on that record so future fluctuations do not alter your group settlement—and you can fine-tune the rate anytime.",
    },
  },
  {
    question: {
      zh: "匯出到 iPhone 備忘錄或 Google 日曆支援哪些格式？",
      en: "Which formats are supported for Apple Notes and Google Calendar?",
    },
    answer: {
      zh: "列印與匯出中心支援標準 .ics 行事曆檔、免授權一鍵加入 Google 日曆航班連結、Apple Notes Markdown 時間軸、可勾選行李清單以及 Google My Maps .kml 檔案。",
      en: "Print & Export Studio supports standard .ics calendar files, 1-tap Google Calendar flight links, formatted Apple Notes Markdown, checkbox packing lists, and Google My Maps .kml files.",
    },
  },
  {
    question: {
      zh: "我的私人行程會被公開搜尋到嗎？可以刪除資料嗎？",
      en: "Are my private trips searchable, and can I delete my data?",
    },
    answer: {
      zh: "私人旅程受到 Supabase 資料庫權限規則保護，不會被搜尋引擎收錄，只有您與受邀協作者能存取。您隨時可在旅程列表刪除行程，或透過聯絡我們申請完整帳號資料刪除。",
      en: "Private trips are protected by Supabase Row-Level Security and are never indexed publicly. Only you and invited collaborators can view them, and you can delete trips anytime or request full account deletion via Contact.",
    },
  },
];

export const GuidePage: React.FC<GuidePageProps> = ({
  language,
  onBack,
  onNavigate,
  onReplayTour,
  bottomSlot,
}) => {
  const isEn = language === "en";
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaqIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <PublicPageShell
      title={isEn ? "Go Travel User Guide" : "Go Travel 使用教學"}
      subtitle={
        isEn
          ? "Five core workflows to go from flight booking to a calm, shared, offline-ready itinerary."
          : "掌握五個核心流程，從機票匯入、地圖排程、旅伴分帳到離線手冊，一氣呵成完成旅程規劃。"
      }
      language={language}
      onBack={onBack}
      onNavigate={onNavigate}
      activePath="/guide"
    >
      <div className="space-y-10">
        {/* Top Action Bar: Replay Onboarding Tour + Templates */}
        <section className="ios27-card rounded-[24px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-ns-blue/12 text-ns-blue border border-ns-blue/20 flex items-center justify-center shrink-0">
              <Play size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
                {isEn ? "Interactive 4-Step Walkthrough" : "四步驟互動式新手導覽"}
              </h2>
              <p className="text-xs sm:text-sm text-[#68707D] dark:text-[#8B93A1]">
                {isEn
                  ? "Prefer a hands-on overview? Replay the interactive tour anytime."
                  : "想在畫面中快速複習景點、地圖、分帳與匯出功能？隨時重新啟動導覽。"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              data-testid="guide-replay-tour-btn"
              onClick={onReplayTour}
              className="h-10 px-4 rounded-xl bg-ns-blue hover:bg-ns-blue/90 text-white text-xs font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play size={14} className="shrink-0" />
              <span>{isEn ? "Replay Onboarding Tour" : "重新觀看新手導覽"}</span>
            </button>
            <button
              type="button"
              data-testid="guide-to-templates-btn"
              onClick={() => onNavigate("/templates")}
              className="h-10 px-3.5 rounded-xl bg-white dark:bg-[#1B1F2A] hover:bg-[#F0F2F5] dark:hover:bg-white/[0.10] border border-black/[0.08] dark:border-white/[0.12] text-xs font-bold text-[#1A1D23] dark:text-[#ECEFF4] transition-all active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Compass size={14} className="shrink-0" />
              <span>{isEn ? "Templates" : "精選範本"}</span>
            </button>
          </div>
        </section>

        {/* 5 Core Workflows */}
        <section
          aria-label={isEn ? "Core Workflows" : "核心工作流程"}
          data-testid="guide-workflows-list"
          className="space-y-4"
        >
          {CORE_WORKFLOWS.map((workflow) => {
            const Icon = workflow.icon;
            return (
              <article
                key={workflow.step}
                data-testid={`guide-workflow-${workflow.step}`}
                className="ios27-card rounded-[24px] p-5 sm:p-6 space-y-3.5"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${workflow.tone}`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-[11px] font-bold text-[#68707D] dark:text-[#8B93A1]">
                        STEP {workflow.step}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
                      {workflow.title[language]}
                    </h3>
                    <p className="text-sm text-[#68707D] dark:text-[#8B93A1] leading-relaxed">
                      {workflow.summary[language]}
                    </p>
                  </div>
                </div>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {workflow.bullets[language].map((bullet, idx) => (
                    <li
                      key={idx}
                      className="rounded-xl bg-[#F0F2F5]/85 dark:bg-[#1B1F2A]/85 border border-black/[0.05] dark:border-white/[0.07] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[#1A1D23] dark:text-[#ECEFF4] leading-relaxed"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>

        {/* Interactive Accordion FAQ (6 items) */}
        <section data-testid="guide-faq-section" className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ns-indigo/12 text-ns-indigo border border-ns-indigo/20 flex items-center justify-center shrink-0">
              <HelpCircle size={18} />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1A1D23] dark:text-[#ECEFF4]">
              {isEn ? "Frequently Asked Questions" : "常見問題 FAQ"}
            </h2>
          </div>

          <div
            data-testid="guide-faq-list"
            className="ios27-card rounded-[24px] divide-y divide-black/[0.06] dark:divide-white/[0.08] overflow-hidden"
          >
            {FAQ_ITEMS.map((item, idx) => {
              const isExpanded = openFaqIndex === idx;
              return (
                <div key={idx} className="transition-colors">
                  <button
                    type="button"
                    data-testid={`faq-trigger-${idx}`}
                    aria-expanded={isExpanded}
                    aria-controls={`faq-panel-${idx}`}
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-5 sm:px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <span className="text-sm sm:text-base font-bold text-[#1A1D23] dark:text-[#ECEFF4] leading-snug">
                      {item.question[language]}
                    </span>
                    <ChevronDown
                      size={18}
                      className={`text-[#68707D] dark:text-[#8B93A1] shrink-0 transition-transform duration-200 ${
                        isExpanded ? "rotate-180 text-ns-blue" : ""
                      }`}
                    />
                  </button>
                  {isExpanded && (
                    <div
                      id={`faq-panel-${idx}`}
                      data-testid={`faq-panel-${idx}`}
                      className="px-5 sm:px-6 pb-5 text-sm leading-relaxed text-[#68707D] dark:text-[#8B93A1]"
                    >
                      {item.answer[language]}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Optional Bottom Slot (e.g. AdSlot injected by integrator) */}
        {bottomSlot && (
          <div data-testid="guide-bottom-slot" className="pt-2">
            {bottomSlot}
          </div>
        )}
      </div>
    </PublicPageShell>
  );
};
