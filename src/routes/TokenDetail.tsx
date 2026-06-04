import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Heart,
  Send,
  Tag,
  ShoppingBag,
  XCircle,
  Flame,
  ExternalLink,
  Copy,
  Check,
  ImageIcon,
  KeyRound,
  Award,
  ShieldCheck,
  ShieldAlert,
  Loader2
} from "lucide-react";
import { useToken } from "../hooks/useToken";
import { useWallet } from "../hooks/useWallet";
import { useToasts } from "../hooks/useToasts";
import { NFTMedia } from "../components/NFTMedia";
import { EmptyState } from "../components/EmptyState";
import { ListingDialog } from "../components/ListingDialog";
import { TransferDialog } from "../components/TransferDialog";
import { BuyDialog } from "../components/BuyDialog";
import { ApprovalsDialog } from "../components/ApprovalsDialog";
import { ProofDialog } from "../components/ProofDialog";
import {
  burn,
  cancelListing,
  getCurrencyBalance,
  likeToken
} from "../lib/nft";
import { copyToClipboard, isSameAddress, shortAddress, timeAgo } from "../lib/format";
import { compareDecimal, formatPrice } from "../lib/decimal";
import { verifyTokenContent, type ContentVerification } from "../lib/verify";
import { BPS_MAX, NATIVE_CURRENCY, PIXELGRID_SCHEMA } from "../lib/constants";
import { safeExternalUrl } from "../lib/urls";

export default function TokenDetail() {
  const { contract, tokenId: rawTokenId } = useParams<{ contract: string; tokenId: string }>();
  const tokenId = rawTokenId ? decodeURIComponent(rawTokenId) : undefined;
  const wallet = useWallet();
  const { collection, token, listing, liked, loading, error, refresh } = useToken(
    contract,
    tokenId,
    wallet.account
  );
  const { push } = useToasts();
  const [showListing, setShowListing] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBuy, setShowBuy] = useState(false);
  const [showApprovals, setShowApprovals] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verification, setVerification] = useState<ContentVerification>("unverifiable");

  // Recompute the content-hash integrity check whenever the token changes.
  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setVerification("unverifiable");
      return;
    }
    void verifyTokenContent(token).then((result) => {
      if (!cancelled) setVerification(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isOwner = !!(wallet.account && token && isSameAddress(token.owner, wallet.account));
  const royaltyPercent = token ? token.royaltyBps / 100 : 0;

  if (!contract || !tokenId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <EmptyState icon={ImageIcon} title="Token not specified" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12">
          <div className="aspect-square rounded-2xl shimmer" />
          <div className="space-y-4">
            <div className="shimmer h-6 w-32 rounded" />
            <div className="shimmer h-10 w-2/3 rounded" />
            <div className="shimmer h-4 w-full rounded" />
            <div className="shimmer h-4 w-3/4 rounded" />
            <div className="shimmer h-32 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <EmptyState
          icon={ImageIcon}
          title="Token not found"
          description={error ?? "This token may have been burned or never existed."}
        >
          <Link to={`/collections/${contract}`} className="btn btn-primary btn-sm gap-2">
            <ArrowLeft size={14} /> Back to collection
          </Link>
        </EmptyState>
      </div>
    );
  }

  async function handleLike() {
    if (!wallet.account) {
      await wallet.connect();
      return;
    }
    if (liked) {
      push({ kind: "info", title: "Already liked" });
      return;
    }
    setBusyAction("like");
    try {
      const result = await likeToken(contract!, tokenId!);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Like failed"));
      }
      push({ kind: "success", title: "Liked" });
      await refresh();
    } catch (e) {
      push({
        kind: "error",
        title: "Like failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCancelListing() {
    setBusyAction("cancel");
    try {
      const result = await cancelListing(contract!, tokenId!);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Cancel failed"));
      }
      push({ kind: "success", title: "Listing cancelled" });
      await refresh();
    } catch (e) {
      push({
        kind: "error",
        title: "Cancel failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBurn() {
    if (!window.confirm("Burn this token permanently? This cannot be undone.")) return;
    setBusyAction("burn");
    try {
      const result = await burn(contract!, tokenId!);
      if (result.receipt?.success === false) {
        throw new Error(String(result.receipt.message ?? "Burn failed"));
      }
      push({ kind: "success", title: "Token burned" });
      await refresh();
    } catch (e) {
      push({
        kind: "error",
        title: "Burn failed",
        message: e instanceof Error ? e.message : "Unknown error"
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleBuyClick() {
    let buyer = wallet.account;
    if (!buyer) {
      buyer = await wallet.connect();
      if (!buyer) return;
    }
    if (listing) {
      // Pre-flight: don't open the buy flow (an approve + a buy = two stamped
      // transactions) if it's bound to revert. The contract enforces both of
      // these; checking here just saves the wasted fees and gives a clear why.
      if (listing.reservedFor && !isSameAddress(listing.reservedFor, buyer)) {
        push({
          kind: "error",
          title: "Reserved listing",
          message: `This token is reserved for ${shortAddress(listing.reservedFor)}.`
        });
        return;
      }
      setBusyAction("buy-check");
      try {
        const balance = await getCurrencyBalance(listing.currencyContract, buyer);
        if (compareDecimal(balance, listing.price) < 0) {
          const label =
            listing.currencyContract === NATIVE_CURRENCY ? "XIAN" : listing.currencyContract;
          push({
            kind: "error",
            title: "Insufficient balance",
            message: `You need ${formatPrice(listing.price)} ${label} but hold ${formatPrice(
              balance
            )}.`
          });
          return;
        }
      } catch {
        // If the balance read fails (e.g. odd currency contract), don't block —
        // fall through and let the on-chain buy be the authority.
      } finally {
        setBusyAction(null);
      }
    }
    setShowBuy(true);
  }

  async function copyId() {
    if (await copyToClipboard(`${contract}:${tokenId}`)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  }

  const currencyLabel =
    listing && listing.currencyContract === NATIVE_CURRENCY ? "XIAN" : listing?.currencyContract;
  const tokenUriHref = safeExternalUrl(token.uri);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <Link to={`/collections/${contract}`} className="btn btn-ghost btn-sm gap-1 mb-4">
        <ArrowLeft size={14} /> {collection?.name || contract}
      </Link>

      <div className="grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12">
        {/* ─── Media: hover-3d ─── */}
        <div className="space-y-4">
          <a href="#" onClick={(e) => e.preventDefault()} className="hover-3d cursor-default block">
            <div className="card bg-base-200 border border-base-content/5 overflow-hidden shadow-2xl">
              <figure className="aspect-square bg-base-300 relative overflow-hidden">
                <NFTMedia
                  mimeType={token.mimeType}
                  encoding={token.encoding}
                  content={token.content}
                  uri={token.uri}
                  fallbackSeed={`${contract}:${tokenId}`}
                  fallbackLabel={token.name}
                  pixelated={token.renderSchema === PIXELGRID_SCHEMA}
                  pixelGrid={
                    token.renderSchema === PIXELGRID_SCHEMA
                      ? {
                          contract: contract!,
                          paletteId: token.paletteId,
                          width: token.width,
                          height: token.height,
                          frameCount: token.frameCount || 1,
                          frameDelayMs: token.frameDelayMs
                        }
                      : null
                  }
                />
              </figure>
            </div>
            <div></div><div></div><div></div><div></div>
            <div></div><div></div><div></div><div></div>
          </a>

          {verification !== "unverifiable" && (
            <div
              className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 border ${
                verification === "verified"
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-error/10 border-error/30 text-error"
              }`}
            >
              {verification === "verified" ? (
                <ShieldCheck size={14} className="shrink-0" />
              ) : (
                <ShieldAlert size={14} className="shrink-0" />
              )}
              <span>
                {verification === "verified"
                  ? "Content verified — media matches the on-chain content hash."
                  : "Hash mismatch — the media does not match the on-chain content hash."}
              </span>
            </div>
          )}

          {/* On-chain content panel */}
          <div className="collapse collapse-arrow glass hairline">
            <input type="checkbox" />
            <div className="collapse-title text-sm font-semibold">On-chain content details</div>
            <div className="collapse-content text-xs space-y-1 font-mono">
              <KV k="MIME" v={token.mimeType} />
              <KV k="Encoding" v={token.encoding} />
              {token.contentHash && <KV k="SHA-256" v={token.contentHash} />}
              {token.chunkCount > 0 && <KV k="Chunks" v={String(token.chunkCount)} />}
              <KV k="Locked" v={token.contentLocked ? "yes" : "no"} />
              {tokenUriHref && (
                <div className="flex gap-2 break-all">
                  <span className="text-base-content/50 shrink-0">URI</span>
                  <a className="link link-primary" href={tokenUriHref} target="_blank" rel="noreferrer">
                    {token.uri}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Details + Actions ─── */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-base-content/60">
              <Link to={`/collections/${contract}`} className="link link-hover">
                {collection?.name || contract}
              </Link>
              {collection?.symbol && (
                <span className="badge badge-ghost font-mono text-xs">{collection.symbol}</span>
              )}
            </div>
            <div className="flex items-start justify-between gap-3 mt-1">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                {token.name || token.tokenId}
              </h1>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={copyId} title="Copy contract:tokenId">
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
            {token.description && (
              <p className="text-base-content/70 mt-3 whitespace-pre-wrap leading-relaxed">
                {token.description}
              </p>
            )}
          </div>

          {/* Ownership stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-4 hairline">
              <div className="text-xs uppercase tracking-wider text-base-content/50">Owner</div>
              <Link
                to={`/profile/${token.owner}`}
                className="font-mono text-sm hover:text-primary truncate block mt-1"
              >
                {shortAddress(token.owner)}
              </Link>
            </div>
            <div className="glass rounded-2xl p-4 hairline">
              <div className="text-xs uppercase tracking-wider text-base-content/50">Creator</div>
              <Link
                to={`/profile/${token.creator}`}
                className="font-mono text-sm hover:text-primary truncate block mt-1"
              >
                {shortAddress(token.creator)}
              </Link>
            </div>
            <div className="glass rounded-2xl p-4 hairline">
              <div className="text-xs uppercase tracking-wider text-base-content/50">Minted</div>
              <div className="text-sm mt-1">{timeAgo(token.createdAt)}</div>
            </div>
            <div className="glass rounded-2xl p-4 hairline">
              <div className="text-xs uppercase tracking-wider text-base-content/50">Royalty</div>
              <div className="text-sm mt-1">
                {royaltyPercent}% ({token.royaltyBps}/{BPS_MAX})
              </div>
            </div>
          </div>

          {/* Listing / actions */}
          <div className="glass rounded-2xl p-5 hairline space-y-4">
            {listing ? (
              <>
                <div>
                  <div className="text-xs text-base-content/60 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Tag size={12} /> Listed for
                  </div>
                  <div className="text-3xl font-bold">
                    {formatPrice(listing.price)}{" "}
                    <span className="text-base font-normal text-base-content/60">{currencyLabel}</span>
                  </div>
                  {listing.reservedFor && (
                    <div className="text-xs text-base-content/50 mt-1">
                      Reserved for{" "}
                      <span className="font-mono">{shortAddress(listing.reservedFor)}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {isOwner ? (
                    <button
                      className="btn btn-warning gap-2 flex-1"
                      onClick={handleCancelListing}
                      disabled={busyAction === "cancel"}
                    >
                      {busyAction === "cancel" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <XCircle size={14} />
                      )}
                      Cancel listing
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary gap-2 flex-1"
                      onClick={handleBuyClick}
                      disabled={wallet.connecting || busyAction === "buy-check"}
                    >
                      {busyAction === "buy-check" ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ShoppingBag size={14} />
                      )}
                      {wallet.account ? "Buy now" : "Connect to buy"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-base-content/60">This token is not currently for sale.</div>
                {isOwner && (
                  <button
                    className="btn btn-primary gap-2 w-full"
                    onClick={() => setShowListing(true)}
                  >
                    <Tag size={14} /> List for sale
                  </button>
                )}
              </>
            )}
          </div>

          {/* Secondary actions */}
          <div className="flex flex-wrap gap-2">
            <button
              className="btn btn-ghost gap-2 flex-1"
              onClick={handleLike}
              disabled={busyAction === "like" || liked}
            >
              {busyAction === "like" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Heart size={14} className={liked ? "fill-secondary text-secondary" : ""} />
              )}
              {liked ? "Liked" : "Like"} · {token.likes}
            </button>
            {isOwner && (
              <>
                <button
                  className="btn btn-ghost gap-2"
                  onClick={() => setShowTransfer(true)}
                  disabled={!!busyAction}
                >
                  <Send size={14} /> Transfer
                </button>
                <button
                  className="btn btn-ghost gap-2"
                  onClick={() => setShowApprovals(true)}
                  disabled={!!busyAction}
                >
                  <KeyRound size={14} /> Approvals
                </button>
                <button
                  className="btn btn-ghost gap-2"
                  onClick={() => setShowProof(true)}
                  disabled={!!busyAction}
                >
                  <Award size={14} /> {token.proof ? "Update proof" : "Sign proof"}
                </button>
                <button
                  className="btn btn-ghost gap-2"
                  onClick={handleBurn}
                  disabled={!!busyAction}
                >
                  {busyAction === "burn" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Flame size={14} />
                  )}
                  Burn
                </button>
              </>
            )}
            {tokenUriHref && (
              <a
                href={tokenUriHref}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost gap-2"
              >
                <ExternalLink size={14} /> URI
              </a>
            )}
          </div>

          {/* Proof of ownership */}
          {token.proof && (
            <div className="rounded-2xl bg-success/10 border border-success/30 p-4 text-sm">
              <div className="text-xs text-success font-semibold mb-1 uppercase tracking-wider">
                Owner-signed proof
              </div>
              <div className="font-mono text-xs break-all opacity-80">{token.proof}</div>
            </div>
          )}
        </div>
      </div>

      {showListing && (
        <ListingDialog
          contract={contract}
          tokenId={tokenId}
          onClose={() => setShowListing(false)}
          onListed={refresh}
        />
      )}
      {showTransfer && (
        <TransferDialog
          contract={contract}
          tokenId={tokenId}
          onClose={() => setShowTransfer(false)}
          onTransferred={refresh}
        />
      )}
      {showBuy && listing && (
        <BuyDialog
          contract={contract}
          tokenId={tokenId}
          listing={listing}
          onClose={() => setShowBuy(false)}
          onBought={refresh}
        />
      )}
      {showApprovals && wallet.account && (
        <ApprovalsDialog
          contract={contract}
          tokenId={tokenId}
          owner={token.owner}
          account={wallet.account}
          onClose={() => setShowApprovals(false)}
          onChanged={refresh}
        />
      )}
      {showProof && (
        <ProofDialog
          contract={contract}
          tokenId={tokenId}
          current={token.proof}
          onClose={() => setShowProof(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2 break-all">
      <span className="text-base-content/50 shrink-0 min-w-[5rem]">{k}</span>
      <span>{v}</span>
    </div>
  );
}
