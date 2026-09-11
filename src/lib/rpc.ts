/** Raw content reads and SDK-backed indexed event reads for the marketplace. */

import type { XianIndexedEvent } from "@xian-tech/client";
import { getClient, getRpcUrl } from "./xian";
import { INDEXER_EVENT_MAX_ITEMS, INDEXER_EVENT_PAGE_SIZE } from "./constants";

export interface IndexedEvent {
  contract?: string;
  event?: string;
  data?: Record<string, unknown>;
  tx_hash?: string;
  block_height?: number;
  created_at?: string;
  id?: number;
}

interface RecentEventsResult {
  available: boolean;
  items: IndexedEvent[];
  limit: number;
  offset: number;
}

const EMPTY_ABCI = "AA==";

function b64ToString(b64: string): string {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  return "";
}

async function abciRawValue(path: string): Promise<string | null> {
  const url = `${getRpcUrl().replace(/\/+$/, "")}/abci_query?path=%22${encodeURIComponent(path)}%22`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      result?: { response?: { value?: string; code?: number } };
    };
    const response = json.result?.response;
    if (!response || (response.code != null && response.code !== 0)) return null;
    const value = response.value;
    if (value == null || value === EMPTY_ABCI || value === "") return null;
    return b64ToString(value);
  } catch {
    return null;
  }
}

function decodedStateString(value: string): string {
  try {
    const decoded = JSON.parse(value);
    if (typeof decoded === "string") return decoded;
    if (decoded == null) return "";
    return String(decoded);
  } catch {
    return value;
  }
}

/**
 * Read a state value as a string without XianClient's numeric normalization.
 * This is required for content fields: PixelGrid data can be digit-only and
 * may start with zero, so normalizing through number/bigint corrupts it.
 */
export async function getStateString(
  contract: string,
  variable: string,
  keys: string[] = []
): Promise<string | null> {
  const suffix = keys.length > 0 ? `:${keys.join(":")}` : "";
  const value = await abciRawValue(`/get/${contract}.${variable}${suffix}`);
  return value == null ? null : decodedStateString(value);
}

function marketplaceEvent(item: XianIndexedEvent): IndexedEvent {
  return {
    contract: item.contract ?? undefined,
    event: item.event ?? undefined,
    data: { ...item.dataIndexed, ...item.data },
    tx_hash: item.txHash ?? undefined,
    block_height: item.blockHeight == null ? undefined : Number(item.blockHeight),
    created_at: item.createdAt ?? undefined,
    id: item.id ?? undefined
  };
}

/**
 * List indexed events for a (contract, event) pair. Returns [] if the
 * indexer doesn't have this index available.
 */
export async function listEvents(
  contract: string,
  event: string,
  limit = 100,
  offset = 0
): Promise<IndexedEvent[]> {
  try {
    return (await getClient().listEvents(contract, event, { limit, offset })).map(marketplaceEvent);
  } catch {
    return [];
  }
}

export async function listEventsPaged(
  contract: string,
  event: string,
  options: { pageSize?: number; maxItems?: number } = {}
): Promise<IndexedEvent[]> {
  const pageSize = Math.max(
    1,
    Math.min(options.pageSize ?? INDEXER_EVENT_PAGE_SIZE, INDEXER_EVENT_MAX_ITEMS)
  );
  const maxItems = Math.max(pageSize, options.maxItems ?? INDEXER_EVENT_MAX_ITEMS);
  const events: IndexedEvent[] = [];

  for (let offset = 0; offset < maxItems; offset += pageSize) {
    const remaining = maxItems - events.length;
    const batch = await listEvents(contract, event, Math.min(pageSize, remaining), offset);
    events.push(...batch);
    if (batch.length < pageSize || events.length >= maxItems) break;
  }

  return events;
}

/**
 * Fetch the most-recent indexed events across all contracts.
 */
export async function getRecentEvents(
  limit = 100,
  offset = 0
): Promise<RecentEventsResult> {
  try {
    const result = await getClient().getRecentEvents({ limit, offset });
    return { ...result, items: result.items.map(marketplaceEvent) };
  } catch {
    return { available: false, items: [], limit, offset };
  }
}

/**
 * Cheap one-shot probe of the indexer's `/recent_events` endpoint.
 * Returns true when the node exposes the indexer surface we depend on
 * (discovery, activity feed, profile lookups). Used by the global
 * IndexerStatusBanner to tell users why parts of the UI are degraded.
 */
export async function probeIndexer(): Promise<boolean> {
  const result = await getRecentEvents(1);
  return result.available;
}
