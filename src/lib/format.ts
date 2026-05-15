/** Number / address / time formatting helpers. */

export function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  const s = String(value).trim();
  if (s === "" || s === "null" || s === "undefined") return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function shortAddress(addr: string | null | undefined, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function formatAmount(value: unknown, decimals = 4): string {
  const n = toNumber(value);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  if (abs >= 1) return n.toFixed(decimals).replace(/\.?0+$/, "");
  return n.toFixed(Math.min(8, decimals + 2)).replace(/\.?0+$/, "");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function timeAgo(dateLike: string | number | Date | null | undefined): string {
  if (dateLike == null) return "—";
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  const ms = Date.now() - date.getTime();
  if (!Number.isFinite(ms)) return "—";
  if (ms < 0) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function maybeDate(value: unknown): Date | null {
  if (value == null) return null;
  // Xian datetime objects: { __time__: [Y, M, D, h, m, s, μs] }
  if (typeof value === "object" && value !== null && "__time__" in value) {
    const t = (value as { __time__: number[] }).__time__;
    if (Array.isArray(t) && t.length >= 6) {
      return new Date(Date.UTC(t[0], t[1] - 1, t[2], t[3], t[4], t[5], Math.floor((t[6] ?? 0) / 1000)));
    }
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}
