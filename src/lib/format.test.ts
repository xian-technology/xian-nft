import { describe, expect, it } from "vitest";

import { isSameAddress, normalizeAddress } from "./format";

describe("address helpers", () => {
  it("normalizes only accidental whitespace", () => {
    expect(normalizeAddress("  abcdef  ")).toBe("abcdef");
    expect(normalizeAddress(null)).toBe("");
  });

  it("compares Xian addresses without Ethereum-style prefix handling", () => {
    expect(isSameAddress("  aabbcc  ", "aabbcc")).toBe(true);
    expect(isSameAddress("0xaabbcc", "aabbcc")).toBe(false);
    expect(isSameAddress("AABBcc", "aabbCC")).toBe(false);
    expect(isSameAddress("", "")).toBe(false);
  });
});
