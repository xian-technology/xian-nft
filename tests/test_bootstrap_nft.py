import importlib.util
import json
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bootstrap_nft", ROOT / "scripts/bootstrap_nft.py")
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)


@pytest.fixture
def bundle_copy(tmp_path):
    shutil.copy(ROOT / "contract-bundle.json", tmp_path / "contract-bundle.json")
    shutil.copytree(ROOT / "contracts", tmp_path / "contracts")
    return tmp_path / "contract-bundle.json"


def test_plan_uses_bundle_sources_order_and_defaults(bundle_copy):
    manifest = json.loads(bundle_copy.read_text())
    manifest["contracts"][1]["deploy_order"] = 1
    manifest["contracts"][1]["default_chi"] = 123456
    bundle_copy.write_text(json.dumps(manifest))
    args = bootstrap._build_parser().parse_args(["--bundle", str(bundle_copy)])
    plan = bootstrap._build_plan(args, "operator")
    assert [item["contract"] for item in plan] == ["con_xsc005_nft", "con_xsc005"]
    assert plan[0]["chi"] == 123456
    assert plan[0]["constructor_args"]["operator_address"] == "operator"
    assert plan[0]["source"] == (bundle_copy.parent / plan[0]["source_file"]).read_text()


def test_checker_recipe_and_overrides(bundle_copy):
    args = bootstrap._build_parser().parse_args(
        [
            "--bundle",
            str(bundle_copy),
            "--checker-only",
            "--checker-contract",
            "con_custom",
            "--checker-chi",
            "777",
        ]
    )
    plan = bootstrap._build_plan(args, "operator")
    assert len(plan) == 1
    assert plan[0]["contract"] == "con_custom"
    assert plan[0]["chi"] == 777


@pytest.mark.parametrize("damage", ["hash", "missing_role"])
def test_invalid_bundle_fails_before_client_creation(bundle_copy, monkeypatch, damage):
    manifest = json.loads(bundle_copy.read_text())
    if damage == "hash":
        source = bundle_copy.parent / manifest["contracts"][-1]["path"]
        source.write_text(source.read_text() + "\n# changed\n")
    else:
        manifest["contracts"].pop()
        bundle_copy.write_text(json.dumps(manifest))
    monkeypatch.setattr(sys, "argv", ["bootstrap", "--bundle", str(bundle_copy)])
    monkeypatch.setattr(
        bootstrap, "_require_wallet", lambda: SimpleNamespace(public_key="operator")
    )

    def forbidden_client(*args, **kwargs):
        pytest.fail("must validate all sources before connecting")

    monkeypatch.setattr(bootstrap, "Xian", forbidden_client)
    with pytest.raises(ValueError, match="sha256 mismatch|missing roles"):
        bootstrap.main()


def test_deploy_uses_exact_validated_source_and_skips_existing(bundle_copy):
    args = bootstrap._build_parser().parse_args(["--bundle", str(bundle_copy), "--checker-only"])
    item = bootstrap._build_plan(args, "operator")[0]
    (bundle_copy.parent / item["source_file"]).write_text("changed after planning")
    sent = []
    client = SimpleNamespace(
        get_contract_source=lambda name: None,
        deploy_contract=lambda **kwargs: (
            sent.append(kwargs)
            or SimpleNamespace(
                submitted=True, accepted=True, finalized=True, receipt=None, tx_hash="test"
            )
        ),
    )
    kwargs = dict(
        name=item["contract"], source=item["source"], args=item["constructor_args"], chi=item["chi"]
    )
    assert bootstrap._deploy_if_missing(client, **kwargs)["action"] == "deployed"
    assert sent[0]["source"] == item["source"]
    assert sent[0]["wait_for_tx"] is True
    client.get_contract_source = lambda name: "exists"
    assert bootstrap._deploy_if_missing(client, **kwargs)["action"] == "skipped"
    assert len(sent) == 1


def test_hybrid_bootstrap_preserves_original_owner(tmp_path, monkeypatch):
    from xian_py.hybrid import AccountTransitionDraft
    from xian_py.wallet import Wallet

    legacy = Wallet()
    draft = AccountTransitionDraft("local-test", legacy.public_key, 0)
    path = tmp_path / "active.json"
    path.write_text(draft.export_backup("active", "backup test password"))
    monkeypatch.setenv("XIAN_ACTIVE_BACKUP_FILE", str(path))
    monkeypatch.setenv("XIAN_BACKUP_PASSWORD", "backup test password")
    monkeypatch.setenv("XIAN_CHAIN_ID", "local-test")
    monkeypatch.delenv("XIAN_WALLET_PRIVATE_KEY", raising=False)
    assert bootstrap._require_wallet().public_key == legacy.public_key
    monkeypatch.setenv("XIAN_WALLET_PRIVATE_KEY", legacy.private_key)
    with pytest.raises(ValueError, match="exactly one"):
        bootstrap._require_wallet()
