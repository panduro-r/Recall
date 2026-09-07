import json
from pathlib import Path

def test_portal_field_limits_and_unsubmitted_status():
    draft=json.loads((Path(__file__).resolve().parents[1]/"submission/agent-tank.json").read_text())
    for field,limit in [("one_liner",180),("description",1000),("expected_outcome",500)]:
        assert 0<len(draft[field])<=limit, (field,len(draft[field]))
    assert draft["status"]=="draft-not-submitted"
    assert draft["website"] == "https://recall-navy-phi.vercel.app/"
    assert all(step["instruction"] for step in draft["how_to"])
