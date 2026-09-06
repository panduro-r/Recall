"""Resumable, explicitly authorized Studio-only recall/recovery experiment.

Run with `python live/full_flow.py`. Uses disposable keys, real hosted models,
real review windows, and at most 0.100 sandbox GEN. No owner-wallet access.
"""
import base64
import contextlib
import hashlib
import io
import json
import time
import requests
import studio

COMMIT = "ab196d305ccc27446058b67139771ce38d42e9b6"
ROOT = f"https://raw.githubusercontent.com/panduro-r/Recall/{COMMIT}/"
CRITERION = "All customer payloads and customer-identifying logs must be processed and stored only in the EU, with no non-EU failover or support access."
FILES = ("inference-v1", "storage-v1", "monitoring-v1", "inference-amendment", "inference-replacement")


def emit(**event):
    print(json.dumps(event), flush=True)


def claim(snap, identifier):
    return next(c for c in snap["claims"] if c["id"] == identifier)


def permit(snap, identifier):
    return next(p for p in snap["permits"] if p["id"] == identifier)


class Flow:
    def __init__(self):
        studio.PRIVATE = studio.BASE / "live/private/full-flow-v1"
        studio.REPORT = studio.BASE / "live/flow-result.json"
        self.keys = studio.accounts()
        self.report = json.loads(studio.REPORT.read_text()) if studio.REPORT.exists() else {
            "rpc": studio.RPC, "chain_id": 61999, "evidence_commit": COMMIT,
            "source_sha256": hashlib.sha256((studio.BASE / "contracts/recall.py").read_bytes()).hexdigest(),
            "accounts": {r: k.address for r, k in self.keys.items()}, "transactions": {},
            "completed_steps": [], "checkpoints": {}, "evidence": {}}
        if self.report["accounts"] != {r: k.address for r, k in self.keys.items()} or self.report["evidence_commit"] != COMMIT:
            raise RuntimeError("Run identity or evidence mismatch")

    def save(self):
        studio.save(studio.REPORT, self.report)

    def verify_evidence(self):
        for name in FILES:
            path = f"evidence/flow/{name}.txt"
            response = requests.get(ROOT + path, timeout=25)
            response.raise_for_status()
            body = response.content
            if body != (studio.BASE / path).read_bytes():
                raise RuntimeError(f"Published evidence differs: {name}")
            self.report["evidence"][name] = {"path": path, "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body)}
        self.save()
        emit(stage="evidence-verified", commit=COMMIT)

    def refresh(self):
        with contextlib.redirect_stdout(io.StringIO()):
            studio.status(self.report)

    def snap(self):
        return studio.read_snapshot(self.report, self.keys)

    def balances(self):
        addresses = {r: self.keys[r].address for r in ("buyer", "inference", "storage", "monitoring")}
        addresses["contract"] = self.report["contract"]
        return {r: int(studio.rpc("eth_getBalance", [address, "latest"]), 16) for r, address in addresses.items()}

    def step(self, label, role, method, args, check=None, error=None, value=0):
        if label in self.report["completed_steps"]:
            return
        with contextlib.redirect_stdout(io.StringIO()):
            studio.submit(self.report, self.keys, label, role, method, args, value)
        started = time.monotonic()
        while True:
            self.refresh()
            tx = self.report["transactions"][label]
            emit(stage=label, status=tx["status"], hash=tx["hash"])
            if tx["status"] in ("ACCEPTED", "FINALIZED"):
                leaders = [x for x in (tx["receipt"].get("consensus_data") or {}).get("leader_receipt", []) if x.get("mode") == "leader"]
                if not leaders:
                    raise RuntimeError("Accepted transaction missing application receipt")
                outcome = leaders[-1]
                if error is None:
                    if outcome["execution_result"] != "SUCCESS":
                        raise RuntimeError(f"Unexpected failure at {label}: {outcome.get('result')}")
                else:
                    decoded = base64.b64decode(outcome["result"])[1:].decode()
                    if outcome["execution_result"] != "ERROR" or error not in decoded:
                        raise RuntimeError(f"Expected rejection {error}, received {decoded}")
                break
            if tx["status"] in ("UNDETERMINED", "CANCELED") or time.monotonic() - started > 240:
                raise RuntimeError(f"Inspect {label} before resuming; status {tx['status']}")
            time.sleep(10)
        snap = self.snap()
        if check is not None and not check(snap):
            raise RuntimeError(f"State assertion failed at {label}; no further writes")
        self.report["checkpoints"][label] = {"observed_at": time.time(), "state": snap}
        self.report["completed_steps"].append(label)
        self.save()

    def publish(self, name, recipient, amount, statement, supersedes=""):
        evidence = self.report["evidence"][name]
        self.step("publish-" + name, "seller", "publish_claim", [name, statement,
            self.keys[recipient].address, str(amount), evidence["path"], evidence["sha256"], supersedes],
            check=lambda s: claim(s, name)["status"] == "PENDING")

    def evaluate_queue(self, name):
        self.step("evaluate-" + name, "agent", "evaluate_claim", [name],
                  check=lambda s: claim(s, name)["status"] == "VALID")
        self.step("queue-" + name, "agent", "queue_purchase", ["p-" + name, name],
                  check=lambda s: permit(s, "p-" + name)["status"] == "RESERVED")

    def fund(self):
        if "funding" in self.report:
            if self.report["funding"].get("status") != "confirmed":
                raise RuntimeError("Ambiguous faucet attempt: inspect balances before recovery")
            return
        studio.checked_abi()
        before = self.balances()
        if any(before.values()):
            raise RuntimeError("Expected empty disposable balances before faucet funding")
        self.report["funding"] = {"status": "unconfirmed", "before": before, "amount": 10**17}
        self.save()
        result = studio.rpc("sim_fundAccount", [self.keys["buyer"].address, 10**17])
        after = self.balances()
        if after["buyer"] != 10**17 or any(after[r] for r in ("inference", "storage", "monitoring", "contract")):
            raise RuntimeError("Unexpected faucet balance; inspect before proceeding")
        self.report["funding"].update(status="confirmed", transaction_hash=result, after=after)
        self.save()
        emit(stage="funded", amount_wei=10**17, scope="sandbox-only")

    def pay(self, name, role, amount):
        label = "pay-" + name
        if label in self.report["completed_steps"]:
            return
        if label not in self.report["transactions"]:
            snap = self.snap()
            until = claim(snap, name)["review_until"] + 8
            while time.time() < until:
                emit(stage="review-window", claim=name, remaining_seconds=round(until - time.time()))
                time.sleep(min(20, max(0, until - time.time())))
            self.report.setdefault("balance_checks", {}).setdefault(label, {"before": self.balances()})
            self.save()
        self.step(label, "buyer", "execute_purchase", ["p-" + name], value=amount,
                  check=lambda s: permit(s, "p-" + name)["status"] == "SCHEDULED")
        self.verify_delivery(label, role, amount)

    def verify_delivery(self, label, role, amount):
        check = self.report["balance_checks"][label]
        if check.get("verified"):
            return
        started = time.monotonic()
        while True:
            after = self.balances()
            before = check["before"]
            check["after"] = after
            self.save()
            if after[role] - before[role] == amount and before["buyer"] - after["buyer"] == amount and after["contract"] == 0:
                if any(after[r] != before[r] for r in ("inference", "storage", "monitoring") if r != role):
                    raise RuntimeError("Unexpected unrelated recipient balance change")
                check["verified"] = True
                self.save()
                emit(stage="delivery-verified", payment=label, recipient_role=role, amount_wei=amount)
                return
            if time.monotonic() - started > 240:
                raise RuntimeError("Scheduled is not delivered: recipient/buyer balance check timed out")
            emit(stage="awaiting-delivery", payment=label, balances=after)
            time.sleep(15)

    def run(self):
        self.verify_evidence()
        args = [self.keys[r].address for r in ("seller", "agent", "challenger")] + [str(10**17), CRITERION, ROOT]
        self.step("deploy", "buyer", None, args)
        self.step("accept", "seller", "accept_terms", [], check=lambda s: s["agreement"]["accepted"])
        self.fund()
        for name, role, amount, statement in [
            ("storage-v1", "storage", 2*10**16, "Harbor EU Storage order RECALL-FLOW-002 meets every buyer data-location and access requirement."),
            ("monitoring-v1", "monitoring", 2*10**16, "Beacon EU Monitoring order RECALL-FLOW-003 meets every buyer data-location and access requirement."),
            ("inference-v1", "inference", 3*10**16, "Northstar Inference Basic order RECALL-FLOW-001 meets every buyer data-location and access requirement.")]:
            self.publish(name, role, amount, statement)
            self.evaluate_queue(name)
        self.step("reject-early-payment", "buyer", "execute_purchase", ["p-inference-v1"], error="Review window still open")
        evidence = self.report["evidence"]["inference-amendment"]
        self.step("challenge", "challenger", "challenge_claim", ["inference-v1", evidence["path"], evidence["sha256"]],
                  check=lambda s: claim(s, "inference-v1")["status"] == "DISPUTED" and all(claim(s, n)["status"] == "VALID" for n in ("storage-v1", "monitoring-v1")))
        self.step("reject-disputed-payment", "buyer", "execute_purchase", ["p-inference-v1"], error="Dependency not valid")
        self.step("resolve", "agent", "resolve_challenge", ["inference-v1"], check=lambda s: claim(s, "inference-v1")["status"] == "INVALID")
        self.step("cancel", "buyer", "cancel_purchase", ["p-inference-v1"], check=lambda s:
                  permit(s, "p-inference-v1")["status"] == "CANCELLED" and s["agreement"]["reserved_wei"] == str(4*10**16))
        self.publish("inference-replacement", "inference", 4*10**16,
                     "Northstar EU Dedicated new order RECALL-FLOW-004 meets every buyer data-location and access requirement.", "inference-v1")
        self.evaluate_queue("inference-replacement")
        self.step("reject-duplicate-permit", "agent", "queue_purchase", ["duplicate-p", "inference-replacement"], error="Claim already purchased or queued")
        for name, role, amount in [("storage-v1", "storage", 2*10**16), ("monitoring-v1", "monitoring", 2*10**16), ("inference-replacement", "inference", 4*10**16)]:
            self.pay(name, role, amount)
            # Resume a run interrupted between SCHEDULED and verified delivery.
            self.verify_delivery("pay-" + name, role, amount)
            self.step("reject-replay-" + name, "buyer", "execute_purchase", ["p-" + name], error="Permit already consumed")
        snap = self.snap()
        assert snap["agreement"]["spent_wei"] == str(8*10**16) and snap["agreement"]["reserved_wei"] == "0"
        assert self.balances() == {"buyer": 2*10**16, "inference": 4*10**16, "storage": 2*10**16, "monitoring": 2*10**16, "contract": 0}
        for _ in range(12):
            self.refresh()
            if all(t["status"] == "FINALIZED" for t in self.report["transactions"].values()):
                self.report["completed"] = True
                self.report["final_balances"] = self.balances()
                self.save()
                emit(stage="complete", contract=self.report["contract"], transactions=len(self.report["transactions"]))
                return
            time.sleep(10)
        raise RuntimeError("Application checks passed; finality still pending")


if __name__ == "__main__":
    Flow().run()
