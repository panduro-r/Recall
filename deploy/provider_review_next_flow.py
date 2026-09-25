"""Studio Next migration adapter; unsigned preparations and network-scoped reads.

Historical requests without a chain stay on Stable through a read-only adapter.
"""
import hashlib
from pathlib import Path
import provider_review_archive as legacy
import provider_review_decisions_read as decisions_archive
import studio_next as network
from provider_evidence import capture, validate_payload
from purchase_flow import require, receipt

SOURCE = Path(__file__).resolve().parent / "contracts/provider_review_studio_next.py"
PIN = "e47a3eed7e1235689982b4b4d0b9d2e792ce662babe36210241862a12a3b6d34"
TEXT_SOURCE = Path(__file__).resolve().parent / "contracts/provider_review_decisions_v25_candidate.py"
TEXT_PIN = "c03e43531297394f470d81cc0453a8a0a3abb9ea7150c94334f3c4c1c8278be9"
TEXT_PLANS = ("openai-mini", "mistral-small", "deepseek-flash", "anthropic-haiku")


def config():
    require(hashlib.sha256(SOURCE.read_bytes()).hexdigest() == PIN, "Migrated contract source changed; deployment disabled.")
    require(hashlib.sha256(TEXT_SOURCE.read_bytes()).hexdigest() == TEXT_PIN,
            "Text assessment contract source changed; deployment disabled.")
    return {"version": 7, "chain_id": network.CHAIN, "source_sha256": PIN,
            "text_source_sha256": TEXT_PIN, "text_assessment_plan_ids": list(TEXT_PLANS),
            "network_name": "GenLayer Studio Next", "rpc_url": network.RPC,
            "explorer_url": network.EXPLORER, "assessment_categories": ["transcription", "speech", "text"],
            "max_protocol_fee_wei": str(network.MAX_FEE_WEI),
            "fee_profile": "migration-bootstrap-v1", "migration_validated": True,
            "notice": "Studio Next test network. Text assessments use a validation-candidate contract, not a production-audited service. The displayed protocol deposit is a conservative budget, not a predicted charge. No provider payment or service order. Historical reviews remain on their original network."}


def prepare(request, read=network.rpc):
    require(isinstance(request, dict) and set(request) == {"account", "payload"}, "Unexpected review fields.")
    policy = config()
    evidence = validate_payload(request["payload"])
    category = evidence["requirements"].get("category", "transcription")
    require(category in policy["assessment_categories"],
            "This migration baseline does not assess this category. No transaction was prepared.")
    if category == "text":
        require(evidence["plan"]["id"] in TEXT_PLANS,
                "This text plan is not enabled for Studio Next assessment. No transaction was prepared.")
    source = TEXT_SOURCE if category == "text" else SOURCE
    return network.prepare_deployment(request["account"], source.read_bytes(), [request["payload"]], read=read)


def dispatch(data, read=network.rpc, legacy_read=legacy.rpc):
    require(isinstance(data, dict), "Expected a review request.")
    op = data.get("op")
    if op == "config" and set(data) == {"op"}: return config()
    if op == "capture" and set(data) == {"op", "request"}: return capture(data["request"])
    if op == "prepare" and set(data) == {"op", "request"}: return prepare(data["request"], read)
    key = "hash" if op == "receipt" else "deployment" if op == "inspect" else None
    if key and set(data) in ({"op", key}, {"op", key, "chain_id"}):
        chain = data.get("chain_id", 61999)
        require(type(chain) is int and chain in (61999, 61997), "Unsupported review network.")
        if chain == 61999:
            return legacy.dispatch({"op": op, key: data[key]}, legacy_read)
        if op == "receipt": return receipt(data[key], read, chain_id=61997)
        # Reading a completed, source-pinned candidate is independent of enabling
        # new deployments. Keep its original metadata and all exact quotes.
        row = receipt(data[key], read, chain_id=61997)
        if row.get("source_sha256") in decisions_archive.SOURCES:
            return decisions_archive.inspect(data[key], read)
        return legacy.inspect(data[key], read, chain_id=61997, versions={config()["source_sha256"]: 6})
    raise ValueError("Unknown review request.")
