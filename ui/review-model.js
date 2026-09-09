import {assess,isStale,requirements} from './compare-model.js';
import {receiptMatches,ZERO} from './wallet.js';
export const REVIEWS='recall.provider-reviews.v1', TRANSACTIONS='recall.provider-review-transactions.v1';
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
export const sha=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export function reviewLink(planId,req) {return '/review#'+new URLSearchParams({plan:planId,...req});}
export function selection(fragment,catalog) {
  const p=new URLSearchParams(fragment.replace(/^#/,''));
  const plan=catalog.plans.find(p1=>p1.id===p.get('plan'));
  if(!plan)return null;
  return {plan,requirements:requirements({hours:Number(p.get('hours')),budget:Number(p.get('budget')),noTraining:p.get('noTraining')==='true',speakers:p.get('speakers')==='true'})};
}
export async function validateCapture(bundle,catalog) {
  if(!bundle||typeof bundle.payload!=='string'||new TextEncoder().encode(bundle.payload).length>180000||await sha(bundle.payload)!==bundle.digest)throw Error('The evidence fingerprint or size did not match. Capture it again.');
  const e=JSON.parse(bundle.payload),plan=catalog.plans.find(p=>p.id===e.plan?.id);
  if(!plan||e.version!==1||!Number.isFinite(Date.parse(e.capturedAt))||JSON.stringify(ordered(e))!==JSON.stringify(ordered(bundle.evidence)))throw Error('Unexpected evidence snapshot.');
  requirements(e.requirements);
  if(!Array.isArray(e.documents)||e.documents.length!==plan.sources.length)throw Error('Evidence sources are incomplete.');
  for(let i=0;i<e.documents.length;i++){
    const d=e.documents[i],source=catalog.sources[plan.sources[i]];
    if(d.id!==plan.sources[i]||d.url!==source.url||!['retrieved','unavailable'].includes(d.status))throw Error('Unexpected source URL.');
    if(d.status==='retrieved'&&(typeof d.text!=='string'||d.text.length>64000||typeof d.complete!=='boolean'||await sha(d.text)!==d.textSha256||!/^[a-f0-9]{64}$/.test(d.sha256)))throw Error('Source text fingerprint did not match.');
  }
  return e;
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
  return !!r&&r.action==='deploy'&&r.account?.toLowerCase()===request.account?.toLowerCase()&&r.contract===ZERO&&r.recipient===''&&r.value_wei==='0'&&r.chain_id===61999&&r.source_sha256===config.source_sha256&&JSON.stringify(r.args)===JSON.stringify([request.payload]);
}
export function validSession(session,row,entry) {
  try{
    const s=session.state,e=row.evidence;
    if(session.deployment.toLowerCase()!==entry.hash.toLowerCase()||session.receipt.hash.toLowerCase()!==entry.hash.toLowerCase()||!receiptMatches(session.receipt,entry.review)||s.kind!=='provider-review'||s.version!==1||s.digest!==row.digest||s.evidence_json!==row.payload||s.account.toLowerCase()!==entry.review.account.toLowerCase())return false;
    const ids=['service',...(e.requirements.noTraining?['training']:[]),...(e.requirements.speakers?['speakers']:[])];
    if(!Array.isArray(s.results)||s.results.length!==ids.length||s.complete!==e.documents.every(d=>d.status==='retrieved'&&d.complete&&d.text.length>=100)||(!s.complete&&s.results.some(r=>r.verdict!=='INCONCLUSIVE')))return false;
    return s.results.every((r,i)=>r.id===ids[i]&&['SUPPORTED','REFUTED','INCONCLUSIVE'].includes(r.verdict)&&typeof r.reason==='string'&&r.reason.length<=600&&Array.isArray(r.citations)&&r.citations.length<=2&&(r.verdict==='INCONCLUSIVE'||r.citations.length>0)&&r.citations.every(c=>typeof c.quote==='string'&&c.quote.length>=12&&c.quote.length<=500&&e.documents.find(d=>d.id===c.source)?.text.includes(c.quote)));
  }catch{return false;}
}
export function outcome(row,now=Date.now()) {
  const e=row.evidence,cost=assess(e.plan,e.requirements,isStale({reviewedAt:e.plan.reviewedAt},now));
  if(!row.session)return {label:'Not assessed yet',status:'unreviewed',cost};
  const findings=row.session.state.results;
  const captured=Date.parse(e.capturedAt),incomplete=!row.session.state.complete||!Number.isFinite(captured)||now<captured||now-captured>7*86400000;
  const rejected=findings.some(r=>r.verdict==='REFUTED')||['not-fit','over-budget'].includes(cost.status);
  const uncertain=incomplete||cost.status!=='fit'||findings.some(r=>r.verdict!=='SUPPORTED');
  return {label:rejected?'Doesn’t meet your conditions':uncertain?'Needs clarification':'Documented terms support your conditions',status:rejected?'not-fit':uncertain?'confirm':'fit',cost};
}
export function evidenceChanges(before,after) {
  return after.evidence.documents.map(d=>{
    const old=before.evidence.documents.find(o=>o.id===d.id),a=old?.text||'',b=d.text||'';
    const oldLines=new Set(a.split('\n')),newLines=new Set(b.split('\n'));
    return {id:d.id,label:d.label,changed:!old||old.textSha256!==d.textSha256||old.status!==d.status,
      unavailable:d.status!=='retrieved'||old?.status!=='retrieved',
      added:b.split('\n').filter(l=>l&&!oldLines.has(l)),removed:a.split('\n').filter(l=>l&&!newLines.has(l))};
  });
}
export async function reviewAPI(data) {
  const response=await fetch('/api/provider-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(55000)});
  const body=await response.json();if(!response.ok)throw Error(body.error||'Review unavailable. No transaction was sent by the server.');return body;
}
