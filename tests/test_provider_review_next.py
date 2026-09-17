import base64
import hashlib
import pytest
from genlayer_py.abi import calldata
import provider_review_next_flow as flow
from test_studio_next import network, ACCOUNT


def test_config_pins_migrated_baseline_not_unreleased_candidate():
    config = flow.config()
    assert config["chain_id"] == 61997 and config["version"] == 6
    assert config["source_sha256"] == hashlib.sha256(flow.SOURCE.read_bytes()).hexdigest()
    assert config["assessment_categories"] == ["transcription", "speech"]


@pytest.mark.parametrize("op", ["prepare", "config", "capture"])
def test_archive_cannot_prepare_new_transactions(op):
    with pytest.raises(ValueError, match="read-only"):
        flow.legacy.dispatch({"op": op}, lambda *args: pytest.fail("No network"))
    assert not hasattr(flow.legacy, "prepare")


@pytest.mark.parametrize("chain", [None, 61999, 61997])
@pytest.mark.parametrize("op,key", [("receipt", "hash"), ("inspect", "deployment")])
def test_reads_are_explicitly_network_scoped(monkeypatch, chain, op, key):
    body = {"op": op, key: "0x" + "a" * 64}
    if chain is not None: body["chain_id"] = chain
    old, new = object(), object()
    monkeypatch.setattr(flow.legacy, "dispatch", lambda data, read: ("old", read, data))
    monkeypatch.setattr(flow, "receipt", lambda value, read, **kw: ("new", read, kw))
    monkeypatch.setattr(flow.legacy, "inspect", lambda value, read, **kw: ("new", read, kw))
    result = flow.dispatch(body, new, old)
    assert result[0] == ("new" if chain == 61997 else "old")
    assert result[1] is (new if chain == 61997 else old)


@pytest.mark.parametrize("chain", [1, True, "61997", None, 0])
def test_unknown_explicit_network_never_falls_back(chain):
    with pytest.raises(ValueError, match="network"):
        flow.dispatch({"op": "receipt", "hash": "0x" + "a" * 64, "chain_id": chain})


def test_unvalidated_text_candidate_cannot_be_deployed(monkeypatch):
    monkeypatch.setattr(flow, "validate_payload", lambda payload: {"requirements": {"category": "text"}})
    with pytest.raises(ValueError, match="does not assess"):
        flow.prepare({"account": ACCOUNT, "payload": "text"}, lambda *args: pytest.fail("No network"))


def test_next_inspect_requires_source_state_and_execution_identity(network):
    values, read, _ = network
    payload = "saved exact evidence"
    h = "0x" + "a" * 64
    contract = "0x" + "b" * 40
    state = {"version": 6, "kind": "provider-review", "account": ACCOUNT,
        "digest": hashlib.sha256(payload.encode()).hexdigest(), "evidence_json": payload}
    tx = {"hash": h, "status": "FINALIZED", "from_address": ACCOUNT, "to_address": contract,
        "value": 0, "result": 1, "result_name": "MAJORITY_AGREE", "txExecutionResult": 1,
        "txExecutionResultName": "FINISHED_WITH_RETURN", "fees": {"userValue": "0", "deposit": "123"},
        "data": {"contract_code": base64.b64encode(flow.SOURCE.read_bytes()).decode(),
                 "calldata": base64.b64encode(calldata.encode({"args": [payload]})).decode()}}
    values["eth_getTransactionByHash"] = tx
    values["gen_call"] = calldata.encode(state).hex()
    request = {"op": "inspect", "deployment": h, "chain_id": 61997}
    assert flow.dispatch(request, read)["state"] == state
    tx["txExecutionResult"] = 2; tx["txExecutionResultName"] = "FINISHED_WITH_ERROR"
    with pytest.raises(ValueError): flow.dispatch(request, read)
    tx["txExecutionResult"] = 1; tx["txExecutionResultName"] = "FINISHED_WITH_RETURN"
    state["digest"] = "changed"; values["gen_call"] = calldata.encode(state).hex()
    with pytest.raises(ValueError, match="does not match"): flow.dispatch(request, read)
