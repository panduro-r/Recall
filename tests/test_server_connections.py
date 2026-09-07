"""Loopback regression tests; no external services, wallets or transactions."""
from http.client import HTTPConnection
import socket
from threading import Event, Thread

import pytest
from server import Handler, create_server


@pytest.mark.parametrize("partial_request", [False, True])
def test_stalled_connection_does_not_block_purchase_page(monkeypatch, partial_request):
    accepted = Event()
    original = Handler.setup

    def setup(handler):
        original(handler)
        accepted.set()

    monkeypatch.setattr(Handler, "setup", setup)
    try:
        server = create_server(0)
    except PermissionError:
        pytest.skip("Loopback binding requires sandbox network approval")
    port = server.server_port
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    stalled = socket.create_connection(("127.0.0.1", port), timeout=2)
    client = HTTPConnection("127.0.0.1", port, timeout=2)
    try:
        if partial_request:
            stalled.sendall((f"POST /api/run HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n"
                             f"Origin: http://127.0.0.1:{port}\r\nContent-Length: 100\r\n\r\n{{").encode())
        assert accepted.wait(2), "The first connection was not accepted"
        client.request("GET", "/purchase")
        response = client.getresponse()
        assert response.status == 200
        assert b"Studio purchase flow" in response.read()
        assert Handler.timeout == 10
    finally:
        client.close()
        stalled.close()
        server.shutdown()
        server.server_close()
        thread.join(2)
