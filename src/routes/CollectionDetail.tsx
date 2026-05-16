import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Search, Tag, Image as ImageIcon, RefreshCw, Copy, Check } from "lucide-react";
import { useCollection } from "../hooks/useCollection";
import { Hover3DCard, Hover3DCardSkeleton } from "../components/Hover3DCard";
import { EmptyState } from "../components/EmptyState";
import { fallbackDataUrl } from "../lib/content";
import { copyToClipboard, shortAddress } from "../lib/format";
import { useToasts } from "../hooks/useToasts";
import { safeExternalUrl, safeMediaUrl } from "../lib/urls";

type SortKey = "newest" | "oldest" | "price-asc" | "price-desc" | "likes";
type Filter = "all" | "for-sale";

export default function CollectionDetail() {
  const { contract } = useParams<{ contract: string }>();
  const { metadata, tokens, loading, error, refresh } = useCollection(contract);
  const { push } = useToasts();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);

  const sorted = useMemo(() => {
    let list = [...tokens];
    if (filter === "for-sale") list = list.filter((t) => t.listing != null);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.metadata.tokenId.toLowerCase().includes(q) ||
          t.metadata.name.toLowerCase().includes(q) ||
          t.metadata.description.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const ad = a.metadata.createdAt?.getTime() ?? 0;
      const bd = b.metadata.createdAt?.getTime() ?? 0;
      switch (sort) {
        case "newest":
          return bd - ad;
        case "oldest":
          return ad - bd;
        case "likes":
          return b.metadata.likes - a.metadata.likes;
        case "price-asc":
          return (a.listing?.price ?? Infinity) - (b.listing?.price ?? Infinity);
        case "price-desc":
          return (b.listing?.price ?? -Infinity) - (a.listing?.price ?? -Infinity);
        default:
          return 0;
      }
    });
    return list;
  }, [tokens, query, sort, filter]);

  async function copyContract() {
    if (!contract) return;
    if (await copyToClipboard(contract)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      push({ kind: "success", title: "Contract copied" });
    }
  }

  if (!contract) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <EmptyState
          icon={ImageIcon}
          title="No collection specified"
          description="Pick a collection from the explore page."
        />
      </div>
    );
  }

  const heroUrl =
    safeMediaUrl(metadata?.image) ?? fallbackDataUrl(contract, metadata?.name || contract);
  const websiteHref = safeExternalUrl(metadata?.website);

  return (
    <div className="space-y-8 pb-16">
      {/* ─── Hero banner ─── */}
      <div className="relative">
        <div className="w-full h-56 md:h-72 relative overflow-hidden">
          <img src={heroUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-base-100 via-base-100/60 to-base-100/10" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-16 relative">
          <div className="glass rounded-2xl hairline p-6 flex flex-col md:flex-row md:items-end gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-base-300 border-4 border-base-100 overflow-hidden shrink-0">
              <img src={heroUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link to="/collections" className="btn btn-ghost btn-xs gap-1">
                  <ArrowLeft size={12} /> Back
                </Link>
                {metadata?.symbol && (
                  <span className="badge badge-primary font-mono">{metadata.symbol}</span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
                {metadata?.name || (loading ? "Loading…" : contract)}
              </h1>
              <p className="text-sm text-base-content/60 mt-1 line-clamp-2">
                {metadata?.description || "An XSC-0005 collection on the Xian network."}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
                <button
                  className="flex items-center gap-1 font-mono text-base-content/60 hover:text-primary"
                  onClick={copyContract}
                >
                  {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  {contract}
                </button>
                {websiteHref && (
                  <a
                    href={websiteHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 link link-hover text-base-content/60"
                  >
                    <ExternalLink size={12} />
                    Website
                  </a>
                )}
                {metadata?.operator && (
                  <Link
                    to={`/profile/${metadata.operator}`}
                    className="font-mono text-base-content/60 hover:text-primary"
                  >
                    Operator: {shortAddress(metadata.operator)}
                  </Link>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Stat label="Items" value={metadata?.tokenCount ?? "—"} />
              <Stat
                label="Listed"
                value={tokens.filter((t) => t.listing).length || 0}
              />
              <Stat label="Owners" value={new Set(tokens.map((t) => t.metadata.owner)).size || 0} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Filters & Grid ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="join flex-1 min-w-[14rem]">
            <span className="join-item btn btn-ghost no-animation pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              className="join-item input input-bordered flex-1"
              placeholder="Search by name or token ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div role="tablist" className="tabs tabs-boxed">
            <button
              role="tab"
              className={`tab ${filter === "all" ? "tab-active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              role="tab"
              className={`tab ${filter === "for-sale" ? "tab-active" : ""}`}
              onClick={() => setFilter("for-sale")}
            >
              <Tag size={12} className="mr-1" /> For sale
            </button>
          </div>
          <select
            className="select select-bordered"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="likes">Most liked</option>
            <option value="price-asc">Price ↑</option>
            <option value="price-desc">Price ↓</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
            {Array.from({ length: 10 }).map((_, i) => (
              <Hover3DCardSkeleton key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={tokens.length === 0 ? "No tokens in this collection" : "No matches"}
            description={
              tokens.length === 0
                ? "Be the first to mint a token in this collection."
                : "Try clearing your filters."
            }
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
            {sorted.map((t) => (
              <Hover3DCard
                key={t.metadata.tokenId}
                contract={contract}
                token={t.metadata}
                listing={t.listing}
                collectionName={metadata?.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center px-3">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-base-content/60">{label}</div>
    </div>
  );
}
