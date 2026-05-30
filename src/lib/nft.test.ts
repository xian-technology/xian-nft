import { beforeEach, describe, expect, it, vi } from "vitest";

const sendCall = vi.hoisted(() =>
  vi.fn(async () => ({ submitted: true, accepted: true, finalized: true }))
);

vi.mock("./wallet", () => ({
  sendCall,
  assertSendCallSucceeded: vi.fn()
}));

vi.mock("./xian", () => ({
  getClient: vi.fn()
}));

import { approveAndBuy, listForSale, mint, mintChunked } from "./nft";

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

  it("builds listing calls", async () => {
    await listForSale({
      contract: "con_art",
      tokenId: "1",
      currencyContract: "currency",
      price: 12.5
    });

    expect(sendCall).toHaveBeenCalledWith({
      contract: "con_art",
      function: "list_for_sale",
      kwargs: {
        token_id: "1",
        currency_contract: "currency",
        price: 12.5,
        reserved_for: ""
      }
    });
  });

  it("approves currency before buying", async () => {
    await approveAndBuy({
      contract: "con_art",
      tokenId: "1",
      currencyContract: "currency",
      price: 20
    });

    expect(sendCall).toHaveBeenNthCalledWith(1, {
      contract: "currency",
      function: "approve",
      kwargs: { amount: 20, to: "con_art" }
    });
    expect(sendCall).toHaveBeenNthCalledWith(2, {
      contract: "con_art",
      function: "buy",
      kwargs: { token_id: "1" }
    });
  });
});
