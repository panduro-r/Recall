import json
import hashlib
import re
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


def test_submission_matches_current_verified_product_and_preserves_boundaries():
    root=Path(__file__).resolve().parents[1]
    draft=json.loads((root/"submission/agent-tank.json").read_text())
    assert "/compare" in draft["how_to"][0]["instruction"]
    assert "Capture evidence" in draft["how_to"][1]["instruction"]
    assert "/proof" in draft["how_to"][-1]["instruction"]
    assert "Speechmatics v3 and AssemblyAI v4" in draft["description"]
    assert "not integrated" in draft["description"]
    assert "uncoached usability check" in draft["remaining"][0]
    assert "purchasing-agent API are future work" in draft["description"]
    assert "no model training" in json.dumps(draft).lower()
    assert "not a recorded or uploaded video" in (root/"submission/demo-script.md").read_text()


def test_verified_examples_keep_versions_and_conditional_findings_distinct():
    root=Path(__file__).resolve().parents[1]
    draft=json.loads((root/"submission/agent-tank.json").read_text())
    record=json.loads((root/draft["validation_file"]).read_text())
    assert record["submissions"] == 0
    assert record["verification_kind"] == "read-only-existing-public-reviews"
    assembly,speech=record["reviews"]
    assert assembly["provider"] == "AssemblyAI" and assembly["version"] == 4
    assert assembly["findings"] == {
        "service_api":"SUPPORTED", "service_batch":"SUPPORTED",
        "service_english":"SUPPORTED", "service_channels":"SUPPORTED", "training":"CONDITIONAL"
    }
    assert speech["provider"] == "Speechmatics" and speech["version"] == 3
    assert speech["findings"] == {"service":"SUPPORTED", "training":"SUPPORTED"}
    # This verified v4 run must retain its original source after the v5 release.
    from provider_review_flow import LEGACY_SOURCES
    assert LEGACY_SOURCES[assembly["source_sha256"]] == 4
    for index,row in enumerate(record["reviews"]):
        assert row["status"] == "FINALIZED" and row["execution"] == "SUCCESS"
        assert re.fullmatch(r"0x[0-9a-f]{64}", row["deployment"])
        assert re.fullmatch(r"[0-9a-f]{64}", row["evidence_sha256"])
        assert row["contract"] in draft["contract_links"][index]
    assert len(draft["contract_links"]) == len(draft["contract_link_labels"])
    assert "historical" in draft["contract_link_labels"][-1]


def test_demo_follows_real_decision_journey_without_fabricated_completion():
    root=Path(__file__).resolve().parents[1]
    script=(root/"submission/demo-script.md").read_text()
    for phrase in ["Compare options", "Open saved review", "Review required setup", "Export comparison"]:
        assert phrase in script
    assert "different formats and dated snapshots" in script
    assert "Optional appendix, outside the two minutes" in script
    assert "not implemented" in script
    spoken=re.findall(r"^“(.+?)”$", script, flags=re.M)
    assert len(spoken) == 6
    # Leave time inside two minutes to click, read a quote, and show the export.
    assert 180 <= len(" ".join(spoken).split()) <= 260
    usability=(root/"submission/usability-check.md").read_text()
    assert "not yet run with a participant" in usability
    assert "Not run" in usability


def test_partial_rules_recheck_and_future_categories_are_not_claimed_complete():
    root=Path(__file__).resolve().parents[1]
    draft=json.loads((root/"submission/agent-tank.json").read_text())
    assert draft["requirements_checked_on"] == "2026-09-07"
    assert draft["requirements_recheck"]["status"] == "partial-owner-check-required"
    assert draft["product_updated_on"] == "2026-09-14"
    pitch=(root/"submission/pitch.md").read_text()
    assert "not newly supported integrations" in pitch
    assert "not by adding names" in pitch
    assert "No participant test or demand validation has been completed" in pitch


def test_current_materials_link_to_existing_local_artifacts():
    root=Path(__file__).resolve().parents[1]
    for name in ["pitch.md", "demo-script.md", "usability-check.md", "demo-2026-09-13.md"]:
        path=root/"submission"/name
        for target in re.findall(r"\]\(([^)]+)\)", path.read_text()):
            if "://" not in target and not target.startswith("#"):
                assert (path.parent/target.split("#",1)[0]).is_file(), (name,target)


def test_separate_fish_v6_record_preserves_unknowns_and_original_failure():
    root = Path(__file__).resolve().parents[1]
    record = json.loads((root/"submission/verified-fish-v6-2026-09-15.json").read_text())
    assert record["verification_kind"] == "separately-authorized-single-studio-review"
    assert record["submissions"] == 1 and record["automatic_resubmissions"] == 0
    assert record["transaction_value_wei"] == record["outer_gas_price_wei"] == "0"
    assert record["balance_before_wei"] == record["balance_after_wei"] == "1000000000000000000"
    assert record["chain_id"] == 61999 and record["nonce"] == 3
    assert len(record["reviews"]) == 1
    review = record["reviews"][0]
    assert review["version"] == 6 and review["plan_id"] == "fish-speech"
    assert review["status"] == "FINALIZED" and review["execution"] == "SUCCESS"
    assert review["consensus"] == "MAJORITY_AGREE" and review["frontend_accepts"] is True
    assert review["findings"] == {"speech_api": "SUPPORTED", "speech_english": "SUPPORTED",
                                  "training": "INCONCLUSIVE", "streaming": "SUPPORTED"}
    assert "fish-tts-product" in review["citation_sources"]["speech_english"]
    assert review["decision"] == "Some checks are still unknown"
    assert "billing analogy" in review["limitations"]
    original = json.loads((root/record["previous_run_unchanged"]).read_text())
    failed = next(r for r in original["reviews"] if r["plan_id"] == "fish-speech")
    assert failed["deployment"] == record["previous_fish_deployment"] != review["deployment"]
    assert failed["execution"] == "ERROR" and failed["accepted_findings"] == 0
    assert failed["review_status"] == "not_assessed" and "findings" not in failed
    assert "test_fish_v6_test.py" in (root/"hosting/prepare-release.mjs").read_text()
