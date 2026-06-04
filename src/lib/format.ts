import {
  copyToClipboard,
  maybeDate,
  shortAddress,
  toNumber
} from "@xian-tech/web-kit";

/** Number / address / time formatting helpers. */

export { copyToClipboard, maybeDate, shortAddress, toNumber };

export function normalizeAddress(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function isSameAddress(a: unknown, b: unknown): boolean {
  const left = normalizeAddress(a);
  const right = normalizeAddress(b);
  return left.length > 0 && left === right;
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
