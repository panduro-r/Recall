from types import SimpleNamespace
import pytest
from server import Handler

@pytest.mark.parametrize('path,kind', [('/workspace','text/html'),('/workspace.js','text/javascript'),('/workspace-model.js','text/javascript'),('/workspace.css','text/css')])
def test_workspace_assets(path,kind):
    h=object.__new__(Handler)
    h.path=path; h.server=SimpleNamespace(server_port=4181)
    h.headers={'Host':'127.0.0.1:4181'}
    results=[]
    h.reply=lambda status,data,mime:results.append((status,data,mime))
    h.do_GET()
    assert results[0][0]==200 and results[0][2]==kind and results[0][1]

def test_commerce_endpoint_is_registered():
    from hosted_app import POST_ROUTES
    assert '/api/commerce' in POST_ROUTES
