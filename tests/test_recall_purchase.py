"""Real local VM, explicit model fixtures; no network consensus or payments."""
import json
from pathlib import Path
import pytest
from gltest.direct import VMContext, deploy_contract
from harness import BUYER, SELLER, OUTSIDER

SOURCE=Path(__file__).resolve().parents[1]/"contracts/recall_purchase.py"
TERMS="Order 1: prompts are never used to train models. Commercial use of transcripts is permitted."

@pytest.fixture
def purchase():
    vm=VMContext()
    vm.sender=BUYER
    vm.value=0
    vm.warp("2026-09-07T12:00:00Z")
    with vm.activate():
        c=deploy_contract(SOURCE,vm,"0x"+SELLER.hex(),"Transcription API","No model training. Commercial use required.",str(10**17),str(3*10**16),TERMS)
        yield c,vm

def judge(vm, verdict="SUPPORTED"):
    vm.clear_mocks()
    vm.mock_llm(r".*",json.dumps({"verdict":verdict,"reason":"Explicit fixture judgment; not live inference."}))

def accepted(c,vm):
    vm.sender=SELLER
    c.accept_terms()
    vm.sender=BUYER
    judge(vm)
    c.evaluate_claim("offer-1")
    assert vm.run_validator() is True
    c.queue_purchase("offer-1")

def test_complete_replacement(purchase):
    c,vm=purchase
    emitted=[]
    vm._gl_call_hook=lambda _,req: (emitted.append(req["EthSend"]) or {"ok":None}) if "EthSend" in req else None
    accepted(c,vm)
    c.challenge_claim("offer-1","Amendment for order 1: training on all prompts is now permitted; supersedes the prior prohibition.")
    vm.value=3*10**16
    with vm.expect_revert("Payment is blocked"): c.execute_purchase("offer-1")
    vm.value=0
    judge(vm,"REFUTED")
    c.resolve_challenge("offer-1")
    c.cancel_purchase("offer-1")
    vm.sender=SELLER
    c.publish_claim(str(4*10**16),TERMS+" This is a separate replacement order.")
    vm.sender=BUYER
    judge(vm)
    c.evaluate_claim("offer-2")
    c.queue_purchase("offer-2")
    vm.value=4*10**16
    with vm.expect_revert("Review period is still open"): c.execute_purchase("offer-2")
    vm.warp("2026-09-07T12:10:00Z")
    c.execute_purchase("offer-2")
    assert len(emitted)==1
    assert c.snapshot()["offers"][0]["permit"]=="CANCELLED"
    assert c.snapshot()["offers"][1]["permit"]=="SCHEDULED"
    with vm.expect_revert("Purchase is closed"): c.execute_purchase("offer-2")

@pytest.mark.parametrize("method,args",[("accept_terms",()),("evaluate_claim",("offer-1",)),("queue_purchase",("offer-1",)),("cancel_purchase",("offer-1",)),("execute_purchase",("offer-1",)),("publish_claim",("1",TERMS)),("challenge_claim",("offer-1",TERMS)),("resolve_challenge",("offer-1",))])
def test_outsider_rejected(purchase,method,args):
    c,vm=purchase
    vm.sender=OUTSIDER
    with vm.expect_revert("Wrong account"): getattr(c,method)(*args)

@pytest.mark.parametrize("verdict",["INCONCLUSIVE","REFUTED","BOGUS"])
def test_unclear_or_bad_judgment_never_authorizes(purchase,verdict):
    c,vm=purchase
    vm.sender=SELLER;c.accept_terms();vm.sender=BUYER
    judge(vm,verdict);c.evaluate_claim("offer-1")
    with vm.expect_revert("Offer cannot be approved"):c.queue_purchase("offer-1")

def test_cannot_assess_unsigned_supplier_terms(purchase):
    c,vm=purchase
    with vm.expect_revert("Wait for seller acceptance"):c.evaluate_claim("offer-1")

@pytest.mark.parametrize("value",[0,3*10**16-1,3*10**16+1])
def test_exact_payment(purchase,value):
    c,vm=purchase;accepted(c,vm);vm.warp("2026-09-07T12:10:00Z");vm.value=value
    with vm.expect_revert("Exact amount required"):c.execute_purchase("offer-1")

def test_review_and_expiry_boundaries(purchase):
    c,vm=purchase;accepted(c,vm)
    vm.warp("2026-09-07T12:10:00Z")
    with vm.expect_revert("Change review is closed"):c.challenge_claim("offer-1",TERMS)
    vm.warp("2026-09-08T12:00:00Z")
    with vm.expect_revert("Purchase is closed"):c.execute_purchase("offer-1")
    c.cancel_purchase("offer-1")
