import hashlib
from copy import deepcopy
import pytest
import provider_evidence as evidence
import provider_review_flow as flow

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
    def no_rpc(*args):
        pytest.fail('Text evidence must not prepare an audio contract or contact Studio')
    with pytest.raises(ValueError,match='not available for this category'):
        flow.prepare({'account':'0x'+'1'*40,'payload':bundle['payload']},no_rpc)
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

def test_requirements_boundaries_and_audio_source_unchanged():
    assert evidence.normalize_requirements(REQ)==REQ
    assert evidence.normalize_requirements({**REQ,'inputTokens':1,'outputTokens':1000000000,'budget':1.01})['outputTokens']==1000000000
    assert flow.config()['source_sha256']=='e52b576dbe52ea11b0be8ee6869fc68cce63893f99f4e0588a52d45461deddf3'

def test_unavailable_source_is_preserved_without_fabricating_text(monkeypatch):
    monkeypatch.setattr(evidence.catalog_sources,'fetch_source',lambda *a,**kw:{'status':'unavailable','checkedAt':'2026-09-15T18:00:00Z','reason':'The source did not return a successful page.'})
    bundle=evidence.capture({'planId':'openai-mini','requirements':REQ})
    data=evidence.validate_payload(bundle['payload'])
    assert all(d['status']=='unavailable' and not d.get('complete') and not d.get('text') for d in data['documents'])
