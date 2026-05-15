import { useCallback, useEffect, useState } from "react";
import { discoverCollections, loadCollections } from "../lib/collections";
import type { ContractMetadata } from "../lib/nft";
import { subscribeRpcEpoch } from "../lib/xian";

export interface UseCollectionsResult {
  collections: ContractMetadata[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCollections(): UseCollectionsResult {
  const [collections, setCollections] = useState<ContractMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Discover first so newly-encountered collections show up.
      await discoverCollections().catch(() => []);
      const list = await loadCollections();
      setCollections(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsub = subscribeRpcEpoch(() => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  return { collections, loading, error, refresh };
}
