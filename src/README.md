# src

## Purpose

This folder contains the PixelSnek marketplace frontend (Vite + React +
TypeScript + Tailwind + daisyUI).

## Contents

- `routes/` — one file per page (Home, Collections, CollectionDetail, Token,
  Create, Profile, Activity, …).
- `components/` — reusable UI: Hover3DCard, NFTMedia, dialogs, Header, ….
- `hooks/` — `useWallet`, `useToasts`, `useCollection(s)`, `useToken`,
  `useProfile`.
- `lib/` — service layer:
  - `xian.ts` — RPC client and epoch invalidation.
  - `wallet.ts` — injected wallet wrapper (`xian_sendCall` etc.).
  - `nft.ts` — full XSC-0005 surface (reads + writes).
  - `pixelgrid.ts` — PixelGrid palette / frame encoding and canvas decoding.
  - `tokens.ts`, `collections.ts`, `activity.ts` — token discovery,
    collection registry and auto-discovery, event-feed aggregation.
  - `content.ts`, `decimal.ts`, `format.ts`, `hash.ts`, `urls.ts`,
    `verify.ts`, `rpc.ts`, `constants.ts` — media rendering, string-decimal
    price pipeline, formatting, hashing/chunking, URL safety, on-chain
    verification, indexer helpers, and configuration.
- `styles/app.css` — Tailwind + daisyUI theme ("snek") and utilities.

## Notes

- Keep all listing prices on the string-decimal helpers in `decimal.ts`;
  JS `Number` rounding on prices is a correctness bug.
- Indexer reads must degrade gracefully — every core flow needs a raw-state
  fallback path.

## Next

- Start with `routes/` for a page, then follow its hooks into `lib/`.
