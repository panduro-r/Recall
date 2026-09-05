"""Explicitly send the public Recall source to Studio for schema validation.

This compiles source remotely; it does not deploy or sign a transaction.
"""
import hashlib
import json
from pathlib import Path
from preflight import rpc, RPC

BASE = Path(__file__).resolve().parents[1]


def main():
    chain_id = int(rpc("eth_chainId", []), 16)
    if chain_id != 61999:
        raise RuntimeError("Wrong chain ID")
    code = (BASE / "contracts/recall.py").read_bytes()
    result = rpc("gen_getContractSchemaForCode", ["0x" + code.hex()])
    report = {"rpc": RPC, "chain_id": chain_id,
              "source_sha256": hashlib.sha256(code).hexdigest(), "schema": result,
              "deployed": False, "transactions_submitted": 0}
    (BASE / "live/compile-result.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
