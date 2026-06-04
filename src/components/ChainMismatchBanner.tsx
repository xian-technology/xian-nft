import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getClient, subscribeRpcEpoch } from "../lib/xian";
import { useWallet } from "../hooks/useWallet";

/**
 * Warns when the connected wallet is on a different network than the node the
 * site reads from.
 *
 * The app reads chain state through `pixelsnek.rpc`, but the wallet *broadcasts*
 * to whatever network it's configured for — those are independent. When they
 * diverge you "mint, but nothing ever shows up," because you wrote to one chain
 * and the site is reading another. This banner makes that failure mode obvious
 * instead of silent.
 *
 * Only renders when a wallet is connected and both chain ids are known and
 * differ — so it never false-alarms while things are still loading.
 */
export function ChainMismatchBanner() {
  const wallet = useWallet();
  const [nodeChainId, setNodeChainId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      // A fresh client is created per RPC epoch, so getChainId re-reads
      // /genesis after an RPC switch rather than serving a stale cache.
      getClient()
        .getChainId()
        .then((id) => {
          if (!cancelled) setNodeChainId(id);
        })
        .catch(() => {
          if (!cancelled) setNodeChainId(null);
        });
    }
    refresh();
    const unsub = subscribeRpcEpoch(refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const walletChainId = wallet.chainId;
  if (!wallet.account || !walletChainId || !nodeChainId) return null;
  if (walletChainId === nodeChainId) return null;

  return (
    <div className="bg-error/10 border-b border-error/30 text-error-content/90 px-4 py-2 text-sm flex items-center gap-2 justify-center text-center">
      <AlertTriangle size={14} className="shrink-0" />
      <span>
        Your wallet is on <strong className="font-mono">{walletChainId}</strong> but this site is
        reading <strong className="font-mono">{nodeChainId}</strong>. Transactions you submit
        won't appear here until both use the same network.
      </span>
    </div>
  );
}
