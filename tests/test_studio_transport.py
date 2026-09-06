"""Offline transport guards; these are not live-network/AI tests."""
import importlib.util
import sys
import time
from types import SimpleNamespace
from pathlib import Path

import pytest
import rlp
from genlayer_py.abi import calldata

LIVE = Path(__file__).resolve().parents[1] / "live"
sys.path.insert(0, str(LIVE))
spec = importlib.util.spec_from_file_location("recall_studio", LIVE / "studio.py")
studio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(studio)


def test_normal_consensus_encoding():
    parts = rlp.decode(studio.inner_payload("evaluate_claim", ["v1"]))
    assert parts[1] == b""
    assert calldata.decode(parts[0]) == {"method": "evaluate_claim", "args": ["v1"]}
    deployment = rlp.decode(studio.inner_payload(None, ["seller"], b"source"))
    assert deployment[0] == b"source" and deployment[2] == b""
    assert calldata.decode(deployment[1]) == {"args": ["seller"]}


@pytest.mark.parametrize("chain,gas", [(4221, 0), (61999, 1)])
def test_refuses_wrong_chain_or_paid_transport(monkeypatch, chain, gas):
    monkeypatch.setattr(studio, "rpc", lambda method, params: hex(chain if method == "eth_chainId" else gas))
    with pytest.raises(RuntimeError):
        studio.checked_abi()


def test_repeated_label_never_broadcasts(monkeypatch):
    monkeypatch.setattr(studio, "checked_abi", lambda: [])
    monkeypatch.setattr(studio, "rpc", lambda *args: pytest.fail("Unexpected RPC"))
    request = {"role": "buyer", "method": "evaluate_claim", "args": ["v1"]}
    report = {"transactions": {"evaluate": {"request": request, "hash": "0x123"}}}
    studio.submit(report, {}, "evaluate", "buyer", "evaluate_claim", ["v1"])
    with pytest.raises(RuntimeError, match="different request"):
        studio.submit(report, {}, "evaluate", "buyer", "evaluate_claim", ["v2"])


def test_missing_keys_never_silently_replaces_existing_run(monkeypatch, tmp_path):
    report = tmp_path / "run.json"
    report.write_text("{}")
    monkeypatch.setattr(studio, "REPORT", report)
    monkeypatch.setattr(studio, "PRIVATE", tmp_path / "private")
    with pytest.raises(RuntimeError, match="lost its accounts"):
        studio.accounts()


def test_development_keys_private_and_stable(monkeypatch, tmp_path):
    monkeypatch.setattr(studio, "REPORT", tmp_path / "run.json")
    monkeypatch.setattr(studio, "PRIVATE", tmp_path / "private")
    first = studio.accounts()
    second = studio.accounts()
    assert {r: k.address for r, k in first.items()} == {r: k.address for r, k in second.items()}
    assert len({k.address for k in first.values()}) == len(studio.ROLES)
    assert ((tmp_path / "private/accounts.json").stat().st_mode & 0o777) == 0o600


@pytest.fixture
def payment_case(monkeypatch):
    keys = {role: SimpleNamespace(address="0x" + str(index + 1) * 40) for index, role in enumerate(studio.ROLES)}
    snap = {"agreement": {"buyer": keys["buyer"].address, "expires_at": time.time() + 1000},
            "claims": [{"id": "c", "status": "VALID", "review_until": time.time() - 20}],
            "permits": [{"id": "p", "claim_id": "c", "status": "RESERVED", "amount_wei": str(2*10**16), "recipient": keys["storage"].address}]}
    monkeypatch.setattr(studio, "read_snapshot", lambda report, keys: snap)
    monkeypatch.setattr(studio, "rpc", lambda *args: hex(10**17))
    return {"transactions": {}}, keys, snap


def test_exact_disposable_payment_allowed(payment_case):
    report, keys, _ = payment_case
    studio.validate_payment(report, keys, "buyer", "execute_purchase", ["p"], 2*10**16)


@pytest.mark.parametrize("mutation", ["recipient", "amount", "review", "claim", "permit", "total", "buyer", "expired"])
def test_unsafe_payment_refused(payment_case, mutation):
    report, keys, snap = payment_case
    if mutation == "recipient": snap["permits"][0]["recipient"] = "0x" + "a" * 40
    if mutation == "amount": snap["permits"][0]["amount_wei"] = "1"
    if mutation == "review": snap["claims"][0]["review_until"] = time.time() + 600
    if mutation == "claim": snap["claims"][0]["status"] = "DISPUTED"
    if mutation == "permit": snap["permits"][0]["status"] = "SCHEDULED"
    if mutation == "total": report["transactions"]["prior"] = {"request": {"value": 10**17}}
    if mutation == "buyer": snap["agreement"]["buyer"] = keys["seller"].address
    if mutation == "expired": snap["agreement"]["expires_at"] = 0
    with pytest.raises(ValueError):
        studio.validate_payment(report, keys, "buyer", "execute_purchase", ["p"], 2*10**16)


def test_agent_cannot_sign_test_payment(payment_case):
    report, keys, _ = payment_case
    with pytest.raises(ValueError):
        studio.validate_payment(report, keys, "agent", "execute_purchase", ["p"], 2*10**16)
