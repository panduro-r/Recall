"""Read-only review compatibility. No prepare, deploy or signing operation."""
import hashlib
import time
import rlp
from genlayer_py.abi import calldata
from purchase_flow import address, tx_hash, require, receipt, CHAIN
from studio_read import rpc

SOURCES = {
    "3e9ecae83f6ecbc99b503d635a39b5c324bb97216c5be20ad3c71cd1f89a0db4": 1,
    "3e1eca45854e5c2436b7221c6bccbd9a2b7cb325bb7e8f03f9af8a0458e2c017": 2,
    "3b2dfc95d5cb328b1c9b154138ce17e27dbcddb18fb0582f5f94d6cd8489ab93": 3,
    "3c37a073d3b61d0762b60d4a59c76ff172cf6f9838e3302c083169885b200019": 4,
    "9de762cd57968634da51770832b27285fde14bc5a39d35c502dcd7451445602c": 5,
    "e52b576dbe52ea11b0be8ee6869fc68cce63893f99f4e0588a52d45461deddf3": 6,
}


def inspect(deployment, read=rpc, *, chain_id=CHAIN, versions=None):
    deployment = tx_hash(deployment)
    row = receipt(deployment, read, chain_id=chain_id)
    versions = SOURCES if versions is None else versions
    require(row.get("status") == "FINALIZED" and row.get("execution") == "SUCCESS"
            and row.get("value_wei") == "0" and row.get("source_sha256") in versions
            and len(row.get("args", [])) == 1,
            "Wait for a successful matching review receipt. Do not submit again.")
    tx = read("eth_getTransactionByHash", [deployment])
    require(isinstance(tx, dict) and tx.get("hash", "").lower() == deployment, "Mismatched review transaction.")
    contract = address(tx.get("data", {}).get("contract_address") or tx.get("to_address"))
    account = address(row["from"])
    # Preserve legacy Studio encoding; Next uses the pinned SDK's new selector.
    selector = {"": "snapshot"} if chain_id == 61997 else {"method": "snapshot", "args": []}
    data = "0x" + rlp.encode([calldata.encode(selector), b"\x00"]).hex()
    response = read("gen_call", [{"type": "read", "from": account, "to": contract,
        "data": data, "transaction_hash_variant": "latest-final"}])
    state = calldata.decode(bytes.fromhex(response.removeprefix("0x")))
    require(isinstance(state, dict) and state.get("version") == versions[row["source_sha256"]]
            and state.get("kind") == "provider-review" and state.get("account", "").lower() == account.lower()
            and state.get("evidence_json") == row["args"][0]
            and state.get("digest") == hashlib.sha256(row["args"][0].encode()).hexdigest(),
            "Review state does not match the submitted evidence.")
    return {"deployment": deployment, "contract": contract, "state": state, "receipt": row, "observed_at": time.time()}


def dispatch(data, read=rpc):
    require(isinstance(data, dict), "Expected a review request.")
    if data.get("op") == "receipt" and set(data) == {"op", "hash"}:
        return receipt(data["hash"], read)
    if data.get("op") == "inspect" and set(data) == {"op", "deployment"}:
        return inspect(data["deployment"], read)
    raise ValueError("Historical reviews are read-only.")
