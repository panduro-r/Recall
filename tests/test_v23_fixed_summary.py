"""Portable regression: deterministic output only, no SDK/network/semantic claim."""
import ast
import hashlib
import json
from pathlib import Path
import pytest

SOURCE = Path(__file__).resolve().parents[1] / "experiments/contracts/provider_review_decisions_v23.py"


def core():
    tree = ast.parse(SOURCE.read_text())
    tree.body = [node for node in tree.body if not isinstance(node, ast.ClassDef)
        and not (isinstance(node, ast.Import) and any(alias.name == "genlayer" for alias in node.names))
        and not (isinstance(node, ast.ImportFrom) and node.module.startswith("genlayer"))]
    scope = {}
    exec(compile(tree, str(SOURCE), "exec"), scope)
    return scope


def context(e):
    text = "Synthetic fixture, not a provider claim. The hosted API takes text input and generates text output. No training policy is documented."
    payload = json.dumps({"version": 1, "plan": {"category": "text", "name": "Synthetic", "plan": "Standard", "unit": "token"},
        "requirements": {"category": "text", "budget": 50, "noTraining": True, "inputTokens": 1000, "outputTokens": 1000, "streaming": False},
        "documents": [{"id": "source", "text": text, "textSha256": hashlib.sha256(text.encode()).hexdigest(), "status": "retrieved", "complete": True}]})
    return e["context"](payload)


def test_exact_candidate_pin_and_three_field_model_contract():
    assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == "9870f5aa62eea5f1cdf08c35210a233f2d76b87262afaf25c3d8907afd2b3790"
    e = core(); ctx = context(e)
    row = {"decision": "DOCUMENTED", "evidence": ["E1"], "setup": []}
    assert e["read_answer"](row, ctx, "text_api") == row
    with pytest.raises(ValueError):
        e["read_answer"]({**row, "reason": "Invented claim about a neighboring table."}, ctx, "text_api")


def test_fixed_summaries_and_exact_quotes_cannot_be_tampered():
    e = core(); ctx = context(e)
    rows = [{"decision": "DOCUMENTED", "evidence": ["E1"], "setup": []},
        {"decision": "DOCUMENTED", "evidence": ["E1"], "setup": []},
        {"decision": "INSUFFICIENT_EVIDENCE", "evidence": [], "setup": []}]
    result = e["assemble"](ctx, rows)
    assert e["valid_assessment"](ctx, result)
    assert result["results"][0]["reason"] == e["SUMMARIES"]["DOCUMENTED"]
    assert result["results"][0]["citations"][0]["quote"] == ctx["documents"]["source"]["p0"]
    result["results"][0]["reason"] = "A model-invented explanation."
    assert not e["valid_assessment"](ctx, result)


def test_source_audit_still_required_without_retry():
    e = core(); ctx = context(e); row = {"decision": "DOCUMENTED", "evidence": ["E1"], "setup": []}
    calls = []
    def audit(request):
        calls.append(request)
        output = json.loads(request["output"])
        assert output["assessment"] == row
        assert output["evidence_passages"][0]["quote"] == ctx["documents"]["source"]["p0"]
        return False
    assert not e["validate_condition"](ctx, "text_api", row, lambda _: row, audit)
    assert len(calls) == 1
