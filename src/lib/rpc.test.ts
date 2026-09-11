import { afterEach, describe, expect, it, vi } from "vitest";
import { XianClient } from "@xian-tech/client";

vi.mock("./xian", () => ({
  getClient: () => new XianClient({ rpcUrl: "http://127.0.0.1:26657" }),
  getRpcUrl: () => "http://127.0.0.1:26657"
}));

import { getRecentEvents, listEvents, probeIndexer } from "./rpc";
import { listAllTokenIds, listTokenIdsTouchingAccount } from "./tokens";

function serve(value: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    result: { response: {
      code: 0,
      value: value == null ? "AA==" : btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    } }
  }))));
}

afterEach(() => vi.unstubAllGlobals());

describe("live indexer wire format", () => {
  it("discovers collection and account tokens from JSON-text indexed fields", async () => {
    serve([
      { id: 3, contract: "con_nft", event: "Transfer", block_height: 12,
        data: "{}", data_indexed: '{"token_id":"visible-live","from":"","to":"alice"}' },
      { id: 2, contract: "con_nft", event: "Transfer", block_height: 10,
        data: "{}", data_indexed: '{"token_id":"old","from":"alice","to":"bob"}' },
      { id: 1, contract: "con_nft", event: "Transfer", block_height: 9,
        data: "{}", data_indexed: '{"token_id":"old","from":"","to":"alice"}' }
    ]);
    expect(await listAllTokenIds("con_nft")).toEqual(["visible-live", "old"]);
    expect(await listTokenIdsTouchingAccount("con_nft", "alice")).toEqual(["visible-live", "old"]);
    expect(await listTokenIdsTouchingAccount("con_nft", "charlie")).toEqual([]);
  });

  it("joins indexed identifiers with exact decimal activity data and preserves metadata", async () => {
    const row = { id: 4, contract: "con_nft", event: "TokenListed", block_height: 13,
      tx_hash: "hash", created_at: "2026-09-11T01:50:05+00:00",
      data_indexed: '{"token_id":"visible-live","seller":"alice"}',
      data: '{"price":"12.500000000000000001","currency_contract":"currency"}' };
    serve([row]);
    const [event] = await listEvents("con_nft", "TokenListed");
    expect(event).toEqual({ id: 4, contract: "con_nft", event: "TokenListed", block_height: 13,
      tx_hash: "hash", created_at: row.created_at,
      data: { token_id: "visible-live", seller: "alice", price: "12.500000000000000001", currency_contract: "currency" } });
    serve({ available: true, items: [row], limit: 10, offset: 0 });
    expect(await getRecentEvents(10)).toEqual({ available: true, items: [event], limit: 10, offset: 0 });
  });

  it("distinguishes an empty index from an unavailable index", async () => {
    serve([]);
    expect(await probeIndexer()).toBe(true);
    serve(null);
    expect(await probeIndexer()).toBe(false);
    serve({ available: false, items: [] });
    expect(await probeIndexer()).toBe(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await listEvents("con_nft", "Transfer")).toEqual([]);
    expect(await probeIndexer()).toBe(false);
  });
});
