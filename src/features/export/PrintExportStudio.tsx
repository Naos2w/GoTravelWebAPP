import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X as CloseIcon,
  Printer,
  Map as MapIcon,
  CalendarCheck,
  FileText,
  Calendar,
  CalendarPlus,
  Copy,
  Check,
  ChevronRight,
  Info,
  Download,
  Share2,
  BookOpen,
  Navigation,
  MapPin,
  CheckSquare,
  ExternalLink,
  Sun,
  Moon,
  Plane,
} from "lucide-react";
import { FlightSegment, Trip } from "../../types";
import { useTranslation } from "../../shared/contexts/LocalizationContext";
import {
  exportToAppleNotes,
  downloadICalendar,
  generateTripNotesMarkdown,
} from "../trips/services/exportService";
import {
  PrintableCardType,
  renderPrintableCanvas,
  renderPrintableCanvasAsync,
  canvasToDataUrl,
  shareOrDownloadCanvas,
} from "./services/canvasExportService";
import {
  buildGoogleMapsDayRouteSegments,
  downloadTripKml,
} from "./services/mapExportService";
import {
  buildGoogleCalendarFlightUrl,
  downloadChecklistVtodoIcs,
  shareChecklistToNotes,
} from "./services/calendarChecklistExportService";
import { openPrintableTravelBooklet } from "./services/printBookletService";

export type StudioTab = "images" | "maps" | "sync";

export interface PrintExportStudioProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string, type: "success" | "error" | "info") => void;
  initialTab?: StudioTab;
}

const CARD_META: Array<{
  type: PrintableCardType;
  emoji: string;
  labelKey:
    | "exportStudioCardReceipt"
    | "exportStudioCardBoardingPass"
    | "exportStudioCardLockscreen"
    | "exportStudioCardStory";
  descKey:
    | "exportStudioCardReceiptDesc"
    | "exportStudioCardBoardingPassDesc"
    | "exportStudioCardLockscreenDesc"
    | "exportStudioCardStoryDesc";
  ratioBadge: string;
}> = [
  {
    type: "receipt",
    emoji: "🧾",
    labelKey: "exportStudioCardReceipt",
    descKey: "exportStudioCardReceiptDesc",
    ratioBadge: "760px",
  },
  {
    type: "boarding-pass",
    emoji: "🎫",
    labelKey: "exportStudioCardBoardingPass",
    descKey: "exportStudioCardBoardingPassDesc",
    ratioBadge: "1080×1350",
  },
  {
    type: "lockscreen",
    emoji: "📱",
    labelKey: "exportStudioCardLockscreen",
    descKey: "exportStudioCardLockscreenDesc",
    ratioBadge: "9:19.5",
  },
  {
    type: "story",
    emoji: "📸",
    labelKey: "exportStudioCardStory",
    descKey: "exportStudioCardStoryDesc",
    ratioBadge: "9:16",
  },
];

const formatShortDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
  return dateStr;
};

const formatFlightTime = (iso?: string): string => {
  if (!iso) return "--:--";
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : iso.slice(0, 16);
};

export const PrintExportStudio: React.FC<PrintExportStudioProps> = ({
  trip,
  isOpen,
  onClose,
  onNotify,
  initialTab = "images",
}) => {
  const { t, language } = useTranslation();

  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);
  const [selectedCard, setSelectedCard] =
    useState<PrintableCardType>("receipt");
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [selectedFlightIdx, setSelectedFlightIdx] = useState<number>(0);
  const [selectedMapDayIdx, setSelectedMapDayIdx] = useState<number>(0);
  const [canvasTheme, setCanvasTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  );

  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);
  const [pngExportDone, setPngExportDone] = useState<boolean>(false);

  const [copied, setCopied] = useState<boolean>(false);
  const [isExportingNotes, setIsExportingNotes] = useState<boolean>(false);
  const [isSharingChecklist, setIsSharingChecklist] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const itinerary = trip.itinerary || [];
  const flights = trip.flights || [];
  const checklist = trip.checklist || [];

  // Clamp indices if trip data changes
  const safeDayIdx =
    itinerary.length > 0 ? Math.min(selectedDayIdx, itinerary.length - 1) : 0;
  const safeMapDayIdx =
    itinerary.length > 0
      ? Math.min(selectedMapDayIdx, itinerary.length - 1)
      : 0;
  const safeFlightIdx =
    flights.length > 0 ? Math.min(selectedFlightIdx, flights.length - 1) : 0;

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Render live canvas preview when on Image Printer tab
  useEffect(() => {
    if (!isOpen || activeTab !== "images") return;
    let cancelled = false;
    const renderOptions = {
      trip,
      lang: language,
      dayIndex: safeDayIdx,
      flightIndex: safeFlightIdx,
      theme: canvasTheme,
    };

    try {
      const canvas = renderPrintableCanvas(selectedCard, renderOptions);
      canvasRef.current = canvas;
      const url = canvasToDataUrl(canvas);
      setPreviewUrl(url);
    } catch {
      canvasRef.current = null;
      setPreviewUrl("");
    }

    if (selectedCard === "boarding-pass") {
      renderPrintableCanvasAsync("boarding-pass", renderOptions)
        .then((upgradedCanvas) => {
          if (cancelled) return;
          canvasRef.current = upgradedCanvas;
          const upgradedUrl = canvasToDataUrl(upgradedCanvas);
          setPreviewUrl(upgradedUrl);
        })
        .catch(() => {
          // Keep synchronous preview silently if logo upgrade fails
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    activeTab,
    selectedCard,
    trip,
    language,
    safeDayIdx,
    safeFlightIdx,
    canvasTheme,
  ]);

  const totalStops = useMemo(
    () => itinerary.reduce((acc, day) => acc + (day.items?.length || 0), 0),
    [itinerary]
  );

  const completedChecklistCount = useMemo(
    () => checklist.filter((c) => c.isCompleted).length,
    [checklist]
  );

  const selectedMapDay = itinerary[safeMapDayIdx];
  const dayRouteSegments = useMemo(() => {
    if (!selectedMapDay) return [];
    try {
      return buildGoogleMapsDayRouteSegments(selectedMapDay);
    } catch {
      return [];
    }
  }, [selectedMapDay]);

  const flightSegments = useMemo(() => {
    const list: Array<{
      key: string;
      direction: "outbound" | "inbound";
      traveler: string;
      segment: FlightSegment;
      gcalUrl: string;
    }> = [];
    flights.forEach((f, idx) => {
      if (f.outbound) {
        list.push({
          key: `${f.id || idx}-out`,
          direction: "outbound",
          traveler: f.traveler_name || "",
          segment: f.outbound,
          gcalUrl: buildGoogleCalendarFlightUrl(f.outbound, trip.name),
        });
      }
      if (f.inbound && (f.inbound.flightNumber || f.inbound.departureAirport)) {
        list.push({
          key: `${f.id || idx}-in`,
          direction: "inbound",
          traveler: f.traveler_name || "",
          segment: f.inbound,
          gcalUrl: buildGoogleCalendarFlightUrl(f.inbound, trip.name),
        });
      }
    });
    return list;
  }, [flights, trip.name]);

  if (!isOpen) return null;

  const activeCardMeta =
    CARD_META.find((c) => c.type === selectedCard) || CARD_META[0];

  // Handlers — Tab 1: Image Printer
  const handleShareOrSavePng = async () => {
    setIsExportingPng(true);
    try {
      const canvas = await renderPrintableCanvasAsync(selectedCard, {
        trip,
        lang: language,
        dayIndex: safeDayIdx,
        flightIndex: safeFlightIdx,
        theme: canvasTheme,
      });
      canvasRef.current = canvas;
      const safeName = (trip.name || "gotravel")
        .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
        .slice(0, 40);
      const daySuffix =
        selectedCard === "lockscreen" || selectedCard === "story"
          ? `-day${safeDayIdx + 1}`
          : "";
      const filename = `${safeName}-${selectedCard}${daySuffix}.png`;
      const title = `${trip.name || "Go Travel"} · ${t(activeCardMeta.labelKey)}`;

      const method = await shareOrDownloadCanvas(canvas, filename, title);
      setPngExportDone(true);
      setTimeout(() => setPngExportDone(false), 2200);
      onNotify?.(
        method === "shared"
          ? t("exportStudioPngShared")
          : t("exportStudioPngDownloaded"),
        "success"
      );
    } catch {
      onNotify?.(t("exportStudioPngError"), "error");
    } finally {
      setIsExportingPng(false);
    }
  };

  // Handlers — Tab 2: Maps & PDF
  const handlePrintBooklet = () => {
    try {
      const ok = openPrintableTravelBooklet(trip, language);
      if (ok) {
        onNotify?.(t("exportStudioBookletOpened"), "success");
      } else {
        onNotify?.(t("exportStudioBookletBlocked"), "error");
      }
    } catch {
      onNotify?.(t("exportStudioBookletBlocked"), "error");
    }
  };

  const handleDownloadKml = () => {
    try {
      downloadTripKml(trip, language);
      onNotify?.(t("exportStudioKmlDownloaded"), "success");
    } catch {
      onNotify?.(t("exportStudioExportError"), "error");
    }
  };

  // Handlers — Tab 3: Calendar & Notes
  const handleExportNotes = async () => {
    setIsExportingNotes(true);
    try {
      const res = await exportToAppleNotes(trip);
      if (res.success) {
        if (res.method === "share") {
          onNotify?.(t("exportStudioNotesShared"), "success");
        } else {
          onNotify?.(t("exportStudioNotesCopied"), "success");
        }
      } else {
        onNotify?.(t("exportStudioNotesCopiedFallback"), "info");
      }
    } catch {
      onNotify?.(t("exportStudioExportError"), "error");
    } finally {
      setIsExportingNotes(false);
    }
  };

  const handleDownloadCalendar = () => {
    try {
      downloadICalendar(trip);
      onNotify?.(t("exportStudioIcsDownloaded"), "success");
    } catch {
      onNotify?.(t("exportStudioIcsError"), "error");
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = generateTripNotesMarkdown(trip);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      onNotify?.(t("exportStudioMdCopied"), "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify?.(t("exportStudioCopyError"), "error");
    }
  };

  const handleShareChecklist = async () => {
    setIsSharingChecklist(true);
    try {
      const method = await shareChecklistToNotes(trip, language);
      onNotify?.(
        method === "shared"
          ? t("exportStudioChecklistShared")
          : t("exportStudioChecklistCopied"),
        "success"
      );
    } catch {
      onNotify?.(t("exportStudioCopyError"), "error");
    } finally {
      setIsSharingChecklist(false);
    }
  };

  const handleDownloadChecklistVtodo = () => {
    try {
      downloadChecklistVtodoIcs(trip, language);
      onNotify?.(t("exportStudioChecklistVtodoDownloaded"), "success");
    } catch {
      onNotify?.(t("exportStudioIcsError"), "error");
    }
  };

  const tabs: Array<{
    id: StudioTab;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "images",
      label: t("exportStudioTabImages"),
      icon: <Printer size={14} className="hidden sm:inline-block shrink-0" />,
    },
    {
      id: "maps",
      label: t("exportStudioTabMaps"),
      icon: <MapIcon size={14} className="hidden sm:inline-block shrink-0" />,
    },
    {
      id: "sync",
      label: t("exportStudioTabSync"),
      icon: (
        <CalendarCheck size={14} className="hidden sm:inline-block shrink-0" />
      ),
    },
  ];

  const modalContent = (
    <div
      data-testid="print-export-studio-backdrop"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-[#F5F5F7]/90 dark:bg-[#060709]/85 backdrop-blur-2xl p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-export-studio-title"
        className="w-full sm:max-w-2xl bg-white/95 dark:bg-[#121318]/95 backdrop-blur-3xl rounded-t-[36px] sm:rounded-[36px] shadow-2xl border border-black/[0.06] dark:border-white/[0.12] flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom-8 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Top Chrome */}
        <div className="p-5 sm:p-6 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] shrink-0">
          {/* iOS Grabber Handle */}
          <div className="w-12 h-1.5 rounded-full bg-slate-300/80 dark:bg-white/20 mx-auto mb-3 sm:hidden" />

          {/* Header Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/15">
                <Share2 size={20} />
              </div>
              <div className="min-w-0">
                <h3
                  id="print-export-studio-title"
                  className="text-lg font-black text-slate-900 dark:text-white tracking-tight truncate"
                >
                  {t("exportStudioTitle")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate tabular-nums">
                  {trip.name} • {totalStops} {t("placesCount")} •{" "}
                  {flights.length} {t("FlightTickets")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 bg-black/[0.04] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/[0.06] dark:border-white/[0.10] transition-all active:scale-95 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* 3-Tab Apple Segmented Control */}
          <div
            role="tablist"
            aria-label={t("exportStudioTitle")}
            className="mt-4 p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07] border border-black/[0.04] dark:border-white/[0.08] grid grid-cols-3 gap-1"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  data-testid={`studio-tab-${tab.id}`}
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`h-9 px-2 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-all active:scale-95 cursor-pointer ${
                    isActive
                      ? "bg-white dark:bg-[#1E212B] text-slate-900 dark:text-white shadow-sm border border-black/[0.06] dark:border-white/[0.12]"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent"
                  }`}
                >
                  {tab.icon}
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar">
          {/* TAB 1: IMAGE PRINTER */}
          {activeTab === "images" && (
            <div
              role="tabpanel"
              data-testid="studio-panel-images"
              className="space-y-4"
            >
              {/* 4 Visual Card Selectors */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {CARD_META.map((card) => {
                  const isSelected = selectedCard === card.type;
                  return (
                    <button
                      key={card.type}
                      type="button"
                      data-testid={`card-selector-${card.type}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedCard(card.type)}
                      className={`p-3 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? "bg-primary/10 dark:bg-primary/20 border-primary/50 shadow-sm ring-1 ring-primary/30"
                          : "bg-slate-50/80 dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.08] hover:bg-slate-100/80 dark:hover:bg-white/[0.07]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xl leading-none" aria-hidden="true">
                          {card.emoji}
                        </span>
                        <span className="text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.08] text-slate-500 dark:text-slate-300 whitespace-nowrap shrink-0">
                          {card.ratioBadge}
                        </span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white whitespace-nowrap truncate">
                        {t(card.labelKey)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Contextual Controls Row (Day / Flight Selector + Card Theme) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {(selectedCard === "lockscreen" || selectedCard === "story") &&
                itinerary.length > 0 ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                      {t("exportStudioSelectDay")}
                    </span>
                    <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar gap-1.5 py-0.5">
                      {itinerary.map((day, idx) => {
                        const isPicked = safeDayIdx === idx;
                        return (
                          <button
                            key={day.date || idx}
                            type="button"
                            data-testid={`image-day-pill-${idx}`}
                            onClick={() => setSelectedDayIdx(idx)}
                            className={`h-8 px-3 rounded-full text-xs font-bold tabular-nums whitespace-nowrap shrink-0 transition-all active:scale-95 cursor-pointer border ${
                              isPicked
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                                : "bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border-black/[0.08] dark:border-white/[0.10] hover:border-primary/40"
                            }`}
                          >
                            Day {idx + 1}
                            {day.date ? ` · ${formatShortDate(day.date)}` : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : selectedCard === "boarding-pass" && flights.length > 1 ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                      {t("exportStudioSelectFlight")}
                    </span>
                    <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar gap-1.5 py-0.5">
                      {flights.map((f, idx) => {
                        const isPicked = safeFlightIdx === idx;
                        return (
                          <button
                            key={f.id || idx}
                            type="button"
                            onClick={() => setSelectedFlightIdx(idx)}
                            className={`h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all active:scale-95 cursor-pointer border ${
                              isPicked
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                                : "bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border-black/[0.08] dark:border-white/[0.10]"
                            }`}
                          >
                            {f.traveler_name || `#${idx + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {t(activeCardMeta.descKey)}
                  </p>
                )}

                {selectedCard !== "receipt" && (
                  <div className="inline-flex items-center p-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.10] self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setCanvasTheme("light")}
                      className={`h-7 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        canvasTheme === "light"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <Sun size={12} className="shrink-0" />
                      {t("exportStudioThemeLight")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCanvasTheme("dark")}
                      className={`h-7 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                        canvasTheme === "dark"
                          ? "bg-slate-900 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      <Moon size={12} className="shrink-0" />
                      {t("exportStudioThemeDark")}
                    </button>
                  </div>
                )}
              </div>

              {/* Live Canvas Preview Box */}
              <div className="rounded-3xl bg-slate-100/80 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.10] p-4 sm:p-5 flex flex-col items-center justify-center min-h-[240px] sm:min-h-[280px]">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={`${trip.name} ${t(activeCardMeta.labelKey)}`}
                    data-testid="canvas-preview-img"
                    className="max-h-[340px] w-auto rounded-2xl shadow-xl border border-black/[0.08] dark:border-white/[0.14] object-contain"
                  />
                ) : (
                  <div
                    data-testid="canvas-fallback-preview"
                    className="w-full max-w-xs rounded-2xl p-5 bg-white/90 dark:bg-[#181B24]/90 border border-black/[0.06] dark:border-white/[0.12] shadow-lg text-center space-y-2.5"
                  >
                    <div className="text-4xl" aria-hidden="true">
                      {activeCardMeta.emoji}
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {t(activeCardMeta.labelKey)}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {trip.name}
                      {(selectedCard === "lockscreen" ||
                        selectedCard === "story") &&
                      itinerary[safeDayIdx]
                        ? ` · Day ${safeDayIdx + 1} (${itinerary[safeDayIdx].date})`
                        : ""}
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold tabular-nums">
                      <span>{t("exportStudioPreviewReady")}</span>
                      <span>•</span>
                      <span>{activeCardMeta.ratioBadge}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary CTA Button */}
              <button
                type="button"
                data-testid="share-save-png-btn"
                onClick={handleShareOrSavePng}
                disabled={isExportingPng}
                className="w-full h-12 px-5 rounded-2xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                {pngExportDone ? (
                  <Check size={18} className="shrink-0" />
                ) : (
                  <Download size={18} className="shrink-0" />
                )}
                <span>
                  {isExportingPng
                    ? t("exportStudioSharingPng")
                    : t("exportStudioShareSavePng")}
                </span>
              </button>
            </div>
          )}

          {/* TAB 2: MAPS & PDF */}
          {activeTab === "maps" && (
            <div
              role="tabpanel"
              data-testid="studio-panel-maps"
              className="space-y-4"
            >
              {/* Card 1: Printable Travel Booklet PDF */}
              <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/55 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0">
                    <BookOpen size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {t("exportStudioBookletTitle")}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {t("exportStudioBookletDesc")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="print-booklet-btn"
                  onClick={handlePrintBooklet}
                  className="w-full h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer size={15} className="shrink-0" />
                  <span>{t("exportStudioBookletBtn")}</span>
                </button>
              </div>

              {/* Card 2: Daily Google Maps Multi-Stop Route */}
              <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/55 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-3.5">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
                    <Navigation size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {t("exportStudioMapsRouteTitle")}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {t("exportStudioMapsRouteDesc")}
                    </p>
                  </div>
                </div>

                {itinerary.length > 0 ? (
                  <div className="flex flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar gap-1.5 py-0.5">
                    {itinerary.map((day, idx) => {
                      const isPicked = safeMapDayIdx === idx;
                      const stopsCount = (day.items || []).filter(
                        (item) => item.type !== "Transport"
                      ).length;
                      return (
                        <button
                          key={day.date || idx}
                          type="button"
                          data-testid={`map-day-pill-${idx}`}
                          onClick={() => setSelectedMapDayIdx(idx)}
                          className={`h-8 px-3 rounded-full text-xs font-bold tabular-nums whitespace-nowrap shrink-0 transition-all active:scale-95 cursor-pointer border ${
                            isPicked
                              ? "bg-emerald-600 text-white border-transparent shadow-sm"
                              : "bg-white/90 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-emerald-200/70 dark:border-white/[0.10] hover:border-emerald-400"
                          }`}
                        >
                          Day {idx + 1} ({stopsCount}{" "}
                          {t("exportStudioStopsUnit")})
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("exportStudioNoDays")}
                  </p>
                )}

                {dayRouteSegments.length === 1 ? (
                  <a
                    href={dayRouteSegments[0].url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="gmaps-day-route-link"
                    className="w-full h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Navigation size={15} className="shrink-0" />
                    <span>{t("exportStudioMapsRouteBtn")}</span>
                    <ExternalLink size={13} className="shrink-0 opacity-80" />
                  </a>
                ) : dayRouteSegments.length > 1 ? (
                  <div className="space-y-2.5">
                    <div
                      data-testid="gmaps-chunk-notice"
                      className="px-3 py-2 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 text-amber-800 dark:text-amber-200 text-[11px] font-bold leading-relaxed flex items-start gap-2"
                    >
                      <Info size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-300" />
                      <span>
                        {t("exportStudioGmapsChunkNotice").replace(
                          "{count}",
                          String(dayRouteSegments.length)
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {dayRouteSegments.map((seg) => (
                        <a
                          key={seg.index}
                          href={seg.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`gmaps-day-route-segment-${seg.index}`}
                          className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                        >
                          <Navigation size={14} className="shrink-0" />
                          <span>
                            {t("exportStudioGmapsLegLabel")
                              .replace("{index}", String(seg.index))
                              .replace("{from}", String(seg.fromStop))
                              .replace("{to}", String(seg.toStop))}
                          </span>
                          <ExternalLink size={12} className="shrink-0 opacity-80" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      disabled
                      data-testid="gmaps-day-route-disabled"
                      className="w-full h-10 px-4 rounded-xl bg-slate-200/80 dark:bg-white/[0.08] text-slate-400 dark:text-slate-500 text-xs font-black flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-not-allowed"
                    >
                      <Navigation size={15} className="shrink-0" />
                      <span>{t("exportStudioMapsRouteBtn")}</span>
                    </button>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 text-center">
                      {t("exportStudioNoStopsForRoute")}
                    </p>
                  </div>
                )}
              </div>

              {/* Card 3: Export Full Trip .kml (Google My Maps) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/55 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 shrink-0">
                    <MapPin size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">
                      {t("exportStudioKmlTitle")}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {t("exportStudioKmlDesc")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="download-kml-btn"
                  onClick={handleDownloadKml}
                  className="w-full h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-sky-500/20 active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download size={15} className="shrink-0" />
                  <span>{t("exportStudioKmlBtn")}</span>
                </button>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-1.5">
                  <Info size={13} className="text-sky-500 shrink-0 mt-0.5" />
                  <span>{t("exportStudioKmlTip")}</span>
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: CALENDAR & NOTES */}
          {activeTab === "sync" && (
            <div
              role="tabpanel"
              data-testid="studio-panel-sync"
              className="space-y-4"
            >
              {/* Classic Exports: Apple Notes, .ics, Markdown */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  data-testid="export-apple-notes-btn"
                  onClick={handleExportNotes}
                  disabled={isExportingNotes}
                  className="w-full text-left p-4 rounded-2xl bg-amber-50/55 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 transition-all group active:scale-[0.98] flex items-center gap-3.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                    <FileText size={21} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {t("exportStudioAppleNotesTitle")}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200/70 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 whitespace-nowrap shrink-0">
                        {t("exportStudioRecommended")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {t("exportStudioAppleNotesDesc")}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-amber-500 group-hover:translate-x-0.5 transition-transform shrink-0"
                  />
                </button>

                <button
                  type="button"
                  data-testid="export-ics-btn"
                  onClick={handleDownloadCalendar}
                  className="w-full text-left p-4 rounded-2xl bg-red-50/55 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 transition-all group active:scale-[0.98] flex items-center gap-3.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/25 shrink-0">
                    <Calendar size={21} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {t("exportStudioIcsTitle")}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-200/70 dark:bg-red-900/60 text-red-800 dark:text-red-200 whitespace-nowrap shrink-0">
                        .ics
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {t("exportStudioIcsDesc")}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-red-500 group-hover:translate-x-0.5 transition-transform shrink-0"
                  />
                </button>

                <button
                  type="button"
                  data-testid="copy-markdown-btn"
                  onClick={handleCopyMarkdown}
                  className="w-full text-left p-4 rounded-2xl bg-blue-50/55 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 transition-all group active:scale-[0.98] flex items-center gap-3.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                    {copied ? <Check size={21} /> : <Copy size={21} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-black text-slate-900 dark:text-white block truncate">
                      {copied
                        ? t("exportStudioCopyMdDone")
                        : t("exportStudioCopyMdTitle")}
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {t("exportStudioCopyMdDesc")}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-blue-500 group-hover:translate-x-0.5 transition-transform shrink-0"
                  />
                </button>
              </div>

              {/* Section: 1-Tap Flight to Google Calendar */}
              <div className="p-4 rounded-2xl bg-slate-50/85 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CalendarPlus size={16} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {t("exportStudioGcalFlightsTitle")}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {t("exportStudioGcalFlightsDesc")}
                    </p>
                  </div>
                </div>

                {flightSegments.length > 0 ? (
                  <div className="space-y-2">
                    {flightSegments.map((entry) => (
                      <div
                        key={entry.key}
                        className="p-3 rounded-xl bg-white dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                            <Plane
                              size={12}
                              className="text-primary shrink-0"
                            />
                            <span className="px-1.5 py-0.5 rounded-md bg-black/[0.05] dark:bg-white/[0.10] text-[10px] font-bold whitespace-nowrap shrink-0">
                              {entry.direction === "outbound"
                                ? t("outbound")
                                : t("inbound")}
                            </span>
                            <span className="font-mono tabular-nums truncate">
                              {entry.segment.flightNumber ||
                                entry.segment.airline}{" "}
                              · {entry.segment.departureAirport} →{" "}
                              {entry.segment.arrivalAirport}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums truncate mt-0.5">
                            {entry.traveler ? `${entry.traveler} • ` : ""}
                            {entry.segment.departureTime
                              ? `${entry.segment.departureTime.split("T")[0]} ${formatFlightTime(entry.segment.departureTime)}`
                              : ""}
                          </div>
                        </div>

                        <a
                          href={entry.gcalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`gcal-flight-link-${entry.key}`}
                          aria-label={t("exportStudioAddFlightToGcal")}
                          title={t("exportStudioAddFlightToGcal")}
                          className="h-9 px-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                        >
                          <CalendarPlus size={13} className="shrink-0" />
                          <span>{t("exportStudioAddToGcalShort")}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium py-1">
                    {t("noFlights")}
                  </p>
                )}
              </div>

              {/* Section: Standalone Checklist Sync */}
              <div className="p-4 rounded-2xl bg-slate-50/85 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                      <CheckSquare size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {t("exportStudioChecklistSyncTitle")}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {t("exportStudioChecklistSyncDesc")}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                    {completedChecklistCount}/{checklist.length}{" "}
                    {t("exportStudioItemsDone")}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    data-testid="share-checklist-notes-btn"
                    onClick={handleShareChecklist}
                    disabled={isSharingChecklist}
                    className="h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.07] hover:bg-violet-50 dark:hover:bg-violet-950/30 border border-black/[0.08] dark:border-white/[0.12] text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                  >
                    <Share2 size={14} className="text-violet-500 shrink-0" />
                    <span className="truncate">
                      {t("exportStudioChecklistKeepBtn")}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="download-checklist-vtodo-btn"
                    onClick={handleDownloadChecklistVtodo}
                    className="h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.07] hover:bg-violet-50 dark:hover:bg-violet-950/30 border border-black/[0.08] dark:border-white/[0.12] text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                  >
                    <Download size={14} className="text-violet-500 shrink-0" />
                    <span className="truncate">
                      {t("exportStudioChecklistVtodoBtn")}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tip banner */}
              <div className="p-3.5 rounded-2xl bg-slate-100/75 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex items-start gap-2.5">
                <Info size={15} className="text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {t("exportStudioIosTipLabel")}
                  </span>{" "}
                  {t("exportStudioIosTipBody")}
                </p>
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
