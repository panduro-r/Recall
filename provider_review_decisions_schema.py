"""Pinned v20/v22 read-only schemas. No inference, source upload, or signing.

Extracted from the immutable v20 input/decision helpers. Parity is regression-tested.
"""
import hashlib
import json
import math

FIELDS = {
    "applicability": ("applies", "unknown"),
    "capability": ("documented", "unavailable", "unknown"),
    "input_scope": ("all_content", "personal_only", "unknown"),
    "output_scope": ("all_content", "personal_only", "unknown"),
    "default_use": ("excluded", "permitted", "unknown"),
    "opt_out": ("available", "unavailable", "unknown"),
    "opt_out_scope": ("full_condition", "limited", "unknown"),
}


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def require(ok):
    if not ok:
        raise ValueError("Invalid evidence-first input")


def passages(text):
    result, start = {}, 0
    while start < len(text):
        end = min(start + 480, len(text))
        if end == len(text) and end - start < 12:
            start = max(0, end - 480)
        result["p" + str(len(result))] = text[start:end]
        if end == len(text):
            break
        start = end - 80
    return result


def context(payload):
    require(isinstance(payload, str) and 100 <= len(payload.encode()) <= 180000)
    data = json.loads(payload)
    require(isinstance(data, dict) and type(data.get("version")) is int and data["version"] == 1)
    plan, req, docs = data.get("plan"), data.get("requirements"), data.get("documents")
    require(isinstance(plan, dict) and isinstance(req, dict) and isinstance(docs, list) and 1 <= len(docs) <= 4)
    category = req.get("category", "transcription")
    require(category in ("text", "speech", "transcription") and plan.get("category", "transcription") == category)
    keys = {"budget", "noTraining"} | ({"category", "inputTokens", "outputTokens", "streaming"} if category == "text" else
             {"category", "characters", "utf8Bytes", "streaming"} if category == "speech" else {"hours", "speakers"})
    require(set(req) == keys and type(req["noTraining"]) is bool and type(req["speakers" if category == "transcription" else "streaming"]) is bool)
    require(type(req["budget"]) in (int, float) and math.isfinite(req["budget"]) and 1 <= req["budget"] <= 1000000)
    require(abs(req["budget"] * 100 - round(req["budget"] * 100)) <= 0.00001)
    for key, maximum in (([("inputTokens", 1000000000), ("outputTokens", 1000000000)] if category == "text" else
                         [("characters", 100000000)] if category == "speech" else [("hours", 100000)])):
        require(type(req[key]) is int and 1 <= req[key] <= maximum)
    units = {"text": ("token",), "speech": ("character", "utf8-byte"), "transcription": ("hour", "minute")}
    require(plan.get("unit") in units[category])
    require(all(isinstance(plan.get(key), str) and 1 <= len(plan[key]) <= 240 for key in ("name", "plan")))
    if category == "speech":
        require(req["utf8Bytes"] is None or type(req["utf8Bytes"]) is int and req["characters"] <= req["utf8Bytes"] <= req["characters"] * 4)
    source = {}
    complete = True
    for doc in docs:
        require(isinstance(doc, dict) and isinstance(doc.get("id"), str) and 1 <= len(doc["id"]) <= 120 and doc["id"] not in source)
        text = doc.get("text", "")
        require(isinstance(text, str) and len(text) <= 64000 and doc.get("status") in ("retrieved", "unavailable"))
        if doc["status"] == "retrieved":
            require(hashlib.sha256(text.encode()).hexdigest() == doc.get("textSha256"))
        complete = complete and doc["status"] == "retrieved" and doc.get("complete") is True and len(text) >= 100
        source[doc["id"]] = passages(text)
    ids = {"text": ["text_api", "text_output"], "speech": ["speech_api", "speech_english"],
           "transcription": ["service_api", "service_batch", "service_english", "service_channels"]}[category]
    if req["noTraining"]:
        ids.append("training")
    extra = {"text": "text_streaming", "speech": "streaming", "transcription": "speakers"}[category]
    if req["speakers" if category == "transcription" else "streaming"]:
        ids.append(extra)
    schema = {key: ({k: FIELDS[k] for k in FIELDS if k != "capability"} if key == "training" else
                    {k: FIELDS[k] for k in ("applicability", "capability")}) for key in ids}
    # Catalog claims/rates/notes never enter either model prompt as evidence.
    return {"category": category, "provider": plan.get("name"), "plan": plan.get("plan"),
            "schema": schema, "documents": source, "complete": complete,
            "digest": hashlib.sha256(payload.encode()).hexdigest()}


def evidence_index(ctx):
    return {"E" + str(i + 1): {"source": source, "passage": passage}
            for i, (source, passage) in enumerate((s, p) for s, parts in ctx["documents"].items() for p in parts)}


TECHNICAL = {
    "DOCUMENTED": "SUPPORTED",
    "EXPLICITLY_UNAVAILABLE": "REFUTED",
    "INSUFFICIENT_EVIDENCE": "INCONCLUSIVE",
    "CONFLICTING_EVIDENCE": "INCONCLUSIVE",
}


TRAINING = {
    "EXCLUDED_BY_DEFAULT": "SUPPORTED",
    "OPT_OUT_REQUIRED_DEFAULT_PERMITTED": "CONDITIONAL",
    "OPT_OUT_REQUIRED_DEFAULT_UNSPECIFIED": "CONDITIONAL",
    "TRAINING_PERMITTED_NO_OPT_OUT": "REFUTED",
    "INSUFFICIENT_EVIDENCE": "INCONCLUSIVE",
    "CONFLICTING_EVIDENCE": "INCONCLUSIVE",
}


def decisions(key):
    return TRAINING if key == "training" else TECHNICAL


def read_answer(raw, ctx, key, version=20):
    require(type(version) is int and version in (20, 22))
    if isinstance(raw, str):
        require(len(raw.encode()) <= 16000)
        def unique_keys(pairs):
            result = {}
            for name, value in pairs:
                require(name not in result)
                result[name] = value
            return result
        raw = json.loads(raw, object_pairs_hook=unique_keys)
    require(isinstance(raw, dict) and set(raw) == {"decision", "reason", "evidence", "setup"})
    require(isinstance(raw["decision"], str) and raw["decision"] in decisions(key))
    require(isinstance(raw["reason"], str) and 1 <= len(raw["reason"].strip()) <= (600 if version == 22 else 1200))
    index = evidence_index(ctx)
    for field in ("evidence", "setup"):
        ids = raw[field]
        require(isinstance(ids, list) and len(ids) <= 4 and all(isinstance(eid, str) and eid in index for eid in ids))
        require(len(set(ids)) == len(ids))
    require(raw["decision"] == "INSUFFICIENT_EVIDENCE" or bool(raw["evidence"]))
    conditional = decisions(key)[raw["decision"]] == "CONDITIONAL"
    require(bool(raw["setup"]) == conditional)
    return {"decision": raw["decision"], "reason": raw["reason"],
            "evidence": list(raw["evidence"]), "setup": list(raw["setup"])}


def resolved(ctx, eid):
    ref = evidence_index(ctx)[eid]
    return {**ref, "quote": ctx["documents"][ref["source"]][ref["passage"]]}


def assemble(ctx, answers, version=20):
    require(type(version) is int and version in (20, 22))
    require(ctx["complete"] and isinstance(answers, list) and len(answers) == len(ctx["schema"]))
    results = []
    for key, raw in zip(ctx["schema"], answers):
        answer = read_answer(raw, ctx, key, version)
        results.append({"id": key, "decision": answer["decision"], "verdict": decisions(key)[answer["decision"]],
            "reason": answer["reason"], "citations": [resolved(ctx, eid) for eid in answer["evidence"]],
            "documented_steps": [resolved(ctx, eid) for eid in answer["setup"]]})
    return {"kind": "local-evidence-decisions-experiment", "schema_version": version, "release_cleared": False,
            "evidence_sha256": ctx["digest"], "results": results}


def valid_assessment(ctx, candidate, version=20):
    """Verify exact result/source binding, not its semantic accuracy or receipt."""
    try:
        require(isinstance(candidate, dict) and isinstance(candidate.get("results"), list))
        ids = {(ref["source"], ref["passage"]): eid for eid, ref in evidence_index(ctx).items()}
        answers = []
        for row in candidate["results"]:
            answers.append({"decision": row["decision"], "reason": row["reason"],
                "evidence": [ids[(r["source"], r["passage"])] for r in row["citations"]],
                "setup": [ids[(r["source"], r["passage"])] for r in row["documented_steps"]]})
        # Re-derivation catches changed verdicts, IDs, order, exact quote bytes,
        # duplicate references, extra fields, metadata and evidence digests.
        return canonical(assemble(ctx, answers, version)) == canonical(candidate)
    except (ValueError, TypeError, KeyError, OverflowError, RecursionError):
        return False
