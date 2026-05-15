import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Layers, Plus, RefreshCw } from "lucide-react";
import { useCollections } from "../hooks/useCollections";
import { CollectionCard, CollectionCardSkeleton } from "../components/CollectionCard";
import { EmptyState } from "../components/EmptyState";

export default function Collections() {
  const { collections, loading, refresh } = useCollections();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.contract.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [collections, query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Collections</h1>
          <p className="text-base-content/60 mt-2">
            Browse every XSC-0004 collection PixelSnek knows about.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-sm gap-2"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <Link to="/create" className="btn btn-primary btn-sm gap-2">
            <Plus size={14} /> Register
          </Link>
        </div>
      </header>

      <div className="join w-full max-w-xl">
        <span className="join-item btn btn-ghost no-animation pointer-events-none">
          <Search size={16} />
        </span>
        <input
          type="text"
          className="join-item input input-bordered w-full"
          placeholder="Search collections by name, symbol, or contract…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CollectionCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        collections.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No collections registered"
            description="PixelSnek auto-discovers XSC-0004 collections from on-chain events. You can also register one manually if you know its contract address."
          >
            <Link to="/create" className="btn btn-primary btn-sm gap-2">
              <Plus size={14} /> Register a collection
            </Link>
          </EmptyState>
        ) : (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`Nothing matches "${query}". Try a different search.`}
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {filtered.map((c) => (
            <CollectionCard key={c.contract} collection={c} />
          ))}
        </div>
      )}
    </div>
  );
}
