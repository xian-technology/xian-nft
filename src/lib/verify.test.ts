import { describe, expect, it } from "vitest";

import { verifyTokenContent } from "./verify";
import { sha256Hex } from "./hash";
import { pixelGridHashSource } from "./pixelgrid";
import { PIXELGRID_MIME } from "./constants";
import type { TokenMetadata } from "./nft";

function baseToken(overrides: Partial<TokenMetadata> = {}): TokenMetadata {
  return {
    contract: "con_art",
    tokenId: "t1",
    owner: "alice",
    creator: "alice",
    createdAt: null,
    name: "T1",
    description: "",
    mimeType: "image/svg+xml",
    encoding: "utf8",
    uri: "",
    content: "",
    contentHash: "",
    chunkCount: 0,
    contentLocked: true,
    royaltyReceiver: "",
    royaltyBps: 0,
    likes: 0,
    proof: "",
    renderSchema: "",
    paletteId: "",
    width: 0,
    height: 0,
    frameCount: 0,
    frameDelayMs: 0,
    pixelEncoding: "",
    ...overrides
  };
}

describe("verifyTokenContent", () => {
  it("returns 'unverifiable' when there is no content or no hash", async () => {
    await expect(verifyTokenContent(baseToken())).resolves.toBe("unverifiable");
    await expect(verifyTokenContent(baseToken({ content: "<svg/>" }))).resolves.toBe(
      "unverifiable"
    );
    await expect(
      verifyTokenContent(baseToken({ contentHash: "a".repeat(64) }))
    ).resolves.toBe("unverifiable");
  });

  it("verifies inline content against sha256(content)", async () => {
    const content = "<svg><rect/></svg>";
    const contentHash = await sha256Hex(content);
    await expect(verifyTokenContent(baseToken({ content, contentHash }))).resolves.toBe(
      "verified"
    );
    await expect(
      verifyTokenContent(baseToken({ content, contentHash: "b".repeat(64) }))
    ).resolves.toBe("mismatch");
  });

  it("verifies pixel-grid content against the domain-separated hash source", async () => {
    const pixels = "0123012301230123";
    const spec = {
      paletteId: "neon",
      width: 4,
      height: 2,
      frameCount: 2,
      frameDelayMs: 120,
      pixels
    };
    const contentHash = await sha256Hex(pixelGridHashSource(spec));
    const token = baseToken({
      mimeType: PIXELGRID_MIME,
      encoding: "palette-index-64",
      content: pixels,
      contentHash,
      renderSchema: "xian.pixelgrid.v1",
      paletteId: "neon",
      width: 4,
      height: 2,
      frameCount: 2,
      frameDelayMs: 120
    });
    await expect(verifyTokenContent(token)).resolves.toBe("verified");

    // A raw-content hash (wrong domain) must NOT verify for a pixel grid.
    const wrong = baseToken({ ...token, contentHash: await sha256Hex(pixels) });
    await expect(verifyTokenContent(wrong)).resolves.toBe("mismatch");
  });
});
