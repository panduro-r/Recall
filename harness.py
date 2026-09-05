"""Local execution of the real contract with EXPLICIT web / LLM fixtures.

No network calls, keys, blockchain transactions, or actual value transfers.
"""
import hashlib
import json
import re
from pathlib import Path
from gltest.direct import VMContext, deploy_contract

CONTRACT = Path(__file__).parent / "contracts" / "recall.py"
BUYER = bytes.fromhex("11" * 20)
SELLER = bytes.fromhex("22" * 20)
AGENT = bytes.fromhex("33" * 20)
CHALLENGER = bytes.fromhex("44" * 20)
OUTSIDER = bytes.fromhex("55" * 20)
RECIPIENT = "0x" + "66" * 20
UNIT = 10**15  # Prices are 0.040, 0.025, 0.015 test GEN; budget 0.100.
ROOT = "https://raw.githubusercontent.com/example/recall-fixtures/" + "a" * 40 + "/"
CRITERION = "The purchased plan must contractually guarantee EU-only processing and storage of customer logs."
DOCS = {
    "inference.txt": "Northstar Basic quote v1: processing and storage of all customer logs is EU-only.",
    "storage.txt": "Harbor Storage signed plan: all customer log processing and storage occurs in the EU only.",
    "monitoring.txt": "Beacon Monitoring signed plan: customer logs are stored and processed only within the EU.",
    "correction.txt": "Northstar Basic order amendment v2 supersedes quote v1 for this purchase: logs may be processed in the US. EU-only processing is not guaranteed.",
    "irrelevant.txt": "An unrelated vendor offers a US-only plan. This does not amend Northstar's purchase terms.",
    "replacement.txt": "Northstar EU Pro alternative order: binding EU-only processing and storage of customer logs, without US failover.",
}


def digest(path):
    return hashlib.sha256(DOCS[path].encode()).hexdigest()


def fixtures(vm, verdict="SUPPORTED", missing=None):
    vm.clear_mocks()
    for path, body in DOCS.items():
        vm.mock_web(re.escape(ROOT + path) + "$", {"status": 404 if path == missing else 200, "body": body})
    vm.mock_llm(r".*", json.dumps({"verdict": verdict, "reason": {
        "SUPPORTED": "Fixture judgment: supplied terms satisfy the EU-only criterion.",
        "REFUTED": "Fixture judgment: applicable amended terms allow US processing.",
        "INCONCLUSIVE": "Fixture judgment: the guarantee cannot be established.",
    }.get(verdict, "Malformed fixture judgment")}))


def deploy(vm):
    vm.sender = BUYER
    vm.warp("2026-09-04T12:00:00Z")
    vm.value = 0
    return deploy_contract(CONTRACT, vm, "0x" + SELLER.hex(), "0x" + AGENT.hex(),
        "0x" + CHALLENGER.hex(), str(100 * UNIT), CRITERION, ROOT)


def publish(contract, vm, claim_id="inference-v1", path="inference.txt", price=40, supersedes=""):
    vm.sender = SELLER
    recipient = {"storage.txt": "0x" + "77" * 20, "monitoring.txt": "0x" + "88" * 20}.get(path, RECIPIENT)
    contract.publish_claim(claim_id, DOCS[path], recipient, str(price * UNIT), path, digest(path), supersedes)


def prepare(contract, vm):
    vm.sender = SELLER
    contract.accept_terms()
    for name, path, price in [("inference", "inference.txt", 40),
                               ("storage", "storage.txt", 25), ("monitoring", "monitoring.txt", 15)]:
        publish(contract, vm, name + "-v1", path, price)
        fixtures(vm)
        vm.sender = AGENT
        contract.evaluate_claim(name + "-v1")
        contract.queue_purchase(name, name + "-v1")


def run_scenario(mode="upheld"):
    if mode not in ["upheld", "rejected", "missing"]:
        raise ValueError("Unknown scenario")
    vm = VMContext()
    emitted = []
    steps = []
    checks = []
    def capture(_vm, request):
        if "EthSend" in request:
            emitted.append(request["EthSend"])
            return {"ok": None}
        return None
    vm._gl_call_hook = capture
    with vm.activate():
        contract = deploy(vm)
        def record(title, detail):
            steps.append({"title": title, "detail": detail, "snapshot": contract.snapshot(),
                          "transfer_messages": len(emitted)})
        def blocked(permit, reason):
            before = contract.snapshot()
            with vm.expect_revert(reason):
                contract.execute_purchase(permit)
            assert before == contract.snapshot()
            checks.append({"name": reason, "passed": True})
        prepare(contract, vm)
        record("Three purchases reserved", "The seller accepts the criterion; the agent queues 0.080 test GEN against three independently versioned claims.")
        vm.sender = CHALLENGER
        path = "irrelevant.txt" if mode == "rejected" else "correction.txt"
        contract.challenge_claim("inference-v1", path, digest(path))
        vm.sender = BUYER
        vm.value = 40 * UNIT
        blocked("inference", "Dependency not valid")
        record("Only inference is disputed", "The attempted inference payment reverts. Its claim is on hold; the storage and monitoring claims remain valid.")
        fixtures(vm, "SUPPORTED" if mode == "rejected" else "REFUTED", path if mode == "missing" else None)
        vm.value = 0
        result = contract.resolve_challenge("inference-v1")
        assert vm.run_validator() is True
        record("Challenge " + {"upheld": "upheld", "rejected": "rejected", "missing": "inconclusive"}[mode],
            "Contract judgment: " + result["verdict"] + ". The validator callback is also executed locally with fixtures; this is not network consensus.")
        vm.warp("2026-09-04T12:10:00Z")
        vm.sender = BUYER
        vm.value = 25 * UNIT
        contract.execute_purchase("storage")
        vm.value = 15 * UNIT
        contract.execute_purchase("monitoring")
        record("Unaffected purchases proceed", "The review period has ended. Two exact, single-use transfer messages are scheduled; no money moves in this harness.")
        if mode == "rejected":
            vm.value = 40 * UNIT
            contract.execute_purchase("inference")
            record("Original purchase proceeds", "Irrelevant counter-evidence does not invalidate the original purchase. The claim cannot be challenged a second time in this bounded prototype.")
        else:
            vm.value = 40 * UNIT
            blocked("inference", "Dependency not valid")
            vm.value = 0
            contract.cancel_purchase("inference")
            publish(contract, vm, "inference-v2", "replacement.txt", 45, "inference-v1")
            fixtures(vm)
            vm.sender = AGENT
            contract.evaluate_claim("inference-v2")
            contract.queue_purchase("inference-repaired", "inference-v2")
            record("New evidence, new permit", "Cancelling the old permit releases its reservation, not a refund. A new EU-only offer costs 0.045 test GEN and receives its own review window. The old record stays invalid or unknown.")
            vm.warp("2026-09-04T12:20:00Z")
            vm.sender = BUYER
            vm.value = 45 * UNIT
            contract.execute_purchase("inference-repaired")
            record("Corrected purchase proceeds", "Three transfer messages total 0.085 test GEN, within the original 0.100 budget. The old permit remains cancelled.")
        final_permit = "inference" if mode == "rejected" else "inference-repaired"
        blocked(final_permit, "Permit already consumed")
        budget = contract.snapshot()["agreement"]
        assert int(budget["reserved_wei"]) + int(budget["spent_wei"]) <= int(budget["budget_wei"])
        assert len(emitted) == 3
        checks += [{"name": "Budget invariant holds", "passed": True},
                   {"name": "Exactly three transfer messages captured", "passed": True}]
    return {"mode": mode, "execution": "Local direct VM; scripted web and LLM fixtures; no blockchain transactions",
            "steps": steps, "checks": checks}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--scenario", choices=["upheld", "rejected", "missing"], default="upheld")
    args = parser.parse_args()
    print(json.dumps(run_scenario(args.scenario), indent=2))
