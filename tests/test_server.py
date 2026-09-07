"""Exercise request guards without starting a listener or making network calls."""
import io
import json
from types import SimpleNamespace
import pytest
from server import Handler, recorded_run, BASE


@pytest.mark.parametrize("method,path,overrides,body,status", [
    ("GET", "/.env", {}, b"", 404),
    ("GET", "/../contracts/recall.py", {}, b"", 404),
    ("GET", "/", {"Host": "evil.test"}, b"", 403),
    ("GET", "/api/recorded", {"Host": "evil.test"}, b"", 403),
    ("GET", "/live/private/accounts.json", {}, b"", 404),
    ("GET", "/api/recorded?path=live/private/accounts.json", {}, b"", 404),
    ("POST", "/api/run", {"Origin": "https://evil.test"}, b'{"mode":"upheld"}', 403),
    ("POST", "/api/run", {}, b'{"mode":"arbitrary-command"}', 400),
    ("POST", "/api/run", {"Content-Length": "257"}, b"", 400),
    ("GET", "/api/check-studio", {}, b"", 404),
    ("POST", "/api/check-studio", {"Origin": "https://evil.test"}, b"", 403),
    ("POST", "/api/check-studio", {}, b'{"rpc":"https://evil.test"}', 400),
    ("POST", "/api/check-studio", {"Transfer-Encoding": "chunked"}, b"", 400),
    ("POST", "/api/session/prepare", {"Origin": "https://evil.test"}, b"{}", 403),
    ("POST", "/api/session/prepare", {"Content-Length": "4097"}, b"", 400),
    ("POST", "/api/session/prepare", {"Transfer-Encoding": "chunked"}, b"{}", 400),
    ("POST", "/api/session/prepare", {}, b"[]", 400),
    ("POST", "/api/session/inspect", {}, b'{"deployment":"bad","rpc":"https://evil.test"}', 400),
    ("POST", "/api/session/receipt", {}, b'{"hash":"bad"}', 400),
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


def test_recorded_report_is_public_and_exact():
    bundle = recorded_run()
    assert bundle["report"]["final_balances"]["buyer"] == "20000000000000000"
    assert len(bundle["documents"]) == 5
    assert set(bundle) == {"report", "documents"}
    assert "private_key" not in json.dumps(bundle)
    assert bundle["report"]["final_state"]["agreement"]["budget_wei"] == "100000000000000000"


def test_recorded_report_rejects_changed_evidence(monkeypatch):
    path_type = type(BASE)
    original = path_type.read_bytes
    monkeypatch.setattr(path_type, "read_bytes", lambda path: b"changed" if path.name == "inference-v1.txt" else original(path))
    with pytest.raises(ValueError, match="does not match"):
        recorded_run()


def test_recorded_endpoint_returns_export():
    handler = object.__new__(Handler)
    handler.path = "/api/recorded"
    handler.server = SimpleNamespace(server_port=4178)
    handler.headers = {"Host": "127.0.0.1:4178"}
    responses = []
    handler.reply = lambda code, payload: responses.append((code, json.loads(payload)))
    handler.do_GET()
    assert responses[0][0] == 200
    assert len(responses[0][1]["report"]["steps"]) == 26


def test_studio_endpoint_uses_only_public_report(monkeypatch):
    def observe(report):
        assert report == recorded_run()["report"]
        return {"status": "matched", "checks": []}
    monkeypatch.setattr("server.observe", observe)
    handler = object.__new__(Handler)
    handler.path = "/api/check-studio"
    handler.server = SimpleNamespace(server_port=4178)
    handler.headers = {"Host": "localhost:4178", "Origin": "http://localhost:4178", "Content-Length": "0"}
    responses = []
    handler.reply = lambda code, payload: responses.append((code, json.loads(payload)))
    handler.do_POST()
    assert responses[0][0] == 200


@pytest.mark.parametrize("path,function,data",[("prepare","prepare",{"account":"test"}),("inspect","inspect",{"deployment":"test"}),("receipt","receipt",{"hash":"test"})])
def test_session_endpoints_serialize_exact_values(monkeypatch,path,function,data):
    monkeypatch.setattr("server.purchase_flow."+function,lambda *_:{"value":20000000000000001})
    handler=object.__new__(Handler)
    body=json.dumps(data).encode()
    handler.path="/api/session/"+path
    handler.server=SimpleNamespace(server_port=4178)
    handler.headers={"Host":"localhost:4178","Origin":"http://localhost:4178","Content-Length":str(len(body))}
    handler.rfile=io.BytesIO(body)
    responses=[]
    handler.reply=lambda code,payload:responses.append((code,json.loads(payload)))
    handler.do_POST()
    assert responses==[(200,{"value":"20000000000000001"})]
