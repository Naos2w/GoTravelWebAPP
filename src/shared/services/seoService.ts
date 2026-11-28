export type SeoRouteKey =
  | "landing"
  | "list"
  | "detail"
  | "guide"
  | "templates"
  | "about"
  | "privacy"
  | "terms"
  | "contact";

interface SeoMetadataEntry {
  title: string;
  description: string;
}

const SEO_METADATA: Record<SeoRouteKey, Record<"zh" | "en", SeoMetadataEntry>> = {
  landing: {
    zh: {
      title: "Go Travel — 智慧旅遊規劃與多人協作行程助手",
      description:
        "整合時間軸行程、互動地圖路線、航班登機證、多幣別 AA 分帳與離線 PWA 支援的極簡旅遊工作區。",
    },
    en: {
      title: "Go Travel — Smart Journey & Collaborative Trip Planner",
      description:
        "All-in-one minimalist travel workspace with live itineraries, interactive maps, boarding passes, AA split expenses, and offline PWA support.",
    },
  },
  list: {
    zh: {
      title: "我的旅程 | Go Travel",
      description:
        "瀏覽、搜尋與管理所有個人或多人協作旅程，一鍵建立新計畫或套用精選路線範本。",
    },
    en: {
      title: "My Trips | Go Travel",
      description:
        "Browse, search, and manage all your personal and collaborative trips, or start quickly from curated itinerary templates.",
    },
  },
  detail: {
    zh: {
      title: "行程工作區 | Go Travel",
      description:
        "查看每日時間軸、Google Maps 景點定位、航班資訊、旅伴 AA 分帳與打包清單。",
    },
    en: {
      title: "Trip Workspace | Go Travel",
      description:
        "Manage daily schedules, interactive route maps, flight details, shared AA expenses, and packing checklists in one place.",
    },
  },
  guide: {
    zh: {
      title: "使用教學與常見問題 | Go Travel",
      description:
        "5 分鐘上手 Go Travel：貼上 Google Maps 連結加景點、多人協作分帳、匯出備忘錄與日曆，以及安裝手機 PWA。",
    },
    en: {
      title: "User Guide & FAQ | Go Travel",
      description:
        "Learn how to plan trips fast in Go Travel: paste Google Maps links, collaborate with friends, split expenses, export calendars, and install the PWA.",
    },
  },
  templates: {
    zh: {
      title: "精選行程範本庫 | Go Travel",
      description:
        "東京 3 日、京阪 4 日與瑞士阿爾卑斯 5 日鐵道等完整雙語行程範本，一鍵複製並套用到你的旅程。",
    },
    en: {
      title: "Curated Trip Templates | Go Travel",
      description:
        "Explore ready-to-use Tokyo, Kyoto & Osaka, and Swiss Alps rail itineraries with realistic maps, flights, budgets, and packing lists.",
    },
  },
  about: {
    zh: {
      title: "關於我們 | Go Travel",
      description:
        "了解 Go Travel 的設計理念：以 Apple HIG 與航空儀表板美學打造的無干擾免費旅遊規劃工具。",
    },
    en: {
      title: "About Go Travel",
      description:
        "Discover Go Travel's zero-bloat philosophy and design craft built for calm, collaborative journey planning.",
    },
  },
  privacy: {
    zh: {
      title: "隱私權政策 | Go Travel",
      description:
        "說明 Go Travel 如何處理 Google 登入、Supabase 旅程資料、Cookie 同意偏好、Google Analytics 4 與 AdSense 服務。",
    },
    en: {
      title: "Privacy Policy | Go Travel",
      description:
        "Learn how Go Travel handles Google OAuth, Supabase trip storage, cookie consent preferences, Google Analytics 4, and Google AdSense.",
    },
  },
  terms: {
    zh: {
      title: "服務條款 | Go Travel",
      description:
        "Go Travel 個人旅遊規劃服務使用規範、第三方航班與地圖資料免責聲明及智慧財產權說明。",
    },
    en: {
      title: "Terms of Service | Go Travel",
      description:
        "Review Go Travel's terms of use, third-party flight, weather, and mapping data disclaimers, and intellectual property guidelines.",
    },
  },
  contact: {
    zh: {
      title: "聯絡與意見回饋 | Go Travel",
      description:
        "有功能建議或問題回報嗎？透過官方支援信箱或 GitHub Issues 聯繫 Go Travel 團隊。",
    },
    en: {
      title: "Contact & Support | Go Travel",
      description:
        "Reach the Go Travel team for feature suggestions, bug reports, or privacy inquiries via email or GitHub.",
    },
  },
};

/**
 * Updates `document.title` and `<meta name="description">` for the active route and language.
 */
export const applyPageSeo = (
  route: SeoRouteKey,
  language: "zh" | "en",
  customTitle?: string
): void => {
  if (typeof document === "undefined") return;

  const entry = SEO_METADATA[route] ?? SEO_METADATA.landing;
  const localized = entry[language] ?? entry.zh;

  const trimmedCustomTitle = customTitle?.trim();
  const nextTitle = trimmedCustomTitle
    ? trimmedCustomTitle.includes("Go Travel")
      ? trimmedCustomTitle
      : `${trimmedCustomTitle} | Go Travel`
    : localized.title;

  document.title = nextTitle;

  let metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!metaDesc) {
    metaDesc = document.createElement("meta");
    metaDesc.setAttribute("name", "description");
    document.head?.appendChild(metaDesc);
  }
  metaDesc.setAttribute("content", localized.description);
};
