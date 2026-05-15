import { useCallback, useEffect, useState } from "react";
import { getContractMetadata, type ContractMetadata } from "../lib/nft";
import { loadTokensWithListings, type TokenWithListing } from "../lib/tokens";
import { subscribeRpcEpoch } from "../lib/xian";

export interface UseCollectionResult {
  metadata: ContractMetadata | null;
  tokens: TokenWithListing[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCollection(contract: string | undefined): UseCollectionResult {
  const [metadata, setMetadata] = useState<ContractMetadata | null>(null);
  const [tokens, setTokens] = useState<TokenWithListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contract) {
      setMetadata(null);
      setTokens([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [m, ts] = await Promise.all([
        getContractMetadata(contract),
        loadTokensWithListings(contract)
      ]);
      setMetadata(m);
      setTokens(ts);
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

  return { metadata, tokens, loading, error, refresh };
}
