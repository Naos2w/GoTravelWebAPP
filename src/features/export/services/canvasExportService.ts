import { Currency, Expense, FlightSegment, Language, Trip } from "../../../types";
import { getRateToTwd } from "../../expenses/services/exchangeRateService";
import { calculateSplitwiseSettlement, SplitMember } from "../../expenses/services/splitwiseService";
import { formatBaggageSummary, getDefaultBaggage, inferAirlineId } from "../../flights/services/airlineBaggageService";
import { DateTimeUtils } from "../../../shared/services/dateTimeUtils";
import { sanitizeFilenameBase, triggerBlobDownload } from "./exportHelpers";

export type PrintableCardType = "receipt" | "boarding-pass" | "lockscreen" | "story";

export interface CanvasRenderOptions {
  trip: Trip;
  lang: Language;
  dayIndex?: number;
  flightIndex?: number;
  theme?: "light" | "dark";
}

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif';
const MONO_STACK = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const CATEGORY_LABELS: Record<Language, Record<string, string>> = {
  zh: {
    Flight: "機票",
    Accommodation: "住宿",
    Transport: "交通",
    Food: "餐飲",
    Tickets: "票券",
    Shopping: "購物",
    Other: "其他",
  },
  en: {
    Flight: "Flight",
    Accommodation: "Accommodation",
    Transport: "Transport",
    Food: "Food",
    Tickets: "Tickets",
    Shopping: "Shopping",
    Other: "Other",
  },
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seedText: string,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  let cursor = x;
  let idx = 0;
  while (cursor < x + width - 3) {
    const code = seedText.charCodeAt(idx % Math.max(seedText.length, 1)) || 65;
    const barW = ((code + idx) % 3) + 1;
    const gap = ((code + idx * 2) % 2) + 1.5;
    if (cursor + barW <= x + width) {
      ctx.fillRect(cursor, y, barW, height);
    }
    cursor += barW + gap;
    idx++;
  }
  ctx.restore();
}

function collectTripMembers(trip: Trip): SplitMember[] {
  const userMap = new Map<string, string>();
  (trip.collaborators || []).forEach((c) => {
    if (c.user_id) userMap.set(c.user_id, (c.email || c.user_id).split("@")[0]);
  });
  (trip.flights || []).forEach((f) => {
    if (f.user_id && f.traveler_name) userMap.set(f.user_id, f.traveler_name);
  });
  (trip.expenses || []).forEach((e) => {
    if (e.user_id && e.user_name) userMap.set(e.user_id, e.user_name);
    if (e.paidBy && e.paidByName) userMap.set(e.paidBy, e.paidByName);
  });
  return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
}

function computeReceiptBreakdown(trip: Trip) {
  const categoryTotals = new Map<string, number>();
  const foreignTotals = new Map<Currency, number>();
  let totalTwd = 0;

  const addAmount = (category: string, amount: number, currency: Currency, customRate?: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rate = customRate && customRate > 0 ? customRate : getRateToTwd(currency);
    const twd = amount * rate;
    totalTwd += twd;
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + twd);
    if (currency !== Currency.TWD) {
      foreignTotals.set(currency, (foreignTotals.get(currency) || 0) + amount);
    }
  };

  (trip.expenses || []).forEach((e: Expense) => {
    addAmount(e.category, Number(e.amount), e.currency, e.exchangeRate);
  });

  (trip.flights || []).forEach((f) => {
    if (f.price > 0) {
      addAmount("Flight", Number(f.price), f.currency, f.exchangeRate);
    }
  });

  const members = collectTripMembers(trip);
  const { transfers } = calculateSplitwiseSettlement(trip.expenses || [], members);

  return {
    categoryTotals: Array.from(categoryTotals.entries()),
    foreignTotals: Array.from(foreignTotals.entries()),
    totalTwd: Math.round(totalTwd),
    transfers,
  };
}

function drawReceiptCard(canvas: HTMLCanvasElement, options: CanvasRenderOptions): void {
  const { trip, lang, theme = "light" } = options;
  const breakdown = computeReceiptBreakdown(trip);
  const catCount = Math.max(breakdown.categoryTotals.length, 1);
  const foreignCount = breakdown.foreignTotals.length;
  const transferCount = Math.max(breakdown.transfers.length, 1);

  const logicalW = 380;
  const logicalH = Math.max(580, 360 + catCount * 24 + foreignCount * 20 + transferCount * 24 + 120);
  const dpr = 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Outer backdrop
  ctx.fillStyle = theme === "dark" ? "#0B0F17" : "#E9EEF5";
  ctx.fillRect(0, 0, logicalW, logicalH);

  const paperX = 24;
  const paperY = 24;
  const paperW = logicalW - 48;
  const paperH = logicalH - 48;
  const toothW = 12;
  const toothH = 8;

  // Serrated thermal paper silhouette
  ctx.fillStyle = "#FCFBF7";
  ctx.beginPath();
  ctx.moveTo(paperX, paperY + toothH);
  for (let x = paperX; x < paperX + paperW; x += toothW) {
    ctx.lineTo(x + toothW / 2, paperY);
    ctx.lineTo(Math.min(x + toothW, paperX + paperW), paperY + toothH);
  }
  ctx.lineTo(paperX + paperW, paperY + paperH - toothH);
  for (let x = paperX + paperW; x > paperX; x -= toothW) {
    ctx.lineTo(x - toothW / 2, paperY + paperH);
    ctx.lineTo(Math.max(x - toothW, paperX), paperY + paperH - toothH);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#E2DED5";
  ctx.lineWidth = 1;
  ctx.stroke();

  const left = paperX + 20;
  const right = paperX + paperW - 20;
  let y = paperY + 34;

  // Header
  ctx.fillStyle = "#111827";
  ctx.font = `800 16px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("GO TRAVEL // RECEIPT", logicalW / 2, y);
  y += 22;

  ctx.font = `700 15px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, trip.name || "Trip Receipt", paperW - 40), logicalW / 2, y);
  y += 18;

  ctx.fillStyle = "#6B7280";
  ctx.font = `500 11px ${MONO_STACK}`;
  const dateText = `${trip.startDate || "---"} ~ ${trip.endDate || "---"}`;
  ctx.fillText(`${trip.destination || ""} · ${dateText}`, logicalW / 2, y);
  y += 16;

  drawDashedLine(ctx, left, y, right, y, "#CBD5E1");
  y += 20;

  // Category Breakdown
  ctx.textAlign = "left";
  ctx.fillStyle = "#374151";
  ctx.font = `700 11px ${MONO_STACK}`;
  ctx.fillText(lang === "zh" ? "分類明細 / CATEGORY" : "CATEGORY BREAKDOWN", left, y);
  y += 18;

  const labels = CATEGORY_LABELS[lang] || CATEGORY_LABELS.en;
  if (breakdown.categoryTotals.length === 0) {
    ctx.fillStyle = "#6B7280";
    ctx.font = `400 11px ${MONO_STACK}`;
    ctx.fillText(lang === "zh" ? "尚無支出紀錄" : "No expenses recorded", left, y);
    y += 22;
  } else {
    breakdown.categoryTotals.forEach(([cat, amount]) => {
      ctx.fillStyle = "#1F2937";
      ctx.font = `500 12px ${MONO_STACK}`;
      ctx.textAlign = "left";
      ctx.fillText(labels[cat] || cat, left, y);
      ctx.textAlign = "right";
      ctx.fillText(`NT$ ${Math.round(amount).toLocaleString()}`, right, y);
      y += 22;
    });
  }

  drawDashedLine(ctx, left, y, right, y, "#CBD5E1");
  y += 22;

  // Total TWD
  ctx.fillStyle = "#111827";
  ctx.font = `800 15px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText("TOTAL (TWD)", left, y);
  ctx.textAlign = "right";
  ctx.fillText(`NT$ ${breakdown.totalTwd.toLocaleString()}`, right, y);
  y += 20;

  breakdown.foreignTotals.forEach(([cur, amt]) => {
    ctx.fillStyle = "#4B5563";
    ctx.font = `500 11px ${MONO_STACK}`;
    ctx.textAlign = "left";
    ctx.fillText(`SUBTOTAL (${cur})`, left, y);
    ctx.textAlign = "right";
    ctx.fillText(`${cur} ${Math.round(amt).toLocaleString()}`, right, y);
    y += 18;
  });

  y += 6;
  drawDashedLine(ctx, left, y, right, y, "#CBD5E1");
  y += 20;

  // Splitwise AA Settlement
  ctx.textAlign = "left";
  ctx.fillStyle = "#374151";
  ctx.font = `700 11px ${MONO_STACK}`;
  ctx.fillText(lang === "zh" ? "AA 分攤結算 / SPLITWISE" : "AA SETTLEMENT", left, y);
  y += 18;

  if (breakdown.transfers.length === 0) {
    ctx.fillStyle = "#059669";
    ctx.font = `600 11px ${MONO_STACK}`;
    ctx.fillText(lang === "zh" ? "✓ 全員帳目已結清" : "✓ ALL BALANCES SETTLED", left, y);
    y += 22;
  } else {
    breakdown.transfers.forEach((tr) => {
      ctx.fillStyle = "#111827";
      ctx.font = `500 11px ${MONO_STACK}`;
      ctx.textAlign = "left";
      ctx.fillText(truncateText(ctx, `${tr.fromName} → ${tr.toName}`, paperW - 140), left, y);
      ctx.textAlign = "right";
      ctx.fillText(`NT$ ${tr.amount.toLocaleString()}`, right, y);
      y += 22;
    });
  }

  // Stamp
  ctx.save();
  ctx.translate(logicalW / 2 + 54, y + 22);
  ctx.rotate(-0.14);
  ctx.strokeStyle = "#DC2626";
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, -58, -16, 116, 32, 6);
  ctx.stroke();
  ctx.fillStyle = "#DC2626";
  ctx.font = `800 12px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText(lang === "zh" ? "SETTLED 已結算" : "SETTLED", 0, 4);
  ctx.restore();

  y += 58;
  drawBarcode(ctx, left + 16, y, paperW - 72, 34, trip.id || trip.name || "GOTRAVEL", "#1F2937");
  y += 50;

  ctx.fillStyle = "#9CA3AF";
  ctx.font = `500 10px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("THANK YOU FOR TRAVELING · GO TRAVEL", logicalW / 2, y);

  ctx.restore();
}

function drawBoardingSegment(
  ctx: CanvasRenderingContext2D,
  seg: FlightSegment,
  label: string,
  cabinClass: string | undefined,
  fallbackBaggage: Trip["flights"][number]["baggage"] | undefined,
  lang: Language,
  theme: "light" | "dark",
  x: number,
  y: number,
  w: number
): number {
  const isDark = theme === "dark";
  const cardH = 212;
  drawRoundedRect(ctx, x, y, w, cardH, 20);
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const airline = seg.airlineNameZh && lang === "zh"
    ? seg.airlineNameZh
    : seg.airlineNameEn || seg.airline || "Airline";

  ctx.fillStyle = isDark ? "#38BDF8" : "#0284C7";
  ctx.font = `700 11px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText(`${label} · ${airline} ${seg.flightNumber || ""}`.trim(), x + 20, y + 28);

  ctx.fillStyle = isDark ? "#F8FAFC" : "#0F172A";
  ctx.font = `800 38px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText((seg.departureAirport || "---").toUpperCase(), x + 20, y + 78);

  ctx.textAlign = "center";
  ctx.fillStyle = isDark ? "#38BDF8" : "#2563EB";
  ctx.font = `700 22px ${FONT_STACK}`;
  ctx.fillText("✈", x + w / 2, y + 72);

  ctx.fillStyle = isDark ? "#F8FAFC" : "#0F172A";
  ctx.font = `800 38px ${MONO_STACK}`;
  ctx.textAlign = "right";
  ctx.fillText((seg.arrivalAirport || "---").toUpperCase(), x + w - 20, y + 78);

  // Times
  ctx.fillStyle = isDark ? "#94A3B8" : "#475569";
  ctx.font = `600 12px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText(
    `${DateTimeUtils.formatDateFriendly(seg.departureTime, lang)} ${DateTimeUtils.formatTime24(seg.departureTime)}`.trim(),
    x + 20,
    y + 106
  );
  ctx.textAlign = "right";
  ctx.fillText(
    `${DateTimeUtils.formatDateFriendly(seg.arrivalTime, lang)} ${DateTimeUtils.formatTime24(seg.arrivalTime)}`.trim(),
    x + w - 20,
    y + 106
  );

  drawDashedLine(ctx, x + 16, y + 128, x + w - 16, y + 128, isDark ? "rgba(255,255,255,0.18)" : "#CBD5E1");

  // Terminal / Gate / Baggage
  const baggage =
    seg.baggage ||
    fallbackBaggage ||
    getDefaultBaggage(seg.airlineID || inferAirlineId(seg.flightNumber), cabinClass);
  const bagText = formatBaggageSummary(baggage, {
    carryOn: lang === "zh" ? "手提" : "Carry-on",
    checked: lang === "zh" ? "託運" : "Checked",
    none: lang === "zh" ? "無" : "None",
  });

  ctx.fillStyle = isDark ? "#CBD5E1" : "#334155";
  ctx.font = `600 12px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText(
    `TERMINAL T${seg.terminal || "-"}   ·   GATE ${seg.gate || "-"}`,
    x + 20,
    y + 156
  );

  ctx.fillStyle = isDark ? "#94A3B8" : "#475569";
  ctx.font = `500 11px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, `🧳 ${bagText}`, w - 40), x + 20, y + 184);

  return y + cardH;
}

function drawBoardingPassCard(canvas: HTMLCanvasElement, options: CanvasRenderOptions): void {
  const { trip, lang, flightIndex = 0, theme = "dark" } = options;
  const logicalW = 540;
  const logicalH = 675;
  const dpr = 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = theme === "dark";
  ctx.save();
  ctx.scale(dpr, dpr);

  const grad = ctx.createLinearGradient(0, 0, logicalW, logicalH);
  if (isDark) {
    grad.addColorStop(0, "#09111F");
    grad.addColorStop(1, "#13294B");
  } else {
    grad.addColorStop(0, "#F1F5F9");
    grad.addColorStop(1, "#DCE8F7");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, logicalW, logicalH);

  // Header
  ctx.fillStyle = isDark ? "#38BDF8" : "#0284C7";
  ctx.font = `700 11px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText("GO TRAVEL · BOARDING PASS", 28, 40);

  ctx.fillStyle = isDark ? "#FFFFFF" : "#0F172A";
  ctx.font = `800 22px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, trip.name || trip.destination || "Boarding Pass", logicalW - 56), 28, 70);

  const flight = trip.flights?.[flightIndex] || trip.flights?.[0];
  if (!flight) {
    ctx.fillStyle = isDark ? "#94A3B8" : "#475569";
    ctx.font = `600 14px ${FONT_STACK}`;
    ctx.fillText(lang === "zh" ? "尚未新增航班資訊" : "No flight segments available", 28, 120);
    ctx.restore();
    return;
  }

  ctx.fillStyle = isDark ? "#CBD5E1" : "#334155";
  ctx.font = `600 12px ${FONT_STACK}`;
  ctx.fillText(
    `${flight.traveler_name || "Traveler"}  ·  ${flight.cabinClass || "Economy"}${flight.seat ? `  ·  Seat ${flight.seat}` : ""}`,
    28,
    96
  );

  let nextY = 122;
  if (flight.outbound) {
    nextY =
      drawBoardingSegment(
        ctx,
        flight.outbound,
        lang === "zh" ? "去程 OUTBOUND" : "OUTBOUND",
        flight.cabinClass,
        flight.baggage,
        lang,
        theme,
        28,
        nextY,
        logicalW - 56
      ) + 16;
  }

  if (flight.inbound) {
    nextY =
      drawBoardingSegment(
        ctx,
        flight.inbound,
        lang === "zh" ? "回程 INBOUND" : "INBOUND",
        flight.cabinClass,
        flight.baggage,
        lang,
        theme,
        28,
        nextY,
        logicalW - 56
      ) + 16;
  }

  // Bottom barcode strip
  const barY = Math.max(nextY + 8, logicalH - 84);
  drawBarcode(ctx, 48, barY, logicalW - 96, 36, flight.id || flight.outbound?.flightNumber || "PASS", isDark ? "#E2E8F0" : "#1E293B");
  ctx.fillStyle = isDark ? "#64748B" : "#64748B";
  ctx.font = `500 10px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("APPLE WALLET STYLE · GO TRAVEL", logicalW / 2, barY + 54);

  ctx.restore();
}

function drawLockscreenCard(canvas: HTMLCanvasElement, options: CanvasRenderOptions): void {
  const { trip, lang, dayIndex = 0, theme = "dark" } = options;
  const logicalW = 540;
  const logicalH = 1170; // 1080x2340 at 2x (9:19.5 ratio)
  const dpr = 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = theme === "dark";
  ctx.save();
  ctx.scale(dpr, dpr);

  const grad = ctx.createLinearGradient(0, 0, 0, logicalH);
  if (isDark) {
    grad.addColorStop(0, "#050A14");
    grad.addColorStop(0.45, "#0F1E36");
    grad.addColorStop(1, "#090D16");
  } else {
    grad.addColorStop(0, "#E0ECFA");
    grad.addColorStop(0.5, "#F5F8FD");
    grad.addColorStop(1, "#E8EFF9");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, logicalW, logicalH);

  // Top 28% clean safe-zone for iOS/Android lock screen clock
  const safeZoneBottom = Math.round(logicalH * 0.28);

  const day = trip.itinerary?.[dayIndex] || trip.itinerary?.[0];
  const dayTitle = day
    ? `DAY ${Math.min(dayIndex, Math.max((trip.itinerary?.length || 1) - 1, 0)) + 1} · ${day.date || ""}`
    : trip.destination || "TIMETABLE";

  let y = safeZoneBottom + 24;

  ctx.fillStyle = isDark ? "#38BDF8" : "#0284C7";
  ctx.font = `700 12px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText(truncateText(ctx, `${trip.name || "Go Travel"} · ${dayTitle}`, logicalW - 56), 28, y);
  y += 24;

  const stops = (day?.items || []).slice(0, 8);
  if (stops.length === 0) {
    drawRoundedRect(ctx, 28, y, logicalW - 56, 86, 20);
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.8)";
    ctx.fill();
    ctx.fillStyle = isDark ? "#94A3B8" : "#475569";
    ctx.font = `600 14px ${FONT_STACK}`;
    ctx.fillText(lang === "zh" ? "本日尚無排定行程" : "No stops scheduled for this day", 48, y + 48);
  } else {
    stops.forEach((item) => {
      const cardH = 82;
      drawRoundedRect(ctx, 28, y, logicalW - 56, cardH, 18);
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.85)";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.14)" : "rgba(15,23,42,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isDark ? "#38BDF8" : "#2563EB";
      ctx.font = `700 15px ${MONO_STACK}`;
      ctx.fillText(item.time || "--:--", 46, y + 34);

      ctx.fillStyle = isDark ? "#F8FAFC" : "#0F172A";
      ctx.font = `700 16px ${FONT_STACK}`;
      ctx.fillText(truncateText(ctx, item.placeName || "", logicalW - 170), 118, y + 34);

      const sub = [item.transportType || item.type, item.note?.trim()].filter(Boolean).join(" · ");
      ctx.fillStyle = isDark ? "#94A3B8" : "#475569";
      ctx.font = `500 12px ${FONT_STACK}`;
      ctx.fillText(truncateText(ctx, sub, logicalW - 170), 118, y + 58);

      y += cardH + 12;
    });
  }

  ctx.fillStyle = isDark ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.45)";
  ctx.font = `600 11px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("GO TRAVEL · LOCK SCREEN TIMETABLE", logicalW / 2, logicalH - 36);

  ctx.restore();
}

function drawStoryCard(canvas: HTMLCanvasElement, options: CanvasRenderOptions): void {
  const { trip, lang, dayIndex, theme = "dark" } = options;
  const logicalW = 540;
  const logicalH = 960; // 1080x1920 at 2x (9:16 ratio)
  const dpr = 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = theme === "dark";
  ctx.save();
  ctx.scale(dpr, dpr);

  const grad = ctx.createLinearGradient(0, 0, logicalW, logicalH);
  if (isDark) {
    grad.addColorStop(0, "#0A1020");
    grad.addColorStop(0.5, "#172A4D");
    grad.addColorStop(1, "#0D1526");
  } else {
    grad.addColorStop(0, "#EEF5FF");
    grad.addColorStop(0.5, "#F9FBFF");
    grad.addColorStop(1, "#E2EDFC");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, logicalW, logicalH);

  // Header card
  drawRoundedRect(ctx, 28, 44, logicalW - 56, 152, 24);
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)";
  ctx.fill();

  ctx.fillStyle = isDark ? "#38BDF8" : "#0284C7";
  ctx.font = `700 11px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText("GO TRAVEL · STORY", 50, 78);

  ctx.fillStyle = isDark ? "#FFFFFF" : "#0F172A";
  ctx.font = `800 26px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, trip.name || trip.destination || "My Journey", logicalW - 100), 50, 114);

  ctx.fillStyle = isDark ? "#CBD5E1" : "#475569";
  ctx.font = `600 13px ${FONT_STACK}`;
  ctx.fillText(
    truncateText(
      ctx,
      `📍 ${trip.destination || "-"}   ·   📅 ${trip.startDate || ""} ~ ${trip.endDate || ""}`,
      logicalW - 100
    ),
    50,
    146
  );

  const totalDays = trip.itinerary?.length || 0;
  const totalStops = (trip.itinerary || []).reduce(
    (sum, d) => sum + (d.items || []).filter((i) => i.type !== "Transport").length,
    0
  );
  ctx.fillStyle = isDark ? "#94A3B8" : "#64748B";
  ctx.font = `600 12px ${MONO_STACK}`;
  ctx.fillText(
    lang === "zh" ? `${totalDays} 天 · ${totalStops} 個行程亮點` : `${totalDays} DAYS · ${totalStops} STOPS`,
    50,
    174
  );

  let y = 224;
  const days =
    dayIndex != null && trip.itinerary?.[dayIndex]
      ? [{ day: trip.itinerary[dayIndex], idx: dayIndex }]
      : (trip.itinerary || []).slice(0, 4).map((day, idx) => ({ day, idx }));

  if (days.length === 0) {
    ctx.fillStyle = isDark ? "#94A3B8" : "#475569";
    ctx.font = `600 14px ${FONT_STACK}`;
    ctx.fillText(lang === "zh" ? "開始規劃你的下一趟旅行" : "Start planning your next adventure", 36, y + 30);
  } else {
    days.forEach(({ day, idx }) => {
      const highlights = (day.items || []).filter((i) => i.type !== "Transport").slice(0, 4);
      const boxH = Math.max(88, 52 + highlights.length * 28);
      if (y + boxH > logicalH - 76) return;

      drawRoundedRect(ctx, 28, y, logicalW - 56, boxH, 20);
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.88)";
      ctx.fill();

      ctx.fillStyle = isDark ? "#38BDF8" : "#2563EB";
      ctx.font = `700 13px ${MONO_STACK}`;
      ctx.fillText(`DAY ${idx + 1} · ${day.date || ""}`, 48, y + 30);

      highlights.forEach((item, i) => {
        ctx.fillStyle = isDark ? "#F8FAFC" : "#0F172A";
        ctx.font = `600 14px ${FONT_STACK}`;
        ctx.fillText(
          truncateText(ctx, `${item.time ? `${item.time}  ` : ""}${item.placeName}`, logicalW - 104),
          48,
          y + 58 + i * 28
        );
      });

      y += boxH + 14;
    });
  }

  // Footer watermark
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)";
  ctx.font = `700 12px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("Go Travel", logicalW / 2, logicalH - 34);

  ctx.restore();
}

/**
 * Renders a deterministic, zero-AI printable PNG canvas for the requested card type.
 * Gracefully handles environments where `getContext('2d')` returns null (such as jsdom).
 */
export function renderPrintableCanvas(
  type: PrintableCardType,
  options: CanvasRenderOptions
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  switch (type) {
    case "receipt":
      drawReceiptCard(canvas, options);
      break;
    case "boarding-pass":
      drawBoardingPassCard(canvas, options);
      break;
    case "lockscreen":
      drawLockscreenCard(canvas, options);
      break;
    case "story":
      drawStoryCard(canvas, options);
      break;
  }

  return canvas;
}

/**
 * Converts a canvas to a PNG data URL safely, returning '' if canvas export is unsupported.
 */
export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  try {
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null);
      }
    });
    if (blob) return blob;
  }

  const dataUrl = canvasToDataUrl(canvas);
  if (!dataUrl || !dataUrl.includes(",")) return null;
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "image/png" });
}

/**
 * Shares the rendered canvas via Web Share Level 2 (files) on supported mobile browsers,
 * falling back cleanly to a PNG `<a download>` trigger.
 */
export async function shareOrDownloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
  title: string
): Promise<"shared" | "downloaded"> {
  const safeName = `${sanitizeFilenameBase(filename.replace(/\.png$/i, ""), "gotravel-card")}.png`;
  const blob = (await canvasToPngBlob(canvas)) || new Blob([], { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    typeof File !== "undefined"
  ) {
    try {
      const file = new File([blob], safeName, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return "shared";
      }
    } catch {
      // Fall back to PNG download if Web Share fails or is unsupported
    }
  }

  triggerBlobDownload(blob, safeName);
  return "downloaded";
}
