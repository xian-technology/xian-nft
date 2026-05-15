import { useEffect, useState } from "react";
import { Activity as ActivityIcon, RefreshCw, Filter } from "lucide-react";
import { loadActivity, type ActivityItem } from "../lib/activity";
import { ActivityFeed } from "../components/ActivityFeed";
import { EmptyState } from "../components/EmptyState";
import { ACTIVITY_PAGE_SIZE } from "../lib/constants";

type Kind = "all" | "mint" | "transfer" | "list" | "sale" | "like" | "burn";

export default function Activity() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>("all");

  async function load() {
    setLoading(true);
    try {
      const list = await loadActivity(ACTIVITY_PAGE_SIZE * 2);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = items == null ? null : kind === "all" ? items : items.filter((i) => i.kind === kind);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Activity</h1>
          <p className="text-base-content/60 mt-2">
            Live marketplace events across every known XSC-0004 collection.
          </p>
        </div>
        <button className="btn btn-ghost btn-sm gap-2" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-base-content/50" />
        {(["all", "mint", "sale", "list", "transfer", "like", "burn"] as Kind[]).map((k) => (
          <button
            key={k}
            className={`btn btn-xs ${kind === k ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setKind(k)}
          >
            {k}
          </button>
        ))}
      </div>

      {filtered == null ? (
        <div className="glass rounded-2xl p-6 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="shimmer h-8 rounded" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ActivityIcon}
          title="No activity"
          description="Make sure the Xian indexer is running and at least one collection is registered."
        />
      ) : (
        <ActivityFeed items={filtered} />
      )}
    </div>
  );
}
