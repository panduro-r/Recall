"""Hosted adapter guards, without opening sockets or invoking Studio."""
import io
import json
import ast
import runpy
from urllib.parse import quote
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


def test_explicit_hosting_rewrites_cover_only_the_existing_api():
    config = json.loads((app.BASE / "hosting/vercel.json").read_text())
    assert len(config["rewrites"]) == len(app.GET_ROUTES | app.POST_ROUTES)
    assert {row["source"] for row in config["rewrites"]} == app.GET_ROUTES | app.POST_ROUTES
    for row in config["rewrites"]:
        assert row == {"source": row["source"], "destination": "/api/dispatch?route=" + row["source"]}


@pytest.mark.parametrize("route", sorted(app.GET_ROUTES | app.POST_ROUTES))
@pytest.mark.parametrize("form", ["original", "original-query", "destination", "destination-py"])
def test_single_function_keeps_all_route_bindings_and_guards(monkeypatch, route, form):
    # Vercel's converter percent-encodes the destination route query.
    encoded = "?route=" + quote(route, safe="")
    path = {"original": route, "original-query": route + encoded,
            "destination": "/api/dispatch" + encoded,
            "destination-py": "/api/dispatch.py" + encoded}[form]
    assert app.route_for(path) == route
    assert request(monkeypatch, path, headers={"Host": "foreign.test"})[0] == 403
    if route in app.GET_ROUTES:
        assert request(monkeypatch, path)[0] == 200
        assert request(monkeypatch, path, "POST")[0] == 404
    else:
        assert request(monkeypatch, path)[0] == 404
        assert request(monkeypatch, path, "POST", headers={"Origin": "https://foreign.test"})[0] == 403
        assert request(monkeypatch, path, "POST", b"{}", {"Transfer-Encoding": "chunked"})[0] == 400


@pytest.mark.parametrize("route", sorted(app.POST_ROUTES))
def test_rewritten_posts_reach_the_same_operation_without_network(monkeypatch, route):
    import catalog_sources
    import commerce_flow
    import provider_review_flow
    monkeypatch.setattr("http.client.HTTPSConnection", lambda *a, **kw: pytest.fail("Unexpected network"))
    calls = []
    def operation(data):
        calls.append(data)
        return {"called": route}
    operations = {
        "/api/check-studio": (app, "observe", None),
        "/api/session/prepare": (app.flow, "prepare", {"action": "fixture"}),
        "/api/session/inspect": (app.flow, "inspect", {"deployment": "fixture"}),
        "/api/session/receipt": (app.flow, "receipt", {"hash": "fixture"}),
        "/api/commerce": (commerce_flow, "dispatch", {"op": "config"}),
        "/api/catalog/check": (catalog_sources, "check", {"provider": "assembly"}),
        "/api/provider-review": (provider_review_flow, "dispatch", {"op": "config"})
    }
    module, name, data = operations[route]
    monkeypatch.setattr(module, name, operation)
    body = json.dumps(data).encode() if data is not None else b""
    for path in (route, "/api/dispatch?route=" + quote(route, safe="")):
        assert request(monkeypatch, path, "POST", body) == (200, {"called": route})
    assert len(calls) == 2 and calls[0] == calls[1]

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
    "/api/dispatch?route=%2Fapi%2Fproof&path=proof",
    "/api/dispatch?route=%2Fapi%2Fproof&route=%2Fapi%2Fruntime",
    "/api/dispatch?route=%252Fapi%252Fproof",
    "/api/dispatch",
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
