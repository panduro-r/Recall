"""Integrity checks for the three recorded live controls, not a new live run."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_recorded_controls_bind_to_the_exact_standalone_contract():
    proof = json.loads((ROOT / "submission/studio-next-v22-targeted-controls-2026-09-17.json").read_text())
    assert hashlib.sha256((ROOT / proof["source_path"]).read_bytes()).hexdigest() == proof["source_sha256"]
    assert proof["submitted"] == proof["max_authorized"] == 3
    assert proof["provider_payments_wei"] == "0" and not proof["automatic_retries"]
    assert not proof["production_writer_enabled"]
    assert [r["case"] for r in proof["results"]] == ["q03", "q01", "q02"]
    for row in proof["results"]:
        assert row["chain_id"] == 61997 and row["status"] == "FINALIZED" and row["execution"] == "SUCCESS"
        assert row["assessment_passed"] and len(row["target_checks"]) == 4
        assert all(c["status"] == "pass" and not c["issues"] for c in row["target_checks"])
        assert row["assessment"]["schema_version"] == 22
        assert not row["assessment"]["release_cleared"]
        assert row["assessment"]["evidence_sha256"] == row["evidence_sha256"]
        docs = {d["id"]: d["text"] for d in row["evidence"]["documents"]}
        for finding in row["assessment"]["results"]:
            for ref in finding["citations"] + finding["documented_steps"]:
                assert ref["quote"] in docs[ref["source"]]
    outcomes = {r["case"]: {f["id"]: f["decision"] for f in r["assessment"]["results"]} for r in proof["results"]}
    assert outcomes["q03"]["text_api"] == "DOCUMENTED"
    assert outcomes["q03"]["text_output"] == "INSUFFICIENT_EVIDENCE"
    assert outcomes["q03"]["training"] == "OPT_OUT_REQUIRED_DEFAULT_UNSPECIFIED"
    assert outcomes["q01"]["text_output"] == outcomes["q02"]["text_output"] == "DOCUMENTED"
    assert outcomes["q01"]["text_streaming"] == "INSUFFICIENT_EVIDENCE"
    assert outcomes["q02"]["text_streaming"] == "DOCUMENTED"
