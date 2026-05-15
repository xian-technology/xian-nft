import { Link } from "react-router-dom";
import { Image as ImageIcon, Hash } from "lucide-react";
import type { ContractMetadata } from "../lib/nft";
import { fallbackDataUrl } from "../lib/content";

export function CollectionCard({ collection }: { collection: ContractMetadata }) {
  const heroUrl = collection.image || fallbackDataUrl(collection.contract, collection.name);

  return (
    <Link
      to={`/collections/${collection.contract}`}
      className="group glass rounded-2xl overflow-hidden hairline hover:border-primary/40 transition-all"
    >
      <div className="aspect-[16/9] relative bg-base-300 overflow-hidden">
        <img
          src={heroUrl}
          alt={collection.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = fallbackDataUrl(collection.contract, collection.name);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-base-300/80 via-base-300/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <h3 className="font-bold text-lg leading-tight drop-shadow-lg truncate">{collection.name}</h3>
          {collection.symbol && (
            <span className="badge badge-ghost bg-base-100/70 backdrop-blur-md font-mono text-xs shrink-0">
              {collection.symbol}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm text-base-content/60 line-clamp-2 min-h-[2.5em]">
          {collection.description || "An XSC-0004 collection on the Xian network."}
        </p>
        <div className="flex items-center justify-between mt-3 text-xs text-base-content/60">
          <span className="flex items-center gap-1.5">
            <ImageIcon size={12} /> {collection.tokenCount} items
          </span>
          <span className="flex items-center gap-1.5 font-mono">
            <Hash size={12} /> {collection.contract}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CollectionCardSkeleton() {
  return (
    <div className="glass rounded-2xl overflow-hidden hairline">
      <div className="aspect-[16/9] shimmer" />
      <div className="p-4 space-y-2">
        <div className="shimmer h-4 w-3/4 rounded" />
        <div className="shimmer h-3 w-full rounded" />
        <div className="shimmer h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}
