"""Read-only checks against the official stable Studio endpoint."""
import hashlib
import json
from pathlib import Path
import time
import requests

BASE = Path(__file__).resolve().parents[1]
RPC = "https://studio.genlayer.com/api"


def rpc(method, params):
    response = requests.post(RPC, json={"jsonrpc": "2.0", "id": 1,
                             "method": method, "params": params}, timeout=25)
    response.raise_for_status()
    data = response.json()
    if "error" in data:
        raise RuntimeError(json.dumps(data["error"]))
    return data["result"]


def main():
    code = (BASE / "contracts/recall.py").read_bytes()
    report = {"rpc": RPC, "observed_at": time.time(),
              "contract_sha256": hashlib.sha256(code).hexdigest(), "checks": {}}
    checks = [("chain_id", "eth_chainId", []),
              ("fee_config", "sim_getFeeConfig", []),
              ("consensus_main", "sim_getConsensusContract", ["ConsensusMain"]),
              ("consensus_data", "sim_getConsensusContract", ["ConsensusData"])]
    for name, method, params in checks:
        started = time.monotonic()
        try:
            value = rpc(method, params)
            if name.startswith("consensus_"):
                value = {"address": value.get("address"), "abi_functions": [e["name"] for e in value.get("abi", []) if e.get("type") == "function"]}
            if name == "chain_id" and int(value, 16) != 61999:
                raise RuntimeError("Wrong chain: refusing stable Studio experiment")
            report["checks"][name] = {"ok": True, "result": value}
            if name.startswith("consensus_") and value.get("address") == "0x" + "0" * 40:
                report["checks"][name].update(ok=False, error="Zero consensus address: do not use this as a standard SDK deployment target.")
        except Exception as error:
            report["checks"][name] = {"ok": False, "error": str(error)[:1200]}
        report["checks"][name]["seconds"] = round(time.monotonic() - started, 2)
        print(json.dumps({name: report["checks"][name]}), flush=True)
    target = BASE / "live/preflight-result.json"
    target.write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
