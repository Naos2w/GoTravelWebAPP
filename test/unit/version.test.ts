import { describe, it, expect } from "vitest";
import { APP_VERSION } from "../../services/version";
import pkg from "../../package.json";

describe("version", () => {
  it("exports a valid Semantic Version string matching package.json", () => {
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/);
  });

  it("is set to version 1.4.0 or higher", () => {
    const [major, minor] = APP_VERSION.split(".").map(Number);
    expect(major).toBeGreaterThanOrEqual(1);
    expect(minor).toBeGreaterThanOrEqual(4);
  });
});
