import { describe, it, expect } from "vitest";
import { CATEGORY_UI, getCategoryName } from "../../components/ExpenseCategories";

describe("ExpenseCategories", () => {
  const expectedCategories = [
    "Flight",
    "Food",
    "Accommodation",
    "Transport",
    "Tickets",
    "Shopping",
    "Other"
  ];

  it("contains all standard expense categories with required UI properties", () => {
    for (const cat of expectedCategories) {
      expect(CATEGORY_UI).toHaveProperty(cat);
      const config = CATEGORY_UI[cat];
      expect(config.icon).toBeDefined();
      expect(config.color).toMatch(/^bg-/);
      expect(config.hexColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(config.bgColor).toMatch(/^bg-/);
      expect(config.darkBgColor).toMatch(/^dark:bg-/);
      expect(config.textColor).toMatch(/^text-/);
    }
  });

  describe("getCategoryName", () => {
    const mockT = (key: string) => `translated_${key}`;

    it("translates each known category correctly", () => {
      expect(getCategoryName("Flight", mockT)).toBe("translated_catFlight");
      expect(getCategoryName("Food", mockT)).toBe("translated_catFood");
      expect(getCategoryName("Accommodation", mockT)).toBe("translated_catAccom");
      expect(getCategoryName("Transport", mockT)).toBe("translated_catTransport");
      expect(getCategoryName("Tickets", mockT)).toBe("translated_catTickets");
      expect(getCategoryName("Shopping", mockT)).toBe("translated_catShopping");
      expect(getCategoryName("Other", mockT)).toBe("translated_catOther");
    });

    it("falls back to the raw category string for unknown categories", () => {
      expect(getCategoryName("CustomCategory", mockT)).toBe("CustomCategory");
      expect(getCategoryName("Miscellaneous", mockT)).toBe("Miscellaneous");
    });
  });
});
