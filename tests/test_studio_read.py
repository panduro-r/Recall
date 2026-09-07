"""Offline public-RPC fixtures; never reads keys or contacts Studio."""
import base64
from copy import deepcopy
import hashlib
import json

import pytest
from genlayer_py.abi import calldata

from server import recorded_run
from studio_read import CONTRACT, METHODS, MAX_RESPONSE, observe, rpc


@pytest.fixture
def network():
    report = deepcopy(recorded_run()["report"])
    report["source_sha256"] = hashlib.sha256(b"public test source").hexdigest()
    state = report["final_state"]
    txs = {}
    deploy = next(s["transaction_hash"] for s in report["steps"] if s["step"] == "deploy")
    txs[deploy] = {"hash": deploy, "status": "FINALIZED", "data": {
        "contract_code": base64.b64encode(b"public test source").decode()}}
    balances = {state["agreement"]["buyer"]: hex(int(report["final_balances"]["buyer"])), CONTRACT: "0x0"}
    for role, child in zip(("storage", "monitoring", "inference"), report["independent_verification"]["child_transfers"]):
        txs[child["hash"]] = deepcopy(child)
        txs[child["triggered_by"]] = {"hash": child["triggered_by"], "status": "FINALIZED",
            "from_address": state["agreement"]["buyer"], "to_address": CONTRACT,
            "value": child["value"], "triggered_transactions": [child["hash"]]}
        balances[child["to_address"]] = hex(int(report["final_balances"][role]))
    calls = []

    def read(method, params):
        calls.append((method, params))
        assert method in METHODS
        if method == "eth_chainId":
            return hex(61999)
        if method == "gen_call":
            assert params[0]["to"] == CONTRACT
            assert params[0]["transaction_hash_variant"] == "latest-final"
            return calldata.encode(state).hex()
        if method == "eth_getBalance":
            assert params[1] == "latest"
            return balances[params[0]]
        return txs[params[0]]

    return report, read, txs, balances, calls


def test_complete_match(network):
    report, read, _, _, calls = network
    result = observe(report, read)
    assert result["status"] == "matched"
    assert len(result["checks"]) == 11
    assert len(calls) == 14
    assert all(row["status"] == "matched" for row in result["checks"])
    assert result["observed_at"] >= result["started_at"]


@pytest.mark.parametrize("field,value", [("value", 1), ("status", "PENDING"),
    ("triggered_by", "0xwrong"), ("from_address", "0xwrong"), ("to_address", "0xwrong"), ("hash", "0xwrong")])
def test_child_receipt_mismatch(network, field, value):
    report, read, txs, _, _ = network
    child = report["independent_verification"]["child_transfers"][0]
    txs[child["hash"]][field] = value
    result = observe(report, read)
    assert result["status"] == "mismatch"
    assert next(row for row in result["checks"] if row["label"] == "Storage payment receipt")["status"] == "mismatch"


@pytest.mark.parametrize("field,value", [("value", 1), ("status", "PENDING"),
    ("triggered_transactions", []), ("from_address", "0xwrong"), ("to_address", "0xwrong")])
def test_parent_receipt_mismatch(network, field, value):
    report, read, txs, _, _ = network
    txs[report["independent_verification"]["child_transfers"][0]["triggered_by"]][field] = value
    assert observe(report, read)["status"] == "mismatch"


def test_balance_difference_preserves_exact_wei(network):
    report, read, _, balances, _ = network
    balances[report["final_state"]["agreement"]["buyer"]] = hex(20000000000000001)
    result = observe(report, read)
    assert result["status"] == "mismatch"
    assert "20000000000000001 wei" in next(row for row in result["checks"] if row["label"] == "Buyer balance")["detail"]


def test_snapshot_difference(network):
    report, read, _, _, _ = network
    changed = deepcopy(report["final_state"])
    changed["agreement"]["accepted"] = False
    result = observe(report, lambda m, p: calldata.encode(changed).hex() if m == "gen_call" else read(m, p))
    assert result["status"] == "mismatch"


@pytest.mark.parametrize("bad", [None, "not-hex", {"error": "failed"}])
def test_partial_unavailable_not_match(network, bad):
    report, read, _, _, _ = network
    result = observe(report, lambda m, p: bad if m == "gen_call" else read(m, p))
    assert result["status"] == "unavailable"
    assert len(result["checks"]) == 11


def test_wrong_chain_stops_reads(network):
    report, _, _, _, _ = network
    calls = []
    def wrong(method, params):
        calls.append(method)
        return "0x1"
    assert observe(report, wrong)["status"] == "mismatch"
    assert calls == ["eth_chainId"]


def test_timeout_not_match(network):
    def offline(*_):
        raise TimeoutError()
    result = observe(network[0], offline)
    assert result["status"] == "unavailable"
    assert len(result["checks"]) == 1


def test_reject_other_deployment(network):
    network[0]["contract"] = "0xother"
    with pytest.raises(ValueError):
        observe(network[0], network[1])
    assert not network[-1]


def test_rpc_rejects_write_before_connection():
    with pytest.raises(ValueError, match="Read-only"):
        rpc("eth_sendRawTransaction", [])


@pytest.mark.parametrize("status,body", [(302, b"{}"), (200, b"x" * (MAX_RESPONSE + 1)),
    (200, b"invalid"), (200, b'{"id":1,"error":{"message":"no"}}'), (200, b'{"id":2,"result":true}')])
def test_transport_rejects_unusable_response(monkeypatch, status, body):
    class Connection:
        closed = False
        def __init__(self, host, timeout):
            assert host == "studio.genlayer.com" and timeout == 5
        def request(self, method, path, payload, headers):
            assert method == "POST" and path == "/api"
            assert json.loads(payload)["method"] == "eth_chainId"
        def getresponse(self):
            return self
        def read(self, limit):
            assert limit == MAX_RESPONSE + 1
            return body
        def close(self):
            Connection.closed = True
    Connection.status = status
    monkeypatch.setattr("studio_read.http.client.HTTPSConnection", Connection)
    with pytest.raises(ValueError):
        rpc("eth_chainId", [])
    assert Connection.closed
