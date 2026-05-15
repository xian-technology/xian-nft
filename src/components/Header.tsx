import { NavLink, useNavigate } from "react-router-dom";
import { Wallet, Compass, Layers, Plus, User, Activity, Lock, AlertTriangle, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useToasts } from "../hooks/useToasts";
import { shortAddress, copyToClipboard } from "../lib/format";
import { Logo } from "./Logo";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Explore", icon: Compass },
  { to: "/collections", label: "Collections", icon: Layers },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/create", label: "Create", icon: Plus }
];

export function Header() {
  const wallet = useWallet();
  const navigate = useNavigate();
  const { push } = useToasts();
  const [copied, setCopied] = useState(false);

  async function handleAddress() {
    if (!wallet.account) return;
    const ok = await copyToClipboard(wallet.account);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
      push({ kind: "success", title: "Address copied" });
    }
  }

  return (
    <header className="sticky top-0 z-30 glass border-b border-base-content/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <NavLink to="/" className="flex items-center gap-2 shrink-0">
          <Logo size={28} />
          <span className="text-lg font-bold tracking-tight">
            Pixel<span className="gradient-text">Snek</span>
          </span>
        </NavLink>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "bg-primary/15 text-primary" : "text-base-content/70 hover:text-base-content hover:bg-base-content/5"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!wallet.available && (
            <span className="badge badge-warning gap-1">
              <AlertTriangle size={12} /> No wallet
            </span>
          )}
          {wallet.available && wallet.info?.locked && !wallet.account && (
            <span className="badge badge-warning gap-1">
              <Lock size={12} /> Locked
            </span>
          )}
          {wallet.account ? (
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost btn-sm gap-2 font-mono"
                onClick={() => navigate("/profile")}
                title="Open profile"
              >
                <User size={14} />
                <span className="hidden sm:inline">{shortAddress(wallet.account)}</span>
              </button>
              <button
                className="btn btn-ghost btn-sm btn-circle"
                onClick={handleAddress}
                title={copied ? "Copied!" : "Copy address"}
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm gap-2"
              disabled={wallet.connecting || !wallet.available}
              onClick={() => wallet.connect()}
            >
              <Wallet size={14} />
              {wallet.connecting ? "Connecting…" : wallet.info?.locked ? "Unlock" : "Connect"}
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <nav className="md:hidden flex items-center gap-1 px-3 pb-3 overflow-x-auto no-scrollbar">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                isActive ? "bg-primary/15 text-primary" : "bg-base-content/5 text-base-content/70"
              }`
            }
          >
            <Icon size={12} />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
