/**
 * Token discovery for a given collection contract.
 *
 * XSC-0005 doesn't enumerate tokens on-chain. We use the indexer's
 * `Transfer` events to discover token IDs that have ever existed, then
 * filter to those still owned (owner != "").
 */

import { listEventsPaged } from "./rpc";
import { ownerOf, getTokenMetadata, getListingInfo, type TokenMetadata, type ListingInfo } from "./nft";
import { INDEXER_EVENT_MAX_ITEMS } from "./constants";

export interface DiscoveredToken {
  contract: string;
  tokenId: string;
  owner: string;
}

export interface TokenWithListing {
  metadata: TokenMetadata;
  listing: ListingInfo | null;
}

/**
 * Pull all unique token IDs ever transferred in/out of a collection.
 * Returns the most-recent transfer state per id.
 */
export async function listAllTokenIds(contract: string, limit = INDEXER_EVENT_MAX_ITEMS): Promise<string[]> {
  try {
    const events = await listEventsPaged(contract, "Transfer", { maxItems: limit });
    const ids = new Set<string>();
    for (const evt of events) {
      const data = evt.data;
      if (data && typeof data.token_id === "string") {
        ids.add(data.token_id);
      }
    }
    return [...ids];
  } catch {
    return [];
  }
}

/**
 * Discover all currently-minted tokens in a collection.
 * Filters out burned tokens (owner == "").
 */
export async function discoverTokens(contract: string): Promise<DiscoveredToken[]> {
  const ids = await listAllTokenIds(contract);
  const results = await Promise.all(
    ids.map(async (tokenId) => {
      try {
        const owner = await ownerOf(contract, tokenId);
        return owner ? { contract, tokenId, owner } : null;
      } catch {
        return null;
      }
    })
  );
  return results.filter((t): t is DiscoveredToken => t != null);
}

export async function loadTokensWithListings(
  contract: string
): Promise<TokenWithListing[]> {
  const discovered = await discoverTokens(contract);
  const results = await Promise.all(
    discovered.map(async ({ tokenId }) => {
      const [metadata, listing] = await Promise.all([
        getTokenMetadata(contract, tokenId).catch(() => null),
        getListingInfo(contract, tokenId).catch(() => null)
      ]);
      if (!metadata) return null;
      return { metadata, listing };
    })
  );
  return results.filter((t): t is TokenWithListing => t != null);
}

/**
 * List tokens owned by a specific address across one collection.
 */
export async function loadOwnedTokens(
  contract: string,
  owner: string
): Promise<TokenWithListing[]> {
  const tokens = await loadTokensWithListings(contract);
  return tokens.filter((t) => t.metadata.owner === owner);
}

/**
 * Tokens currently listed for sale in a collection.
 */
export async function loadListedTokens(contract: string): Promise<TokenWithListing[]> {
  const tokens = await loadTokensWithListings(contract);
  return tokens.filter((t) => t.listing != null && !!t.listing.seller);
}
