#!/usr/bin/env python3
"""
End-to-end verification of PixelSnek's contract integration against the
reference XSC-0005 contract.

This script exercises the same `kwargs` payloads the website sends through
the injected wallet — mint, mint_pixel_grid, list_for_sale, approve+buy,
transfer, like, prove_ownership, set_approval_for_all, change_metadata —
and asserts the on-chain state matches what the UI would render. It uses
`contracting.local.ContractingClient`, which is the same VM `xian-stack`
runs inside its node containers, so this is a real protocol round-trip.

Run from the repo root:

    uv run --group dev python scripts/verify-localnet.py

Exits non-zero on the first failed assertion.
"""

from __future__ import annotations

import hashlib
import sys
from decimal import Decimal
from pathlib import Path

from contracting.local import ContractingClient

XIAN_ROOT = Path(__file__).resolve().parents[2]
XSC005_DIR = Path(__file__).resolve().parents[1] / "contracts"

PAYMENT_TOKEN_SRC = """
# Minimal XSC-001-style payment token. Critically, this matches the real
# Xian `currency` contract in accepting decimal amounts as either numbers
# OR strings — the website now sends strings to preserve precision.
ZERO = decimal("0")

balances = Hash(default_value=ZERO)
approvals = Hash(default_value=ZERO)

def to_dec(value):
    if isinstance(value, str):
        return decimal(value)
    return decimal(str(value))

@construct
def seed():
    balances[ctx.caller] = decimal("1000000")

@export
def transfer(amount: Any, to: str):
    amount = to_dec(amount)
    assert amount > ZERO
    assert balances[ctx.caller] >= amount
    balances[ctx.caller] -= amount
    balances[to] += amount

@export
def approve(amount: Any, to: str):
    amount = to_dec(amount)
    assert amount >= ZERO
    approvals[ctx.caller, to] = amount

@export
def transfer_from(amount: Any, to: str, main_account: str):
    amount = to_dec(amount)
    assert amount > ZERO
    assert approvals[main_account, ctx.caller] >= amount
    assert balances[main_account] >= amount
    approvals[main_account, ctx.caller] -= amount
    balances[main_account] -= amount
    balances[to] += amount

@export
def balance_of(address: str):
    return balances[address]
"""

ALICE = "a" * 64
BOB = "b" * 64
OPERATOR = "sys"

PIXEL_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-"
PIXELGRID_SCHEMA = "xian.pixelgrid.v1"


def ok(label: str) -> None:
    print(f"  ✓ {label}")


def fail(label: str, msg: str) -> None:
    print(f"  ✗ {label}: {msg}")
    sys.exit(1)


def main() -> None:
    print("Setting up VM…")
    client = ContractingClient()
    client.flush()
    client.submit(PAYMENT_TOKEN_SRC, name="currency")
    with (XSC005_DIR / "con_xsc005.py").open() as f:
        client.submit(f.read(), name="con_xsc005")
    with (XSC005_DIR / "con_xsc005_nft.py").open() as f:
        client.submit(
            f.read(),
            name="con_xsc005_nft",
            constructor_args={
                "collection_name": "PixelSnek E2E",
                "collection_symbol": "PSE",
                "collection_description": "End-to-end verification collection",
            },
        )
    nft = client.get_contract_proxy("con_xsc005_nft")
    checker = client.get_contract_proxy("con_xsc005")
    currency = client.get_contract_proxy("currency")
    print("VM ready.\n")

    # 0. XSC-005 checker
    print("Phase 0: standard compliance")
    if not checker.is_XSC005(contract="con_xsc005_nft", signer=OPERATOR):
        fail("is_XSC005", "reference contract failed the checker")
    ok("reference contract passes `is_XSC005`")

    # 1. Inline mint (same kwargs the UI sends)
    print("\nPhase 1: inline mint")
    content = "<svg><rect width='1' height='1' fill='#ff00aa'/></svg>"
    nft.mint(
        token_id="genesis",
        to=ALICE,
        name="Genesis",
        description="The first one.",
        mime_type="image/svg+xml",
        encoding="utf8",
        content=content,
        content_hash="",
        uri="",
        royalty_receiver=ALICE,
        royalty_bps=500,
        signer=OPERATOR,
    )
    metadata = nft.token_metadata(token_id="genesis")
    if metadata["owner"] != ALICE:
        fail("owner_of(genesis)", f"got {metadata['owner']!r}")
    if metadata["content_hash"] != hashlib.sha256(content.encode()).hexdigest():
        fail("content_hash(genesis)", "did not match SHA-256 of content")
    ok("inline mint stored content + correct hash + owner")

    # 2. Pixel-grid mint (same kwargs the new UI tab sends)
    print("\nPhase 2: pixel-grid mint")
    nft.create_palette(
        palette_id="snek",
        colors=["transparent", "#0d0d0d", "#ff00aa", "#00ffff"],
        name="Snek default",
        locked=True,
        signer=OPERATOR,
    )
    pixels = "0123" * 4
    nft.mint_pixel_grid(
        token_id="grid-1",
        to=ALICE,
        name="Snek Grid",
        palette_id="snek",
        width=4,
        height=2,
        frame_count=2,
        frame_delay_ms=120,
        pixels=pixels,
        description="",
        royalty_receiver=ALICE,
        royalty_bps=500,
        signer=OPERATOR,
    )
    pg = nft.pixel_grid_info(token_id="grid-1")
    if pg["render_schema"] != PIXELGRID_SCHEMA:
        fail("render_schema", f"got {pg['render_schema']!r}")
    if pg["width"] != 4 or pg["height"] != 2 or pg["frame_count"] != 2:
        fail("pixel grid dims", str(pg))
    # The contract hash must equal the source the website builds, too.
    expected_hash_source = f"xian.pixelgrid.v1:snek:4:2:2:120:{pixels}"
    expected_hash = hashlib.sha256(expected_hash_source.encode()).hexdigest()
    if pg["content_hash"] != expected_hash:
        fail("pixel grid content_hash", f"got {pg['content_hash']!r}")
    # Decode every pixel char with the same alphabet the website uses.
    for ch in pixels:
        if ch not in PIXEL_ALPHABET:
            fail("pixel encoding", f"invalid char {ch!r}")
    ok("pixel-grid mint stored palette + render schema + matching hash")

    # 3. List for sale with a HIGH-PRECISION decimal string price
    print("\nPhase 3: list + buy with high-precision price")
    precise_price = "12.500000000000000001"
    nft.list_for_sale(
        token_id="genesis",
        currency_contract="currency",
        price=precise_price,
        reserved_for="",
        signer=ALICE,
    )
    listing = nft.listing_info(token_id="genesis")
    if Decimal(str(listing["price"])) != Decimal(precise_price):
        fail("listing price", f"got {listing['price']!r}, expected {precise_price!r}")
    ok("listing preserves high-precision decimal price")

    # Bob funds himself, approves the collection, buys.
    currency.transfer(amount=100, to=BOB, signer=OPERATOR)
    currency.approve(amount=precise_price, to="con_xsc005_nft", signer=BOB)
    nft.buy(token_id="genesis", signer=BOB)
    if nft.owner_of(token_id="genesis") != BOB:
        fail("buy", "owner did not change to bob")
    bob_balance = currency.balance_of(address=BOB)
    expected_bob = Decimal(100) - Decimal(precise_price)
    if Decimal(str(bob_balance)) != expected_bob:
        fail(
            "buyer currency balance",
            f"got {bob_balance!r}, expected {expected_bob!r}",
        )
    ok("approve+buy moved the token AND used the exact precise amount")

    # 4. Transfer (post-buy) — Bob to Alice
    print("\nPhase 4: transfer / approvals / set_approval_for_all")
    nft.transfer(token_id="genesis", to=ALICE, signer=BOB)
    if nft.owner_of(token_id="genesis") != ALICE:
        fail("transfer back to alice", "owner did not change")
    ok("transfer round-trip works")

    # 5. Per-token approve / revoke
    nft.approve(token_id="genesis", to=BOB, signer=ALICE)
    if nft.get_approved(token_id="genesis") != BOB:
        fail("approve", "approval not recorded")
    nft.revoke(token_id="genesis", signer=ALICE)
    if nft.get_approved(token_id="genesis"):
        fail("revoke", "approval not cleared")
    ok("per-token approve + revoke")

    # 6. set_approval_for_all + transfer_from
    nft.set_approval_for_all(operator=BOB, approved=True, signer=ALICE)
    if not nft.is_approved_for_all(owner=ALICE, operator=BOB):
        fail("set_approval_for_all", "operator approval not stored")
    nft.transfer_from(
        token_id="genesis", to=BOB, main_account=ALICE, signer=BOB
    )
    if nft.owner_of(token_id="genesis") != BOB:
        fail("operator transfer_from", "owner did not change to bob")
    ok("operator approval + transfer_from")

    # 7. Like + prove_ownership
    print("\nPhase 5: like / prove_ownership / collection admin")
    nft.like(token_id="grid-1", signer=ALICE)
    nft.like(token_id="grid-1", signer=BOB)
    grid_meta = nft.token_metadata(token_id="grid-1")
    if grid_meta["likes"] != 2:
        fail("likes counter", f"got {grid_meta['likes']!r}")
    ok("likes counter updates")
    nft.prove_ownership(
        token_id="grid-1",
        proof="signed:alice-says-hello",
        signer=ALICE,
    )
    grid_meta = nft.token_metadata(token_id="grid-1")
    if grid_meta["proof"] != "signed:alice-says-hello":
        fail("prove_ownership", "proof not stored")
    ok("prove_ownership writes proof field")

    # 8. Operator admin
    nft.change_metadata(
        key="collection_name", value="PixelSnek E2E ✦", signer=OPERATOR
    )
    new_name = client.get_var(
        contract="con_xsc005_nft", variable="metadata", arguments=["collection_name"]
    )
    if new_name != "PixelSnek E2E ✦":
        fail("change_metadata", f"got {new_name!r}")
    ok("change_metadata updates collection name")
    new_operator = "z" * 64
    nft.change_operator(new_operator=new_operator, signer=OPERATOR)
    operator = client.get_var(contract="con_xsc005_nft", variable="collection_operator")
    if operator != new_operator:
        fail("change_operator", f"got {operator!r}")
    ok("change_operator hands off the role")

    print("\nAll phases passed. PixelSnek's contract surface is fully covered.")


if __name__ == "__main__":
    try:
        main()
    finally:
        # Clean up so subsequent runs start from scratch.
        ContractingClient().flush()
