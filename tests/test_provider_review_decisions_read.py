import base64
import hashlib
from copy import deepcopy
import pytest
from genlayer_py.abi import calldata
import provider_review_decisions_read as adapter
from experiments.assemble_review_decisions_v20 import CONTRACT
from test_review_decisions_v20 import control, answer, engine
from test_studio_next import network, ACCOUNT


def snapshot(case="q01"):
    payload = control(case); ctx = engine.context(payload)
    answers = [answer(k, case) for k in ctx["schema"]]
    return {"kind": "provider-review-decisions-candidate", "version": 20,
        "release_cleared": False, "protocol_sha256": adapter.PROTOCOL,
        "account": ACCOUNT, "digest": ctx["digest"], "evidence_json": payload,
        "complete": True, "review_status": "completed", "assessment": engine.assemble(ctx, answers)}


def test_projection_preserves_immutable_snapshot():
    state = snapshot(); before = deepcopy(state)
    adapter.validate_snapshot(state, state["evidence_json"], ACCOUNT)
    view = adapter.display_projection(state)
    assert state == before and view["version"] == 20 and state["release_cleared"] is False
    assert view["results"] == state["assessment"]["results"]
    view["results"][0]["citations"][0]["quote"] = "tampered view"
    assert state == before


@pytest.mark.parametrize("key,bad", [("version", 6), ("kind", "provider-review"),
    ("release_cleared", True), ("protocol_sha256", "wrong"), ("account", "other"),
    ("digest", "wrong"), ("complete", False), ("review_status", "partial"),
    ("evidence_json", "changed")])
def test_snapshot_identity_rejects_changes(key, bad):
    state = snapshot(); payload = state["evidence_json"]; state[key] = bad
    with pytest.raises(ValueError, match="snapshot"): adapter.validate_snapshot(state, payload, ACCOUNT)


@pytest.mark.parametrize("change", ["quote", "verdict", "order", "decision", "steps"])
def test_assessment_not_trusted_from_success_alone(change):
    state = snapshot(); rows = state["assessment"]["results"]
    if change == "quote": rows[0]["citations"][0]["quote"] += " invented"
    elif change == "verdict": rows[0]["verdict"] = "INCONCLUSIVE"
    elif change == "order": rows.reverse()
    elif change == "decision": rows[0]["decision"] = "UNKNOWN_ENUM"
    else: rows[0]["documented_steps"] = rows[0]["citations"]
    with pytest.raises(ValueError, match="Assessment"): adapter.validate_snapshot(state, state["evidence_json"], ACCOUNT)


def test_setup_projection_only_quotes_documented_instructions():
    state = snapshot("q03"); ctx = engine.context(state["evidence_json"])
    rows = [answer(k, "q03") for k in ctx["schema"]]
    rows[list(ctx["schema"]).index("training")] = {"decision": "OPT_OUT_REQUIRED_DEFAULT_UNSPECIFIED",
        "reason": "Fixture only", "evidence": ["E1"], "setup": ["E1"]}
    state["assessment"] = engine.assemble(ctx, rows)
    adapter.validate_snapshot(state, state["evidence_json"], ACCOUNT)
    result = next(r for r in adapter.display_projection(state)["results"] if r["id"] == "training")
    assert result["required_actions"] == [result["documented_steps"][0]["quote"]]
    assert result["decision"] == "OPT_OUT_REQUIRED_DEFAULT_UNSPECIFIED"


def test_read_only_adapter_checks_actual_receipt_and_new_selector(network):
    values, read, calls = network
    state = snapshot(); payload = state["evidence_json"]
    h = "0x" + "a" * 64; contract = "0x" + "b" * 40
    tx = {"hash": h, "status": "FINALIZED", "from_address": ACCOUNT, "to_address": contract,
        "value": 0, "result": 1, "result_name": "MAJORITY_AGREE", "txExecutionResult": 1,
        "txExecutionResultName": "FINISHED_WITH_RETURN", "fees": {"userValue": "0", "deposit": "123"},
        "data": {"contract_code": base64.b64encode(CONTRACT.read_bytes()).decode(),
            "calldata": base64.b64encode(calldata.encode({"args": [payload]})).decode()}}
    assert hashlib.sha256(CONTRACT.read_bytes()).hexdigest() == adapter.SOURCE
    values["eth_getTransactionByHash"] = tx
    values["gen_call"] = calldata.encode(state).hex()
    result = adapter.inspect(h, read)
    assert result["state"] == state and result["view"]["results"] == state["assessment"]["results"]
    import provider_review_next_flow
    assert provider_review_next_flow.dispatch({"op": "inspect", "deployment": h,
        "chain_id": 61997}, read)["state"] == state
    assert all(method in ("eth_chainId", "eth_getTransactionByHash", "gen_call") for method, _ in calls)
    assert next(params[0]["data"] for method, params in calls if method == "gen_call") == adapter.network.snapshot_calldata()
    tx["data"]["contract_code"] = base64.b64encode(b"wrong source").decode()
    with pytest.raises(ValueError, match="matching review receipt"): adapter.inspect(h, read)


def test_deployable_schema_is_exact_pinned_pure_subset_without_experiments():
    import ast
    import inspect
    from experiments import provider_review_facts_v19 as inputs
    schema = adapter.engine
    for name in ("canonical", "require", "passages", "context", "evidence_index"):
        assert inspect.getsource(getattr(schema, name)) == inspect.getsource(getattr(inputs, name))
    for name in ("decisions", "read_answer", "resolved", "assemble", "valid_assessment"):
        assert inspect.getsource(getattr(schema, name)) == inspect.getsource(getattr(engine, name))
    assert schema.FIELDS == inputs.FIELDS
    assert schema.TECHNICAL == engine.TECHNICAL and schema.TRAINING == engine.TRAINING
    tree = ast.parse(inspect.getsource(schema))
    assert all(not isinstance(n, ast.ImportFrom) for n in ast.walk(tree))
    assert not any(isinstance(n, ast.Name) and n.id in ("model", "native_audit", "exec_prompt") for n in ast.walk(tree))
