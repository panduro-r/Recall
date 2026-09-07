"""Offline wallet preparation, role guards and receipt reconciliation."""
import base64
from copy import deepcopy
import json
import time

import pytest
import rlp
from genlayer_py.abi import calldata
from web3 import Web3

import purchase_flow as flow

BUYER, SELLER, AGENT, CHALLENGER, RECIPIENT = ["0x" + str(n)*40 for n in range(1, 6)]
DEPLOY, PAYMENT, CHILD = ["0x" + char*64 for char in "abc"]
CONTRACT = "0x" + "6"*40
ABI = [{"name":"addTransaction", "type":"function", "stateMutability":"nonpayable", "outputs":[],
        "inputs":[{"name":name,"type":kind} for name,kind in zip(("sender","recipient","validators","rotations","data"),("address","address","uint256","uint256","bytes"))]}]


@pytest.fixture
def case():
    cfg = flow.config()
    state = {"agreement":{"buyer":BUYER,"seller":SELLER,"agent":AGENT,"challenger":CHALLENGER,
             "source_root":cfg["source_root"],"criterion":cfg["criterion"],"budget_wei":str(flow.LIMIT),
             "reserved_wei":"20000000000000000","spent_wei":"0","accepted":True,"expires_at":int(time.time())+2000},
             "claims":[{"id":"storage-v1","status":"VALID","amount_wei":"20000000000000000", "recipient":RECIPIENT,
                        "review_until":int(time.time())-10,"resolve_until":int(time.time())+300,"challenged":False}],
             "permits":[{"id":"p-storage-v1","claim_id":"storage-v1","status":"RESERVED","recipient":RECIPIENT,"amount_wei":"20000000000000000"}]}
    success={"leader_receipt":[{"mode":"leader","execution_result":"SUCCESS"}]}
    txs={DEPLOY:{"hash":DEPLOY,"status":"FINALIZED","from_address":BUYER,"to_address":CONTRACT,"consensus_data":success,
                 "data":{"contract_code":base64.b64encode((flow.BASE/"contracts/recall.py").read_bytes()).decode(),"contract_address":CONTRACT}},
         PAYMENT:{"hash":PAYMENT,"status":"FINALIZED","from_address":BUYER,"to_address":CONTRACT,"value":2*10**16,"consensus_data":success,
                  "triggered_transactions":[CHILD],"data":{"calldata":base64.b64encode(calldata.encode({"method":"execute_purchase","args":["p-storage-v1"]})).decode()}},
         CHILD:{"hash":CHILD,"status":"FINALIZED","from_address":CONTRACT,"to_address":RECIPIENT,"value":2*10**16,"triggered_by":PAYMENT}}
    calls=[]
    def read(method, params):
        calls.append((method, params))
        assert method not in ("eth_sendTransaction","eth_sendRawTransaction")
        if method=="eth_chainId":return hex(61999)
        if method=="eth_gasPrice":return "0x0"
        if method=="sim_getConsensusContract":return {"address":flow.ZERO,"abi":ABI}
        if method=="eth_getTransactionByHash":return txs.get(params[0])
        if method=="gen_call":
            assert params[0]["transaction_hash_variant"]=="latest-final"
            return calldata.encode(state).hex()
        if method=="eth_getBalance":return hex(flow.LIMIT)
        if method=="eth_estimateGas":return hex(1000000)
        if method=="eth_getTransactionCount":return "0x0"
        pytest.fail(method)
    return cfg,state,txs,read,calls


def test_deployment_is_unsigned_and_encodes_four_parties(case):
    _,_,_,read,calls=case
    plan=flow.prepare({"account":BUYER,"action":"deploy","fields":{"seller":SELLER,"agent":AGENT,"challenger":CHALLENGER}},read)
    assert plan["transaction"]["value"]=="0x0" and plan["transaction"]["to"]==flow.ZERO
    fn,args=Web3().eth.contract(abi=ABI).decode_function_input(plan["transaction"]["data"])
    assert fn.fn_name=="addTransaction" and args["sender"]==BUYER and args["recipient"]==flow.ZERO
    parts=rlp.decode(args["data"])
    assert parts[0]==(flow.BASE/"contracts/recall.py").read_bytes() and parts[2]==b""
    assert calldata.decode(parts[1])["args"][:3]==[SELLER,AGENT,CHALLENGER]
    assert not any("send" in method.lower() for method,_ in calls)


def test_payable_request_exact_value_and_normal_consensus(case):
    _,_,_,read,_=case
    result=flow.prepare({"account":BUYER,"action":"execute_purchase","deployment":DEPLOY,"fields":{"permit_id":"p-storage-v1"}},read)
    assert int(result["transaction"]["value"],16)==2*10**16
    assert result["review"]["recipient"]==RECIPIENT
    _,args=Web3().eth.contract(abi=ABI).decode_function_input(result["transaction"]["data"])
    encoded=rlp.decode(args["data"])
    assert encoded[1]==b"" and calldata.decode(encoded[0])=={"method":"execute_purchase","args":["p-storage-v1"]}


@pytest.mark.parametrize("role",[SELLER,AGENT,CHALLENGER])
def test_only_buyer_can_pay_or_cancel(case,role):
    cfg,state,_,_,_=case
    for action in ("execute_purchase","cancel_purchase"):
        with pytest.raises(ValueError,match="required role"):
            flow.action_plan(action,{"permit_id":"p-storage-v1"},role,state,cfg,time.time())


@pytest.mark.parametrize("mutation",["disputed","unknown","cancelled","consumed","early","expired","budget"])
def test_ineligible_payment_is_blocked(case,mutation):
    cfg,state,_,_,_=case
    if mutation=="disputed":state["claims"][0]["status"]="DISPUTED"
    if mutation=="unknown":state["claims"][0]["status"]="UNKNOWN"
    if mutation=="cancelled":state["permits"][0]["status"]="CANCELLED"
    if mutation=="consumed":state["permits"][0]["status"]="SCHEDULED"
    if mutation=="early":state["claims"][0]["review_until"]=time.time()+100
    if mutation=="expired":state["agreement"]["expires_at"]=0
    if mutation=="budget":state["agreement"]["spent_wei"]=str(flow.LIMIT)
    with pytest.raises(ValueError):flow.action_plan("execute_purchase",{"permit_id":"p-storage-v1"},BUYER,state,cfg,time.time())


def test_cancel_after_expiry_remains_allowed(case):
    cfg,state,_,_,_=case;state["agreement"]["expires_at"]=0
    assert flow.action_plan("cancel_purchase",{"permit_id":"p-storage-v1"},BUYER,state,cfg,time.time())[1]==0


def test_payment_time_errors_distinguish_waiting_from_expired(case):
    cfg,state,_,_,_=case
    state["claims"][0]["review_until"]=100
    state["agreement"]["expires_at"]=1000
    def check(now):
        return flow.action_plan("execute_purchase",{"permit_id":"p-storage-v1"},BUYER,state,cfg,now)
    with pytest.raises(ValueError,match="1970-01-01 00:01:45 UTC"):
        check(104)
    assert check(105)[1]==2*10**16
    assert check(994)[1]==2*10**16
    with pytest.raises(ValueError,match="expired.*cancel"):
        check(995)
    # Even if both bounds fail, don't tell users to wait on an expired agreement.
    state["claims"][0]["review_until"]=2000
    with pytest.raises(ValueError,match="expired"):
        check(1001)


def test_rejects_role_reuse(case):
    with pytest.raises(ValueError,match="distinct"):
        flow.prepare({"account":BUYER,"action":"deploy","fields":{"seller":BUYER,"agent":AGENT,"challenger":CHALLENGER}},case[3])


@pytest.mark.parametrize("method,bad",[("eth_chainId","0x1"),("eth_gasPrice","0x1"),("sim_getConsensusContract",{"address":CONTRACT,"abi":ABI})])
def test_environment_drift_prevents_wallet_request(case,method,bad):
    with pytest.raises(ValueError):
        flow.prepare({"account":BUYER,"action":"deploy","fields":{"seller":SELLER,"agent":AGENT,"challenger":CHALLENGER}},lambda m,p:bad if m==method else case[3](m,p))


def test_rejects_arbitrary_payload(case):
    with pytest.raises(ValueError,match="Unexpected"):
        flow.prepare({"account":BUYER,"action":"deploy","fields":{},"rpc":"https://evil.test"},case[3])
    assert not case[4]


def test_attach_requires_verified_source_and_success(case):
    _,_,txs,read,_=case
    assert flow.inspect(DEPLOY,read)["contract"]==CONTRACT
    txs[DEPLOY]["data"]["contract_code"]=base64.b64encode(b"other").decode()
    with pytest.raises(ValueError,match="verified Recall"):flow.inspect(DEPLOY,read)


@pytest.mark.parametrize("status,execution",[("ACCEPTED","SUCCESS"),("FINALIZED","ERROR"),("FINALIZED","UNKNOWN")])
def test_deployment_finality_and_execution_both_required(case,status,execution):
    case[2][DEPLOY]["status"]=status;case[2][DEPLOY]["consensus_data"]={"leader_receipt":[{"mode":"leader","execution_result":execution}]}
    with pytest.raises(ValueError,match="not finalized"):flow.inspect(DEPLOY,case[3])


def test_receipt_decodes_action_and_independent_child(case):
    row=flow.receipt(PAYMENT,case[3])
    assert row["settlement"]=="child-finalized" and row["method"]=="execute_purchase" and row["args"]==["p-storage-v1"]


@pytest.mark.parametrize("key,value",[("status","ACCEPTED"),("triggered_by",DEPLOY),("value",1),("from_address",BUYER)])
def test_bad_child_never_establishes_delivery(case,key,value):
    case[2][CHILD][key]=value
    assert flow.receipt(PAYMENT,case[3])["settlement"]=="unverified"


def test_missing_receipt_is_not_success(case):
    assert flow.receipt("0x"+"f"*64,case[3])["status"]=="NOT_FOUND"


def test_all_contract_actions_have_role_and_state_guards(case):
    cfg,state,_,_,_=case
    state["claims"]=[{"id":"inference-v1","status":"PENDING","amount_wei":"30000000000000000","recipient":RECIPIENT,"challenged":False,"review_until":time.time()+600,"resolve_until":time.time()+900}]
    state["permits"]=[];state["agreement"]["reserved_wei"]="0"
    assert flow.action_plan("evaluate_claim",{"claim_id":"inference-v1"},AGENT,state,cfg,time.time())[0]==["inference-v1"]
    state["claims"][0]["status"]="VALID"
    assert flow.action_plan("queue_purchase",{"claim_id":"inference-v1"},BUYER,state,cfg,time.time())[0]==["p-inference-v1","inference-v1"]
    assert len(flow.action_plan("challenge_claim",{"claim_id":"inference-v1"},CHALLENGER,state,cfg,time.time())[0])==3
    state["claims"][0]["status"]="DISPUTED"
    assert flow.action_plan("resolve_challenge",{"claim_id":"inference-v1"},SELLER,state,cfg,time.time())[0]==["inference-v1"]
    with pytest.raises(ValueError):flow.action_plan("publish_claim",{"claim_id":"inference-replacement","recipient":RECIPIENT},SELLER,state,cfg,time.time())
    state["claims"][0]["status"]="INVALID"
    assert flow.action_plan("publish_claim",{"claim_id":"inference-replacement","recipient":RECIPIENT},SELLER,state,cfg,time.time())[0][-1]=="inference-v1"
    state["agreement"]["accepted"]=False
    assert flow.action_plan("accept_terms",{},SELLER,state,cfg,time.time())[0]==[]
