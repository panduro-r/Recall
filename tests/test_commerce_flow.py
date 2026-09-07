"""Offline adapter tests; RPC fixtures never sign, fund or broadcast."""
import base64
import time
from copy import deepcopy
import pytest
import rlp
from genlayer_py.abi import calldata
from web3 import Web3
import commerce_flow as flow
from test_purchase_flow import ABI, BUYER, SELLER, DEPLOY, CONTRACT, PAYMENT, CHILD

@pytest.fixture
def case():
    fields={'seller':SELLER,'title':'Support API','criterion':'Customer prompts must never be used to train models.',
            'budget_wei':str(10**17),'amount_wei':str(4*10**16),'terms':'Supplier order 1: all customer prompts are excluded from model training.'}
    state={'version':2,'buyer':BUYER,'seller':SELLER,'title':fields['title'],'criterion':fields['criterion'],
           'budget_wei':fields['budget_wei'],'expires_at':int(time.time())+2000,'accepted':True,'paid':False,
           'offers':[{'id':'offer-1','amount_wei':fields['amount_wei'],'terms':fields['terms'],'status':'VALID','permit':'RESERVED',
                      'review_until':int(time.time())-10,'counter_terms':'','judgment':None}]}
    success={'leader_receipt':[{'mode':'leader','execution_result':'SUCCESS'}]}
    txs={DEPLOY:{'hash':DEPLOY,'status':'FINALIZED','from_address':BUYER,'to_address':CONTRACT,'consensus_data':success,
                'data':{'contract_code':base64.b64encode(flow.SOURCE.read_bytes()).decode(),'contract_address':CONTRACT,
                        'calldata':base64.b64encode(calldata.encode({'args':list(fields.values())})).decode()}}}
    calls=[]
    def read(method,params):
        calls.append(method)
        if method=='eth_chainId':return hex(61999)
        if method=='eth_gasPrice':return '0x0'
        if method=='sim_getConsensusContract':return {'address':flow.ZERO,'abi':ABI}
        if method=='eth_getTransactionByHash':return txs.get(params[0])
        if method=='gen_call':
            assert params[0]['transaction_hash_variant']=='latest-final'
            return calldata.encode(state).hex()
        if method=='eth_getBalance':return hex(10**17)
        if method=='eth_estimateGas':return hex(1000000)
        if method=='eth_getTransactionCount':return '0x0'
        pytest.fail('Unexpected RPC method: '+method)
    return fields,state,txs,read,calls

def test_unsigned_deployment_encodes_exact_custom_purchase(case):
    fields,_,_,read,calls=case
    plan=flow.prepare({'account':BUYER,'action':'deploy','fields':fields},read)
    _,decoded=Web3().eth.contract(abi=ABI).decode_function_input(plan['transaction']['data'])
    parts=rlp.decode(decoded['data'])
    assert parts[0]==flow.SOURCE.read_bytes()
    assert calldata.decode(parts[1])=={'args':list(fields.values())}
    assert plan['transaction']['value']=='0x0' and decoded['recipient']==flow.ZERO
    assert not any('send' in m.lower() for m in calls)

def test_unsigned_payment_preserves_exact_recipient_and_value(case):
    plan=flow.prepare({'account':BUYER,'action':'execute_purchase','fields':{'offer_id':'offer-1'},'deployment':DEPLOY},case[3])
    assert plan['review']['recipient']==SELLER and plan['review']['value_wei']==str(4*10**16)
    _,decoded=Web3().eth.contract(abi=ABI).decode_function_input(plan['transaction']['data'])
    assert decoded['recipient']==CONTRACT
    assert calldata.decode(rlp.decode(decoded['data'])[0])=={'method':'execute_purchase','args':['offer-1']}

@pytest.mark.parametrize('mutation',['early','expired','invalid','unknown','disputed','canceled','consumed','paid','outsider'])
def test_payment_fails_closed(case,mutation):
    s=case[1];o=s['offers'][0];account=BUYER;now=time.time()
    if mutation=='early':o['review_until']=now+100
    elif mutation=='expired':s['expires_at']=now
    elif mutation in ['invalid','unknown','disputed']:o['status']=mutation.upper()
    elif mutation=='canceled':o['permit']='CANCELLED'
    elif mutation=='consumed':o['permit']='SCHEDULED'
    elif mutation=='paid':s['paid']=True
    elif mutation=='outsider':account=SELLER
    with pytest.raises(ValueError):flow.plan_action('execute_purchase',{'offer_id':'offer-1'},account,s,now)

@pytest.mark.parametrize('action',['accept_terms','publish_claim','evaluate_claim','queue_purchase','challenge_claim','resolve_challenge','cancel_purchase','execute_purchase'])
def test_outsider_cannot_prepare_any_action(case,action):
    with pytest.raises(ValueError,match='wallet'):flow.plan_action(action,{},'0x'+'9'*40,case[1],time.time())

def test_cancel_is_available_after_expiry(case):
    s=case[1];s['expires_at']=0
    assert flow.plan_action('cancel_purchase',{'offer_id':'offer-1'},BUYER,s,time.time())[1]==0

@pytest.mark.parametrize('method,bad',[('eth_chainId','0x1'),('eth_gasPrice','0x1'),('sim_getConsensusContract',{'address':CONTRACT,'abi':ABI})])
def test_chain_and_transport_drift_disable_signing(case,method,bad):
    with pytest.raises(ValueError):flow.prepare({'account':BUYER,'action':'deploy','fields':case[0]},lambda m,p:bad if m==method else case[3](m,p))

def test_source_and_finality_required(case):
    assert flow.inspect(DEPLOY,case[3])['contract']==CONTRACT
    case[2][DEPLOY]['data']['contract_code']=base64.b64encode(b'different contract').decode()
    with pytest.raises(ValueError,match='version'):flow.inspect(DEPLOY,case[3])

@pytest.mark.parametrize('mutation',['missing','extra','same-seller','over-budget','long-terms'])
def test_deployment_input_bounds(case,mutation):
    f=deepcopy(case[0])
    if mutation=='missing':del f['terms']
    elif mutation=='extra':f['rpc']='https://untrusted.test'
    elif mutation=='same-seller':f['seller']=BUYER
    elif mutation=='over-budget':f['amount_wei']=str(2*10**17)
    elif mutation=='long-terms':f['terms']='x'*6001
    with pytest.raises(ValueError):flow.prepare({'account':BUYER,'action':'deploy','fields':f},case[3])

def test_dispatch_never_accepts_arbitrary_operations(case):
    for data in [{'op':'send'},{'op':'config','rpc':'bad'},[],{'op':'receipt','hash':'bad'}]:
        with pytest.raises(ValueError):flow.dispatch(data,case[3])
