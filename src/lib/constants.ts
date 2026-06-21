/**
 * Project-wide constants and identifiers for PixelSnek.
 */

export const DEFAULT_RPC =
  import.meta.env.VITE_XIAN_RPC_URL?.trim() || "http://127.0.0.1:26657";

/** XSC-0005 interface-checker contract. Used to verify if any contract is a valid NFT collection. */
export const XSC005_CHECKER = "con_xsc005";

/** Reference XSC-0005 collection implementation contract name (when deployed). */
export const XSC005_REFERENCE = "con_xsc005_nft";

/** Native currency used as the default marketplace payment token. */
export const NATIVE_CURRENCY = "currency";

/** Standard marker we filter on when scanning recent events. */
export const STANDARD_MARKER = "XSC-0005";

/** XSC-0005 PixelGrid render-schema identifier (matches contract source). */
export const PIXELGRID_SCHEMA = "xian.pixelgrid.v1";
/** XSC-0005 PixelGrid MIME type. */
export const PIXELGRID_MIME = "application/x.xian.pixelgrid";
/** XSC-0005 PixelGrid encoding name. */
export const PIXELGRID_ENCODING = "palette-index-64";
/** XSC-0005 PixelGrid palette alphabet (each char encodes one palette index). */
export const PIXEL_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
/** Maximum on-chain token-id length (matches contract). */
export const MAX_TOKEN_ID_LENGTH = 128;
/** Maximum on-chain prove-ownership proof length (matches contract). */
export const MAX_PROOF_LENGTH = 512;

/** Max basis points (10000 = 100%). */
export const BPS_MAX = 10000;
/** Soft cap for royalty UI to keep things reasonable. */
export const ROYALTY_BPS_MAX = 5000;

/** Page sizes & paging defaults */
export const COLLECTION_PAGE_SIZE = 24;
export const ACTIVITY_PAGE_SIZE = 50;
export const INDEXER_EVENT_PAGE_SIZE = 200;
export const INDEXER_EVENT_MAX_ITEMS = 2_000;

/** Reference XSC-0005 media storage limits. */
export const MAX_INLINE_CONTENT_LENGTH = 8_192;
export const MAX_CONTENT_CHUNK_LENGTH = 8_192;
export const MAX_CONTENT_CHUNK_COUNT = 64;

export const STORAGE_KEYS = {
  rpc: "pixelsnek.rpc",
  customCollections: "pixelsnek.customCollections",
  watchedCollections: "pixelsnek.watchedCollections",
  recentTxs: "pixelsnek.recentTxs",
  chunkedMintProgress: "pixelsnek.chunkedMintProgress",
  theme: "pixelsnek.theme",
  paymentToken: "pixelsnek.paymentToken"
} as const;

/**
 * Known XSC-0005 collections seeded into discovery. The UI will also
 * append discovered collections to localStorage on first encounter.
 */
export const KNOWN_COLLECTIONS: string[] = [
  XSC005_REFERENCE
];
