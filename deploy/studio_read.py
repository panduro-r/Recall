"""Bounded, public-only Studio observations. No signer or transaction submission."""
import base64
from concurrent.futures import ThreadPoolExecutor
import hashlib
import http.client
import json
import time

import rlp
from genlayer_py.abi import calldata

RPC = "https://studio.genlayer.com/api"
CONTRACT = "0xD8Fe7c1B58499674b32Eb35B402cB09941d17f82"
METHODS = frozenset(("eth_chainId", "eth_getBalance", "eth_getTransactionByHash", "gen_call",
                     "eth_gasPrice", "eth_estimateGas", "eth_getTransactionCount", "sim_getConsensusContract"))
MAX_RESPONSE = 1024 * 1024


def rpc(method, params):
    if method not in METHODS:
        raise ValueError("Read-only RPC methods only")
    # Fixed TLS destination, no redirects, bounded response and socket timeout.
    connection = http.client.HTTPSConnection("studio.genlayer.com", timeout=5)
    try:
        connection.request("POST", "/api", json.dumps({"jsonrpc": "2.0", "id": 1,
                           "method": method, "params": params}), {"Content-Type": "application/json"})
        response = connection.getresponse()
        body = response.read(MAX_RESPONSE + 1)
        if response.status != 200 or len(body) > MAX_RESPONSE:
            raise ValueError("Studio response unavailable")
        data = json.loads(body)
        if not isinstance(data, dict) or data.get("id") != 1 or "error" in data or "result" not in data:
            raise ValueError("Invalid Studio response")
        return data["result"]
    finally:
        connection.close()


def normalized(value):
    if isinstance(value, dict):
        return {key: normalized(item) for key, item in value.items()}
    if isinstance(value, list):
        return [normalized(item) for item in value]
    return str(value) if type(value) is int else value


def observe(report, read=rpc):
    """Compare with the fixed public export; never accept a browser-supplied target."""
    if report["contract"] != CONTRACT or report["rpc"] != RPC or report["chain_id"] != 61999:
        raise ValueError("Unsupported recorded deployment")
    started = time.time()
    checks = []

    def check(label, operation):
        try:
            matches, detail = operation()
            return {"label": label, "status": "matched" if matches else "mismatch", "detail": detail}
        except (OSError, ValueError, TypeError, KeyError, IndexError, AttributeError, http.client.HTTPException):
            return {"label": label, "status": "unavailable", "detail": "Studio did not return a usable response. Retry the check."}

    chain = check("Studio chain", lambda: (int(read("eth_chainId", []), 16) == 61999, "Expected chain 61999."))
    checks.append(chain)
    if chain["status"] == "matched":
        state = report["final_state"]
        buyer = state["agreement"]["buyer"]
        transfers = report["independent_verification"]["child_transfers"]
        steps = {step["step"]: step for step in report["steps"]}

        def snapshot():
            data = "0x" + rlp.encode([calldata.encode({"method": "snapshot", "args": []}), b"\x00"]).hex()
            result = read("gen_call", [{"type": "read", "from": buyer, "to": CONTRACT,
                          "data": data, "transaction_hash_variant": "latest-final"}])
            actual = calldata.decode(bytes.fromhex(result.removeprefix("0x")))
            return normalized(actual) == normalized(state), "Compared the latest finalized snapshot with the recorded snapshot."

        def source():
            tx = read("eth_getTransactionByHash", [steps["deploy"]["transaction_hash"]])
            digest = hashlib.sha256(base64.b64decode(tx["data"]["contract_code"], validate=True)).hexdigest()
            return (tx["hash"] == steps["deploy"]["transaction_hash"] and tx["status"] == "FINALIZED"
                    and digest == report["source_sha256"]), "Deployment source SHA-256: " + digest

        def balance(role, address):
            actual = int(read("eth_getBalance", [address, "latest"]), 16)
            expected = int(report["final_balances"][role])
            return actual == expected, f"Latest: {actual} wei · Recorded: {expected} wei."

        def payment(expected):
            parent = read("eth_getTransactionByHash", [expected["triggered_by"]])
            child = read("eth_getTransactionByHash", [expected["hash"]])
            matches = (parent["hash"] == expected["triggered_by"] and parent["status"] == "FINALIZED"
                       and parent["from_address"].lower() == buyer.lower()
                       and parent["to_address"].lower() == CONTRACT.lower()
                       and int(parent["value"]) == int(expected["value"])
                       and parent["triggered_transactions"] == [expected["hash"]]
                       and child["status"] == "FINALIZED"
                       and all(child[key] == expected[key] for key in ("hash", "status", "triggered_by"))
                       and all(child[key].lower() == expected[key].lower() for key in ("from_address", "to_address"))
                       and int(child["value"]) == int(expected["value"]))
            return matches, "Compared finalized parent and child, linkage, sender, recipient and exact amount."

        roles = {"buyer": buyer, "contract": CONTRACT}
        for name in ("storage-v1", "monitoring-v1", "inference-replacement"):
            roles[name.split("-")[0]] = next(c["recipient"] for c in state["claims"] if c["id"] == name)
        jobs = [("Finalized contract state", snapshot), ("Deployed source", source)]
        jobs += [(role.capitalize() + " balance", lambda r=role, a=address: balance(r, a)) for role, address in roles.items()]
        jobs += [(role.capitalize() + " payment receipt", lambda t=transfer: payment(t))
                 for role, transfer in zip(("storage", "monitoring", "inference"), transfers)]
        with ThreadPoolExecutor(max_workers=6) as pool:
            checks.extend(pool.map(lambda job: check(*job), jobs))
    statuses = {row["status"] for row in checks}
    return {"status": "mismatch" if "mismatch" in statuses else "unavailable" if "unavailable" in statuses else "matched",
            "started_at": started, "observed_at": time.time(), "rpc": RPC, "contract": CONTRACT,
            "checks": checks, "scope": "Read-only Studio sandbox observation. Separate latest reads, not an atomic block snapshot. The recorded view is unchanged."}
