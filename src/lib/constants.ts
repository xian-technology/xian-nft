/**
 * Project-wide constants and identifiers for PixelSnek.
 */

export const DEFAULT_RPC = "https://node.xian.org";
export const FALLBACK_RPC = "http://127.0.0.1:26657";

/** XSC-0004 interface-checker contract. Used to verify if any contract is a valid NFT collection. */
export const XSC004_CHECKER = "con_xsc004";

/** Reference XSC-0004 collection implementation contract name (when deployed). */
export const XSC004_REFERENCE = "con_xsc004_nft";

/** Native currency used as the default marketplace payment token. */
export const NATIVE_CURRENCY = "currency";

/** Standard marker we filter on when scanning recent events. */
export const STANDARD_MARKER = "XSC-0004";

/** Max basis points (10000 = 100%). */
export const BPS_MAX = 10000;
/** Soft cap for royalty UI to keep things reasonable. */
export const ROYALTY_BPS_MAX = 5000;

/** Page sizes & paging defaults */
export const COLLECTION_PAGE_SIZE = 24;
export const ACTIVITY_PAGE_SIZE = 50;

export const STORAGE_KEYS = {
  rpc: "pixelsnek.rpc",
  customCollections: "pixelsnek.customCollections",
  watchedCollections: "pixelsnek.watchedCollections",
  recentTxs: "pixelsnek.recentTxs",
  theme: "pixelsnek.theme",
  paymentToken: "pixelsnek.paymentToken"
} as const;

/**
 * Known XSC-0004 collections seeded into discovery. The UI will also
 * append discovered collections to localStorage on first encounter.
 */
export const KNOWN_COLLECTIONS: string[] = [
  XSC004_REFERENCE
];
