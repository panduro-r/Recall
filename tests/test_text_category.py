import hashlib
from copy import deepcopy
import pytest
import provider_evidence as evidence
import provider_review_flow as flow
import rlp
from genlayer_py.abi import calldata
from web3 import Web3
from test_provider_evidence import ABI

REQ = {'category':'text','inputTokens':1000000,'outputTokens':200000,'budget':50,'noTraining':True,'streaming':False}
PLANS = ['openai-mini','anthropic-haiku','google-flash','mistral-small','deepseek-flash']

@pytest.fixture
def mock_sources(monkeypatch):
    def fetch(source,include_text=False):
        assert include_text
        text='Synthetic public text API documentation for capture tests only. It is not an assessment or proof of any provider commitment. '+source['label']
        return {'status':'retrieved','text':text,'complete':True,'sha256':'a'*64,'textSha256':hashlib.sha256(text.encode()).hexdigest(),'checkedAt':'2026-09-15T18:00:00Z','bytes':300}
    monkeypatch.setattr(evidence.catalog_sources,'fetch_source',fetch)

@pytest.mark.parametrize('plan_id',PLANS)
def test_text_capture_and_prepare_boundary(mock_sources,plan_id):
    bundle=evidence.capture({'planId':plan_id,'requirements':REQ})
    data=evidence.validate_payload(bundle['payload'])
    assert data['requirements']==REQ
    assert data['plan']['outputRate']>0 and data['plan']['unit']=='token'
    catalog=evidence.catalog_sources.catalog()
    assert [d['id'] for d in data['documents']]==data['plan']['sources']
    assert all(d['url']==catalog['sources'][d['id']]['url'] for d in data['documents'])
    assert bundle['digest']==hashlib.sha256(bundle['payload'].encode()).hexdigest()
    before=deepcopy(bundle)
    calls=[]
    def mock_rpc(method,params):
        calls.append(method)
        return {'eth_chainId':hex(61999),'eth_gasPrice':'0x0','eth_estimateGas':'0xf4240','eth_getTransactionCount':'0x2',
                'sim_getConsensusContract':{'address':flow.ZERO,'abi':ABI}}[method]
    prepared=flow.prepare({'account':'0x'+'1'*40,'payload':bundle['payload']},mock_rpc)
    _,args=Web3().eth.contract(abi=ABI).decode_function_input(prepared['transaction']['data'])
    parts=rlp.decode(args['data'])
    assert parts[0]==flow.SOURCE.read_bytes() and parts[2]==b''
    assert calldata.decode(parts[1])=={'args':[bundle['payload']]}
    assert prepared['transaction']['value']=='0x0' and prepared['review']['recipient']==''
    assert flow.config()['version']==8 and not any('send' in m.lower() for m in calls)
    assert bundle==before
    changed=deepcopy(data);changed['plan']['outputRate']*=2
    with pytest.raises(ValueError):evidence.validate_payload(evidence.canonical(changed))

@pytest.mark.parametrize('key',['inputTokens','outputTokens'])
@pytest.mark.parametrize('value',[None,True,False,'1000',[],{},0,-1,1.5,1000000001,float('inf')])
def test_token_volume_strict(key,value):
    with pytest.raises(ValueError):evidence.normalize_requirements({**REQ,key:value})

@pytest.mark.parametrize('patch',[{'hours':100},{'characters':100},{'utf8Bytes':None},{'speakers':False},{'streaming':'false'},{'noTraining':1},{'category':'unknown'},{'budget':1.001}])
def test_cross_category_or_invalid_requirements(patch):
    with pytest.raises(ValueError):evidence.normalize_requirements({**REQ,**patch})

def test_requirements_boundaries_and_previous_audio_source_pinned_for_reading():
    assert evidence.normalize_requirements(REQ)==REQ
    assert evidence.normalize_requirements({**REQ,'inputTokens':1,'outputTokens':1000000000,'budget':1.01})['outputTokens']==1000000000
    assert flow.LEGACY_SOURCES['e52b576dbe52ea11b0be8ee6869fc68cce63893f99f4e0588a52d45461deddf3']==6
    assert flow.config()['source_sha256'] not in flow.LEGACY_SOURCES


def test_anthropic_text_capture_uses_model_and_messages_docs_without_rewriting_history(mock_sources):
    catalog = evidence.catalog_sources.catalog()
    current = next(plan for plan in catalog['plans'] if plan['id'] == 'anthropic-haiku')
    old = ['anthropic-price', 'anthropic-data', 'anthropic-stream']
    assert current['sources'] == ['anthropic-models', 'anthropic-messages', 'anthropic-training']
    assert catalog['reviewSourceHistory']['anthropic-haiku'] == [
        old, ['anthropic-models', 'anthropic-messages', 'anthropic-data']]
    bundle = evidence.capture({'planId': 'anthropic-haiku', 'requirements': REQ})
    assert [doc['id'] for doc in bundle['evidence']['documents']] == current['sources']
    historical = deepcopy(bundle['evidence'])
    historical['plan']['sources'] = old
    historical['documents'] = [{**doc, 'id': source_id,
                                'url': catalog['sources'][source_id]['url'],
                                'label': catalog['sources'][source_id]['label']}
                               for doc, source_id in zip(historical['documents'], old)]
    with pytest.raises(ValueError, match='catalog changed'):
        evidence.validate_payload(evidence.canonical(historical))

def test_v8_live_quality_failures_are_not_misrepresented_as_release_clearance():
    assert 'not cleared for publication' in flow.config()['notice']
    assert 'unsupported claims accepted' in flow.config()['notice']
    assert 'not been live-validated' not in flow.config()['notice']

def test_unavailable_source_is_preserved_without_fabricating_text(monkeypatch):
    monkeypatch.setattr(evidence.catalog_sources,'fetch_source',lambda *a,**kw:{'status':'unavailable','checkedAt':'2026-09-15T18:00:00Z','reason':'The source did not return a successful page.'})
    bundle=evidence.capture({'planId':'openai-mini','requirements':REQ})
    data=evidence.validate_payload(bundle['payload'])
    assert all(d['status']=='unavailable' and not d.get('complete') and not d.get('text') for d in data['documents'])
