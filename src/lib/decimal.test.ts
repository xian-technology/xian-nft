import { describe, expect, it } from "vitest";

import {
  compareDecimal,
  formatDecimal,
  formatPrice,
  isPositiveDecimal,
  isZeroDecimal,
  toDecimalString
} from "./decimal";

describe("decimal helpers", () => {
  describe("toDecimalString", () => {
    it("canonicalizes whitespace and trailing zeros", () => {
      expect(toDecimalString("  1.230000  ")).toBe("1.23");
      expect(toDecimalString("000123.4500")).toBe("123.45");
      expect(toDecimalString("0.0")).toBe("0");
      expect(toDecimalString("-0")).toBe("0");
    });

    it("preserves precision past Number's safe range", () => {
      // 21 significant digits — would round through Number.
      const raw = "123456789012345.6789012345";
      expect(toDecimalString(raw)).toBe(raw);
    });

    it("returns 0 for null/empty/garbage", () => {
      expect(toDecimalString(null)).toBe("0");
      expect(toDecimalString("")).toBe("0");
      expect(toDecimalString("abc")).toBe("0");
    });

    it("flattens scientific notation", () => {
      expect(toDecimalString("1.5e3")).toBe("1500");
    });
  });

  describe("isPositiveDecimal / isZeroDecimal", () => {
    it("recognises strictly-positive values only", () => {
      expect(isPositiveDecimal("0.0001")).toBe(true);
      expect(isPositiveDecimal("0")).toBe(false);
      expect(isPositiveDecimal("-0.5")).toBe(false);
      expect(isPositiveDecimal("")).toBe(false);
    });

    it("treats canonical zero as zero", () => {
      expect(isZeroDecimal("0")).toBe(true);
      expect(isZeroDecimal("0.0000")).toBe(true);
      expect(isZeroDecimal("0.000001")).toBe(false);
    });
  });

  describe("compareDecimal", () => {
    it("respects digit count over lexicographic order", () => {
      expect(compareDecimal("9", "10")).toBe(-1);
      expect(compareDecimal("100", "9")).toBe(1);
    });

    it("compares fractional parts after width alignment", () => {
      expect(compareDecimal("0.0001", "0.001")).toBe(-1);
      expect(compareDecimal("0.5", "0.50000")).toBe(0);
    });

    it("orders negatives correctly", () => {
      expect(compareDecimal("-5", "-3")).toBe(-1);
      expect(compareDecimal("-1", "0")).toBe(-1);
    });
  });

  describe("formatPrice / formatDecimal", () => {
    it("preserves precision in price formatting", () => {
      expect(formatPrice("1.23456789")).toBe("1.23456789");
      // High-precision values keep full precision when given enough digit budget.
      expect(formatPrice("1000000.000000001", 12)).toBe("1000000.000000001");
      // Default budget (8) trims past the cap — and crucially still doesn't go through Number.
      expect(formatPrice("1.234567890123")).toBe("1.23456789");
    });

    it("optionally abbreviates large magnitudes", () => {
      expect(formatDecimal("1500", { abbreviate: true })).toBe("1.5k");
      expect(formatDecimal("2500000", { abbreviate: true })).toBe("2.5M");
      expect(formatDecimal("0.00123", { abbreviate: true })).toBe("0.00123");
    });
  });
});
