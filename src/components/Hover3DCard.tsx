import { Link } from "react-router-dom";
import { Heart, Tag } from "lucide-react";
import type { TokenMetadata, ListingInfo } from "../lib/nft";
import { NFTMedia } from "./NFTMedia";
import { shortAddress } from "../lib/format";
import { formatPrice } from "../lib/decimal";
import { NATIVE_CURRENCY, PIXELGRID_SCHEMA } from "../lib/constants";

interface Hover3DCardProps {
  contract: string;
  token: TokenMetadata;
  listing?: ListingInfo | null;
  collectionName?: string;
  /** Hide the link wrap (used when nested in another <a>). */
  staticOnly?: boolean;
  /** Render in compact form (smaller padding, no stats footer). */
  compact?: boolean;
}

/**
 * daisyUI hover-3d wrapper around an NFT preview. The 8 empty <div>s create
 * the hover-detection zones that daisyUI uses for the tilt effect.
 */
export function Hover3DCard({ contract, token, listing, collectionName, staticOnly, compact }: Hover3DCardProps) {
  const href = `/collections/${contract}/token/${encodeURIComponent(token.tokenId)}`;
  const body = (
    <div className={`card bg-base-200 border border-base-content/5 overflow-hidden shadow-lg ${compact ? "w-full" : "w-full"}`}>
      <figure className="aspect-square bg-base-300 relative overflow-hidden">
        <NFTMedia
          mimeType={token.mimeType}
          encoding={token.encoding}
          content={token.content}
          uri={token.uri}
          fallbackSeed={`${contract}:${token.tokenId}`}
          fallbackLabel={token.name || token.tokenId}
          pixelated={token.renderSchema === PIXELGRID_SCHEMA}
          muteVideo
          pixelGrid={
            token.renderSchema === PIXELGRID_SCHEMA
              ? {
                  contract,
                  paletteId: token.paletteId,
                  width: token.width,
                  height: token.height,
                  frameCount: token.frameCount || 1,
                  frameDelayMs: token.frameDelayMs
                }
              : null
          }
        />
        {listing && (
          <div className="absolute top-2 right-2 badge badge-primary gap-1 shadow-lg">
            <Tag size={10} /> For sale
          </div>
        )}
      </figure>
      {!compact && (
        <div className="card-body p-4 gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {collectionName && (
                <div className="text-[10px] uppercase tracking-wider text-base-content/50 font-mono truncate">
                  {collectionName}
                </div>
              )}
              <h3 className="card-title text-base leading-tight truncate">{token.name || token.tokenId}</h3>
            </div>
            <span className="badge badge-ghost gap-1 shrink-0">
              <Heart size={10} /> {token.likes}
            </span>
          </div>
          {listing ? (
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xs text-base-content/60">Price</span>
              <span className="font-semibold">
                {formatPrice(listing.price)}{" "}
                <span className="text-xs text-base-content/60">
                  {listing.currencyContract === NATIVE_CURRENCY ? "XIAN" : listing.currencyContract}
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xs text-base-content/60">Owner</span>
              <span className="text-xs font-mono text-base-content/80">{shortAddress(token.owner)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (staticOnly) {
    return (
      <div className="hover-3d cursor-default">
        {body}
        {/* 8 hover zones for daisyUI tilt effect */}
        <div></div><div></div><div></div><div></div>
        <div></div><div></div><div></div><div></div>
      </div>
    );
  }

  return (
    <Link to={href} className="hover-3d cursor-pointer block">
      {body}
      <div></div><div></div><div></div><div></div>
      <div></div><div></div><div></div><div></div>
    </Link>
  );
}

/** Skeleton variant used while loading. */
export function Hover3DCardSkeleton() {
  return (
    <div className="card bg-base-200 border border-base-content/5 overflow-hidden shadow-lg">
      <div className="aspect-square shimmer" />
      <div className="p-4 space-y-2">
        <div className="shimmer h-3 w-20 rounded" />
        <div className="shimmer h-4 w-3/4 rounded" />
        <div className="shimmer h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}
