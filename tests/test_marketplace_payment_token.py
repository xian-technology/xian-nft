from pathlib import Path

import pytest
from contracting.local import ContractingClient

ROOT = Path(__file__).resolve().parents[1]
NFT_SOURCE = (ROOT / "contracts" / "con_xsc005_nft.py").read_text(encoding="utf-8")

PAYMENT_TOKEN_SOURCE = """
balances = Hash(default_value=0)
approvals = Hash(default_value=0)

@construct
def seed():
    balances[ctx.caller] = 1000000

@export
def transfer(amount: Any, to: str):
    assert amount > 0
    assert balances[ctx.caller] >= amount
    balances[ctx.caller] -= amount
    balances[to] += amount

@export
def approve(amount: Any, to: str):
    assert amount >= 0
    approvals[ctx.caller, to] = amount

@export
def transfer_from(amount: Any, to: str, main_account: str):
    assert amount > 0
    assert approvals[main_account, ctx.caller] >= amount
    assert balances[main_account] >= amount
    approvals[main_account, ctx.caller] -= amount
    balances[main_account] -= amount
    balances[to] += amount

@export
def balance_of(address: str):
    return balances[address]
"""

NOOP_PAYMENT_TOKEN_SOURCE = """
@construct
def seed():
    pass

@export
def transfer_from(amount: Any, to: str, main_account: str):
    return True
"""


@pytest.fixture
def marketplace(tmp_path):
    storage_home = tmp_path / "xian"
    storage_home.mkdir()
    client = ContractingClient(storage_home=storage_home)
    client.flush()
    client.submit(PAYMENT_TOKEN_SOURCE, name="currency")
    client.submit(NOOP_PAYMENT_TOKEN_SOURCE, name="con_noop_money")
    client.submit(NFT_SOURCE, name="con_xsc005_nft")
    nft = client.get_contract_proxy("con_xsc005_nft")
    nft.mint(token_id="one", to="alice", name="One", signer="sys")
    return client, nft, client.get_contract_proxy("currency")


def test_deployment_fails_closed_without_seeded_currency(tmp_path):
    storage_home = tmp_path / "missing-currency"
    storage_home.mkdir()
    client = ContractingClient(storage_home=storage_home)
    client.flush()

    with pytest.raises(AssertionError, match="Seeded marketplace payment token does not exist"):
        client.submit(NFT_SOURCE, name="con_xsc005_nft")


def test_noop_payment_token_cannot_list_or_buy(marketplace):
    _, nft, _ = marketplace
    assert nft.payment_token_contract() == "currency"

    with pytest.raises(AssertionError, match="Unsupported marketplace payment token"):
        nft.list_for_sale(
            token_id="one",
            currency_contract="con_noop_money",
            price=100,
            signer="alice",
        )

    assert nft.owner_of(token_id="one") == "alice"
    assert nft.listing_info(token_id="one")["seller"] == ""


def test_seeded_currency_settles_marketplace_purchase(marketplace):
    _, nft, currency = marketplace
    currency.transfer(amount=100, to="bob", signer="sys")
    nft.list_for_sale(
        token_id="one",
        currency_contract="currency",
        price=25,
        signer="alice",
    )
    currency.approve(amount=25, to="con_xsc005_nft", signer="bob")

    nft.buy(token_id="one", signer="bob")

    assert nft.owner_of(token_id="one") == "bob"
    assert currency.balance_of(address="bob") == 75
    assert currency.balance_of(address="alice") == 25
