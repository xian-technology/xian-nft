import { describe, expect, it } from "vitest";

import {
  framesToPixels,
  indexToChar,
  paletteIndexFor,
  pixelGridHashSource,
  pixelsToFrames
} from "./pixelgrid";
import { PIXEL_ALPHABET, PIXELGRID_SCHEMA } from "./constants";

describe("pixelgrid helpers", () => {
  it("PIXEL_ALPHABET maps both ways", () => {
    expect(PIXEL_ALPHABET.length).toBe(64);
    for (let i = 0; i < PIXEL_ALPHABET.length; i++) {
      const char = indexToChar(i);
      expect(paletteIndexFor(char)).toBe(i);
    }
  });

  it("framesToPixels round-trips through pixelsToFrames", () => {
    const frames = [
      { indices: [0, 1, 2, 3] },
      { indices: [3, 2, 1, 0] }
    ];
    const encoded = framesToPixels(frames);
    expect(encoded).toBe("01233210");
    const decoded = pixelsToFrames({
      paletteId: "x",
      width: 2,
      height: 2,
      frameCount: 2,
      frameDelayMs: 100,
      pixels: encoded
    });
    expect(decoded).toEqual(frames);
  });

  it("pixelsToFrames rejects mismatched lengths", () => {
    expect(() =>
      pixelsToFrames({
        paletteId: "x",
        width: 2,
        height: 2,
        frameCount: 1,
        frameDelayMs: 0,
        pixels: "0123456" // 7 chars, expected 4
      })
    ).toThrow();
  });

  it("pixelGridHashSource matches the contract format", () => {
    const source = pixelGridHashSource({
      paletteId: "neon",
      width: 4,
      height: 2,
      frameCount: 2,
      frameDelayMs: 120,
      pixels: "0123012301230123"
    });
    expect(source).toBe(`${PIXELGRID_SCHEMA}:neon:4:2:2:120:0123012301230123`);
  });

  it("paletteIndexFor rejects out-of-alphabet characters", () => {
    expect(() => paletteIndexFor("!")).toThrow();
  });
});
