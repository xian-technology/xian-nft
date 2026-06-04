/**
 * On-chain content integrity check.
 *
 * XSC-0005 stores a `content_hash` alongside token media. We can recompute it
 * client-side and compare, giving collectors a trust signal that what they're
 * looking at is exactly what the creator committed — and flagging tampering.
 *
 * The hash domain differs by token type:
 *   - PixelGrid: sha256 over the domain-separated render source
 *     (see `pixelGridHashSource`), NOT the raw pixel string.
 *   - everything else (inline + chunked): sha256 over the content bytes.
 */

import { sha256Hex } from "./hash";
import { pixelGridHashSource } from "./pixelgrid";
import { PIXELGRID_SCHEMA } from "./constants";
import type { TokenMetadata } from "./nft";

export type ContentVerification = "verified" | "mismatch" | "unverifiable";

export async function verifyTokenContent(token: TokenMetadata): Promise<ContentVerification> {
  if (!token.contentHash || !token.content) return "unverifiable";

  let expected: string;
  if (token.renderSchema === PIXELGRID_SCHEMA) {
    expected = await sha256Hex(
      pixelGridHashSource({
        paletteId: token.paletteId,
        width: token.width,
        height: token.height,
        frameCount: token.frameCount,
        frameDelayMs: token.frameDelayMs,
        pixels: token.content
      })
    );
  } else {
    expected = await sha256Hex(token.content);
  }

  return expected === token.contentHash ? "verified" : "mismatch";
}
