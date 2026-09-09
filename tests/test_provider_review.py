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
        assert [r['verdict'] for r in s['results']]==['SUPPORTED','SUPPORTED']
        assert s['digest']==hashlib.sha256(payload.encode()).hexdigest() and s['evidence_json']==payload
        assert not any(name in SOURCE.read_text() for name in ['@gl.public.write','emit_transfer','execute_purchase'])

@pytest.mark.parametrize('mutation',['invented-quote','unknown-source','no-quote','extra-field','wrong-order','bad-verdict','oversized-reason'])
def test_bad_model_output_fails_closed(mutation):
    rows=findings()
    if mutation=='invented-quote':rows[0]['citations'][0]['quote']='A guarantee that does not occur in the supplied document.'
    if mutation=='unknown-source':rows[0]['citations'][0]['source']='other'
    if mutation=='no-quote':rows[0]['citations']=[]
    if mutation=='extra-field':rows[0]['trust']=True
    if mutation=='wrong-order':rows.reverse()
    if mutation=='bad-verdict':rows[0]['verdict']='VALID'
    if mutation=='oversized-reason':rows[0]['reason']='x'*601
    vm,payload=deploy(rows=rows)
    with vm.activate():
        c=deploy_contract(SOURCE,vm,payload)
        assert all(r['verdict']=='INCONCLUSIVE' for r in c.snapshot()['results'])
        assert vm.run_validator() is True

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
        assert all(r['verdict']=='INCONCLUSIVE' for r in c.snapshot()['results'])

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
