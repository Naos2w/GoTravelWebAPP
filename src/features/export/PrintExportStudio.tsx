import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  CheckCircle2,
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
  ArrowLeft,
  FastForward,
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

export const PRINT_ANIMATION_MS = 1500;

type PrintStagePhase = "idle" | "preparing" | "printing" | "done";

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const PRINT_KEYFRAMES = `
@keyframes studio-sheet-feed {
  0% { opacity: 0.3; transform: translateY(-102%); }
  16% { opacity: 1; }
  82% { opacity: 1; transform: translateY(2%); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes studio-print-progress {
  0% { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}
.studio-sheet-feed {
  animation: studio-sheet-feed var(--studio-print-ms, 1500ms) cubic-bezier(0.22, 1, 0.36, 1) both;
}
.studio-print-progress {
  transform-origin: left;
  animation: studio-print-progress var(--studio-print-ms, 1500ms) linear both;
}
@media (prefers-reduced-motion: reduce) {
  .studio-sheet-feed,
  .studio-print-progress {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
`;

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

  const [printPhase, setPrintPhase] = useState<PrintStagePhase>("idle");
  const [printedImageUrl, setPrintedImageUrl] = useState<string>("");
  const [isSavingPng, setIsSavingPng] = useState<boolean>(false);

  const [copied, setCopied] = useState<boolean>(false);
  const [isExportingNotes, setIsExportingNotes] = useState<boolean>(false);
  const [isSharingChecklist, setIsSharingChecklist] = useState<boolean>(false);

  const printPayloadRef = useRef<{
    canvas: HTMLCanvasElement;
    filename: string;
    title: string;
  } | null>(null);
  const printTimerRef = useRef<number | null>(null);
  const printRunIdRef = useRef<number>(0);
  const hasAutoSavedRef = useRef<boolean>(false);

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

  const clearPrintTimer = useCallback(() => {
    if (printTimerRef.current !== null) {
      window.clearTimeout(printTimerRef.current);
      printTimerRef.current = null;
    }
  }, []);

  const resetPrintStage = useCallback(() => {
    printRunIdRef.current += 1;
    clearPrintTimer();
    hasAutoSavedRef.current = false;
    printPayloadRef.current = null;
    setPrintPhase("idle");
    setPrintedImageUrl("");
    setIsSavingPng(false);
  }, [clearPrintTimer]);

  // Clean up pending timers and invalidate in-flight prints on unmount
  useEffect(() => {
    return () => {
      printRunIdRef.current += 1;
      clearPrintTimer();
    };
  }, [clearPrintTimer]);

  // Reset print stage whenever modal closes or user switches away from Image Printer tab
  useEffect(() => {
    if (!isOpen || activeTab !== "images") {
      resetPrintStage();
    }
  }, [isOpen, activeTab, resetPrintStage]);

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

  // Handlers — Tab 1: Image Printer (Direct Print-Animation-Then-Save Flow)
  const triggerSavePrintedCanvas = async (runId: number) => {
    const payload = printPayloadRef.current;
    if (!payload || runId !== printRunIdRef.current) return;
    setIsSavingPng(true);
    try {
      const method = await shareOrDownloadCanvas(
        payload.canvas,
        payload.filename,
        payload.title
      );
      if (runId !== printRunIdRef.current) return;
      onNotify?.(
        method === "shared"
          ? t("exportStudioPngShared")
          : t("exportStudioPngDownloaded"),
        "success"
      );
    } catch {
      if (runId !== printRunIdRef.current) return;
      onNotify?.(t("exportStudioPngError"), "error");
    } finally {
      if (runId === printRunIdRef.current) {
        setIsSavingPng(false);
      }
    }
  };

  const finishPrintAnimation = (runId: number) => {
    if (runId !== printRunIdRef.current || hasAutoSavedRef.current) return;
    hasAutoSavedRef.current = true;
    clearPrintTimer();
    setPrintPhase("done");
    void triggerSavePrintedCanvas(runId);
  };

  const handleStartPrint = async () => {
    const runId = printRunIdRef.current + 1;
    printRunIdRef.current = runId;
    clearPrintTimer();
    hasAutoSavedRef.current = false;
    printPayloadRef.current = null;
    setPrintedImageUrl("");
    setPrintPhase("preparing");

    try {
      const canvas = await renderPrintableCanvasAsync(selectedCard, {
        trip,
        lang: language,
        dayIndex: safeDayIdx,
        flightIndex: safeFlightIdx,
        theme: canvasTheme,
      });
      if (runId !== printRunIdRef.current) return;

      const safeName = (trip.name || "gotravel")
        .replace(/[^\w\u4e00-\u9fff-]+/g, "-")
        .slice(0, 40);
      const daySuffix =
        selectedCard === "lockscreen" || selectedCard === "story"
          ? `-day${safeDayIdx + 1}`
          : "";
      const filename = `${safeName}-${selectedCard}${daySuffix}.png`;
      const title = `${trip.name || "Go Travel"} · ${t(activeCardMeta.labelKey)}`;

      printPayloadRef.current = { canvas, filename, title };
      setPrintedImageUrl(canvasToDataUrl(canvas));

      if (prefersReducedMotion()) {
        finishPrintAnimation(runId);
        return;
      }

      setPrintPhase("printing");
      printTimerRef.current = window.setTimeout(() => {
        finishPrintAnimation(runId);
      }, PRINT_ANIMATION_MS);
    } catch {
      if (runId !== printRunIdRef.current) return;
      setPrintPhase("idle");
      onNotify?.(t("exportStudioPngError"), "error");
    }
  };

  const handleSkipPrint = () => {
    finishPrintAnimation(printRunIdRef.current);
  };

  const handleSaveAgain = () => {
    void triggerSavePrintedCanvas(printRunIdRef.current);
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
              {printPhase === "printing" || printPhase === "done" ? (
                <div
                  data-testid="print-animation-stage"
                  className="rounded-3xl bg-slate-100/80 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.10] p-4 sm:p-6 flex flex-col items-center gap-4"
                  style={{
                    ["--studio-print-ms" as string]: `${PRINT_ANIMATION_MS}ms`,
                  }}
                >
                  <style>{PRINT_KEYFRAMES}</style>

                  {/* Status Pill */}
                  <div
                    data-testid="print-stage-status"
                    aria-live="polite"
                    className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black tracking-wide border transition-colors ${
                      printPhase === "done"
                        ? "bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-400/25"
                        : "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20 dark:border-primary/30"
                    }`}
                  >
                    {printPhase === "done" ? (
                      <CheckCircle2 size={14} className="shrink-0" />
                    ) : (
                      <Printer size={14} className="shrink-0" />
                    )}
                    <span className="whitespace-nowrap">
                      {printPhase === "done"
                        ? t("exportStudioPrintDone")
                        : t("exportStudioPrinting")}
                    </span>
                  </div>

                  {/* Brushed-Metal Printer Slot + Animated Paper Chute */}
                  <div className="w-full flex flex-col items-center">
                    <div
                      aria-hidden="true"
                      className="relative z-10 h-3.5 w-full max-w-[340px] rounded-full border shadow-inner bg-gradient-to-r from-slate-200 via-white to-slate-200 border-slate-300/80 dark:from-slate-800 dark:via-slate-600 dark:to-slate-800 dark:border-white/20"
                    >
                      <div className="absolute inset-x-3 bottom-0.5 h-1 rounded-full bg-black/75" />
                    </div>

                    <div className="w-full overflow-hidden -mt-1.5 pt-2.5 pb-2 px-2 flex justify-center">
                      <div className="studio-sheet-feed flex justify-center w-full">
                        {printedImageUrl ? (
                          <img
                            src={printedImageUrl}
                            alt={`${trip.name} ${t(activeCardMeta.labelKey)}`}
                            data-testid="printed-card-img"
                            className="max-h-[300px] sm:max-h-[340px] w-auto rounded-2xl shadow-ios-lg border border-black/[0.08] dark:border-white/[0.14] object-contain"
                          />
                        ) : (
                          <div
                            data-testid="printed-card-fallback"
                            className="w-full max-w-xs rounded-2xl p-5 bg-white dark:bg-[#181B24] border border-black/[0.06] dark:border-white/[0.12] shadow-ios-md text-center space-y-2"
                          >
                            <div className="text-3xl" aria-hidden="true">
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
                                ? ` · Day ${safeDayIdx + 1}`
                                : ""}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stage Footer Controls */}
                  {printPhase === "printing" ? (
                    <div className="w-full max-w-sm space-y-3">
                      <div
                        className="h-1 rounded-full bg-slate-200 dark:bg-white/15 overflow-hidden"
                        aria-hidden="true"
                      >
                        <div className="studio-print-progress h-full w-full rounded-full bg-primary" />
                      </div>
                      <button
                        type="button"
                        data-testid="print-skip-btn"
                        onClick={handleSkipPrint}
                        className="w-full h-10 px-4 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-100/80 dark:hover:bg-white/[0.12] border border-black/[0.08] dark:border-white/[0.12] text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <FastForward size={14} className="shrink-0 text-primary" />
                        <span>{t("exportStudioSkipPrint")}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        data-testid="print-save-again-btn"
                        onClick={handleSaveAgain}
                        disabled={isSavingPng}
                        className="h-11 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                      >
                        <Download size={15} className="shrink-0" />
                        <span>{t("exportStudioSaveAgain")}</span>
                      </button>
                      <button
                        type="button"
                        data-testid="print-back-btn"
                        onClick={resetPrintStage}
                        className="h-11 px-4 rounded-2xl bg-white dark:bg-white/[0.08] hover:bg-slate-100/80 dark:hover:bg-white/[0.12] border border-black/[0.08] dark:border-white/[0.12] text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ArrowLeft size={15} className="shrink-0" />
                        <span>{t("exportStudioBackToOptions")}</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* 4 Crisp iOS 27 Visual Card Selectors */}
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
                          className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer flex flex-col gap-1.5 ${
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

                  {/* Compact Options Row (Day / Flight Selector + Light/Dark Theme Toggle) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
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

                  {/* Single Clean Primary Print CTA Button (Zero Neon Glow) */}
                  <button
                    type="button"
                    data-testid="share-save-png-btn"
                    onClick={handleStartPrint}
                    disabled={printPhase === "preparing"}
                    className="w-full h-12 px-5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-sm shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <Printer size={18} className="shrink-0" />
                    <span>
                      {printPhase === "preparing"
                        ? t("exportStudioSharingPng")
                        : t("exportStudioStartPrint")}
                    </span>
                  </button>
                </>
              )}
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
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
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
                  className="w-full h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer size={15} className="shrink-0" />
                  <span>{t("exportStudioBookletBtn")}</span>
                </button>
              </div>

              {/* Card 2: Daily Google Maps Multi-Stop Route */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-3.5">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900/5 dark:bg-white/[0.08] text-slate-800 dark:text-slate-100 border border-black/[0.06] dark:border-white/[0.10] flex items-center justify-center shrink-0">
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
                              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                              : "bg-white dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 border-black/[0.08] dark:border-white/[0.10] hover:border-primary/40"
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
                    className="w-full h-10 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Navigation size={15} className="shrink-0" />
                    <span>{t("exportStudioMapsRouteBtn")}</span>
                    <ExternalLink size={13} className="shrink-0 opacity-80" />
                  </a>
                ) : dayRouteSegments.length > 1 ? (
                  <div className="space-y-2.5">
                    <div
                      data-testid="gmaps-chunk-notice"
                      className="px-3 py-2 rounded-xl bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] text-slate-700 dark:text-slate-200 text-[11px] font-bold leading-relaxed flex items-start gap-2"
                    >
                      <Info size={14} className="shrink-0 mt-0.5 text-primary" />
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
                          className="h-10 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
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
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-slate-900/5 dark:bg-white/[0.08] text-slate-800 dark:text-slate-100 border border-black/[0.06] dark:border-white/[0.10] flex items-center justify-center shrink-0">
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
                  className="w-full h-10 px-4 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-100/80 dark:hover:bg-white/[0.12] border border-black/[0.08] dark:border-white/[0.12] text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download size={15} className="shrink-0 text-primary" />
                  <span>{t("exportStudioKmlBtn")}</span>
                </button>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed flex items-start gap-1.5">
                  <Info size={13} className="text-primary shrink-0 mt-0.5" />
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
                  className="w-full text-left p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] hover:bg-slate-100/80 dark:hover:bg-white/[0.07] border border-black/[0.06] dark:border-white/[0.08] transition-all group active:scale-[0.98] flex items-center gap-3.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/15 flex items-center justify-center shrink-0">
                    <FileText size={21} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {t("exportStudioAppleNotesTitle")}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary whitespace-nowrap shrink-0">
                        {t("exportStudioRecommended")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {t("exportStudioAppleNotesDesc")}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </button>

                <button
                  type="button"
                  data-testid="export-ics-btn"
                  onClick={handleDownloadCalendar}
                  className="w-full text-left p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] hover:bg-slate-100/80 dark:hover:bg-white/[0.07] border border-black/[0.06] dark:border-white/[0.08] transition-all group active:scale-[0.98] flex items-center gap-3.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-900/5 dark:bg-white/[0.08] text-slate-800 dark:text-slate-100 border border-black/[0.06] dark:border-white/[0.10] flex items-center justify-center shrink-0">
                    <Calendar size={21} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {t("exportStudioIcsTitle")}
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-slate-600 dark:text-slate-300 whitespace-nowrap shrink-0">
                        .ics
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {t("exportStudioIcsDesc")}
                    </p>
                  </div>
                  <ChevronRight
                    size={18}
                    className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </button>

                <button
                  type="button"
                  data-testid="copy-markdown-btn"
                  onClick={handleCopyMarkdown}
                  className="w-full text-left p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] hover:bg-slate-100/80 dark:hover:bg-white/[0.07] border border-black/[0.06] dark:border-white/[0.08] transition-all group active:scale-[0.98] flex items-center gap-3.5 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-2xl bg-slate-900/5 dark:bg-white/[0.08] text-slate-800 dark:text-slate-100 border border-black/[0.06] dark:border-white/[0.10] flex items-center justify-center shrink-0">
                    {copied ? <Check size={21} className="text-primary" /> : <Copy size={21} />}
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
                    className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </button>
              </div>

              {/* Section: 1-Tap Flight to Google Calendar */}
              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
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
                          className="h-9 px-3 rounded-full bg-primary hover:bg-primary/90 text-white text-xs font-black flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
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
              <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-900/5 dark:bg-white/[0.08] text-slate-800 dark:text-slate-100 flex items-center justify-center shrink-0">
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
                    className="h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-100/80 dark:hover:bg-white/[0.12] border border-black/[0.08] dark:border-white/[0.12] text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                  >
                    <Share2 size={14} className="text-primary shrink-0" />
                    <span className="truncate">
                      {t("exportStudioChecklistKeepBtn")}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="download-checklist-vtodo-btn"
                    onClick={handleDownloadChecklistVtodo}
                    className="h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.08] hover:bg-slate-100/80 dark:hover:bg-white/[0.12] border border-black/[0.08] dark:border-white/[0.12] text-slate-800 dark:text-white text-xs font-black flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-all cursor-pointer"
                  >
                    <Download size={14} className="text-primary shrink-0" />
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
