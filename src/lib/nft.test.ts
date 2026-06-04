import { beforeEach, describe, expect, it, vi } from "vitest";

const sendCall = vi.hoisted(() =>
  vi.fn(async () => ({ submitted: true, accepted: true, finalized: true }))
);

vi.mock("./wallet", () => ({
  sendCall,
  assertSendCallSucceeded: vi.fn()
}));

vi.mock("./xian", () => ({
  getClient: vi.fn(),
  subscribeRpcEpoch: vi.fn(() => () => undefined)
}));

import {
  approveAndBuy,
  changeMetadata,
  changeOperator,
  createPalette,
  listForSale,
  lockPalette,
  mint,
  mintChunked,
  mintPixelGrid,
  setApprovalForAll,
  setPaletteColor
} from "./nft";

describe("NFT transaction helpers", () => {
  beforeEach(() => {
    sendCall.mockClear();
  });

  it("builds mint calls with contract field names", async () => {
    await mint({
      contract: "con_art",
      tokenId: "1",
      to: "alice",
      name: "Genesis"
    });

    expect(sendCall).toHaveBeenCalledWith({
      contract: "con_art",
      function: "mint",
      kwargs: {
        token_id: "1",
        to: "alice",
        name: "Genesis",
        description: "",
        mime_type: "application/json",
        encoding: "utf8",
        content: "",
        content_hash: "",
        uri: "",
        royalty_receiver: "",
        royalty_bps: 0
      }
    });
  });

  it("builds chunked mint calls", async () => {
    await mintChunked({
      contract: "con_art",
      tokenId: "2",
      to: "alice",
      name: "Large",
      description: "big",
      mimeType: "image/png",
      encoding: "base64",
      contentHash: "hash",
      chunkCount: 3
    });

    expect(sendCall).toHaveBeenCalledWith({
      contract: "con_art",
      function: "mint_chunked",
      kwargs: {
        token_id: "2",
        to: "alice",
        name: "Large",
        description: "big",
        mime_type: "image/png",
        encoding: "base64",
        content_hash: "hash",
        chunk_count: 3,
        uri: "",
        royalty_receiver: "",
        royalty_bps: 0
      }
    });
  });

  it("forwards listing prices as decimal strings", async () => {
    await listForSale({
      contract: "con_art",
      tokenId: "1",
      currencyContract: "currency",
      price: "12.500000000000000001"
    });

    expect(sendCall).toHaveBeenCalledWith({
      contract: "con_art",
      function: "list_for_sale",
      kwargs: {
        token_id: "1",
        currency_contract: "currency",
        price: "12.500000000000000001",
        reserved_for: ""
      }
    });
  });

  it("approveAndBuy passes the exact decimal string to the currency approve", async () => {
    await approveAndBuy({
      contract: "con_art",
      tokenId: "1",
      currencyContract: "currency",
      price: "20.000000000000000001"
    });

    expect(sendCall).toHaveBeenNthCalledWith(1, {
      contract: "currency",
      function: "approve",
      kwargs: { amount: "20.000000000000000001", to: "con_art" }
    });
    expect(sendCall).toHaveBeenNthCalledWith(2, {
      contract: "con_art",
      function: "buy",
      kwargs: { token_id: "1" }
    });
  });

  it("builds mint_pixel_grid calls", async () => {
    await mintPixelGrid({
      contract: "con_art",
      tokenId: "grid-1",
      to: "alice",
      name: "Neon Grid",
      paletteId: "neon",
      width: 4,
      height: 2,
      frameCount: 2,
      frameDelayMs: 120,
      pixels: "0123012301230123",
      royaltyBps: 500
    });

    expect(sendCall).toHaveBeenCalledWith({
      contract: "con_art",
      function: "mint_pixel_grid",
      kwargs: {
        token_id: "grid-1",
        to: "alice",
        name: "Neon Grid",
        palette_id: "neon",
        width: 4,
        height: 2,
        frame_count: 2,
        frame_delay_ms: 120,
        pixels: "0123012301230123",
        description: "",
        royalty_receiver: "",
        royalty_bps: 500
      }
    });
  });

  it("builds palette administration calls", async () => {
    await createPalette({
      contract: "con_art",
      paletteId: "p",
      colors: ["#000000", "#ffffff"],
      locked: true
    });
    expect(sendCall).toHaveBeenLastCalledWith({
      contract: "con_art",
      function: "create_palette",
      kwargs: { palette_id: "p", colors: ["#000000", "#ffffff"], name: "", locked: true }
    });

    await setPaletteColor({ contract: "con_art", paletteId: "p", index: 0, color: "#ff0000" });
    expect(sendCall).toHaveBeenLastCalledWith({
      contract: "con_art",
      function: "set_palette_color",
      kwargs: { palette_id: "p", index: 0, color: "#ff0000" }
    });

    await lockPalette("con_art", "p");
    expect(sendCall).toHaveBeenLastCalledWith({
      contract: "con_art",
      function: "lock_palette",
      kwargs: { palette_id: "p" }
    });
  });

  it("builds collection admin calls", async () => {
    await changeMetadata("con_art", "collection_name", "Pixel Frames");
    expect(sendCall).toHaveBeenLastCalledWith({
      contract: "con_art",
      function: "change_metadata",
      kwargs: { key: "collection_name", value: "Pixel Frames" }
    });

    await changeOperator("con_art", "bob");
    expect(sendCall).toHaveBeenLastCalledWith({
      contract: "con_art",
      function: "change_operator",
      kwargs: { new_operator: "bob" }
    });
  });

  it("builds set_approval_for_all calls", async () => {
    await setApprovalForAll("con_art", "bob", true);
    expect(sendCall).toHaveBeenLastCalledWith({
      contract: "con_art",
      function: "set_approval_for_all",
      kwargs: { operator: "bob", approved: true }
    });
  });
});
