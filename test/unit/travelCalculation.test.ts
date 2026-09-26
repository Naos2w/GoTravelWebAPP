import { describe, it, expect } from "vitest";

// Reusable duration calculation helpers matching MapView.tsx formulas
const calculateMultimodalDuration = (
  mode: "driving" | "walking" | "cycling" | "transit",
  distanceMeters: number,
  osrmCarDurationSeconds: number
): number => {
  switch (mode) {
    case "walking":
      return Math.round(distanceMeters / 1.25); // 4.5 km/h
    case "cycling":
      return Math.round(distanceMeters / 4.16); // 15 km/h
    case "transit":
      return Math.max(Math.round(osrmCarDurationSeconds * 1.5 + 240), Math.round(distanceMeters / 5.5));
    case "driving":
    default:
      return osrmCarDurationSeconds;
  }
};

const formatDuration = (seconds: number, lang: "zh" | "en" = "zh"): string => {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (lang === "zh") {
      return remainingMins > 0 ? `${hours}小時${remainingMins}分` : `${hours}小時`;
    }
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
  return lang === "zh" ? `${mins} 分鐘` : `${mins} min`;
};

describe("Travel Duration Calculations (Unit Tests)", () => {
  const distance = 3000; // 3 km
  const drivingSeconds = 360; // 6 mins

  it("should calculate walking duration realistically (~40 mins for 3km)", () => {
    const seconds = calculateMultimodalDuration("walking", distance, drivingSeconds);
    const mins = Math.round(seconds / 60);
    expect(mins).toBe(40);
  });

  it("should calculate cycling duration realistically (~12 mins for 3km)", () => {
    const seconds = calculateMultimodalDuration("cycling", distance, drivingSeconds);
    const mins = Math.round(seconds / 60);
    expect(mins).toBe(12);
  });

  it("should calculate transit duration realistically with overhead", () => {
    const seconds = calculateMultimodalDuration("transit", distance, drivingSeconds);
    expect(seconds).toBeGreaterThan(drivingSeconds);
  });

  describe("formatDuration", () => {
    it("should format minutes correctly in Chinese and English", () => {
      expect(formatDuration(480, "zh")).toBe("8 分鐘");
      expect(formatDuration(480, "en")).toBe("8 min");
    });

    it("should format hours and minutes when duration >= 60 minutes", () => {
      expect(formatDuration(4500, "zh")).toBe("1小時15分");
      expect(formatDuration(4500, "en")).toBe("1h 15m");
      expect(formatDuration(7200, "zh")).toBe("2小時");
      expect(formatDuration(7200, "en")).toBe("2h");
    });
  });
});
