import base64
import hashlib
from copy import deepcopy
import pytest
from genlayer_py.abi import calldata
import provider_review_decisions_read as adapter
from experiments.assemble_review_decisions_v20 import CONTRACT
from test_review_decisions_v20 import control, answer, engine
from test_studio_next import network, ACCOUNT


def snapshot(case="q01", version=20):
    payload = control(case)
    ctx = adapter.engine.context_v26(payload) if version == 26 else engine.context(payload)
    answers = [answer(k, case) for k in ctx["schema"]]
    from experiments import provider_review_decisions_v22, provider_review_decisions_v25, provider_review_decisions_v26
    schema = {20: engine, 22: provider_review_decisions_v22, 25: provider_review_decisions_v25,
              26: provider_review_decisions_v26}[version]
    if version in (25, 26):
        answers = [{k: v for k, v in row.items() if k != "reason"} for row in answers]
    return {"kind": "provider-review-decisions-candidate", "version": version,
        "release_cleared": False, "protocol_sha256": adapter.FORMATS[version][1],
        "account": ACCOUNT, "digest": ctx["digest"], "evidence_json": payload,
        "complete": True, "review_status": "completed", "assessment": schema.assemble(ctx, answers)}


def test_projection_preserves_immutable_snapshot():
    state = snapshot(); before = deepcopy(state)
    adapter.validate_snapshot(state, state["evidence_json"], ACCOUNT)
    view = adapter.display_projection(state)
    assert state == before and view["version"] == 20 and state["release_cleared"] is False
    assert view["results"] == state["assessment"]["results"]
    view["results"][0]["citations"][0]["quote"] = "tampered view"
    assert state == before


def test_known_bad_citation_is_disclosed_without_rewriting_history():
    import json
    from pathlib import Path
    proof = json.loads((Path(__file__).resolve().parents[1] /
        "submission/studio-next-v22-regression-stop-2026-09-17.json").read_text())
    failed = proof["results"][-1]
    state = {"version": 22, "protocol_sha256": failed["protocol_sha256"],
        "digest": failed["evidence_sha256"], "assessment": {"results": failed["findings"]}}
    before = deepcopy(state)
    assert adapter.quality_notice(failed["hash"], state)["code"] == "CONFIRMED_CITATION_ERROR"
    assert state == before
    assert adapter.quality_notice("0x" + "1" * 64, state) is None
    for key, value in (("version", 20), ("digest", "different"), ("protocol_sha256", "different")):
        assert adapter.quality_notice(failed["hash"], {**state, key: value}) is None


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


@pytest.mark.parametrize("version", [20, 22, 25, 26])
def test_read_only_adapter_checks_actual_receipt_and_new_selector(network, version):
    from experiments.assemble_review_decisions_v22 import CONTRACT as V22_CONTRACT
    from experiments.assemble_review_decisions_v25 import CONTRACT as V25_CONTRACT
    from experiments.assemble_review_decisions_v26 import CONTRACT as V26_CONTRACT
    source = {20: CONTRACT, 22: V22_CONTRACT, 25: V25_CONTRACT, 26: V26_CONTRACT}[version]
    values, read, calls = network
    state = snapshot(version=version); payload = state["evidence_json"]
    h = "0x" + "a" * 64; contract = "0x" + "b" * 40
    tx = {"hash": h, "status": "FINALIZED", "from_address": ACCOUNT, "to_address": contract,
        "value": 0, "result": 1, "result_name": "MAJORITY_AGREE", "txExecutionResult": 1,
        "txExecutionResultName": "FINISHED_WITH_RETURN", "fees": {"userValue": "0", "deposit": "123"},
        "data": {"contract_code": base64.b64encode(source.read_bytes()).decode(),
            "calldata": base64.b64encode(calldata.encode({"args": [payload]})).decode()}}
    assert hashlib.sha256(source.read_bytes()).hexdigest() == adapter.FORMATS[version][0]
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
    for name in ("decisions", "resolved"):
        assert inspect.getsource(getattr(schema, name)) == inspect.getsource(getattr(engine, name))
    assert schema.FIELDS == inputs.FIELDS
    assert schema.TECHNICAL == engine.TECHNICAL and schema.TRAINING == engine.TRAINING
    tree = ast.parse(inspect.getsource(schema))
    assert all(not isinstance(n, ast.ImportFrom) for n in ast.walk(tree))
    assert not any(isinstance(n, ast.Name) and n.id in ("model", "native_audit", "exec_prompt") for n in ast.walk(tree))


@pytest.mark.parametrize("version", [20, 22])
def test_versioned_schema_matches_immutable_engine(version):
    from experiments import provider_review_decisions_v22
    original = engine if version == 20 else provider_review_decisions_v22
    schema = adapter.engine
    ctx = original.context(control("q03"))
    for key in ctx["schema"]:
        for decision, verdict in original.decisions(key).items():
            for length in (1, 600, 601, 1200, 1201):
                row = {"decision": decision, "reason": "x" * length,
                    "evidence": [] if decision == "INSUFFICIENT_EVIDENCE" else ["E1"],
                    "setup": ["E1"] if verdict == "CONDITIONAL" else []}
                try:
                    expected = original.read_answer(row, ctx, key)
                except ValueError:
                    with pytest.raises(ValueError): schema.read_answer(row, ctx, key, version)
                else:
                    assert schema.read_answer(row, ctx, key, version) == expected
    rows = [answer(k, "q03") for k in ctx["schema"]]
    expected = original.assemble(ctx, rows)
    assert schema.assemble(ctx, rows, version) == expected
    assert schema.valid_assessment(ctx, expected, version)
    for mutate in (
        lambda s: s.update(schema_version=21),
        lambda s: s.update(release_cleared=True),
        lambda s: s["results"][0].update(reason="x" * 1201),
        lambda s: s["results"][0].update(citations=[]),
        lambda s: s["results"].reverse(),
    ):
        changed = deepcopy(expected); mutate(changed)
        assert schema.valid_assessment(ctx, changed, version) == original.valid_assessment(ctx, changed)
        assert not schema.valid_assessment(ctx, changed, version)


def test_v22_cannot_be_mislabeled_as_v20_or_enable_writer():
    state = snapshot(version=22); payload = state["evidence_json"]
    adapter.validate_snapshot(state, payload, ACCOUNT, 22)
    assert adapter.display_projection(state)["version"] == 22
    with pytest.raises(ValueError): adapter.validate_snapshot(state, payload, ACCOUNT, 20)
    state["protocol_sha256"] = adapter.PROTOCOL
    with pytest.raises(ValueError): adapter.validate_snapshot(state, payload, ACCOUNT, 22)
    import provider_review_next_flow
    assert provider_review_next_flow.config()["assessment_categories"] == ["transcription", "speech", "text"]


def test_v25_fixed_summary_schema_parity_for_every_decision():
    from experiments import provider_review_decisions_v25 as original
    schema = adapter.engine
    assert schema.SUMMARIES == original.SUMMARIES
    ctx = original.context(control("q03"))
    for key in ctx["schema"]:
        for decision, verdict in original.decisions(key).items():
            row = {"decision": decision,
                "evidence": [] if decision == "INSUFFICIENT_EVIDENCE" else ["E1"],
                "setup": ["E1"] if verdict == "CONDITIONAL" else []}
            assert schema.read_answer(row, ctx, key, 25) == original.read_answer(row, ctx, key)
            with pytest.raises(ValueError):
                schema.read_answer({**row, "reason": "invented"}, ctx, key, 25)
    state = snapshot(version=25)
    assert adapter.validate_snapshot(state, state["evidence_json"], ACCOUNT, 25) == state
    assert schema.valid_assessment(ctx, snapshot("q03", 25)["assessment"], 25)
    for mutate in (
        lambda s: s["assessment"]["results"][0].update(reason="Invented factual claim"),
        lambda s: s["assessment"]["results"][0]["citations"][0].update(quote="wrong"),
        lambda s: s.update(protocol_sha256=adapter.FORMATS[22][1]),
        lambda s: s.update(version=22),
        lambda s: s["assessment"].update(schema_version=22),
    ):
        changed = deepcopy(state); mutate(changed)
        with pytest.raises(ValueError):
            adapter.validate_snapshot(changed, state["evidence_json"], ACCOUNT, 25)
    import provider_review_next_flow
    assert provider_review_next_flow.config()["assessment_categories"] == ["transcription", "speech", "text"]


def test_v26_read_only_schema_matches_immutable_candidate_without_enabling_writer():
    from experiments import provider_review_decisions_v26 as original
    from live import decisions_v25_regression_next as saved
    import inspect
    payload = saved.bundle("q18")[0]
    ctx = adapter.engine.context_v26(payload)
    assert ctx == original.context(payload)
    assert inspect.getsource(adapter.engine.passages_v26).split("    result, start = {}, 0", 1)[1] == (
        inspect.getsource(original.passages_v26).split("    result, start = {}, 0", 1)[1])
    state = snapshot(version=26)
    assert adapter.validate_snapshot(state, state["evidence_json"], ACCOUNT, 26) == state
    assert adapter.display_projection(state)["results"] == state["assessment"]["results"]
    for mutate in (
        lambda s: s["assessment"]["results"][0].update(reason="Invented claim"),
        lambda s: s["assessment"]["results"][0]["citations"][0].update(quote="wrong"),
        lambda s: s.update(protocol_sha256=adapter.FORMATS[25][1]),
        lambda s: s.update(version=25),
        lambda s: s["assessment"].update(schema_version=25),
    ):
        changed = deepcopy(state); mutate(changed)
        with pytest.raises(ValueError):
            adapter.validate_snapshot(changed, state["evidence_json"], ACCOUNT, 26)
    import provider_review_next_flow
    assert provider_review_next_flow.config()["assessment_categories"] == ["transcription", "speech", "text"]
