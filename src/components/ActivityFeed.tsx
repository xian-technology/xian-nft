import { Link } from "react-router-dom";
import { ArrowRight, Heart, Tag, ShoppingBag, Sparkles, Flame } from "lucide-react";
import type { ActivityItem } from "../lib/activity";
import { formatAmount, shortAddress } from "../lib/format";
import { NATIVE_CURRENCY } from "../lib/constants";

const KIND_META: Record<
  ActivityItem["kind"],
  { icon: typeof Sparkles; color: string; label: string }
> = {
  mint: { icon: Sparkles, color: "text-accent", label: "Minted" },
  transfer: { icon: ArrowRight, color: "text-info", label: "Transfer" },
  burn: { icon: Flame, color: "text-error", label: "Burned" },
  list: { icon: Tag, color: "text-warning", label: "Listed" },
  sale: { icon: ShoppingBag, color: "text-success", label: "Sale" },
  like: { icon: Heart, color: "text-secondary", label: "Liked" }
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-base-content/60 text-sm">
        No activity yet. New mints, listings, sales and likes will appear here.
      </div>
    );
  }
  return (
    <div className="glass rounded-2xl overflow-hidden hairline">
      <table className="table table-sm">
        <thead className="text-xs uppercase tracking-wider">
          <tr>
            <th className="font-medium">Event</th>
            <th className="font-medium">Token</th>
            <th className="font-medium hidden md:table-cell">From</th>
            <th className="font-medium hidden md:table-cell">To</th>
            <th className="font-medium text-right">Price</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const from = item.from || item.seller || item.account || "";
            const to = item.to || item.buyer || "";
            return (
              <tr key={item.id} className="hover:bg-base-content/3">
                <td>
                  <span className={`flex items-center gap-2 text-sm font-medium ${meta.color}`}>
                    <Icon size={14} /> {meta.label}
                  </span>
                </td>
                <td>
                  <Link
                    to={`/collections/${item.contract}/token/${encodeURIComponent(item.tokenId)}`}
                    className="font-mono text-xs hover:text-primary"
                  >
                    {item.tokenId}
                  </Link>
                  <div className="text-[10px] text-base-content/40 font-mono truncate max-w-[12rem]">
                    {item.contract}
                  </div>
                </td>
                <td className="hidden md:table-cell">
                  {from ? (
                    <Link to={`/profile/${from}`} className="font-mono text-xs hover:text-primary">
                      {shortAddress(from)}
                    </Link>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
                <td className="hidden md:table-cell">
                  {to ? (
                    <Link to={`/profile/${to}`} className="font-mono text-xs hover:text-primary">
                      {shortAddress(to)}
                    </Link>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
                <td className="text-right">
                  {item.price != null ? (
                    <span className="font-semibold">
                      {formatAmount(item.price)}{" "}
                      <span className="text-xs text-base-content/60">
                        {item.currencyContract === NATIVE_CURRENCY ? "XIAN" : item.currencyContract}
                      </span>
                    </span>
                  ) : (
                    <span className="text-base-content/30">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
