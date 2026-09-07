"""Hosted adapter guards, without opening sockets or invoking Studio."""
import io
import json
import ast
import runpy
import pytest
import hosted_app as app

def test_deployment_declares_handler_for_static_discovery():
    entry=app.BASE/"hosting/api/dispatch.py"
    parsed=ast.parse(entry.read_text())
    assert any(isinstance(node,ast.ClassDef) and node.name=="handler" for node in parsed.body)
    exported=runpy.run_path(str(entry))["handler"]
    assert issubclass(exported,app.handler)
    assert exported.do_POST is app.handler.do_POST
    assert exported.do_GET is app.handler.do_GET

def request(monkeypatch, path, method="GET", body=b"", headers=None, handler_type=app.handler):
    monkeypatch.setenv("VERCEL_URL", "recall-example.vercel.app")
    h=object.__new__(handler_type)
    h.path=path
    h.headers={"Host":"recall-example.vercel.app", "Origin":"https://recall-example.vercel.app",
               "Content-Type":"application/json", "Content-Length":str(len(body)), **(headers or {})}
    h.rfile=io.BytesIO(body)
    results=[]
    h.reply=lambda status,data: results.append((status,data))
    h.dispatch(method)
    return results[0]

@pytest.mark.parametrize("route", sorted(app.GET_ROUTES | app.POST_ROUTES))
def test_file_endpoints_bind_fixed_catalog_and_keep_guards(monkeypatch, route):
    entry = app.BASE / "hosting" / (route.lstrip("/") + ".py")
    endpoint = runpy.run_path(str(entry))["handler"]
    assert endpoint.endpoint == route
    assert issubclass(endpoint, app.handler)
    assert request(monkeypatch, route + "?route=/api/proof", handler_type=endpoint)[0] == 404
    assert request(monkeypatch, route, headers={"Host":"foreign.test"}, handler_type=endpoint)[0] == 403
    if route in app.POST_ROUTES:
        assert request(monkeypatch, route, handler_type=endpoint)[0] == 404
        assert request(monkeypatch, route, "POST", headers={"Origin":"https://foreign.test"}, handler_type=endpoint)[0] == 403
    else:
        assert request(monkeypatch, route, handler_type=endpoint)[0] == 200
        assert request(monkeypatch, route, "POST", handler_type=endpoint)[0] == 404

@pytest.mark.parametrize("path,method,body,headers,status", [
    ("/api/run","POST",b"{}",{},404),
    ("/live/private/accounts.json","GET",b"",{},404),
    ("/api/session/receipt","POST",b'{"hash":"bad"}',{},400),
    ("/api/session/inspect","POST",b'{"deployment":"bad","rpc":"https://other.test"}',{},400),
    ("/api/session/prepare","POST",b"[]",{},400),
    ("/api/session/prepare","POST",b"{}",{"Origin":"https://other.test"},403),
    ("/api/proof","GET",b"",{"Host":"other.test","X-Forwarded-Host":"recall-example.vercel.app"},403),
    ("/api/session/receipt","POST",b"{}",{"Content-Length":"4097"},400),
    ("/api/session/receipt","POST",b"{}",{"Transfer-Encoding":"chunked"},400),
    ("/api/session/receipt","POST",b"{}",{"Content-Type":"text/plain"},400),
    ("/api/check-studio","POST",b"{}",{},400),
    ("/api/dispatch?route=/api/run","POST",b"{}",{},404),
    ("/api/dispatch?route=/api/proof&route=/api/recorded","GET",b"",{},404),
    ("/api/proof?file=anything","GET",b"",{},404),
])
def test_guards(monkeypatch,path,method,body,headers,status):
    monkeypatch.setattr("http.client.HTTPSConnection",lambda *args,**kwargs: pytest.fail("Unexpected network access"))
    assert request(monkeypatch,path,method,body,headers)[0]==status

@pytest.mark.parametrize("path",["/api/proof","/api/dispatch?route=/api/proof",
    "/api/proof?route=/api/proof", "/api/dispatch.py?route=/api/proof"])
def test_public_record(monkeypatch,path):
    status,bundle=request(monkeypatch,path)
    assert status==200
    assert bundle["capabilities"]=={"scripted_demo":False}
    assert bundle["report"]["receipts"][-1]["child"]["value"]=="40000000000000000"
    assert len(bundle["documents"])==5
    assert "private_key" not in json.dumps(bundle)

@pytest.mark.parametrize("path",[
    "/api/proof?route=/api/session/config",
    "/api/proof?route=/api/proof&extra=1",
    "/api/dispatch?route=/api/proof&route=/api/proof",
    "/api/dispatch.py?route=/api/run",
    "/unrelated?route=/api/proof",
])
def test_rewrite_does_not_broaden_route_catalog(monkeypatch,path):
    assert request(monkeypatch,path)[0]==404

def test_rewritten_post_keeps_origin_and_body_guards(monkeypatch):
    path="/api/session/receipt?route=/api/session/receipt"
    assert request(monkeypatch,path,"POST",b'{"hash":"bad"}')[0]==400
    assert request(monkeypatch,path,"POST",b'{}',{"Origin":"https://foreign.test"})[0]==403

def test_bad_evidence_rejected(monkeypatch):
    path_type=type(app.BASE)
    original=path_type.read_bytes
    monkeypatch.setattr(path_type,"read_bytes",lambda p:b"changed" if p.name=="inference-v1.txt" else original(p))
    assert request(monkeypatch,"/api/proof")[0]==400

def test_explicit_host_identity():
    assert app.allowed_hosts({"VERCEL_URL":"example.vercel.app","RECALL_PUBLIC_ORIGIN":"https://recall.example"})=={"example.vercel.app","recall.example"}
    assert not app.allowed_hosts({"RECALL_PUBLIC_ORIGIN":"https://user:pass@recall.example/"})
    assert not app.allowed_hosts({"RECALL_PUBLIC_ORIGIN":"http://recall.example"})

def test_network_busy_fails_without_submission(monkeypatch):
    class Busy:
        def acquire(self,blocking): return False
    monkeypatch.setattr(app,"NETWORK_SLOTS",Busy())
    assert request(monkeypatch,"/api/session/receipt","POST",b'{"hash":"0x123"}')[0]==503
