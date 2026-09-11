"""Run the shipped NFT checker through the optional native VM extension."""

from pathlib import Path

import pytest

pytest.importorskip("xian_vm_core._native")
import xian_vm_core
from contracting.storage.driver import Driver

CONTRACTS = Path(__file__).resolve().parents[1] / "contracts"


@pytest.fixture
def driver(tmp_path):
    driver = Driver(storage_home=tmp_path)
    for name in ("con_xsc005", "con_xsc005_nft"):
        driver.set_contract_from_source(name, (CONTRACTS / f"{name}.py").read_text(), owner=None)
    for key, value in {
        "standard": "XSC-0005",
        "collection_name": "Native test",
        "collection_symbol": "TEST",
        "collection_description": "Checker regression",
    }.items():
        driver.set_var("con_xsc005_nft", "metadata", [key], value)
    driver.set_contract_from_source(
        "con_invalid",
        "metadata = Hash()\n@export\ndef ping():\n    return True",
        owner=None,
    )
    driver.commit()
    yield driver
    driver.flush_full()


def check(driver, contract):
    result = xian_vm_core.execute_contract(
        driver=driver,
        contract_name="con_xsc005",
        function_name="is_XSC005",
        kwargs={"contract": contract},
        context={"signer": "alice", "caller": "alice", "this": "con_xsc005"},
        meter=True,
        chi_budget_raw=120_000 * 100,
    )
    assert result.status_code == 0, result.result
    assert result.writes == {}
    assert result.events == []
    assert result.chi_used > 0
    return result.result


def test_native_checker_accepts_reference_collection(driver):
    assert check(driver, "con_xsc005_nft") is True


def test_native_checker_rejects_invalid_interface(driver):
    assert check(driver, "con_invalid") is False


@pytest.mark.parametrize("field,value", [("standard", "wrong"), ("collection_name", None)])
def test_native_checker_rejects_invalid_metadata(driver, field, value):
    driver.set_var("con_xsc005_nft", "metadata", [field], value)
    driver.commit()
    assert check(driver, "con_xsc005_nft") is False
