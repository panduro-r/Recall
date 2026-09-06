"""Offline checks for experiment recovery and public reporting, not AI accuracy."""
import sys
from pathlib import Path

import pytest

LIVE = Path(__file__).resolve().parents[1] / "live"
sys.path.insert(0, str(LIVE))
from export_flow import public_report
from full_flow import Flow


def test_incomplete_report_refused():
    with pytest.raises(ValueError, match="unfinished"):
        public_report({"completed": False})


def test_completed_step_is_not_resubmitted():
    flow = object.__new__(Flow)
    flow.report = {"completed_steps": ["pay-storage-v1"]}
    # No keys or RPC exist on this object: a duplicate execution would fail.
    flow.step("pay-storage-v1", "buyer", "execute_purchase", ["p-storage-v1"], value=2*10**16)


def test_uncertain_funding_is_not_repeated():
    flow = object.__new__(Flow)
    flow.report = {"funding": {"status": "unconfirmed"}}
    with pytest.raises(RuntimeError, match="Ambiguous faucet"):
        flow.fund()


def test_exact_balance_delivery_required():
    flow = object.__new__(Flow)
    before = {"buyer": 10**17, "inference": 0, "storage": 0, "monitoring": 0, "contract": 0}
    after = {**before, "buyer": 8*10**16, "storage": 2*10**16}
    flow.report = {"balance_checks": {"pay": {"before": before}}}
    flow.balances = lambda: after
    flow.save = lambda: None
    flow.verify_delivery("pay", "storage", 2*10**16)
    assert flow.report["balance_checks"]["pay"]["verified"] is True


def test_unrelated_balance_change_stops_experiment():
    flow = object.__new__(Flow)
    before = {"buyer": 10**17, "inference": 0, "storage": 0, "monitoring": 0, "contract": 0}
    after = {**before, "buyer": 8*10**16, "storage": 2*10**16, "monitoring": 1}
    flow.report = {"balance_checks": {"pay": {"before": before}}}
    flow.balances = lambda: after
    flow.save = lambda: None
    with pytest.raises(RuntimeError, match="unrelated"):
        flow.verify_delivery("pay", "storage", 2*10**16)


def test_export_allowlists_receipt_fields():
    state = {"agreement": {"reserved_wei": "0", "spent_wei": "0"}, "claims": [], "permits": []}
    run = dict(completed=True, rpc="studio", chain_id=61999, contract="test", source_sha256="hash", evidence_commit="commit", evidence={}, final_balances={}, funding={}, balance_checks={}, snapshot=state,
               completed_steps=["deploy"], checkpoints={"deploy": {"observed_at": 2, "state": state}},
               transactions={"deploy": {"hash": "tx", "status": "FINALIZED", "submitted_at": 1, "request": {"method": None}, "receipt": {"secret": "DO_NOT_EXPORT", "consensus_data": {"leader_receipt": [{"mode": "leader", "execution_result": "SUCCESS", "node_config": "DO_NOT_EXPORT"}], "votes": {"v": "agree"}}}}})
    result = public_report(run)
    assert "DO_NOT_EXPORT" not in str(result)
    assert result["steps"][0]["vote_counts"] == {"agree": 1}
