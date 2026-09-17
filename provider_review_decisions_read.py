"""Read-only access to pinned historical v20 results. No assessment writer.

Keep the exact contract snapshot and expose a separate display projection. Never
rewrite a v20 candidate as a historical provider-review, invent completed setup,
or interpret receipt success alone as assessment validity. No wallet or writes.
"""
import hashlib
import time
from genlayer_py.abi import calldata
import provider_review_decisions_schema as engine
from purchase_flow import address, tx_hash, require, receipt
import studio_next as network

SOURCE = "dddb4a8c382cea0e1033b403aa4f5d159a20bab1db3996e77b115c0926966557"
PROTOCOL = "013d610eeb7aa4f39af908335c860e2180dbdcb92963a1c234a19874467c7970"


def validate_snapshot(state, payload, account):
    require(isinstance(state, dict) and type(state.get("version")) is int and state["version"] == 20
            and state.get("kind") == "provider-review-decisions-candidate"
            and state.get("release_cleared") is False and state.get("protocol_sha256") == PROTOCOL
            and state.get("evidence_json") == payload
            and state.get("digest") == hashlib.sha256(payload.encode()).hexdigest()
            and isinstance(state.get("account"), str) and state["account"].lower() == account.lower()
            and state.get("complete") is True and state.get("review_status") == "completed",
            "Review snapshot does not match the submitted evidence and format.")
    ctx = engine.context(payload)
    require(ctx["complete"] and engine.valid_assessment(ctx, state.get("assessment")),
            "Assessment fields or exact evidence references do not match.")
    return state


def display_projection(state):
    """Pure view only. Call after identity and structural validation.

    Setup remains exact cited source text, not a newly generated instruction.
    Keep decision mode and full references for detail views and exports.
    """
    return {"version": 20, "complete": True, "review_status": "completed", "results": [
        {**row, "citations": [dict(c) for c in row["citations"]],
         "documented_steps": [dict(c) for c in row["documented_steps"]],
         **({"required_actions": [c["quote"] for c in row["documented_steps"]]}
            if row["verdict"] == "CONDITIONAL" else {})}
        for row in state["assessment"]["results"]]}


def inspect(deployment, read=network.rpc):
    deployment = tx_hash(deployment)
    row = receipt(deployment, read, chain_id=61997)
    require(row.get("status") == "FINALIZED" and row.get("execution") == "SUCCESS"
            and row.get("value_wei") == "0" and row.get("source_sha256") == SOURCE
            and len(row.get("args", [])) == 1 and isinstance(row["args"][0], str),
            "Wait for a successful matching review receipt. Do not submit again.")
    tx = read("eth_getTransactionByHash", [deployment])
    require(isinstance(tx, dict) and tx.get("hash", "").lower() == deployment,
            "Mismatched review transaction.")
    contract = address(tx.get("data", {}).get("contract_address") or tx.get("to_address"))
    account = address(row["from"])
    raw = read("gen_call", [{"type": "read", "from": account, "to": contract,
        "data": network.snapshot_calldata(), "transaction_hash_variant": "latest-final"}])
    state = calldata.decode(bytes.fromhex(raw.removeprefix("0x")))
    validate_snapshot(state, row["args"][0], account)
    return {"deployment": deployment, "contract": contract, "state": state,
        "view": display_projection(state), "receipt": row, "observed_at": time.time()}
