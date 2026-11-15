import { Trip, Currency } from "../types";

/**
 * Formats a trip into a clean, structured Markdown document
 * optimized for Apple Notes, Notion, and general Markdown apps.
 */
export const generateTripNotesMarkdown = (trip: Trip): string => {
  const lines: string[] = [];

  // Title & Header
  lines.push(`# ✈️ ${trip.name || "旅行計畫"}`);
  lines.push(`> 📍 目的地：${trip.destination || "未設定"}`);
  lines.push(`> 📅 日期：${trip.startDate || ""} ~ ${trip.endDate || ""}`);
  lines.push("");

  // Flight Info (if any)
  if (trip.flights && trip.flights.length > 0) {
    lines.push("## 🛫 航班資訊");
    trip.flights.forEach((f, idx) => {
      const passenger = f.traveler_name ? ` (${f.traveler_name})` : "";
      lines.push(`### 班機 ${idx + 1}${passenger}`);
      if (f.outbound) {
        lines.push(
          `- **去程**：${f.outbound.airline || ""} ${f.outbound.flightNumber || ""} | ` +
            `${f.outbound.departureAirport || ""} ➔ ${f.outbound.arrivalAirport || ""}`
        );
        lines.push(`  - 出發：${f.outbound.departureTime || "未定"}`);
        lines.push(`  - 抵達：${f.outbound.arrivalTime || "未定"}`);
        if (f.outbound.terminal || f.outbound.gate) {
          lines.push(`  - 航廈/登機門：T${f.outbound.terminal || "-"} / Gate ${f.outbound.gate || "-"}`);
        }
      }
      if (f.inbound) {
        lines.push(
          `- **回程**：${f.inbound.airline || ""} ${f.inbound.flightNumber || ""} | ` +
            `${f.inbound.departureAirport || ""} ➔ ${f.inbound.arrivalAirport || ""}`
        );
        lines.push(`  - 出發：${f.inbound.departureTime || "未定"}`);
        lines.push(`  - 抵達：${f.inbound.arrivalTime || "未定"}`);
        if (f.inbound.terminal || f.inbound.gate) {
          lines.push(`  - 航廈/登機門：T${f.inbound.terminal || "-"} / Gate ${f.inbound.gate || "-"}`);
        }
      }
      lines.push("");
    });
  }

  // Itinerary (Daily Plans)
  if (trip.itinerary && trip.itinerary.length > 0) {
    lines.push("## 🗺️ 每日行程時間軸");
    trip.itinerary.forEach((day, dayIndex) => {
      lines.push(`### Day ${dayIndex + 1} (${day.date})`);
      if (!day.items || day.items.length === 0) {
        lines.push(`- *(本日暫無安排行程)*`);
      } else {
        day.items.forEach((item) => {
          const typeIcon = item.type === "Food" ? "🍴" : item.type === "Transport" ? "🚗" : "📍";
          const time = item.time ? `\`${item.time}\`` : "";
          lines.push(`- ${time} ${typeIcon} **${item.placeName}**`);
          if (item.note && item.note.trim()) {
            lines.push(`  - 💡 備註：${item.note.trim()}`);
          }
        });
      }
      lines.push("");
    });
  }

  // Packing & Checklist
  if (trip.checklist && trip.checklist.length > 0) {
    lines.push("## 🎒 行李與待辦清單");
    const categories = ["Documents", "Gear", "Clothing", "Toiletries", "Other"] as const;
    const catTitles: Record<string, string> = {
      Documents: "證件與票卡",
      Gear: "電子設備與用品",
      Clothing: "衣物穿搭",
      Toiletries: "盥洗與個人藥品",
      Other: "其他雜項",
    };

    categories.forEach((cat) => {
      const items = trip.checklist.filter((i) => i.category === cat);
      if (items.length > 0) {
        lines.push(`### ${catTitles[cat] || cat}`);
        items.forEach((item) => {
          const checkMark = item.isCompleted ? "[x]" : "[ ]";
          lines.push(`- ${checkMark} ${item.text}`);
        });
        lines.push("");
      }
    });
  }

  // Budget & Expenses Summary
  const rates: Record<string, number> = {
    TWD: 1,
    USD: 31.5,
    JPY: 0.21,
    EUR: 34.2,
    KRW: 0.024,
  };
  const expensesSum = (trip.expenses || []).reduce(
    (sum, item) => sum + item.amount * (item.exchangeRate || 1),
    0
  );
  const flightsSum = (trip.flights || []).reduce(
    (sum, f) => sum + f.price * (rates[f.currency] || 1),
    0
  );
  const totalTwd = Math.round(expensesSum + flightsSum);

  lines.push("## 💰 預算與記帳總覽");
  lines.push(`- **預算總花費**：約 NT$ ${totalTwd.toLocaleString()}`);
  if (trip.flights && trip.flights.length > 0) {
    lines.push(`  - 機票支出：NT$ ${Math.round(flightsSum).toLocaleString()}`);
  }
  lines.push(`  - 當地消費：NT$ ${Math.round(expensesSum).toLocaleString()}`);
  lines.push("");

  lines.push("---");
  lines.push(`*匯出自 Go Travel 旅程規劃器 • ${new Date().toLocaleDateString()}*`);

  return lines.join("\n");
};

/**
 * Triggers the native system share sheet (Web Share API) on iOS/Android,
 * or copies to clipboard if Web Share API is not supported.
 */
export const exportToAppleNotes = async (
  trip: Trip
): Promise<{ success: boolean; method: "share" | "clipboard" }> => {
  const markdown = generateTripNotesMarkdown(trip);
  const title = `${trip.name || "旅行計畫"} - 行程筆記`;

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title,
        text: markdown,
      });
      return { success: true, method: "share" };
    } catch (err: any) {
      // User cancelled share or aborted
      if (err.name === "AbortError") {
        return { success: false, method: "share" };
      }
      // If Web Share failed unexpectedly, fall back to clipboard
    }
  }

  // Fallback to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(markdown);
    return { success: true, method: "clipboard" };
  }

  return { success: false, method: "clipboard" };
};

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string
 * for adding trip itinerary events & flights into Apple Calendar, Google Calendar, etc.
 */
export const generateICalendar = (trip: Trip): string => {
  const events: string[] = [];

  const pad = (n: number) => n.toString().padStart(2, "0");

  const formatUtcDate = (d: Date): string => {
    return (
      d.getUTCFullYear().toString() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      "Z"
    );
  };

  const escapeIcs = (str: string): string => {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");
  };

  const nowStamp = formatUtcDate(new Date());

  // 1. Process Itinerary Items
  (trip.itinerary || []).forEach((day) => {
    (day.items || []).forEach((item, index) => {
      // Expect item.date and item.time
      const dateStr = item.date || day.date;
      const timeStr = item.time || "09:00";
      if (!dateStr) return;

      const [hours, minutes] = timeStr.split(":").map(Number);
      const startDateTime = new Date(`${dateStr}T${pad(hours || 9)}:${pad(minutes || 0)}:00`);
      if (isNaN(startDateTime.getTime())) return;

      // Default duration: 1.5 hours per attraction, or 45 mins for food
      const durationMins = item.type === "Food" ? 60 : 90;
      const endDateTime = new Date(startDateTime.getTime() + durationMins * 60 * 1000);

      const uid = `gotravel-${item.id || index}-${dateStr}@gotravel.app`;
      const summary = escapeIcs(item.placeName || "行程景點");
      const description = escapeIcs(
        `${trip.name ? `[${trip.name}] ` : ""}${item.note ? `備註: ${item.note}` : ""}`
      );
      const location = escapeIcs(item.placeName || trip.destination || "");

      let eventBlock = [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${formatUtcDate(startDateTime)}`,
        `DTEND:${formatUtcDate(endDateTime)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${location}`,
      ];

      if (item.lat && item.lng) {
        eventBlock.push(`GEO:${item.lat.toFixed(6)};${item.lng.toFixed(6)}`);
      }

      // Add a 30-minute alarm notification before the event
      eventBlock.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:即將前往 ${summary}`,
        "TRIGGER:-PT30M",
        "END:VALARM"
      );

      eventBlock.push("END:VEVENT");
      events.push(eventBlock.join("\r\n"));
    });
  });

  // 2. Process Flights
  (trip.flights || []).forEach((flight, flightIdx) => {
    const handleSegment = (seg: any, direction: "去程" | "回程") => {
      if (!seg || !seg.departureTime) return;
      const startDateTime = new Date(seg.departureTime);
      if (isNaN(startDateTime.getTime())) return;

      const endDateTime = seg.arrivalTime
        ? new Date(seg.arrivalTime)
        : new Date(startDateTime.getTime() + 3 * 3600 * 1000);

      const flightCode = `${seg.airline || ""} ${seg.flightNumber || ""}`.trim();
      const summary = escapeIcs(`✈️ ${flightCode} (${direction}: ${seg.departureAirport} ➔ ${seg.arrivalAirport})`);
      const traveler = flight.traveler_name ? `旅客: ${flight.traveler_name}\n` : "";
      const terminalInfo = seg.terminal || seg.gate ? `航廈: T${seg.terminal || "-"} / 登機門: ${seg.gate || "-"}\n` : "";
      const description = escapeIcs(`${traveler}${terminalInfo}出發: ${seg.departureAirport} ➔ 抵達: ${seg.arrivalAirport}`);

      const uid = `gotravel-flight-${flight.id || flightIdx}-${direction}@gotravel.app`;

      const eventBlock = [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART:${formatUtcDate(startDateTime)}`,
        `DTEND:${formatUtcDate(endDateTime)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${escapeIcs(seg.departureAirport || "機場")}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:航班起飛提醒：${summary}`,
        "TRIGGER:-PT120M", // 2 hours before flight
        "END:VALARM",
        "END:VEVENT",
      ];
      events.push(eventBlock.join("\r\n"));
    };

    if (flight.outbound) handleSegment(flight.outbound, "去程");
    if (flight.inbound) handleSegment(flight.inbound, "回程");
  });

  const icsBody = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//GoTravel//Trip Calendar RFC5545//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(trip.name || "GoTravel 旅程")}`,
    `X-WR-TIMEZONE:UTC`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return icsBody;
};

/**
 * Triggers download of the generated .ics calendar file.
 * On iOS Safari, clicking an .ics file directly opens the native
 * "Add to Apple Calendar" import sheet!
 */
export const downloadICalendar = (trip: Trip): void => {
  const icsContent = generateICalendar(trip);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const filename = `${trip.name || "trip"}-calendar.ics`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
