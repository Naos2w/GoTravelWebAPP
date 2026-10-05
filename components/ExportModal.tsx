import React, { useState } from "react";
import { Trip } from "../types";
import {
  X as CloseIcon,
  FileText,
  Calendar,
  Copy,
  Check,
  Share2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Info,
} from "lucide-react";
import {
  exportToAppleNotes,
  downloadICalendar,
  generateTripNotesMarkdown,
} from "../services/exportService";
import { useTranslation } from "../contexts/LocalizationContext";

interface ExportModalProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string, type: "success" | "error" | "info") => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  trip,
  isOpen,
  onClose,
  onNotify,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [isExportingNotes, setIsExportingNotes] = useState(false);

  if (!isOpen) return null;

  const totalStops = (trip.itinerary || []).reduce(
    (acc, day) => acc + (day.items?.length || 0),
    0
  );
  const totalFlights = trip.flights?.length || 0;

  const handleExportNotes = async () => {
    setIsExportingNotes(true);
    try {
      const res = await exportToAppleNotes(trip);
      if (res.success) {
        if (res.method === "share") {
          onNotify?.("已開啟原生分享！請點選「備忘錄 (Notes)」儲存", "success");
        } else {
          onNotify?.("已複製備忘錄 Markdown 格式，可直接貼入 Apple Notes！", "success");
        }
      } else {
        onNotify?.("已複製行程 Markdown 格式至剪貼簿！", "info");
      }
    } catch (err) {
      onNotify?.("匯出失敗，請手動複製", "error");
    } finally {
      setIsExportingNotes(false);
    }
  };

  const handleDownloadCalendar = () => {
    try {
      downloadICalendar(trip);
      onNotify?.(
        "已生成日曆檔案 (.ics)！iPhone 點開即可一鍵「全部加入行事曆」",
        "success"
      );
    } catch (err) {
      onNotify?.("生成日曆失敗，請稍後再試", "error");
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = generateTripNotesMarkdown(trip);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      onNotify?.("已成功複製完整 Markdown 行程文字！", "success");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      onNotify?.("複製失敗，請手動複製", "error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl rounded-t-[36px] sm:rounded-[36px] p-6 sm:p-8 shadow-2xl border border-black/[0.06] dark:border-white/[0.08] flex flex-col gap-6 animate-in slide-in-from-bottom-8 duration-300 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS Grabber Handle */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 mx-auto -mt-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                匯出與手機同步
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {trip.name} • 共 {totalStops} 個景點、{totalFlights} 筆機票
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            aria-label="Close"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        {/* Option 1: Apple Notes */}
        <div className="space-y-3">
          <button
            onClick={handleExportNotes}
            disabled={isExportingNotes}
            className="w-full text-left p-4 sm:p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 transition-all group active:scale-[0.98] flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0 group-hover:scale-105 transition-transform">
              <FileText size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  匯出至 iOS 備忘錄 (Apple Notes)
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                  推薦
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                喚起原生分享面板，自動排版 Markdown 時間軸與打勾清單
              </p>
            </div>
            <ChevronRight
              size={18}
              className="text-amber-500 group-hover:translate-x-1 transition-transform shrink-0"
            />
          </button>

          {/* Option 2: Apple Calendar */}
          <button
            onClick={handleDownloadCalendar}
            className="w-full text-left p-4 sm:p-5 rounded-2xl bg-red-50/50 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 transition-all group active:scale-[0.98] flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/25 shrink-0 group-hover:scale-105 transition-transform">
              <Calendar size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  加入 Apple / 系統行事曆
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-200/60 dark:bg-red-900/60 text-red-800 dark:text-red-200">
                  .ics
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                生成標準日曆檔，iPhone 點開即可「全部加入行事曆」並自帶提醒
              </p>
            </div>
            <ChevronRight
              size={18}
              className="text-red-500 group-hover:translate-x-1 transition-transform shrink-0"
            />
          </button>

          {/* Option 3: Copy Markdown */}
          <button
            onClick={handleCopyMarkdown}
            className="w-full text-left p-4 sm:p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 transition-all group active:scale-[0.98] flex items-center gap-4 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0 group-hover:scale-105 transition-transform">
              {copied ? <Check size={24} /> : <Copy size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900 dark:text-white">
                  {copied ? "已成功複製！" : "複製完整 Markdown 格式"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                適用於 Notion、Obsidian、Bear 或直接貼到社群分享
              </p>
            </div>
            <ChevronRight
              size={18}
              className="text-blue-500 group-hover:translate-x-1 transition-transform shrink-0"
            />
          </button>
        </div>

        {/* Tip banner */}
        <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-3">
          <Info size={16} className="text-primary shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            <span className="font-bold text-slate-900 dark:text-white">
              iPhone 用戶小訣竅：
            </span>{" "}
            點擊「匯出至 iOS 備忘錄」後，在彈出的系統分享面板中選擇
            <strong className="text-amber-600 dark:text-amber-400">「備忘錄 (Notes)」</strong>
            ，系統將自動為您創建一篇漂亮的旅行日誌，出國時隨時離線查看！
          </div>
        </div>
      </div>
    </div>
  );
};
