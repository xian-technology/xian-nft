/**
 * XSC-0004 contract bindings.
 *
 * Read methods use the RPC client directly (no wallet needed).
 * Write methods route through the injected wallet.
 */

import { getClient } from "./xian";
import { sendCall } from "./wallet";
import { toNumber, maybeDate } from "./format";
import { STANDARD_MARKER, XSC004_CHECKER } from "./constants";

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
}

export interface ListingInfo {
  seller: string;
  currencyContract: string;
  price: number;
  reservedFor: string;
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

/* ────────────────────── Reads ────────────────────── */

export async function isXSC004(contract: string): Promise<boolean> {
  if (!contract) return false;
  try {
    const result = await getClient().call({
      sender: "0".repeat(64),
      contract: XSC004_CHECKER,
      function: "is_XSC004",
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
    "proof"
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
    content: asString(map.content),
    contentHash: asString(map.content_hash),
    chunkCount: toNumber(map.chunk_count),
    contentLocked: asBool(map.content_locked),
    royaltyReceiver: asString(map.royalty_receiver),
    royaltyBps: toNumber(map.royalty_bps),
    likes: toNumber(map.likes),
    proof: asString(map.proof)
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
    price: toNumber(price),
    reservedFor: asString(reservedFor)
  };
}

export async function getContentChunk(
  contract: string,
  tokenId: string,
  index: number
): Promise<string> {
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
  return sendCall({
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
  return sendCall({
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
  return sendCall({
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
  return sendCall({
    contract,
    function: "lock_content",
    kwargs: { token_id: tokenId }
  });
}

export async function transfer(contract: string, tokenId: string, to: string) {
  return sendCall({
    contract,
    function: "transfer",
    kwargs: { token_id: tokenId, to }
  });
}

export async function approve(contract: string, tokenId: string, to: string) {
  return sendCall({
    contract,
    function: "approve",
    kwargs: { token_id: tokenId, to }
  });
}

export async function revokeApproval(contract: string, tokenId: string) {
  return sendCall({
    contract,
    function: "revoke",
    kwargs: { token_id: tokenId }
  });
}

export async function listForSale(args: {
  contract: string;
  tokenId: string;
  currencyContract: string;
  price: number;
  reservedFor?: string;
}) {
  return sendCall({
    contract: args.contract,
    function: "list_for_sale",
    kwargs: {
      token_id: args.tokenId,
      currency_contract: args.currencyContract,
      price: args.price,
      reserved_for: args.reservedFor ?? ""
    }
  });
}

export async function cancelListing(contract: string, tokenId: string) {
  return sendCall({
    contract,
    function: "cancel_listing",
    kwargs: { token_id: tokenId }
  });
}

/**
 * Approve the NFT collection contract to spend buyer's currency tokens.
 * Required before calling buy() since the collection pulls funds via transfer_from.
 */
export async function approveCurrency(args: {
  currencyContract: string;
  spender: string;
  amount: number;
}) {
  return sendCall({
    contract: args.currencyContract,
    function: "approve",
    kwargs: { amount: args.amount, to: args.spender }
  });
}

export async function buy(contract: string, tokenId: string) {
  return sendCall({
    contract,
    function: "buy",
    kwargs: { token_id: tokenId }
  });
}

export async function burn(contract: string, tokenId: string) {
  return sendCall({
    contract,
    function: "burn",
    kwargs: { token_id: tokenId }
  });
}

export async function likeToken(contract: string, tokenId: string) {
  return sendCall({
    contract,
    function: "like",
    kwargs: { token_id: tokenId }
  });
}

export async function proveOwnership(contract: string, tokenId: string, proof: string) {
  return sendCall({
    contract,
    function: "prove_ownership",
    kwargs: { token_id: tokenId, proof }
  });
}

/** Convenience: approve + buy in sequence. */
export async function approveAndBuy(args: {
  contract: string;
  tokenId: string;
  currencyContract: string;
  price: number;
}) {
  await approveCurrency({
    currencyContract: args.currencyContract,
    spender: args.contract,
    amount: args.price
  });
  return buy(args.contract, args.tokenId);
}
