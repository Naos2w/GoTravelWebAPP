import { ChecklistItem, FlightSegment, Language, Trip } from "../../../types";
import { sanitizeFilenameBase, triggerBlobDownload } from "./exportHelpers";

const CHECKLIST_CATEGORIES: ReadonlyArray<ChecklistItem["category"]> = [
  "Documents",
  "Gear",
  "Clothing",
  "Toiletries",
  "Other",
];

const CATEGORY_LABELS: Record<Language, Record<ChecklistItem["category"], string>> = {
  zh: {
    Documents: "證件與票卡",
    Gear: "電子設備與用品",
    Clothing: "衣物穿搭",
    Toiletries: "盥洗與個人藥品",
    Other: "其他雜項",
  },
  en: {
    Documents: "Documents & Tickets",
    Gear: "Gear & Electronics",
    Clothing: "Clothing",
    Toiletries: "Toiletries & Medicine",
    Other: "Other",
  },
};

const pad2 = (n: number): string => n.toString().padStart(2, "0");

interface ParsedFlightTime {
  formatted: string;
  hasTimezone: boolean;
  ms: number;
}

function formatUtcCompact(ms: number): string {
  const d = new Date(ms);
  return (
    d.getUTCFullYear().toString() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

function formatLocalCompact(ms: number): string {
  const d = new Date(ms);
  return (
    d.getFullYear().toString() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    "T" +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
}

function parseFlightDateTime(raw?: string): ParsedFlightTime | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);

  // Preserve explicit wall-clock airport time when no timezone offset is attached
  const localMatch =
    !hasTimezone &&
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(trimmed);
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4] ?? "9");
    const minute = Number(localMatch[5] ?? "0");
    const second = Number(localMatch[6] ?? "0");
    const probe = new Date(year, month - 1, day, hour, minute, second);
    if (
      !Number.isNaN(probe.getTime()) &&
      probe.getFullYear() === year &&
      probe.getMonth() === month - 1 &&
      probe.getDate() === day
    ) {
      return {
        formatted: `${year}${pad2(month)}${pad2(day)}T${pad2(hour)}${pad2(minute)}${pad2(second)}`,
        hasTimezone: false,
        ms: probe.getTime(),
      };
    }
    return null;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    formatted: hasTimezone ? formatUtcCompact(parsed.getTime()) : formatLocalCompact(parsed.getTime()),
    hasTimezone,
    ms: parsed.getTime(),
  };
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Builds an OAuth-free Google Calendar event template URL for a flight segment.
 * Handles missing or invalid departure/arrival timestamps gracefully.
 */
export function buildGoogleCalendarFlightUrl(segment: FlightSegment, tripName?: string): string {
  const airlineLabel = segment.airlineNameEn || segment.airlineNameZh || segment.airline || "";
  const flightCode = `${airlineLabel} ${segment.flightNumber || ""}`.trim();
  const route =
    segment.departureAirport || segment.arrivalAirport
      ? `${segment.departureAirport || "---"} → ${segment.arrivalAirport || "---"}`
      : "";

  const titleParts = ["✈️", flightCode || "Flight", route ? `(${route})` : ""].filter(Boolean);
  const text = tripName ? `${titleParts.join(" ")} · ${tripName}` : titleParts.join(" ");

  const detailLines = [
    tripName ? `Trip: ${tripName}` : "",
    flightCode ? `Flight: ${flightCode}` : "",
    route ? `Route: ${route}` : "",
    segment.terminal || segment.gate
      ? `Terminal ${segment.terminal || "-"} / Gate ${segment.gate || "-"}`
      : "",
  ].filter(Boolean);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text,
  });

  const start = parseFlightDateTime(segment.departureTime);
  if (start) {
    const end = parseFlightDateTime(segment.arrivalTime);
    const endMs = end && end.ms >= start.ms ? end.ms : start.ms + 3 * 60 * 60 * 1000;
    const endFormatted = end && end.ms >= start.ms
      ? end.formatted
      : start.hasTimezone
        ? formatUtcCompact(endMs)
        : formatLocalCompact(endMs);
    params.set("dates", `${start.formatted}/${endFormatted}`);
  }

  if (detailLines.length > 0) {
    params.set("details", detailLines.join("\n"));
  }
  if (segment.departureAirport) {
    params.set("location", segment.departureAirport);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Formats the trip packing checklist grouped by category with ☐ / ☑ unicode checkboxes
 * ready for Apple Notes, Google Keep, Samsung Notes, or LINE Keep.
 */
export function generateChecklistText(trip: Trip, lang: Language): string {
  const title = trip.name || (lang === "zh" ? "Go Travel 旅程清單" : "Go Travel Checklist");
  const lines: string[] = [
    `🎒 ${title}`,
    trip.destination ? `📍 ${trip.destination}` : "",
    "",
  ].filter((line, idx) => idx !== 1 || line.length > 0);

  const checklist = trip.checklist || [];
  if (checklist.length === 0) {
    lines.push(lang === "zh" ? "（目前尚無行李或待辦項目）" : "(No checklist items yet)");
    return lines.join("\n");
  }

  const labels = CATEGORY_LABELS[lang] || CATEGORY_LABELS.en;
  for (const category of CHECKLIST_CATEGORIES) {
    const items = checklist.filter((item) => item.category === category);
    if (items.length === 0) continue;

    lines.push(`[${labels[category] || category}]`);
    for (const item of items) {
      const box = item.isCompleted ? "☑" : "☐";
      lines.push(`${box} ${item.text}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Generates an RFC 5545 VCALENDAR containing VTODO entries for Apple Reminders / To-Do apps.
 */
export function generateChecklistVtodoIcs(trip: Trip, lang: Language): string {
  const nowStamp = formatUtcCompact(Date.now());
  const labels = CATEGORY_LABELS[lang] || CATEGORY_LABELS.en;
  const calName = trip.name
    ? `${trip.name} - ${lang === "zh" ? "行李清單" : "Checklist"}`
    : lang === "zh"
      ? "Go Travel 行李清單"
      : "Go Travel Checklist";

  const todos = (trip.checklist || []).map((item, idx) => {
    const safeId = (item.id || `item-${idx}`).replace(/[^A-Za-z0-9_-]/g, "-");
    const status = item.isCompleted ? "COMPLETED" : "NEEDS-ACTION";
    const categoryLabel = labels[item.category] || item.category || "Other";

    return [
      "BEGIN:VTODO",
      `UID:gotravel-todo-${safeId}-${idx}@gotravel.app`,
      `DTSTAMP:${nowStamp}`,
      `SUMMARY:${escapeIcsText(item.text || "")}`,
      `CATEGORIES:${escapeIcsText(categoryLabel)}`,
      `STATUS:${status}`,
      `PERCENT-COMPLETE:${item.isCompleted ? 100 : 0}`,
      "END:VTODO",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GoTravel//Checklist VTODO RFC5545//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    ...todos,
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Downloads the trip checklist as an RFC 5545 VTODO `.ics` file.
 */
export function downloadChecklistVtodoIcs(trip: Trip, lang: Language): void {
  const ics = generateChecklistVtodoIcs(trip, lang);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const filename = `${sanitizeFilenameBase(trip.name, "trip")}-checklist.ics`;
  triggerBlobDownload(blob, filename);
}

/**
 * Shares the unicode-checkbox checklist via native Web Share API or copies it to clipboard.
 */
export async function shareChecklistToNotes(
  trip: Trip,
  lang: Language
): Promise<"shared" | "copied"> {
  const text = generateChecklistText(trip, lang);
  const title = `${trip.name || "Go Travel"} - ${lang === "zh" ? "行李清單" : "Checklist"}`;

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch {
      // Fall back to clipboard when native share is unavailable or cancelled
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }

  return "copied";
}
