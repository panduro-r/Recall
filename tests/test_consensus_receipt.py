"""A finalized vote rejection must not become a successful assessment/payment."""
from copy import deepcopy
import pytest
from purchase_flow import execution, consensus_result, receipt
from provider_review_flow import inspect

HASH = "0x" + "7" * 64

def transaction():
    return {"hash": HASH, "status": "FINALIZED", "value": 0, "result": 7,
            "result_name": "MAJORITY_DISAGREE", "data": {},
            "consensus_data": {"leader_receipt": [{"mode": "leader", "execution_result": "SUCCESS"}]}}

@pytest.mark.parametrize("code,name", [(2,"DISAGREE"),(3,"TIMEOUT"),(4,"DETERMINISTIC_VIOLATION"),
    (5,"NO_MAJORITY"),(7,"MAJORITY_DISAGREE"),(8,"MAJORITY_TIMEOUT")])
def test_final_rejection_overrides_successful_leader(code, name):
    tx=transaction();tx.update(result=code,result_name=name)
    assert execution(tx)=="ERROR"
    assert consensus_result(tx)==name
    tx["status"]="UNDETERMINED"
    assert execution(tx)=="UNKNOWN"

def test_agreed_error_is_not_promoted():
    tx=transaction();tx.update(result=6,result_name="MAJORITY_AGREE")
    assert execution(tx)=="SUCCESS"
    tx["consensus_data"]["leader_receipt"][0]["execution_result"]="ERROR"
    assert execution(tx)=="ERROR"

@pytest.mark.parametrize("fields", [{"result":99,"result_name":"MAJORITY_AGREE"},
    {"result":7,"result_name":"MAJORITY_AGREE"},{"result":None,"result_name":"NEW_RESULT"}])
def test_unrecognized_or_conflicting_results_fail_closed(fields):
    tx=transaction();tx.update(fields)
    assert execution(tx)=="UNKNOWN"

def test_rejected_review_retains_receipt_without_reading_nonexistent_contract():
    calls=[]
    def read(method,params):
        calls.append(method)
        if method=="eth_chainId":return hex(61999)
        assert method=="eth_getTransactionByHash"
        return deepcopy(transaction())
    row=receipt(HASH,read)
    assert row["status"]=="FINALIZED" and row["execution"]=="ERROR"
    assert row["consensus_result"]=="MAJORITY_DISAGREE"
    with pytest.raises(ValueError,match="successful matching"):
        inspect(HASH,read)
    assert "gen_call" not in calls
