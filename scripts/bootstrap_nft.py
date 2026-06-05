#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from xian_py import Wallet, Xian
from xian_py.models import TransactionSubmission

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS_DIR = ROOT / "contracts"


def _env_str(name: str, default: str) -> str:
    value = os.environ.get(name)
    if value is None:
        return default
    stripped = value.strip()
    return stripped if stripped else default


def _require_wallet() -> Wallet:
    private_key = os.environ.get("XIAN_WALLET_PRIVATE_KEY")
    if not private_key:
        raise RuntimeError("XIAN_WALLET_PRIVATE_KEY is required to bootstrap xian-nft.")
    return Wallet(private_key=private_key)


def _ensure_submission_succeeded(
    submission: TransactionSubmission,
    action: str,
) -> TransactionSubmission:
    if not submission.submitted:
        raise RuntimeError(f"{action} was not submitted: {submission.message}")
    if submission.accepted is False:
        raise RuntimeError(f"{action} was rejected: {submission.message}")
    if not submission.finalized:
        raise RuntimeError(f"{action} was not finalized: {submission.message}")
    if submission.receipt is not None and not submission.receipt.success:
        raise RuntimeError(f"{action} failed: {submission.receipt.message}")
    return submission


def _contract_source(file_name: str) -> str:
    return (CONTRACTS_DIR / file_name).read_text(encoding="utf-8")


def _deploy_if_missing(
    client: Xian,
    *,
    name: str,
    source_file: str,
    args: dict[str, Any] | None,
    chi: int,
) -> dict[str, Any]:
    if client.get_contract_source(name) is not None:
        return {"contract": name, "action": "skipped", "reason": "already_exists"}

    submission = _ensure_submission_succeeded(
        client.deploy_contract(
            name=name,
            source=_contract_source(source_file),
            args=args,
            chi=chi,
            mode="checktx",
            wait_for_tx=True,
        ),
        f"deploy {name}",
    )
    return {"contract": name, "action": "deployed", "tx_hash": submission.tx_hash}


def _build_plan(args: argparse.Namespace, operator_address: str) -> list[dict[str, Any]]:
    plan: list[dict[str, Any]] = [
        {
            "contract": args.checker_contract,
            "source_file": "con_xsc005.py",
            "constructor_args": None,
            "chi": args.checker_chi,
        }
    ]
    if not args.checker_only:
        plan.append(
            {
                "contract": args.collection_contract,
                "source_file": "con_xsc005_nft.py",
                "constructor_args": {
                    "collection_name": args.collection_name,
                    "collection_symbol": args.collection_symbol,
                    "collection_description": args.collection_description,
                    "collection_image": args.collection_image,
                    "collection_website": args.collection_website,
                    "operator_address": operator_address,
                },
                "chi": args.collection_chi,
            }
        )
    return plan


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Deploy the xian-nft XSC-0005 checker and reference collection."
    )
    parser.add_argument(
        "--node-url",
        default=_env_str("XIAN_NODE_URL", "http://127.0.0.1:26657"),
    )
    parser.add_argument("--chain-id", default=os.environ.get("XIAN_CHAIN_ID"))
    parser.add_argument(
        "--checker-contract",
        default=_env_str("XIAN_NFT_CHECKER_CONTRACT", "con_xsc005"),
    )
    parser.add_argument(
        "--collection-contract",
        default=_env_str("XIAN_NFT_COLLECTION_CONTRACT", "con_xsc005_nft"),
    )
    parser.add_argument(
        "--collection-name",
        default=_env_str("XIAN_NFT_COLLECTION_NAME", "PixelSnek Reference"),
    )
    parser.add_argument(
        "--collection-symbol",
        default=_env_str("XIAN_NFT_COLLECTION_SYMBOL", "PSNK"),
    )
    parser.add_argument(
        "--collection-description",
        default=_env_str(
            "XIAN_NFT_COLLECTION_DESCRIPTION",
            "Reference XSC-0005 collection for PixelSnek.",
        ),
    )
    parser.add_argument(
        "--collection-image",
        default=_env_str("XIAN_NFT_COLLECTION_IMAGE", ""),
    )
    parser.add_argument(
        "--collection-website",
        default=_env_str("XIAN_NFT_COLLECTION_WEBSITE", ""),
    )
    parser.add_argument("--checker-chi", type=int, default=120000)
    parser.add_argument("--collection-chi", type=int, default=500000)
    parser.add_argument(
        "--checker-only",
        action="store_true",
        help="deploy only the XSC-0005 checker contract",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the deployment plan without submitting transactions",
    )
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    wallet = None if args.dry_run else _require_wallet()
    operator_address = (
        wallet.public_key if wallet is not None else _env_str("XIAN_NFT_OPERATOR", "<wallet>")
    )
    plan = _build_plan(args, operator_address)
    payload: dict[str, Any] = {
        "product": "nft",
        "node_url": args.node_url,
        "chain_id": args.chain_id,
        "checker_only": args.checker_only,
        "plan": plan,
    }
    if args.dry_run:
        payload["dry_run"] = True
        print(json.dumps(payload, indent=2))
        return

    results = []
    with Xian(args.node_url, chain_id=args.chain_id, wallet=wallet) as client:
        for item in plan:
            results.append(
                _deploy_if_missing(
                    client,
                    name=item["contract"],
                    source_file=item["source_file"],
                    args=item["constructor_args"],
                    chi=item["chi"],
                )
            )
    payload["results"] = results
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
