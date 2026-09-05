"""Loopback-only prototype server. Each run gets a fresh, isolated direct VM."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import subprocess
import sys

BASE = Path(__file__).resolve().parent
ASSETS = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"),
          "/style.css": ("style.css", "text/css")}


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body, kind="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", kind + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def valid_host(self):
        port = self.server.server_port
        return self.headers.get("Host") in [f"127.0.0.1:{port}", f"localhost:{port}"]

    def do_GET(self):
        if not self.valid_host():
            return self.reply(403, b'{"error":"Invalid host"}')
        if self.path not in ASSETS:
            return self.reply(404, b'{"error":"Not found"}')
        filename, kind = ASSETS[self.path]
        self.reply(200, (BASE / "ui" / filename).read_bytes(), kind)

    def do_POST(self):
        origin = self.headers.get("Origin")
        allowed = [f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}"]
        if not self.valid_host() or origin not in allowed:
            return self.reply(403, b'{"error":"Same-origin requests only"}')
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
        try:
            result = subprocess.run([sys.executable, str(BASE / "harness.py"), "--scenario", mode],
                                    cwd=BASE, capture_output=True, timeout=20, check=True)
            payload = json.loads(result.stdout)
        except (subprocess.SubprocessError, ValueError):
            return self.reply(500, b'{"error":"Contract run failed. Check the local tests before continuing."}')
        self.reply(200, json.dumps(payload).encode())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4178)
    args = parser.parse_args()
    server = HTTPServer(("127.0.0.1", args.port), Handler)
    server.timeout = 20
    print(f"Recall local prototype: http://127.0.0.1:{args.port}", flush=True)
    server.serve_forever()
