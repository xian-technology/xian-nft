# Contracts

## Purpose

This folder contains the on-chain contract surface of the NFT product.

## Contents

- `con_xsc005.py` — XSC-0005 interface checker; collections are registered
  and verified through `is_XSC005`.
- `con_xsc005_nft.py` — reference collection and marketplace contract:
  minting, listing, buying, royalties, approvals, likes, ownership proofs,
  chunked content, and PixelGrid support.

## Notes

- The deployable payload is the hash-pinned [`../contract-bundle.json`](../contract-bundle.json);
  changing a contract here requires regenerating the bundle hashes in the
  same change.
- The XSC-0005 standard itself is specified in the sibling `xian-xips` repo;
  keep the reference implementation aligned with that spec.

## Next

- Deploy through [`../scripts/bootstrap_nft.py`](../scripts/README.md).
