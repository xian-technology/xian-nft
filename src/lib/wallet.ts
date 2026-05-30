import {
  assertSendCallSucceeded,
  connectWallet,
  getAccounts,
  getWalletInfo,
  isWalletAvailable,
  onAccountsChanged,
  onChainChanged,
  sendCall as sendProviderCall,
  sendCallFailureMessage,
  type CallIntent,
  type SendCallOptions,
  type SendCallResult,
  type WalletInfo
} from "@xian-tech/web-kit";

export {
  assertSendCallSucceeded,
  connectWallet as connect,
  getAccounts,
  getWalletInfo,
  isWalletAvailable,
  onAccountsChanged,
  onChainChanged,
  sendCallFailureMessage
};
export type { CallIntent, SendCallResult, WalletInfo };

export function sendCall(
  intent: CallIntent,
  options?: SendCallOptions
): Promise<SendCallResult> {
  return sendProviderCall(intent, {
    timeoutMs: 60_000,
    ...options
  });
}
