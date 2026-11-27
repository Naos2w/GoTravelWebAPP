import { ChecklistItem, Currency, DayPlan, Expense, FlightSegment, Language, TransportType, Trip } from "../../../types";
import { getRateToTwd } from "../../expenses/services/exchangeRateService";
import { calculateSplitwiseSettlement, SplitMember } from "../../expenses/services/splitwiseService";
import { enrichAirportCoords } from "../../flights/services/airportCoordsService";
import { formatBaggageSummary, getDefaultBaggage, inferAirlineId } from "../../flights/services/airlineBaggageService";

const CHECKLIST_CATEGORIES: ReadonlyArray<ChecklistItem["category"]> = [
  "Documents",
  "Gear",
  "Clothing",
  "Toiletries",
  "Other",
];

const TRANSPORT_META: Record<TransportType, { icon: string; zh: string; en: string }> = {
  Public: { icon: "🚇", zh: "大眾運輸", en: "Transit" },
  Car: { icon: "🚗", zh: "開車", en: "Drive" },
  Bicycle: { icon: "🚲", zh: "單車", en: "Bike" },
  Walking: { icon: "🚶", zh: "步行", en: "Walk" },
  Flight: { icon: "✈️", zh: "航班", en: "Flight" },
};

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  Flight: "#0284c7",
  Accommodation: "#6366f1",
  Food: "#f59e0b",
  Transport: "#10b981",
  Tickets: "#ec4899",
  Shopping: "#8b5cf6",
  Other: "#64748b",
};

const COPY = {
  zh: {
    coverTag: "GO TRAVEL · 專屬旅遊手冊",
    untitled: "未命名旅程",
    destination: "目的地",
    dates: "日期",
    daysLabel: "天數",
    stopsLabel: "景點",
    flightsLabel: "航班",
    spendLabel: "總花費",
    daysUnit: "天",
    stopsUnit: "站",
    flightsUnit: "筆",
    flightsSection: "航班資訊",
    traveler: "旅客",
    direction: "航段",
    outbound: "去程",
    inbound: "回程",
    flight: "航班",
    route: "航線",
    times: "起降時間",
    terminalGate: "航廈 / 登機門",
    baggage: "行李額度",
    carryOn: "手提",
    checked: "託運",
    none: "無",
    noFlights: "尚未新增航班資訊",
    itinerarySection: "每日行程與路線圖",
    noStops: "本日暫無安排行程",
    routeMapCaption: "當日路線圖",
    expensesSection: "旅費支出與 AA 結算",
    totalSpend: "預估總支出",
    settlementTitle: "AA 分攤結算",
    allSettled: "全員帳目已結清",
    checklistSection: "行李與待辦清單",
    noChecklist: "尚未建立行李清單",
    footer: "匯出自 Go Travel 旅程規劃器 · 祝您旅途愉快",
    expenseCategories: {
      Flight: "機票",
      Accommodation: "住宿",
      Transport: "交通",
      Food: "餐飲",
      Tickets: "票券",
      Shopping: "購物",
      Other: "其他",
    } as Record<string, string>,
    categories: {
      Documents: "證件與票卡",
      Gear: "電子設備與用品",
      Clothing: "衣物穿搭",
      Toiletries: "盥洗與個人藥品",
      Other: "其他雜項",
    },
  },
  en: {
    coverTag: "GO TRAVEL · TRAVEL BOOKLET",
    untitled: "Untitled Trip",
    destination: "Destination",
    dates: "Dates",
    daysLabel: "Days",
    stopsLabel: "Stops",
    flightsLabel: "Flights",
    spendLabel: "Total Spend",
    daysUnit: "days",
    stopsUnit: "stops",
    flightsUnit: "flights",
    flightsSection: "Flight Summary",
    traveler: "Traveler",
    direction: "Leg",
    outbound: "Outbound",
    inbound: "Inbound",
    flight: "Flight",
    route: "Route",
    times: "Schedule",
    terminalGate: "Terminal / Gate",
    baggage: "Baggage",
    carryOn: "Carry-on",
    checked: "Checked",
    none: "None",
    noFlights: "No flights added yet",
    itinerarySection: "Daily Itinerary & Route Maps",
    noStops: "No stops scheduled for this day",
    routeMapCaption: "Route Map",
    expensesSection: "Expense Breakdown & AA Settlement",
    totalSpend: "Total Spend",
    settlementTitle: "Splitwise Settlement",
    allSettled: "All balances settled",
    checklistSection: "Packing & Checklist",
    noChecklist: "No checklist items yet",
    footer: "Exported from Go Travel · Have a wonderful journey",
    expenseCategories: {
      Flight: "Flight",
      Accommodation: "Stay",
      Transport: "Transport",
      Food: "Food",
      Tickets: "Tickets",
      Shopping: "Shopping",
      Other: "Other",
    } as Record<string, string>,
    categories: {
      Documents: "Documents & Tickets",
      Gear: "Gear & Electronics",
      Clothing: "Clothing",
      Toiletries: "Toiletries & Medicine",
      Other: "Other",
    },
  },
} as const;

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasValidCoordinates(item: { lat?: number; lng?: number }): item is { lat: number; lng: number } {
  return (
    item.lat != null &&
    item.lng != null &&
    Number.isFinite(Number(item.lat)) &&
    Number.isFinite(Number(item.lng))
  );
}

function collectTripMembers(trip: Trip): SplitMember[] {
  const map = new Map<string, string>();
  (trip.collaborators || []).forEach((c) => {
    if (c.user_id) map.set(c.user_id, (c.email || c.user_id).split("@")[0]);
  });
  (trip.flights || []).forEach((f) => {
    if (f.user_id && f.traveler_name) map.set(f.user_id, f.traveler_name);
  });
  (trip.expenses || []).forEach((e) => {
    if (e.user_id && e.user_name) map.set(e.user_id, e.user_name);
    if (e.paidBy && e.paidByName) map.set(e.paidBy, e.paidByName);
  });
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
}

function computeExpenseSummary(trip: Trip) {
  const catMap = new Map<string, number>();
  const foreignMap = new Map<Currency, number>();
  let totalTwd = 0;

  const add = (cat: string, amount: number, currency: Currency, customRate?: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const rate = customRate && customRate > 0 ? customRate : getRateToTwd(currency);
    const twd = amount * rate;
    totalTwd += twd;
    catMap.set(cat, (catMap.get(cat) || 0) + twd);
    if (currency !== Currency.TWD) {
      foreignMap.set(currency, (foreignMap.get(currency) || 0) + amount);
    }
  };

  (trip.expenses || []).forEach((e: Expense) => add(e.category, Number(e.amount), e.currency, e.exchangeRate));
  (trip.flights || []).forEach((f) => {
    if (f.price > 0) add("Flight", Number(f.price), f.currency, f.exchangeRate);
  });

  const categories = Array.from(catMap.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const members = collectTripMembers(trip);
  const { transfers } = calculateSplitwiseSettlement(trip.expenses || [], members);

  return {
    totalTwd: Math.round(totalTwd),
    categories,
    foreignTotals: Array.from(foreignMap.entries()),
    transfers,
  };
}

/**
 * Generates an inline vector SVG mini route map for a day with 2+ geocoded stops.
 * Projects (lat, lng) into a normalized bounding box with zero external dependencies.
 */
export function generateDayRouteSvg(day: DayPlan, lang: Language): string | null {
  const c = COPY[lang] || COPY.en;
  let stopNum = 0;
  const points: Array<{ num: number; lat: number; lng: number; name: string }> = [];

  for (const item of day.items || []) {
    if (item.type === "Transport") continue;
    stopNum++;
    const enriched = enrichAirportCoords(item);
    if (hasValidCoordinates(enriched)) {
      points.push({
        num: stopNum,
        lat: Number(enriched.lat),
        lng: Number(enriched.lng),
        name: enriched.placeName || "",
      });
    }
  }

  if (points.length < 2) {
    return null;
  }

  const width = 216;
  const height = 152;
  const padX = 24;
  const padTop = 24;
  const padBottom = 30;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  let minLat = Math.min(...points.map((p) => p.lat));
  let maxLat = Math.max(...points.map((p) => p.lat));
  let minLng = Math.min(...points.map((p) => p.lng));
  let maxLng = Math.max(...points.map((p) => p.lng));

  if (maxLat - minLat < 0.001) {
    minLat -= 0.005;
    maxLat += 0.005;
  }
  if (maxLng - minLng < 0.001) {
    minLng -= 0.005;
    maxLng += 0.005;
  }

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  const projected = points.map((p) => {
    const x = padX + ((p.lng - minLng) / lngSpan) * plotW;
    // Invert Y so north (higher lat) is at the top
    const y = padTop + (1 - (p.lat - minLat) / latSpan) * plotH;
    return {
      ...p,
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    };
  });

  const polylinePts = projected.map((p) => `${p.x},${p.y}`).join(" ");

  const markersSvg = projected
    .map((p, idx) => {
      const isEdge = idx === 0 || idx === projected.length - 1;
      const fill = isEdge ? "#0f172a" : "#2563eb";
      return `<g>
        <circle cx="${p.x}" cy="${p.y}" r="8.5" fill="${fill}" stroke="#ffffff" stroke-width="2" />
        <text x="${p.x}" y="${p.y + 3}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#ffffff" font-family="ui-monospace, monospace">${p.num}</text>
      </g>`;
    })
    .join("");

  return `
    <div class="route-map-card">
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" role="img" aria-label="${escapeHtml(c.routeMapCaption)}" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="#f8fafc" stroke="#e2e8f0" />
        <g stroke="#e2e8f0" stroke-width="0.75" stroke-dasharray="2 3">
          <line x1="12" y1="42" x2="${width - 12}" y2="42" />
          <line x1="12" y1="84" x2="${width - 12}" y2="84" />
          <line x1="12" y1="120" x2="${width - 12}" y2="120" />
          <line x1="72" y1="12" x2="72" y2="${height - 22}" />
          <line x1="144" y1="12" x2="144" y2="${height - 22}" />
        </g>
        <text x="${width - 14}" y="16" text-anchor="end" font-size="7.5" font-weight="700" fill="#94a3b8" font-family="ui-monospace, monospace">N ↑</text>
        <polyline points="${polylinePts}" fill="none" stroke="#93c5fd" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55" />
        <polyline points="${polylinePts}" fill="none" stroke="#2563eb" stroke-width="2" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round" />
        ${markersSvg}
        <text x="12" y="${height - 8}" font-size="8" font-weight="700" fill="#64748b" font-family="ui-monospace, monospace">${escapeHtml(c.routeMapCaption)} · ${points.length} ${escapeHtml(c.stopsUnit)}</text>
      </svg>
    </div>
  `;
}

function renderExpenseSummarySection(
  summary: ReturnType<typeof computeExpenseSummary>,
  lang: Language
): string {
  const c = COPY[lang] || COPY.en;
  if (summary.totalTwd <= 0 || summary.categories.length === 0) {
    return "";
  }

  const maxCat = Math.max(...summary.categories.map((cat) => cat.amount), 1);
  const rowH = 24;
  const svgW = 440;
  const svgH = summary.categories.length * rowH + 8;
  const labelW = 82;
  const barMaxW = 228;
  const barStartX = labelW + 8;

  const barsSvg = summary.categories
    .map((entry, idx) => {
      const y = idx * rowH + 4;
      const pct = Math.round((entry.amount / summary.totalTwd) * 100);
      const barW = Math.max(8, Math.round((entry.amount / maxCat) * barMaxW));
      const color = EXPENSE_CATEGORY_COLORS[entry.category] || "#2563eb";
      const label = c.expenseCategories[entry.category] || entry.category;
      return `<g>
        <text x="${labelW}" y="${y + 13}" text-anchor="end" font-size="10.5" font-weight="600" fill="#334155" font-family="-apple-system, BlinkMacSystemFont, sans-serif">${escapeHtml(label)}</text>
        <rect x="${barStartX}" y="${y + 4}" width="${barMaxW}" height="11" rx="5.5" fill="#f1f5f9" />
        <rect x="${barStartX}" y="${y + 4}" width="${barW}" height="11" rx="5.5" fill="${color}" />
        <text x="${barStartX + barMaxW + 8}" y="${y + 13}" font-size="10" font-weight="700" fill="#0f172a" font-family="ui-monospace, monospace">NT$ ${entry.amount.toLocaleString()} (${pct}%)</text>
      </g>`;
    })
    .join("");

  const foreignHtml =
    summary.foreignTotals.length > 0
      ? `<div class="foreign-pills">${summary.foreignTotals
          .map(
            ([cur, amt]) =>
              `<span class="mini-pill">${escapeHtml(cur)} ${Math.round(amt).toLocaleString()}</span>`
          )
          .join("")}</div>`
      : "";

  const transfersHtml =
    summary.transfers.length === 0
      ? `<div class="settled-ok">✓ ${escapeHtml(c.allSettled)}</div>`
      : `<ul class="settlement-list">${summary.transfers
          .map(
            (tr) =>
              `<li><span>${escapeHtml(tr.fromName)} → ${escapeHtml(tr.toName)}</span><strong>NT$ ${tr.amount.toLocaleString()}</strong></li>`
          )
          .join("")}</ul>`;

  return `
    <section class="avoid-break">
      <h2>💰 ${escapeHtml(c.expensesSection)}</h2>
      <div class="expense-grid">
        <div class="expense-chart-box">
          <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="auto" role="img" aria-label="${escapeHtml(c.expensesSection)}" xmlns="http://www.w3.org/2000/svg">
            ${barsSvg}
          </svg>
        </div>
        <div class="expense-side-box">
          <div class="total-kpi-label">${escapeHtml(c.totalSpend)}</div>
          <div class="total-kpi-val">NT$ ${summary.totalTwd.toLocaleString()}</div>
          ${foreignHtml}
          <div class="settlement-heading">${escapeHtml(c.settlementTitle)}</div>
          ${transfersHtml}
        </div>
      </div>
    </section>
  `;
}

function renderFlightRows(trip: Trip, lang: Language): string {
  const c = COPY[lang] || COPY.en;
  const flights = trip.flights || [];
  if (flights.length === 0) {
    return `<p class="empty">${escapeHtml(c.noFlights)}</p>`;
  }

  const rows: string[] = [];
  const appendRow = (
    traveler: string,
    direction: string,
    seg: FlightSegment,
    cabinClass?: string,
    fallbackBaggage?: Trip["flights"][number]["baggage"]
  ) => {
    const airline = seg.airlineNameZh && lang === "zh"
      ? seg.airlineNameZh
      : seg.airlineNameEn || seg.airline || "";
    const flightLabel = `${airline} ${seg.flightNumber || ""}`.trim();
    const baggage =
      seg.baggage ||
      fallbackBaggage ||
      getDefaultBaggage(seg.airlineID || inferAirlineId(seg.flightNumber), cabinClass);
    const baggageText = formatBaggageSummary(baggage, {
      carryOn: c.carryOn,
      checked: c.checked,
      none: c.none,
    });
    const terminalGate =
      seg.terminal || seg.gate ? `T${seg.terminal || "-"} / ${seg.gate || "-"}` : "-";

    rows.push(`
      <tr>
        <td>${escapeHtml(traveler || "-")}</td>
        <td><span class="dir-tag">${escapeHtml(direction)}</span></td>
        <td><strong>${escapeHtml(flightLabel || "-")}</strong></td>
        <td class="mono">${escapeHtml(seg.departureAirport || "---")} → ${escapeHtml(seg.arrivalAirport || "---")}</td>
        <td class="mono">${escapeHtml(seg.departureTime || "-")} → ${escapeHtml(seg.arrivalTime || "-")}</td>
        <td class="mono">${escapeHtml(terminalGate)}</td>
        <td>${escapeHtml(baggageText)}</td>
      </tr>
    `);
  };

  for (const flight of flights) {
    if (flight.outbound) {
      appendRow(flight.traveler_name, c.outbound, flight.outbound, flight.cabinClass, flight.baggage);
    }
    if (flight.inbound) {
      appendRow(flight.traveler_name, c.inbound, flight.inbound, flight.cabinClass, flight.baggage);
    }
  }

  return `
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(c.traveler)}</th>
          <th>${escapeHtml(c.direction)}</th>
          <th>${escapeHtml(c.flight)}</th>
          <th>${escapeHtml(c.route)}</th>
          <th>${escapeHtml(c.times)}</th>
          <th>${escapeHtml(c.terminalGate)}</th>
          <th>${escapeHtml(c.baggage)}</th>
        </tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;
}

function renderItineraryDays(trip: Trip, lang: Language): string {
  const c = COPY[lang] || COPY.en;
  const days = trip.itinerary || [];
  if (days.length === 0) {
    return `<p class="empty">${escapeHtml(c.noStops)}</p>`;
  }

  return days
    .map((day, idx) => {
      const miniMapHtml = generateDayRouteSvg(day, lang);
      let stopCounter = 0;

      const itemsHtml =
        !day.items || day.items.length === 0
          ? `<p class="empty">${escapeHtml(c.noStops)}</p>`
          : `<ul class="timeline">${day.items
              .map((item) => {
                if (item.type === "Transport") {
                  const mode: TransportType = item.transportType || "Public";
                  const tMeta = TRANSPORT_META[mode] || TRANSPORT_META.Public;
                  const modeLabel = lang === "zh" ? tMeta.zh : tMeta.en;
                  const descParts = [modeLabel, item.placeName?.trim(), item.note?.trim()].filter(Boolean);
                  // Deduplicate if placeName already equals modeLabel
                  const deduped = descParts.filter((part, i, arr) => arr.indexOf(part) === i).join(" · ");
                  return `
                    <li class="transport-connector">
                      <span class="connector-arrow" aria-hidden="true">↓</span>
                      <span class="connector-pill">${tMeta.icon} ${escapeHtml(deduped)}</span>
                    </li>
                  `;
                }

                stopCounter++;
                const typeIcon = item.type === "Food" ? "🍽️" : "📍";
                const noteHtml = item.note?.trim()
                  ? `<div class="note">${escapeHtml(item.note.trim())}</div>`
                  : "";
                return `
                  <li class="stop avoid-break">
                    <span class="stop-num">${stopCounter}</span>
                    <span class="time">${escapeHtml(item.time || "--:--")}</span>
                    <div class="stop-body">
                      <div class="stop-title">${escapeHtml(item.placeName)} <span class="badge">${typeIcon} ${escapeHtml(item.type)}</span></div>
                      ${noteHtml}
                    </div>
                  </li>
                `;
              })
              .join("")}</ul>`;

      return `
        <div class="day-card avoid-break">
          <div class="day-header">
            <h3>Day ${idx + 1}</h3>
            <span class="day-date">${escapeHtml(day.date || "")}</span>
          </div>
          <div class="day-body ${miniMapHtml ? "has-map" : ""}">
            <div class="day-timeline-col">${itemsHtml}</div>
            ${miniMapHtml || ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderChecklist(trip: Trip, lang: Language): string {
  const c = COPY[lang] || COPY.en;
  const items = trip.checklist || [];
  if (items.length === 0) {
    return `<p class="empty">${escapeHtml(c.noChecklist)}</p>`;
  }

  const groups = CHECKLIST_CATEGORIES.map((category) => {
    const groupItems = items.filter((item) => item.category === category);
    if (groupItems.length === 0) return "";
    const listHtml = groupItems
      .map(
        (item) =>
          `<li><span class="checkbox">${item.isCompleted ? "☑" : "☐"}</span><span class="${item.isCompleted ? "checked-text" : ""}">${escapeHtml(item.text)}</span></li>`
      )
      .join("");
    return `
      <div class="check-group avoid-break">
        <h4>${escapeHtml(c.categories[category])}</h4>
        <ul>${listHtml}</ul>
      </div>
    `;
  }).filter(Boolean);

  return `<div class="check-grid">${groups.join("")}</div>`;
}

/**
 * Generates a self-contained, illustrated, XSS-safe A4 magazine-style printable HTML travel booklet.
 */
export function generatePrintableBookletHtml(trip: Trip, lang: Language): string {
  const c = COPY[lang] || COPY.en;
  const tripTitle = escapeHtml(trip.name || c.untitled);
  const destination = escapeHtml(trip.destination || "-");
  const dateRange = escapeHtml(
    trip.startDate || trip.endDate ? `${trip.startDate || ""} ~ ${trip.endDate || ""}` : "-"
  );
  const daysCount = trip.itinerary?.length || 0;
  const stopsCount = (trip.itinerary || []).reduce(
    (sum, d) => sum + (d.items || []).filter((i) => i.type !== "Transport").length,
    0
  );
  const flightsCount = trip.flights?.length || 0;
  const expenseSummary = computeExpenseSummary(trip);

  const primaryFlight = trip.flights?.[0]?.outbound;
  const depCode = escapeHtml((primaryFlight?.departureAirport || "DEP").toUpperCase());
  const arrCode = escapeHtml((primaryFlight?.arrivalAirport || "ARR").toUpperCase());

  const coverRouteBanner = primaryFlight
    ? `
      <div class="cover-route">
        <span class="airport-code">${depCode}</span>
        <svg class="route-plane-svg" viewBox="0 0 120 24" width="120" height="24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
          <line x1="6" y1="12" x2="114" y2="12" stroke="rgba(125,211,252,0.55)" stroke-width="1.5" stroke-dasharray="4 4" />
          <circle cx="6" cy="12" r="3" fill="#38bdf8" />
          <circle cx="114" cy="12" r="3" fill="#38bdf8" />
          <circle cx="60" cy="12" r="10" fill="#0ea5e9" />
          <path d="M66 12l-3.5-1.2-4-5.2h-1.6l1.8 5.2-3.2.2-1.5-2h-1.1l.9 3-.9 3h1.1l1.5-2 3.2.2-1.8 5.2h1.6l4-5.2L66 12z" fill="#ffffff" />
        </svg>
        <span class="airport-code">${arrCode}</span>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="${lang === "zh" ? "zh-Hant" : "en"}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${tripTitle} - Go Travel</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.42;
      font-size: 11.5px;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .cover {
      padding: 20px 24px;
      border-radius: 16px;
      background: linear-gradient(135deg, #0b1220 0%, #162e52 60%, #1e3a5f 100%);
      color: #ffffff;
      margin-bottom: 18px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .cover-tag { font-size: 9.5px; letter-spacing: 0.16em; color: #7dd3fc; font-weight: 800; }
    .cover h1 { margin: 5px 0 6px; font-size: 22px; line-height: 1.2; letter-spacing: -0.02em; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 14px; font-size: 11.5px; color: rgba(255,255,255,0.88); }
    .cover-route {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px;
      border-radius: 12px;
      background: rgba(255,255,255,0.09);
      border: 1px solid rgba(255,255,255,0.16);
    }
    .airport-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      margin-top: 14px;
    }
    .kpi-badge {
      background: rgba(255,255,255,0.10);
      border: 1px solid rgba(255,255,255,0.14);
      padding: 7px 10px;
      border-radius: 10px;
    }
    .kpi-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #bae6fd; font-weight: 700; }
    .kpi-val { font-size: 13.5px; font-weight: 800; margin-top: 2px; font-family: ui-monospace, monospace; }
    h2 {
      font-size: 14px;
      margin: 18px 0 9px;
      padding-bottom: 5px;
      border-bottom: 2px solid #e2e8f0;
      color: #0f172a;
      letter-spacing: -0.01em;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5px; }
    th, td { border: 1px solid #e2e8f0; padding: 6px 7px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 700; color: #334155; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .dir-tag {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #0369a1;
      font-size: 9.5px;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .day-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 11px 13px;
      margin-bottom: 11px;
      background: #ffffff;
    }
    .day-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f1f5f9;
    }
    .day-header h3 { margin: 0; font-size: 13px; color: #0f172a; font-weight: 800; }
    .day-date { font-family: ui-monospace, monospace; font-size: 11px; color: #0284c7; font-weight: 700; }
    .day-body.has-map {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 210px;
      gap: 14px;
      align-items: start;
    }
    .route-map-card {
      border-radius: 10px;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .timeline {
      list-style: none;
      padding: 0;
      margin: 0;
      position: relative;
    }
    .stop {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 5px 8px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      margin-bottom: 4px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .stop-num {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #2563eb;
      color: #ffffff;
      font-family: ui-monospace, monospace;
      font-size: 10px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .time { font-family: ui-monospace, monospace; font-weight: 700; color: #0284c7; min-width: 42px; font-size: 11px; margin-top: 1px; }
    .stop-body { flex: 1; min-width: 0; }
    .stop-title { font-weight: 700; color: #0f172a; }
    .badge {
      display: inline-block;
      font-size: 9.5px;
      color: #475569;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 0 5px;
      border-radius: 999px;
      margin-left: 5px;
      font-weight: 600;
    }
    .note { margin-top: 2px; color: #475569; font-size: 10.5px; }
    .transport-connector {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 0 2px 15px;
      margin: 1px 0 4px 8px;
      border-left: 2px dashed #cbd5e1;
      color: #64748b;
      font-size: 10px;
    }
    .connector-arrow { font-weight: 800; color: #94a3b8; }
    .connector-pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      line-height: 1.25;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .expense-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
      gap: 12px;
      align-items: stretch;
    }
    .expense-chart-box, .expense-side-box {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      background: #ffffff;
    }
    .expense-side-box { background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .total-kpi-label { font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .total-kpi-val { font-size: 18px; font-weight: 800; font-family: ui-monospace, monospace; color: #0f172a; margin: 2px 0 6px; }
    .foreign-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
    .mini-pill { font-size: 9.5px; font-family: ui-monospace, monospace; padding: 2px 6px; border-radius: 6px; background: #e2e8f0; color: #334155; font-weight: 700; }
    .settlement-heading { font-size: 10px; font-weight: 800; color: #334155; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-bottom: 4px; }
    .settlement-list { list-style: none; padding: 0; margin: 0; font-size: 10.5px; }
    .settlement-list li { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; }
    .settled-ok { color: #047857; font-weight: 700; font-size: 10.5px; }
    .check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .check-group { border: 1px solid #e2e8f0; border-radius: 10px; padding: 9px 11px; }
    .check-group h4 { margin: 0 0 5px; font-size: 11.5px; color: #1e3a5f; }
    .check-group ul { list-style: none; padding: 0; margin: 0; }
    .check-group li { display: flex; gap: 6px; padding: 1.5px 0; font-size: 11px; }
    .checkbox { font-size: 12.5px; line-height: 1.2; color: #2563eb; }
    .checked-text { color: #64748b; text-decoration: line-through; }
    .empty { color: #64748b; font-style: italic; margin: 4px 0; }
    .footer { margin-top: 20px; text-align: center; color: #64748b; font-size: 10px; }
    .avoid-break { break-inside: avoid; page-break-inside: avoid; }
    @media print {
      @page { size: A4; margin: 14mm; }
      body { padding: 0; }
      .day-card, .check-group, .stop, tr { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="cover avoid-break">
    <div class="cover-top">
      <div>
        <div class="cover-tag">${escapeHtml(c.coverTag)}</div>
        <h1>${tripTitle}</h1>
        <div class="meta-row">
          <span><strong>${escapeHtml(c.destination)}:</strong> ${destination}</span>
          <span><strong>${escapeHtml(c.dates)}:</strong> ${dateRange}</span>
        </div>
      </div>
      ${coverRouteBanner}
    </div>
    <div class="kpi-grid">
      <div class="kpi-badge">
        <div class="kpi-label">${escapeHtml(c.daysLabel)}</div>
        <div class="kpi-val">${daysCount} ${escapeHtml(c.daysUnit)}</div>
      </div>
      <div class="kpi-badge">
        <div class="kpi-label">${escapeHtml(c.stopsLabel)}</div>
        <div class="kpi-val">${stopsCount} ${escapeHtml(c.stopsUnit)}</div>
      </div>
      <div class="kpi-badge">
        <div class="kpi-label">${escapeHtml(c.flightsLabel)}</div>
        <div class="kpi-val">${flightsCount} ${escapeHtml(c.flightsUnit)}</div>
      </div>
      <div class="kpi-badge">
        <div class="kpi-label">${escapeHtml(c.spendLabel)}</div>
        <div class="kpi-val">NT$ ${expenseSummary.totalTwd.toLocaleString()}</div>
      </div>
    </div>
  </header>

  <section>
    <h2>✈️ ${escapeHtml(c.flightsSection)}</h2>
    ${renderFlightRows(trip, lang)}
  </section>

  <section>
    <h2>🗺️ ${escapeHtml(c.itinerarySection)}</h2>
    ${renderItineraryDays(trip, lang)}
  </section>

  ${renderExpenseSummarySection(expenseSummary, lang)}

  <section>
    <h2>🎒 ${escapeHtml(c.checklistSection)}</h2>
    ${renderChecklist(trip, lang)}
  </section>

  <footer class="footer">${escapeHtml(c.footer)}</footer>
</body>
</html>`;
}

/**
 * Opens a clean print window (or hidden iframe fallback if popups are blocked)
 * and triggers the browser's native print / Save as PDF dialog.
 */
export function openPrintableTravelBooklet(trip: Trip, lang: Language): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const html = generatePrintableBookletHtml(trip, lang);

  try {
    const popup = typeof window.open === "function" ? window.open("", "_blank") : null;
    if (popup && popup.document) {
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      if (typeof popup.focus === "function") popup.focus();
      if (typeof popup.print === "function") popup.print();
      return true;
    }
  } catch {
    // Fall back to hidden iframe when popup is blocked
  }

  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!frameDoc) {
      document.body.removeChild(iframe);
      return false;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();
    iframe.contentWindow?.focus?.();
    iframe.contentWindow?.print?.();

    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 1000);
    return true;
  } catch {
    return false;
  }
}
