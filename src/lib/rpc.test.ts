import { afterEach, describe, expect, it, vi } from "vitest";
import { XianClient } from "@xian-tech/client";

const getRpcEpoch = vi.hoisted(() => vi.fn(() => 0));

vi.mock("./xian", () => ({
  getClient: () => new XianClient({ rpcUrl: "http://127.0.0.1:26657" }),
  getRpcUrl: () => "http://127.0.0.1:26657",
  getRpcEpoch,
  subscribeRpcEpoch: () => () => undefined
}));

import { loadActivity } from "./activity";
import { verifyXSC005 } from "./collections";
import { getRecentEvents, listEvents, probeIndexer } from "./rpc";
import { listAllTokenIds, listTokenIdsTouchingAccount } from "./tokens";

function abciResponse(value: unknown) {
  return new Response(JSON.stringify({
    result: { response: {
      code: 0,
      value: value == null ? "AA==" : btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    } }
  }));
}

function serve(value: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => abciResponse(value)));
}

afterEach(() => {
  vi.unstubAllGlobals();
  getRpcEpoch.mockReturnValue(0);
});

describe("live indexer wire format", () => {
  it("honors a discovery limit below a single event page", async () => {
    serve([
      { id: 2, contract: "con_nft", event: "Transfer", data: { token_id: "second" } },
      { id: 1, contract: "con_nft", event: "Transfer", data: { token_id: "first" } }
    ]);
    expect(await listAllTokenIds("con_nft", 0)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    serve([{ id: 2, contract: "con_nft", event: "Transfer", data: { token_id: "second" } }]);
    expect(await listAllTokenIds("con_nft", 1)).toEqual(["second"]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("limit%3D1"), expect.anything());
  });

  it("verifies a collection after a transient checker failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await verifyXSC005("con_example")).toBe(false);
    serve({ status: 0, result: true });
    expect(await verifyXSC005("con_example")).toBe(true);
  });

  it("discards verification from an RPC that was replaced while the check ran", async () => {
    serve({ status: 0, result: true });
    const previousCheck = verifyXSC005("con_on_previous_chain");
    getRpcEpoch.mockReturnValue(1);
    expect(await previousCheck).toBe(false);
    serve({ status: 0, result: false });
    expect(await verifyXSC005("con_on_previous_chain")).toBe(false);
  });

  it.each([true, false])("keeps sale and transfer rows distinct (indexed IDs: %s)", async (indexedIds) => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const path = new URL(input).searchParams.get("path") ?? "";
      const row = {
        contract: "con_xsc005_nft", tx_hash: "same-transaction", block_height: 42
      };
      if (path.includes("/Transfer/")) {
        return abciResponse([{ ...row, id: indexedIds ? 10 : undefined, event: "Transfer",
          data: { token_id: "token", from: "seller", to: "buyer" } }]);
      }
      if (path.includes("/TokenSale/")) {
        return abciResponse([{ ...row, id: indexedIds ? 11 : undefined, event: "TokenSale",
          data: { token_id: "token", seller: "seller", buyer: "buyer", price: "1" } }]);
      }
      return abciResponse([]);
    }));
    const items = await loadActivity();
    expect(items.map(({ kind }) => kind).sort()).toEqual(["sale", "transfer"]);
    expect(new Set(items.map(({ id }) => id)).size).toBe(2);
  });

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
