import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Currency, DayPlan, FlightSegment, Trip } from "../../src/types";
import {
  buildGoogleMapsDayRouteUrl,
  generateTripKml,
  downloadTripKml,
} from "../../src/features/export/services/mapExportService";
import {
  buildGoogleCalendarFlightUrl,
  generateChecklistText,
  generateChecklistVtodoIcs,
  downloadChecklistVtodoIcs,
  shareChecklistToNotes,
} from "../../src/features/export/services/calendarChecklistExportService";
import {
  generatePrintableBookletHtml,
  openPrintableTravelBooklet,
} from "../../src/features/export/services/printBookletService";
import {
  renderPrintableCanvas,
  canvasToDataUrl,
  shareOrDownloadCanvas,
  PrintableCardType,
} from "../../src/features/export/services/canvasExportService";
import { getAirportCoords } from "../../src/features/flights/services/airportCoordsService";

const makeTrip = (overrides: Partial<Trip> = {}): Trip => ({
  id: "trip-1",
  user_id: "u1",
  name: "Kyushu Autumn <Trip> & More",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  destination: "Fukuoka & Yufuin",
  flights: [
    {
      id: "fl-1",
      user_id: "u1",
      traveler_name: "Alice",
      price: 12000,
      currency: Currency.TWD,
      cabinClass: "Economy",
      seat: "14A",
      baggage: {
        carryOn: { count: 1, weight: "7kg" },
        checked: { count: 1, weight: "23kg" },
      },
      outbound: {
        airline: "EVA Air",
        airlineID: "BR",
        flightNumber: "BR106",
        departureAirport: "TPE",
        arrivalAirport: "FUK",
        departureTime: "2026-10-10T08:10:00",
        arrivalTime: "2026-10-10T11:20:00",
        terminal: "2",
        gate: "C8",
      },
      inbound: {
        airline: "EVA Air",
        airlineID: "BR",
        flightNumber: "BR105",
        departureAirport: "FUK",
        arrivalAirport: "TPE",
        departureTime: "2026-10-12T12:20:00",
        arrivalTime: "2026-10-12T13:50:00",
        terminal: "I",
        gate: "52",
      },
    },
  ],
  expenses: [
    {
      id: "exp-1",
      user_id: "u1",
      user_name: "Alice",
      paidBy: "u1",
      paidByName: "Alice",
      splitWith: ["u1", "u2"],
      amount: 4000,
      currency: Currency.JPY,
      category: "Food",
      date: "2026-10-10",
      note: "Hakata Ramen",
      exchangeRate: 0.21,
    },
  ],
  collaborators: [
    { user_id: "u1", email: "alice@example.com", role: "owner" },
    { user_id: "u2", email: "bob@example.com", role: "editor" },
  ],
  checklist: [
    { id: "c1", text: "Passport", isCompleted: true, category: "Documents" },
    { id: "c2", text: "Power Bank", isCompleted: false, category: "Gear" },
    { id: "c3", text: "Light Jacket", isCompleted: false, category: "Clothing" },
  ],
  itinerary: [
    {
      date: "2026-10-10",
      items: [
        {
          id: "i1",
          time: "11:20",
          placeName: "FUK Airport",
          type: "Place",
          transportType: "Flight",
          date: "2026-10-10",
        },
        {
          id: "i2",
          time: "12:00",
          placeName: "Subway to Hakata",
          type: "Transport",
          transportType: "Public",
          date: "2026-10-10",
        },
        {
          id: "i3",
          time: "12:30",
          placeName: "Ichiran & Ramen <HQ>",
          lat: 33.5932,
          lng: 130.4055,
          note: "Check queue > 15m",
          type: "Food",
          date: "2026-10-10",
        },
      ],
    },
  ],
  ...overrides,
});

describe("printExportServices", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("mapExportService", () => {
    it("returns null for 0 non-transport stops and search URL for 1 stop", () => {
      const emptyDay: DayPlan = {
        date: "2026-10-10",
        items: [
          {
            id: "t1",
            time: "09:00",
            placeName: "Metro",
            type: "Transport",
            transportType: "Public",
            date: "2026-10-10",
          },
        ],
      };
      expect(buildGoogleMapsDayRouteUrl(emptyDay)).toBeNull();

      const singleStopDay: DayPlan = {
        date: "2026-10-10",
        items: [
          {
            id: "p1",
            time: "10:00",
            placeName: "Tokyo Tower",
            lat: 35.6586,
            lng: 139.7454,
            type: "Place",
            date: "2026-10-10",
          },
        ],
      };
      const singleUrl = buildGoogleMapsDayRouteUrl(singleStopDay);
      expect(singleUrl).toBe(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("35.6586,139.7454")}`
      );
    });

    it("enriches airport coordinates for 2-stop day route without waypoints", () => {
      const trip = makeTrip();
      const url = buildGoogleMapsDayRouteUrl(trip.itinerary[0]);
      expect(url).not.toBeNull();

      const parsed = new URL(url!);
      const fuk = getAirportCoords("FUK")!;
      expect(parsed.origin + parsed.pathname).toBe("https://www.google.com/maps/dir/");
      expect(parsed.searchParams.get("api")).toBe("1");
      expect(parsed.searchParams.get("origin")).toBe(`${fuk.lat},${fuk.lng}`);
      expect(parsed.searchParams.get("destination")).toBe("33.5932,130.4055");
      expect(parsed.searchParams.get("waypoints")).toBeNull();
      expect(parsed.searchParams.get("travelmode")).toBe("transit");
    });

    it("caps intermediate waypoints at 8 when a day has 12 stops and uses placeName fallback", () => {
      const items = Array.from({ length: 12 }, (_, idx) => ({
        id: `s-${idx}`,
        time: `${String(8 + idx).padStart(2, "0")}:00`,
        placeName: `Stop ${idx + 1}`,
        ...(idx < 11 ? { lat: 35 + idx * 0.01, lng: 139 + idx * 0.01 } : {}),
        type: "Place" as const,
        transportType: "Car" as const,
        date: "2026-10-10",
      }));

      const url = buildGoogleMapsDayRouteUrl({ date: "2026-10-10", items });
      expect(url).not.toBeNull();
      const parsed = new URL(url!);
      expect(parsed.searchParams.get("origin")).toBe("35,139");
      expect(parsed.searchParams.get("destination")).toBe("Stop 12");
      expect(parsed.searchParams.get("travelmode")).toBe("driving");

      const waypoints = parsed.searchParams.get("waypoints")!.split("|");
      expect(waypoints).toHaveLength(8);
      expect(waypoints[0]).toBe("35.01,139.01");
      expect(waypoints[7]).toBe("35.08,139.08");
    });

    it("generates valid KML 2.2 with per-day Folder, lng,lat,0 coordinate order, and XML escaping", () => {
      const trip = makeTrip();
      const kml = generateTripKml(trip, "en");
      const fuk = getAirportCoords("FUK")!;

      expect(kml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
      expect(kml).toContain("<name>Kyushu Autumn &lt;Trip&gt; &amp; More</name>");
      expect(kml).toContain("<Folder>");
      expect(kml).toContain("<name>Day 1 (2026-10-10)</name>");
      expect(kml).toContain("<name>Ichiran &amp; Ramen &lt;HQ&gt;</name>");
      expect(kml).toContain("Check queue &gt; 15m");
      // KML coordinates are lng,lat,0
      expect(kml).toContain(`<coordinates>${fuk.lng},${fuk.lat},0</coordinates>`);
      expect(kml).toContain("<coordinates>130.4055,33.5932,0</coordinates>");
      // Transport item without coords should not become a placemark
      expect(kml).not.toContain("Subway to Hakata");
    });

    it("triggers KML file download cleanly", () => {
      const createObjectURL = vi.fn(() => "blob:kml-url");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      downloadTripKml(makeTrip(), "zh");

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:kml-url");
    });
  });

  describe("calendarChecklistExportService", () => {
    it("builds a properly encoded Google Calendar flight URL with YYYYMMDDTHHMMSS dates", () => {
      const seg: FlightSegment = {
        airline: "EVA Air",
        flightNumber: "BR106",
        departureAirport: "TPE",
        arrivalAirport: "FUK",
        departureTime: "2026-10-10T08:10:00",
        arrivalTime: "2026-10-10T11:20:00",
        terminal: "2",
        gate: "C8",
      };

      const url = buildGoogleCalendarFlightUrl(seg, "Kyushu Trip");
      const parsed = new URL(url);

      expect(parsed.origin + parsed.pathname).toBe("https://calendar.google.com/calendar/render");
      expect(parsed.searchParams.get("action")).toBe("TEMPLATE");
      expect(parsed.searchParams.get("text")).toContain("EVA Air BR106");
      expect(parsed.searchParams.get("text")).toContain("TPE → FUK");
      expect(parsed.searchParams.get("dates")).toBe("20261010T081000/20261010T112000");
      expect(parsed.searchParams.get("location")).toBe("TPE");
      expect(parsed.searchParams.get("details")).toContain("Terminal 2 / Gate C8");
    });

    it("handles missing or invalid flight times gracefully without NaN", () => {
      const missingTimeSeg: FlightSegment = {
        airline: "Starlux",
        flightNumber: "JX840",
        departureAirport: "TPE",
        arrivalAirport: "FUK",
        departureTime: "not-a-date",
        arrivalTime: "",
      };

      const url = buildGoogleCalendarFlightUrl(missingTimeSeg);
      const parsed = new URL(url);
      expect(url).not.toContain("NaN");
      expect(parsed.searchParams.get("action")).toBe("TEMPLATE");
      expect(parsed.searchParams.get("dates")).toBeNull();

      const missingArrivalSeg: FlightSegment = {
        ...missingTimeSeg,
        departureTime: "2026-10-10T09:00:00",
      };
      const withDefaultEnd = new URL(buildGoogleCalendarFlightUrl(missingArrivalSeg));
      expect(withDefaultEnd.searchParams.get("dates")).toBe("20261010T090000/20261010T120000");
    });

    it("formats checklist text with ☐ and ☑ checkboxes grouped by category", () => {
      const text = generateChecklistText(makeTrip(), "en");
      expect(text).toContain("[Documents & Tickets]");
      expect(text).toContain("☑ Passport");
      expect(text).toContain("[Gear & Electronics]");
      expect(text).toContain("☐ Power Bank");
      expect(text).toContain("[Clothing]");
      expect(text).toContain("☐ Light Jacket");
    });

    it("generates RFC 5545 VCALENDAR with VTODO entries and COMPLETED / NEEDS-ACTION status", () => {
      const ics = generateChecklistVtodoIcs(makeTrip(), "en");
      expect(ics).toContain("BEGIN:VCALENDAR");
      expect(ics).toContain("VERSION:2.0");
      expect(ics).toContain("BEGIN:VTODO");
      expect(ics).toContain("SUMMARY:Passport");
      expect(ics).toContain("STATUS:COMPLETED");
      expect(ics).toContain("SUMMARY:Power Bank");
      expect(ics).toContain("STATUS:NEEDS-ACTION");
      expect(ics).toContain("CATEGORIES:Documents & Tickets");
      expect(ics).toContain("END:VTODO");
      expect(ics).toContain("END:VCALENDAR");
    });

    it("shares checklist via Web Share API or falls back to clipboard, and downloads VTODO .ics", async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { share: shareMock });
      expect(await shareChecklistToNotes(makeTrip(), "zh")).toBe("shared");
      expect(shareMock).toHaveBeenCalledTimes(1);

      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      expect(await shareChecklistToNotes(makeTrip(), "en")).toBe("copied");
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining("☑ Passport"));

      const createObjectURL = vi.fn(() => "blob:vtodo-url");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      downloadChecklistVtodoIcs(makeTrip(), "en");
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:vtodo-url");
    });
  });

  describe("printBookletService", () => {
    it("generates XSS-safe printable HTML with A4 @media print rules, flights, itinerary, and checkboxes", () => {
      const xssTrip = makeTrip({
        name: '<script>alert("xss")</script>',
        destination: 'Tokyo "B" & <Test>',
        checklist: [
          { id: "x1", text: "<img src=x onerror=alert(1)>", isCompleted: false, category: "Other" },
          { id: "x2", text: "JR Pass", isCompleted: true, category: "Documents" },
        ],
      });

      const html = generatePrintableBookletHtml(xssTrip, "en");
      expect(html).toContain("@media print");
      expect(html).toContain("@page { size: A4; margin: 14mm; }");
      expect(html).toContain("break-inside: avoid");
      expect(html).not.toContain('<script>alert("xss")</script>');
      expect(html).not.toContain("<img src=x onerror=alert(1)>");
      expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(html).toContain("BR106");
      expect(html).toContain("☐");
      expect(html).toContain("☑");
    });

    it("opens a print window and triggers print(), returning true", () => {
      const printMock = vi.fn();
      const focusMock = vi.fn();
      const openMock = vi.fn();
      const writeMock = vi.fn();
      const closeMock = vi.fn();

      vi.spyOn(window, "open").mockReturnValue({
        document: { open: openMock, write: writeMock, close: closeMock },
        focus: focusMock,
        print: printMock,
      } as unknown as Window);

      expect(openPrintableTravelBooklet(makeTrip(), "zh")).toBe(true);
      expect(writeMock).toHaveBeenCalledWith(expect.stringContaining("@media print"));
      expect(printMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("canvasExportService", () => {
    it("renders all 4 printable card types gracefully even when getContext('2d') returns null", () => {
      const trip = makeTrip();
      const types: PrintableCardType[] = ["receipt", "boarding-pass", "lockscreen", "story"];

      for (const type of types) {
        const canvas = renderPrintableCanvas(type, {
          trip,
          lang: "zh",
          dayIndex: 0,
          flightIndex: 0,
          theme: "dark",
        });
        expect(canvas).toBeInstanceOf(HTMLCanvasElement);
        expect(canvas.width).toBeGreaterThan(0);
        expect(canvas.height).toBeGreaterThan(0);
      }

      const lockscreen = renderPrintableCanvas("lockscreen", { trip, lang: "en" });
      expect(lockscreen.width).toBe(1080);
      expect(lockscreen.height).toBe(2340);

      const story = renderPrintableCanvas("story", { trip, lang: "en" });
      expect(story.width).toBe(1080);
      expect(story.height).toBe(1920);
    });

    it("draws receipt settlement, boarding pass, lockscreen, and story with a 2D context", () => {
      const drawnText: string[] = [];
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        scale: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillRect: vi.fn(),
        setLineDash: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: text.length * 6 })),
        fillText: vi.fn((text: string) => {
          drawnText.push(text);
        }),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        font: "",
        textAlign: "left",
      };

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === "canvas") {
          (el as HTMLCanvasElement).getContext = (() => mockCtx) as unknown as HTMLCanvasElement["getContext"];
        }
        return el;
      });

      const trip = makeTrip();
      const receiptCanvas = renderPrintableCanvas("receipt", { trip, lang: "zh" });
      expect(receiptCanvas.width).toBe(760);
      expect(drawnText.some((t) => t.includes("SETTLED"))).toBe(true);
      expect(drawnText.some((t) => t.includes("bob → Alice"))).toBe(true);

      drawnText.length = 0;
      renderPrintableCanvas("boarding-pass", { trip, lang: "en", theme: "dark" });
      expect(drawnText).toContain("TPE");
      expect(drawnText).toContain("FUK");

      drawnText.length = 0;
      renderPrintableCanvas("story", { trip, lang: "en", theme: "light" });
      expect(drawnText).toContain("Go Travel");
    });

    it("handles canvasToDataUrl safely and falls back to PNG download when Web Share is unavailable", async () => {
      const fakeCanvas = document.createElement("canvas");
      fakeCanvas.toDataURL = vi.fn(() => {
        throw new Error("canvas unavailable");
      });
      expect(canvasToDataUrl(fakeCanvas)).toBe("");

      // Test download fallback
      const createObjectURL = vi.fn(() => "blob:png-url");
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
      vi.stubGlobal("navigator", {});
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

      const realishCanvas = document.createElement("canvas");
      realishCanvas.toBlob = (cb) => cb(new Blob(["png"], { type: "image/png" }));

      expect(await shareOrDownloadCanvas(realishCanvas, "receipt-card", "Trip Receipt")).toBe("downloaded");
      expect(clickSpy).toHaveBeenCalledTimes(1);

      // Test Web Share Level 2 path
      const share = vi.fn().mockResolvedValue(undefined);
      const canShare = vi.fn(() => true);
      vi.stubGlobal("navigator", { share, canShare });

      expect(await shareOrDownloadCanvas(realishCanvas, "receipt-card.png", "Trip Receipt")).toBe("shared");
      expect(canShare).toHaveBeenCalledTimes(1);
      expect(share).toHaveBeenCalledTimes(1);
    });
  });
});
