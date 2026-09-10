"""Local VM with explicit LLM fixtures. Not live network consensus."""
import hashlib
import json
from pathlib import Path
from copy import deepcopy
import pytest
from gltest.direct import VMContext, deploy_contract
from harness import BUYER
from provider_evidence import canonical

SOURCE = Path(__file__).resolve().parents[1] / 'contracts/provider_review.py'
TEXT = 'Our English pre-recorded single-channel audio transcription API is available on the Standard plan. Customer audio and transcripts are never used to train models.'

def evidence():
    return {'version':1,'plan':{'name':'Example','plan':'Standard'},'requirements':{'noTraining':True,'speakers':False},
            'documents':[{'id':'policy','status':'retrieved','complete':True,'text':TEXT,'textSha256':hashlib.sha256(TEXT.encode()).hexdigest()}]}

def findings():
    return [{'id':key,'verdict':'SUPPORTED','reason':'Explicit fixture, not live inference.',
             'citations':[{'source':'policy','quote':quote}]} for key,quote in [('service',TEXT.split('. ')[0]+'.'),('training','Customer audio and transcripts are never used to train models.')]]

def deploy(data=None,rows=None):
    vm=VMContext();vm.sender=BUYER;vm.value=0
    vm.mock_llm(r'.*',json.dumps({'results':findings() if rows is None else rows}))
    return vm,canonical(data or evidence())

def test_immutable_review_constructor_consensus():
    vm,payload=deploy()
    with vm.activate():
        c=deploy_contract(SOURCE,vm,payload);s=c.snapshot()
        assert vm.run_validator() is True
        assert s['version']==2 and s['review_status']=='completed'
        assert [r['verdict'] for r in s['results']]==['SUPPORTED','SUPPORTED']
        assert s['digest']==hashlib.sha256(payload.encode()).hexdigest() and s['evidence_json']==payload
        assert not any(name in SOURCE.read_text() for name in ['@gl.public.write','emit_transfer','execute_purchase'])

@pytest.mark.parametrize('mutation',['invented-quote','unknown-source','no-quote','extra-field','bad-verdict','oversized-reason'])
def test_bad_model_output_fails_closed(mutation):
    rows=findings()
    if mutation=='invented-quote':rows[0]['citations'][0]['quote']='A guarantee that does not occur in the supplied document.'
    if mutation=='unknown-source':rows[0]['citations'][0]['source']='other'
    if mutation=='no-quote':rows[0]['citations']=[]
    if mutation=='extra-field':rows[0]['trust']=True
    if mutation=='bad-verdict':rows[0]['verdict']='VALID'
    if mutation=='oversized-reason':rows[0]['reason']='x'*601
    vm,payload=deploy(rows=rows)
    with vm.activate():
        c=deploy_contract(SOURCE,vm,payload)
        state=c.snapshot()
        assert state['review_status']=='partial'
        assert state['results'][0]['verdict']=='NOT_ASSESSED'
        assert state['results'][0]['error_code']==('INVALID_CITATION' if mutation in ['invented-quote','unknown-source','no-quote'] else 'INVALID_RESPONSE')
        assert state['results'][1]==findings()[1]
        assert vm.run_validator() is True

def test_model_order_is_normalized_by_unique_condition_id():
    vm,payload=deploy(rows=list(reversed(findings())))
    with vm.activate():
        c=deploy_contract(SOURCE,vm,payload)
        assert c.snapshot()['results']==findings()
        assert vm.run_validator() is True

@pytest.mark.parametrize('response,code',[
    ('not JSON','INVALID_JSON'),
    ('[]','INVALID_RESPONSE'),
    ('{"results":null}','INVALID_RESPONSE'),
    ('{"results":[]}','INVALID_RESPONSE'),
    (json.dumps({'results':[findings()[0],findings()[0]]}),'INVALID_RESPONSE'),
    (json.dumps({'results':findings(),'extra':True}),'INVALID_RESPONSE'),
])
def test_response_failure_is_not_a_terms_verdict(response,code):
    vm=VMContext();vm.sender=BUYER;vm.value=0;vm.mock_llm(r'.*',response)
    with vm.activate():
        c=deploy_contract(SOURCE,vm,canonical(evidence()));s=c.snapshot()
        assert s['review_status']=='failed'
        assert all(r['verdict']=='NOT_ASSESSED' and r['error_code']==code and r['citations']==[] for r in s['results'])
        assert vm.run_validator() is True

def test_model_exception_retains_safe_diagnostic_not_exception_text(monkeypatch):
    vm=VMContext();vm.sender=BUYER;vm.value=0
    def unavailable(*args,**kwargs):raise RuntimeError('secret upstream text must not be saved')
    monkeypatch.setattr(vm,'_match_llm_mock',unavailable)
    with vm.activate():
        c=deploy_contract(SOURCE,vm,canonical(evidence()));s=c.snapshot()
        assert s['review_status']=='failed'
        assert all(r['error_code']=='MODEL_CALL_FAILED' for r in s['results'])
        assert 'secret upstream' not in json.dumps(s)
        assert vm.run_validator() is True

def test_genuine_ambiguity_keeps_reason_and_is_completed_review():
    rows=findings();rows[1].update(verdict='INCONCLUSIVE',reason='The supplied text does not establish which account setting applies.',citations=[])
    vm,payload=deploy(rows=rows)
    with vm.activate():
        c=deploy_contract(SOURCE,vm,payload);s=c.snapshot()
        assert s['review_status']=='completed' and s['results']==rows
        assert vm.run_validator() is True

def test_validator_does_not_agree_across_success_uncertainty_and_failure():
    vm,payload=deploy()
    with vm.activate():
        c=deploy_contract(SOURCE,vm,payload);good=deepcopy(c.snapshot()['results'])
        vm.clear_mocks();vm.mock_llm(r'.*','not JSON')
        assert vm.run_validator() is False
        assert vm.run_validator(leader_result=[{'id':r['id'],'verdict':'NOT_ASSESSED','reason':'invented','citations':[],'error_code':[]} for r in good]) is False
        bad=deepcopy(good);bad[1].update(verdict='INCONCLUSIVE',reason='Unclear.',citations=[])
        vm.clear_mocks();vm.mock_llm(r'.*',json.dumps({'results':findings()}))
        assert vm.run_validator(leader_result=bad) is False

def test_validator_requires_matching_failure_codes():
    vm=VMContext();vm.sender=BUYER;vm.value=0;vm.mock_llm(r'.*','not JSON')
    with vm.activate():
        deploy_contract(SOURCE,vm,canonical(evidence()))
        vm.clear_mocks();vm.mock_llm(r'.*','[]')
        assert vm.run_validator() is False

@pytest.mark.parametrize('mutation',['truncated','unavailable','short'])
def test_missing_text_never_gets_positive_assessment(mutation):
    data=evidence();d=data['documents'][0]
    if mutation=='truncated':d['complete']=False
    elif mutation=='unavailable':d['status']='unavailable'
    else:d['text']='Short.';d['textSha256']=hashlib.sha256(d['text'].encode()).hexdigest()
    vm,payload=deploy(data)
    with vm.activate():
        c=deploy_contract(SOURCE,vm,payload)
        assert c.snapshot()['complete'] is False
        assert c.snapshot()['review_status']=='evidence_incomplete'
        assert all(r['verdict']=='NOT_ASSESSED' and r['error_code']=='INCOMPLETE_EVIDENCE' for r in c.snapshot()['results'])
        assert not vm._captured_validators

def test_changed_terms_review_does_not_overwrite_prior_review():
    vm,payload=deploy()
    with vm.activate():
        old=deploy_contract(SOURCE,vm,payload)
        original=deepcopy(old.snapshot())
    data=evidence();d=data['documents'][0]
    d['text']=TEXT.replace('are never used to train','may be used to train')
    d['textSha256']=hashlib.sha256(d['text'].encode()).hexdigest()
    rows=findings();rows[1].update(verdict='REFUTED',citations=[{'source':'policy','quote':'Customer audio and transcripts may be used to train models.'}])
    vm,_=deploy(data,rows)
    with vm.activate():
        new=deploy_contract(SOURCE,vm,canonical(data))
        assert vm.run_validator() is True
        assert original['results'][1]['verdict']=='SUPPORTED'
        assert new.snapshot()['results'][1]['verdict']=='REFUTED'
        assert original['digest']!=new.snapshot()['digest']

def test_mismatched_fingerprint_reverts():
    data=evidence();data['documents'][0]['textSha256']='0'*64
    vm,payload=deploy(data)
    with vm.activate(),vm.expect_revert('Text fingerprint mismatch'):deploy_contract(SOURCE,vm,payload)
