import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertSendCallSucceeded,
  connect,
  sendCall,
  sendCallFailureMessage
} from "./wallet";
import type { XianProvider } from "@xian-tech/provider";

function installWallet(request: XianProvider["request"]) {
  const provider: XianProvider = {
    request,
    on: vi.fn(),
    removeListener: vi.fn()
  };
  vi.stubGlobal("window", {
    xian: { provider },
    xianProviders: []
  });
  return provider;
}

describe("wallet bridge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("connects through the injected provider", async () => {
    const request = vi.fn(async () => ["a".repeat(64)]);
    installWallet(request);

    await expect(connect()).resolves.toEqual(["a".repeat(64)]);
  });

  it("sends calls with NFT wait defaults", async () => {
    const request = vi.fn(async () => ({ txHash: "NFT123", accepted: true }));
    installWallet(request);

    await sendCall({
      contract: "con_nft",
      function: "mint",
      kwargs: { token_id: "1" }
    });

    expect(request).toHaveBeenCalledWith({
      method: "xian_sendCall",
      params: [
        {
          intent: {
            contract: "con_nft",
            function: "mint",
            kwargs: { token_id: "1" }
          },
          mode: undefined,
          waitForTx: true,
          timeoutMs: 60_000,
          pollIntervalMs: undefined
        }
      ]
    });
  });

  it("surfaces failed transaction results", () => {
    const failed = {
      submitted: true,
      accepted: true,
      finalized: true,
      receipt: { success: false, message: "not owner" }
    };

    expect(sendCallFailureMessage(failed)).toBe("not owner");
    expect(() => assertSendCallSucceeded(failed)).toThrow("not owner");
  });
});
