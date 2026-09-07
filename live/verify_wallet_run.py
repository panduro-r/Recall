"""Read-only verification of the September 6–7 user-approved Studio run.

Prints an allowlisted public observation to stdout. Never reads wallet journals,
keys or browser storage; never prepares, signs, funds or submits a transaction.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from purchase_flow import config, inspect, receipt, require

DEPLOYMENT = "0x25e0fc31634f16b8c4f522a8a18faa111a2770ed30cddfcdededcc2cc7bbd4c9"
CONTRACT = "0x69F3680Bc1A1748AC6759E7b8AAed8cDE43F818D"
PARTIES = {
    "buyer": "0x94A149382edDCB90C372DA449a068e70a4876785",
    "seller": "0xc842c25cEfD0DbA135C18F29860Cd69e6218Dac2",
    "agent": "0x1E249F893Aaa6a652965f16c83B41a1393aD6567",
    "challenger": "0x78d5465eECBF553f9Fe081Aa1016E58A27B70834",
}
TRANSACTIONS = [
    ("deploy", "buyer", None, DEPLOYMENT),
    ("accept_terms", "seller", None, "0x1aafa848e747e981c560cae36d6192f0faec51bb73797879d1578cae6a84a56f"),
    ("publish_claim", "seller", "inference-v1", "0xf38f8ff3a8fcf1a7cc3c1e10ee054f1b8af5b0a66feed9178b1a35336f41de7e"),
    ("evaluate_claim", "agent", "inference-v1", "0x4e1fec24cb8b1c6f24b6c90e576ff749476bf55945810f193d31ccfaffee0851"),
    ("challenge_claim", "challenger", "inference-v1", "0x9c24b197779dc5bb8ac350f14a3610f35e409de84f4b82fb3f47d06480f312ed"),
    ("resolve_challenge", "challenger", "inference-v1", "0x536d5987ea3a27a6ad0ef8e76163f477139aaf2cdf3daa98c065551b92cb705f"),
    ("cancel_purchase", "buyer", "p-inference-v1", "0x49ed299fd2285d90178a4606c4e03cc06bc1a3629ea039ba2aa2751915cebab1"),
    ("publish_claim", "seller", "inference-replacement", "0xd5e300d9888bc5d12b1f64a8a397cd95b70fcdbdb0625e3d73dbac168dc14371"),
    ("evaluate_claim", "agent", "inference-replacement", "0xe54a2df36ad54cd0a7d37170c1b9662c73baaccca9c76bd030f16342d0e1f1e1"),
    ("queue_purchase", "agent", "p-inference-replacement", "0x701e943337d475ab9931a0fa809fab91ed9fc63b63326ebbc58cf5649366958f"),
    ("execute_purchase", "buyer", "p-inference-replacement", "0x267bbe002366e6ba74dd69606df525753f10d3a0bb19d9b5390ba65f2915210f"),
]


def verify(session, rows, cfg):
    """Fail closed on mismatched state, role, amount, arguments or settlement."""
    require(session["contract"].lower() == CONTRACT.lower(), "Contract mismatch")
    state = session["snapshot"]
    a = state["agreement"]
    require(all(a[role].lower() == address.lower() for role, address in PARTIES.items()), "Party mismatch")
    require(a["accepted"] and int(a["reserved_wei"]) == 0 and int(a["spent_wei"]) == 4 * 10**16, "Accounting mismatch")
    claims = {c["id"]: c for c in state["claims"]}
    permits = {p["id"]: p for p in state["permits"]}
    require(set(claims) == {"inference-v1", "inference-replacement"}, "Unexpected claims; this is the two-offer run")
    require(set(permits) == {"p-inference-v1", "p-inference-replacement"}, "Unexpected permits")
    require(claims["inference-v1"]["status"] == "INVALID" and permits["p-inference-v1"]["status"] == "CANCELLED", "Original not cancelled")
    require(claims["inference-replacement"]["status"] == "VALID" and permits["p-inference-replacement"]["status"] == "SCHEDULED", "Replacement state mismatch")
    require(len(rows) == len(TRANSACTIONS), "Incomplete receipts")
    for (action, role, selected, tx_hash), row in zip(TRANSACTIONS, rows):
        require(row["hash"] == tx_hash and row["status"] == "FINALIZED" and row["execution"] == "SUCCESS", "Receipt not finalized successfully")
        require(row["from"].lower() == PARTIES[role].lower() and row["to"].lower() == CONTRACT.lower(), "Receipt parties mismatch")
        require(int(row["value_wei"]) == (4 * 10**16 if action == "execute_purchase" else 0), "Receipt value mismatch")
        if action == "deploy":
            require(row["source_sha256"] == cfg["source_sha256"], "Source mismatch")
            expected = [PARTIES[r] for r in ("seller", "agent", "challenger")] + [cfg["budget_wei"], cfg["criterion"], cfg["source_root"]]
        elif action == "publish_claim":
            offer = next(o for o in cfg["offers"] if o["id"] == selected)
            doc = cfg["evidence"][selected]
            expected = [selected, offer["statement"], PARTIES["seller"], offer["amount_wei"], doc["path"], doc["sha256"], offer["supersedes"]]
        elif action == "challenge_claim":
            doc = cfg["evidence"]["inference-amendment"]
            expected = [selected, doc["path"], doc["sha256"]]
        elif action == "queue_purchase":
            expected = [selected, "inference-replacement"]
        else:
            expected = [] if selected is None else [selected]
        require(action == "deploy" or row["method"] == action, "Method mismatch")
        require(row["args"] == expected, "Contract arguments mismatch")
    payment = rows[-1]
    child = payment.get("child", {})
    require(payment["settlement"] == "child-finalized" and child.get("status") == "FINALIZED", "Recipient transfer not finalized")
    require(child.get("triggered_by") == payment["hash"] and child.get("from_address", "").lower() == CONTRACT.lower(), "Transfer linkage mismatch")
    require(child.get("to_address", "").lower() == PARTIES["seller"].lower() and int(child.get("value", -1)) == 4 * 10**16, "Recipient or amount mismatch")
    return True


def observe():
    cfg = config()
    session = inspect(DEPLOYMENT)
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(receipt, [row[3] for row in TRANSACTIONS]))
    verify(session, rows, cfg)
    return {
        "schema_version": 1,
        "run": "Recall user-approved browser-wallet run, September 6–7, 2026",
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        "network": {"name": "GenLayer Studio hosted sandbox", "chain_id": 61999},
        "verification": "matched",
        "coverage": {
            "receipt_count": len(rows),
            "missing_receipts": ["Original queue_purchase hash was not captured; its cancelled permit is confirmed in finalized state."],
            "limits": ["Separate latest RPC reads, not an atomic snapshot or ongoing monitoring.",
                       "Browser-wallet approval provenance is user-reported; public receipts verify transaction identities and execution, not the signing interface.",
                       "Only original inference and replacement were tested in this run; storage, monitoring, adversarial trials and rejection/recovery tests are not claimed.",
                       "Recipient transfer verified; no before/after balance-delta measurement in this run.",
                       "Fictional pinned evidence and preselected replacement; not real service delivery, autonomous discovery or production-network settlement."]
        },
        "source_sha256": cfg["source_sha256"],
        "evidence": cfg["evidence"],
        "session": session,
        "receipts": rows,
    }


if __name__ == "__main__":
    print(json.dumps(observe(), indent=2, default=str))
