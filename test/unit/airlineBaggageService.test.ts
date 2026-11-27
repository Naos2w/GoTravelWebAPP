import { describe, it, expect } from "vitest";
import {
  getDefaultBaggage,
  isSameBaggage,
  inferAirlineId,
  formatBaggageSummary,
} from "../../services/airlineBaggageService";

describe("airlineBaggageService", () => {
  describe("getDefaultBaggage", () => {
    it("returns Asia regional full-service Economy presets (JX, BR, CI, JL, NH, CX, SQ, KE, OZ, TG)", () => {
      for (const code of ["JX", "BR", "CI", "JL", "NH", "CX", "SQ", "KE", "OZ", "TG"]) {
        expect(getDefaultBaggage(code, "Economy")).toEqual({
          carryOn: { count: 1, weight: "7kg" },
          checked: { count: 1, weight: "23kg" },
        });
      }
    });

    it("returns two 23kg checked bags for long-haul full-service Economy carriers", () => {
      for (const code of ["AC", "UA", "DL", "AA", "LH", "LX", "BA", "AF", "QF"]) {
        expect(getDefaultBaggage(code, "Economy")).toEqual({
          carryOn: { count: 1, weight: "7kg" },
          checked: { count: 2, weight: "23kg" },
        });
      }
    });

    it("upgrades full-service Business and First Class to 2x7kg carry-on and 2x32kg checked", () => {
      for (const cabin of ["Business", "First", "First Class"]) {
        expect(getDefaultBaggage("BR", cabin)).toEqual({
          carryOn: { count: 2, weight: "7kg" },
          checked: { count: 2, weight: "32kg" },
        });
        expect(getDefaultBaggage("UA", cabin)).toEqual({
          carryOn: { count: 2, weight: "7kg" },
          checked: { count: 2, weight: "32kg" },
        });
      }
    });

    it("returns LCC allowances with 0 checked bags regardless of cabin input", () => {
      expect(getDefaultBaggage("IT", "Economy")).toEqual({
        carryOn: { count: 2, weight: "10kg" },
        checked: { count: 0, weight: "0kg" },
      });
      expect(getDefaultBaggage("TR", "Business")).toEqual({
        carryOn: { count: 2, weight: "10kg" },
        checked: { count: 0, weight: "0kg" },
      });
      for (const code of ["MM", "GK", "3K", "JQ", "AK", "D7", "FD"]) {
        expect(getDefaultBaggage(code)).toEqual({
          carryOn: { count: 2, weight: "7kg" },
          checked: { count: 0, weight: "0kg" },
        });
      }
      for (const code of ["7C", "TW", "LJ"]) {
        expect(getDefaultBaggage(code)).toEqual({
          carryOn: { count: 1, weight: "10kg" },
          checked: { count: 0, weight: "0kg" },
        });
      }
      expect(getDefaultBaggage("UO")).toEqual({
        carryOn: { count: 1, weight: "7kg" },
        checked: { count: 0, weight: "0kg" },
      });
    });

    it("normalizes case/whitespace and falls back cleanly for unknown airlines", () => {
      expect(getDefaultBaggage(" it ", "Economy")).toEqual({
        carryOn: { count: 2, weight: "10kg" },
        checked: { count: 0, weight: "0kg" },
      });
      expect(getDefaultBaggage(undefined, undefined)).toEqual({
        carryOn: { count: 1, weight: "7kg" },
        checked: { count: 1, weight: "23kg" },
      });
      expect(getDefaultBaggage("ZZ", "Business")).toEqual({
        carryOn: { count: 2, weight: "7kg" },
        checked: { count: 2, weight: "32kg" },
      });
    });

    it("returns a fresh object on every call", () => {
      const a = getDefaultBaggage("BR", "Economy");
      const b = getDefaultBaggage("BR", "Economy");
      a.checked.count = 9;
      expect(b.checked.count).toBe(1);
    });
  });

  describe("helpers", () => {
    it("isSameBaggage compares numeric weights and counts", () => {
      expect(
        isSameBaggage(
          { carryOn: { count: 1, weight: "7kg" }, checked: { count: 1, weight: "23kg" } },
          { carryOn: { count: 1, weight: "7" }, checked: { count: 1, weight: "23kg" } }
        )
      ).toBe(true);
      expect(
        isSameBaggage(
          { carryOn: { count: 1, weight: "7kg" }, checked: { count: 2, weight: "23kg" } },
          { carryOn: { count: 1, weight: "7kg" }, checked: { count: 1, weight: "23kg" } }
        )
      ).toBe(false);
    });

    it("inferAirlineId extracts 2-char IATA prefix from valid flight numbers", () => {
      expect(inferAirlineId("BR198")).toBe("BR");
      expect(inferAirlineId(" 3k512 ")).toBe("3K");
      expect(inferAirlineId("IT200")).toBe("IT");
      expect(inferAirlineId("invalid")).toBe("");
    });

    it("formatBaggageSummary formats carry-on and checked parts with none label", () => {
      const labels = { carryOn: "手提", checked: "託運", none: "無" };
      expect(
        formatBaggageSummary(
          { carryOn: { count: 2, weight: "10kg" }, checked: { count: 0, weight: "0kg" } },
          labels
        )
      ).toBe("手提 2×10kg · 託運 無");
    });
  });
});
