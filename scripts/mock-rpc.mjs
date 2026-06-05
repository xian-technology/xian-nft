#!/usr/bin/env node

import http from "node:http";
import { createHash } from "node:crypto";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";

const STANDARD = "XSC-0005";
const PIXELGRID_SCHEMA = "xian.pixelgrid.v1";
const PIXELGRID_MIME = "application/x.xian.pixelgrid";
const PIXELGRID_ENCODING = "palette-index-64";

function sha256Hex(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

// Mirror the contract's pixel-grid hash domain so the website's content-hash
// verification badge reads "verified" against mock data too.
function contentHashFor(token) {
  if (token.contentHash) return token.contentHash;
  if (!token.content) return "";
  if (token.renderSchema === PIXELGRID_SCHEMA) {
    const source = [
      PIXELGRID_SCHEMA,
      token.paletteId,
      String(token.width),
      String(token.height),
      String(token.frameCount),
      String(token.frameDelayMs),
      token.content
    ].join(":");
    return sha256Hex(source);
  }
  return sha256Hex(token.content);
}

// The "operator/deployer" identity used across the seeded collections.
// Override it with your real connected wallet address so the mock's sample
// collections show up as ones YOU operate — otherwise the Create / Pixel-grid
// gating (which mirrors the contract's require_operator check) can never match
// a browser wallet, and you'll see "No registered operator match for …".
//   MOCK_OPERATOR=<your 64-char address> npm run mock:rpc
function resolveOperator() {
  const override = process.env.MOCK_OPERATOR?.trim();
  if (!override) return "0".repeat(64);
  if (!/^[0-9a-fA-F]{64}$/.test(override)) {
    console.warn(
      `[mock-rpc] MOCK_OPERATOR="${override}" is not a 64-char hex address; using it anyway.`
    );
  }
  return override;
}

const OPERATOR = resolveOperator();
const ALICE = "a".repeat(64);
const BOB = "b".repeat(64);
const CARA = "c".repeat(64);
const DEX = "d".repeat(64);

function svg(title, subtitle, bg, fg, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#g)"/>
  <circle cx="116" cy="126" r="72" fill="${fg}" opacity="0.18"/>
  <circle cx="506" cy="466" r="118" fill="${fg}" opacity="0.16"/>
  <path d="M132 396c82-112 164-112 246 0 38 52 76 52 114 0" fill="none" stroke="${fg}" stroke-width="28" stroke-linecap="round"/>
  <text x="56" y="544" fill="${fg}" font-family="Inter,Arial,sans-serif" font-size="56" font-weight="800">${escapeXml(title)}</text>
  <text x="58" y="588" fill="${fg}" opacity="0.72" font-family="Inter,Arial,sans-serif" font-size="24">${escapeXml(subtitle)}</text>
</svg>`;
}

function dataSvg(title, subtitle, bg, fg, accent) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg(title, subtitle, bg, fg, accent))}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function px(rows) {
  return rows.join("");
}

const collections = [
  {
    contract: "con_pixel_sneks",
    name: "PixelSnek Genesis",
    symbol: "SNEK",
    description: "Crisp on-chain snek art, animated PixelGrid pieces, and early marketplace listings.",
    image: dataSvg("PixelSnek", "Genesis collection", "#080411", "#f5f3ff", "#7c3aed"),
    website: "https://xian.org",
    operator: OPERATOR,
    palettes: {
      snek: {
        name: "Snek neon",
        locked: true,
        creator: OPERATOR,
        created: "2026-06-04T09:20:00Z",
        colors: ["transparent", "#111827", "#22c55e", "#84cc16", "#facc15", "#f8fafc"]
      }
    },
    tokens: [
      {
        tokenId: "snek-001",
        owner: ALICE,
        creator: OPERATOR,
        created: "2026-06-04T09:23:00Z",
        name: "Neon Coil",
        description: "A bold SVG snek used as the first marketplace listing in this local test set.",
        mimeType: "image/svg+xml",
        encoding: "utf8",
        content: svg("Neon Coil", "listed at 42.5 XIAN", "#10051f", "#ecfeff", "#06b6d4"),
        royaltyReceiver: OPERATOR,
        royaltyBps: 500,
        likes: 18,
        listing: {
          seller: ALICE,
          currencyContract: "currency",
          price: "42.500000000000000001",
          reservedFor: ""
        }
      },
      {
        tokenId: "snek-002",
        owner: BOB,
        creator: OPERATOR,
        created: "2026-06-04T09:28:00Z",
        name: "Garden Blink",
        description: "Animated 8x8 PixelGrid token with two frames and a locked on-chain palette.",
        mimeType: PIXELGRID_MIME,
        encoding: PIXELGRID_ENCODING,
        content: px([
          "00022000",
          "00233200",
          "02344320",
          "23444432",
          "02344320",
          "00233200",
          "00022000",
          "00000000",
          "00033000",
          "00322300",
          "03244230",
          "32444423",
          "03244230",
          "00322300",
          "00033000",
          "00000000"
        ]),
        renderSchema: PIXELGRID_SCHEMA,
        paletteId: "snek",
        width: 8,
        height: 8,
        frameCount: 2,
        frameDelayMs: 420,
        pixelEncoding: PIXELGRID_ENCODING,
        royaltyReceiver: OPERATOR,
        royaltyBps: 750,
        likes: 24
      },
      {
        tokenId: "snek-003",
        owner: CARA,
        creator: CARA,
        created: "2026-06-04T09:41:00Z",
        name: "Royal Shed",
        description: "Listed with a large integer price to exercise decimal-safe formatting.",
        mimeType: "image/svg+xml",
        encoding: "utf8",
        content: svg("Royal Shed", "high precision listing", "#2b1039", "#fff7ed", "#fb7185"),
        royaltyReceiver: CARA,
        royaltyBps: 1000,
        likes: 7,
        listing: {
          seller: CARA,
          currencyContract: "currency",
          price: "1000000.000000001",
          reservedFor: ""
        }
      }
    ]
  },
  {
    contract: "con_chain_gallery",
    name: "Chain Gallery",
    symbol: "GALL",
    description: "Fully on-chain gallery cards mixing SVG studies, text pieces, and JSON metadata.",
    image: dataSvg("Gallery", "On-chain studies", "#06131f", "#f8fafc", "#0ea5e9"),
    website: "https://xian.org",
    operator: DEX,
    palettes: {},
    tokens: [
      {
        tokenId: "study-blue",
        owner: DEX,
        creator: DEX,
        created: "2026-06-04T10:03:00Z",
        name: "Blue Contract Study",
        description: "SVG artwork with an active listing.",
        mimeType: "image/svg+xml",
        encoding: "utf8",
        content: svg("Blue Study", "chain rendered SVG", "#06131f", "#e0f2fe", "#0284c7"),
        royaltyReceiver: DEX,
        royaltyBps: 250,
        likes: 14,
        listing: {
          seller: DEX,
          currencyContract: "currency",
          price: "8.75",
          reservedFor: ""
        }
      },
      {
        tokenId: "manifesto-1",
        owner: ALICE,
        creator: DEX,
        created: "2026-06-04T10:09:00Z",
        name: "Tiny Manifesto",
        description: "Text token preview for non-image media rendering.",
        mimeType: "text/plain",
        encoding: "utf8",
        content: "Everything here is loaded from the local mock Xian RPC. No wallet or real contract writes needed.",
        royaltyReceiver: DEX,
        royaltyBps: 0,
        likes: 3
      },
      {
        tokenId: "metadata-json",
        owner: BOB,
        creator: DEX,
        created: "2026-06-04T10:12:00Z",
        name: "Structured Object",
        description: "JSON media token for the pretty-print renderer.",
        mimeType: "application/json",
        encoding: "utf8",
        content: JSON.stringify({
          name: "Structured Object",
          edition: 7,
          attributes: [
            { trait_type: "network", value: "local mock" },
            { trait_type: "standard", value: "XSC-0005" }
          ]
        }),
        royaltyReceiver: DEX,
        royaltyBps: 300,
        likes: 5
      }
    ]
  },
  {
    contract: "con_arcade_pixels",
    name: "Arcade Pixels",
    symbol: "ARPX",
    description: "Small arcade-style test pieces for grid, listing, and profile browsing.",
    image: dataSvg("Arcade", "Pixel test set", "#120f06", "#fffbeb", "#f97316"),
    website: "https://xian.org",
    operator: OPERATOR,
    palettes: {
      arcade: {
        name: "Arcade cabinet",
        locked: true,
        creator: OPERATOR,
        created: "2026-06-04T10:25:00Z",
        colors: ["transparent", "#020617", "#ef4444", "#f59e0b", "#22c55e", "#38bdf8"]
      }
    },
    tokens: [
      {
        tokenId: "ship-01",
        owner: CARA,
        creator: OPERATOR,
        created: "2026-06-04T10:28:00Z",
        name: "Cabinet Ship",
        description: "Single-frame PixelGrid ship.",
        mimeType: PIXELGRID_MIME,
        encoding: PIXELGRID_ENCODING,
        content: px([
          "00055000",
          "00555500",
          "05533550",
          "55333355",
          "00533500",
          "00233200",
          "02000020",
          "00000000"
        ]),
        renderSchema: PIXELGRID_SCHEMA,
        paletteId: "arcade",
        width: 8,
        height: 8,
        frameCount: 1,
        frameDelayMs: 0,
        pixelEncoding: PIXELGRID_ENCODING,
        royaltyReceiver: OPERATOR,
        royaltyBps: 400,
        likes: 11,
        listing: {
          seller: CARA,
          currencyContract: "currency",
          price: "15",
          reservedFor: ""
        }
      },
      {
        tokenId: "boss-card",
        owner: BOB,
        creator: BOB,
        created: "2026-06-04T10:34:00Z",
        name: "Boss Card",
        description: "Reserved listing example.",
        mimeType: "image/svg+xml",
        encoding: "utf8",
        content: svg("Boss Card", "reserved listing", "#1c0c05", "#fff7ed", "#f97316"),
        royaltyReceiver: BOB,
        royaltyBps: 650,
        likes: 9,
        listing: {
          seller: BOB,
          currencyContract: "currency",
          price: "64.125",
          reservedFor: ALICE
        }
      }
    ]
  }
];

const collectionByContract = new Map(collections.map((collection) => [collection.contract, collection]));
const allEvents = buildEvents();

function buildEvents() {
  const events = [];
  let height = 200;
  for (const collection of collections) {
    for (const token of collection.tokens) {
      events.push(event(collection.contract, "Transfer", height++, {
        from: "",
        to: token.owner,
        token_id: token.tokenId
      }));
      if (token.listing) {
        events.push(event(collection.contract, "TokenListed", height++, {
          token_id: token.tokenId,
          seller: token.listing.seller,
          currency_contract: token.listing.currencyContract,
          price: token.listing.price,
          reserved_for: token.listing.reservedFor
        }));
      }
      if (token.likes > 0) {
        events.push(event(collection.contract, "TokenLiked", height++, {
          token_id: token.tokenId,
          account: token.owner,
          likes: token.likes
        }));
      }
    }
  }

  events.push(event("con_pixel_sneks", "TokenSale", height++, {
    token_id: "snek-002",
    seller: ALICE,
    buyer: BOB,
    currency_contract: "currency",
    price: "24.25",
    royalty_amount: "1.81875"
  }));

  return events.sort((a, b) => b.block_height - a.block_height);
}

function event(contract, name, blockHeight, data) {
  return {
    id: blockHeight,
    contract,
    event: name,
    data,
    tx_hash: `MOCK${String(blockHeight).padStart(6, "0")}`,
    block_height: blockHeight,
    created_at: new Date(Date.UTC(2026, 5, 4, 8, blockHeight % 60, 0)).toISOString()
  };
}

function tokenField(token, field, collection) {
  const base = {
    name: token.name,
    description: token.description,
    mime_type: token.mimeType,
    encoding: token.encoding,
    uri: token.uri || "",
    content: token.content || "",
    creator: token.creator,
    created: token.created,
    content_hash: contentHashFor(token),
    chunk_count: 0,
    content_locked: "true",
    royalty_receiver: token.royaltyReceiver || collection.operator,
    royalty_bps: token.royaltyBps || 0,
    likes: token.likes || 0,
    proof: token.proof || "",
    render_schema: token.renderSchema || "",
    palette_id: token.paletteId || "",
    width: token.width || 0,
    height: token.height || 0,
    frame_count: token.frameCount || 0,
    frame_delay_ms: token.frameDelayMs || 0,
    pixel_encoding: token.pixelEncoding || ""
  };
  return base[field] ?? null;
}

function stateValue(key) {
  const dot = key.indexOf(".");
  if (dot === -1) return null;

  const contractName = key.slice(0, dot);
  const collection = collectionByContract.get(contractName);
  if (!collection) return null;

  const rest = key.slice(dot + 1);
  const [variable, ...keys] = rest.split(":");

  if (variable === "token_count") return String(collection.tokens.length);

  if (variable === "metadata") {
    const values = {
      standard: STANDARD,
      collection_name: collection.name,
      collection_symbol: collection.symbol,
      collection_description: collection.description,
      collection_image: collection.image,
      collection_website: collection.website,
      operator: collection.operator
    };
    return values[keys[0]] ?? null;
  }

  if (variable === "owners") {
    return collection.tokens.find((token) => token.tokenId === keys[0])?.owner || null;
  }

  if (variable === "balances") {
    return String(collection.tokens.filter((token) => token.owner === keys[0]).length);
  }

  if (variable === "token_data") {
    const token = collection.tokens.find((item) => item.tokenId === keys[0]);
    return token ? tokenField(token, keys[1], collection) : null;
  }

  if (variable === "listings") {
    const token = collection.tokens.find((item) => item.tokenId === keys[0]);
    const listing = token?.listing;
    const values = {
      seller: listing?.seller || "",
      currency_contract: listing?.currencyContract || "",
      price: listing?.price || "0",
      reserved_for: listing?.reservedFor || ""
    };
    return values[keys[1]] ?? null;
  }

  if (variable === "palettes") {
    const palette = collection.palettes[keys[0]];
    if (!palette) return null;
    if (keys[1] === "size") return String(palette.colors.length);
    if (keys[1] === "name") return palette.name;
    if (keys[1] === "locked") return String(palette.locked);
    if (keys[1] === "creator") return palette.creator;
    if (keys[1] === "created") return palette.created;
    const index = Number(keys[1]);
    return Number.isInteger(index) ? palette.colors[index] : null;
  }

  if (variable === "approvals") return "";
  if (variable === "operator_approvals") return "false";
  if (variable === "likes") return "false";
  if (variable === "content_chunks") return "";

  return null;
}

function listEvents(path) {
  const match = /^\/events\/([^/]+)\/([^/]+)\/offset=(\d+)\/limit=(\d+)$/.exec(path);
  if (!match) return [];
  const [, contract, name, offsetRaw, limitRaw] = match;
  const offset = Number(offsetRaw);
  const limit = Number(limitRaw);
  return allEvents
    .filter((item) => item.contract === contract && item.event === name)
    .slice(offset, offset + limit);
}

function recentEvents(path) {
  const match = /^\/recent_events\/limit=(\d+)\/offset=(\d+)$/.exec(path);
  const limit = match ? Number(match[1]) : 100;
  const offset = match ? Number(match[2]) : 0;
  return {
    available: true,
    items: allEvents.slice(offset, offset + limit),
    limit,
    offset
  };
}

function queryPath(url) {
  const raw = url.searchParams.get("path") || "";
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
}

function abciPayload(value) {
  return {
    jsonrpc: "2.0",
    id: "",
    result: {
      response: {
        code: 0,
        value: value == null ? "AA==" : Buffer.from(String(value), "utf8").toString("base64")
      }
    }
  };
}

function statePayload(value) {
  if (typeof value === "string") {
    return abciPayload(JSON.stringify(value));
  }
  return abciPayload(value);
}

function jsonPayload(value) {
  return abciPayload(JSON.stringify(value));
}

function simulatePayload(result) {
  return abciPayload(JSON.stringify({ status: 0, result }));
}

function handleAbci(path) {
  if (path.startsWith("/get/")) {
    return statePayload(stateValue(path.slice(5)));
  }
  if (path.startsWith("/events/")) {
    return jsonPayload(listEvents(path));
  }
  if (path.startsWith("/recent_events/")) {
    return jsonPayload(recentEvents(path));
  }
  if (path.startsWith("/simulate_tx/")) {
    return simulatePayload(true);
  }
  return abciPayload(null);
}

function send(res, status, body, contentType = "application/json") {
  res.writeHead(status, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "content-type": contentType
  });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `${HOST}:${PORT}`}`);

  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }

  if (url.pathname === "/status") {
    send(res, 200, { result: { node_info: { network: "mock-xian-nft" } } });
    return;
  }

  if (url.pathname === "/genesis") {
    send(res, 200, { result: { genesis: { chain_id: "mock-xian-nft" } } });
    return;
  }

  if (url.pathname === "/abci_query") {
    send(res, 200, handleAbci(queryPath(url)));
    return;
  }

  send(res, 404, { error: { message: "not found" } });
});

server.listen(PORT, HOST, () => {
  console.log(`Mock Xian NFT RPC ready at http://${HOST}:${PORT}`);
  console.log(`Operator identity: ${OPERATOR}`);
  if (OPERATOR === "0".repeat(64)) {
    console.log(
      "  (set MOCK_OPERATOR=<your wallet address> so the Create / Pixel-grid tabs see collections you operate)"
    );
  }
  console.log("Seeded collections:");
  for (const collection of collections) {
    const owned = collection.operator === OPERATOR ? " — operated by you" : "";
    console.log(
      `- ${collection.contract}: ${collection.name} (${collection.tokens.length} tokens)${owned}`
    );
  }
});
