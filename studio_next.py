"""Studio Next transport and explicit protocol-fee envelopes. Never signs.

Legacy observations stay in studio_read.py on 61999. These constants identify
the distinct, fee-enabled Studio Next network; a hostname alias is not enough.
"""
import hashlib
import http.client
import json
import time

import rlp
from genlayer_py.abi import calldata
from purchase_flow import address, require, ZERO

CHAIN = 61997
RPC = "https://studio-dev.genlayer.com/api"
EXPLORER = "https://explorer-studio-dev.genlayer.com"
ROUTER = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575"
MAX_FEE_WEI = 5 * 10**16
READS = frozenset({"eth_chainId", "eth_getBalance", "eth_getTransactionByHash",
                  "eth_gasPrice", "eth_estimateGas", "eth_getTransactionCount",
                  "sim_getConsensusContract", "sim_getFeeConfig", "gen_call"})


class RpcError(ValueError):
    def __init__(self, method, error):
        self.method, self.error = method, error
        super().__init__("Studio Next RPC failed: " + str(error.get("code", "unknown")))


def _request(method, params):
    """Fixed destination, bounded response, no redirects or automatic retries."""
    connection = http.client.HTTPSConnection("studio-dev.genlayer.com", timeout=20)
    try:
        connection.request("POST", "/api", json.dumps({"jsonrpc": "2.0", "id": 1,
                           "method": method, "params": params}), {"Content-Type": "application/json"})
        response = connection.getresponse()
        limit = 16 * 1024 * 1024 if method == "eth_getTransactionByHash" else 1024 * 1024
        body = response.read(limit + 1)
        require(response.status == 200 and len(body) <= limit, "Studio Next response unavailable or too large.")
        value = json.loads(body)
        require(isinstance(value, dict) and value.get("id") == 1, "Invalid Studio Next response.")
        if isinstance(value.get("error"), dict):
            raise RpcError(method, value["error"])
        require("result" in value and "error" not in value, "Invalid Studio Next response.")
        return value["result"]
    finally:
        connection.close()


def rpc(method, params):
    require(method in READS, "Read-only Studio Next RPC methods only.")
    return _request(method, params)


def snapshot_calldata():
    # Studio Next's pinned SDK entry_calldata.normalize and genlayer-py's
    # make_calldata_object use the empty-string method selector, not "method".
    return "0x" + rlp.encode([calldata.encode({"": "snapshot"}), b"\x00"]).hex()


def preflight(read=rpc):
    require(int(read("eth_chainId", []), 16) == CHAIN, "Expected Studio Next chain 61997.")
    require(int(read("eth_gasPrice", []), 16) == 0, "Unexpected EVM gas price; prepare a new fee policy first.")
    router = read("sim_getConsensusContract", ["ConsensusMain"])
    require(isinstance(router, dict) and router.get("address", "").lower() == ROUTER.lower(),
            "Studio Next router changed. Signing is disabled until it is verified.")
    raw = read("sim_getFeeConfig", [])
    require(isinstance(raw, dict) and raw.get("enabled") is True, "Studio Next fee policy unavailable.")
    return raw


def prepare_deployment(account, source, args, *, read=rpc, now=None):
    # Import lazily: archived reads do not require the new fee SDK.
    from genlayer_py.transactions.fees import (extract_studio_fee_policy,
        build_estimated_fees_distribution, calculate_local_round_fees,
        normalize_transaction_fees, encode_fee_aware_add_transaction_data)
    account = address(account)
    require(isinstance(source, bytes) and 0 < len(source) <= 200000 and isinstance(args, list), "Invalid deployment.")
    raw_policy = preflight(read)
    policy = extract_studio_fee_policy(raw_policy)
    # Bootstrap budget, NOT a measured cost prediction. Replace with a measured
    # profile only after inspecting successful Next receipts. No child payments.
    distribution = build_estimated_fees_distribution({
        "leaderTimeunitsAllocation": 600, "validatorTimeunitsAllocation": 600,
        "appealRounds": 0, "rotations": [3], "executionBudgetPerRound": 5 * 10**15,
        "totalMessageFees": 0}, policy, 3)
    fee = calculate_local_round_fees(distribution, 5, policy)
    require(0 < fee <= MAX_FEE_WEI, "Protocol fee exceeds the 0.05 test GEN safety limit.")
    require(int(read("eth_getBalance", [account, "latest"]), 16) >= fee,
            "Insufficient Studio Next test GEN for the protocol fee. Stable Studio balances are separate.")
    payload = rlp.encode([source, calldata.encode({"args": args}), b""])
    require(len(payload) <= 400000, "Deployment payload exceeds the migration bound.")
    normalized = normalize_transaction_fees({"distribution": distribution, "feeValue": fee})
    encoded = encode_fee_aware_add_transaction_data(sender_address=account, recipient_address=ZERO,
        num_of_initial_validators=5, max_rotations=3, tx_data=payload, valid_until=0,
        user_value=0, transaction_fees=normalized)
    tx = {"from": account, "to": ROUTER, "chainId": hex(CHAIN), "value": hex(fee),
          "data": encoded, "gasPrice": "0x0"}
    tx["gas"] = hex(int(read("eth_estimateGas", [tx]), 16))
    tx["nonce"] = hex(int(read("eth_getTransactionCount", [account, "pending"]), 16))
    require(0 < int(tx["gas"], 16) <= 100000000, "Invalid Studio Next gas estimate.")
    review = {"action": "deploy", "account": account, "contract": ZERO, "recipient": "",
              "value_wei": "0", "protocol_fee_wei": str(fee), "chain_id": CHAIN,
              "router": ROUTER, "source_sha256": hashlib.sha256(source).hexdigest(), "args": args,
              "fee_distribution": {k: [str(n) for n in v] if isinstance(v, list) else str(v)
                                   for k, v in distribution.items()}, "fee_profile": "migration-bootstrap-v1"}
    return {"review": review, "transaction": tx, "prepared_at": time.time() if now is None else now,
            "intent_id": hashlib.sha256(json.dumps(review, sort_keys=True).encode()).hexdigest()}
