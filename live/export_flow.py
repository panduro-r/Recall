"""Print an allowlisted public report; never reads private signing records."""
import base64
from collections import Counter
import json
from pathlib import Path


def public_report(run):
    if not run.get("completed"):
        raise ValueError("Refusing a completed-test report for an unfinished run")
    report = {k: run[k] for k in ("rpc", "chain_id", "contract", "source_sha256", "evidence_commit", "evidence", "final_balances")}
    report["scope"] = "One hosted Studio sandbox experiment, fictional terms, disposable accounts. Not decentralized Bradbury settlement or a representative AI-accuracy benchmark."
    report["funding"] = run["funding"]
    report["balance_checks"] = run["balance_checks"]
    report["final_state"] = run["snapshot"]
    report["steps"] = []
    for label in run["completed_steps"]:
        tx = run["transactions"][label]
        checkpoint = run["checkpoints"][label]
        state = checkpoint["state"]
        consensus = tx["receipt"].get("consensus_data") or {}
        leaders = [x for x in consensus.get("leader_receipt", []) if x.get("mode") == "leader"]
        outcome = leaders[-1]
        entry = {"step": label, "transaction_hash": tx["hash"], "status": tx["status"],
                 "execution": outcome["execution_result"], "submitted_at": tx["submitted_at"],
                 "observed_at": checkpoint["observed_at"], "value_wei": tx["request"].get("value", 0),
                 "vote_counts": dict(Counter((consensus.get("votes") or {}).values())),
                 "reserved_wei": state["agreement"]["reserved_wei"], "spent_wei": state["agreement"]["spent_wei"],
                 "claims": {c["id"]: c["status"] for c in state["claims"]},
                 "permits": {p["id"]: p["status"] for p in state["permits"]}}
        if outcome["execution_result"] == "ERROR":
            entry["rejection"] = base64.b64decode(outcome["result"])[1:].decode()
        if tx["request"]["method"] in ("evaluate_claim", "resolve_challenge"):
            c = next(c for c in state["claims"] if c["id"] == tx["request"]["args"][0])
            entry["judgment"] = c["judgment"]
            entry["review_until"] = c["review_until"]
        report["steps"].append(entry)
    return report


if __name__ == "__main__":
    run = json.loads((Path(__file__).resolve().parent / "flow-result.json").read_text())
    print(json.dumps(public_report(run), indent=2))
