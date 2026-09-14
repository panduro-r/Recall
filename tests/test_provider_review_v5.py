"""Category-specific local VM fixtures, not live consensus claims."""
import hashlib
import json
from copy import deepcopy
import pytest
from gltest.direct import deploy_contract
from provider_evidence import canonical
import provider_evidence as ev
from test_provider_review import deploy, SOURCE, evidence

TEXT = 'Our standard voices generate English audio from text using an API. Streaming audio is available. Customer input text and generated audio are excluded from training after an explicit account opt-out.'
REQ = {'category':'speech','characters':1000000,'utf8Bytes':None,'budget':50,'noTraining':True,'streaming':True}
def speech():
    d=evidence()
    d['plan'].update(category='speech',unit='utf8-byte')
    d['requirements']=deepcopy(REQ)
    d['documents'][0].update(text=TEXT,textSha256=hashlib.sha256(TEXT.encode()).hexdigest())
    return d
def rows(training=True,streaming=True):
    ids=['speech_api','speech_english']+(['training'] if training else [])+(['streaming'] if streaming else [])
    return [{'id':k,'verdict':'SUPPORTED','reason':'Explicit local fixture.','citations':[{'source':'policy','passage':'p0'}]} for k in ids]

def test_speech_generation_is_a_separate_category_with_source_bound_checks():
    data=speech();findings=rows()
    findings[2].update(verdict='CONDITIONAL',required_actions=['Disable model training and confirm its effective date.'])
    vm,payload=deploy(data,findings)
    with vm.activate():
        contract=deploy_contract(SOURCE,vm,payload);state=contract.snapshot()
        assert state['version']==5 and state['review_status']=='completed'
        assert [r['id'] for r in state['results']]==['speech_api','speech_english','training','streaming']
        assert state['results'][2]['required_actions']==findings[2]['required_actions']
        assert all(r['citations']==[{'source':'policy','quote':TEXT}] for r in state['results'])
        assert vm.run_validator() is True

@pytest.mark.parametrize('training,streaming',[(False,False),(True,False),(False,True)])
def test_only_selected_conditions_are_assessed(training,streaming):
    data=speech();data['requirements'].update(noTraining=training,streaming=streaming)
    vm,payload=deploy(data,rows(training,streaming))
    with vm.activate():
        state=deploy_contract(SOURCE,vm,payload).snapshot()
        assert [r['id'] for r in state['results']]==[r['id'] for r in rows(training,streaming)]
        assert state['review_status']=='completed' and vm.run_validator() is True

@pytest.mark.parametrize('patch',[{'hours':100},{'speakers':False},{'characters':True},{'characters':0},{'characters':100000001},{'utf8Bytes':999999},{'utf8Bytes':4000001},{'streaming':'true'},{'category':'llm'},{'budget':False}])
def test_contract_rejects_invalid_speech_schema(patch):
    data=speech();data['requirements'].update(patch)
    vm,payload=deploy(data,rows())
    with vm.activate(),pytest.raises(Exception):
        deploy_contract(SOURCE,vm,payload)

@pytest.mark.parametrize('unit',['hour','minute'])
def test_contract_rejects_transcription_prices_in_speech_review(unit):
    data=speech();data['plan']['unit']=unit;vm,payload=deploy(data,rows())
    with vm.activate(),pytest.raises(Exception):deploy_contract(SOURCE,vm,payload)

def test_model_cannot_return_transcription_checks_for_speech():
    vm,payload=deploy(speech())  # old transcription fixture response
    with vm.activate():
        state=deploy_contract(SOURCE,vm,payload).snapshot()
        assert state['review_status']=='failed'
        assert all(r['verdict']=='NOT_ASSESSED' for r in state['results'])

def test_new_plan_capture_is_complete_and_read_only(monkeypatch):
    calls=[]
    def fetch(source,include_text=False):
        calls.append(source['url'])
        assert include_text
        return {'status':'retrieved','text':TEXT,'complete':True,'textSha256':hashlib.sha256(TEXT.encode()).hexdigest(),'sha256':'a'*64}
    monkeypatch.setattr(ev.catalog_sources,'fetch_source',fetch)
    for plan_id in ['eleven-flash','fish-speech','deepgram-aura']:
        bundle=ev.capture({'planId':plan_id,'requirements':REQ})
        assert ev.validate_payload(bundle['payload'])==bundle['evidence']
        assert bundle['evidence']['requirements']==REQ
        assert all(d['complete'] for d in bundle['evidence']['documents'])
    assert len(calls)==12 and all(url.startswith('https://') for url in calls)

@pytest.mark.parametrize('plan_id,req',[('assembly-pro',REQ),('fish-speech',{'hours':100,'budget':50,'noTraining':True,'speakers':False})])
def test_cross_category_capture_stops_before_network(monkeypatch,plan_id,req):
    monkeypatch.setattr(ev.catalog_sources,'fetch_source',lambda *a,**kw:pytest.fail('Wrong category must not fetch'))
    with pytest.raises(ValueError):ev.capture({'planId':plan_id,'requirements':req})
