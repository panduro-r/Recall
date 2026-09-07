"""Unsigned, Studio-only purchase preparation. This module never signs or submits."""
import base64
import hashlib
import json
from pathlib import Path
import re
import time
from datetime import datetime, timezone

import rlp
from genlayer_py.abi import calldata
from web3 import Web3
from studio_read import rpc, RPC

BASE = Path(__file__).resolve().parent
ZERO = "0x" + "0" * 40
CHAIN = 61999
LIMIT = 10**17
ROLES = {"accept_terms": ("seller",), "publish_claim": ("seller",),
         "evaluate_claim": ("buyer", "agent"), "queue_purchase": ("buyer", "agent"),
         "challenge_claim": ("challenger",), "resolve_challenge": ("buyer", "seller", "agent", "challenger"),
         "cancel_purchase": ("buyer",), "execute_purchase": ("buyer",)}


def require(ok, message):
    if not ok:
        raise ValueError(message)


def address(value):
    require(isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{40}", value) and value.lower() != ZERO,
            "Enter a nonzero public wallet address (0x followed by 40 hex characters).")
    return Web3.to_checksum_address(value)


def tx_hash(value):
    require(isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{64}", value), "Enter a full transaction hash.")
    return value.lower()


def config():
    report = json.loads((BASE / "live/full-flow-report.json").read_text())
    code = (BASE / "contracts/recall.py").read_bytes()
    require(hashlib.sha256(code).hexdigest() == report["source_sha256"], "Contract source changed; reverify before wallet integration.")
    for name, doc in report["evidence"].items():
        require(hashlib.sha256((BASE / "evidence/flow" / (name + ".txt")).read_bytes()).hexdigest() == doc["sha256"],
                "Pinned evidence changed; restore the verified export.")
    return {"chain_id": CHAIN, "rpc": RPC, "source_sha256": report["source_sha256"],
            "source_root": report["final_state"]["agreement"]["source_root"],
            "criterion": report["final_state"]["agreement"]["criterion"],
            "budget_wei": str(LIMIT), "evidence": report["evidence"],
            "offers": [{"id": name, "statement": claim["statement"], "amount_wei": claim["amount_wei"],
                        "supersedes": claim["supersedes"]}
                       for name in ("inference-v1", "storage-v1", "monitoring-v1", "inference-replacement")
                       for claim in report["final_state"]["claims"] if claim["id"] == name]}


def execution(tx):
    leaders = [row for row in (tx.get("consensus_data") or {}).get("leader_receipt", []) if row.get("mode") == "leader"]
    return leaders[-1].get("execution_result", "UNKNOWN") if leaders else "UNKNOWN"


def chain_check(read):
    require(int(read("eth_chainId", []), 16) == CHAIN, "Studio network changed. Wallet requests are disabled.")


def inspect(deployment, read=rpc):
    deployment = tx_hash(deployment)
    chain_check(read)
    cfg = config()
    tx = read("eth_getTransactionByHash", [tx_hash(deployment)])
    require(isinstance(tx, dict) and tx.get("hash", "").lower() == deployment.lower(), "Deployment receipt not found. Wait and refresh; do not redeploy automatically.")
    require(tx.get("status") == "FINALIZED" and execution(tx) == "SUCCESS", "Deployment is not finalized with successful execution yet.")
    code = base64.b64decode(tx.get("data", {}).get("contract_code", ""), validate=True)
    require(hashlib.sha256(code).hexdigest() == cfg["source_sha256"], "This deployment does not contain the verified Recall contract.")
    contract = address(tx.get("data", {}).get("contract_address") or tx.get("to_address"))
    buyer = address(tx["from_address"])
    data = "0x" + rlp.encode([calldata.encode({"method": "snapshot", "args": []}), b"\x00"]).hex()
    result = read("gen_call", [{"type": "read", "from": buyer, "to": contract, "data": data,
                              "transaction_hash_variant": "latest-final"}])
    state = calldata.decode(bytes.fromhex(result.removeprefix("0x")))
    agreement = state["agreement"]
    require(agreement["buyer"].lower() == buyer.lower() and agreement["source_root"] == cfg["source_root"]
            and agreement["criterion"] == cfg["criterion"] and int(agreement["budget_wei"]) == LIMIT,
            "This agreement is outside the bounded EU-only Studio flow.")
    return {"deployment": deployment, "contract": contract, "snapshot": state, "observed_at": time.time(),
            "buyer_balance_wei": str(int(read("eth_getBalance", [buyer, "latest"]), 16))}


def action_plan(action, fields, account, state, cfg, now):
    """Mirror contract eligibility for useful UX; the contract remains authoritative."""
    require(action in ROLES, "Choose a supported purchase action.")
    agreement = state["agreement"]
    require(account.lower() in [agreement[role].lower() for role in ROLES[action]],
            "Switch your wallet to the required role: " + " or ".join(ROLES[action]) + ".")
    expiry = agreement["expires_at"]
    claims = {c["id"]: c for c in state["claims"]}
    permits = {p["id"]: p for p in state["permits"]}
    selected = fields.get("claim_id", "")
    value = 0
    recipient = ""
    if action == "accept_terms":
        require(now < expiry and not agreement["accepted"], "Agreement is expired or already accepted.")
        args = []
    elif action == "publish_claim":
        require(agreement["accepted"] and now + 905 < expiry, "Agreement is not open long enough to publish.")
        offer = next((o for o in cfg["offers"] if o["id"] == selected), None)
        require(offer is not None and selected not in claims and len(claims) < 9, "Choose an unpublished offer.")
        if offer["supersedes"]:
            require(claims.get(offer["supersedes"], {}).get("status") in ("INVALID", "UNKNOWN"), "Resolve the original claim negatively before publishing its replacement.")
        recipient = address(fields.get("recipient"))
        doc = cfg["evidence"][selected]
        args = [selected, offer["statement"], recipient, offer["amount_wei"], doc["path"], doc["sha256"], offer["supersedes"]]
    elif action in ("cancel_purchase", "execute_purchase"):
        permit = permits.get(fields.get("permit_id"))
        require(permit is not None and permit["status"] == "RESERVED", "Choose an unconsumed reserved permit.")
        args = [permit["id"]]
        recipient = permit["recipient"]
        if action == "execute_purchase":
            claim = claims[permit["claim_id"]]
            require(claim["status"] == "VALID", "Payment is blocked: the claim is not valid.")
            require(now < expiry - 5, "The agreement has expired or is within five seconds of expiry. Payment is blocked; the buyer can cancel the unpaid reservation.")
            opens = datetime.fromtimestamp(claim["review_until"] + 5, timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            require(claim["review_until"] + 5 <= now, f"The review period is still open. Refresh state and review payment at or after {opens} (includes the five-second safety margin). No payment was submitted.")
            value = int(permit["amount_wei"])
            require(0 < value <= LIMIT and int(agreement["spent_wei"]) + value <= LIMIT, "Payment exceeds the 0.100 test-GEN limit.")
    else:
        claim = claims.get(selected)
        require(claim is not None, "Select a published claim.")
        args = [selected]
        if action == "evaluate_claim":
            require(claim["status"] == "PENDING" and now + 905 < expiry, "Claim is already evaluated or the agreement is too close to expiry.")
        elif action == "queue_purchase":
            require(claim["status"] == "VALID" and now < expiry, "Only a valid, unexpired claim can be reserved.")
            require(not any(p["claim_id"] == selected for p in permits.values()) and len(permits) < 9, "This claim already has a permit.")
            require(int(agreement["reserved_wei"]) + int(agreement["spent_wei"]) + int(claim["amount_wei"]) <= LIMIT, "Agreement budget exceeded.")
            args = ["p-" + selected, selected]
        elif action == "challenge_claim":
            require(selected == "inference-v1", "This bounded flow supplies counter-evidence only for Inference Basic.")
            require(claim["status"] == "VALID" and not claim["challenged"] and now + 5 < claim["review_until"], "Challenge is unavailable or its review window has closed.")
            doc = cfg["evidence"]["inference-amendment"]
            args += [doc["path"], doc["sha256"]]
        elif action == "resolve_challenge":
            require(claim["status"] == "DISPUTED" and now + 5 < claim["resolve_until"], "No resolvable dispute. The buyer can cancel a reserved permit.")
    return args, value, recipient


def prepare(data, read=rpc):
    cfg = config()
    account = address(data.get("account"))
    action = data.get("action")
    require(isinstance(action, str) and (action == "deploy" or action in ROLES), "Choose a supported purchase action.")
    fields = data.get("fields", {})
    require(isinstance(fields, dict), "Invalid action fields.")
    allowed = {"seller", "agent", "challenger"} if action == "deploy" else {"claim_id", "permit_id", "recipient"}
    require(set(fields) <= allowed and set(data) <= {"account", "action", "fields", "deployment"}, "Unexpected request fields.")
    chain_check(read)
    require(int(read("eth_gasPrice", []), 16) == 0, "Studio is no longer gasless; refusing to prepare a paid transport.")
    router = read("sim_getConsensusContract", ["ConsensusMain"])
    functions = [f for f in router.get("abi", []) if f.get("name") == "addTransaction"]
    require(router.get("address", "").lower() == ZERO and len(functions) == 1
            and [x["type"] for x in functions[0]["inputs"]] == ["address", "address", "uint256", "uint256", "bytes"],
            "Studio routing ABI changed. Reverify before signing.")
    value, recipient = 0, ""
    code = None
    if action == "deploy":
        parties = [account] + [address(fields.get(role)) for role in ("seller", "agent", "challenger")]
        require(len({p.lower() for p in parties}) == 4, "Buyer, seller, agent and challenger must be four distinct accounts.")
        args = parties[1:] + [cfg["budget_wei"], cfg["criterion"], cfg["source_root"]]
        contract = ZERO
        code = (BASE / "contracts/recall.py").read_bytes()
        obj = {"args": args}
    else:
        session = inspect(data.get("deployment"), read)
        args, value, recipient = action_plan(action, fields, account, session["snapshot"], cfg, time.time())
        require(value <= int(session["buyer_balance_wei"]), "Buyer needs test GEN from the Studio faucet. No automatic funding is performed.")
        contract = session["contract"]
        obj = {"method": action, "args": args}
    payload = rlp.encode([code, calldata.encode(obj), b""] if code is not None else [calldata.encode(obj), b""])
    encoded = Web3().eth.contract(abi=functions).encode_abi("addTransaction", args=[account, contract, 5, 3, payload])
    tx = {"from": account, "to": ZERO, "chainId": hex(CHAIN), "value": hex(value), "data": encoded, "gasPrice": "0x0"}
    tx["gas"] = hex(int(read("eth_estimateGas", [{"from": account, "to": ZERO, "data": encoded, "value": hex(value)}]), 16))
    tx["nonce"] = hex(int(read("eth_getTransactionCount", [account, "pending"]), 16))
    require(int(tx["gas"], 16) > 0, "Studio returned an invalid gas estimate.")
    review = {"action": action, "account": account, "contract": contract, "recipient": recipient,
              "value_wei": str(value), "args": args, "chain_id": CHAIN, "source_sha256": cfg["source_sha256"]}
    return {"review": review, "transaction": tx, "prepared_at": time.time(),
            "intent_id": hashlib.sha256(json.dumps(review, sort_keys=True).encode()).hexdigest()}


def receipt(hash_value, read=rpc):
    hash_value = tx_hash(hash_value)
    chain_check(read)
    tx = read("eth_getTransactionByHash", [hash_value])
    if tx is None:
        return {"hash": hash_value, "status": "NOT_FOUND", "execution": "UNKNOWN", "settlement": "unverified"}
    require(tx.get("hash", "").lower() == hash_value, "Studio returned a different receipt.")
    result = {"hash": hash_value, "status": tx.get("status", "UNKNOWN"), "execution": execution(tx),
              "settlement": "unverified", "from": tx.get("from_address"), "to": tx.get("to_address"),
              "value_wei": str(tx.get("value", 0)), "observed_at": time.time()}
    data = tx.get("data") or {}
    if data.get("contract_code"):
        result["source_sha256"] = hashlib.sha256(base64.b64decode(data["contract_code"], validate=True)).hexdigest()
    if data.get("calldata"):
        decoded = calldata.decode(base64.b64decode(data["calldata"], validate=True))
        result.update(method=decoded.get("method"), args=decoded.get("args"))
    # A receipt alone never claims contract state or value delivery. For payments,
    # independently verify the child transfer with the parent's destination and value.
    children = tx.get("triggered_transactions") or []
    if result["status"] == "FINALIZED" and result["execution"] == "SUCCESS" and int(tx.get("value", 0)) > 0 and len(children) == 1:
        child = read("eth_getTransactionByHash", [tx_hash(children[0])])
        if isinstance(child, dict) and child.get("hash", "").lower() == children[0].lower() and child.get("status") == "FINALIZED" and child.get("triggered_by", "").lower() == hash_value and child.get("from_address", "").lower() == tx.get("to_address", "").lower() and int(child.get("value", -1)) == int(tx["value"]):
            result["settlement"] = "child-finalized"
            result["child"] = {k: child[k] for k in ("hash", "to_address", "from_address", "value", "triggered_by", "status")}
    return result
