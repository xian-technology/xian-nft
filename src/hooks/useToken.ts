import { useCallback, useEffect, useState } from "react";
import {
  getContractMetadata,
  getListingInfo,
  getTokenMetadata,
  hasLikedToken,
  type ContractMetadata,
  type ListingInfo,
  type TokenMetadata
} from "../lib/nft";
import { subscribeRpcEpoch } from "../lib/xian";

export interface UseTokenResult {
  collection: ContractMetadata | null;
  token: TokenMetadata | null;
  listing: ListingInfo | null;
  liked: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useToken(
  contract: string | undefined,
  tokenId: string | undefined,
  account: string | null
): UseTokenResult {
  const [collection, setCollection] = useState<ContractMetadata | null>(null);
  const [token, setToken] = useState<TokenMetadata | null>(null);
  const [listing, setListing] = useState<ListingInfo | null>(null);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!contract || !tokenId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [c, t, l, lk] = await Promise.all([
        getContractMetadata(contract),
        getTokenMetadata(contract, tokenId),
        getListingInfo(contract, tokenId),
        account ? hasLikedToken(contract, tokenId, account) : Promise.resolve(false)
      ]);
      setCollection(c);
      setToken(t);
      setListing(l);
      setLiked(lk);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load token");
    } finally {
      setLoading(false);
    }
  }, [contract, tokenId, account]);

  useEffect(() => {
    void refresh();
    const unsub = subscribeRpcEpoch(() => {
      void refresh();
    });
    return unsub;
  }, [refresh]);

  return { collection, token, listing, liked, loading, error, refresh };
}
