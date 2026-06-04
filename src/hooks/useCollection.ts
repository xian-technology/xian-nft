import { useCallback, useEffect, useMemo, useState } from "react";
import { getContractMetadata, type ContractMetadata } from "../lib/nft";
import {
  listAllTokenIds,
  loadTokensByIds,
  type TokenWithListing
} from "../lib/tokens";
import { subscribeRpcEpoch } from "../lib/xian";
import { COLLECTION_PAGE_SIZE } from "../lib/constants";

export interface UseCollectionResult {
  metadata: ContractMetadata | null;
  tokens: TokenWithListing[];
  /** Total ids discovered in the collection. May exceed `tokens.length`. */
  totalIds: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Lazy-paged collection loader.
 *
 * Phase 1: cheap one-shot Transfer-event scan for token IDs (no metadata).
 * Phase 2: load full metadata+listing only for the visible window of IDs.
 *
 * Loading every token up-front fired N × ~19 RPC reads per collection;
 * for any collection past a few dozen tokens that became a thundering
 * herd. With paging, the cost scales with what the user actually sees.
 */
export function useCollection(contract: string | undefined): UseCollectionResult {
  const [metadata, setMetadata] = useState<ContractMetadata | null>(null);
  const [allIds, setAllIds] = useState<string[]>([]);
  const [tokens, setTokens] = useState<TokenWithListing[]>([]);
  const [visibleCount, setVisibleCount] = useState(COLLECTION_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contract) {
      setMetadata(null);
      setAllIds([]);
      setTokens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [m, ids] = await Promise.all([
        getContractMetadata(contract),
        listAllTokenIds(contract)
      ]);
      setMetadata(m);
      setAllIds(ids);
      setVisibleCount(COLLECTION_PAGE_SIZE);
      const firstWindow = await loadTokensByIds(contract, ids.slice(0, COLLECTION_PAGE_SIZE));
      setTokens(firstWindow);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collection");
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    void refresh();
    const unsub = subscribeRpcEpoch(() => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  const loadedIds = useMemo(() => new Set(tokens.map((t) => t.metadata.tokenId)), [tokens]);
  const hasMore = visibleCount < allIds.length;

  const loadMore = useCallback(() => {
    if (!contract || loadingMore || !hasMore) return;
    const nextCount = Math.min(visibleCount + COLLECTION_PAGE_SIZE, allIds.length);
    const pending = allIds.slice(visibleCount, nextCount).filter((id) => !loadedIds.has(id));
    if (pending.length === 0) {
      setVisibleCount(nextCount);
      return;
    }
    setLoadingMore(true);
    setError(null);
    void loadTokensByIds(contract, pending)
      .then((more) => {
        setTokens((prev) => [...prev, ...more]);
        setVisibleCount(nextCount);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load more tokens");
      })
      .finally(() => setLoadingMore(false));
  }, [contract, allIds, visibleCount, loadingMore, hasMore, loadedIds]);

  return {
    metadata,
    tokens,
    totalIds: allIds.length,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    refresh
  };
}
