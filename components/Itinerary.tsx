import React, { useState, useEffect, useRef } from "react";
import { Trip, DayPlan, ItineraryItem, TransportType } from "../types";
import {
  MapPin,
  Coffee,
  Trash2,
  Map,
  Plane,
  Clock,
  Car,
  Bike,
  Footprints,
  TrainFront,
  Plus,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { DateTimeUtils } from "../services/dateTimeUtils";
import { GoogleGenAI } from "@google/genai";
import { useTranslation } from "../App";

interface Props {
  trip: Trip;
  onUpdate: (trip: Trip) => void;
}

const TRANSPORT_OPTIONS: {
  type: TransportType;
  labelZh: string;
  labelEn: string;
  icon: any;
  color: string;
}[] = [
  {
    type: "Public",
    labelZh: "大眾運輸",
    labelEn: "Public",
    icon: TrainFront,
    color: "text-indigo-600 dark:text-indigo-400",
  },
  {
    type: "Car",
    labelZh: "汽車",
    labelEn: "Car",
    icon: Car,
    color: "text-slate-600 dark:text-slate-300",
  },
  {
    type: "Bicycle",
    labelZh: "腳踏車",
    labelEn: "Bicycle",
    icon: Bike,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    type: "Walking",
    labelZh: "步行",
    labelEn: "Walking",
    icon: Footprints,
    color: "text-amber-600 dark:text-amber-400",
  },
];

const SafeInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}> = ({ value, onChange, placeholder, className, disabled }) => {
  const [localValue, setLocalValue] = useState(value);
  const isComposing = useRef(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    if (!isComposing.current) {
      onChange(e.target.value);
    }
  };

  const handleCompositionStart = () => {
    isComposing.current = true;
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLInputElement>
  ) => {
    isComposing.current = false;
    onChange(e.currentTarget.value);
  };

  return (
    <input
      value={localValue}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={() => !disabled && onChange(localValue)}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};

const TimePicker: React.FC<{
  value: string;
  onChange: (newTime: string) => void;
  onClose: () => void;
}> = ({ value, onChange, onClose }) => {
  const [hour, minute] = value.split(":");
  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );
  const minutes = Array.from({ length: 12 }, (_, i) =>
    (i * 5).toString().padStart(2, "0")
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[28px] shadow-2xl z-[100] p-4 flex gap-4 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="flex flex-col gap-1">
        <div className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">
          H
        </div>
        <div className="h-40 overflow-y-auto no-scrollbar space-y-1">
          {hours.map((h) => (
            <button
              key={h}
              onClick={() => onChange(`${h}:${minute}`)}
              className={`w-9 h-9 rounded-lg text-xs font-mono font-black flex items-center justify-center transition-all ${
                h === hour
                  ? "bg-primary text-white"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {h}
            </button>
          ))}
        </div>
      </div>
      <div className="w-px bg-slate-100 dark:bg-slate-700 my-1"></div>
      <div className="flex flex-col gap-1">
        <div className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">
          M
        </div>
        <div className="h-40 overflow-y-auto no-scrollbar space-y-1">
          {minutes.map((m) => (
            <button
              key={m}
              onClick={() => onChange(`${hour}:${m}`)}
              className={`w-9 h-9 rounded-lg text-xs font-mono font-black flex items-center justify-center transition-all ${
                m === minute
                  ? "bg-primary text-white"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Itinerary: React.FC<Props> = ({ trip, onUpdate }) => {
  const { language } = useTranslation();
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [days, setDays] = useState<DayPlan[]>([]);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [showTimePickerId, setShowTimePickerId] = useState<string | null>(null);
  const [showTransportPickerId, setShowTransportPickerId] = useState<
    string | null
  >(null);
  const editRef = useRef<HTMLDivElement>(null);

  const labels = {
    addPlace: language === "zh" ? "景點" : "Place",
    addFood: language === "zh" ? "餐廳" : "Food",
    newPlace: language === "zh" ? "新景點" : "New Place",
    newFood: language === "zh" ? "新餐廳" : "New Food",
    calculating: language === "zh" ? "計算中" : "Calculating...",
    noData: language === "zh" ? "暫無資料" : "No Data",
    selectTransport: language === "zh" ? "選擇交通" : "Transport",
    cancel: language === "zh" ? "取消" : "Cancel",
    moving: language === "zh" ? "移動中" : "Transporting",
  };

  useEffect(() => {
    setDays(trip.itinerary || []);
  }, [trip.itinerary]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        setInsertingAt(null);
        setShowTransportPickerId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveItineraryUpdate = (newItems: ItineraryItem[]) => {
    const newDays = [...days];
    newDays[selectedDayIndex] = {
      ...newDays[selectedDayIndex],
      items: newItems,
    };
    onUpdate({ ...trip, itinerary: newDays });
  };

  const addActivity = (type: "Place" | "Food") => {
    const currentItems = [...days[selectedDayIndex].items];
    let defaultTime = "09:00";
    if (currentItems.length > 0) {
      const lastItem = currentItems[currentItems.length - 1];
      const [h, m] = lastItem.time.split(":").map(Number);
      const nextM = m + 30;
      defaultTime = `${(h + Math.floor(nextM / 60))
        .toString()
        .padStart(2, "0")}:${(nextM % 60).toString().padStart(2, "0")}`;
    }
    const newItem: ItineraryItem = {
      id: crypto.randomUUID(),
      time: defaultTime,
      placeName: type === "Place" ? labels.newPlace : labels.newFood,
      type,
      note: "",
      date: days[selectedDayIndex].date,
    };
    saveItineraryUpdate(
      [...currentItems, newItem].sort((a, b) => a.time.localeCompare(b.time))
    );
  };

  const calculateTransportTime = async (
    index: number,
    transportId: string,
    type: TransportType,
    currentItems: ItineraryItem[]
  ) => {
    const prev = currentItems[index - 1];
    const next = currentItems[index + 1];
    if (!prev || !next) return;

    setCalculatingId(transportId);
    try {
      // Create a new GoogleGenAI instance right before making an API call to ensure it uses the most up-to-date key
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Estimate transport time from "${prev.placeName}" to "${
        next.placeName
      }" by "${type}". Return ONLY duration like "20 mins". Language: ${
        language === "zh" ? "Traditional Chinese" : "English"
      }.`;
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const resultText =
        response.text?.trim().replace(/^約\s*/, "") || labels.noData;

      const updatedItems = currentItems.map((it) =>
        it.id === transportId
          ? { ...it, note: resultText, transportType: type }
          : it
      );
      saveItineraryUpdate(updatedItems);
    } catch {
      const duration = DateTimeUtils.getDuration(prev.time, next.time);
      const updatedItems = currentItems.map((it) =>
        it.id === transportId
          ? { ...it, note: duration || labels.noData, transportType: type }
          : it
      );
      saveItineraryUpdate(updatedItems);
    } finally {
      setCalculatingId(null);
    }
  };

  const handleInsertTransport = async (index: number, type: TransportType) => {
    const currentItems = [...days[selectedDayIndex].items];
    const prev = currentItems[index];
    const next = currentItems[index + 1];
    if (!prev || !next) return;

    const [h1, m1] = prev.time.split(":").map(Number);
    const [h2, m2] = next.time.split(":").map(Number);
    const midMin = Math.floor((h1 * 60 + m1 + (h2 * 60 + m2)) / 2);
    const midTime = `${Math.floor(midMin / 60)
      .toString()
      .padStart(2, "0")}:${(midMin % 60).toString().padStart(2, "0")}`;

    const targetId = crypto.randomUUID();
    const newTransport: ItineraryItem = {
      id: targetId,
      time: midTime,
      placeName: labels.moving,
      type: "Transport",
      transportType: type,
      note: labels.calculating,
      date: days[selectedDayIndex].date,
    };

    const newItems = [...currentItems];
    newItems.splice(index + 1, 0, newTransport);
    setInsertingAt(null);
    saveItineraryUpdate(newItems);
    await calculateTransportTime(index + 1, targetId, type, newItems);
  };

  const updateItem = async (
    itemIdx: number,
    field: keyof ItineraryItem,
    value: any
  ) => {
    let newItems = [...days[selectedDayIndex].items];
    const item = newItems[itemIdx];

    if (item.transportType === "Flight") return;

    newItems[itemIdx] = { ...item, [field]: value };

    if (field === "time") {
      newItems.sort((a, b) => a.time.localeCompare(b.time));
      const newIdx = newItems.findIndex((it) => it.id === item.id);
      saveItineraryUpdate(newItems);

      if (
        newItems[newIdx - 1]?.type === "Transport" &&
        newItems[newIdx - 1]?.transportType !== "Flight"
      ) {
        calculateTransportTime(
          newIdx - 1,
          newItems[newIdx - 1].id,
          newItems[newIdx - 1].transportType!,
          newItems
        );
      }
      if (
        newItems[newIdx + 1]?.type === "Transport" &&
        newItems[newIdx + 1]?.transportType !== "Flight"
      ) {
        calculateTransportTime(
          newIdx + 1,
          newItems[newIdx + 1].id,
          newItems[newIdx + 1].transportType!,
          newItems
        );
      }
    } else {
      saveItineraryUpdate(newItems);
    }
  };

  const deleteItem = (itemIdx: number) => {
    const item = days[selectedDayIndex].items[itemIdx];
    if (item.transportType === "Flight") return;
    const newItems = [...days[selectedDayIndex].items];
    newItems.splice(itemIdx, 1);
    saveItineraryUpdate(newItems);
  };

  if (days.length === 0)
    return (
      <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">
        {labels.noData}
      </div>
    );
  const currentDay = days[selectedDayIndex];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-[calc(100vh-160px)] animate-in fade-in duration-500 overflow-hidden">
      <div className="lg:w-28 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-2 lg:pb-0 shrink-0 px-1">
        {days.map((day, idx) => {
          const isSelected = idx === selectedDayIndex;
          const d = new Date(day.date + "T00:00:00");
          return (
            <button
              key={idx}
              onClick={() => {
                setSelectedDayIndex(idx);
                setInsertingAt(null);
              }}
              className={`flex-shrink-0 lg:w-full p-2.5 lg:p-3.5 rounded-2xl text-center transition-all duration-300 border ${
                isSelected
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg border-slate-900 dark:border-white"
                  : "bg-white dark:bg-slate-800 text-slate-500 border-gray-100 dark:border-slate-800 hover:bg-slate-50 shadow-sm"
              }`}
            >
              <div className="text-[9px] font-black uppercase mb-0.5">
                Day {idx + 1}
              </div>
              <div className="font-bold text-sm leading-tight">
                {d.toLocaleDateString(language === "zh" ? "zh-TW" : "en-US", {
                  month: "numeric",
                  day: "numeric",
                })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-[28px] lg:rounded-[40px] shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            Day {selectedDayIndex + 1}
          </h2>
          <div className="flex bg-slate-100/50 dark:bg-slate-800 p-1 rounded-xl border border-gray-100 dark:border-slate-700">
            <button
              onClick={() => addActivity("Place")}
              className="px-3 py-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-primary font-black text-[11px] flex items-center gap-1.5 transition-all"
            >
              <MapPin size={12} />{" "}
              <span className="hidden sm:inline">{labels.addPlace}</span>
            </button>
            <button
              onClick={() => addActivity("Food")}
              className="px-3 py-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-orange-500 font-black text-[11px] flex items-center gap-1.5 transition-all ml-1"
            >
              <Coffee size={12} />{" "}
              <span className="hidden sm:inline">{labels.addFood}</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-0 relative custom-scrollbar">
          {currentDay?.items.map((item, idx) => {
            const isTransport = item.type === "Transport";
            const isFlight = item.transportType === "Flight";
            const transportOpt = TRANSPORT_OPTIONS.find(
              (o) => o.type === item.transportType
            );
            const nextItem = currentDay.items[idx + 1];
            const canInsertTransport =
              nextItem && !isTransport && nextItem.type !== "Transport";

            return (
              <React.Fragment key={item.id}>
                <div
                  className={`relative pl-10 sm:pl-12 ${
                    isTransport ? "pb-2 sm:pb-3" : "pb-6 sm:pb-8"
                  }`}
                >
                  {!isTransport && (
                    <div
                      className={`absolute left-[-9px] sm:left-[-12px] top-2.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-[3px] bg-white dark:bg-slate-900 z-10 flex items-center justify-center shadow-sm transition-all ${
                        isFlight
                          ? "border-blue-400"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          isFlight
                            ? "bg-blue-500"
                            : item.type === "Place"
                            ? "bg-primary"
                            : "bg-orange-500"
                        }`}
                      />
                    </div>
                  )}
                  <div
                    className={`absolute left-[-0.5px] top-8 bottom-0 w-0.5 ${
                      isTransport
                        ? "border-l-2 border-dashed border-slate-100 dark:border-slate-800"
                        : "bg-slate-50 dark:bg-slate-800/50"
                    } last:hidden`}
                  />

                  {isTransport ? (
                    <div
                      className={`group bg-slate-50 dark:bg-slate-800/40 rounded-xl px-3 py-1.5 border border-dashed flex flex-col sm:flex-row items-center justify-center sm:justify-between h-auto sm:h-11 py-2 sm:py-0 relative ${
                        isFlight
                          ? "bg-blue-50/20 border-blue-100 dark:border-blue-900/20"
                          : "border-slate-200 dark:border-slate-700 hover:border-slate-400"
                      } transition-all`}
                    >
                      <div className="flex items-center gap-1.5 relative pr-10 sm:pr-0">
                        <button
                          disabled={isFlight || calculatingId === item.id}
                          onClick={() =>
                            !isFlight && setShowTransportPickerId(item.id)
                          }
                          className={`flex items-center gap-1.5 p-1 rounded-lg transition-colors ${
                            isFlight
                              ? "cursor-default"
                              : "hover:bg-slate-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          {transportOpt ? (
                            <transportOpt.icon
                              size={13}
                              className={transportOpt.color}
                            />
                          ) : isFlight ? (
                            <Plane
                              size={13}
                              className="text-blue-500 shrink-0"
                            />
                          ) : null}
                          <span
                            className={`text-[10px] sm:text-xs font-bold truncate ${
                              isFlight
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            <span className="hidden sm:inline">
                              {labels.moving}:{" "}
                            </span>
                            {calculatingId === item.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              item.note
                            )}
                          </span>
                        </button>

                        {showTransportPickerId === item.id && (
                          <div
                            ref={editRef}
                            className="absolute bottom-full left-0 mb-2 z-[110] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-2xl p-2 flex gap-1 animate-in zoom-in-95 duration-200"
                          >
                            {TRANSPORT_OPTIONS.map((opt) => (
                              <button
                                key={opt.type}
                                onClick={() => {
                                  setShowTransportPickerId(null);
                                  calculateTransportTime(
                                    idx,
                                    item.id,
                                    opt.type,
                                    currentDay.items
                                  );
                                }}
                                className={`p-2 rounded-lg transition-all ${
                                  item.transportType === opt.type
                                    ? "bg-slate-100 dark:bg-slate-700"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-700 opacity-40"
                                }`}
                              >
                                <opt.icon size={14} className={opt.color} />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isFlight && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col sm:flex-row gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            onClick={() => deleteItem(idx)}
                            className="p-1.5 bg-white dark:bg-slate-700 text-red-500/80 hover:text-red-600 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className={`group bg-white dark:bg-slate-800/80 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-transparent shadow-ios hover:shadow-ios-lg transition-all relative ${
                        isFlight ? "ring-1 ring-blue-500/20 bg-blue-50/5" : ""
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center sm:items-center pr-12 sm:pr-32">
                        <div className="shrink-0 relative">
                          <button
                            disabled={isFlight}
                            onClick={() =>
                              !isFlight && setShowTimePickerId(item.id)
                            }
                            className={`font-mono font-black text-xs sm:text-sm focus:outline-none transition-colors ${
                              isFlight
                                ? "text-blue-600 dark:text-blue-400 cursor-default"
                                : "text-slate-900 dark:text-white hover:text-primary"
                            }`}
                          >
                            {item.time}
                          </button>
                          {showTimePickerId === item.id && (
                            <TimePicker
                              value={item.time}
                              onChange={(t) => {
                                updateItem(idx, "time", t);
                                setShowTimePickerId(null);
                              }}
                              onClose={() => setShowTimePickerId(null)}
                            />
                          )}
                        </div>
                        <div className="flex-1 space-y-0.5 min-w-0 flex flex-col items-center sm:items-start text-center sm:text-left">
                          <div className="flex items-center gap-1.5 w-full justify-center sm:justify-start">
                            {isFlight && (
                              <Plane
                                size={12}
                                className="text-blue-500 shrink-0"
                              />
                            )}
                            <SafeInput
                              disabled={isFlight}
                              value={item.placeName}
                              onChange={(val) =>
                                updateItem(idx, "placeName", val)
                              }
                              className={`font-black text-sm sm:text-base bg-transparent border-none w-full p-0 focus:ring-0 truncate text-center sm:text-left ${
                                isFlight
                                  ? "text-blue-900 dark:text-blue-300"
                                  : item.type === "Food"
                                  ? "text-orange-600"
                                  : "text-slate-900 dark:text-white"
                              }`}
                            />
                          </div>
                          <SafeInput
                            disabled={isFlight}
                            value={item.note || ""}
                            onChange={(val) => updateItem(idx, "note", val)}
                            placeholder="..."
                            className="text-[10px] sm:text-xs font-medium text-slate-400 bg-transparent border-none w-full p-0 focus:ring-0 text-center sm:text-left"
                          />
                        </div>
                      </div>

                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col sm:flex-row gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={() =>
                            window.open(
                              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                item.placeName
                              )}`,
                              "_blank"
                            )
                          }
                          className="p-1.5 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600"
                        >
                          <Map size={14} />
                        </button>
                        {!isFlight && (
                          <button
                            onClick={() => deleteItem(idx)}
                            className="p-1.5 bg-slate-50 dark:bg-slate-700 text-red-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg shadow-sm border border-slate-100 dark:border-slate-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {canInsertTransport && (
                  <div className="relative flex items-center justify-center py-2 group/btn">
                    <div className="absolute left-[-0.5px] w-0.5 bg-slate-50 dark:bg-slate-800/50 h-full" />
                    {insertingAt === idx ? (
                      <div
                        ref={editRef}
                        className="z-[110] bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-900 shadow-xl rounded-2xl p-1.5 flex items-center gap-1 animate-in zoom-in-95 duration-200"
                      >
                        {TRANSPORT_OPTIONS.map((opt) => (
                          <button
                            key={opt.type}
                            onClick={() => handleInsertTransport(idx, opt.type)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all active:scale-90 shrink-0"
                          >
                            <opt.icon size={16} className={opt.color} />
                          </button>
                        ))}
                        <div className="w-px h-6 bg-slate-100 dark:bg-slate-700 mx-1" />
                        <button
                          onClick={() => setInsertingAt(null)}
                          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setInsertingAt(idx)}
                        className="z-[110] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-500 hover:text-indigo-600 hover:border-indigo-100 p-1.5 rounded-full text-[9px] font-black flex items-center gap-1 transition-all opacity-0 group-hover/btn:opacity-100 shadow-sm hover:shadow-md"
                      >
                        {/* Fixed: Use selectTransport instead of setTransport which was missing from the labels object */}
                        <Plus size={14} />{" "}
                        <span className="hidden sm:inline font-black ml-1 uppercase">
                          {labels.selectTransport}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
