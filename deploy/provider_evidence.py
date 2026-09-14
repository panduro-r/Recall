"""Bounded public-page snapshots; no arbitrary URLs, credentials or background monitoring."""
import hashlib
import json
import re
import math
from datetime import datetime, timezone
from html.parser import HTMLParser
from threading import BoundedSemaphore
import catalog_sources

SLOTS = BoundedSemaphore(2)


class PageText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip = []
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "svg", "nav", "header", "footer", "noscript"}:
            self.skip.append(tag)
        if not self.skip and tag in {"p", "div", "li", "h1", "h2", "h3", "tr", "br"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if self.skip and tag == self.skip[-1]:
            self.skip.pop()
        if not self.skip:
            self.parts.append(" ")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def readable_text(content, content_type):
    if content_type == "text/html":
        parser = PageText()
        parser.feed(content)
        content = "".join(parser.parts)
    return "\n".join(line for raw in content.splitlines() if (line := re.sub(r"\s+", " ", raw).strip()))


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def normalize_requirements(value):
    if not isinstance(value, dict):
        raise ValueError("Choose your requirements in the comparison.")
    speech = value.get("category", "transcription") == "speech"
    fields = {"category", "characters", "budget", "noTraining", "streaming", "utf8Bytes"} if speech else {"hours", "budget", "noTraining", "speakers"}
    if set(value) != fields:
        raise ValueError("Choose category-specific requirements in the comparison.")
    budget = value["budget"]
    if (type(budget) not in {int, float} or not math.isfinite(budget) or not 1 <= budget <= 1000000
            or abs(budget * 100 - round(budget * 100)) > 0.00001
            or any(type(value[key]) is not bool for key in ("noTraining", "streaming" if speech else "speakers"))):
        raise ValueError("Invalid comparison requirements.")
    if speech:
        count, byte_count = value["characters"], value["utf8Bytes"]
        if (type(count) is not int or not 1 <= count <= 100000000
                or byte_count is not None and (type(byte_count) is not int or not count <= byte_count <= count * 4)):
            raise ValueError("Invalid speech-generation volume.")
    elif type(value["hours"]) is not int or not 1 <= value["hours"] <= 100000:
        raise ValueError("Invalid transcription volume.")
    return value


def matching_category(plan, req):
    return plan.get("category", "transcription") == req.get("category", "transcription")


def capture(data):
    if not isinstance(data, dict) or set(data) != {"planId", "requirements"}:
        raise ValueError("Choose a catalog plan. Custom URLs are not accepted.")
    req = normalize_requirements(data["requirements"])
    catalog = catalog_sources.catalog()
    plan = next((p for p in catalog["plans"] if p["id"] == data["planId"]), None)
    if plan is None or not matching_category(plan, req):
        raise ValueError("Choose a catalog plan.")
    if not SLOTS.acquire(blocking=False):
        raise ValueError("Source reads are busy. Try again shortly.")
    try:
        docs = []
        for key in plan["sources"]:
            source = catalog["sources"][key]
            docs.append({"id": key, "url": source["url"], "label": source["label"],
                         **catalog_sources.fetch_source(source, include_text=True)})
        evidence = {"version": 1, "plan": {**plan, "reviewedAt": plan.get("reviewedAt", catalog["reviewedAt"])},
                    "requirements": req, "capturedAt": datetime.now(timezone.utc).isoformat(), "documents": docs}
        payload = canonical(evidence)
        if len(payload.encode()) > 180000:
            raise ValueError("The extracted sources exceed the review size limit. No partial assessment was made.")
        return {"evidence": evidence, "payload": payload, "digest": hashlib.sha256(payload.encode()).hexdigest()}
    finally:
        SLOTS.release()


def validate_payload(payload):
    if not isinstance(payload, str) or not 100 <= len(payload.encode()) <= 180000:
        raise ValueError("Evidence snapshot exceeds the review limit.")
    value = json.loads(payload)
    if not isinstance(value, dict) or set(value) != {"version", "plan", "requirements", "capturedAt", "documents"} or value["version"] != 1:
        raise ValueError("Unsupported evidence snapshot.")
    normalize_requirements(value["requirements"])
    catalog = catalog_sources.catalog()
    plan = next((p for p in catalog["plans"] if p["id"] == value["plan"].get("id")), None)
    if not plan or not matching_category(plan, value["requirements"]) or value["plan"] != {**plan, "reviewedAt": plan.get("reviewedAt", catalog["reviewedAt"])}:
        raise ValueError("The catalog changed. Capture a new review; your earlier snapshot is preserved.")
    if not isinstance(value["documents"], list) or [d.get("id") for d in value["documents"]] != plan["sources"]:
        raise ValueError("Evidence sources do not match this plan.")
    for doc in value["documents"]:
        source = catalog["sources"][doc["id"]]
        if doc.get("url") != source["url"] or doc.get("label") != source["label"] or doc.get("status") not in {"retrieved", "unavailable"}:
            raise ValueError("Unexpected evidence source.")
        if doc["status"] == "retrieved":
            text = doc.get("text")
            if (not isinstance(text, str) or len(text) > 64000 or type(doc.get("complete")) is not bool
                    or doc.get("textSha256") != hashlib.sha256(text.encode()).hexdigest()
                    or not re.fullmatch(r"[a-f0-9]{64}", doc.get("sha256", ""))):
                raise ValueError("Evidence text fingerprint does not match.")
    return value
