# Scripts

## Purpose

This folder contains the product bootstrap and local development helpers for
`xian-nft`.

## Contents

- `bootstrap_nft.py` — post-genesis bootstrap: deploys the product contracts
  from the hash-pinned bundle onto an existing chain
  (`uv run --group deploy python scripts/bootstrap_nft.py`).
- `mock-rpc.mjs` — mock RPC server for frontend development without a node.
- `verify-localnet.py` — local VM contract integration verification against a
  running localnet.

## Notes

- The bootstrap deploys from [`../contract-bundle.json`](../contract-bundle.json);
  validate the bundle first with
  `uv run --project ../xian-cli xian contract bundle validate contract-bundle.json`.

## Next

- See the root [`README.md`](../README.md) for the full install flow.
