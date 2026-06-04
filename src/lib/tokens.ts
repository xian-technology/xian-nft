/**
 * Token discovery & paged loading for a given XSC-0005 collection.
 *
 * XSC-0005 doesn't enumerate tokens on-chain. We use the indexer's
 * `Transfer` events to discover token IDs that have ever existed, then
 * load metadata + listing for the slice the UI actually shows. Loading
 * everything up-front fans out N × ~19 RPC reads per collection — fine
 * for tiny demos, ruinous at any real scale.
 */

import { listEventsPaged, listEvents } from "./rpc";
import { ownerOf, getTokenMetadata, getListingInfo, type TokenMetadata, type ListingInfo } from "./nft";
import { INDEXER_EVENT_MAX_ITEMS } from "./constants";
import { isSameAddress } from "./format";

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
 * Cheap (one paged Transfer-event scan); does NOT load metadata.
 */
export async function listAllTokenIds(
  contract: string,
  limit = INDEXER_EVENT_MAX_ITEMS
): Promise<string[]> {
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
 * Live (non-burned) token IDs only. Filters by `owner != ""`.
 * Still cheap relative to full metadata load — one `owners[id]` read per id.
 */
export async function listLiveTokenIds(contract: string): Promise<string[]> {
  const ids = await listAllTokenIds(contract);
  const owners = await Promise.all(
    ids.map((id) => ownerOf(contract, id).catch(() => ""))
  );
  return ids.filter((_, i) => owners[i] !== "");
}

/** @deprecated Kept for compatibility with old callers; emits the same shape. */
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

/**
 * Load full metadata + listing for an explicit slice of token IDs.
 * Use this when the caller already knows which IDs are in-view.
 */
export async function loadTokensByIds(
  contract: string,
  tokenIds: string[]
): Promise<TokenWithListing[]> {
  const results = await Promise.all(
    tokenIds.map(async (tokenId) => {
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
 * @deprecated High fan-out. Prefer `listAllTokenIds` + `loadTokensByIds`
 * driven by the visible page slice. Retained for compatibility with
 * existing flows we haven't migrated yet.
 */
export async function loadTokensWithListings(
  contract: string
): Promise<TokenWithListing[]> {
  const ids = await listLiveTokenIds(contract);
  return loadTokensByIds(contract, ids);
}

export async function loadOwnedTokens(
  contract: string,
  owner: string
): Promise<TokenWithListing[]> {
  const tokens = await loadTokensWithListings(contract);
  return tokens.filter((t) => isSameAddress(t.metadata.owner, owner));
}

export async function loadListedTokens(contract: string): Promise<TokenWithListing[]> {
  const tokens = await loadTokensWithListings(contract);
  return tokens.filter((t) => t.listing != null && !!t.listing.seller);
}

/**
 * Indexer-driven discovery of tokens involving an account, scoped to one
 * collection. Aggregates Transfer events with `to == account` (owned now
 * or in past) and falls back to an empty list if the indexer is offline.
 *
 * Far cheaper than scanning every token in the collection. Returns
 * unique token IDs sorted by most-recent transfer first.
 */
export async function listTokenIdsTouchingAccount(
  contract: string,
  account: string,
  limit = INDEXER_EVENT_MAX_ITEMS
): Promise<string[]> {
  if (!account) return [];
  try {
    const events = await listEventsPaged(contract, "Transfer", { maxItems: limit });
    const ids: string[] = [];
    const seen = new Set<string>();
    // Walk most-recent-first using block_height when present, else insertion order.
    const sorted = [...events].sort(
      (a, b) => (b.block_height ?? 0) - (a.block_height ?? 0)
    );
    for (const evt of sorted) {
      const data = evt.data;
      if (!data || typeof data.token_id !== "string") continue;
      if (!isSameAddress(data.to, account) && !isSameAddress(data.from, account)) continue;
      const id = data.token_id;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

/**
 * Recently-listed tokens across a collection, sorted by block height.
 * Used by the Home page "hot listings" feed. Falls back to empty if
 * the indexer is offline.
 */
export async function listRecentListings(
  contract: string,
  limit = 50
): Promise<string[]> {
  try {
    const events = await listEvents(contract, "TokenListed", limit);
    const ids: string[] = [];
    const seen = new Set<string>();
    const sorted = [...events].sort(
      (a, b) => (b.block_height ?? 0) - (a.block_height ?? 0)
    );
    for (const evt of sorted) {
      const data = evt.data;
      if (!data || typeof data.token_id !== "string") continue;
      const id = data.token_id;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}
