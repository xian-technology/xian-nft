import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Wallet, ImageIcon, Tag, Sparkles, Copy, Check, AlertTriangle } from "lucide-react";
import { useWallet } from "../hooks/useWallet";
import { useCollections } from "../hooks/useCollections";
import { useToasts } from "../hooks/useToasts";
import { useProfile } from "../hooks/useProfile";
import { Hover3DCard, Hover3DCardSkeleton } from "../components/Hover3DCard";
import { EmptyState } from "../components/EmptyState";
import { Avatar } from "../components/Avatar";
import { copyToClipboard, shortAddress } from "../lib/format";

type Tab = "owned" | "listed" | "created";

export default function Profile() {
  const { address: paramAddress } = useParams<{ address?: string }>();
  const wallet = useWallet();
  const account = paramAddress || wallet.account;
  const isSelf = !!wallet.account && wallet.account === account;
  const { push } = useToasts();

  const { collections } = useCollections();
  const { tokens, fellBack } = useProfile(account, collections);
  const [tab, setTab] = useState<Tab>("owned");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    if (!tokens) return null;
    switch (tab) {
      case "owned":
        return tokens.filter((t) => t.token.metadata.owner === account);
      case "listed":
        return tokens.filter((t) => t.token.listing?.seller === account);
      case "created":
        return tokens.filter((t) => t.token.metadata.creator === account);
    }
  }, [tokens, tab, account]);

  async function copyAddr() {
    if (!account) return;
    if (await copyToClipboard(account)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      push({ kind: "success", title: "Address copied" });
    }
  }

  if (!account) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <EmptyState
          icon={Wallet}
          title="Connect to see your profile"
          description="Connect your Xian wallet to view the NFTs you own, created, and listed for sale."
        >
          <button className="btn btn-primary btn-sm" onClick={() => wallet.connect()}>
            Connect wallet
          </button>
        </EmptyState>
      </div>
    );
  }

  const stats = {
    owned: tokens?.filter((t) => t.token.metadata.owner === account).length ?? null,
    listed: tokens?.filter((t) => t.token.listing?.seller === account).length ?? null,
    created: tokens?.filter((t) => t.token.metadata.creator === account).length ?? null
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Profile header */}
      <header className="glass rounded-2xl p-6 flex flex-col md:flex-row md:items-center gap-6">
        <Avatar address={account} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {isSelf ? "Your collection" : "Profile"}
            </h1>
            {isSelf && (
              <span className="badge badge-primary badge-sm gap-1">
                <Sparkles size={10} /> You
              </span>
            )}
          </div>
          <button
            className="flex items-center gap-2 text-sm font-mono text-base-content/60 hover:text-primary mt-1"
            onClick={copyAddr}
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            {account}
          </button>
          <p className="text-xs text-base-content/50 mt-1">{shortAddress(account)}</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Owned" value={stats.owned ?? "—"} />
          <Stat label="Listed" value={stats.listed ?? "—"} />
          <Stat label="Created" value={stats.created ?? "—"} />
        </div>
      </header>

      {fellBack && (
        <div className="alert alert-warning text-sm">
          <AlertTriangle size={14} />
          <span>
            Indexer didn't return token history for one or more known collections — fell
            back to scanning every token, which can be slow.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div role="tablist" className="tabs tabs-boxed w-fit">
        <button
          role="tab"
          className={`tab gap-2 ${tab === "owned" ? "tab-active" : ""}`}
          onClick={() => setTab("owned")}
        >
          <ImageIcon size={14} /> Owned
        </button>
        <button
          role="tab"
          className={`tab gap-2 ${tab === "listed" ? "tab-active" : ""}`}
          onClick={() => setTab("listed")}
        >
          <Tag size={14} /> Listed
        </button>
        <button
          role="tab"
          className={`tab gap-2 ${tab === "created" ? "tab-active" : ""}`}
          onClick={() => setTab("created")}
        >
          <Sparkles size={14} /> Created
        </button>
      </div>

      {filtered == null ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Hover3DCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={tab === "listed" ? Tag : tab === "created" ? Sparkles : ImageIcon}
          title={
            tab === "owned"
              ? "No NFTs owned"
              : tab === "listed"
                ? "No active listings"
                : "Nothing created yet"
          }
          description={
            isSelf
              ? "Head to Explore to start collecting, or Create to mint your first NFT."
              : "This wallet has nothing here."
          }
        >
          {isSelf && (
            <>
              <Link to="/" className="btn btn-ghost btn-sm">
                Explore
              </Link>
              <Link to="/create" className="btn btn-primary btn-sm">
                Create
              </Link>
            </>
          )}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
          {filtered.map(({ token, collection }) => (
            <Hover3DCard
              key={`${collection.contract}:${token.metadata.tokenId}`}
              contract={collection.contract}
              token={token.metadata}
              listing={token.listing}
              collectionName={collection.name}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center px-3 py-2 rounded-xl bg-base-content/5">
      <div className="text-xl font-bold gradient-text">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-base-content/60">{label}</div>
    </div>
  );
}
