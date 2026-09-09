"""Read-only, fixed-source retrieval. Availability is not semantic verification."""
from datetime import datetime, timezone
from hashlib import sha256
from http.client import HTTPSConnection, HTTPException
from pathlib import Path
from threading import Lock, BoundedSemaphore
from time import monotonic
from urllib.parse import urlsplit
import json

BASE = Path(__file__).resolve().parent
MAX_BYTES = 4 * 1024 * 1024
CACHE_SECONDS = 600
_cache = {}
_lock = Lock()
_slots = BoundedSemaphore(2)


def catalog():
    # Source checkout and the deployment artifact have different static roots.
    location = BASE / "ui" / "service-catalog.json"
    if not location.is_file():
        location = BASE / "catalog-data.json"
    return json.loads(location.read_text())


def fetch_source(source, include_text=False):
    url = urlsplit(source["url"])
    # Only this server-owned catalog is accepted by check(); redirects are never followed.
    if url.scheme != "https" or url.port or url.username or url.password:
        raise ValueError("Invalid catalog URL")
    connection = HTTPSConnection(url.hostname, timeout=6)
    checked = datetime.now(timezone.utc).isoformat()
    try:
        connection.request("GET", url.path + ("?" + url.query if url.query else ""), headers={
            "User-Agent": "Recall-SourceCheck/1.0", "Accept": "text/html,text/plain,text/markdown", "Accept-Encoding": "identity"})
        response = connection.getresponse()
        if response.status != 200:
            return {"status":"unavailable", "checkedAt":checked, "reason":"The source did not return a successful page."}
        content_type = response.getheader("Content-Type", "").split(";")[0].lower().strip()
        if content_type not in {"text/html", "text/plain", "text/markdown"}:
            return {"status":"unavailable", "checkedAt":checked, "reason":"The source did not return a readable document."}
        chunks, size, deadline = [], 0, monotonic() + 8
        while size <= MAX_BYTES:
            if monotonic() > deadline:
                raise TimeoutError("Read deadline")
            chunk = response.read1(min(65536, MAX_BYTES + 1 - size))
            if not chunk:
                break
            chunks.append(chunk)
            size += len(chunk)
        raw = b"".join(chunks)
        if not raw or len(raw) > MAX_BYTES:
            return {"status":"unavailable", "checkedAt":checked, "reason":"The source was empty or exceeded the read limit."}
        result = {"status":"retrieved", "checkedAt":checked, "sha256":sha256(raw).hexdigest(), "bytes":len(raw)}
        if include_text:
            from provider_evidence import readable_text
            content = readable_text(raw.decode("utf-8", errors="replace"), content_type)
            result.update(text=content[:64000], textCharacters=len(content), complete=100 <= len(content) <= 64000)
            result["textSha256"] = sha256(result["text"].encode()).hexdigest()
        return result
    except (OSError, HTTPException):
        return {"status":"unavailable", "checkedAt":checked, "reason":"The source could not be reached within the read limit."}
    finally:
        connection.close()


def check(data):
    if not isinstance(data, dict) or set(data) != {"provider"} or not isinstance(data["provider"], str):
        raise ValueError("Choose a listed provider. Custom URLs are not accepted.")
    sources = catalog()["sources"]
    if data["provider"] not in {s["provider"] for s in sources.values()}:
        raise ValueError("Choose a listed provider. Custom URLs are not accepted.")
    provider = data["provider"]
    with _lock:
        cached = _cache.get(provider)
        if cached and monotonic() - cached[0] < CACHE_SECONDS:
            return {**cached[1], "cached":True}
    if not _slots.acquire(blocking=False):
        raise ValueError("Source checks are busy. Try again shortly.")
    try:
        results = {key:fetch_source(source) for key, source in sources.items() if source["provider"] == provider}
        result = {"provider":provider,"sources":results,"cached":False,
                  "meaning":"Page retrieval only. Prices and policy interpretations are not automatically revalidated."}
        with _lock:
            _cache[provider] = (monotonic(), result)
        return result
    finally:
        _slots.release()
