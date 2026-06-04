/**
 * XSC-0005 PixelGrid extension helpers.
 *
 * The PixelGrid extension stores pixel-art tokens compactly as:
 *   - a palette (list of hex/transparent colors, locked before mint)
 *   - a `pixels` string in `palette-index-64` encoding (one char per pixel,
 *     each char is a palette index into PIXEL_ALPHABET)
 *   - width, height, frame_count, frame_delay_ms
 *
 * Reference: xian-xips/XSC005_non_fungible_token/XSC0005_nft.py
 */

import {
  PIXEL_ALPHABET,
  PIXELGRID_ENCODING,
  PIXELGRID_MIME,
  PIXELGRID_SCHEMA
} from "./constants";
import { getPaletteColor, getPaletteInfo, type PaletteInfo } from "./nft";
import { sha256Hex } from "./hash";
import { subscribeRpcEpoch } from "./xian";

export interface PixelGridSpec {
  paletteId: string;
  width: number;
  height: number;
  frameCount: number;
  frameDelayMs: number;
  pixels: string;
}

export interface ResolvedPalette {
  info: PaletteInfo;
  colors: string[];
}

export interface PixelGridFrame {
  /** Palette indices, length = width * height, in row-major order. */
  indices: number[];
}

const ALPHABET_INDEX = new Map<string, number>();
for (let i = 0; i < PIXEL_ALPHABET.length; i++) ALPHABET_INDEX.set(PIXEL_ALPHABET[i], i);

/** Maximum palette colors per contract (`MAX_PALETTE_SIZE`). */
export const MAX_PALETTE_SIZE = 64;
/** Maximum encoded pixel data length (`MAX_PIXEL_DATA_LENGTH`). */
export const MAX_PIXEL_DATA_LENGTH = 8192;
/** Maximum frame count per token (`MAX_FRAME_COUNT`). */
export const MAX_FRAME_COUNT = 64;
/** Maximum frame delay (`MAX_FRAME_DELAY_MS`). */
export const MAX_FRAME_DELAY_MS = 10000;
/** Maximum per-axis pixel count (`MAX_PIXEL_DIMENSION`). */
export const MAX_PIXEL_DIMENSION = 512;

export function paletteIndexFor(char: string): number {
  const idx = ALPHABET_INDEX.get(char);
  if (idx === undefined) throw new Error(`Invalid palette character: ${JSON.stringify(char)}`);
  return idx;
}

export function indexToChar(index: number): string {
  if (index < 0 || index >= PIXEL_ALPHABET.length) {
    throw new Error(`Palette index out of range: ${index}`);
  }
  return PIXEL_ALPHABET[index];
}

export function pixelsToFrames(spec: PixelGridSpec): PixelGridFrame[] {
  const { width, height, frameCount, pixels } = spec;
  const cellsPerFrame = width * height;
  const totalCells = cellsPerFrame * frameCount;
  if (pixels.length !== totalCells) {
    throw new Error(
      `Pixel data length ${pixels.length} does not match width*height*frame_count=${totalCells}`
    );
  }
  const frames: PixelGridFrame[] = [];
  for (let f = 0; f < frameCount; f++) {
    const indices: number[] = new Array(cellsPerFrame);
    for (let i = 0; i < cellsPerFrame; i++) {
      indices[i] = paletteIndexFor(pixels[f * cellsPerFrame + i]);
    }
    frames.push({ indices });
  }
  return frames;
}

/**
 * Compose a `palette-index-64` pixel string from a list of per-frame index
 * arrays. Used by the mint flow.
 */
export function framesToPixels(frames: PixelGridFrame[]): string {
  let out = "";
  for (const frame of frames) {
    for (const index of frame.indices) {
      out += indexToChar(index);
    }
  }
  return out;
}

/**
 * Hash source string used by the contract for `mint_pixel_grid`'s
 * `content_hash`. Mirrors `pixel_grid_hash_source` in the reference
 * contract — keep these in sync.
 */
export function pixelGridHashSource(spec: PixelGridSpec): string {
  return (
    PIXELGRID_SCHEMA +
    ":" +
    spec.paletteId +
    ":" +
    String(spec.width) +
    ":" +
    String(spec.height) +
    ":" +
    String(spec.frameCount) +
    ":" +
    String(spec.frameDelayMs) +
    ":" +
    spec.pixels
  );
}

export async function pixelGridContentHash(spec: PixelGridSpec): Promise<string> {
  return sha256Hex(pixelGridHashSource(spec));
}

export function isPixelGridMime(mime: string | null | undefined): boolean {
  return mime === PIXELGRID_MIME;
}

export function isPixelGridEncoding(encoding: string | null | undefined): boolean {
  return encoding === PIXELGRID_ENCODING;
}

/* ───────── Palette loading (cached per RPC epoch) ───────── */

const paletteCache = new Map<string, Promise<ResolvedPalette | null>>();
subscribeRpcEpoch(() => paletteCache.clear());

function cacheKey(contract: string, paletteId: string) {
  return `${contract}::${paletteId}`;
}

export function fetchPalette(
  contract: string,
  paletteId: string
): Promise<ResolvedPalette | null> {
  const key = cacheKey(contract, paletteId);
  const cached = paletteCache.get(key);
  if (cached) return cached;
  const promise = (async (): Promise<ResolvedPalette | null> => {
    const info = await getPaletteInfo(contract, paletteId);
    if (!info) return null;
    const colors = await Promise.all(
      Array.from({ length: info.size }, (_, i) => getPaletteColor(contract, paletteId, i))
    );
    return { info, colors };
  })();
  paletteCache.set(key, promise);
  promise.catch(() => paletteCache.delete(key));
  return promise;
}

/**
 * Normalise a palette color into a CSS-compatible value. Accepts the
 * contract's `#rgb`, `#rrggbb`, `#rrggbbaa`, or the literal "transparent".
 */
export function paletteColorToCss(color: string): string {
  if (!color) return "transparent";
  if (color === "transparent") return "transparent";
  return color;
}
