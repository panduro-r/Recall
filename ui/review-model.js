import {categoryOf,categoryMatches,requirementsFromParams,requirementKeys,assessmentAvailable,assessmentReadable} from './service-categories.js';
import {assess,isStale,requirements,reviewDate} from './compare-model.js';
import {receiptMatches,ZERO} from './wallet.js';
import {validDecisionSession,decisionView,isDecisionVersion,decisionQualityIssue,DECISION_FORMATS} from './review-decisions.js';
export const REVIEWS='recall.provider-reviews.v1', TRANSACTIONS='recall.provider-review-transactions.v1';
export const REVIEW_VERSION=8;
// Read pinned decision formats without changing the writer or mutating snapshots.
export const reviewResults=state=>isDecisionVersion(state.version)?decisionView(state).results:state.results;
export function reviewConfigIssue(config){
  if(Number.isSafeInteger(config?.version)&&config.version>REVIEW_VERSION)return 'update';
  if(config?.chain_id===61997){
    const baseline=config.version===6&&JSON.stringify(config.assessment_categories)===JSON.stringify(['transcription','speech']);
    const text=config.version===7&&config.text_source_sha256===DECISION_FORMATS[25].source&&
      JSON.stringify(config.assessment_categories)===JSON.stringify(['transcription','speech','text'])&&
      JSON.stringify(config.text_assessment_plan_ids)===JSON.stringify(['openai-mini','mistral-small','deepseek-flash','anthropic-haiku']);
    return (baseline||text)&&/^[a-f0-9]{64}$/.test(config.source_sha256)&&config.max_protocol_fee_wei==='50000000000000000'?null:'config';
  }
  return config?.version===REVIEW_VERSION&&config.chain_id===61999&&/^[a-f0-9]{64}$/.test(config.source_sha256)?null:'config';
}
// A finalized receipt is not yet a saved assessment. Keep its recovery path and
// block new submissions until the existing result has been verified and saved.
export function unresolvedReviewEntries(rows,entries){
  return entries.filter(e=>e.phase==='pending'||e.phase==='complete'&&!rows.some(r=>r.id===e.requestId&&r.session));
}
export function reviewRecovery(entry,issue){
  if(issue==='update')return {kind:'update',title:'Update Recall to view this result',badge:'Page update needed',message:'This result uses a newer review format than this page can read. Reload Recall to recover the existing result. Your evidence and transaction stay saved.',action:'Reload Recall'};
  if(issue==='mismatch'||entry?.phase==='pending'&&entry.receipt?.status==='FINALIZED'&&entry.receipt.execution==='SUCCESS')return {kind:'mismatch',title:'Result needs verification',badge:'Not accepted',message:'Recall could not verify this result against your saved request. No assessment has been accepted. Recheck the existing transaction or export the saved review for support. Do not submit it again.',action:'Recheck existing result'};
  if(issue==='unavailable')return {kind:'unavailable',title:'Your result is not available yet',badge:'Retrieval interrupted',message:'Your transaction is saved, but Recall could not load its result. We will check again while this page is open. You can also check now; this does not submit another review.',action:'Check existing result'};
  if(entry?.phase==='complete')return {kind:'retrieving',title:'Retrieving your result',badge:'Transaction finalized',message:'The transaction has finalized. Recall is verifying the result before saving the assessment. No new wallet approval is needed.',action:'Check existing result'};
  return {kind:'pending',title:'Your review is processing',badge:'Submitted to Studio',message:'We check the existing transaction while this page is open. You can reconnect or disconnect your wallet; your saved request stays. Do not submit it again.',action:entry?.hash?'Check status now':'Recover existing transaction'};
}
export const LEGACY_FALLBACK='The supplied evidence could not support a conclusive review.';
export const SERVICE_CHECKS=['service_api','service_batch','service_english','service_channels'];
export const FINDING_NAMES={text_api:'Hosted text API',text_output:'Text generation',text_streaming:'Streaming text',speech_api:'Speech generation API',speech_english:'English speech',streaming:'Streaming audio',service:'Transcription API',service_api:'API access',service_batch:'Pre-recorded audio',service_english:'English transcription',service_channels:'Single-channel audio',training:'No model training',speakers:'Speaker labels'};
export function findingPresentation(r,version){
  const labels=version>=4?{SUPPORTED:'Supported',CONDITIONAL:'Requires setup',REFUTED:'Unsupported',INCONCLUSIVE:'Unknown',NOT_ASSESSED:'Not assessed'}:{SUPPORTED:'Supported by captured terms',REFUTED:'Conflicts with your condition',INCONCLUSIVE:'Needs clarification',NOT_ASSESSED:'Not assessed'};
  return {label:labels[r.verdict],tone:r.verdict==='SUPPORTED'?'fit':r.verdict==='REFUTED'?'notfit':r.verdict==='NOT_ASSESSED'?'unreviewed':'confirm'};
}
export const REVIEW_ERRORS={
  MODEL_CALL_FAILED:'The model request could not be completed. This condition was not assessed.',
  INVALID_JSON:'The model response could not be read as JSON. This condition was not assessed.',
  INVALID_RESPONSE:'The model response did not match the required format. This condition was not assessed.',
  INVALID_CITATION:'A supporting quote could not be verified against the captured text. This condition was not assessed.',
  INCOMPLETE_EVIDENCE:'Source text was missing, incomplete or too short. This condition was not assessed.',
  QUALITY_REJECTED:'The proposed explanation or its supporting evidence could not be confirmed. No finding was accepted for this condition.',
  QUALITY_CALL_FAILED:'The evidence quality check could not be completed. No finding was accepted for this condition.',
  INVALID_QUALITY_RESPONSE:'The evidence quality check returned an invalid response. No finding was accepted for this condition.'
};
const qualityErrors=['QUALITY_REJECTED','QUALITY_CALL_FAILED','INVALID_QUALITY_RESPONSE'];
const legacyFallback=r=>r.verdict==='INCONCLUSIVE'&&r.reason===LEGACY_FALLBACK&&r.citations.length===0;
const resultStatus=s=>!s.complete?'evidence_incomplete':s.results.every(r=>r.verdict==='NOT_ASSESSED')?'failed':s.results.some(r=>r.verdict==='NOT_ASSESSED')?'partial':'completed';
export function reviewHealth(state,session) {
  if(!state)return null;
  const qualityIssue=decisionQualityIssue(state,session);
  if(qualityIssue)return qualityIssue;
  if(!state.complete)return {status:'evidence_incomplete',label:'Evidence capture incomplete',badge:'Not assessed',message:'Some source text was missing, incomplete or too short. No conclusion about the provider was reached. Inspect the captured sources below before starting a separate review.'};
  if(state.version===1&&state.results.some(legacyFallback))return {status:'legacy_unknown',label:'Review result unavailable',badge:'Older review · result unavailable',message:'This older review saved a generic fallback without its cause. It could reflect a technical problem or unclear evidence; it is not a negative finding about this provider. The original evidence and receipt are preserved.'};
  if(state.version===8&&['failed','partial'].includes(state.review_status)&&state.results.some(r=>qualityErrors.includes(r.error_code)))return {status:state.review_status,label:state.review_status==='failed'?'Review needs verification':'Some findings need verification',badge:'Evidence quality check',summary:'Findings that could not pass the evidence check are withheld. This is not a finding against the provider.',message:'Some proposed explanations or supporting evidence could not be confirmed. Those findings are withheld; this is not a finding against the provider. The original proposed findings, evidence and receipt remain saved. Nothing will be resubmitted automatically.'};
  if([2,3,4,5,6,7,8].includes(state.version)&&state.review_status==='failed')return {status:'failed',label:'Review couldn’t complete',badge:'Assessment not completed',message:'The review encountered a technical problem. None of your conditions received a usable assessment. This does not mean the provider fails your conditions. Your evidence and receipt are saved; nothing will be resubmitted automatically.'};
  if([2,3,4,5,6,7,8].includes(state.version)&&state.review_status==='partial')return {status:'partial',label:'Review partially completed',badge:'Partially assessed · Studio',message:'Some checks could not complete. Usable findings are shown separately; an unchecked condition is not a negative finding. Your evidence and receipt are preserved.'};
  if(isDecisionVersion(state.version))return {status:'completed',badge:'Experimental assessment · Studio Next'};
  return {status:'completed',badge:'Terms assessed · Studio'};
}
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
export const sha=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function reviewLink(planId,req) {if(typeof planId!=='string'||!/^[a-z0-9-]{1,100}$/.test(planId))throw Error('Choose a catalog plan.');return '/review#'+new URLSearchParams({plan:planId,...requirements(req)});}
export function selection(fragment,catalog) {
  if(typeof fragment!=='string'||fragment.length>4000)throw Error('Invalid review link.');
  const p=new URLSearchParams(fragment.replace(/^#/,''));
  const plan=catalog.plans.find(p1=>p1.id===p.get('plan'));
  if(!plan)return null;
  const keys=['plan',...requirementKeys(p.get('category')),...(p.has('back')?['back']:[])];
  if(p.size!==keys.length||keys.some(k=>p.getAll(k).length!==1))throw Error('The review link has invalid category requirements.');
  const req=requirements(requirementsFromParams(p));
  if(!categoryMatches(plan,req))throw Error('The plan and service category do not match.');
  return {plan,requirements:req};
}
const sameSources=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((id,i)=>id===b[i]);
// Historical sets are explicitly allowlisted for reading only. New captures and
// server-side preparation must still use the complete current catalog source set.
export async function validateCapture(bundle,catalog,{historical=false}={}) {
  if(!bundle||typeof bundle.payload!=='string'||new TextEncoder().encode(bundle.payload).length>180000||await sha(bundle.payload)!==bundle.digest)throw Error('The evidence fingerprint or size did not match. Capture it again.');
  const e=JSON.parse(bundle.payload),plan=catalog.plans.find(p=>p.id===e.plan?.id);
  if(!plan||e.version!==1||!Number.isFinite(Date.parse(e.capturedAt))||JSON.stringify(ordered(e))!==JSON.stringify(ordered(bundle.evidence)))throw Error('Unexpected evidence snapshot.');
  requirements(e.requirements);
  if(!categoryMatches(plan,e.requirements)||!categoryMatches(e.plan,e.requirements))throw Error('Evidence category does not match this plan.');
  const sourceSets=[plan.sources,...(historical?catalog.reviewSourceHistory?.[plan.id]??[]:[])];
  if(!Array.isArray(e.documents)||e.plan.provider!==plan.provider||!sourceSets.some(ids=>sameSources(ids,e.plan.sources)&&sameSources(ids,e.documents.map(d=>d?.id))))throw Error('Evidence sources do not match an allowed capture.');
  for(let i=0;i<e.documents.length;i++){
    const d=e.documents[i],source=catalog.sources[e.plan.sources[i]];
    if(!source||source.provider!==plan.provider||d.url!==source.url||d.label!==source.label||!['retrieved','unavailable'].includes(d.status))throw Error('Unexpected source URL or label.');
    if(d.status==='retrieved'&&(typeof d.text!=='string'||d.text.length>64000||typeof d.complete!=='boolean'||await sha(d.text)!==d.textSha256||!/^[a-f0-9]{64}$/.test(d.sha256)))throw Error('Source text fingerprint did not match.');
  }
  return e;
}
export function sourceCoverage(e,catalog) {
  const current=catalog.plans.find(p=>p.id===e.plan.id)?.sources??[],saved=e.documents.map(d=>d.id);
  return {changed:!sameSources(current,saved),added:current.filter(id=>!saved.includes(id)).map(id=>catalog.sources[id].label),removed:e.documents.filter(d=>!current.includes(d.id)).map(d=>d.label)};
}
export function readReviews(storage) {
  let rows;try{rows=JSON.parse(storage.getItem(REVIEWS)||'[]');}catch{throw Error('Saved reviews could not be read. Your data has not been changed.');}
  if(!Array.isArray(rows)||rows.length>20||rows.some(r=>!r||typeof r.id!=='string'||!r.evidence||typeof r.payload!=='string'||!r.digest))throw Error('Saved review data is invalid. Preserve browser data before continuing.');
  return rows;
}
export function saveReview(storage,row) {
  const rows=readReviews(storage),old=rows.find(r=>r.id===row.id);
  if(old&&old.payload!==row.payload)throw Error('A saved snapshot cannot be overwritten. Create a new review.');
  const next=[row,...rows.filter(r=>r.id!==row.id)];
  if(next.length>20)throw Error('This browser has reached 20 reviews. Export your evidence; existing records have been kept.');
  storage.setItem(REVIEWS,JSON.stringify(next));
}
export function matchesReview(plan,request,config) {
  const r=plan?.review;
  return !!r&&r.action==='deploy'&&r.account?.toLowerCase()===request.account?.toLowerCase()&&r.contract===ZERO&&r.recipient===''&&r.value_wei==='0'&&[61999,61997].includes(r.chain_id)&&r.chain_id===(config.chain_id??61999)&&r.source_sha256===config.source_sha256&&JSON.stringify(r.args)===JSON.stringify([request.payload]);
}
function sessionIdentityMatches(session,row,entry){
  try{
    const s=session.state;
    return session.deployment.toLowerCase()===entry.hash.toLowerCase()&&session.receipt.hash.toLowerCase()===entry.hash.toLowerCase()&&receiptMatches(session.receipt,entry.review)&&s.kind==='provider-review'&&s.digest===row.digest&&s.evidence_json===row.payload&&s.account.toLowerCase()===entry.review.account.toLowerCase();
  }catch{return false;}
}
export function reviewSessionIssue(session,row,entry){
  if(isDecisionVersion(session?.state?.version))return validDecisionSession(session,row,entry)?null:'mismatch';
  // Check identity first: a newer version never excuses mismatched evidence,
  // source, account or receipt. It is not permission to accept an unknown schema.
  if(!sessionIdentityMatches(session,row,entry))return 'mismatch';
  if(Number.isSafeInteger(session.state.version)&&session.state.version>REVIEW_VERSION)return 'update';
  return validSession(session,row,entry)?null:'mismatch';
}
export function validSession(session,row,entry) {
  try{
    const s=session.state,e=row.evidence;
    if(isDecisionVersion(s.version))return validDecisionSession(session,row,entry);
    if(!sessionIdentityMatches(session,row,entry)||![1,2,3,4,5,6,7,8].includes(s.version))return false;
    const req=requirements(e.requirements),speech=categoryOf(req)==='speech',text=categoryOf(req)==='text';
    if(!assessmentReadable(req)||speech&&s.version<5||text&&s.version<7||!categoryMatches(e.plan,req))return false;
    const ids=[...(text?['text_api','text_output']:speech?['speech_api','speech_english']:s.version>=4?SERVICE_CHECKS:['service']),...(req.noTraining?['training']:[]),...(text?req.streaming?['text_streaming']:[]:speech?req.streaming?['streaming']:[]:req.speakers?['speakers']:[])];
    if(!Array.isArray(s.results)||s.results.length!==ids.length||s.complete!==e.documents.every(d=>d.status==='retrieved'&&d.complete===true&&d.text.length>=100))return false;
    if(s.version>=2&&s.review_status!==resultStatus(s))return false;
    const validRows=(rows,proposal=false)=>Array.isArray(rows)&&rows.length===ids.length&&rows.every((r,i)=>{
      if(!r||r.id!==ids[i]||typeof r.reason!=='string'||r.reason.length<1||r.reason.length>600||!Array.isArray(r.citations)||r.citations.length>2)return false;
      if(s.version>=2&&r.verdict==='NOT_ASSESSED')return Object.keys(r).sort().join(',')==='citations,error_code,id,reason,verdict'&&typeof r.error_code==='string'&&Object.hasOwn(REVIEW_ERRORS,r.error_code)&&(!qualityErrors.includes(r.error_code)||s.version===8&&!proposal)&&r.reason===REVIEW_ERRORS[r.error_code]&&r.citations.length===0&&(s.complete?r.error_code!=='INCOMPLETE_EVIDENCE':r.error_code==='INCOMPLETE_EVIDENCE');
      if(!s.complete&&(s.version>=2||r.verdict!=='INCONCLUSIVE'))return false;
      const conditional=s.version>=4&&r.verdict==='CONDITIONAL';
      if(conditional&&(!['training','speakers',...(s.version>=5?['streaming']:[]),...(s.version>=7?['text_streaming']:[])].includes(r.id)||!Array.isArray(r.required_actions)||r.required_actions.length<1||r.required_actions.length>4||new Set(r.required_actions).size!==r.required_actions.length||r.required_actions.some(a=>typeof a!=='string'||!a.trim()||[...a].length>240)))return false;
      return Object.keys(r).sort().join(',')===(conditional?'citations,id,reason,required_actions,verdict':'citations,id,reason,verdict')&&['SUPPORTED','REFUTED','INCONCLUSIVE',...(conditional?['CONDITIONAL']:[])].includes(r.verdict)&&(r.verdict==='INCONCLUSIVE'||r.citations.length>0)&&r.citations.every(c=>c&&Object.keys(c).sort().join(',')==='quote,source'&&typeof c.quote==='string'&&[...c.quote].length>=12&&[...c.quote].length<=500&&e.documents.find(d=>d.id===c.source)?.text.includes(c.quote));
    });
    if(!validRows(s.results))return false;
    if(s.version!==8)return true;
    if(!validRows(s.proposed_results,true)||!Array.isArray(s.quality_checks)||s.quality_checks.length!==ids.length)return false;
    return s.quality_checks.every((q,i)=>{
      const proposed=s.proposed_results[i];
      if(!q||q.id!==ids[i])return false;
      let expected=proposed;
      if(proposed.verdict==='NOT_ASSESSED'){
        if(Object.keys(q).sort().join(',')!=='id,status'||q.status!=='not_required')return false;
      }else if(q.status==='unavailable'){
        if(Object.keys(q).sort().join(',')!=='error_code,id,status'||!['QUALITY_CALL_FAILED','INVALID_QUALITY_RESPONSE'].includes(q.error_code))return false;
        expected={id:q.id,verdict:'NOT_ASSESSED',reason:REVIEW_ERRORS[q.error_code],citations:[],error_code:q.error_code};
      }else{
        if(Object.keys(q).sort().join(',')!=='id,status'||!['passed','rejected'].includes(q.status))return false;
        if(q.status==='rejected')expected={id:q.id,verdict:'NOT_ASSESSED',reason:REVIEW_ERRORS.QUALITY_REJECTED,citations:[],error_code:'QUALITY_REJECTED'};
      }
      return JSON.stringify(ordered(expected))===JSON.stringify(ordered(s.results[i]));
    });
  }catch{return false;}
}
export function outcome(row,now=Date.now()) {
  const e=row.evidence,cost=assess(e.plan,e.requirements,isStale({reviewedAt:e.plan.reviewedAt},now));
  if(!row.session)return {label:assessmentAvailable(e.requirements,e.plan)?'Not assessed yet':'Evidence only',status:'unreviewed',cost};
  const health=reviewHealth(row.session.state,row.session);
  if(health.status!=='completed')return {label:health.label,status:'unreviewed',cost,health};
  const findings=reviewResults(row.session.state);
  const captured=Date.parse(e.capturedAt),incomplete=!row.session.state.complete||!Number.isFinite(captured)||now<captured||now-captured>7*86400000;
  const rejected=findings.some(r=>r.verdict==='REFUTED')||['not-fit','over-budget'].includes(cost.status);
  const uncertain=incomplete||cost.status!=='fit'||findings.some(r=>r.verdict!=='SUPPORTED');
  if(isDecisionVersion(row.session.state.version)&&row.session.state.release_cleared===false&&!rejected)
    return {label:'Experimental review · verify before use',status:'confirm',cost,health,
      setupRequired:findings.some(r=>r.verdict==='CONDITIONAL'),unknown:findings.some(r=>r.verdict==='INCONCLUSIVE')};
  if(row.session.state.version>=4){
    const setupRequired=findings.some(r=>r.verdict==='CONDITIONAL'),unknown=findings.some(r=>r.verdict==='INCONCLUSIVE');
    const label=rejected?'Doesn’t meet your conditions':incomplete?'Review needs updating':unknown?'Some checks are still unknown':setupRequired?'Requires setup':uncertain?'Cost needs confirmation':'Documented terms support your conditions';
    return {label,status:rejected?'not-fit':uncertain?'confirm':'fit',cost,health,setupRequired,unknown};
  }
  return {label:rejected?'Doesn’t meet your conditions':uncertain?'Needs clarification':'Documented terms support your conditions',status:rejected?'not-fit':uncertain?'confirm':'fit',cost,health};
}
export function reviewNextStep(row,catalog,now=Date.now()) {
  const out=outcome(row,now),e=row.evidence,plan=catalog.plans.find(p=>p.id===e.plan.id);
  if(!row.session||out.health?.status!=='completed')return {kind:'compare',title:'Explore other options',description:'You can compare alternatives with the same requirements. This incomplete review stays saved; it is not a finding against the provider.'};
  const captured=Date.parse(e.capturedAt);
  if(sourceCoverage(e,catalog).changed)return {kind:'refresh',title:'Review the updated sources',description:'The source list has changed. Capture a separate review to use the current sources; this assessment stays tied to its original evidence.'};
  if(out.cost.stale||!Number.isFinite(captured)||now<captured||now-captured>7*86400000)return {kind:'refresh',title:'Check what is current',description:'This review or its catalog pricing is out of date. Capture fresh evidence before deciding; a new capture does not automatically renew the catalog estimate.'};
  const fields=['rate','outputRate','unit','pricing','training','diarization','category','streaming'];
  if(!plan||reviewDate(catalog,plan)!==e.plan.reviewedAt||fields.some(key=>plan[key]!==e.plan[key]))return {kind:'compare',title:'Check the updated catalog',description:'The catalog configuration has changed since this review. Compare the current options; the saved assessment and estimate have not been updated.'};
  if(out.status==='fit')return {kind:'visit',title:'Try it with the provider',description:'Check your account’s data settings, usage rights and billing. Test representative, non-sensitive input with the provider before committing.'};
  if(out.setupRequired&&!out.unknown&&out.status!=='not-fit')return {kind:'setup',title:'Resolve setup before using customer data',description:'Review the documented steps and confirm they are effective for your account. Confirm the resulting price too. Recall has not completed or verified this setup.'};
  return {kind:'compare',title:out.status==='not-fit'?'Find a better match':'Resolve the open questions',description:out.status==='not-fit'?'This option does not meet all your conditions. Compare alternatives without changing your requirements.':'Some terms or costs still need confirmation. Read the findings, check with the provider, or compare alternatives.'};
}
export function evidenceChanges(before,after) {
  const previous=new Map(before.evidence.documents.map(d=>[d.id,d])),next=new Map(after.evidence.documents.map(d=>[d.id,d]));
  return [...new Set([...next.keys(),...previous.keys()])].map(id=>{
    const old=previous.get(id),d=next.get(id),a=old?.text||'',b=d?.text||'';
    const kind=!old?'added':!d?'removed':old.textSha256!==d.textSha256||old.status!==d.status||old.complete!==d.complete?'changed':'unchanged';
    const oldLines=new Set(a.split('\n')),newLines=new Set(b.split('\n'));
    return {id,label:(d||old).label,kind,changed:kind!=='unchanged',
      unavailable:[old,d].filter(Boolean).some(s=>s.status!=='retrieved'||!s.complete),
      added:b.split('\n').filter(l=>l&&!oldLines.has(l)),removed:a.split('\n').filter(l=>l&&!newLines.has(l))};
  });
}
export async function reviewAPI(data) {
  const response=await fetch('/api/provider-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(55000)});
  const body=await response.json();if(!response.ok)throw Error(body.error||'Review unavailable. No transaction was sent by the server.');return body;
}
