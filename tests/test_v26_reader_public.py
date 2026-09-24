"""Portable, read-only v26 format checks. No wallet, RPC or private test journal."""
import hashlib
import json
from copy import deepcopy

import pytest

import provider_review_decisions_read as reader
import provider_review_decisions_schema as schema


ACCOUNT = "0x" + "1" * 40


def fixture():
    docs = [
        ("plan", "Pro Speech-to-Text supports English prerecorded audio through a batch API.\n" * 9),
        ("input", "The Batch API accepts mono WAV audio files for transcription.\n" * 9),
        ("faq", "Without opt-in, customer data is not used for model improvement.\n" * 9),
        ("terms", "Customer transcripts are licensed for machine learning and software improvement.\n" * 9),
    ]
    data = {"version": 1, "plan": {"name": "Example", "plan": "Pro", "category": "transcription", "unit": "hour"},
        "requirements": {"hours": 100, "budget": 50,
                         "noTraining": True, "speakers": False},
        "documents": [{"id": name, "text": text, "textSha256": hashlib.sha256(text.encode()).hexdigest(),
                       "status": "retrieved", "complete": True} for name, text in docs]}
    payload = json.dumps(data, separators=(",", ":"))
    ctx = schema.context_v26(payload)
    ids = schema.evidence_index(ctx)
    by_source = {name: next(eid for eid, ref in ids.items() if ref["source"] == name)
                 for name, _ in docs}
    answers = [{"decision": "DOCUMENTED", "evidence": [by_source["plan"]], "setup": []},
               {"decision": "DOCUMENTED", "evidence": [by_source["plan"]], "setup": []},
               {"decision": "DOCUMENTED", "evidence": [by_source["plan"]], "setup": []},
               {"decision": "DOCUMENTED", "evidence": [by_source["input"]], "setup": []},
               {"decision": "CONFLICTING_EVIDENCE", "evidence": [by_source["faq"],
                                                        by_source["terms"]], "setup": []}]
    state = {"version": 26, "kind": "provider-review-decisions-candidate",
        "release_cleared": False, "protocol_sha256": reader.FORMATS[26][1],
        "account": ACCOUNT, "digest": hashlib.sha256(payload.encode()).hexdigest(),
        "evidence_json": payload, "complete": True, "review_status": "completed",
        "assessment": schema.assemble(ctx, answers, 26)}
    return state


def test_exact_v26_format_reads_without_enabling_a_writer():
    state = fixture()
    before = deepcopy(state)
    assert reader.validate_snapshot(state, state["evidence_json"], ACCOUNT, 26) == state
    assert reader.display_projection(state)["results"] == state["assessment"]["results"]
    assert state == before and state["release_cleared"] is False
    assert state["assessment"]["results"][-1]["verdict"] == "INCONCLUSIVE"


@pytest.mark.parametrize("tamper", [
    lambda s: s["assessment"]["results"][-1]["citations"][1].update(quote="invented"),
    lambda s: s["assessment"]["results"][0].update(reason="invented"),
    lambda s: s.update(protocol_sha256=reader.FORMATS[25][1]),
    lambda s: s.update(version=25),
])
def test_v26_reader_rejects_changed_evidence_or_format(tamper):
    state = fixture()
    tamper(state)
    with pytest.raises(ValueError):
        reader.validate_snapshot(state, state["evidence_json"], ACCOUNT, 26)
