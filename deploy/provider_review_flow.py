"""Unsigned Studio-only review deployment. Never signs, purchases or pays a provider."""
import base64
import hashlib
import json
import time
from pathlib import Path
import rlp
from genlayer_py.abi import calldata
from web3 import Web3
from purchase_flow import address, tx_hash, require, chain_check, execution, receipt, CHAIN, ZERO
from studio_read import rpc
from provider_evidence import capture, validate_payload

SOURCE = Path(__file__).resolve().parent / "contracts/provider_review.py"
# Read-only compatibility for already-approved immutable reviews. New
# preparations always use SOURCE; an old source is never selected for deployment.
LEGACY_SOURCES = {"3e9ecae83f6ecbc99b503d635a39b5c324bb97216c5be20ad3c71cd1f89a0db4": 1,
                  "3e1eca45854e5c2436b7221c6bccbd9a2b7cb325bb7e8f03f9af8a0458e2c017": 2}


def config():
    return {"version": 3, "chain_id": CHAIN, "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
            "notice": "Studio preview. Review-only contract; not a provider agreement or payment. This updated contract has local tests but still needs wallet-approved live validation."}


def prepare(request, read=rpc):
    require(isinstance(request, dict) and set(request) == {"account", "payload"}, "Unexpected review fields.")
    account = address(request["account"])
    validate_payload(request["payload"])
    chain_check(read)
    require(int(read("eth_gasPrice", []), 16) == 0, "Unsupported Studio transport. Nothing was submitted.")
    router = read("sim_getConsensusContract", ["ConsensusMain"])
    functions = [f for f in router.get("abi", []) if f.get("name") == "addTransaction"]
    require(router.get("address", "").lower() == ZERO and len(functions) == 1 and
            [x["type"] for x in functions[0]["inputs"]] == ["address", "address", "uint256", "uint256", "bytes"],
            "Studio transaction policy changed. This preview cannot request approval on this router.")
    # Stable Studio compatibility router only. Fee-enabled v0.6 routers fail closed;
    # a zero EVM gas price is not evidence of zero protocol fees on other versions.
    args = [request["payload"]]
    payload = rlp.encode([SOURCE.read_bytes(), calldata.encode({"args": args}), b""])
    encoded = Web3().eth.contract(abi=functions).encode_abi("addTransaction", args=[account, ZERO, 5, 3, payload])
    tx = {"from": account, "to": ZERO, "chainId": hex(CHAIN), "value": "0x0", "data": encoded, "gasPrice": "0x0"}
    tx["gas"] = hex(int(read("eth_estimateGas", [{"from": account, "to": ZERO, "data": encoded, "value": "0x0"}]), 16))
    tx["nonce"] = hex(int(read("eth_getTransactionCount", [account, "pending"]), 16))
    require(int(tx["gas"], 16) > 0, "Invalid gas estimate.")
    review = {"action": "deploy", "account": account, "contract": ZERO, "recipient": "", "value_wei": "0",
              "args": args, "chain_id": CHAIN, "source_sha256": config()["source_sha256"]}
    return {"review": review, "transaction": tx, "prepared_at": time.time(),
            "intent_id": hashlib.sha256(json.dumps(review, sort_keys=True).encode()).hexdigest()}


def inspect(deployment, read=rpc):
    deployment = tx_hash(deployment)
    row = receipt(deployment, read)
    versions = {**LEGACY_SOURCES, config()["source_sha256"]: 3}
    require(row.get("status") == "FINALIZED" and row.get("execution") == "SUCCESS" and row.get("value_wei") == "0"
            and row.get("source_sha256") in versions and len(row.get("args", [])) == 1,
            "Wait for a successful matching review receipt. Do not submit again.")
    tx = read("eth_getTransactionByHash", [deployment])
    require(isinstance(tx, dict) and tx.get("hash", "").lower() == deployment, "Mismatched review transaction.")
    contract = address(tx.get("data", {}).get("contract_address") or tx.get("to_address"))
    account = address(row["from"])
    data = "0x" + rlp.encode([calldata.encode({"method": "snapshot", "args": []}), b"\x00"]).hex()
    response = read("gen_call", [{"type": "read", "from": account, "to": contract, "data": data, "transaction_hash_variant": "latest-final"}])
    state = calldata.decode(bytes.fromhex(response.removeprefix("0x")))
    require(isinstance(state, dict) and state.get("version") == versions[row["source_sha256"]] and state.get("kind") == "provider-review"
            and state.get("account", "").lower() == account.lower() and state.get("evidence_json") == row["args"][0]
            and state.get("digest") == hashlib.sha256(row["args"][0].encode()).hexdigest(), "Review state does not match the submitted evidence.")
    return {"deployment": deployment, "contract": contract, "state": state, "receipt": row, "observed_at": time.time()}


def dispatch(data, read=rpc):
    require(isinstance(data, dict), "Expected a review request.")
    op = data.get("op")
    if op == "config" and set(data) == {"op"}: return config()
    if op == "capture" and set(data) == {"op", "request"}: return capture(data["request"])
    if op == "prepare" and set(data) == {"op", "request"}: return prepare(data["request"], read)
    if op == "receipt" and set(data) == {"op", "hash"}: return receipt(data["hash"], read)
    if op == "inspect" and set(data) == {"op", "deployment"}: return inspect(data["deployment"], read)
    raise ValueError("Unknown review request.")
