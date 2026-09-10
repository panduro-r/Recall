"""Loopback-only prototype server. Each run gets a fresh, isolated direct VM."""
import argparse
import hashlib
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import subprocess
import sys
from threading import Lock
from studio_read import observe
import purchase_flow
from http.client import HTTPException
from genlayer_py.exceptions import GenLayerError

BASE = Path(__file__).resolve().parent
SCENARIO_LOCK = Lock()
ASSETS = {"/": ("compare.html", "text/html"), "/recorded": ("index.html", "text/html"),
          "/compare": ("compare.html", "text/html"), "/compare.js": ("compare.js", "text/javascript"),
          "/compare-model.js": ("compare-model.js", "text/javascript"), "/compare.css": ("compare.css", "text/css"),
          "/service-catalog.json": ("service-catalog.json", "application/json"),
          "/review": ("review.html", "text/html"), "/review.js": ("review.js", "text/javascript"),
          "/review-model.js": ("review-model.js", "text/javascript"), "/review.css": ("review.css", "text/css"),
          "/workspace": ("workspace.html", "text/html"), "/workspace.js": ("workspace.js", "text/javascript"),
          "/workspace-model.js": ("workspace-model.js", "text/javascript"), "/workspace.css": ("workspace.css", "text/css"),
          "/InterVariable.woff2": ("InterVariable.woff2", "font/woff2"), "/Inter-LICENSE.txt": ("Inter-LICENSE.txt", "text/plain"),
          "/commerce-model.js": ("commerce-model.js", "text/javascript"), "/commerce-ui.js": ("commerce-ui.js", "text/javascript"),
          "/wallet-discovery.js": ("wallet-discovery.js", "text/javascript"),
          "/wallet-connect.js": ("wallet-connect.js", "text/javascript"),
          "/wallet-header.css": ("wallet-header.css", "text/css"),
          "/wallet-connection.js": ("wallet-connection.js", "text/javascript"),
          "/brand.css": ("brand.css", "text/css"),
          "/proof": ("proof.html", "text/html"), "/proof.js": ("proof.js", "text/javascript"),
          "/proof-model.js": ("proof-model.js", "text/javascript"), "/proof.css": ("proof.css", "text/css"),
          "/app.js": ("app.js", "text/javascript"),
          "/model.js": ("model.js", "text/javascript"), "/style.css": ("style.css", "text/css"),
          "/purchase": ("purchase.html", "text/html"), "/purchase.js": ("purchase.js", "text/javascript"),
          "/wallet.js": ("wallet.js", "text/javascript"), "/purchase.css": ("purchase.css", "text/css")}


def exact(value):
    if isinstance(value, dict):
        return {key: exact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [exact(item) for item in value]
    return str(value) if type(value) is int and abs(value) > 2**53 - 1 else value


def recorded_run():
    """Public exported evidence only. Never read journals, accounts or keys."""
    report = json.loads((BASE / "live" / "full-flow-report.json").read_text())
    documents = {}
    for name in ("inference-v1", "inference-amendment", "inference-replacement", "storage-v1", "monitoring-v1"):
        content = (BASE / "evidence" / "flow" / (name + ".txt")).read_bytes()
        if hashlib.sha256(content).hexdigest() != report["evidence"][name]["sha256"]:
            raise ValueError("Recorded evidence does not match its exported hash")
        documents[name + ".txt"] = content.decode("utf-8")

    return {"report": exact(report), "documents": documents}


class Handler(BaseHTTPRequestHandler):
    # Browsers may open sockets before sending an HTTP request. Bound idle reads
    # and give each connection its own thread so they cannot freeze the preview.
    timeout = 10

    def reply(self, status, body, kind="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", kind if kind.startswith("font/") else kind + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def valid_host(self):
        port = self.server.server_port
        return self.headers.get("Host") in [f"127.0.0.1:{port}", f"localhost:{port}"]

    def do_GET(self):
        if not self.valid_host():
            return self.reply(403, b'{"error":"Invalid host"}')
        if self.path in ("/recall-logo.png", "/recall-mark.png"):
            return self.reply(200, (BASE / "submission" / "recall-logo.png").read_bytes(), "image/png")
        if self.path in ("/api/proof", "/wallet-run.json"):
            try:
                from hosted_app import public_bundle
                payload = public_bundle(wallet=True)
                if self.path == "/wallet-run.json": payload = payload["report"]
                return self.reply(200, json.dumps(payload).encode())
            except (OSError, ValueError, KeyError):
                return self.reply(503, b'{"error":"The public wallet-run record is unavailable."}')
        if self.path == "/api/session/config":
            try:
                return self.reply(200, json.dumps(purchase_flow.config()).encode())
            except (OSError, ValueError, KeyError):
                return self.reply(503, b'{"error":"Verified flow configuration unavailable"}')
        if self.path == "/api/recorded":
            try:
                payload = recorded_run()
            except (OSError, ValueError, KeyError):
                return self.reply(503, b'{"error":"The recorded report is unavailable or its evidence has changed. Restore the verified export and try again."}')
            return self.reply(200, json.dumps(payload).encode())
        if self.path not in ASSETS:
            return self.reply(404, b'{"error":"Not found"}')
        filename, kind = ASSETS[self.path]
        self.reply(200, (BASE / "ui" / filename).read_bytes(), kind)

    def do_POST(self):
        origin = self.headers.get("Origin")
        allowed = [f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"]
        if not self.valid_host() or origin not in allowed:
            return self.reply(403, b'{"error":"Same-origin requests only"}')
        if self.path in ("/api/session/prepare", "/api/session/inspect", "/api/session/receipt", "/api/commerce", "/api/catalog/check", "/api/provider-review"):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= (210000 if self.path == "/api/provider-review" else 24000 if self.path == "/api/commerce" else 4096) or self.headers.get("Transfer-Encoding"):
                    raise ValueError("Invalid request size or encoding.")
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError("Expected a JSON object.")
                if self.path == "/api/provider-review":
                    if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                        raise ValueError("Expected application/json.")
                    import provider_review_flow
                    payload = provider_review_flow.dispatch(data)
                elif self.path == "/api/catalog/check":
                    if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                        raise ValueError("Expected application/json.")
                    import catalog_sources
                    payload = catalog_sources.check(data)
                elif self.path == "/api/commerce":
                    if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                        raise ValueError("Expected application/json.")
                    import commerce_flow
                    payload = commerce_flow.dispatch(data)
                elif self.path.endswith("/prepare"):
                    payload = purchase_flow.prepare(data)
                elif self.path.endswith("/inspect") and set(data) == {"deployment"}:
                    payload = purchase_flow.inspect(data["deployment"])
                elif self.path.endswith("/receipt") and set(data) == {"hash"}:
                    payload = purchase_flow.receipt(data["hash"])
                else:
                    raise ValueError("Unexpected request fields.")
                return self.reply(200, json.dumps(exact(payload)).encode())
            except ValueError as error:
                return self.reply(400, json.dumps({"error": str(error)[:300]}).encode())
            except (OSError, KeyError, TypeError, AttributeError, HTTPException, GenLayerError):
                return self.reply(503, b'{"error":"Studio could not be read safely. No transaction was submitted by the server. Refresh before trying again."}')
        if self.path == "/api/check-studio":
            if self.headers.get("Content-Length", "0") != "0" or self.headers.get("Transfer-Encoding"):
                return self.reply(400, b'{"error":"This check accepts no parameters"}')
            try:
                payload = observe(recorded_run()["report"])
            except (OSError, ValueError, KeyError):
                return self.reply(503, b'{"error":"The public report is unavailable. No network result was established."}')
            return self.reply(200, json.dumps(payload).encode())
        if self.path != "/api/run":
            return self.reply(404, b'{"error":"Not found"}')
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 256:
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            mode = data.get("mode") if isinstance(data, dict) else None
            if mode not in ["upheld", "rejected", "missing"]:
                raise ValueError()
        except (ValueError, TypeError):
            return self.reply(400, b'{"error":"Choose a supported scenario"}')
        if not SCENARIO_LOCK.acquire(blocking=False):
            return self.reply(409, b'{"error":"A local scenario is already running. Wait for it to finish before retrying."}')
        try:
            try:
                result = subprocess.run([sys.executable, str(BASE / "harness.py"), "--scenario", mode],
                                        cwd=BASE, capture_output=True, timeout=20, check=True)
                payload = json.loads(result.stdout)
            except (subprocess.SubprocessError, ValueError):
                return self.reply(500, b'{"error":"Contract run failed. Check the local tests before continuing."}')
        finally:
            SCENARIO_LOCK.release()
        self.reply(200, json.dumps(payload).encode())


def create_server(port=4178):
    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4178)
    args = parser.parse_args()
    server = create_server(args.port)
    print(f"Recall local prototype: http://127.0.0.1:{args.port}", flush=True)
    server.serve_forever()
