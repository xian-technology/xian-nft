import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { probeIndexer } from "../lib/rpc";
import { subscribeRpcEpoch } from "../lib/xian";

/**
 * Renders a thin banner across the top of the app when the configured
 * RPC node doesn't expose the indexer endpoints PixelSnek depends on
 * (discovery, activity feed, profile lookups). Without indexer support
 * we degrade gracefully — but tell the user why parts of the UI are empty
 * instead of leaving them to guess.
 *
 * Re-probes once per RPC epoch (whenever the user switches RPC URLs).
 */
export function IndexerStatusBanner() {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      void probeIndexer().then((ok) => {
        if (!cancelled) setAvailable(ok);
      });
    }
    refresh();
    const unsub = subscribeRpcEpoch(refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (available !== false) return null;

  return (
    <div className="bg-warning/10 border-b border-warning/30 text-warning-content/90 px-4 py-2 text-sm flex items-center gap-2 justify-center">
      <AlertTriangle size={14} />
      <span>
        Indexer not available on the current RPC node — discovery, activity, and profile views are
        limited. Configure an indexed node in <code className="font-mono">pixelsnek.rpc</code>.
      </span>
    </div>
  );
}
