import { describe, it, expect } from "vitest";
import { DateTimeUtils } from "../../services/dateTimeUtils";

describe("DateTimeUtils", () => {
  describe("formatTime24", () => {
    it("formats a Date object to strict 24h HH:mm format", () => {
      const date = new Date(2026, 4, 15, 14, 5);
      expect(DateTimeUtils.formatTime24(date)).toBe("14:05");
    });

    it("formats morning single-digit hours and minutes with leading zero", () => {
      const date = new Date(2026, 4, 15, 8, 9);
      expect(DateTimeUtils.formatTime24(date)).toBe("08:09");
    });

    it("returns default fallback 09:00 when input is null or undefined", () => {
      expect(DateTimeUtils.formatTime24(null)).toBe("09:00");
      expect(DateTimeUtils.formatTime24(undefined)).toBe("09:00");
    });

    it("returns default fallback 09:00 when input date string is invalid", () => {
      expect(DateTimeUtils.formatTime24("not-a-valid-date")).toBe("09:00");
    });
  });

  describe("formatDate", () => {
    it("formats Date to YYYY-MM-DD in local time", () => {
      const date = new Date(2026, 8, 27); // September 27, 2026
      expect(DateTimeUtils.formatDate(date)).toBe("2026-09-27");
    });

    it("returns empty string when input is null, undefined, or invalid", () => {
      expect(DateTimeUtils.formatDate(null)).toBe("");
      expect(DateTimeUtils.formatDate(undefined)).toBe("");
      expect(DateTimeUtils.formatDate("invalid-date")).toBe("");
    });
  });

  describe("formatDateFriendly", () => {
    it("formats date with friendly display for zh and en locales", () => {
      const date = new Date(2026, 8, 27);
      const zhResult = DateTimeUtils.formatDateFriendly(date, "zh");
      const enResult = DateTimeUtils.formatDateFriendly(date, "en");

      expect(zhResult).toBeTruthy();
      expect(enResult).toBeTruthy();
      expect(enResult).toContain("2026");
    });

    it("returns empty string for invalid dates", () => {
      expect(DateTimeUtils.formatDateFriendly(null)).toBe("");
      expect(DateTimeUtils.formatDateFriendly("invalid")).toBe("");
    });
  });

  describe("combineToISO", () => {
    it("combines date string and time string correctly", () => {
      expect(DateTimeUtils.combineToISO("2026-10-01", "15:30")).toBe("2026-10-01T15:30:00");
    });

    it("uses default 09:00 when timePart is empty or omitted", () => {
      expect(DateTimeUtils.combineToISO("2026-10-01", "")).toBe("2026-10-01T09:00:00");
    });

    it("returns empty string if datePart is missing", () => {
      expect(DateTimeUtils.combineToISO("", "15:30")).toBe("");
    });
  });

  describe("isValidTime24", () => {
    it("returns true for valid 24h times", () => {
      expect(DateTimeUtils.isValidTime24("00:00")).toBe(true);
      expect(DateTimeUtils.isValidTime24("09:30")).toBe(true);
      expect(DateTimeUtils.isValidTime24("14:45")).toBe(true);
      expect(DateTimeUtils.isValidTime24("23:59")).toBe(true);
    });

    it("returns false for invalid times", () => {
      expect(DateTimeUtils.isValidTime24("24:00")).toBe(false);
      expect(DateTimeUtils.isValidTime24("12:60")).toBe(false);
      expect(DateTimeUtils.isValidTime24("9:00")).toBe(false);
      expect(DateTimeUtils.isValidTime24("")).toBe(false);
      expect(DateTimeUtils.isValidTime24("ab:cd")).toBe(false);
    });
  });

  describe("getDuration", () => {
    it("calculates minutes within the same hour", () => {
      expect(DateTimeUtils.getDuration("09:00", "09:45")).toBe("45m");
    });

    it("calculates hours and minutes across hours", () => {
      expect(DateTimeUtils.getDuration("09:00", "10:30")).toBe("1h30m");
      expect(DateTimeUtils.getDuration("10:00", "12:00")).toBe("2h0m");
    });

    it("calculates overnight duration across midnight correctly", () => {
      // 23:00 to 01:30 should be 2 hours 30 mins
      expect(DateTimeUtils.getDuration("23:00", "01:30")).toBe("2h30m");
    });

    it("returns 0M when input is missing or empty", () => {
      expect(DateTimeUtils.getDuration("", "10:00")).toBe("0M");
      expect(DateTimeUtils.getDuration("09:00", "")).toBe("0M");
    });
  });
});
