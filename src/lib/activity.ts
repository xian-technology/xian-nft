/**
 * Marketplace activity feed — aggregates Transfer, TokenListed, TokenSale,
 * TokenLiked events across known collections.
 */

import { listEvents } from "./rpc";
import { discoverCollections, listAllKnownContracts } from "./collections";
import { toDecimalString } from "./decimal";
import { toNumber } from "./format";

export type ActivityKind = "mint" | "transfer" | "burn" | "list" | "sale" | "like";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  contract: string;
  tokenId: string;
  from?: string;
  to?: string;
  seller?: string;
  buyer?: string;
  /** Raw chain decimal string. Never `Number()` this — see lib/decimal.ts. */
  price?: string;
  currencyContract?: string;
  account?: string;
  likes?: number;
  txHash?: string;
  blockHeight?: number;
  timestamp?: string;
}

type EventData = Record<string, unknown> & {
  contract?: string;
  event?: string;
  data?: Record<string, unknown>;
  tx_hash?: string;
  block_height?: number;
  created_at?: string;
};

function classify(event: string, data: Record<string, unknown>): ActivityKind {
  switch (event) {
    case "Transfer": {
      const from = (data.from ?? "") as string;
      const to = (data.to ?? "") as string;
      if (!from) return "mint";
      if (!to) return "burn";
      return "transfer";
    }
    case "TokenListed":
      return "list";
    case "TokenSale":
      return "sale";
    case "TokenLiked":
      return "like";
    default:
      return "transfer";
  }
}

function normalize(evt: EventData, idx: number): ActivityItem | null {
  if (!evt.contract || !evt.event) return null;
  const data = evt.data ?? {};
  const tokenId = (data.token_id ?? "") as string;
  if (!tokenId) return null;
  const kind = classify(evt.event, data);
  return {
    id: `${evt.tx_hash ?? "no-tx"}-${evt.contract}-${tokenId}-${idx}`,
    kind,
    contract: evt.contract,
    tokenId,
    from: (data.from as string) ?? undefined,
    to: (data.to as string) ?? undefined,
    seller: (data.seller as string) ?? undefined,
    buyer: (data.buyer as string) ?? undefined,
    price: data.price != null ? toDecimalString(data.price) : undefined,
    currencyContract: (data.currency_contract as string) ?? undefined,
    account: (data.account as string) ?? undefined,
    likes: data.likes != null ? toNumber(data.likes) : undefined,
    txHash: evt.tx_hash,
    blockHeight: evt.block_height,
    timestamp: evt.created_at
  };
}

const EVENT_NAMES = ["Transfer", "TokenListed", "TokenSale", "TokenLiked"] as const;

export async function loadActivity(limit = 100): Promise<ActivityItem[]> {
  await discoverCollections().catch(() => []);
  const contracts = listAllKnownContracts();
  const all: ActivityItem[] = [];

  await Promise.all(
    contracts.flatMap((contract) =>
      EVENT_NAMES.map(async (event) => {
        try {
          const events = await listEvents(contract, event, limit);
          events.forEach((evt, idx) => {
            const norm = normalize(evt as EventData, idx);
            if (norm) all.push(norm);
          });
        } catch {
          /* indexer may not have this event yet */
        }
      })
    )
  );

  // Sort by block height (or array order) — most recent first.
  all.sort((a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0));
  return all.slice(0, limit);
}

export async function loadCollectionActivity(
  contract: string,
  limit = 60
): Promise<ActivityItem[]> {
  const all: ActivityItem[] = [];

  await Promise.all(
    EVENT_NAMES.map(async (event) => {
      try {
        const events = await listEvents(contract, event, limit);
        events.forEach((evt, idx) => {
          const norm = normalize(evt as EventData, idx);
          if (norm) all.push(norm);
        });
      } catch {
        /* noop */
      }
    })
  );

  all.sort((a, b) => (b.blockHeight ?? 0) - (a.blockHeight ?? 0));
  return all.slice(0, limit);
}
