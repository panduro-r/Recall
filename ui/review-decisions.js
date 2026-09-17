// v20 read integration, not a category-enablement switch. Receipt identity and
// capture fingerprints must also be checked by the caller before acceptance.
import {receiptMatches} from './wallet.js';
export const DECISION_SOURCE='dddb4a8c382cea0e1033b403aa4f5d159a20bab1db3996e77b115c0926966557';
export const DECISION_PROTOCOL='013d610eeb7aa4f39af908335c860e2180dbdcb92963a1c234a19874467c7970';
const technical={DOCUMENTED:'SUPPORTED',EXPLICITLY_UNAVAILABLE:'REFUTED',INSUFFICIENT_EVIDENCE:'INCONCLUSIVE',CONFLICTING_EVIDENCE:'INCONCLUSIVE'};
const training={EXCLUDED_BY_DEFAULT:'SUPPORTED',OPT_OUT_REQUIRED_DEFAULT_PERMITTED:'CONDITIONAL',OPT_OUT_REQUIRED_DEFAULT_UNSPECIFIED:'CONDITIONAL',TRAINING_PERMITTED_NO_OPT_OUT:'REFUTED',INSUFFICIENT_EVIDENCE:'INCONCLUSIVE',CONFLICTING_EVIDENCE:'INCONCLUSIVE'};
const keys=(v,expected)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===expected.split(',').sort().join(',');
const count=s=>[...s].length;
// Match the contract's Unicode code-point slices, including its short-tail rule.
export function decisionPassages(text){
  const chars=[...text],parts=[]; let start=0;
  while(start<chars.length){
    const end=Math.min(start+480,chars.length);
    if(end===chars.length&&end-start<12)start=Math.max(0,end-480);
    parts.push(chars.slice(start,end).join(''));
    if(end===chars.length)break;
    start=end-80;
  }
  return parts;
}
export function validDecisionState(state,evidence){
  try{
    if(!keys(state,'account,assessment,complete,digest,evidence_json,kind,protocol_sha256,release_cleared,review_status,version')||state.version!==20||state.kind!=='provider-review-decisions-candidate'||state.release_cleared!==false||state.protocol_sha256!==DECISION_PROTOCOL||state.complete!==true||state.review_status!=='completed')return false;
    const a=state.assessment,req=evidence.requirements,category=req.category??'transcription';
    if(!keys(a,'kind,schema_version,release_cleared,evidence_sha256,results')||a.kind!=='local-evidence-decisions-experiment'||a.schema_version!==20||a.release_cleared!==false||a.evidence_sha256!==state.digest)return false;
    const base={text:['text_api','text_output'],speech:['speech_api','speech_english'],transcription:['service_api','service_batch','service_english','service_channels']}[category];
    if(!base||!Array.isArray(evidence.documents)||evidence.documents.length<1||evidence.documents.length>4)return false;
    const ids=[...base,...(req.noTraining?['training']:[]),...(category==='transcription'?req.speakers?['speakers']:[]:req.streaming?[category==='text'?'text_streaming':'streaming']:[])];
    const docs=new Map();
    for(const d of evidence.documents){
      if(!d||typeof d.id!=='string'||docs.has(d.id)||d.status!=='retrieved'||d.complete!==true||typeof d.text!=='string'||count(d.text)<100||count(d.text)>64000)return false;
      docs.set(d.id,decisionPassages(d.text));
    }
    const refs=items=>Array.isArray(items)&&items.length<=4&&new Set(items.map(c=>JSON.stringify([c?.source,c?.passage]))).size===items.length&&items.every(c=>{
      if(!keys(c,'source,passage,quote')||typeof c.source!=='string'||typeof c.passage!=='string'||!/^p(0|[1-9]\d*)$/.test(c.passage)||typeof c.quote!=='string')return false;
      return docs.get(c.source)?.[Number(c.passage.slice(1))]===c.quote;
    });
    return Array.isArray(a.results)&&a.results.length===ids.length&&a.results.every((r,i)=>{
      if(!keys(r,'id,decision,verdict,reason,citations,documented_steps')||r.id!==ids[i]||typeof r.reason!=='string'||count(r.reason.trim())<1||count(r.reason.trim())>1200||typeof r.decision!=='string')return false;
      const choices=r.id==='training'?training:technical;
      return Object.hasOwn(choices,r.decision)&&choices[r.decision]===r.verdict&&refs(r.citations)&&refs(r.documented_steps)&&(r.decision==='INSUFFICIENT_EVIDENCE'||r.citations.length>0)&&((r.verdict==='CONDITIONAL')===(r.documented_steps.length>0));
    });
  }catch{return false;}
}
export function decisionView(state){
  return {version:20,complete:state.complete,review_status:state.review_status,results:state.assessment.results.map(r=>({
    ...structuredClone(r),...(r.verdict==='CONDITIONAL'?{required_actions:r.documented_steps.map(c=>c.quote)}:{})
  }))};
}
export function validDecisionSession(session,row,entry){
  try{
    const s=session.state,r=entry.review;
    return r.chain_id===61997&&session.receipt.chain_id===61997&&r.source_sha256===DECISION_SOURCE&&session.receipt.source_sha256===DECISION_SOURCE&&session.deployment.toLowerCase()===entry.hash.toLowerCase()&&session.receipt.hash.toLowerCase()===entry.hash.toLowerCase()&&receiptMatches(session.receipt,r)&&s.account.toLowerCase()===r.account.toLowerCase()&&s.digest===row.digest&&s.evidence_json===row.payload&&validDecisionState(s,row.evidence);
  }catch{return false;}
}
