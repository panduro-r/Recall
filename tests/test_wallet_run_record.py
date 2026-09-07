"""Offline consistency tests for the allowlisted wallet-run evidence package."""
import json

import pytest
from purchase_flow import BASE, config
from live.verify_wallet_run import verify


def recorded():
    return json.loads((BASE / "live/wallet-run-2026-09-07.json").read_text())


def test_saved_wallet_run_matches_verifier():
    report = recorded()
    assert verify(report["session"], report["receipts"], config())
    assert report["coverage"]["receipt_count"] == 11
    assert report["coverage"]["missing_receipts"]


@pytest.mark.parametrize("mutation", ["amount", "recipient", "child_parent", "child_source", "child_pending", "failed_execution", "role", "args", "source", "original", "budget", "missing"])
def test_wallet_evidence_verifier_rejects_mismatches(mutation):
    r = recorded()
    rows, s = r["receipts"], r["session"]["snapshot"]
    if mutation == "amount": rows[-1]["value_wei"] = "1"
    if mutation == "recipient": rows[-1]["child"]["to_address"] = rows[-1]["from"]
    if mutation == "child_parent": rows[-1]["child"]["triggered_by"] = rows[0]["hash"]
    if mutation == "child_source": rows[-1]["child"]["from_address"] = rows[-1]["from"]
    if mutation == "child_pending": rows[-1]["child"]["status"] = "ACCEPTED"
    if mutation == "failed_execution": rows[2]["execution"] = "ERROR"
    if mutation == "role": rows[2]["from"] = rows[-1]["from"]
    if mutation == "args": rows[-1]["args"] = ["p-inference-v1"]
    if mutation == "source": rows[0]["source_sha256"] = "wrong"
    if mutation == "original": s["permits"][0]["status"] = "RESERVED"
    if mutation == "budget": s["agreement"]["spent_wei"] = "0"
    if mutation == "missing": rows.pop()
    with pytest.raises(ValueError):
        verify(r["session"], rows, config())
