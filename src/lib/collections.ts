/**
 * Collection discovery & caching.
 *
 * XSC-0004 has no global registry, so we maintain a few sources:
 *   1. Seed list (KNOWN_COLLECTIONS)
 *   2. User-added collections in localStorage
 *   3. Auto-discovery: scan recent events for contracts that pass the
 *      is_XSC004 checker and remember them locally.
 */

import { getRecentEvents } from "./rpc";
import { getContractMetadata, isXSC004, type ContractMetadata } from "./nft";
import { KNOWN_COLLECTIONS, STORAGE_KEYS } from "./constants";

const isXSC004Cache = new Map<string, boolean>();

export function listSeedCollections(): string[] {
  return [...KNOWN_COLLECTIONS];
}

export function listCustomCollections(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customCollections);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addCustomCollection(contract: string): void {
  if (!contract || typeof localStorage === "undefined") return;
  const current = new Set([...listCustomCollections()]);
  if (current.has(contract)) return;
  current.add(contract);
  localStorage.setItem(STORAGE_KEYS.customCollections, JSON.stringify([...current]));
}

export function removeCustomCollection(contract: string): void {
  if (!contract || typeof localStorage === "undefined") return;
  const remaining = listCustomCollections().filter((c) => c !== contract);
  localStorage.setItem(STORAGE_KEYS.customCollections, JSON.stringify(remaining));
}

export function listAllKnownContracts(): string[] {
  const set = new Set<string>();
  for (const c of listSeedCollections()) set.add(c);
  for (const c of listCustomCollections()) set.add(c);
  return [...set];
}

export async function verifyXSC004(contract: string): Promise<boolean> {
  if (isXSC004Cache.has(contract)) return isXSC004Cache.get(contract)!;
  const ok = await isXSC004(contract);
  isXSC004Cache.set(contract, ok);
  return ok;
}

export async function loadCollections(): Promise<ContractMetadata[]> {
  const contracts = listAllKnownContracts();
  const results = await Promise.all(
    contracts.map(async (c) => {
      const ok = await verifyXSC004(c).catch(() => false);
      if (!ok) return null;
      return getContractMetadata(c).catch(() => null);
    })
  );
  return results.filter((m): m is ContractMetadata => m != null);
}

/**
 * Discover new XSC-0004 collections by scanning recent indexed events.
 * The Xian indexer exposes `/recent_events` with an `available` flag —
 * if the indexer isn't running we silently return the seed list.
 */
export async function discoverCollections(limit = 200): Promise<string[]> {
  try {
    const result = await getRecentEvents(limit);
    if (!result.available) return [];
    const candidates = new Set<string>();
    for (const evt of result.items) {
      if (evt.contract) candidates.add(evt.contract);
    }
    const validated: string[] = [];
    for (const candidate of candidates) {
      if (await verifyXSC004(candidate)) {
        validated.push(candidate);
        addCustomCollection(candidate);
      }
    }
    return validated;
  } catch {
    return [];
  }
}
