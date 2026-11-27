import { Currency, Expense, FlightSegment, ItineraryItem, Language, TransportType, Trip } from "../../../types";
import { getRateToTwd } from "../../expenses/services/exchangeRateService";
import { calculateSplitwiseSettlement, SplitMember } from "../../expenses/services/splitwiseService";
import { getDefaultBaggage, inferAirlineId } from "../../flights/services/airlineBaggageService";
import { DateTimeUtils } from "../../../shared/services/dateTimeUtils";
import { sanitizeFilenameBase, triggerBlobDownload } from "./exportHelpers";

export type PrintableCardType = "receipt" | "boarding-pass" | "lockscreen" | "story";

export interface CanvasRenderOptions {
  trip: Trip;
  lang: Language;
  dayIndex?: number;
  flightIndex?: number;
  theme?: "light" | "dark";
  airlineLogos?: Record<string, HTMLImageElement | null>;
}

const airlineLogoCache = new Map<string, HTMLImageElement | null>();

/**
 * Loads an airline logo PNG from pics.avs.io with CORS enabled and caches it in memory.
 * Resolves `null` cleanly on error, timeout, invalid code, or SSR so export never hangs or fails.
 */
export function loadAirlineLogoImage(
  airlineID: string,
  timeoutMs = 2000
): Promise<HTMLImageElement | null> {
  const code = (airlineID || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code || typeof Image === "undefined") {
    return Promise.resolve(null);
  }
  if (airlineLogoCache.has(code)) {
    return Promise.resolve(airlineLogoCache.get(code) ?? null);
  }

  return new Promise<HTMLImageElement | null>((resolve) => {
    let settled = false;
    const finish = (img: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      airlineLogoCache.set(code, img);
      resolve(img);
    };

    const timer = setTimeout(() => finish(null), Math.max(0, timeoutMs));

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        finish(img.naturalWidth > 0 ? img : null);
      };
      img.onerror = () => {
        finish(null);
      };
      img.src = `https://pics.avs.io/200/200/${code}.png`;
      if (img.complete && img.naturalWidth > 0) {
        finish(img);
      }
    } catch {
      finish(null);
    }
  });
}

/**
 * Deduplicates repeated airline names joined by `' + '` (case-insensitive, preserving order).
 * Example: `"Emirates + Emirates"` -> `"Emirates"`.
 */
export function deduplicateAirlineName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed || !trimmed.includes("+")) return trimmed;
  const parts = trimmed
    .split(/\s*\+\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(part);
    }
  }
  return unique.join(" + ");
}

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", "Noto Sans TC", sans-serif';
const MONO_STACK = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

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

const TRANSPORT_EMOJI: Record<TransportType, string> = {
  Public: "🚇",
  Car: "🚗",
  Bicycle: "🚲",
  Walking: "🚶",
  Flight: "✈️",
};

const TRANSPORT_LABEL: Record<Language, Record<TransportType, string>> = {
  zh: {
    Public: "大眾運輸",
    Car: "開車",
    Bicycle: "單車",
    Walking: "步行",
    Flight: "飛行",
  },
  en: {
    Public: "Transit",
    Car: "Drive",
    Bicycle: "Bike",
    Walking: "Walk",
    Flight: "Flight",
  },
};

/* -------------------------------------------------------------------------- */
/* Crisp Vector Canvas Helpers                                                */
/* -------------------------------------------------------------------------- */

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

/**
 * Traces an authentic Apple Wallet PKPass card silhouette with semicircular
 * left/right tear-off notches at `notchY`.
 */
function drawNotchedPassCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  notchY: number,
  notchR: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  const clampedNotchY = Math.max(y + radius + notchR + 2, Math.min(y + h - radius - notchR - 2, notchY));

  ctx.beginPath();
  // Top edge & top-right corner
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);

  // Right edge down to right semicircular inward notch
  ctx.lineTo(x + w, clampedNotchY - notchR);
  if (typeof ctx.arc === "function") {
    ctx.arc(x + w, clampedNotchY, notchR, -Math.PI / 2, Math.PI / 2, true);
  } else {
    ctx.lineTo(x + w - notchR, clampedNotchY);
    ctx.lineTo(x + w, clampedNotchY + notchR);
  }
  ctx.lineTo(x + w, y + h - radius);

  // Bottom-right corner, bottom edge, bottom-left corner
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);

  // Left edge up to left semicircular inward notch
  ctx.lineTo(x, clampedNotchY + notchR);
  if (typeof ctx.arc === "function") {
    ctx.arc(x, clampedNotchY, notchR, Math.PI / 2, -Math.PI / 2, true);
  } else {
    ctx.lineTo(x + notchR, clampedNotchY);
    ctx.lineTo(x, clampedNotchY - notchR);
  }
  ctx.lineTo(x, y + radius);

  // Top-left corner
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Draws a subtle architectural dot-matrix pattern across the canvas backdrop.
 */
function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  spacing = 22
): void {
  ctx.save();
  ctx.fillStyle = color;
  for (let gx = spacing / 2; gx < w; gx += spacing) {
    for (let gy = spacing / 2; gy < h; gy += spacing) {
      ctx.fillRect(Math.round(gx), Math.round(gy), 1.25, 1.25);
    }
  }
  ctx.restore();
}

/**
 * Draws a crisp right-pointing vector airplane silhouette centered at (cx, cy).
 */
function drawAirplaneVector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  // Nose -> upper fuselage -> main swept wing -> rear fuselage -> tail fin -> tail end
  ctx.moveTo(11.5, 0);
  ctx.quadraticCurveTo(10.2, -1.7, 6.2, -1.8);
  ctx.lineTo(2.4, -1.8);
  ctx.lineTo(-3.2, -10.5);
  ctx.lineTo(-5.8, -10.5);
  ctx.lineTo(-2.4, -1.8);
  ctx.lineTo(-7.2, -1.6);
  ctx.lineTo(-9.8, -5.2);
  ctx.lineTo(-11.4, -5.2);
  ctx.lineTo(-9.8, -0.6);
  ctx.lineTo(-9.8, 0.6);
  ctx.lineTo(-11.4, 5.2);
  ctx.lineTo(-9.8, 5.2);
  ctx.lineTo(-7.2, 1.6);
  ctx.lineTo(-2.4, 1.8);
  ctx.lineTo(-5.8, 10.5);
  ctx.lineTo(-3.2, 10.5);
  ctx.lineTo(2.4, 1.8);
  ctx.lineTo(6.2, 1.8);
  ctx.quadraticCurveTo(10.2, 1.7, 11.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws a deterministic, crisp Code-128 style vector barcode with start/end guard bars.
 */
function drawBarcode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: string,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  const normalized = (seed || "GOTRAVEL-PASS").toUpperCase();
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // Start guard bars
  ctx.fillRect(Math.round(x), y, 2, h);
  ctx.fillRect(Math.round(x + 3.5), y, 1, h);
  ctx.fillRect(Math.round(x + 6), y, 2.5, h);

  let cursor = x + 10.5;
  const endLimit = x + w - 10;
  let idx = 0;

  while (cursor < endLimit) {
    const charCode = normalized.charCodeAt(idx % normalized.length) || 65;
    const mixed = Math.abs((hash >>> (idx % 16)) ^ (charCode * (idx + 7)));
    const widths = [1, 1.5, 2, 3];
    const barW = widths[mixed % widths.length];
    const gapW = widths[(mixed >> 2) % 3] + 0.5;

    if (cursor + barW <= endLimit) {
      ctx.fillRect(Math.round(cursor), y, barW, h);
    }
    cursor += barW + gapW;
    idx++;
  }

  // End guard bars
  ctx.fillRect(Math.round(x + w - 8), y, 2.5, h);
  ctx.fillRect(Math.round(x + w - 4), y, 1, h);
  ctx.fillRect(Math.round(x + w - 2), y, 2, h);
  ctx.restore();
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  dash: number[] = [4, 4],
  lineWidth = 1
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  opts: {
    bg: string;
    border?: string;
    color: string;
    font: string;
    padX?: number;
    height?: number;
    alignRight?: boolean;
  }
): { x: number; w: number; h: number } {
  const padX = opts.padX ?? 8;
  const h = opts.height ?? 20;
  ctx.save();
  ctx.font = opts.font;
  const tw = ctx.measureText(text).width;
  const w = Math.ceil(tw + padX * 2);
  const drawX = opts.alignRight ? x - w : x;

  drawRoundedRect(ctx, drawX, y, w, h, h / 2);
  ctx.fillStyle = opts.bg;
  ctx.fill();
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = opts.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, drawX + w / 2, y + h / 2 + 0.5);
  ctx.restore();

  return { x: drawX, w, h };
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

function drawDottedLeaderRow(
  ctx: CanvasRenderingContext2D,
  leftX: number,
  rightX: number,
  y: number,
  label: string,
  value: string,
  labelColor: string,
  valueColor: string,
  dotColor: string,
  font: string
): void {
  ctx.save();
  ctx.font = font;
  ctx.textBaseline = "alphabetic";

  const valueW = ctx.measureText(value).width;
  const maxLabelW = Math.max(40, rightX - leftX - valueW - 22);
  const clippedLabel = truncateText(ctx, label, maxLabelW);
  const labelW = ctx.measureText(clippedLabel).width;

  ctx.fillStyle = labelColor;
  ctx.textAlign = "left";
  ctx.fillText(clippedLabel, leftX, y);

  ctx.fillStyle = valueColor;
  ctx.textAlign = "right";
  ctx.fillText(value, rightX, y);

  const dotsStart = leftX + labelW + 7;
  const dotsEnd = rightX - valueW - 7;
  if (dotsEnd - dotsStart > 10) {
    ctx.fillStyle = dotColor;
    for (let dx = dotsStart; dx <= dotsEnd; dx += 5) {
      ctx.fillRect(dx, y - 2.5, 1.5, 1.5);
    }
  }
  ctx.restore();
}

function formatCompactTransportBadge(item: ItineraryItem, lang: Language): string {
  const mode: TransportType = item.transportType || "Public";
  const emoji = TRANSPORT_EMOJI[mode] || "🚇";
  const fallback = TRANSPORT_LABEL[lang]?.[mode] || mode;
  const detail = (item.placeName || "").trim();
  const note = (item.note || "").trim();
  if (detail && note && note.length <= 16) {
    return `${emoji} ${detail} · ${note}`;
  }
  return `${emoji} ${detail || fallback}`;
}

/* -------------------------------------------------------------------------- */
/* Expense / Splitwise Helpers                                                */
/* -------------------------------------------------------------------------- */

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
  const categoryTotals = new Map<string, { amount: number; count: number }>();
  const foreignTotals = new Map<Currency, number>();
  let totalTwd = 0;

  const addAmount = (category: string, amount: number, currency: Currency, customRate?: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rate = customRate && customRate > 0 ? customRate : getRateToTwd(currency);
    const twd = amount * rate;
    totalTwd += twd;
    const prev = categoryTotals.get(category) || { amount: 0, count: 0 };
    categoryTotals.set(category, { amount: prev.amount + twd, count: prev.count + 1 });
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
    categoryTotals: Array.from(categoryTotals.entries()).sort((a, b) => b[1].amount - a[1].amount),
    foreignTotals: Array.from(foreignTotals.entries()),
    totalTwd: Math.round(totalTwd),
    transfers,
    itemCount: (trip.expenses?.length || 0) + (trip.flights || []).filter((f) => f.price > 0).length,
  };
}

/* -------------------------------------------------------------------------- */
/* 1. Receipt Card — Boutique Japanese Thermal Paper Receipt                  */
/* -------------------------------------------------------------------------- */

function drawReceiptCard(canvas: HTMLCanvasElement, options: CanvasRenderOptions): void {
  const { trip, lang, theme = "light" } = options;
  const breakdown = computeReceiptBreakdown(trip);
  const catCount = Math.max(breakdown.categoryTotals.length, 1);
  const foreignCount = breakdown.foreignTotals.length;
  const transferCount = Math.max(breakdown.transfers.length, 1);

  const logicalW = 380;
  const logicalH = Math.max(630, 410 + catCount * 24 + foreignCount * 19 + transferCount * 24 + 130);
  const dpr = 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.scale(dpr, dpr);

  // Subtle Apple monochrome backdrop
  const bgGrad = ctx.createLinearGradient(0, 0, logicalW, logicalH);
  if (theme === "dark") {
    bgGrad.addColorStop(0, "#0A0C10");
    bgGrad.addColorStop(1, "#13161E");
  } else {
    bgGrad.addColorStop(0, "#F2F2F7");
    bgGrad.addColorStop(1, "#E5E5EA");
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, logicalW, logicalH);
  drawDotGrid(ctx, logicalW, logicalH, theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.045)", 18);

  const paperX = 22;
  const paperY = 22;
  const paperW = logicalW - 44;
  const paperH = logicalH - 44;
  const toothW = 9;
  const toothH = 6;

  // Build serrated zigzag thermal paper path
  const tracePaperPath = () => {
    ctx.beginPath();
    ctx.moveTo(paperX, paperY + toothH);
    for (let x = paperX; x < paperX + paperW; x += toothW) {
      const midX = Math.min(x + toothW / 2, paperX + paperW);
      const nextX = Math.min(x + toothW, paperX + paperW);
      ctx.lineTo(midX, paperY);
      ctx.lineTo(nextX, paperY + toothH);
    }
    ctx.lineTo(paperX + paperW, paperY + paperH - toothH);
    for (let x = paperX + paperW; x > paperX; x -= toothW) {
      const midX = Math.max(x - toothW / 2, paperX);
      const nextX = Math.max(x - toothW, paperX);
      ctx.lineTo(midX, paperY + paperH);
      ctx.lineTo(nextX, paperY + paperH - toothH);
    }
    ctx.closePath();
  };

  // Soft paper drop shadow + warm Japanese thermal paper fill (#FAF8F3)
  ctx.save();
  ctx.shadowColor = theme === "dark" ? "rgba(0,0,0,0.55)" : "rgba(15,23,42,0.16)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 10;
  tracePaperPath();
  ctx.fillStyle = "#FAF8F3";
  ctx.fill();
  ctx.restore();

  tracePaperPath();
  ctx.strokeStyle = "#E5DFD3";
  ctx.lineWidth = 1;
  ctx.stroke();

  const left = paperX + 22;
  const right = paperX + paperW - 22;
  const centerX = logicalW / 2;
  let y = paperY + 34;

  // Aviation emblem badge
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.arc === "function") {
    ctx.arc(centerX, y + 6, 15, 0, Math.PI * 2);
  } else {
    drawRoundedRect(ctx, centerX - 15, y - 9, 30, 30, 15);
  }
  ctx.fillStyle = "#111827";
  ctx.fill();
  drawAirplaneVector(ctx, centerX + 0.5, y + 6, 15, "#FAF8F3");
  ctx.restore();

  y += 38;
  ctx.fillStyle = "#111827";
  ctx.font = `800 16px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("GO TRAVEL", centerX, y);
  y += 14;

  ctx.fillStyle = "#78716C";
  ctx.font = `600 9px ${MONO_STACK}`;
  ctx.fillText("OFFICIAL TRAVEL EXPENSE RECEIPT", centerX, y);
  y += 22;

  ctx.fillStyle = "#18181B";
  ctx.font = `800 15px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, trip.name || "Trip Receipt", paperW - 44), centerX, y);
  y += 17;

  ctx.fillStyle = "#57534E";
  ctx.font = `500 10.5px ${MONO_STACK}`;
  const dateText = `${trip.startDate || "---"} ~ ${trip.endDate || "---"}`;
  ctx.fillText(truncateText(ctx, `${trip.destination || ""} · ${dateText}`.replace(/^\s*·\s*/, ""), paperW - 44), centerX, y);
  y += 15;

  // Receipt serial metadata row
  const receiptNo = `NO. GT-${(trip.startDate || "20260101").replace(/-/g, "").slice(2, 8)}-${String(Math.abs((trip.id || "001").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 900 + 100)}`;
  ctx.fillStyle = "#78716C";
  ctx.font = `500 9.5px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText(receiptNo, left, y);
  ctx.textAlign = "right";
  ctx.fillText(lang === "zh" ? `筆數 ${breakdown.itemCount}` : `ITEMS ${breakdown.itemCount}`, right, y);
  y += 12;

  // Classic monospace dashed rule
  ctx.fillStyle = "#A8A29E";
  ctx.font = `500 10px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("------------------------------------------", centerX, y + 4);
  y += 22;

  // Category Breakdown with dotted leaders
  ctx.textAlign = "left";
  ctx.fillStyle = "#57534E";
  ctx.font = `700 10px ${MONO_STACK}`;
  ctx.fillText(lang === "zh" ? "分類明細 / CATEGORY" : "CATEGORY BREAKDOWN", left, y);
  ctx.textAlign = "right";
  ctx.fillText("AMOUNT (TWD)", right, y);
  y += 19;

  const labels = CATEGORY_LABELS[lang] || CATEGORY_LABELS.en;
  if (breakdown.categoryTotals.length === 0) {
    ctx.fillStyle = "#78716C";
    ctx.font = `500 11.5px ${MONO_STACK}`;
    ctx.textAlign = "left";
    ctx.fillText(lang === "zh" ? "尚無支出紀錄" : "No expenses recorded", left, y);
    y += 24;
  } else {
    breakdown.categoryTotals.forEach(([cat, info]) => {
      const catLabel = `${labels[cat] || cat}${info.count > 1 ? ` ×${info.count}` : ""}`;
      drawDottedLeaderRow(
        ctx,
        left,
        right,
        y,
        catLabel,
        `NT$ ${Math.round(info.amount).toLocaleString()}`,
        "#292524",
        "#111827",
        "#C7C0B5",
        `600 11.5px ${MONO_STACK}`
      );
      y += 23;
    });
  }

  y += 6;
  // Prominent TOTAL Box
  const totalBoxH = 44 + foreignCount * 18;
  drawRoundedRect(ctx, left - 6, y, right - left + 12, totalBoxH, 8);
  ctx.fillStyle = "#F2EEE5";
  ctx.fill();
  ctx.strokeStyle = "#D6CFC1";
  ctx.lineWidth = 1;
  ctx.stroke();

  y += 28;
  ctx.fillStyle = "#111827";
  ctx.font = `800 13px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText("TOTAL (TWD)", left + 4, y);
  ctx.font = `800 17px ${MONO_STACK}`;
  ctx.textAlign = "right";
  ctx.fillText(`NT$ ${breakdown.totalTwd.toLocaleString()}`, right - 4, y);
  y += 18;

  breakdown.foreignTotals.forEach(([cur, amt]) => {
    ctx.fillStyle = "#57534E";
    ctx.font = `600 10.5px ${MONO_STACK}`;
    ctx.textAlign = "left";
    ctx.fillText(`FOREIGN · ${cur}`, left + 4, y);
    ctx.textAlign = "right";
    ctx.fillText(`${cur} ${Math.round(amt).toLocaleString()}`, right - 4, y);
    y += 18;
  });

  y += 16;

  // Dedicated SPLITWISE SETTLEMENT Box
  const splitBoxTop = y;
  const splitBoxH = 38 + transferCount * 22 + 10;
  drawRoundedRect(ctx, left - 6, splitBoxTop, right - left + 12, splitBoxH, 8);
  ctx.fillStyle = "#F6F3EC";
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = "#CFC7B8";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.stroke();
  ctx.restore();

  y += 20;
  ctx.textAlign = "left";
  ctx.fillStyle = "#44403C";
  ctx.font = `800 10px ${MONO_STACK}`;
  ctx.fillText(lang === "zh" ? "SPLITWISE SETTLEMENT · AA 結算" : "SPLITWISE SETTLEMENT", left + 4, y);
  y += 20;

  if (breakdown.transfers.length === 0) {
    ctx.fillStyle = "#047857";
    ctx.font = `700 11px ${MONO_STACK}`;
    ctx.fillText(lang === "zh" ? "✓ 全員帳目已結清" : "✓ ALL BALANCES SETTLED", left + 4, y);
    y += 22;
  } else {
    breakdown.transfers.forEach((tr) => {
      drawDottedLeaderRow(
        ctx,
        left + 4,
        right - 4,
        y,
        `${tr.fromName} → ${tr.toName}`,
        `NT$ ${tr.amount.toLocaleString()}`,
        "#1C1917",
        "#111827",
        "#CFC7B8",
        `600 11px ${MONO_STACK}`
      );
      y += 22;
    });
  }

  // Tilted translucent red double-bordered rubber stamp
  const stampY = Math.max(y + 18, splitBoxTop + splitBoxH + 14);
  ctx.save();
  ctx.translate(right - 56, stampY);
  ctx.rotate(-0.16);
  ctx.globalAlpha = 0.82;
  ctx.strokeStyle = "#DC2626";
  ctx.lineWidth = 2.2;
  drawRoundedRect(ctx, -62, -20, 124, 40, 7);
  ctx.stroke();
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, -58, -16, 116, 32, 4.5);
  ctx.stroke();

  ctx.fillStyle = "#DC2626";
  ctx.font = `900 12px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(lang === "zh" ? "SETTLED / 已結算" : "SETTLED", 0, 0.5);
  ctx.restore();

  // Crisp bottom vector barcode
  const barcodeY = Math.max(stampY + 34, paperY + paperH - 86);
  drawDashedLine(ctx, left, barcodeY - 12, right, barcodeY - 12, "#D6CFC1", [3, 3]);
  drawBarcode(ctx, left + 12, barcodeY, right - left - 24, 34, `${trip.id || trip.name}-${breakdown.totalTwd}`, "#18181B");

  ctx.fillStyle = "#78716C";
  ctx.font = `600 9px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("THANK YOU FOR TRAVELING · GO TRAVEL", centerX, barcodeY + 50);

  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* 2. Boarding Pass Card — Apple Wallet PKPass × Flighty Aesthetic            */
/* -------------------------------------------------------------------------- */

function formatBaggagePillLabel(allowance?: { count: number; weight: string }): string | null {
  if (!allowance || allowance.count <= 0) return null;
  const w = (allowance.weight || "").trim();
  return w ? `${allowance.count}×${w}` : `${allowance.count}pc`;
}

/**
 * Draws a crisp vector carry-on briefcase icon centered at (cx, cy).
 */
function drawCarryOnBriefcaseIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  const s = size / 12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Top handle arch
  ctx.beginPath();
  ctx.moveTo(-2.1, -2.1);
  ctx.lineTo(-2.1, -3.5);
  ctx.quadraticCurveTo(-2.1, -4.3, -1.3, -4.3);
  ctx.lineTo(1.3, -4.3);
  ctx.quadraticCurveTo(2.1, -4.3, 2.1, -3.5);
  ctx.lineTo(2.1, -2.1);
  ctx.stroke();

  // Briefcase body
  drawRoundedRect(ctx, -5.2, -2.1, 10.4, 6.8, 1.5);
  ctx.stroke();

  // Horizontal latch seam
  ctx.beginPath();
  ctx.moveTo(-5.0, 0.5);
  ctx.lineTo(5.0, 0.5);
  ctx.stroke();

  // Center clasp tick
  ctx.fillRect(-0.85, -0.35, 1.7, 1.7);
  ctx.restore();
}

/**
 * Draws a crisp vector checked rolling suitcase icon centered at (cx, cy).
 */
function drawCheckedLuggageIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  const s = size / 12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.25;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Telescoping handle
  ctx.beginPath();
  ctx.moveTo(-1.8, -2.6);
  ctx.lineTo(-1.8, -4.7);
  ctx.quadraticCurveTo(-1.8, -5.3, -1.2, -5.3);
  ctx.lineTo(1.2, -5.3);
  ctx.quadraticCurveTo(1.8, -5.3, 1.8, -4.7);
  ctx.lineTo(1.8, -2.6);
  ctx.stroke();

  // Upright suitcase body
  drawRoundedRect(ctx, -3.9, -2.6, 7.8, 7.2, 1.4);
  ctx.stroke();

  // Vertical Rimowa-style ribs
  ctx.lineWidth = 0.95;
  ctx.beginPath();
  ctx.moveTo(-1.4, -1.2);
  ctx.lineTo(-1.4, 3.3);
  ctx.moveTo(1.4, -1.2);
  ctx.lineTo(1.4, 3.3);
  ctx.stroke();

  // Bottom spinner wheels
  ctx.fillRect(-2.8, 4.7, 1.3, 1.1);
  ctx.fillRect(1.5, 4.7, 1.3, 1.1);
  ctx.restore();
}

/**
 * Draws a baggage allowance pill with a crisp vector icon (no OS emojis).
 */
function drawBaggagePill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: "carryOn" | "checked",
  text: string,
  opts: {
    bg: string;
    border?: string;
    color: string;
    iconColor?: string;
    font: string;
    padX?: number;
    height?: number;
    alignRight?: boolean;
  }
): { x: number; w: number; h: number } {
  const padX = opts.padX ?? 7;
  const h = opts.height ?? 18;
  const iconSize = 10;
  const iconGap = 4.5;

  ctx.save();
  ctx.font = opts.font;
  const tw = ctx.measureText(text).width;
  const w = Math.ceil(padX + iconSize + iconGap + tw + padX);
  const drawX = opts.alignRight ? x - w : x;

  drawRoundedRect(ctx, drawX, y, w, h, h / 2);
  ctx.fillStyle = opts.bg;
  ctx.fill();
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const iconCx = drawX + padX + iconSize / 2;
  const iconCy = y + h / 2;
  const iconStroke = opts.iconColor || opts.color;
  if (kind === "checked") {
    drawCheckedLuggageIcon(ctx, iconCx, iconCy, iconSize, iconStroke);
  } else {
    drawCarryOnBriefcaseIcon(ctx, iconCx, iconCy, iconSize, iconStroke);
  }

  ctx.fillStyle = opts.color;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, drawX + padX + iconSize + iconGap, y + h / 2 + 0.5);
  ctx.restore();

  return { x: drawX, w, h };
}

interface ExpandedBoardingPass {
  seg: FlightSegment;
  direction: "outbound" | "inbound";
  legIndex: number;
  legCount: number;
  parentBaggage?: Trip["flights"][number]["baggage"];
}

function expandFlightPasses(flight?: Trip["flights"][number]): ExpandedBoardingPass[] {
  if (!flight) return [];
  const passes: ExpandedBoardingPass[] = [];

  if (flight.outbound) {
    const outSegs =
      flight.outbound.segments && flight.outbound.segments.length > 0
        ? flight.outbound.segments
        : [flight.outbound];
    outSegs.forEach((seg, idx) => {
      passes.push({
        seg,
        direction: "outbound",
        legIndex: idx + 1,
        legCount: outSegs.length,
        parentBaggage: flight.outbound.baggage || flight.baggage,
      });
    });
  }

  const hasInbound = Boolean(
    flight.inbound &&
      (flight.inbound.segments?.length ||
        flight.inbound.flightNumber ||
        flight.inbound.departureAirport)
  );
  if (hasInbound && flight.inbound) {
    const inSegs =
      flight.inbound.segments && flight.inbound.segments.length > 0
        ? flight.inbound.segments
        : [flight.inbound];
    inSegs.forEach((seg, idx) => {
      passes.push({
        seg,
        direction: "inbound",
        legIndex: idx + 1,
        legCount: inSegs.length,
        parentBaggage: flight.inbound?.baggage || flight.baggage,
      });
    });
  }

  return passes;
}

function drawNotchedFlightPass(
  ctx: CanvasRenderingContext2D,
  opts: {
    seg: FlightSegment;
    direction: "outbound" | "inbound";
    legIndex?: number;
    legCount?: number;
    traveler: string;
    cabinClass?: string;
    seat?: string;
    fallbackBaggage?: Trip["flights"][number]["baggage"];
    logoImg?: HTMLImageElement | null;
    lang: Language;
    theme: "light" | "dark";
    x: number;
    y: number;
    w: number;
    h: number;
    compact: boolean;
  }
): void {
  const {
    seg,
    direction,
    legIndex = 1,
    legCount = 1,
    traveler,
    cabinClass,
    seat,
    fallbackBaggage,
    logoImg,
    lang,
    theme,
    x,
    y,
    w,
    h,
    compact,
  } = opts;
  const isDark = theme === "dark";
  const isOutbound = direction === "outbound";
  const appleBlue = isDark ? "#0A84FF" : "#007AFF";
  const notchR = compact ? 10 : 12;
  const stubH = compact ? 84 : 136;
  const notchY = y + h - stubH;

  // Card surface with drop shadow
  ctx.save();
  ctx.shadowColor = isDark ? "rgba(0,0,0,0.55)" : "rgba(15,23,42,0.09)";
  ctx.shadowBlur = isDark ? 22 : 18;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 8;
  drawNotchedPassCard(ctx, x, y, w, h, 24, notchY, notchR);
  ctx.fillStyle = isDark ? "#13161E" : "#FFFFFF";
  ctx.fill();
  ctx.restore();

  // Clip inside notched card to paint subtle top hairline & tinted bottom stub
  ctx.save();
  drawNotchedPassCard(ctx, x, y, w, h, 24, notchY, notchR);
  if (typeof ctx.clip === "function") {
    ctx.clip();
  }
  // Tinted stub area below perforation line
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.025)" : "rgba(15,23,42,0.025)";
  ctx.fillRect(x, notchY, w, stubH);

  // Clean single-tone top accent hairline (Apple Blue for outbound, subtle monochrome hairline for inbound)
  ctx.fillStyle = isOutbound
    ? appleBlue
    : isDark
      ? "rgba(255,255,255,0.18)"
      : "rgba(15,23,42,0.14)";
  ctx.fillRect(x, y, w, 2.5);
  ctx.restore();

  // Crisp outer border along notched silhouette
  drawNotchedPassCard(ctx, x, y, w, h, 24, notchY, notchR);
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Dashed perforation tear-line between semicircular notches
  drawDashedLine(
    ctx,
    x + notchR + 6,
    notchY,
    x + w - notchR - 6,
    notchY,
    isDark ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.14)",
    [5, 4],
    1.25
  );

  const pad = 22;
  const innerLeft = x + pad;
  const innerRight = x + w - pad;

  // --- TOP BAR: Airline Badge Squircle + Airline Name + Flight Pill + Cabin & Baggage Pills ---
  const topY = y + (compact ? 16 : 24);
  const sqSize = compact ? 34 : 42;
  const airlineCode = (seg.airlineID || inferAirlineId(seg.flightNumber) || "AIR").toUpperCase().slice(0, 3);
  const rawAirlineName =
    (lang === "zh" ? seg.airlineNameZh : seg.airlineNameEn) ||
    seg.airlineNameEn ||
    seg.airline ||
    airlineCode;
  const airlineName = deduplicateAirlineName(rawAirlineName) || airlineCode;

  // Airline badge squircle: draw real airline logo on Apple Wallet white squircle when available
  let drewAirlineLogo = false;
  if (logoImg && logoImg.naturalWidth > 0 && typeof ctx.drawImage === "function") {
    try {
      drawRoundedRect(ctx, innerLeft, topY, sqSize, sqSize, 10);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(15,23,42,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const logoPad = compact ? 4.5 : 5.5;
      const boxW = sqSize - logoPad * 2;
      const boxH = sqSize - logoPad * 2;
      const natW = logoImg.naturalWidth;
      const natH = logoImg.naturalHeight > 0 ? logoImg.naturalHeight : natW;
      const imgRatio = natW / natH;
      const drawW = imgRatio >= 1 ? boxW : boxH * imgRatio;
      const drawH = imgRatio >= 1 ? boxW / imgRatio : boxH;
      const drawX = innerLeft + (sqSize - drawW) / 2;
      const drawY = topY + (sqSize - drawH) / 2;

      ctx.save();
      drawRoundedRect(ctx, innerLeft + 1, topY + 1, sqSize - 2, sqSize - 2, 9);
      if (typeof ctx.clip === "function") {
        ctx.clip();
      }
      ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
      ctx.restore();
      drewAirlineLogo = true;
    } catch {
      // Clear white squircle before falling back so dark mode has no white tint artifact
      drawRoundedRect(ctx, innerLeft, topY, sqSize, sqSize, 10);
      ctx.fillStyle = isDark ? "#13161E" : "#FFFFFF";
      ctx.fill();
      drewAirlineLogo = false;
    }
  }

  if (!drewAirlineLogo) {
    drawRoundedRect(ctx, innerLeft, topY, sqSize, sqSize, 10);
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.06)" : "#F2F2F7";
    ctx.fill();
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    drawAirplaneVector(
      ctx,
      innerLeft + sqSize / 2,
      topY + sqSize * 0.36,
      compact ? 11 : 13,
      appleBlue
    );
    ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
    ctx.font = `800 ${compact ? 9 : 10}px ${MONO_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(airlineCode, innerLeft + sqSize / 2, topY + sqSize - 5);
  }

  // Direction label + Airline name
  const nameX = innerLeft + sqSize + 11;
  const isMultiLeg = legCount > 1;
  const dirText = isMultiLeg
    ? isOutbound
      ? lang === "zh"
        ? `去程 · 航段 ${legIndex}`
        : `OUTBOUND · LEG ${legIndex}`
      : lang === "zh"
        ? `回程 · 航段 ${legIndex}`
        : `INBOUND · LEG ${legIndex}`
    : isOutbound
      ? lang === "zh"
        ? "去程 OUTBOUND"
        : "OUTBOUND"
      : lang === "zh"
        ? "回程 INBOUND"
        : "INBOUND";
  ctx.fillStyle = isOutbound ? appleBlue : isDark ? "#8E8E93" : "#6E6E73";
  ctx.font = `800 9px ${MONO_STACK}`;
  ctx.textAlign = "left";
  ctx.fillText(dirText, nameX, topY + 11);

  ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
  ctx.font = `800 ${compact ? 14 : 17}px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, airlineName, w * 0.42), nameX, topY + (compact ? 29 : 34));

  // Right side pills: Flight number pill + Cabin & Baggage pills
  const flightNo = (seg.flightNumber || airlineCode).toUpperCase();
  const flightPill = drawPill(ctx, innerRight, topY, flightNo, {
    bg: isDark ? "rgba(10,132,255,0.16)" : "rgba(0,122,255,0.10)",
    border: isDark ? "rgba(10,132,255,0.32)" : "rgba(0,122,255,0.22)",
    color: appleBlue,
    font: `800 11px ${MONO_STACK}`,
    padX: 9,
    height: 21,
    alignRight: true,
  });

  // Cabin pill next to flight pill
  const cabinLabel = cabinClass || "Economy";
  drawPill(ctx, flightPill.x - 6, topY, cabinLabel, {
    bg: isDark ? "rgba(255,255,255,0.06)" : "#F2F2F7",
    border: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
    color: isDark ? "#AEAEB2" : "#6E6E73",
    font: `700 10px ${FONT_STACK}`,
    padX: 8,
    height: 21,
    alignRight: true,
  });

  // Baggage icon pills row (carry-on & checked with crisp vector icons)
  const baggage =
    seg.baggage ||
    fallbackBaggage ||
    getDefaultBaggage(seg.airlineID || inferAirlineId(seg.flightNumber), cabinClass);
  const carryLabel = formatBaggagePillLabel(baggage?.carryOn);
  const checkedLabel = formatBaggagePillLabel(baggage?.checked);
  let bagCursorX = innerRight;
  const bagPillY = topY + 25;
  if (checkedLabel) {
    const p = drawBaggagePill(ctx, bagCursorX, bagPillY, "checked", checkedLabel, {
      bg: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7",
      border: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
      color: isDark ? "#8E8E93" : "#6E6E73",
      iconColor: isDark ? "#AEAEB2" : "#3A3A3C",
      font: `700 9.5px ${MONO_STACK}`,
      padX: 7,
      height: 18,
      alignRight: true,
    });
    bagCursorX = p.x - 5;
  }
  if (carryLabel) {
    drawBaggagePill(ctx, bagCursorX, bagPillY, "carryOn", carryLabel, {
      bg: isDark ? "rgba(255,255,255,0.05)" : "#F2F2F7",
      border: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
      color: isDark ? "#8E8E93" : "#6E6E73",
      iconColor: isDark ? "#AEAEB2" : "#3A3A3C",
      font: `700 9.5px ${MONO_STACK}`,
      padX: 7,
      height: 18,
      alignRight: true,
    });
  }

  // Subtle hairline divider under top bar
  const dividerY = topY + (compact ? 49 : 58);
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)";
  ctx.fillRect(innerLeft, dividerY, innerRight - innerLeft, 1);

  // --- CENTER HERO: Giant DEP — dashed path + Apple Blue circle vector airplane — ARR ---
  const heroCenterY = dividerY + (notchY - dividerY) * 0.44;
  const codeFontSize = compact ? 38 : 48;
  const timeFontSize = compact ? 16 : 20;
  const accentBlue = appleBlue;

  const depCode = (seg.departureAirport || "---").toUpperCase();
  const arrCode = (seg.arrivalAirport || "---").toUpperCase();
  const depTime = DateTimeUtils.formatTime24(seg.departureTime) || "--:--";
  const arrTime = DateTimeUtils.formatTime24(seg.arrivalTime) || "--:--";
  const depDate = DateTimeUtils.formatDateFriendly(seg.departureTime, lang);
  const arrDate = DateTimeUtils.formatDateFriendly(seg.arrivalTime, lang);

  // DEP column (left)
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
  ctx.font = `800 ${codeFontSize}px ${MONO_STACK}`;
  ctx.fillText(depCode, innerLeft, heroCenterY + 2);

  ctx.fillStyle = accentBlue;
  ctx.font = `800 ${timeFontSize}px ${MONO_STACK}`;
  ctx.fillText(depTime, innerLeft, heroCenterY + (compact ? 25 : 30));

  ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
  ctx.font = `700 10.5px ${MONO_STACK}`;
  ctx.fillText(depDate, innerLeft, heroCenterY + (compact ? 41 : 48));

  // ARR column (right)
  ctx.textAlign = "right";
  ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
  ctx.font = `800 ${codeFontSize}px ${MONO_STACK}`;
  ctx.fillText(arrCode, innerRight, heroCenterY + 2);

  ctx.fillStyle = accentBlue;
  ctx.font = `800 ${timeFontSize}px ${MONO_STACK}`;
  ctx.fillText(arrTime, innerRight, heroCenterY + (compact ? 25 : 30));

  ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
  ctx.font = `700 10.5px ${MONO_STACK}`;
  ctx.fillText(arrDate, innerRight, heroCenterY + (compact ? 41 : 48));

  // Flight track in center
  const trackLeft = innerLeft + (compact ? 94 : 118);
  const trackRight = innerRight - (compact ? 94 : 118);
  const trackY = heroCenterY - 12;
  const trackMidX = (trackLeft + trackRight) / 2;

  drawDashedLine(
    ctx,
    trackLeft,
    trackY,
    trackRight,
    trackY,
    isDark ? "rgba(255,255,255,0.20)" : "rgba(15,23,42,0.16)",
    [5, 4],
    1.5
  );

  // Endpoint dots
  ctx.save();
  ctx.fillStyle = accentBlue;
  if (typeof ctx.arc === "function") {
    ctx.beginPath();
    ctx.arc(trackLeft, trackY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(trackRight, trackY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center Apple Blue circle badge with vector airplane
  const circleR = compact ? 15 : 18;
  ctx.beginPath();
  if (typeof ctx.arc === "function") {
    ctx.arc(trackMidX, trackY, circleR, 0, Math.PI * 2);
  } else {
    drawRoundedRect(ctx, trackMidX - circleR, trackY - circleR, circleR * 2, circleR * 2, circleR);
  }
  ctx.fillStyle = accentBlue;
  ctx.fill();
  ctx.strokeStyle = isDark ? "#13161E" : "#FFFFFF";
  ctx.lineWidth = 3;
  ctx.stroke();
  drawAirplaneVector(ctx, trackMidX + 0.5, trackY, compact ? 14 : 17, "#FFFFFF");
  ctx.restore();

  // Flight number / seat under center track
  ctx.textAlign = "center";
  ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
  ctx.font = `700 10.5px ${MONO_STACK}`;
  ctx.fillText(seat ? `${flightNo} · SEAT ${seat}` : flightNo, trackMidX, trackY + (compact ? 29 : 34));

  // --- BOTTOM STUB: Traveler, Terminal, Gate + Crisp Vector Barcode ---
  const stubLabelY = notchY + (compact ? 24 : 34);
  const stubValY = stubLabelY + (compact ? 18 : 22);
  const labelColor = isDark ? "#8E8E93" : "#6E6E73";
  const valColor = isDark ? "#F5F5F7" : "#1D1D1F";

  const drawMetaCell = (cx: number, label: string, value: string, maxW: number) => {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = labelColor;
    ctx.font = `700 9px ${MONO_STACK}`;
    ctx.fillText(label, cx, stubLabelY);
    ctx.fillStyle = valColor;
    ctx.font = `800 ${compact ? 13 : 15}px ${MONO_STACK}`;
    ctx.fillText(truncateText(ctx, value, maxW), cx, stubValY);
  };

  if (compact) {
    drawMetaCell(innerLeft, lang === "zh" ? "旅客 PASSENGER" : "PASSENGER", traveler || "TRAVELER", 118);
    drawMetaCell(innerLeft + 128, "TERMINAL", seg.terminal ? `T${seg.terminal}` : "TBA", 66);
    drawMetaCell(innerLeft + 202, "GATE", seg.gate || "TBA", 56);

    const barW = 148;
    const barH = 38;
    const barX = innerRight - barW;
    const barY = notchY + 16;
    drawBarcode(ctx, barX, barY, barW, barH, `${flightNo}-${depCode}-${arrCode}-${traveler}`, isDark ? "#F5F5F7" : "#1D1D1F");

    ctx.textAlign = "center";
    ctx.fillStyle = labelColor;
    ctx.font = `600 8.5px ${MONO_STACK}`;
    ctx.fillText(`${flightNo} · ${depCode}→${arrCode}`, barX + barW / 2, barY + barH + 14);
  } else {
    drawMetaCell(innerLeft, lang === "zh" ? "旅客 PASSENGER" : "PASSENGER", traveler || "TRAVELER", 160);
    drawMetaCell(innerLeft + 174, "TERMINAL", seg.terminal ? `T${seg.terminal}` : "TBA", 78);
    drawMetaCell(innerLeft + 266, "GATE", seg.gate || "TBA", 74);
    drawMetaCell(innerLeft + 352, "SEAT", seat || "TBA", 74);

    const barY = notchY + 74;
    const barW = innerRight - innerLeft;
    drawBarcode(ctx, innerLeft, barY, barW, 40, `${flightNo}-${depCode}-${arrCode}-${traveler}`, isDark ? "#F5F5F7" : "#1D1D1F");

    ctx.textAlign = "center";
    ctx.fillStyle = labelColor;
    ctx.font = `600 9px ${MONO_STACK}`;
    ctx.fillText(`${flightNo} · ${depCode} → ${arrCode} · ${traveler || "TRAVELER"}`, x + w / 2, barY + 53);
  }
}

function drawBoardingPassCard(canvas: HTMLCanvasElement, options: CanvasRenderOptions): void {
  const { trip, lang, flightIndex = 0, theme = "dark" } = options;
  const flight = trip.flights?.[flightIndex] || trip.flights?.[0];
  const passes = expandFlightPasses(flight);

  const logicalW = 540;
  const passStartY = 80;
  const compactPassH = 272;
  const compactGap = 16;
  const bottomFooterPad = 35;
  const logicalH =
    passes.length >= 2
      ? passStartY +
        passes.length * compactPassH +
        (passes.length - 1) * compactGap +
        bottomFooterPad
      : 675; // 1080x1350 at 2x for 0–2 passes, expands cleanly for 3+ layover passes
  const dpr = 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = theme === "dark";
  const appleBlue = isDark ? "#0A84FF" : "#007AFF";
  ctx.save();
  ctx.scale(dpr, dpr);

  // Pure refined Apple monochrome backdrop + subtle dot grid
  ctx.fillStyle = isDark ? "#0A0C10" : "#F2F2F7";
  ctx.fillRect(0, 0, logicalW, logicalH);
  drawDotGrid(ctx, logicalW, logicalH, isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)", 20);

  // Header
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = appleBlue;
  ctx.font = `800 10.5px ${MONO_STACK}`;
  ctx.fillText("GO TRAVEL · BOARDING PASS", 26, 36);

  ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
  ctx.font = `800 20px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, trip.name || trip.destination || "Boarding Pass", logicalW - 52), 26, 62);

  if (!flight || passes.length === 0) {
    drawNotchedPassCard(ctx, 26, 110, logicalW - 52, 240, 24, 270, 12);
    ctx.fillStyle = isDark ? "#13161E" : "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
    ctx.stroke();

    ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
    ctx.font = `700 14px ${FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.fillText(lang === "zh" ? "尚未新增航班資訊" : "No flight segments available", logicalW / 2, 200);
    ctx.restore();
    return;
  }

  const resolveSegmentLogo = (seg?: FlightSegment): HTMLImageElement | null => {
    if (!seg || !options.airlineLogos) return null;
    const code = (seg.airlineID || inferAirlineId(seg.flightNumber) || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    return code ? options.airlineLogos[code] ?? null : null;
  };

  if (passes.length >= 2) {
    passes.forEach((pass, idx) => {
      drawNotchedFlightPass(ctx, {
        seg: pass.seg,
        direction: pass.direction,
        legIndex: pass.legIndex,
        legCount: pass.legCount,
        traveler: flight.traveler_name || "TRAVELER",
        cabinClass: flight.cabinClass,
        seat: flight.seat,
        fallbackBaggage: pass.parentBaggage,
        logoImg: resolveSegmentLogo(pass.seg),
        lang,
        theme,
        x: 24,
        y: passStartY + idx * (compactPassH + compactGap),
        w: logicalW - 48,
        h: compactPassH,
        compact: true,
      });
    });
  } else {
    const pass = passes[0];
    drawNotchedFlightPass(ctx, {
      seg: pass.seg,
      direction: pass.direction,
      legIndex: pass.legIndex,
      legCount: pass.legCount,
      traveler: flight.traveler_name || "TRAVELER",
      cabinClass: flight.cabinClass,
      seat: flight.seat,
      fallbackBaggage: pass.parentBaggage,
      logoImg: resolveSegmentLogo(pass.seg),
      lang,
      theme,
      x: 24,
      y: 112,
      w: logicalW - 48,
      h: 452,
      compact: false,
    });
  }

  // Footer
  ctx.fillStyle = isDark ? "rgba(142,142,147,0.75)" : "rgba(110,110,115,0.75)";
  ctx.font = `600 9.5px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("APPLE WALLET STYLE · GO TRAVEL", logicalW / 2, logicalH - 16);

  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* 3. Lock Screen Card — 1080×2340 (9:19.5) iOS 27 Minimal Timeline           */
/* -------------------------------------------------------------------------- */

function drawLockscreenCard(canvas: HTMLCanvasElement, options: CanvasRenderOptions): void {
  const { trip, lang, dayIndex = 0, theme = "dark" } = options;
  const logicalW = 540;
  const logicalH = 1170; // 1080x2340 at 2x
  const dpr = 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = theme === "dark";
  const appleBlue = isDark ? "#0A84FF" : "#007AFF";
  ctx.save();
  ctx.scale(dpr, dpr);

  // Pure refined Apple monochrome backdrop + subtle dot grid
  ctx.fillStyle = isDark ? "#0A0C10" : "#F2F2F7";
  ctx.fillRect(0, 0, logicalW, logicalH);
  drawDotGrid(ctx, logicalW, logicalH, isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)", 22);

  // Top 28% clean safe-zone for lock screen clock
  const safeZoneBottom = Math.round(logicalH * 0.28);

  const clampedDayIdx = Math.min(dayIndex, Math.max((trip.itinerary?.length || 1) - 1, 0));
  const day = trip.itinerary?.[clampedDayIdx] || trip.itinerary?.[0];
  const dayLabel = day
    ? `DAY ${clampedDayIdx + 1}${day.date ? ` · ${day.date}` : ""}`
    : "TIMETABLE";

  let y = safeZoneBottom + 16;

  // Header pill + trip title
  drawPill(ctx, 28, y, dayLabel, {
    bg: isDark ? "rgba(10,132,255,0.16)" : "rgba(0,122,255,0.10)",
    border: isDark ? "rgba(10,132,255,0.32)" : "rgba(0,122,255,0.22)",
    color: appleBlue,
    font: `800 11px ${MONO_STACK}`,
    padX: 10,
    height: 22,
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
  ctx.font = `800 22px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, trip.name || trip.destination || "Go Travel", logicalW - 56), 28, y + 48);

  y += 68;
  const items = day?.items || [];
  const spineX = 44;

  if (items.length === 0) {
    drawRoundedRect(ctx, 28, y, logicalW - 56, 86, 20);
    ctx.fillStyle = isDark ? "#13161E" : "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
    ctx.font = `600 14px ${FONT_STACK}`;
    ctx.fillText(lang === "zh" ? "本日尚無排定行程" : "No stops scheduled for this day", 48, y + 48);
  } else {
    // Clean vertical timeline spine behind items
    const maxBottomY = logicalH - 72;
    const layoutEntries: Array<{ item: ItineraryItem; top: number; height: number; isTransport: boolean }> = [];
    let cursorY = y;

    for (const item of items) {
      const isTransport = item.type === "Transport";
      const h = isTransport ? 26 : 74;
      if (cursorY + h > maxBottomY) break;
      layoutEntries.push({ item, top: cursorY, height: h, isTransport });
      cursorY += h + (isTransport ? 8 : 10);
    }

    if (layoutEntries.length > 1) {
      const spineTop = layoutEntries[0].top + 24;
      const last = layoutEntries[layoutEntries.length - 1];
      const spineBottom = last.top + last.height / 2;
      ctx.save();
      ctx.strokeStyle = isDark ? "rgba(10,132,255,0.45)" : "rgba(0,122,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spineX, spineTop);
      ctx.lineTo(spineX, spineBottom);
      ctx.stroke();
      ctx.restore();
    }

    for (const entry of layoutEntries) {
      const { item, top, height, isTransport } = entry;
      if (isTransport) {
        // Compact inline transport micro-badge on the spine
        const label = truncateText(ctx, formatCompactTransportBadge(item, lang), logicalW - 120);
        drawPill(ctx, spineX + 18, top + 2, label, {
          bg: isDark ? "#13161E" : "#FFFFFF",
          border: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
          color: isDark ? "#AEAEB2" : "#6E6E73",
          font: `700 11px ${FONT_STACK}`,
          padX: 10,
          height: 22,
        });
        continue;
      }

      // Crisp static Apple Blue timeline node
      const nodeY = top + height / 2;
      ctx.save();
      ctx.fillStyle = appleBlue;
      if (typeof ctx.arc === "function") {
        ctx.beginPath();
        ctx.arc(spineX, nodeY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? "#0A0C10" : "#F2F2F7";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.restore();

      // Elevated monochrome stop card
      const cardX = spineX + 18;
      const cardW = logicalW - cardX - 24;
      drawRoundedRect(ctx, cardX, top, cardW, height, 16);
      ctx.fillStyle = isDark ? "#13161E" : "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Crisp Apple Blue monospace time
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = appleBlue;
      ctx.font = `800 14.5px ${MONO_STACK}`;
      ctx.fillText(item.time || "--:--", cardX + 16, top + 30);

      // Bold stop title
      ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
      ctx.font = `800 15.5px ${FONT_STACK}`;
      ctx.fillText(truncateText(ctx, item.placeName || "", cardW - 96), cardX + 80, top + 30);

      // Sub-info / note
      const subParts = [item.type === "Food" ? "🍽️ Food" : "📍 Place", item.note?.trim()].filter(Boolean);
      ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
      ctx.font = `500 11.5px ${FONT_STACK}`;
      ctx.fillText(truncateText(ctx, subParts.join(" · "), cardW - 96), cardX + 80, top + 53);
    }
  }

  ctx.fillStyle = isDark ? "rgba(142,142,147,0.7)" : "rgba(110,110,115,0.7)";
  ctx.font = `700 10.5px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("GO TRAVEL · LOCK SCREEN TIMETABLE", logicalW / 2, logicalH - 32);

  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* 4. Story Card — 1080×1920 (9:16) iOS 27 Minimal Social Card                */
/* -------------------------------------------------------------------------- */

function drawStoryCard(canvas: HTMLCanvasElement, options: CanvasRenderOptions): void {
  const { trip, lang, dayIndex, theme = "dark" } = options;
  const logicalW = 540;
  const logicalH = 960; // 1080x1920 at 2x
  const dpr = 2;
  canvas.width = logicalW * dpr;
  canvas.height = logicalH * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const isDark = theme === "dark";
  const appleBlue = isDark ? "#0A84FF" : "#007AFF";
  ctx.save();
  ctx.scale(dpr, dpr);

  // Pure refined Apple monochrome backdrop + subtle dot grid
  ctx.fillStyle = isDark ? "#0A0C10" : "#F2F2F7";
  ctx.fillRect(0, 0, logicalW, logicalH);
  drawDotGrid(ctx, logicalW, logicalH, isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)", 20);

  // Elevated header card
  drawRoundedRect(ctx, 26, 38, logicalW - 52, 152, 24);
  ctx.fillStyle = isDark ? "#13161E" : "#FFFFFF";
  ctx.fill();
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  drawPill(ctx, 46, 56, "GO TRAVEL · STORY", {
    bg: isDark ? "rgba(10,132,255,0.16)" : "rgba(0,122,255,0.10)",
    color: appleBlue,
    font: `800 10px ${MONO_STACK}`,
    padX: 9,
    height: 20,
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
  ctx.font = `800 25px ${FONT_STACK}`;
  ctx.fillText(truncateText(ctx, trip.name || trip.destination || "My Journey", logicalW - 96), 46, 108);

  ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
  ctx.font = `600 12.5px ${FONT_STACK}`;
  ctx.fillText(
    truncateText(
      ctx,
      `📍 ${trip.destination || "-"}   ·   📅 ${trip.startDate || ""} ~ ${trip.endDate || ""}`,
      logicalW - 96
    ),
    46,
    136
  );

  const totalDays = trip.itinerary?.length || 0;
  const totalStops = (trip.itinerary || []).reduce(
    (sum, d) => sum + (d.items || []).filter((i) => i.type !== "Transport").length,
    0
  );
  drawPill(
    ctx,
    46,
    152,
    lang === "zh" ? `${totalDays} 天 · ${totalStops} 個行程亮點` : `${totalDays} DAYS · ${totalStops} STOPS`,
    {
      bg: isDark ? "rgba(255,255,255,0.06)" : "#F2F2F7",
      color: isDark ? "#AEAEB2" : "#6E6E73",
      font: `700 11px ${MONO_STACK}`,
      padX: 10,
      height: 22,
    }
  );

  let y = 212;
  const days =
    dayIndex != null && trip.itinerary?.[dayIndex]
      ? [{ day: trip.itinerary[dayIndex], idx: dayIndex }]
      : (trip.itinerary || []).slice(0, 3).map((day, idx) => ({ day, idx }));

  if (days.length === 0) {
    ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
    ctx.font = `600 14px ${FONT_STACK}`;
    ctx.fillText(lang === "zh" ? "開始規劃你的下一趟旅行" : "Start planning your next adventure", 36, y + 30);
  } else if (days.length === 1) {
    // Clean single-day timeline with Apple Blue spine & compact inline transport micro-badges
    const { day, idx } = days[0];
    drawPill(ctx, 26, y, `DAY ${idx + 1}${day.date ? ` · ${day.date}` : ""}`, {
      bg: isDark ? "rgba(10,132,255,0.16)" : "rgba(0,122,255,0.10)",
      border: isDark ? "rgba(10,132,255,0.32)" : "rgba(0,122,255,0.22)",
      color: appleBlue,
      font: `800 11px ${MONO_STACK}`,
      padX: 10,
      height: 22,
    });
    y += 34;

    const spineX = 42;
    const entries: Array<{ item: ItineraryItem; top: number; height: number; isTransport: boolean }> = [];
    for (const item of day.items || []) {
      const isTransport = item.type === "Transport";
      const h = isTransport ? 24 : 64;
      if (y + h > logicalH - 68) break;
      entries.push({ item, top: y, height: h, isTransport });
      y += h + (isTransport ? 7 : 9);
    }

    if (entries.length > 1) {
      const spineTop = entries[0].top + 20;
      const last = entries[entries.length - 1];
      const spineBottom = last.top + last.height / 2;
      ctx.save();
      ctx.strokeStyle = isDark ? "rgba(10,132,255,0.45)" : "rgba(0,122,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spineX, spineTop);
      ctx.lineTo(spineX, spineBottom);
      ctx.stroke();
      ctx.restore();
    }

    for (const { item, top, height, isTransport } of entries) {
      if (isTransport) {
        drawPill(ctx, spineX + 16, top + 1, truncateText(ctx, formatCompactTransportBadge(item, lang), logicalW - 110), {
          bg: isDark ? "#13161E" : "#FFFFFF",
          border: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
          color: isDark ? "#AEAEB2" : "#6E6E73",
          font: `700 10.5px ${FONT_STACK}`,
          padX: 9,
          height: 20,
        });
        continue;
      }

      ctx.save();
      ctx.fillStyle = appleBlue;
      if (typeof ctx.arc === "function") {
        ctx.beginPath();
        ctx.arc(spineX, top + height / 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      const cardX = spineX + 16;
      const cardW = logicalW - cardX - 26;
      drawRoundedRect(ctx, cardX, top, cardW, height, 15);
      ctx.fillStyle = isDark ? "#13161E" : "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = appleBlue;
      ctx.font = `800 13.5px ${MONO_STACK}`;
      ctx.fillText(item.time || "--:--", cardX + 14, top + 27);

      ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
      ctx.font = `800 14.5px ${FONT_STACK}`;
      ctx.fillText(truncateText(ctx, item.placeName || "", cardW - 88), cardX + 74, top + 27);

      if (item.note?.trim()) {
        ctx.fillStyle = isDark ? "#8E8E93" : "#6E6E73";
        ctx.font = `500 11px ${FONT_STACK}`;
        ctx.fillText(truncateText(ctx, item.note.trim(), cardW - 88), cardX + 74, top + 47);
      }
    }
  } else {
    // Multi-day highlights view
    days.forEach(({ day, idx }) => {
      const highlights = (day.items || []).filter((i) => i.type !== "Transport").slice(0, 4);
      const boxH = Math.max(90, 54 + highlights.length * 29);
      if (y + boxH > logicalH - 68) return;

      drawRoundedRect(ctx, 26, y, logicalW - 52, boxH, 20);
      ctx.fillStyle = isDark ? "#13161E" : "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = appleBlue;
      ctx.font = `800 12.5px ${MONO_STACK}`;
      ctx.fillText(`DAY ${idx + 1} · ${day.date || ""}`, 46, y + 30);

      highlights.forEach((item, i) => {
        const rowY = y + 58 + i * 29;
        ctx.fillStyle = appleBlue;
        ctx.font = `700 12px ${MONO_STACK}`;
        ctx.fillText(item.time || "--:--", 46, rowY);

        ctx.fillStyle = isDark ? "#F5F5F7" : "#1D1D1F";
        ctx.font = `700 13.5px ${FONT_STACK}`;
        ctx.fillText(truncateText(ctx, item.placeName || "", logicalW - 156), 100, rowY);
      });

      y += boxH + 14;
    });
  }

  // Footer watermark
  ctx.fillStyle = isDark ? "rgba(142,142,147,0.75)" : "rgba(110,110,115,0.75)";
  ctx.font = `800 12px ${MONO_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText("Go Travel", logicalW / 2, logicalH - 30);

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
 * Async printable canvas renderer that preloads real airline logos in parallel
 * for `boarding-pass` cards before drawing. Other card types delegate directly.
 */
export async function renderPrintableCanvasAsync(
  type: PrintableCardType,
  options: CanvasRenderOptions
): Promise<HTMLCanvasElement> {
  if (type !== "boarding-pass") {
    return renderPrintableCanvas(type, options);
  }

  const { trip, flightIndex = 0 } = options;
  const flight = trip.flights?.[flightIndex] || trip.flights?.[0];
  if (!flight) {
    return renderPrintableCanvas(type, options);
  }

  const passes = expandFlightPasses(flight);
  const codes = new Set<string>();
  const collectCode = (seg?: FlightSegment) => {
    if (!seg) return;
    const raw = (seg.airlineID || inferAirlineId(seg.flightNumber) || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (raw) codes.add(raw);
  };

  for (const pass of passes) {
    collectCode(pass.seg);
  }

  if (codes.size === 0) {
    return renderPrintableCanvas(type, options);
  }

  const airlineLogos: Record<string, HTMLImageElement | null> = {
    ...(options.airlineLogos || {}),
  };
  const missingCodes = Array.from(codes).filter((code) => !(code in airlineLogos));

  if (missingCodes.length > 0) {
    const loaded = await Promise.all(
      missingCodes.map(async (code) => [code, await loadAirlineLogoImage(code)] as const)
    );
    for (const [code, img] of loaded) {
      airlineLogos[code] = img;
    }
  }

  return renderPrintableCanvas(type, {
    ...options,
    airlineLogos,
  });
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
