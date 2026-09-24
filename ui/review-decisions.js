// Pinned v20/v22/v25/v26 read integration, not a category-enablement switch. Receipt identity and
// capture fingerprints must also be checked by the caller before acceptance.
import {receiptMatches} from './wallet.js';
export const DECISION_SOURCE='dddb4a8c382cea0e1033b403aa4f5d159a20bab1db3996e77b115c0926966557';
export const DECISION_PROTOCOL='013d610eeb7aa4f39af908335c860e2180dbdcb92963a1c234a19874467c7970';
export const DECISION_FORMATS=Object.freeze({
  20:Object.freeze({source:DECISION_SOURCE,protocol:DECISION_PROTOCOL,maxReason:1200}),
  22:Object.freeze({source:'b8d6a1249dd49afd88d1e64a95aa77d1c327334dba49f9f0ca95007a88e1b52d',protocol:'e4151ccf4e7caaf3ec880304aded803afa4dbfd11276268e64ff5f1ad9cb1e50',maxReason:600}),
  25:Object.freeze({source:'c03e43531297394f470d81cc0453a8a0a3abb9ea7150c94334f3c4c1c8278be9',protocol:'161175f602e241f1fd87bb2455132c6d7faf0e1e3487fc0e1d728823aecc8b7b',maxReason:600}),
  26:Object.freeze({source:'0eed90e7116b1065da4b41d4fafc647fb936fefc6da64f6f04082f523572ecd4',protocol:'032433ba72892de57b0f55a675f2f9cd79101479ec60a0fa76fe31df558fda6c',maxReason:600})
});
export const DECISION_SUMMARIES=Object.freeze({
  DOCUMENTED:'The cited documents support this requirement for the selected plan.',
  EXPLICITLY_UNAVAILABLE:'The cited documents explicitly exclude this capability for the selected plan.',
  INSUFFICIENT_EVIDENCE:'The captured documents do not establish the full requirement for the selected plan.',
  CONFLICTING_EVIDENCE:'The captured documents contain conflicting statements that leave this requirement unresolved.',
  EXCLUDED_BY_DEFAULT:'The cited policy excludes customer input and generated output from model training by default.',
  OPT_OUT_REQUIRED_DEFAULT_PERMITTED:'The cited policy permits training by default and documents an opt-out. The quoted setup must be completed and verified for your account.',
  OPT_OUT_REQUIRED_DEFAULT_UNSPECIFIED:'The cited policy documents an opt-out but does not establish the default. The quoted setup must be completed and verified for your account.',
  TRAINING_PERMITTED_NO_OPT_OUT:'The cited policy permits training by default and explicitly rules out an eligible full-scope opt-out.'
});
export const isDecisionVersion=version=>Number.isInteger(version)&&Object.hasOwn(DECISION_FORMATS,version);
// A disclosed defect in one immutable test result, not a provider-wide rule or
// a replacement verdict. Keep the raw record readable/exportable for diagnosis.
export function decisionQualityIssue(state,session){
  if(state?.version===22&&state.protocol_sha256===DECISION_FORMATS[22].protocol&&
      state.digest==='02b21c1a2186b6ad2ce6cdc649177169452f0c0733a169ddf02490bd707fbbaa'&&
      typeof session?.deployment==='string'&&session.deployment.toLowerCase()==='0x8c19fb5ebe226bb83376b3279d9722c3c7de5ab9c1719df0f46ff0bc28bde91b'){
    return {status:'quality_rejected',label:'Assessment withdrawn: citation error',badge:'Not a usable assessment',
      summary:'The transaction succeeded, but a citation error was confirmed. Do not rely on this assessment.',
      message:'This saved test result incorrectly attributes endpoint-table values to a passage containing only its header. The findings are withheld. The original result, sources and transaction remain available in the export; nothing is resubmitted. This is an assessment defect, not a finding against the provider.'};
  }
  return null;
}
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
export function decisionPassagesV26(text){
  const chars=[...text],parts=[]; let start=0;
  while(start<chars.length){
    let end=Math.min(start+1200,chars.length);
    if(end<chars.length){
      for(let i=end-1;i>=start+750;i--)if(chars[i]==='\n'){end=i+1;break;}
    }
    if(end===chars.length&&end-start<12)start=Math.max(0,end-1200);
    parts.push(chars.slice(start,end).join(''));
    if(end===chars.length)break;
    start=end-100;
  }
  return parts;
}
export function validDecisionState(state,evidence){
  try{
    if(!isDecisionVersion(state?.version))return false;
    const format=DECISION_FORMATS[state.version];
    if(!keys(state,'account,assessment,complete,digest,evidence_json,kind,protocol_sha256,release_cleared,review_status,version')||state.kind!=='provider-review-decisions-candidate'||state.release_cleared!==false||state.protocol_sha256!==format.protocol||state.complete!==true||state.review_status!=='completed')return false;
    const a=state.assessment,req=evidence.requirements,category=req.category??'transcription';
    if(!keys(a,'kind,schema_version,release_cleared,evidence_sha256,results')||a.kind!=='local-evidence-decisions-experiment'||a.schema_version!==state.version||a.release_cleared!==false||a.evidence_sha256!==state.digest)return false;
    const base={text:['text_api','text_output'],speech:['speech_api','speech_english'],transcription:['service_api','service_batch','service_english','service_channels']}[category];
    if(!base||!Array.isArray(evidence.documents)||evidence.documents.length<1||evidence.documents.length>4)return false;
    const ids=[...base,...(req.noTraining?['training']:[]),...(category==='transcription'?req.speakers?['speakers']:[]:req.streaming?[category==='text'?'text_streaming':'streaming']:[])];
    const docs=new Map();
    for(const d of evidence.documents){
      if(!d||typeof d.id!=='string'||docs.has(d.id)||d.status!=='retrieved'||d.complete!==true||typeof d.text!=='string'||count(d.text)<100||count(d.text)>64000)return false;
      docs.set(d.id,state.version===26?decisionPassagesV26(d.text):decisionPassages(d.text));
    }
    const refs=items=>Array.isArray(items)&&items.length<=(state.version===26?3:4)&&new Set(items.map(c=>JSON.stringify([c?.source,c?.passage]))).size===items.length&&items.every(c=>{
      if(!keys(c,'source,passage,quote')||typeof c.source!=='string'||typeof c.passage!=='string'||!/^p(0|[1-9]\d*)$/.test(c.passage)||typeof c.quote!=='string')return false;
      return docs.get(c.source)?.[Number(c.passage.slice(1))]===c.quote;
    });
    return Array.isArray(a.results)&&a.results.length===ids.length&&a.results.every((r,i)=>{
      if(!keys(r,'id,decision,verdict,reason,citations,documented_steps')||r.id!==ids[i]||typeof r.reason!=='string'||count(r.reason.trim())<1||count(r.reason.trim())>format.maxReason||typeof r.decision!=='string')return false;
      const choices=r.id==='training'?training:technical;
      if(state.version>=25&&r.reason!==DECISION_SUMMARIES[r.decision])return false;
      return Object.hasOwn(choices,r.decision)&&choices[r.decision]===r.verdict&&refs(r.citations)&&refs(r.documented_steps)&&(r.decision==='INSUFFICIENT_EVIDENCE'||r.citations.length>0)&&((r.verdict==='CONDITIONAL')===(r.documented_steps.length>0));
    });
  }catch{return false;}
}
export function decisionView(state){
  return {version:state.version,complete:state.complete,review_status:state.review_status,results:state.assessment.results.map(r=>({
    ...structuredClone(r),...(r.verdict==='CONDITIONAL'?{required_actions:r.documented_steps.map(c=>c.quote)}:{})
  }))};
}
export function validDecisionSession(session,row,entry){
  try{
    const s=session.state,r=entry.review;
    if(!isDecisionVersion(s?.version))return false;
    const source=DECISION_FORMATS[s.version].source;
    return r.chain_id===61997&&session.receipt.chain_id===61997&&r.source_sha256===source&&session.receipt.source_sha256===source&&session.deployment.toLowerCase()===entry.hash.toLowerCase()&&session.receipt.hash.toLowerCase()===entry.hash.toLowerCase()&&receiptMatches(session.receipt,r)&&s.account.toLowerCase()===r.account.toLowerCase()&&s.digest===row.digest&&s.evidence_json===row.payload&&validDecisionState(s,row.evidence);
  }catch{return false;}
}
