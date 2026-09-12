from types import SimpleNamespace
from pathlib import Path
import pytest
from server import Handler

@pytest.mark.parametrize('path,kind', [('/review','text/html'),('/review.js','text/javascript'),('/review-model.js','text/javascript'),('/review-passages.js','text/javascript'),('/review.css','text/css')])
def test_review_assets(path,kind):
    handler=object.__new__(Handler)
    handler.path=path
    handler.server=SimpleNamespace(server_port=4181)
    handler.headers={'Host':'127.0.0.1:4181'}
    replies=[]
    handler.reply=lambda status,data,mime:replies.append((status,data,mime))
    handler.do_GET()
    filename='review.html' if path=='/review' else path[1:]
    assert replies==[(200,(Path(__file__).parents[1]/'ui'/filename).read_bytes(),kind)]
