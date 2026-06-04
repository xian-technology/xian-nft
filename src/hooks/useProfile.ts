import { useCallback, useEffect, useState } from "react";
import {
  listTokenIdsTouchingAccount,
  loadTokensByIds,
  loadTokensWithListings,
  type TokenWithListing
} from "../lib/tokens";
import type { ContractMetadata } from "../lib/nft";
import { subscribeRpcEpoch } from "../lib/xian";

export interface ScopedToken {
  token: TokenWithListing;
  collection: ContractMetadata;
}

export interface UseProfileResult {
  tokens: ScopedToken[] | null;
  loading: boolean;
  /** True when we fell back to scanning every collection because the indexer was offline. */
  fellBack: boolean;
  refresh: () => Promise<void>;
}

/**
 * Profile loader.
 *
 * Primary path: use the indexer to list token IDs in each known collection
 * where the account was on either side of a Transfer event — this is cheap
 * and only loads metadata for tokens the user has actually touched.
 *
 * Fallback path: if the indexer returns nothing for a collection, scan the
 * full collection. We surface that via `fellBack` so the UI can warn the
 * user (the fallback is O(N) per collection and may be slow on real chains).
 */
export function useProfile(
  account: string | null | undefined,
  collections: ContractMetadata[]
): UseProfileResult {
  const [tokens, setTokens] = useState<ScopedToken[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fellBack, setFellBack] = useState(false);

  const refresh = useCallback(async () => {
    if (!account || collections.length === 0) {
      setTokens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFellBack(false);
    try {
      const out: ScopedToken[] = [];
      let fallback = false;
      for (const collection of collections) {
        try {
          let ids = await listTokenIdsTouchingAccount(collection.contract, account);
          if (ids.length === 0) {
            // Indexer returned nothing — either truly none, or no indexer
            // for this collection. Do a full scan as a fallback and flag it.
            const list = await loadTokensWithListings(collection.contract);
            if (list.length > 0) fallback = true;
            for (const t of list) {
              const meta = t.metadata;
              if (
                meta.owner === account ||
                meta.creator === account ||
                t.listing?.seller === account
              ) {
                out.push({ token: t, collection });
              }
            }
            continue;
          }
          const loaded = await loadTokensByIds(collection.contract, ids);
          for (const t of loaded) {
            const meta = t.metadata;
            if (
              meta.owner === account ||
              meta.creator === account ||
              t.listing?.seller === account
            ) {
              out.push({ token: t, collection });
            }
          }
        } catch {
          /* skip on error */
        }
      }
      setTokens(out);
      setFellBack(fallback);
    } finally {
      setLoading(false);
    }
  }, [account, collections]);

  useEffect(() => {
    void refresh();
    const unsub = subscribeRpcEpoch(() => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  return { tokens, loading, fellBack, refresh };
}
