/**
 * NFT media renderer logic.
 *
 * XSC-0005 stores: mime_type, encoding ("utf8" | "base64"), inline content
 * (small payloads) or chunked content (larger payloads).
 *
 * Renderable types we support visually:
 *   - image/svg+xml + utf8        → inline SVG / data URL
 *   - image/png|jpeg|gif + base64 → data URL
 *   - image/* + utf8 (raw URL)    → just use the URI
 *   - video/* + base64            → data URL <video>
 *   - audio/* + base64            → data URL <audio>
 *   - text/* + utf8               → preformatted text
 *   - application/json + utf8     → pretty-printed JSON
 *
 * If only `uri` is set and `content` is empty, we use the URI directly.
 */

import { safeMediaUrl } from "./urls";

export type MediaKind = "image" | "video" | "audio" | "text" | "json" | "unknown";

export interface ResolvedMedia {
  kind: MediaKind;
  /** Best URL (data: or http) for display. */
  url: string | null;
  /** Inline SVG markup, when we render SVG directly. */
  inlineSvg?: string;
  /** Text/JSON contents to render verbatim. */
  text?: string;
  mimeType: string;
}

export interface MediaInput {
  mimeType: string;
  encoding: string;
  content: string;
  uri: string;
}

function kindFromMime(mime: string): MediaKind {
  const m = mime.toLowerCase();
  if (m === "image/svg+xml") return "image";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/json") return "json";
  if (m.startsWith("text/")) return "text";
  return "unknown";
}

export function resolveMedia(input: MediaInput): ResolvedMedia {
  const mime = input.mimeType || "application/octet-stream";
  const kind = kindFromMime(mime);
  const encoding = (input.encoding || "utf8").toLowerCase();
  const content = input.content || "";
  const uri = input.uri || "";

  // No inline content; rely on external URI
  if (!content) {
    return { kind, url: safeMediaUrl(uri), mimeType: mime };
  }

  // SVG inline (utf8)
  if (mime === "image/svg+xml" && encoding === "utf8") {
    const url = `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
    return { kind: "image", url, inlineSvg: content, mimeType: mime };
  }

  // Base64-encoded binary
  if (encoding === "base64") {
    return { kind, url: `data:${mime};base64,${content}`, mimeType: mime };
  }

  // Text / JSON
  if (kind === "text" || kind === "json") {
    let pretty = content;
    if (kind === "json") {
      try {
        pretty = JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        // keep raw
      }
    }
    return { kind, url: null, text: pretty, mimeType: mime };
  }

  // Other utf8 text-like data → data URL
  return {
    kind,
    url: `data:${mime};charset=utf-8,${encodeURIComponent(content)}`,
    mimeType: mime
  };
}

/**
 * Build a deterministic generative SVG fallback for tokens with no preview.
 * Uses the tokenId + collection name as a hash seed.
 */
export function generativeFallbackSvg(seed: string, label: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h = (h ^ seed.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0xffffffff;
  };
  const hueA = Math.floor(rand() * 360);
  const hueB = (hueA + 60 + Math.floor(rand() * 180)) % 360;
  const blobs = Array.from({ length: 6 }, () => ({
    cx: Math.floor(rand() * 200),
    cy: Math.floor(rand() * 200),
    r: 30 + Math.floor(rand() * 80),
    o: 0.3 + rand() * 0.4
  }));
  const blobsSvg = blobs
    .map(
      (b) =>
        `<circle cx="${b.cx}" cy="${b.cy}" r="${b.r}" fill="hsl(${(hueA + Math.floor(rand() * 60)) % 360} 80% 60%)" opacity="${b.o.toFixed(2)}"/>`
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hueA} 70% 12%)"/>
        <stop offset="1" stop-color="hsl(${hueB} 70% 18%)"/>
      </linearGradient>
      <filter id="b"><feGaussianBlur stdDeviation="20"/></filter>
    </defs>
    <rect width="200" height="200" fill="url(#bg)"/>
    <g filter="url(#b)">${blobsSvg}</g>
    <text x="50%" y="92%" text-anchor="middle" fill="hsl(${hueA} 30% 92%)" font-family="ui-monospace, monospace" font-size="10" opacity="0.7">${escapeXml(label)}</text>
  </svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function fallbackDataUrl(seed: string, label: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(generativeFallbackSvg(seed, label))}`;
}
