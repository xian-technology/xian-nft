/**
 * XSC-0005 contract bindings.
 *
 * Read methods use the RPC client directly (no wallet needed).
 * Write methods route through the injected wallet.
 */

import { getClient } from "./xian";
import { assertSendCallSucceeded, sendCall, type CallIntent, type SendCallResult } from "./wallet";
import { toNumber, maybeDate } from "./format";
import { toDecimalString } from "./decimal";
import { NATIVE_CURRENCY, STANDARD_MARKER, XSC005_CHECKER } from "./constants";
import { getStateString } from "./rpc";

export interface ContractMetadata {
  contract: string;
  standard: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  website: string;
  operator: string;
  tokenCount: number;
}

export interface TokenMetadata {
  contract: string;
  tokenId: string;
  owner: string;
  creator: string;
  createdAt: Date | null;
  name: string;
  description: string;
  mimeType: string;
  encoding: string;
  uri: string;
  content: string;
  contentHash: string;
  chunkCount: number;
  contentLocked: boolean;
  royaltyReceiver: string;
  royaltyBps: number;
  likes: number;
  proof: string;
  /** XSC-0005 PixelGrid extension fields (empty / 0 for non-pixel-grid tokens). */
  renderSchema: string;
  paletteId: string;
  width: number;
  height: number;
  frameCount: number;
  frameDelayMs: number;
  pixelEncoding: string;
}

export interface ListingInfo {
  seller: string;
  currencyContract: string;
  /**
   * Raw chain decimal string. Always pass through string-decimal helpers
   * (`lib/decimal`) — never `Number()` it. The XSC-0005 contract stores
   * prices as arbitrary-precision `decimal`; converting through `Number`
   * loses precision and can mis-approve a buy.
   */
  price: string;
  reservedFor: string;
}

export interface PaletteInfo {
  paletteId: string;
  name: string;
  size: number;
  locked: boolean;
  creator: string;
  createdAt: Date | null;
}

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  return String(value);
}

function asBool(value: unknown): boolean {
  if (value === true || value === "True" || value === "true") return true;
  return false;
}

async function sendNftCall(intent: CallIntent): Promise<SendCallResult> {
  const result = await sendCall(intent);
  assertSendCallSucceeded(result);
  return result;
}

/* ────────────────────── Reads ────────────────────── */

export async function isXSC005(contract: string): Promise<boolean> {
  if (!contract) return false;
  try {
    const result = await getClient().call({
      sender: "0".repeat(64),
      contract: XSC005_CHECKER,
      function: "is_XSC005",
      kwargs: { contract }
    });
    return result === true;
  } catch {
    return false;
  }
}

export async function getContractMetadata(contract: string): Promise<ContractMetadata | null> {
  if (!contract) return null;
  const client = getClient();
  const [standard, name, symbol, description, image, website, operator, tokenCount] = await Promise.all([
    client.getState(contract, "metadata", ["standard"]),
    client.getState(contract, "metadata", ["collection_name"]),
    client.getState(contract, "metadata", ["collection_symbol"]),
    client.getState(contract, "metadata", ["collection_description"]),
    client.getState(contract, "metadata", ["collection_image"]),
    client.getState(contract, "metadata", ["collection_website"]),
    client.getState(contract, "metadata", ["operator"]),
    client.getState(contract, "token_count")
  ]);

  if (asString(standard) !== STANDARD_MARKER) return null;

  return {
    contract,
    standard: asString(standard),
    name: asString(name, contract),
    symbol: asString(symbol),
    description: asString(description),
    image: asString(image),
    website: asString(website),
    operator: asString(operator),
    tokenCount: toNumber(tokenCount)
  };
}

export async function ownerOf(contract: string, tokenId: string): Promise<string> {
  const v = await getClient().getState(contract, "owners", [tokenId]);
  return asString(v);
}

export async function balanceOf(contract: string, owner: string): Promise<number> {
  const v = await getClient().getState(contract, "balances", [owner]);
  return toNumber(v);
}

/**
 * Whether a token_id has ever been minted in a collection.
 *
 * Mirrors the contract's `require_unminted_token` (which checks the `minted`
 * hash, not `owners`) so the check stays correct for burned ids — a burned
 * token has `owner == ""` but `minted == true` and can't be re-minted.
 */
export async function isTokenMinted(contract: string, tokenId: string): Promise<boolean> {
  const v = await getClient().getState(contract, "minted", [tokenId]);
  return asBool(v);
}

/**
 * Balance of a payment/currency token for an account, as a precise decimal
 * string. XSC-001-style tokens expose a `balances` hash; we never funnel this
 * through `Number` so high-precision balances compare correctly against prices.
 */
export async function getCurrencyBalance(
  currencyContract: string,
  account: string
): Promise<string> {
  if (!currencyContract || !account) return "0";
  const v = await getClient().getState(currencyContract, "balances", [account]);
  return toDecimalString(v);
}

export async function tokenCount(contract: string): Promise<number> {
  const v = await getClient().getState(contract, "token_count");
  return toNumber(v);
}

export async function getTokenMetadata(
  contract: string,
  tokenId: string
): Promise<TokenMetadata | null> {
  const client = getClient();
  const fields = [
    "name",
    "description",
    "mime_type",
    "encoding",
    "uri",
    "content",
    "creator",
    "created",
    "content_hash",
    "chunk_count",
    "content_locked",
    "royalty_receiver",
    "royalty_bps",
    "likes",
    "proof",
    "render_schema",
    "palette_id",
    "width",
    "height",
    "frame_count",
    "frame_delay_ms",
    "pixel_encoding"
  ] as const;

  const owner = await ownerOf(contract, tokenId);
  if (!owner) return null;

  const results = await Promise.all(
    fields.map((f) => client.getState(contract, "token_data", [tokenId, f]).catch(() => null))
  );
  const map: Record<string, unknown> = {};
  fields.forEach((f, i) => {
    map[f] = results[i];
  });

  const chunkCountValue = toNumber(map.chunk_count);
  let content =
    (await getStateString(contract, "token_data", [tokenId, "content"]).catch(() => null)) ??
    asString(map.content);
  if (!content && chunkCountValue > 0) {
    content = await getAllContentChunks(contract, tokenId, chunkCountValue).catch(() => "");
  }

  return {
    contract,
    tokenId,
    owner,
    creator: asString(map.creator),
    createdAt: maybeDate(map.created),
    name: asString(map.name, tokenId),
    description: asString(map.description),
    mimeType: asString(map.mime_type, "application/octet-stream"),
    encoding: asString(map.encoding, "utf8"),
    uri: asString(map.uri),
    content,
    contentHash: asString(map.content_hash),
    chunkCount: chunkCountValue,
    contentLocked: asBool(map.content_locked),
    royaltyReceiver: asString(map.royalty_receiver),
    royaltyBps: toNumber(map.royalty_bps),
    likes: toNumber(map.likes),
    proof: asString(map.proof),
    renderSchema: asString(map.render_schema),
    paletteId: asString(map.palette_id),
    width: toNumber(map.width),
    height: toNumber(map.height),
    frameCount: toNumber(map.frame_count),
    frameDelayMs: toNumber(map.frame_delay_ms),
    pixelEncoding: asString(map.pixel_encoding)
  };
}

export async function getListingInfo(
  contract: string,
  tokenId: string
): Promise<ListingInfo | null> {
  const client = getClient();
  const [seller, currencyContract, price, reservedFor] = await Promise.all([
    client.getState(contract, "listings", [tokenId, "seller"]),
    client.getState(contract, "listings", [tokenId, "currency_contract"]),
    client.getState(contract, "listings", [tokenId, "price"]),
    client.getState(contract, "listings", [tokenId, "reserved_for"])
  ]);
  const sellerStr = asString(seller);
  if (!sellerStr) return null;
  return {
    seller: sellerStr,
    currencyContract: asString(currencyContract),
    price: toDecimalString(price),
    reservedFor: asString(reservedFor)
  };
}

export async function getContentChunk(
  contract: string,
  tokenId: string,
  index: number
): Promise<string> {
  const raw = await getStateString(contract, "content_chunks", [tokenId, String(index)]).catch(
    () => null
  );
  if (raw != null) return raw;
  const v = await getClient().getState(contract, "content_chunks", [tokenId, String(index)]);
  return asString(v);
}

export async function getAllContentChunks(
  contract: string,
  tokenId: string,
  chunkCount: number
): Promise<string> {
  if (chunkCount <= 0) return "";
  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, i) => getContentChunk(contract, tokenId, i))
  );
  return chunks.join("");
}

export async function isApprovedForAll(
  contract: string,
  owner: string,
  operator: string
): Promise<boolean> {
  if (!owner || !operator) return false;
  const v = await getClient().getState(contract, "operator_approvals", [owner, operator]);
  return asBool(v);
}

export async function getApproved(contract: string, tokenId: string): Promise<string> {
  const v = await getClient().getState(contract, "approvals", [tokenId]);
  return asString(v);
}

export async function hasLikedToken(
  contract: string,
  tokenId: string,
  account: string
): Promise<boolean> {
  if (!account) return false;
  const v = await getClient().getState(contract, "likes", [tokenId, account]);
  return asBool(v);
}

/* ────────────────────── Writes ────────────────────── */

export async function mint(args: {
  contract: string;
  tokenId: string;
  to: string;
  name: string;
  description?: string;
  mimeType?: string;
  encoding?: string;
  content?: string;
  contentHash?: string;
  uri?: string;
  royaltyReceiver?: string;
  royaltyBps?: number;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "mint",
    kwargs: {
      token_id: args.tokenId,
      to: args.to,
      name: args.name,
      description: args.description ?? "",
      mime_type: args.mimeType ?? "application/json",
      encoding: args.encoding ?? "utf8",
      content: args.content ?? "",
      content_hash: args.contentHash ?? "",
      uri: args.uri ?? "",
      royalty_receiver: args.royaltyReceiver ?? "",
      royalty_bps: args.royaltyBps ?? 0
    }
  });
}

export async function mintChunked(args: {
  contract: string;
  tokenId: string;
  to: string;
  name: string;
  description: string;
  mimeType: string;
  encoding: string;
  contentHash: string;
  chunkCount: number;
  uri?: string;
  royaltyReceiver?: string;
  royaltyBps?: number;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "mint_chunked",
    kwargs: {
      token_id: args.tokenId,
      to: args.to,
      name: args.name,
      description: args.description,
      mime_type: args.mimeType,
      encoding: args.encoding,
      content_hash: args.contentHash,
      chunk_count: args.chunkCount,
      uri: args.uri ?? "",
      royalty_receiver: args.royaltyReceiver ?? "",
      royalty_bps: args.royaltyBps ?? 0
    }
  });
}

export async function setContentChunk(args: {
  contract: string;
  tokenId: string;
  chunkIndex: number;
  content: string;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "set_content_chunk",
    kwargs: {
      token_id: args.tokenId,
      chunk_index: args.chunkIndex,
      content: args.content
    }
  });
}

export async function lockContent(contract: string, tokenId: string) {
  return sendNftCall({
    contract,
    function: "lock_content",
    kwargs: { token_id: tokenId }
  });
}

export async function transfer(contract: string, tokenId: string, to: string) {
  return sendNftCall({
    contract,
    function: "transfer",
    kwargs: { token_id: tokenId, to }
  });
}

export async function approve(contract: string, tokenId: string, to: string) {
  return sendNftCall({
    contract,
    function: "approve",
    kwargs: { token_id: tokenId, to }
  });
}

export async function revokeApproval(contract: string, tokenId: string) {
  return sendNftCall({
    contract,
    function: "revoke",
    kwargs: { token_id: tokenId }
  });
}

export async function setApprovalForAll(
  contract: string,
  operator: string,
  approved: boolean
) {
  return sendNftCall({
    contract,
    function: "set_approval_for_all",
    kwargs: { operator, approved }
  });
}

export async function transferFrom(args: {
  contract: string;
  tokenId: string;
  to: string;
  mainAccount: string;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "transfer_from",
    kwargs: {
      token_id: args.tokenId,
      to: args.to,
      main_account: args.mainAccount
    }
  });
}

export async function listForSale(args: {
  contract: string;
  tokenId: string;
  /** Decimal string. Will be sent through as-is so chain precision is preserved. */
  price: string;
  reservedFor?: string;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "list_for_sale",
    kwargs: {
      token_id: args.tokenId,
      currency_contract: NATIVE_CURRENCY,
      price: toDecimalString(args.price),
      reserved_for: args.reservedFor ?? ""
    }
  });
}

export async function cancelListing(contract: string, tokenId: string) {
  return sendNftCall({
    contract,
    function: "cancel_listing",
    kwargs: { token_id: tokenId }
  });
}

/**
 * Approve the NFT collection contract to spend buyer's currency tokens.
 * Required before calling buy() since the collection pulls funds via transfer_from.
 *
 * The amount must be a decimal string (not `number`) so chain precision is
 * preserved — funnelling it through JS `Number` can round a listing price
 * down and cause the subsequent `buy` to revert from insufficient allowance.
 */
export async function approveCurrency(args: {
  currencyContract: string;
  spender: string;
  amount: string;
}) {
  return sendNftCall({
    contract: args.currencyContract,
    function: "approve",
    kwargs: { amount: toDecimalString(args.amount), to: args.spender }
  });
}

export async function buy(contract: string, tokenId: string) {
  return sendNftCall({
    contract,
    function: "buy",
    kwargs: { token_id: tokenId }
  });
}

export async function burn(contract: string, tokenId: string) {
  return sendNftCall({
    contract,
    function: "burn",
    kwargs: { token_id: tokenId }
  });
}

export async function likeToken(contract: string, tokenId: string) {
  return sendNftCall({
    contract,
    function: "like",
    kwargs: { token_id: tokenId }
  });
}

export async function proveOwnership(contract: string, tokenId: string, proof: string) {
  return sendNftCall({
    contract,
    function: "prove_ownership",
    kwargs: { token_id: tokenId, proof }
  });
}

/** Convenience: approve + buy in sequence. Price is a decimal string. */
export async function approveAndBuy(args: {
  contract: string;
  tokenId: string;
  currencyContract: string;
  price: string;
}) {
  await approveCurrency({
    currencyContract: args.currencyContract,
    spender: args.contract,
    amount: args.price
  });
  return buy(args.contract, args.tokenId);
}

/* ────────────────────── Collection admin (operator only) ─────────────── */

export async function changeMetadata(
  contract: string,
  key: string,
  value: string
) {
  return sendNftCall({
    contract,
    function: "change_metadata",
    kwargs: { key, value }
  });
}

export async function changeOperator(contract: string, newOperator: string) {
  return sendNftCall({
    contract,
    function: "change_operator",
    kwargs: { new_operator: newOperator }
  });
}

export async function setTokenField(args: {
  contract: string;
  tokenId: string;
  key: string;
  value: unknown;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "set_token_field",
    kwargs: { token_id: args.tokenId, key: args.key, value: args.value }
  });
}

/* ────────────────────── PixelGrid extension ──────────────────────────── */

export async function createPalette(args: {
  contract: string;
  paletteId: string;
  colors: string[];
  name?: string;
  locked?: boolean;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "create_palette",
    kwargs: {
      palette_id: args.paletteId,
      colors: args.colors,
      name: args.name ?? "",
      locked: args.locked ?? true
    }
  });
}

export async function setPaletteColor(args: {
  contract: string;
  paletteId: string;
  index: number;
  color: string;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "set_palette_color",
    kwargs: { palette_id: args.paletteId, index: args.index, color: args.color }
  });
}

export async function lockPalette(contract: string, paletteId: string) {
  return sendNftCall({
    contract,
    function: "lock_palette",
    kwargs: { palette_id: paletteId }
  });
}

export async function mintPixelGrid(args: {
  contract: string;
  tokenId: string;
  to: string;
  name: string;
  paletteId: string;
  width: number;
  height: number;
  frameCount: number;
  frameDelayMs: number;
  pixels: string;
  description?: string;
  royaltyReceiver?: string;
  royaltyBps?: number;
}) {
  return sendNftCall({
    contract: args.contract,
    function: "mint_pixel_grid",
    kwargs: {
      token_id: args.tokenId,
      to: args.to,
      name: args.name,
      palette_id: args.paletteId,
      width: args.width,
      height: args.height,
      frame_count: args.frameCount,
      frame_delay_ms: args.frameDelayMs,
      pixels: args.pixels,
      description: args.description ?? "",
      royalty_receiver: args.royaltyReceiver ?? "",
      royalty_bps: args.royaltyBps ?? 0
    }
  });
}

export async function getPaletteInfo(
  contract: string,
  paletteId: string
): Promise<PaletteInfo | null> {
  const client = getClient();
  try {
    const [size, name, locked, creator, created] = await Promise.all([
      client.getState(contract, "palettes", [paletteId, "size"]),
      client.getState(contract, "palettes", [paletteId, "name"]),
      client.getState(contract, "palettes", [paletteId, "locked"]),
      client.getState(contract, "palettes", [paletteId, "creator"]),
      client.getState(contract, "palettes", [paletteId, "created"])
    ]);
    const sizeNum = toNumber(size);
    if (!sizeNum) return null;
    return {
      paletteId,
      size: sizeNum,
      name: asString(name),
      locked: asBool(locked),
      creator: asString(creator),
      createdAt: maybeDate(created)
    };
  } catch {
    return null;
  }
}

export async function getPaletteColor(
  contract: string,
  paletteId: string,
  index: number
): Promise<string> {
  const v = await getClient().getState(contract, "palettes", [paletteId, String(index)]);
  return asString(v);
}

export async function getPaletteColors(
  contract: string,
  paletteId: string,
  size: number
): Promise<string[]> {
  if (size <= 0) return [];
  return Promise.all(
    Array.from({ length: size }, (_, i) => getPaletteColor(contract, paletteId, i))
  );
}
