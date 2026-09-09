"""Bounded Vercel API adapter. No VM replay, keys, funding or broadcasting."""
from http.server import BaseHTTPRequestHandler
from http.client import HTTPException
from pathlib import Path
from threading import BoundedSemaphore
from urllib.parse import parse_qs, urlsplit
import hashlib
import json
import os

from genlayer_py.exceptions import GenLayerError
import purchase_flow as flow
from studio_read import observe

BASE = Path(__file__).resolve().parent
NETWORK_SLOTS = BoundedSemaphore(2)  # Per instance, not a global rate limiter.
GET_ROUTES = {"/api/runtime", "/api/recorded", "/api/proof", "/api/session/config"}
POST_ROUTES = {"/api/check-studio", "/api/session/prepare", "/api/session/inspect", "/api/session/receipt", "/api/commerce", "/api/catalog/check", "/api/provider-review"}


def exact(value):
    if isinstance(value, dict): return {k: exact(v) for k, v in value.items()}
    if isinstance(value, list): return [exact(v) for v in value]
    return str(value) if type(value) is int and abs(value) > 2**53 - 1 else value


def public_bundle(wallet=False):
    report = json.loads((BASE / "live" / ("wallet-run-2026-09-07.json" if wallet else "full-flow-report.json")).read_text())
    documents = {}
    for name, doc in report["evidence"].items():
        # Deliberate fixed catalog, not a path supplied by the caller or report.
        if name not in {"inference-v1", "inference-amendment", "inference-replacement", "storage-v1", "monitoring-v1"}:
            raise ValueError("Unexpected evidence")
        content = (BASE / "evidence" / "flow" / (name + ".txt")).read_bytes()
        if hashlib.sha256(content).hexdigest() != doc["sha256"]:
            raise ValueError("Evidence bytes changed")
        documents[name + ".txt"] = content.decode("utf-8")
    return {"report": exact(report), "documents": documents, "capabilities": {"scripted_demo": False}}


def allowed_hosts(environ):
    hosts = set()
    # Deployment identity comes from Vercel's environment, never forwarded headers.
    for key in ("VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"):
        value = environ.get(key, "")
        if value and all(c.isalnum() or c in ".-" for c in value): hosts.add(value.lower())
    configured = urlsplit(environ.get("RECALL_PUBLIC_ORIGIN", ""))
    if configured.scheme == "https" and configured.netloc and not configured.username and not configured.password and not configured.query and not configured.fragment and configured.path in ("", "/"):
        hosts.add(configured.netloc.lower())
    return hosts


def route_for(path):
    parsed = urlsplit(path)
    if not parsed.query: return parsed.path
    # The runtime may retain the original URL or use the function destination,
    # with the rewrite's route parameter attached. Accept only those equivalents.
    params = parse_qs(parsed.query, keep_blank_values=True)
    if set(params) != {"route"} or len(params["route"]) != 1:
        return ""
    route = params["route"][0]
    if route not in GET_ROUTES | POST_ROUTES:
        return ""
    return route if parsed.path in (route, "/api/dispatch", "/api/dispatch.py") else ""


class handler(BaseHTTPRequestHandler):
    endpoint = None  # File-based entrypoints bind one server-owned route.
    def reply(self, status, data):
        body = json.dumps(exact(data)).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def dispatch(self, method):
        host = self.headers.get("Host", "").lower()
        if host not in allowed_hosts(os.environ):
            return self.reply(403, {"error": "Unrecognized deployment host."})
        path = (self.endpoint if not urlsplit(self.path).query else "") if self.endpoint else route_for(self.path)
        routes = GET_ROUTES if method == "GET" else POST_ROUTES
        if path not in routes: return self.reply(404, {"error": "Not found."})
        if method == "POST" and self.headers.get("Origin") != "https://" + host:
            return self.reply(403, {"error": "Same-origin requests only."})
        network = path in POST_ROUTES
        if network and not NETWORK_SLOTS.acquire(blocking=False):
            return self.reply(503, {"error": "Studio checks are busy. Try again; no transaction was submitted by this server."})
        try:
            if method == "GET":
                if path == "/api/runtime": result = {"scripted_demo": False}
                elif path == "/api/recorded": result = public_bundle()
                elif path == "/api/proof": result = public_bundle(wallet=True)
                else: result = flow.config()
            else:
                if self.headers.get("Transfer-Encoding"): raise ValueError("Unsupported request encoding.")
                size = int(self.headers.get("Content-Length", "0"))
                if path == "/api/check-studio":
                    if size != 0: raise ValueError("This check accepts no parameters.")
                    result = observe(public_bundle()["report"])
                else:
                    if not 0 < size <= (210000 if path == "/api/provider-review" else 24000 if path == "/api/commerce" else 4096): raise ValueError("Invalid request size.")
                    if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                        raise ValueError("Expected application/json.")
                    data = json.loads(self.rfile.read(size))
                    if not isinstance(data, dict): raise ValueError("Expected a JSON object.")
                    if path == "/api/provider-review":
                        import provider_review_flow
                        result = provider_review_flow.dispatch(data)
                    elif path == "/api/catalog/check":
                        import catalog_sources
                        result = catalog_sources.check(data)
                    elif path == "/api/commerce":
                        import commerce_flow
                        result = commerce_flow.dispatch(data)
                    elif path == "/api/session/prepare": result = flow.prepare(data)
                    elif path == "/api/session/inspect" and set(data) == {"deployment"}: result = flow.inspect(data["deployment"])
                    elif path == "/api/session/receipt" and set(data) == {"hash"}: result = flow.receipt(data["hash"])
                    else: raise ValueError("Unexpected request fields.")
            return self.reply(200, result)
        except ValueError as exc:
            return self.reply(400, {"error": str(exc)[:300]})
        except (OSError, KeyError, TypeError, AttributeError, HTTPException, GenLayerError):
            return self.reply(503, {"error": "Verified data or Studio is unavailable. No transaction was submitted by this server."})
        finally:
            if network: NETWORK_SLOTS.release()

    def do_GET(self): self.dispatch("GET")
    def do_POST(self): self.dispatch("POST")
