import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, Tag, Compass, Layers, Plus } from "lucide-react";
import { useCollections } from "../hooks/useCollections";
import { Hover3DCard, Hover3DCardSkeleton } from "../components/Hover3DCard";
import { CollectionCard, CollectionCardSkeleton } from "../components/CollectionCard";
import { ActivityFeed } from "../components/ActivityFeed";
import { EmptyState } from "../components/EmptyState";
import {
  listAllTokenIds,
  listRecentListings,
  loadTokensByIds,
  type TokenWithListing
} from "../lib/tokens";
import { loadActivity, type ActivityItem } from "../lib/activity";
import type { ContractMetadata } from "../lib/nft";

interface FeaturedToken {
  token: TokenWithListing;
  collection: ContractMetadata;
}

export default function Home() {
  const { collections, loading: loadingCollections } = useCollections();
  const [featured, setFeatured] = useState<FeaturedToken[] | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);

  // Hot listings — indexer-driven. For each known collection, pull a slice of
  // recent `TokenListed` events and load metadata only for those few IDs.
  // Falls back to "first N tokens" when the indexer doesn't return listings.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (collections.length === 0) {
        setFeatured([]);
        return;
      }
      const top = collections.slice(0, 6);
      const buckets = await Promise.all(
        top.map(async (collection) => {
          let ids = await listRecentListings(collection.contract, 4).catch(() => [] as string[]);
          if (ids.length === 0) {
            // Fallback when indexer has nothing for this collection.
            const allIds = await listAllTokenIds(collection.contract).catch(
              () => [] as string[]
            );
            ids = allIds.slice(0, 2);
          }
          const loaded = await loadTokensByIds(collection.contract, ids).catch(
            () => [] as TokenWithListing[]
          );
          return loaded.map((token) => ({ token, collection }));
        })
      );
      if (cancelled) return;
      const allTokens = buckets.flat();
      allTokens.sort((a, b) => {
        const al = a.token.listing ? 1 : 0;
        const bl = b.token.listing ? 1 : 0;
        if (al !== bl) return bl - al;
        return b.token.metadata.likes - a.token.metadata.likes;
      });
      setFeatured(allTokens.slice(0, 8));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [collections]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const items = await loadActivity(12);
      if (!cancelled) setActivity(items);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [collections]);

  const heroTokens = useMemo(() => (featured ?? []).slice(0, 3), [featured]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-16 space-y-16">
      {/* ── Hero ── */}
      <section className="relative">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <Sparkles size={12} /> XSC-0005 · Powered by Xian
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Discover, collect & trade <span className="gradient-text">on-chain art</span> on Xian.
            </h1>
            <p className="text-lg text-base-content/70 max-w-xl">
              PixelSnek is the home for XSC-0005 NFTs — fully on-chain media, transparent royalties,
              and zero gas wars. Buy what you love, mint what you make.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/collections" className="btn btn-primary gap-2">
                <Compass size={16} /> Browse collections
              </Link>
              <Link to="/create" className="btn btn-outline gap-2">
                <Plus size={16} /> Start creating
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-6 max-w-md">
              <Stat label="Collections" value={collections.length || "—"} />
              <Stat
                label="Tokens"
                value={
                  collections.reduce((a, c) => a + c.tokenCount, 0) || "—"
                }
              />
              <Stat label="Standard" value="XSC-0005" />
            </div>
          </div>

          {/* Hero hover-3d gallery */}
          <div className="relative">
            <div className="grid grid-cols-3 gap-4 lg:gap-6">
              {(heroTokens.length > 0 ? heroTokens : Array(3).fill(null)).map((entry, i) => (
                <div
                  key={i}
                  className={
                    i === 1
                      ? "translate-y-8 animate-float [animation-delay:200ms]"
                      : i === 2
                        ? "translate-y-2 animate-float [animation-delay:400ms]"
                        : "animate-float"
                  }
                >
                  {entry ? (
                    <Hover3DCard
                      contract={entry.collection.contract}
                      token={entry.token.metadata}
                      listing={entry.token.listing}
                      collectionName={entry.collection.name}
                      compact
                    />
                  ) : (
                    <HeroPlaceholder seed={i} />
                  )}
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-0 -z-10 blur-3xl opacity-60">
              <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-primary/40" />
              <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-accent/30" />
              <div className="absolute -bottom-12 right-0 w-56 h-56 rounded-full bg-secondary/30" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured NFTs ── */}
      <section className="space-y-6">
        <SectionHeader
          title="Hot listings"
          subtitle="The freshest XSC-0005 tokens currently for sale across known collections."
          actionLabel="All collections"
          actionHref="/collections"
        />
        {featured == null ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Hover3DCardSkeleton key={i} />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No listings yet"
            description="Mint a token in a collection you operate, then list it for sale to be the first."
          >
            <Link to="/create" className="btn btn-primary btn-sm gap-2">
              <Plus size={14} /> Mint a token
            </Link>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {featured.slice(0, 8).map(({ token, collection }) => (
              <Hover3DCard
                key={`${collection.contract}-${token.metadata.tokenId}`}
                contract={collection.contract}
                token={token.metadata}
                listing={token.listing}
                collectionName={collection.name}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Featured collections ── */}
      <section className="space-y-6">
        <SectionHeader
          title="Featured collections"
          subtitle="Curated XSC-0005 collections live on Xian right now."
          actionLabel="See all"
          actionHref="/collections"
        />
        {loadingCollections ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <CollectionCardSkeleton key={i} />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No collections registered yet"
            description="Add an XSC-0005 collection by contract address to start browsing it here."
          >
            <Link to="/create" className="btn btn-primary btn-sm gap-2">
              <Plus size={14} /> Register a collection
            </Link>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {collections.slice(0, 6).map((c) => (
              <CollectionCard key={c.contract} collection={c} />
            ))}
          </div>
        )}
      </section>

      {/* ── Activity ── */}
      <section className="space-y-6">
        <SectionHeader
          title="Recent activity"
          subtitle="Marketplace events across all known collections."
          actionLabel="View all"
          actionHref="/activity"
        />
        {activity == null ? (
          <div className="glass rounded-2xl p-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer h-8 rounded" />
            ))}
          </div>
        ) : (
          <ActivityFeed items={activity} />
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  const isPlaceholder = value === "—" || value === 0;
  return (
    <div className="space-y-1">
      <div
        className={`text-2xl font-bold ${isPlaceholder ? "text-base-content/30" : "gradient-text"}`}
      >
        {value}
      </div>
      <div className="text-xs text-base-content/60 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function HeroPlaceholder({ seed }: { seed: number }) {
  const hues = [320, 280, 200];
  const hue = hues[seed % hues.length];
  return (
    <div
      className="aspect-[4/5] rounded-2xl border border-white/8 relative overflow-hidden"
      style={{
        background: `linear-gradient(160deg,
          oklch(0.30 0.15 ${hue}) 0%,
          oklch(0.16 0.08 ${(hue + 40) % 360}) 60%,
          oklch(0.13 0.04 290) 100%
        )`,
        boxShadow:
          "inset 0 1px 0 0 rgba(255,255,255,0.10), 0 24px 60px -20px oklch(0.20 0.20 " + hue + " / 0.6)"
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 30% 25%, rgba(255,255,255,0.12), transparent 60%)"
        }}
      />
      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
          xsc-0005
        </span>
        <span className="block w-1.5 h-1.5 rounded-full bg-white/30" />
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  actionHref
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-base-content/60 mt-1">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link to={actionHref} className="section-action">
          {actionLabel} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
