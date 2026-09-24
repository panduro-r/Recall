"""Read-only access to pinned v20/v22/v25/v26 results. No assessment writer.

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
FORMATS = {
    20: (SOURCE, PROTOCOL),
    22: ("b8d6a1249dd49afd88d1e64a95aa77d1c327334dba49f9f0ca95007a88e1b52d",
         "e4151ccf4e7caaf3ec880304aded803afa4dbfd11276268e64ff5f1ad9cb1e50"),
    25: ("c03e43531297394f470d81cc0453a8a0a3abb9ea7150c94334f3c4c1c8278be9",
         "161175f602e241f1fd87bb2455132c6d7faf0e1e3487fc0e1d728823aecc8b7b"),
    26: ("0eed90e7116b1065da4b41d4fafc647fb936fefc6da64f6f04082f523572ecd4",
         "032433ba72892de57b0f55a675f2f9cd79101479ec60a0fa76fe31df558fda6c"),
}
SOURCES = {source: version for version, (source, _) in FORMATS.items()}


def quality_notice(deployment, state):
    """Disclose a confirmed defect without editing the immutable source result."""
    if (deployment.lower() == "0x8c19fb5ebe226bb83376b3279d9722c3c7de5ab9c1719df0f46ff0bc28bde91b"
            and state["version"] == 22 and state["protocol_sha256"] == FORMATS[22][1]
            and state["digest"] == "02b21c1a2186b6ad2ce6cdc649177169452f0c0733a169ddf02490bd707fbbaa"):
        return {"status": "quality_rejected", "code": "CONFIRMED_CITATION_ERROR",
            "message": "Assessment withdrawn: its explanation attributes endpoint values to a table-header-only citation. Do not rely on these findings. The original result and receipt are preserved; this is not a finding against the provider."}
    return None


def validate_snapshot(state, payload, account, version=20):
    require(type(version) is int and version in FORMATS, "Unsupported review format.")
    require(isinstance(state, dict) and set(state) == {
            "version", "kind", "release_cleared", "protocol_sha256", "evidence_json",
            "digest", "account", "complete", "review_status", "assessment"}
            and type(state.get("version")) is int and state["version"] == version
            and state.get("kind") == "provider-review-decisions-candidate"
            and state.get("release_cleared") is False and state.get("protocol_sha256") == FORMATS[version][1]
            and state.get("evidence_json") == payload
            and state.get("digest") == hashlib.sha256(payload.encode()).hexdigest()
            and isinstance(state.get("account"), str) and state["account"].lower() == account.lower()
            and state.get("complete") is True and state.get("review_status") == "completed",
            "Review snapshot does not match the submitted evidence and format.")
    ctx = engine.context_v26(payload) if version == 26 else engine.context(payload)
    require(ctx["complete"] and engine.valid_assessment(ctx, state.get("assessment"), version),
            "Assessment fields or exact evidence references do not match.")
    return state


def display_projection(state):
    """Pure view only. Call after identity and structural validation.

    Setup remains exact cited source text, not a newly generated instruction.
    Keep decision mode and full references for detail views and exports.
    """
    return {"version": state["version"], "complete": True, "review_status": "completed", "results": [
        {**row, "citations": [dict(c) for c in row["citations"]],
         "documented_steps": [dict(c) for c in row["documented_steps"]],
         **({"required_actions": [c["quote"] for c in row["documented_steps"]]}
            if row["verdict"] == "CONDITIONAL" else {})}
        for row in state["assessment"]["results"]]}


def inspect(deployment, read=network.rpc):
    deployment = tx_hash(deployment)
    row = receipt(deployment, read, chain_id=61997)
    require(row.get("status") == "FINALIZED" and row.get("execution") == "SUCCESS"
            and row.get("value_wei") == "0" and row.get("source_sha256") in SOURCES
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
    validate_snapshot(state, row["args"][0], account, SOURCES[row["source_sha256"]])
    return {"deployment": deployment, "contract": contract, "state": state,
        "view": display_projection(state), "receipt": row, "observed_at": time.time(),
        "quality_notice": quality_notice(deployment, state)}
