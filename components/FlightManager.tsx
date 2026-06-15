import React, { useState, useMemo } from "react";
import {
  Trip,
  FlightInfo,
  FlightSegment,
  Currency,
  User,
  Expense,
  ItineraryItem,
} from "../types";
import {
  Plane,
  Save,
  Edit2,
  DollarSign,
  RefreshCw,
  X,
  Search,
  Loader2,
  Check,
  ChevronLeft,
  ShoppingBag,
  Lock,
  Plus,
  User as UserIcon,
  AlertCircle,
  Briefcase,
  Luggage,
} from "lucide-react";
import { fetchTdxFlights } from "../services/tdxService";
import { BoardingPass } from "./BoardingPass";
import { SegmentedDateInput } from "./SegmentedDateInput";
import { DateTimeUtils } from "../services/dateTimeUtils";
import { useTranslation } from "../contexts/LocalizationContext";
import { supabase, ensureSegments } from "../services/storageService";

interface FlightSelectorModalProps {
  onClose: () => void;
  onConfirm: (outbound: FlightSegment, inbound: FlightSegment) => void;
  initialOrigin: string;
  initialDestination: string;
  initialOutDate?: string;
  initialInDate?: string;
}

type ModalStep =
  | "outbound-search"
  | "outbound-select"
  | "inbound-search"
  | "inbound-select"
  | "review";

const FlightSelectorModal: React.FC<FlightSelectorModalProps> = ({
  onClose,
  onConfirm,
  initialOrigin,
  initialDestination,
  initialOutDate = "",
  initialInDate = "",
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<ModalStep>("outbound-search");
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [outDate, setOutDate] = useState(initialOutDate);
  const [inDate, setInDate] = useState(initialInDate);
  const [outFlightNo, setOutFlightNo] = useState("");
  const [inFlightNo, setInFlightNo] = useState("");
  const [options, setOptions] = useState<FlightSegment[]>([]);
  const [tempOutbound, setTempOutbound] = useState<FlightSegment | null>(null);
  const [tempInbound, setTempInbound] = useState<FlightSegment | null>(null);

  const handleSearch = async (type: "out" | "in") => {
    const fNo = type === "out" ? outFlightNo : inFlightNo;
    const date = type === "out" ? outDate : inDate;
    if (!fNo.trim()) return;
    setLoading(true);
    try {
      const from = type === "out" ? origin : destination;
      const to = type === "out" ? destination : origin;
      const res = await fetchTdxFlights(from, to, date, fNo);
      setOptions(res);
      setStep(type === "out" ? "outbound-select" : "inbound-select");
    } catch (e) {
      alert("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-black text-xl text-slate-800 dark:text-white">
            {step.includes("outbound")
              ? t("searchOut")
              : step.includes("inbound")
              ? t("searchIn")
              : t("review")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full text-slate-400"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {step === "outbound-search" || step === "inbound-search" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {t("origin")}
                  </label>
                  <input
                    value={step === "outbound-search" ? origin : destination}
                    onChange={(e) =>
                      step === "outbound-search"
                        ? setOrigin(e.target.value.toUpperCase())
                        : setDestination(e.target.value.toUpperCase())
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {t("destination")}
                  </label>
                  <input
                    value={step === "outbound-search" ? destination : origin}
                    onChange={(e) =>
                      step === "outbound-search"
                        ? setDestination(e.target.value.toUpperCase())
                        : setOrigin(e.target.value.toUpperCase())
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {t("date")}
                  </label>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {t("date")}
                  </label>
                  <SegmentedDateInput
                    value={step === "outbound-search" ? outDate : inDate}
                    onChange={(val) =>
                      step === "outbound-search"
                        ? setOutDate(val)
                        : setInDate(val)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {t("flightNo")}
                  </label>
                  <input
                    value={
                      step === "outbound-search" ? outFlightNo : inFlightNo
                    }
                    onChange={(e) =>
                      step === "outbound-search"
                        ? setOutFlightNo(e.target.value.toUpperCase())
                        : setInFlightNo(e.target.value.toUpperCase())
                    }
                    className="w-full bg-slate-50 dark:bg-slate-900 dark:text-white p-3 rounded-xl border-none font-bold font-mono outline-none"
                  />
                </div>
              </div>
              <button
                onClick={() =>
                  handleSearch(step === "outbound-search" ? "out" : "in")
                }
                disabled={loading}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    <Search size={20} /> {t("search")}
                  </>
                )}
              </button>
            </div>
          ) : step === "outbound-select" || step === "inbound-select" ? (
            <div className="space-y-4">
              <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar">
                {options.map((f, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      if (step === "outbound-select") {
                        setTempOutbound(f);
                        setStep("inbound-search");
                        setOptions([]);
                      } else {
                        setTempInbound(f);
                        setStep("review");
                      }
                    }}
                    className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-transparent hover:border-primary cursor-pointer transition-all"
                  >
                    <div className="flex justify-between items-center font-black text-sm dark:text-white">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400">
                          {f.airline}
                        </span>
                        <span>{f.flightNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        <span className="text-xs">
                          {DateTimeUtils.formatTime24(f.departureTime)}{" "}
                          {f.departureAirport}
                        </span>
                        <Plane size={12} className="text-slate-300 shrink-0" />
                        <span className="text-xs">
                          {DateTimeUtils.formatTime24(f.arrivalTime)}{" "}
                          {f.arrivalAirport}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setStep(
                    step === "outbound-select"
                      ? "outbound-search"
                      : "inbound-search"
                  )
                }
                className="w-full text-slate-400 font-bold text-xs py-2 flex items-center justify-center gap-1"
              >
                <ChevronLeft size={14} /> {t("back")}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="p-5 bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <div className="text-[10px] font-black text-blue-400 uppercase mb-2">
                    Outbound
                  </div>
                  <div className="font-black dark:text-white">
                    {tempOutbound?.flightNumber} (
                    {tempOutbound?.departureAirport} →{" "}
                    {tempOutbound?.arrivalAirport})
                  </div>
                </div>
                <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <div className="text-[10px] font-black text-indigo-400 uppercase mb-2">
                    Inbound
                  </div>
                  <div className="font-black dark:text-white">
                    {tempInbound?.flightNumber} ({tempInbound?.departureAirport}{" "}
                    → {tempInbound?.arrivalAirport})
                  </div>
                </div>
              </div>
              <button
                onClick={() => onConfirm(tempOutbound!, tempInbound!)}
                className="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-xl shadow-primary/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <Check size={20} /> {t("confirm")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface BaggageEditorProps {
  label: string;
  baggage: {
    carryOn: { count: number; weight: string };
    checked: { count: number; weight: string };
  };
  onChange: (baggage: any) => void;
  errors?: { carryOn?: boolean; checked?: boolean };
}

const BaggageEditor: React.FC<BaggageEditorProps> = ({
  label,
  baggage,
  onChange,
  errors,
}) => {
  const { t } = useTranslation();
  const parseWeight = (val: string) => {
    return val.replace(/[^0-9.]/g, "");
  };

  const inputClass = (isError: boolean) =>
    `w-full pl-3 pr-8 py-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border transition-all outline-none ${
      isError
        ? "border-red-500 ring-2 ring-red-500/20 animate-pulse-soft"
        : "border-transparent focus:ring-2 focus:ring-primary/20"
    }`;

  return (
    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
        {label}
      </div>
      <div className="flex flex-col gap-4">
        {/* Carry On */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 w-24 shrink-0 text-xs font-black text-slate-600 dark:text-slate-300">
            <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg">
              <ShoppingBag size={14} />
            </div>
            {t("carryOn")}
          </div>
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                value={parseWeight(baggage.carryOn?.weight || "")}
                onChange={(e) =>
                  onChange({
                    ...baggage,
                    carryOn: {
                      ...baggage.carryOn,
                      weight: `${e.target.value}kg`,
                    },
                  })
                }
                className={inputClass(!!errors?.carryOn)}
                placeholder="0"
              />
              <span
                className={`absolute right-3 top-2.5 text-[10px] font-black ${
                  errors?.carryOn ? "text-red-400" : "text-slate-400"
                }`}
              >
                {t("weight")}
              </span>
            </div>
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                value={baggage.carryOn?.count || 0}
                onChange={(e) =>
                  onChange({
                    ...baggage,
                    carryOn: {
                      ...baggage.carryOn,
                      count: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className={inputClass(!!errors?.carryOn)}
                placeholder="0"
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-black text-slate-400">
                {t("count")}
              </span>
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-slate-200 dark:bg-slate-700/50"></div>

        {/* Checked */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 w-24 shrink-0 text-xs font-black text-slate-600 dark:text-slate-300">
            <div className="p-1.5 bg-white dark:bg-slate-800 rounded-lg">
              <Briefcase size={14} />
            </div>
            {t("checked")}
          </div>
          <div className="flex gap-3 flex-1">
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                value={parseWeight(baggage.checked?.weight || "")}
                onChange={(e) =>
                  onChange({
                    ...baggage,
                    checked: {
                      ...baggage.checked,
                      weight: `${e.target.value}kg`,
                    },
                  })
                }
                className={inputClass(!!errors?.checked)}
                placeholder="0"
              />
              <span
                className={`absolute right-3 top-2.5 text-[10px] font-black ${
                  errors?.checked ? "text-red-400" : "text-slate-400"
                }`}
              >
                {t("weight")}
              </span>
            </div>
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                value={baggage.checked?.count || 0}
                onChange={(e) =>
                  onChange({
                    ...baggage,
                    checked: {
                      ...baggage.checked,
                      count: parseInt(e.target.value) || 0,
                    },
                  })
                }
                className={inputClass(!!errors?.checked)}
                placeholder="0"
              />
              <span className="absolute right-3 top-2.5 text-[10px] font-black text-slate-400">
                {t("count")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// TODO: [Refactored] Pass currentUser as a prop to avoid duplicate auth fetch
interface Props {
  trip: Trip;
  currentUser: User;
  onUpdate: (trip: Trip) => void;
  isGuest?: boolean;
}

export const FlightManager: React.FC<Props> = ({
  trip,
  currentUser,
  onUpdate,
  isGuest = false,
}) => {
  const { t } = useTranslation();
  const defaultBaggage = {
    carryOn: { count: 1, weight: "7kg" },
    checked: { count: 1, weight: "23kg" },
  };

  const renderLayover = (prevSeg: FlightSegment, nextSeg: FlightSegment) => {
    const s = new Date(prevSeg.arrivalTime).getTime();
    const e = new Date(nextSeg.departureTime).getTime();
    if (isNaN(s) || isNaN(e) || e <= s) return null;
    const diffMins = Math.floor((e - s) / 60000);
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    const duration = h > 0 ? `${h}h ${m}m` : `${m}m`;
    const layoverText = t("layoverAt").replace("{airport}", prevSeg.arrivalAirport);
    return (
      <div key={`layover-${prevSeg.arrivalAirport}-${nextSeg.departureAirport}`} className="flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-100 dark:border-slate-800/80 my-2 w-full">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          ✈️ {layoverText} ({duration})
        </span>
      </div>
    );
  };

  const formatForDatetimeLocal = (isoStr: string) => {
    if (!isoStr) return "";
    return isoStr.substring(0, 16);
  };

  const renderSegmentEditor = (segments: FlightSegment[], isOutbound: boolean) => {
    const key = isOutbound ? "outbound" : "inbound";
    return (
      <div className="space-y-4 w-full">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
            {isOutbound ? t("outbound") : t("inbound")} {t("flight")}
          </h4>
          {!isOutbound && (
            <button
              onClick={() => {
                setTempFlightData(prev => prev ? { ...prev, inbound: undefined } : null);
              }}
              className="text-red-500 hover:text-red-600 text-[10px] font-black uppercase tracking-widest"
            >
              {t("removeInboundFlight")}
            </button>
          )}
        </div>

        {segments.map((seg, idx) => (
          <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t("addSegment")} {idx + 1}
              </span>
              {segments.length > 1 && (
                <button
                  onClick={() => {
                    const newSegs = segments.filter((_, i) => i !== idx);
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="text-red-500 hover:text-red-600 text-[10px] font-black uppercase tracking-widest"
                >
                  {t("deleteSegment")}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("airline")}</label>
                <input
                  value={seg.airline || ""}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], airline: e.target.value };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                  placeholder="EVA Air"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Airline Code</label>
                <input
                  value={seg.airlineID || ""}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], airlineID: e.target.value.toUpperCase() };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                  placeholder="BR"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("flightNo")}</label>
                <input
                  value={seg.flightNumber || ""}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], flightNumber: e.target.value.toUpperCase() };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                  placeholder="BR198"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("origin")}</label>
                <input
                  value={seg.departureAirport || ""}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], departureAirport: e.target.value.toUpperCase() };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                  placeholder="TPE"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("destination")}</label>
                <input
                  value={seg.arrivalAirport || ""}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], arrivalAirport: e.target.value.toUpperCase() };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                  placeholder="NRT"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("dep")} {t("time")}</label>
                <input
                  type="datetime-local"
                  value={formatForDatetimeLocal(seg.departureTime)}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], departureTime: e.target.value };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("arr")} {t("time")}</label>
                <input
                  type="datetime-local"
                  value={formatForDatetimeLocal(seg.arrivalTime)}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], arrivalTime: e.target.value };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t("terminal")}</label>
                <input
                  value={seg.terminal || ""}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], terminal: e.target.value };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                  placeholder="1"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Gate</label>
                <input
                  value={seg.gate || ""}
                  onChange={(e) => {
                    const newSegs = [...segments];
                    newSegs[idx] = { ...newSegs[idx], gate: e.target.value.toUpperCase() };
                    setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
                  }}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 rounded-xl text-xs font-bold border border-transparent outline-none focus:ring-2 focus:ring-primary/20 dark:text-white"
                  placeholder="B5"
                />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={() => {
            const newSegs = [
              ...segments,
              {
                airline: "",
                airlineID: "",
                flightNumber: "",
                departureAirport: "",
                arrivalAirport: "",
                departureTime: "",
                arrivalTime: "",
                baggage: defaultBaggage,
              },
            ];
            setTempFlightData(prev => prev ? { ...prev, [key]: newSegs } : null);
          }}
          className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black text-slate-400 hover:text-primary hover:border-primary transition-all uppercase tracking-wider"
        >
          {t("addSegmentBtn")}
        </button>
      </div>
    );
  };

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [editingFlightId, setEditingFlightId] = useState<string | null>(null);
  const [tempFlightData, setTempFlightData] = useState<FlightInfo | null>(null);
  const [priceError, setPriceError] = useState(false);
  const [baggageErrors, setBaggageErrors] = useState<{
    outbound: { carryOn?: boolean; checked?: boolean };
    inbound: { carryOn?: boolean; checked?: boolean };
  }>({ outbound: {}, inbound: {} });

  const isOwner = trip.user_id === currentUser?.id || !trip.user_id;
  const [isSyncingWithOwner, setIsSyncingWithOwner] = useState(false);

  const ownerFlight = useMemo(() => {
    if (!trip.flights || trip.flights.length === 0) return null;
    return (
      trip.flights.find((f) => f.user_id === trip.user_id) || trip.flights[0]
    );
  }, [trip.flights, trip.user_id]);

  // Removed auto-edit mode on zero price to prevent looping and allow user to view the list first
  /* 
  React.useEffect(() => {
    if (currentUser && !editingFlightId && !tempFlightData) {
      const myZeroPriceFlight = trip.flights?.find(
        (f) => f.user_id === currentUser.id && f.price === 0
      );
      if (myZeroPriceFlight) {
        setTempFlightData({ ...myZeroPriceFlight });
        setEditingFlightId(myZeroPriceFlight.id);
        if (
          ownerFlight &&
          ownerFlight.outbound.flightNumber ===
            myZeroPriceFlight.outbound.flightNumber
        ) {
          setIsSyncingWithOwner(true);
        }
      }
    }
  }, [currentUser, trip.flights, editingFlightId, ownerFlight]);
  */



  const handleStartAdd = () => {
    if (!currentUser) return;

    // Default values from owner flight if available
    const ownerOut = ownerFlight ? ensureSegments(ownerFlight.outbound) : [];
    const firstOwnerOut = ownerOut[0];
    const lastOwnerOut = ownerOut[ownerOut.length - 1];

    const initialOutbound = firstOwnerOut
      ? {
          airline: "",
          flightNumber: "",
          departureTime: "",
          arrivalTime: "",
          departureAirport: firstOwnerOut.departureAirport,
          arrivalAirport: lastOwnerOut?.arrivalAirport || "",
          baggage: defaultBaggage,
        }
      : {
          airline: "",
          flightNumber: "",
          departureTime: "",
          arrivalTime: "",
          departureAirport: "",
          arrivalAirport: "",
          baggage: defaultBaggage,
        };

    setTempFlightData({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      traveler_name: currentUser.name,
      outbound: [initialOutbound],
      inbound: [
        {
          airline: "",
          flightNumber: "",
          departureTime: "",
          arrivalTime: "",
          departureAirport: "",
          arrivalAirport: "",
          baggage: defaultBaggage,
        },
      ],
      price: 0,
      currency: Currency.TWD,
      cabinClass: "Economy",
      baggage: defaultBaggage,
      budget: 50000,
    });
    setIsSyncingWithOwner(false);
    setIsSelectorOpen(true);
  };

  const handleSyncWithOwner = () => {
    if (!ownerFlight || !currentUser) return;
    setTempFlightData({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      traveler_name: currentUser.name,
      outbound: ensureSegments(ownerFlight.outbound).map(seg => ({
        ...seg,
        baggage: seg.baggage || defaultBaggage,
      })),
      inbound: ownerFlight.inbound
        ? ensureSegments(ownerFlight.inbound).map(seg => ({
            ...seg,
            baggage: seg.baggage || defaultBaggage,
          }))
        : undefined,
      price: 0,
      currency: Currency.TWD,
      cabinClass: ownerFlight.cabinClass,
      baggage: defaultBaggage,
      budget: ownerFlight.budget,
    });
    setIsSyncingWithOwner(true);
    setEditingFlightId("sync-temp"); // This marks we are in creation flow
    setPriceError(false);
  };

  const handleFlightSelect = (
    outbound: FlightSegment,
    inbound: FlightSegment
  ) => {
    if (!tempFlightData) return;
    const outWithBag = {
      ...outbound,
      baggage: outbound.baggage || defaultBaggage,
    };
    const inWithBag = {
      ...inbound,
      baggage: inbound.baggage || defaultBaggage,
    };

    setTempFlightData({
      ...tempFlightData,
      outbound: [outWithBag],
      inbound: [inWithBag],
    });
    setIsSyncingWithOwner(false);
    setIsSelectorOpen(false);
    setEditingFlightId(tempFlightData.id);
    setPriceError(false);
  };

  const validateBaggage = (bag: any) => {
    const errs: { carryOn?: boolean; checked?: boolean } = {};
    const isWeightValid = (w: string) =>
      w && w.replace(/[^0-9.]/g, "").length > 0;
    if (bag.carryOn?.count > 0 && !isWeightValid(bag.carryOn.weight))
      errs.carryOn = true;
    if (isWeightValid(bag.carryOn.weight) && bag.carryOn?.count <= 0)
      errs.carryOn = true;
    if (bag.checked?.count > 0 && !isWeightValid(bag.checked.weight))
      errs.checked = true;
    if (isWeightValid(bag.checked.weight) && bag.checked?.count <= 0)
      errs.checked = true;
    return errs;
  };

  const generateFlightItems = (
    segment: FlightSegment,
    travelerName: string
  ): { date: string; items: ItineraryItem[] } | null => {
    if (!segment.flightNumber || !currentUser) return null;
    const depDate = segment.departureTime.split("T")[0];
    const items: ItineraryItem[] = [];
    const noteSuffix = ` (${travelerName})`;
    items.push({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      time: DateTimeUtils.formatTime24(segment.departureTime),
      placeName: `${segment.departureAirport} Airport`,
      type: "Place",
      transportType: "Flight",
      note: `Flight: ${segment.flightNumber}${noteSuffix}`,
      date: depDate,
    });
    const calculateDuration = (start: string, end: string) => {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (isNaN(s) || isNaN(e)) return "";
      let diffMins = Math.floor((e - s) / 60000);
      if (diffMins < 0) diffMins += 24 * 60;
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };
    const getMidPointTime = (t1: string, t2: string) => {
      const [h1, m1] = t1.split(":").map(Number);
      const [h2, m2] = t2.split(":").map(Number);
      let min1 = h1 * 60 + m1;
      let min2 = h2 * 60 + m2;
      if (min2 < min1) min2 += 24 * 60;
      const mid = Math.floor((min1 + min2) / 2) % (24 * 60);
      return `${Math.floor(mid / 60)
         .toString()
         .padStart(2, "0")}:${(mid % 60).toString().padStart(2, "0")}`;
    };
    items.push({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      time: getMidPointTime(
        DateTimeUtils.formatTime24(segment.departureTime),
        DateTimeUtils.formatTime24(segment.arrivalTime)
      ),
      placeName: "Flight",
      type: "Transport",
      transportType: "Flight",
      note: calculateDuration(segment.departureTime, segment.arrivalTime),
      date: depDate,
    });
    const arrDate = segment.arrivalTime.split("T")[0];
    items.push({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      time: DateTimeUtils.formatTime24(segment.arrivalTime),
      placeName: `${segment.arrivalAirport} Airport`,
      type: "Place",
      transportType: "Flight",
      note: `Arrival${noteSuffix}`,
      date: arrDate,
    });
    return { date: "SPLIT", items };
  };

  const handleSave = () => {
    if (!tempFlightData) return;

    let hasError = false;

    // Price Validation: Price must be > 0 and exists
    if (!tempFlightData.price || tempFlightData.price <= 0) {
      setPriceError(true);
      hasError = true;
    } else {
      setPriceError(false);
    }

    const firstOutSeg = ensureSegments(tempFlightData.outbound)[0];
    const outErrors = firstOutSeg ? validateBaggage(firstOutSeg.baggage || defaultBaggage) : {};
    const firstInSeg = tempFlightData.inbound ? ensureSegments(tempFlightData.inbound)[0] : null;
    const inErrors = firstInSeg ? validateBaggage(firstInSeg.baggage || defaultBaggage) : {};
    setBaggageErrors({ outbound: outErrors, inbound: inErrors });

    if (Object.keys(outErrors).length > 0 || Object.keys(inErrors).length > 0)
      hasError = true;

    if (hasError) return;

    let newFlights = [...(trip.flights || [])];
    const actualId =
      editingFlightId === "sync-temp" ? tempFlightData.id : editingFlightId;
    const idx = newFlights.findIndex((f) => f.id === actualId);

    if (idx > -1) newFlights[idx] = tempFlightData;
    else newFlights.push(tempFlightData);

    let newItinerary = [...(trip.itinerary || [])];
    if (!isSyncingWithOwner) {
      const injectItems = (segment: FlightSegment) => {
        const res = generateFlightItems(segment, tempFlightData.traveler_name);
        if (!res) return;
        res.items.forEach((item) => {
          const dayIdx = newItinerary.findIndex((d) => d.date === item.date);
          if (dayIdx > -1) {
            const dayItems = [...newItinerary[dayIdx].items];
            const exists = dayItems.some(
              (existing) =>
                (existing.time === item.time &&
                  existing.placeName === item.placeName) ||
                (item.type === "Place" &&
                  existing.placeName === item.placeName &&
                  existing.note?.includes(segment.flightNumber))
            );
            if (!exists) {
              dayItems.push(item);
              dayItems.sort((a, b) => a.time.localeCompare(b.time));
              newItinerary[dayIdx] = {
                ...newItinerary[dayIdx],
                items: dayItems,
              };
            }
          }
        });
      };
      ensureSegments(tempFlightData.outbound).forEach(injectItems);
      if (tempFlightData.inbound) {
        ensureSegments(tempFlightData.inbound).forEach(injectItems);
      }
    }

    onUpdate({ ...trip, flights: newFlights, itinerary: newItinerary });
    setEditingFlightId(null);
    setTempFlightData(null);
    setIsSyncingWithOwner(false);
  };

  const startEdit = (flight: FlightInfo) => {
    if (flight.user_id !== currentUser?.id) return;
    const safeFlight = {
      ...flight,
      outbound: ensureSegments(flight.outbound).map((seg) => ({
        ...seg,
        baggage: seg.baggage || defaultBaggage,
      })),
      inbound: flight.inbound
        ? ensureSegments(flight.inbound).map((seg) => ({
            ...seg,
            baggage: seg.baggage || defaultBaggage,
          }))
        : undefined,
    };
    setTempFlightData(safeFlight);
    setEditingFlightId(flight.id);
    setPriceError(false);
    setBaggageErrors({ outbound: {}, inbound: {} });

    const ownerFirstOut = ownerFlight ? ensureSegments(ownerFlight.outbound)[0] : null;
    const flightFirstOut = ensureSegments(flight.outbound)[0];
    if (
      ownerFlight &&
      ownerFirstOut?.flightNumber === flightFirstOut?.flightNumber &&
      flight.user_id !== ownerFlight.user_id
    ) {
      setIsSyncingWithOwner(true);
    } else {
      setIsSyncingWithOwner(false);
    }
  };

  const hasMyFlight =
    currentUser && trip.flights?.some((f) => f.user_id === currentUser.id);
  const canSync = !isOwner && ownerFlight && !hasMyFlight;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 px-4 sm:px-0">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800 dark:text-white">
          {t("titleFlights")}
        </h2>
        {currentUser && !editingFlightId && (
          <div className="flex gap-2">
            {canSync && (
              <button
                onClick={handleSyncWithOwner}
                className="p-3 sm:px-6 sm:py-2.5 rounded-full sm:rounded-2xl font-black text-sm flex items-center gap-2 bg-white dark:bg-slate-800 text-primary border border-primary/20 hover:bg-primary/5 transition-all shadow-lg"
                title={t("syncWithOwner")}
              >
                <RefreshCw size={18} />{" "}
                <span className="hidden sm:inline">{t("syncWithOwner")}</span>
              </button>
            )}
            <button
              onClick={handleStartAdd}
              className={`p-3 sm:px-6 sm:py-2.5 rounded-full sm:rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg ${
                hasMyFlight
                  ? "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200"
                  : "bg-primary text-white hover:opacity-90 shadow-primary/20"
              }`}
              title={hasMyFlight ? t("addSegment") : t("addMyFlight")}
            >
              <Plus size={18} />{" "}
              <span className="hidden sm:inline">
                {hasMyFlight ? t("addSegment") : t("addMyFlight")}
              </span>
            </button>
          </div>
        )}
      </div>

      {editingFlightId && tempFlightData ? (
        <div className="space-y-6 animate-in fade-in duration-500 bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-ios relative overflow-hidden">
          <div className="flex justify-between items-center mb-6 pt-4">
            <h3 className="font-black text-lg text-slate-900 dark:text-white">
              {t("edit")}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingFlightId(null);
                  setTempFlightData(null);
                  setIsSyncingWithOwner(false);
                }}
                className="px-5 py-2 text-slate-400 font-black text-xs hover:text-slate-600 transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSave}
                className="bg-primary text-white px-8 py-2 rounded-xl font-black text-xs shadow-lg active:scale-95 transition-all"
              >
                {t("save")}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center h-[15px]">
                  {t("traveler")}
                </label>
                <input
                  value={tempFlightData.traveler_name}
                  onChange={(e) =>
                    setTempFlightData({
                      ...tempFlightData,
                      traveler_name: e.target.value,
                    })
                  }
                  className="w-full h-[48px] bg-slate-50 dark:bg-slate-900 dark:text-white px-3 rounded-xl border-2 border-transparent focus:border-primary/20 font-bold text-sm outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 w-full">
                  <label
                    className={`text-[10px] font-black uppercase tracking-widest flex justify-between items-center h-[15px] ${
                      priceError ? "text-red-500" : "text-slate-400"
                    }`}
                  >
                    <span>{t("totalPrice")}</span>
                    {priceError && (
                      <span className="animate-bounce">{t("required")}!</span>
                    )}
                  </label>
                  <div
                    className={`flex w-full h-[48px] items-stretch rounded-2xl bg-slate-50 dark:bg-slate-900 transition-all border-2 ${
                      priceError
                        ? "border-red-500 bg-red-50/10 ring-4 ring-red-500/10"
                        : "border-transparent focus-within:border-primary/20"
                    }`}
                  >
                    <select
                      value={tempFlightData.currency}
                      onChange={(e) =>
                        setTempFlightData({
                          ...tempFlightData,
                          currency: e.target.value as Currency,
                        })
                      }
                      className="bg-transparent dark:text-white px-3 border-none font-bold text-xs outline-none w-20"
                    >
                      {Object.values(Currency).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={tempFlightData.price || ""}
                      onChange={(e) => {
                        setTempFlightData({
                          ...tempFlightData,
                          price: parseFloat(e.target.value) || 0,
                        });
                        setPriceError(false);
                      }}
                      className="flex-1 bg-transparent dark:text-white px-3 border-none font-black text-sm outline-none min-w-0"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-1.5 w-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center h-[15px]">
                    {t("cabin")}
                  </label>
                  <div className="relative flex items-center w-full h-[48px] bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-transparent focus-within:border-primary/20 transition-all">
                    <select
                      value={tempFlightData.cabinClass}
                      onChange={(e) =>
                        setTempFlightData({
                          ...tempFlightData,
                          cabinClass: e.target.value,
                        })
                      }
                      className="w-full bg-transparent dark:text-white px-3 font-bold text-sm outline-none appearance-none"
                    >
                      <option value="Economy">Economy</option>
                      <option value="Business">Business</option>
                      <option value="First">First Class</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
                      <svg
                        className="fill-current h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {isSyncingWithOwner && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 flex items-center gap-3">
                  <RefreshCw
                    size={18}
                    className="text-blue-500 animate-spin-slow"
                  />
                  <div>
                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                      Schedule Synced
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">
                      Prices and baggage remain individual
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <BaggageEditor
                label={t("outboundBag")}
                baggage={ensureSegments(tempFlightData.outbound)[0]?.baggage || defaultBaggage}
                onChange={(bag) => {
                  const newOut = [...ensureSegments(tempFlightData.outbound)];
                  if (newOut[0]) {
                    newOut[0] = { ...newOut[0], baggage: bag };
                  }
                  setTempFlightData({
                    ...tempFlightData,
                    outbound: newOut,
                  });
                }}
                errors={baggageErrors.outbound}
              />
              {tempFlightData.inbound && tempFlightData.inbound.length > 0 && (
                <BaggageEditor
                  label={t("inboundBag")}
                  baggage={ensureSegments(tempFlightData.inbound)[0]?.baggage || defaultBaggage}
                  onChange={(bag) => {
                    const newIn = [...ensureSegments(tempFlightData.inbound)];
                    if (newIn[0]) {
                      newIn[0] = { ...newIn[0], baggage: bag };
                    }
                    setTempFlightData({
                      ...tempFlightData,
                      inbound: newIn,
                    });
                  }}
                  errors={baggageErrors.inbound}
                />
              )}
            </div>
          </div>

          {/* Segment Editors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-slate-100 dark:border-slate-700 pt-8 mt-6">
            {renderSegmentEditor(tempFlightData.outbound, true)}
            {tempFlightData.inbound ? (
              renderSegmentEditor(tempFlightData.inbound, false)
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-100 dark:border-slate-800 min-h-[200px] w-full">
                <button
                  onClick={() => {
                    setTempFlightData(prev =>
                      prev
                        ? {
                            ...prev,
                            inbound: [
                              {
                                airline: "",
                                airlineID: "",
                                flightNumber: "",
                                departureAirport: "",
                                arrivalAirport: "",
                                departureTime: "",
                                arrivalTime: "",
                                baggage: defaultBaggage,
                              },
                            ],
                          }
                        : null
                    );
                  }}
                  className="px-6 py-3 bg-white dark:bg-slate-800 text-primary border border-primary/20 rounded-2xl font-black text-xs shadow-md hover:bg-primary/5 transition-all uppercase tracking-wider"
                >
                  {t("addInboundFlight")}
                </button>
              </div>
            )}
          </div>

          {/* Previews */}
          <div className="mt-8 space-y-6 opacity-60 pointer-events-none grayscale border-t border-slate-100 dark:border-slate-700 pt-8">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t("outbound")}</div>
            {ensureSegments(tempFlightData.outbound).map((seg, idx) => (
              <React.Fragment key={`prev-out-${idx}`}>
                {idx > 0 && renderLayover(ensureSegments(tempFlightData.outbound)[idx - 1], seg)}
                <BoardingPass
                  segment={seg}
                  passengerName={tempFlightData.traveler_name}
                  cabinClass={tempFlightData.cabinClass}
                />
              </React.Fragment>
            ))}
            {tempFlightData.inbound && tempFlightData.inbound.length > 0 && (
              <>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-6">{t("inbound")}</div>
                {ensureSegments(tempFlightData.inbound).map((seg, idx) => (
                  <React.Fragment key={`prev-in-${idx}`}>
                    {idx > 0 && renderLayover(ensureSegments(tempFlightData.inbound)[idx - 1], seg)}
                    <BoardingPass
                      segment={seg}
                      passengerName={tempFlightData.traveler_name}
                      cabinClass={tempFlightData.cabinClass}
                    />
                  </React.Fragment>
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {trip.flights && trip.flights.length > 0 ? (
            trip.flights
              .sort((a, b) => {
                if (a.user_id === currentUser?.id) return -1;
                if (b.user_id === currentUser?.id) return 1;
                return 0;
              })
              .map((flight) => (
                <div key={flight.id} className="relative group">
                  <div className="absolute -top-3 left-8 z-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-200 dark:shadow-none">
                    <UserIcon size={12} /> {flight.traveler_name}{" "}
                    {flight.user_id === currentUser?.id ? "(Me)" : ""}
                  </div>
                  <div className="space-y-4">
                    {ensureSegments(flight.outbound).map((seg, idx) => (
                      <React.Fragment key={`out-${idx}`}>
                        {idx > 0 && renderLayover(ensureSegments(flight.outbound)[idx - 1], seg)}
                        <BoardingPass
                          segment={seg}
                          passengerName={flight.traveler_name}
                          cabinClass={flight.cabinClass}
                        />
                      </React.Fragment>
                    ))}
                    {flight.inbound && ensureSegments(flight.inbound).length > 0 && (
                      <>
                        <div className="h-px bg-slate-200 dark:bg-slate-700/50 my-6 flex items-center justify-center">
                          <span className="bg-white dark:bg-slate-800 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">
                            {t("inbound")}
                          </span>
                        </div>
                        {ensureSegments(flight.inbound).map((seg, idx) => (
                          <React.Fragment key={`in-${idx}`}>
                            {idx > 0 && renderLayover(ensureSegments(flight.inbound)[idx - 1], seg)}
                            <BoardingPass
                              segment={seg}
                              passengerName={flight.traveler_name}
                              cabinClass={flight.cabinClass}
                            />
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </div>
                  {flight.user_id === currentUser?.id && (
                    <button
                      onClick={() => startEdit(flight)}
                      className="absolute top-4 right-4 p-3 bg-white/80 dark:bg-slate-700/80 backdrop-blur-md rounded-xl text-slate-500 hover:text-primary transition-all shadow-sm opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                </div>
              ))
          ) : (
            <div className="py-24 text-center text-slate-300 font-black uppercase text-xs tracking-[0.3em] flex flex-col items-center gap-6">
              <Plane size={48} className="opacity-20" />
              {t("noFlights")}
            </div>
          )}
        </div>
      )}

      {isSelectorOpen && (
        <FlightSelectorModal
          onClose={() => setIsSelectorOpen(false)}
          onConfirm={handleFlightSelect}
          initialOrigin={
            ownerFlight
              ? ensureSegments(ownerFlight.outbound)[0]?.departureAirport || "TPE"
              : "TPE"
          }
          initialDestination={
            ownerFlight
              ? ensureSegments(ownerFlight.outbound)[ensureSegments(ownerFlight.outbound).length - 1]?.arrivalAirport || ""
              : ""
          }
          initialOutDate={
            ownerFlight
              ? ensureSegments(ownerFlight.outbound)[0]?.departureTime?.split("T")[0] || ""
              : ""
          }
          initialInDate={
            ownerFlight?.inbound
              ? ensureSegments(ownerFlight.inbound)[0]?.departureTime?.split("T")[0] || ""
              : ""
          }
        />
      )}
    </div>
  );
};
