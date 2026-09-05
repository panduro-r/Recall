"""Exercise request guards without starting a listener or making network calls."""
import io
from types import SimpleNamespace
import pytest
from server import Handler


@pytest.mark.parametrize("method,path,overrides,body,status", [
    ("GET", "/.env", {}, b"", 404),
    ("GET", "/../contracts/recall.py", {}, b"", 404),
    ("GET", "/", {"Host": "evil.test"}, b"", 403),
    ("POST", "/api/run", {"Origin": "https://evil.test"}, b'{"mode":"upheld"}', 403),
    ("POST", "/api/run", {}, b'{"mode":"arbitrary-command"}', 400),
    ("POST", "/api/run", {"Content-Length": "257"}, b"", 400),
])
def test_request_boundaries(method, path, overrides, body, status):
    handler = object.__new__(Handler)
    handler.path = path
    handler.server = SimpleNamespace(server_port=4178)
    handler.headers = {"Host": "127.0.0.1:4178", "Origin": "http://127.0.0.1:4178",
                       "Content-Length": str(len(body)), **overrides}
    handler.rfile = io.BytesIO(body)
    responses = []
    handler.reply = lambda code, payload, kind=None: responses.append((code, payload))
    getattr(handler, "do_" + method)()
    assert responses[0][0] == status
