"""One approved Google paid-tier assessment on the unchanged Studio Next v25 source.

Capture, preflight, submit and check are separate commands. The single attempt
is journaled before broadcast; an uncertain outcome must be inspected, not retried.
No provider payment or account-setting verification is performed.
"""
import argparse
import hashlib
import http.client
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from genlayer_py.abi import calldata

import provider_evidence
from live import decisions_v25_next as controls
from live import studio_next_migration as transport
from purchase_flow import address, receipt, require


RUN = transport.ROOT / "decisions-v25-google-paid-2026-09-25"
NONCE = 42
SOURCE = controls.SOURCE
PROTOCOL = controls.PROTOCOL
REQUIREMENTS = {"category": "text", "inputTokens": 1000000,
                "outputTokens": 200000, "budget": 50,
                "noTraining": True, "streaming": False}
SOURCES = ["google-model", "google-data"]
AUTHORIZED = False  # The single approved test was consumed; retain read-only checks.


def policy():
    return {"case": "google-flash", "chain_id": 61997, "nonce": NONCE,
            "source_sha256": SOURCE, "protocol_sha256": PROTOCOL,
            "requirements": REQUIREMENTS, "source_ids": SOURCES,
            "max_attempts": 1, "max_protocol_fee_wei": "50000000000000000",
            "provider_payment_wei": "0", "automatic_retry": False}


def public_capture():
    origin = "recall-navy-phi.vercel.app"
    connection = http.client.HTTPSConnection(origin, timeout=55)
    try:
        request = {"op": "capture", "request": {"planId": "google-flash",
                   "requirements": REQUIREMENTS}}
        connection.request("POST", "/api/provider-review", json.dumps(request),
                           {"Content-Type": "application/json", "Origin": "https://" + origin})
        response = connection.getresponse()
        body = response.read(400001)
        require(response.status == 200 and len(body) <= 400000,
                "Hosted Google capture unavailable. Nothing signed.")
        return json.loads(body)
    finally:
        connection.close()


def prior_gate():
    proof = json.loads((transport.BASE / "submission/studio-next-v25-anthropic-explicit-policy-2026-09-25.json").read_text())
    require(proof["source_sha256"] == SOURCE and proof["status"] == "FINALIZED"
            and proof["execution"] == "SUCCESS"
            and proof["assessment_passed_structural_checks"] is True
            and proof["manual_citation_review"]["passed"] is True,
            "Prior exact-case text validation is not complete.")


def frozen():
    row = transport.read_public(RUN / "evidence.json")
    payload = row["payload"]
    evidence = provider_evidence.validate_payload(payload)
    require(row["digest"] == hashlib.sha256(payload.encode()).hexdigest()
            and row["evidence"] == evidence
            and evidence["requirements"] == REQUIREMENTS
            and evidence["plan"]["id"] == "google-flash"
            and evidence["plan"]["requiresPaidTier"] is True
            and [d["id"] for d in evidence["documents"]] == SOURCES
            and all(d["status"] == "retrieved" and d["complete"] is True
                    and len(d["text"]) >= 100 for d in evidence["documents"])
            and 30000 <= len(payload.encode()) <= 60000,
            "Frozen Google evidence is incomplete or changed.")
    context = controls.engine.context(payload)
    require(context["complete"] and list(context["schema"]) ==
            ["text_api", "text_output", "training"],
            "Unexpected Google assessment conditions.")
    return row


def pins():
    row = frozen()
    source = controls.CONTRACT.read_bytes()
    require(source == controls.render_contract().encode()
            and hashlib.sha256(source).hexdigest() == SOURCE
            and hashlib.sha256(controls.runtime_core().encode()).hexdigest() == PROTOCOL,
            "Pinned v25 source changed.")
    return source, row["payload"]


def configure():
    source, payload = pins()
    transport.RUN = RUN
    transport.SOURCE, transport.SOURCE_PATH = SOURCE, controls.CONTRACT
    transport.EVIDENCE = hashlib.sha256(payload.encode()).hexdigest()
    transport.EXPECTED_NONCE = NONCE
    transport.pins = lambda: (source, payload)


def init():
    require(AUTHORIZED and not (RUN / "evidence.json").exists()
            and not (RUN / "attempt.json").exists(),
            "This Google test was already initialized or consumed.")
    prior_gate()
    bundle = public_capture()
    provider_evidence.validate_payload(bundle["payload"])
    transport.RUN = RUN
    transport.save("evidence.json", bundle)
    configure()
    schema = transport.read_public(controls.RUN / "schema.json")
    require(schema["source_sha256"] == SOURCE
            and schema["protocol_sha256"] == PROTOCOL
            and schema["chain_id"] == 61997, "Pinned v25 schema unavailable.")
    transport.save("schema.json", schema)
    transport.save("policy.json", policy())
    return {"chain_id": 61997, "source_sha256": SOURCE,
            "evidence_sha256": bundle["digest"],
            "payload_bytes": len(bundle["payload"].encode()),
            "sources": SOURCES, "max_attempts": 1,
            "max_protocol_fee_wei": policy()["max_protocol_fee_wei"],
            "provider_payment_wei": "0"}


def preflight():
    configure()
    require(transport.read_public(RUN / "policy.json") == policy(),
            "Saved test policy changed.")
    return transport.preflight()


def submit():
    require(AUTHORIZED and not (RUN / "attempt.json").exists(),
            "Google attempt already exists. Check its hash; do not retry.")
    prior_gate()
    configure()
    require(transport.read_public(RUN / "policy.json") == policy()
            and controls.network.MAX_FEE_WEI == int(policy()["max_protocol_fee_wei"]),
            "Exact one-attempt fee policy required.")
    before = transport.preflight()
    require(before["pending_nonce"] == NONCE
            and int(controls.network.rpc("eth_getTransactionCount",
                                             [transport.ADDRESS, "latest"]), 16) == NONCE,
            "Unexpected wallet nonce. No signature made.")
    return transport.submit()


def check():
    configure()
    attempt = transport.read_public(RUN / "attempt.json")
    payload = frozen()["payload"]
    require(attempt["plan"]["review"]["source_sha256"] == SOURCE
            and attempt["plan"]["review"]["args"] == [payload]
            and int(attempt["plan"]["transaction"]["nonce"], 16) == NONCE,
            "Saved attempt identity mismatch.")
    row = receipt(attempt["hash"], controls.network.rpc, chain_id=61997)
    result = {"hash": attempt["hash"], "status": row["status"],
              "execution": row.get("execution"), "chain_id": 61997,
              "assessment_passed": False}
    if row["status"] != "FINALIZED":
        return result
    tx = controls.network.rpc("eth_getTransactionByHash", [attempt["hash"]])
    if not (RUN / "final-transaction.json").exists():
        transport.save("final-transaction.json", tx)
    require(row["source_sha256"] == SOURCE and row["args"] == [payload]
            and row["from"].lower() == transport.ADDRESS.lower()
            and row["value_wei"] == "0"
            and row["protocol_fee_deposit_wei"] ==
                attempt["plan"]["review"]["protocol_fee_wei"],
            "Finalized receipt does not match the reviewed Google intent.")
    result.update(receipt=row, protocol_sha256=PROTOCOL,
                  release_cleared=False)
    if row["execution"] == "SUCCESS":
        contract = address(tx.get("data", {}).get("contract_address")
                           or tx.get("to_address"))
        raw = controls.network.rpc("gen_call", [{"type": "read",
            "from": transport.ADDRESS, "to": contract,
            "data": controls.network.snapshot_calldata(),
            "transaction_hash_variant": "latest-final"}])
        state = calldata.decode(bytes.fromhex(raw.removeprefix("0x")))
        require(state.get("version") == 25
                and state.get("kind") == "provider-review-decisions-candidate"
                and state.get("release_cleared") is False
                and state.get("protocol_sha256") == PROTOCOL
                and state.get("digest") == hashlib.sha256(payload.encode()).hexdigest()
                and state.get("complete") is True
                and state.get("account", "").lower() == transport.ADDRESS.lower()
                and state.get("evidence_json") == payload,
                "Saved Google contract snapshot mismatch.")
        context = controls.engine.context(payload)
        result.update(contract=contract, state=state,
            assessment_passed=(state.get("review_status") == "completed"
                               and controls.engine.valid_assessment(context,
                                                                   state.get("assessment"))),
            manual_semantic_review_required=True)
    result["balance_after_wei"] = str(int(controls.network.rpc(
        "eth_getBalance", [transport.ADDRESS, "latest"]), 16))
    if not (RUN / "result.json").exists():
        transport.save("result.json", result)
    return {key: value for key, value in result.items()
            if key not in ("receipt", "state")}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("init", "preflight", "submit", "check"))
    args = parser.parse_args()
    with transport.locked(transport.ROOT):
        transport.secure_root(RUN)
        outcome = (init() if args.command == "init" else
                   preflight() if args.command == "preflight" else
                   submit() if args.command == "submit" else check())
    print(json.dumps(outcome, indent=2))
