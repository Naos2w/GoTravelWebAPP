import { describe, it, expect } from "vitest";
import { translations } from "../../contexts/LocalizationContext";

describe("LocalizationContext (Unit Tests)", () => {
  it("should have identical translation keys in both zh and en", () => {
    const zhKeys = Object.keys(translations.zh).sort();
    const enKeys = Object.keys(translations.en).sort();

    // Check if any keys are missing in English
    const missingInEn = zhKeys.filter((key) => !(key in translations.en));
    // Check if any keys are missing in Chinese
    const missingInZh = enKeys.filter((key) => !(key in translations.zh));

    expect(missingInEn, `Missing translation keys in 'en': ${missingInEn.join(", ")}`).toEqual([]);
    expect(missingInZh, `Missing translation keys in 'zh': ${missingInZh.join(", ")}`).toEqual([]);
  });

  it("should have non-empty string values for all keys", () => {
    for (const lang of ["zh", "en"] as const) {
      const dict = translations[lang];
      for (const [key, value] of Object.entries(dict)) {
        expect(typeof value, `Expected ${lang}.${key} to be a string`).toBe("string");
        expect(value.trim().length, `Expected ${lang}.${key} not to be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("should provide essential security and redirection keys in both languages", () => {
    const requiredKeys = [
      "sessionExpired",
      "sessionExpiredTitle",
      "sessionExpiredDesc",
      "loginRequiredTitle",
      "loginRequiredDesc",
      "targetTripSaved",
      "tripNotFoundRedirect",
      "loginRequiredRedirect",
      "noPermissionRedirect",
    ] as const;

    for (const key of requiredKeys) {
      expect(translations.zh[key]).toBeDefined();
      expect(translations.en[key]).toBeDefined();
    }
  });
});
