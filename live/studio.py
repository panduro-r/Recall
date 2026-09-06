"""Explicit, resumable hosted-Studio tests using disposable local accounts.

Never use this adapter for Bradbury or real assets. No provider/validator overrides.
"""
import argparse
import hashlib
import json
import os
import time
from pathlib import Path

import rlp
from eth_account import Account
from genlayer_py.abi import calldata
from web3 import Web3

from preflight import rpc, RPC

BASE = Path(__file__).resolve().parents[1]
PRIVATE = BASE / "live/private"
REPORT = BASE / "live/run-result.json"
ZERO = "0x" + "0" * 40
COMMIT = "9fd77d5348f183b62239bfd4c37e98c06c760d9d"
ROOT = f"https://raw.githubusercontent.com/panduro-r/Recall/{COMMIT}/"
ROLES = ("buyer", "seller", "agent", "challenger", "inference", "storage", "monitoring")
ABI_TYPES = ["address", "address", "uint256", "uint256", "bytes"]


def save(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    with os.fdopen(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    temporary.replace(path)


def accounts():
    PRIVATE.mkdir(mode=0o700, exist_ok=True)
    PRIVATE.chmod(0o700)
    path = PRIVATE / "accounts.json"
    if not path.exists():
        if REPORT.exists():
            raise RuntimeError("Existing run has lost its accounts; do not silently replace them")
        save(path, {role: Account.create().key.hex() for role in ROLES})
    path.chmod(0o600)
    return {role: Account.from_key(key) for role, key in json.loads(path.read_text()).items()}


def checked_abi():
    if int(rpc("eth_chainId", []), 16) != 61999:
        raise RuntimeError("Not the authorized Studio chain 61999")
    if int(rpc("eth_gasPrice", []), 16) != 0:
        raise RuntimeError("Expected gasless Studio; refusing paid transport")
    router = rpc("sim_getConsensusContract", ["ConsensusMain"])
    functions = [f for f in router["abi"] if f.get("name") == "addTransaction"]
    if router["address"].lower() != ZERO or len(functions) != 1 or [i["type"] for i in functions[0]["inputs"]] != ABI_TYPES:
        raise RuntimeError("Unrecognized Studio routing ABI; inspect before signing")
    return router["abi"]


def inner_payload(method, args, code=None):
    obj = {"args": args}
    if method is not None:
        obj["method"] = method
    encoded = calldata.encode(obj)
    # Empty bytes encode false (normal consensus), matching Studio's RLP format.
    return rlp.encode([code, encoded, b""] if code is not None else [encoded, b""])


def validate_payment(report, keys, role, method, args, value):
    """Only exact, eligible payments to this run's disposable recipients."""
    if not isinstance(value, int) or value < 0 or value > 10**17:
        raise ValueError("Sandbox payment exceeds the fixed 0.100 test-GEN bound")
    if value == 0:
        return
    if role != "buyer" or method != "execute_purchase" or len(args) != 1:
        raise ValueError("Value is permitted only for buyer execute_purchase")
    snap = read_snapshot(report, keys)
    permit = next(p for p in snap["permits"] if p["id"] == args[0])
    claim = next(c for c in snap["claims"] if c["id"] == permit["claim_id"])
    allowed = {keys[r].address.lower() for r in ("inference", "storage", "monitoring")}
    if permit["recipient"].lower() not in allowed or snap["agreement"]["buyer"].lower() != keys["buyer"].address.lower():
        raise ValueError("Payment recipient or buyer is outside this isolated run")
    if permit["status"] != "RESERVED" or claim["status"] != "VALID" or int(permit["amount_wei"]) != value:
        raise ValueError("Payment must match an eligible reserved permit exactly")
    if time.time() < claim["review_until"] + 5 or time.time() >= snap["agreement"]["expires_at"]:
        raise ValueError("Payment outside the safe review/expiry window")
    total = sum(t["request"].get("value", 0) for t in report["transactions"].values()) + value
    if total > 10**17:
        raise ValueError("Total submitted test value exceeds 0.100 GEN")
    if int(rpc("eth_getBalance", [keys["buyer"].address, "latest"]), 16) < value:
        raise ValueError("Insufficient explicit sandbox balance; no implicit funding")


def submit(report, keys, label, role, method, args, value=0):
    abi = checked_abi()
    if not label or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-_" for c in label):
        raise ValueError("Use a simple lowercase transaction label")
    request = {"role": role, "method": method, "args": args}
    if value:
        request["value"] = value
    if label in report["transactions"]:
        old = report["transactions"][label]
        if old["request"] != request:
            raise RuntimeError("Label already belongs to a different request")
        print(json.dumps({"existing": old["hash"], "note": "Not resubmitted; use status"}))
        return
    validate_payment(report, keys, role, method, args, value)
    for prior in report["transactions"].values():
        if prior.get("status") not in ("FINALIZED", "ACCEPTED", "UNDETERMINED", "CANCELED"):
            raise RuntimeError("Inspect pending transaction with status before submitting another")
    code = (BASE / "contracts/recall.py").read_bytes() if method is None else None
    if code is not None and hashlib.sha256(code).hexdigest() != report["source_sha256"]:
        raise RuntimeError("Source changed during this run")
    recipient = ZERO if code is not None else report["contract"]
    account = keys[role]
    encoded = Web3().eth.contract(abi=abi).encode_abi("addTransaction", args=[
        account.address, recipient, 5, 3, inner_payload(method, args, code)])
    tx = {"chainId": 61999, "nonce": int(rpc("eth_getTransactionCount", [account.address, "pending"]), 16),
          "to": ZERO, "value": value, "gasPrice": 0, "data": encoded}
    tx["gas"] = int(rpc("eth_estimateGas", [{"from": account.address, "to": ZERO, "data": encoded, "value": hex(value)}]), 16)
    signed = account.sign_transaction(tx)
    raw = "0x" + signed.raw_transaction.hex()
    tx_hash = "0x" + Web3.keccak(signed.raw_transaction).hex()
    save(PRIVATE / f"{label}.json", {"raw": raw, "hash": tx_hash})
    report["transactions"][label] = {"request": request, "hash": tx_hash, "status": "SUBMISSION_UNCONFIRMED", "submitted_at": time.time()}
    save(REPORT, report)
    result = rpc("eth_sendRawTransaction", [raw])
    if result.lower() != tx_hash.lower():
        raise RuntimeError(f"Unexpected returned transaction hash: {result}; inspect before retrying")
    report["transactions"][label]["status"] = "PENDING"
    save(REPORT, report)
    print(json.dumps({"label": label, "hash": result, "status": "PENDING"}))


def status(report):
    for label, tx in report["transactions"].items():
        result = tx.get("receipt") if tx.get("status") == "FINALIZED" else rpc("eth_getTransactionByHash", [tx["hash"]])
        if result is None:
            print(json.dumps({"label": label, "status": "NOT_FOUND", "hash": tx["hash"]}))
            continue
        tx["receipt"] = result
        tx["status"] = result.get("status", "UNKNOWN")
        if tx["request"]["method"] is None:
            address = result.get("data", {}).get("contract_address") or result.get("to_address")
            if address and address.lower() != ZERO and tx["status"] in ("ACCEPTED", "FINALIZED"):
                report["contract"] = address
        save(REPORT, report)
        consensus = result.get("consensus_data") or {}
        leaders = [x for x in consensus.get("leader_receipt", []) if x.get("mode") == "leader"]
        print(json.dumps({"label": label, "hash": tx["hash"], "status": tx["status"],
            "execution": [x.get("execution_result") for x in leaders], "contract": report.get("contract")}))


def read_snapshot(report, keys):
    encoded = rlp.encode([calldata.encode({"method": "snapshot", "args": []}), b"\x00"])
    result = rpc("gen_call", [{"type": "read", "to": report["contract"], "from": keys["buyer"].address,
        "data": "0x" + encoded.hex(), "transaction_hash_variant": "latest-nonfinal"}])
    decoded = calldata.decode(bytes.fromhex(result.removeprefix("0x")))
    report["snapshot"] = decoded
    save(REPORT, report)
    return decoded


def snapshot(report, keys):
    decoded = read_snapshot(report, keys)
    print(json.dumps(decoded, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["deploy", "send", "status", "snapshot"])
    parser.add_argument("--label")
    parser.add_argument("--role", choices=ROLES, default="buyer")
    parser.add_argument("--method")
    parser.add_argument("--args", default="[]", help="JSON array; @role references a disposable address")
    opts = parser.parse_args()
    keys = accounts()
    report = json.loads(REPORT.read_text()) if REPORT.exists() else {
        "rpc": RPC, "chain_id": 61999, "evidence_commit": COMMIT,
        "source_sha256": hashlib.sha256((BASE / "contracts/recall.py").read_bytes()).hexdigest(),
        "accounts": {r: k.address for r, k in keys.items()}, "transactions": {}}
    if report["accounts"] != {r: k.address for r, k in keys.items()}:
        raise RuntimeError("Account journal mismatch")
    if opts.command == "deploy":
        args = [keys[r].address for r in ("seller", "agent", "challenger")] + [
            "100000000000000000", "All customer payloads and customer-identifying logs must be processed and stored only in the EU, with no non-EU failover or support access.", ROOT]
        submit(report, keys, "deploy", "buyer", None, args)
    elif opts.command == "send":
        args = json.loads(opts.args)
        if not isinstance(args, list) or not opts.label or not opts.method:
            raise ValueError("send requires label, method, and a JSON args array")
        args = [keys[a[1:]].address if isinstance(a, str) and a.startswith("@") else a for a in args]
        submit(report, keys, opts.label, opts.role, opts.method, args)
    elif opts.command == "status":
        status(report)
    else:
        snapshot(report, keys)


if __name__ == "__main__":
    main()
