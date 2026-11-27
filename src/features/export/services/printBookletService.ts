import { ChecklistItem, FlightSegment, Language, Trip } from "../../../types";
import { formatBaggageSummary, getDefaultBaggage, inferAirlineId } from "../../flights/services/airlineBaggageService";

const CHECKLIST_CATEGORIES: ReadonlyArray<ChecklistItem["category"]> = [
  "Documents",
  "Gear",
  "Clothing",
  "Toiletries",
  "Other",
];

const COPY = {
  zh: {
    coverTag: "GO TRAVEL · 專屬旅遊手冊",
    untitled: "未命名旅程",
    destination: "目的地",
    dates: "日期",
    daysUnit: "天",
    stopsUnit: "個景點",
    flightsUnit: "筆航班",
    itemsUnit: "項清單",
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
    itinerarySection: "每日行程表",
    noStops: "本日暫無安排行程",
    checklistSection: "行李與待辦清單",
    noChecklist: "尚未建立行李清單",
    footer: "匯出自 Go Travel 旅程規劃器 · 祝您旅途愉快",
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
    daysUnit: "days",
    stopsUnit: "stops",
    flightsUnit: "flights",
    itemsUnit: "items",
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
    itinerarySection: "Daily Itinerary",
    noStops: "No stops scheduled for this day",
    checklistSection: "Packing & Checklist",
    noChecklist: "No checklist items yet",
    footer: "Exported from Go Travel · Have a wonderful journey",
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
        <td>${escapeHtml(direction)}</td>
        <td><strong>${escapeHtml(flightLabel || "-")}</strong></td>
        <td>${escapeHtml(seg.departureAirport || "---")} → ${escapeHtml(seg.arrivalAirport || "---")}</td>
        <td>${escapeHtml(seg.departureTime || "-")} → ${escapeHtml(seg.arrivalTime || "-")}</td>
        <td>${escapeHtml(terminalGate)}</td>
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
      const itemsHtml =
        !day.items || day.items.length === 0
          ? `<p class="empty">${escapeHtml(c.noStops)}</p>`
          : `<ul class="timeline">${day.items
              .map((item) => {
                const meta = [item.type, item.transportType].filter(Boolean).join(" · ");
                const noteHtml = item.note?.trim()
                  ? `<div class="note">${escapeHtml(item.note.trim())}</div>`
                  : "";
                return `
                  <li class="stop avoid-break">
                    <span class="time">${escapeHtml(item.time || "--:--")}</span>
                    <div class="stop-body">
                      <div class="stop-title">${escapeHtml(item.placeName)} <span class="badge">${escapeHtml(meta)}</span></div>
                      ${noteHtml}
                    </div>
                  </li>
                `;
              })
              .join("")}</ul>`;

      return `
        <div class="day-card avoid-break">
          <h3>Day ${idx + 1} · ${escapeHtml(day.date || "")}</h3>
          ${itemsHtml}
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
          `<li><span class="checkbox">${item.isCompleted ? "☑" : "☐"}</span><span>${escapeHtml(item.text)}</span></li>`
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
 * Generates a self-contained, XSS-safe A4 printable HTML travel booklet.
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
  const checklistCount = trip.checklist?.length || 0;

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
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
      font-size: 12px;
    }
    .cover {
      padding: 20px 24px;
      border-radius: 16px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%);
      color: #ffffff;
      margin-bottom: 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover-tag { font-size: 10px; letter-spacing: 0.14em; opacity: 0.78; font-weight: 700; }
    .cover h1 { margin: 6px 0 10px; font-size: 24px; line-height: 1.2; }
    .meta-row { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; opacity: 0.92; }
    .stats { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .stat-pill {
      background: rgba(255,255,255,0.14);
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    h2 {
      font-size: 15px;
      margin: 20px 0 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
      color: #0f172a;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
    th, td { border: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .day-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      background: #ffffff;
    }
    .day-card h3 { margin: 0 0 8px; font-size: 13px; color: #1e3a5f; }
    .timeline { list-style: none; padding: 0; margin: 0; }
    .stop { display: flex; gap: 10px; padding: 6px 0; border-top: 1px dashed #e2e8f0; }
    .stop:first-child { border-top: none; }
    .time { font-family: ui-monospace, monospace; font-weight: 700; color: #2563eb; min-width: 48px; }
    .stop-title { font-weight: 600; }
    .badge {
      display: inline-block;
      font-size: 10px;
      color: #475569;
      background: #f1f5f9;
      padding: 1px 6px;
      border-radius: 999px;
      margin-left: 6px;
    }
    .note { margin-top: 2px; color: #475569; font-size: 11px; }
    .check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .check-group { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
    .check-group h4 { margin: 0 0 6px; font-size: 12px; color: #1e3a5f; }
    .check-group ul { list-style: none; padding: 0; margin: 0; }
    .check-group li { display: flex; gap: 6px; padding: 2px 0; }
    .checkbox { font-size: 13px; line-height: 1.2; }
    .empty { color: #64748b; font-style: italic; margin: 4px 0; }
    .footer { margin-top: 24px; text-align: center; color: #64748b; font-size: 10px; }
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
    <div class="cover-tag">${escapeHtml(c.coverTag)}</div>
    <h1>${tripTitle}</h1>
    <div class="meta-row">
      <span><strong>${escapeHtml(c.destination)}:</strong> ${destination}</span>
      <span><strong>${escapeHtml(c.dates)}:</strong> ${dateRange}</span>
    </div>
    <div class="stats">
      <span class="stat-pill">${daysCount} ${escapeHtml(c.daysUnit)}</span>
      <span class="stat-pill">${stopsCount} ${escapeHtml(c.stopsUnit)}</span>
      <span class="stat-pill">${flightsCount} ${escapeHtml(c.flightsUnit)}</span>
      <span class="stat-pill">${checklistCount} ${escapeHtml(c.itemsUnit)}</span>
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
