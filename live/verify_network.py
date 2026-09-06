"""Read-only independent check of a completed full-flow run, including child transfers.

Prints a public JSON observation. Never reads signing keys or sends transactions.
"""
import base64
import hashlib
import json
from pathlib import Path
import time

import rlp
from genlayer_py.abi import calldata
from preflight import rpc, RPC


def verify(run):
    if not run.get("completed") or int(rpc("eth_chainId", []), 16) != 61999:
        raise ValueError("Require a completed run on Studio 61999")
    deployment = rpc("eth_getTransactionByHash", [run["transactions"]["deploy"]["hash"]])
    digest = hashlib.sha256(base64.b64decode(deployment["data"]["contract_code"])).hexdigest()
    assert deployment["status"] == "FINALIZED" and digest == run["source_sha256"]
    data = "0x" + rlp.encode([calldata.encode({"method": "snapshot", "args": []}), b"\x00"]).hex()
    result = rpc("gen_call", [{"type": "read", "from": run["accounts"]["buyer"], "to": run["contract"],
                               "data": data, "transaction_hash_variant": "latest-final"}])
    state = calldata.decode(bytes.fromhex(result.removeprefix("0x")))
    assert state == run["snapshot"], "Finalized state differs from recorded state"
    balances = {r: int(rpc("eth_getBalance", [run["accounts"][r], "latest"]), 16)
                for r in ("buyer", "inference", "storage", "monitoring")}
    balances["contract"] = int(rpc("eth_getBalance", [run["contract"], "latest"]), 16)
    assert balances == {"buyer": 2*10**16, "inference": 4*10**16, "storage": 2*10**16, "monitoring": 2*10**16, "contract": 0}
    transfers = []
    for name, role, amount in [("storage-v1", "storage", 2*10**16), ("monitoring-v1", "monitoring", 2*10**16), ("inference-replacement", "inference", 4*10**16)]:
        parent = rpc("eth_getTransactionByHash", [run["transactions"]["pay-" + name]["hash"]])
        assert parent["status"] == "FINALIZED" and parent["value"] == amount
        children = parent["triggered_transactions"]
        assert len(children) == 1, "Expected exactly one outbound transfer per payment"
        child = rpc("eth_getTransactionByHash", [children[0]])
        assert child["status"] == "FINALIZED" and child["value"] == amount
        assert child["from_address"].lower() == run["contract"].lower()
        assert child["to_address"].lower() == run["accounts"][role].lower()
        assert child["triggered_by"] == parent["hash"]
        transfers.append({k: child[k] for k in ("hash", "status", "from_address", "to_address", "value", "triggered_by")})
    return {"rpc": RPC, "observed_at": time.time(), "state_variant": "latest-final",
            "deployed_source_sha256": digest, "finalized_state_matches": True,
            "balances": balances, "child_transfers": transfers}


if __name__ == "__main__":
    run = json.loads((Path(__file__).resolve().parent / "flow-result.json").read_text())
    print(json.dumps(verify(run), indent=2))
