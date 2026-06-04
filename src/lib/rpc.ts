/**
 * Lightweight wrappers around the Xian indexer ABCI query endpoints that
 * aren't exposed by the published @xian-tech/client v0.1.6 yet.
 *
 * All of these hit `/abci_query?path=<...>` and return the decoded JSON
 * payload. They gracefully degrade to `null` if the indexer is unavailable
 * so the marketplace stays usable on plain (non-indexed) nodes.
 */

import { getRpcUrl } from "./xian";
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

async function abciQuery(path: string): Promise<unknown> {
  const decoded = await abciRawValue(path);
  if (decoded == null) return null;
  try {
    return JSON.parse(decoded);
  } catch {
    return decoded;
  }
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

function asEvents(value: unknown): IndexedEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is IndexedEvent => item != null && typeof item === "object");
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
  const result = await abciQuery(
    `/events/${contract}/${event}/offset=${offset}/limit=${limit}`
  );
  return asEvents(result);
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
  const value = await abciQuery(`/recent_events/limit=${limit}/offset=${offset}`);
  if (value == null) return { available: false, items: [], limit, offset };
  if (Array.isArray(value)) {
    return { available: true, items: asEvents(value), limit, offset };
  }
  const payload = value as Record<string, unknown>;
  return {
    available: payload.available !== false,
    items: asEvents(payload.items),
    limit: Number(payload.limit ?? limit),
    offset: Number(payload.offset ?? offset)
  };
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
