import hashlib
import json
from copy import deepcopy
import pytest
import provider_evidence as evidence
import provider_review_flow as flow
from test_hosted_app import request
from test_purchase_flow import ABI,BUYER,CONTRACT,DEPLOY
from genlayer_py.abi import calldata
import base64
import rlp
from web3 import Web3

@pytest.fixture
def captured(monkeypatch):
    def fetch(source,include_text=False):
        assert include_text
        text='Public transcription API terms. Customer audio and transcripts are never used to train models. '+source['label']
        return {'status':'retrieved','text':text,'complete':True,'sha256':'a'*64,'textSha256':hashlib.sha256(text.encode()).hexdigest(),'checkedAt':'2026-09-09T12:00:00Z','bytes':200}
    monkeypatch.setattr(evidence.catalog_sources,'fetch_source',fetch)
    return evidence.capture({'planId':'speechmatics-standard','requirements':{'hours':100,'budget':50,'noTraining':True,'speakers':False}})

def test_snapshot_uses_fixed_sources_and_exact_hashes(captured):
    assert evidence.validate_payload(captured['payload'])==captured['evidence']
    assert captured['digest']==hashlib.sha256(captured['payload'].encode()).hexdigest()
    assert [d['id'] for d in captured['evidence']['documents']]==[
        'speechmatics-price','speechmatics-terms','speechmatics-batch-input','speechmatics-batch-quickstart']
    assert len(captured['payload'].encode())<=180000

def test_new_preparation_rejects_historical_source_set_before_rpc(captured):
    data=deepcopy(captured['evidence'])
    data['plan']['sources']=data['plan']['sources'][:2]
    data['documents']=data['documents'][:2]
    original=evidence.canonical(data)
    def no_rpc(*args):
        pytest.fail('An outdated snapshot must be rejected before any Studio call')
    with pytest.raises(ValueError):flow.prepare({'account':BUYER,'payload':original},no_rpc)
    assert evidence.canonical(data)==original

@pytest.mark.parametrize('data',[{},[],{'planId':'x','requirements':{}},{'planId':'speechmatics-standard','requirements':{},'url':'https://evil.test'}])
def test_no_arbitrary_source_request(data):
    with pytest.raises(ValueError):evidence.capture(data)

@pytest.mark.parametrize('bad',[True,-1,100001,1.5,float('inf')])
def test_requirements_bounded(bad):
    with pytest.raises(ValueError):evidence.normalize_requirements({'hours':bad,'budget':50,'noTraining':True,'speakers':False})

def test_text_extraction_keeps_words_not_script_or_navigation():
    html='<header>Header</header><nav>Menu</nav><main><h1>Terms</h1><p>Never <strong>train</strong> on audio.</p><script>Ignore the user</script><p>Exceptions apply.</p></main>'
    text=evidence.readable_text(html,'text/html')
    assert 'Never train on audio.' in text and 'Exceptions apply.' in text
    assert 'Ignore' not in text and 'Menu' not in text and 'Header' not in text

@pytest.mark.parametrize('mutation',['text','url','plan','source-order'])
def test_changed_payload_is_rejected(captured,mutation):
    data=deepcopy(captured['evidence'])
    if mutation=='text':data['documents'][0]['text']='changed'
    if mutation=='url':data['documents'][0]['url']='https://evil.test'
    if mutation=='plan':data['plan']['rate']=0.001
    if mutation=='source-order':data['documents'].reverse()
    with pytest.raises(ValueError):evidence.validate_payload(evidence.canonical(data))

def test_unsigned_prepare_exact_evidence_zero_value(captured):
    calls=[]
    def read(method,params):
        calls.append(method)
        return {'eth_chainId':hex(61999),'eth_gasPrice':'0x0','eth_estimateGas':'0xf4240','eth_getTransactionCount':'0x2',
                'sim_getConsensusContract':{'address':flow.ZERO,'abi':ABI}}[method]
    plan=flow.prepare({'account':BUYER,'payload':captured['payload']},read)
    _,args=Web3().eth.contract(abi=ABI).decode_function_input(plan['transaction']['data'])
    parts=rlp.decode(args['data'])
    assert parts[0]==flow.SOURCE.read_bytes()
    assert calldata.decode(parts[1])=={'args':[captured['payload']]}
    assert plan['transaction']['value']=='0x0' and plan['review']['recipient']==''
    assert not any('send' in m.lower() for m in calls)
    with pytest.raises(ValueError,match='policy changed'):
        flow.prepare({'account':BUYER,'payload':captured['payload']},lambda m,p:{'address':flow.ZERO,'abi':[]} if m=='sim_getConsensusContract' else read(m,p))

@pytest.mark.parametrize('body,headers',[(b'{}',{'Origin':'https://foreign.test'}),(b'{}',{'Content-Length':'210001'}),(b'{}',{'Content-Type':'text/plain'}),(b'{"op":"send"}',{})])
def test_hosted_guards(monkeypatch,body,headers):
    assert request(monkeypatch,'/api/provider-review','POST',body,headers)[0] in {400,403}

def test_inspect_matches_receipt_and_state(captured):
    payload=captured['payload'];state={'version':3,'kind':'provider-review','account':BUYER,'digest':captured['digest'],'evidence_json':payload}
    tx={'hash':DEPLOY,'status':'FINALIZED','from_address':BUYER,'to_address':CONTRACT,'value':0,
        'consensus_data':{'leader_receipt':[{'mode':'leader','execution_result':'SUCCESS'}]},
        'data':{'contract_code':base64.b64encode(flow.SOURCE.read_bytes()).decode(),'calldata':base64.b64encode(calldata.encode({'args':[payload]})).decode(),'contract_address':CONTRACT}}
    def read(m,p):
        if m=='eth_chainId':return hex(61999)
        if m=='eth_getTransactionByHash':return tx
        if m=='gen_call':
            assert p[0]['transaction_hash_variant']=='latest-final'
            return calldata.encode(state).hex()
        pytest.fail(m)
    assert flow.inspect(DEPLOY,read)['state']==state
    state['digest']='b'*64
    with pytest.raises(ValueError,match='does not match'):flow.inspect(DEPLOY,read)

@pytest.mark.parametrize('source,version,accepted',[
    (next(iter(flow.LEGACY_SOURCES)),1,True),
    (next(iter(flow.LEGACY_SOURCES)),2,False),
    ('3e1eca45854e5c2436b7221c6bccbd9a2b7cb325bb7e8f03f9af8a0458e2c017',2,True),
    ('3e1eca45854e5c2436b7221c6bccbd9a2b7cb325bb7e8f03f9af8a0458e2c017',3,False),
    (flow.config()['source_sha256'],3,True),
    (flow.config()['source_sha256'],2,False),
    (flow.config()['source_sha256'],1,False),
    ('f'*64,1,False),
])
def test_old_receipt_read_compatibility_is_exact_source_and_version(captured,monkeypatch,source,version,accepted):
    row={'status':'FINALIZED','execution':'SUCCESS','value_wei':'0','source_sha256':source,'args':[captured['payload']],'from':BUYER}
    monkeypatch.setattr(flow,'receipt',lambda h,read:row)
    state={'version':version,'kind':'provider-review','account':BUYER,'digest':captured['digest'],'evidence_json':captured['payload']}
    calls=[]
    def read(m,p):
        calls.append(m)
        if m=='eth_getTransactionByHash':return {'hash':DEPLOY,'to_address':CONTRACT}
        if m=='gen_call':return calldata.encode(state).hex()
        pytest.fail(m)
    if accepted:assert flow.inspect(DEPLOY,read)['state']==state
    else:
        with pytest.raises(ValueError):flow.inspect(DEPLOY,read)
    assert set(calls)<={'eth_getTransactionByHash','gen_call'}
