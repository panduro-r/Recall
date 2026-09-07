import json
import struct
from pathlib import Path

def test_portal_field_limits_and_unsubmitted_status():
    draft=json.loads((Path(__file__).resolve().parents[1]/"submission/agent-tank.json").read_text())
    for field,limit in [("one_liner",180),("description",1000),("expected_outcome",500)]:
        assert 0<len(draft[field])<=limit, (field,len(draft[field]))
    assert draft["status"]=="draft-not-submitted"
    assert draft["website"] == "https://recall-navy-phi.vercel.app/"
    assert all(step["instruction"] for step in draft["how_to"])

def test_submission_logo_is_uploadable_png():
    root=Path(__file__).resolve().parents[1]
    draft=json.loads((root/"submission/agent-tank.json").read_text())
    assert draft["logo_file"] == "submission/recall-logo.png"
    data=(root/draft["logo_file"]).read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    width,height=struct.unpack(">II",data[16:24])
    assert 128 <= width <= 2048 and 128 <= height <= 2048
    assert len(data) < 2_000_000
    assert draft["youtube_url"] is None  # A script is not a video upload.
