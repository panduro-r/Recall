// Read-only local navigation index. Never contacts Studio or updates a journal.
import {requirements} from './compare-model.js';
import {REVIEWS,TRANSACTIONS,readReviews,validateCapture,validSession,matchesReview,outcome,reviewNextStep} from './review-model.js';
export {REVIEWS,TRANSACTIONS};
const key=req=>JSON.stringify(requirements(req));
const hash=value=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value);
function intentMatches(entry,row){
  const r=entry.review;
  return /^0x[0-9a-f]{40}$/i.test(r.account||'')&&/^[0-9a-f]{64}$/i.test(r.source_sha256||'')&&
    matchesReview({review:r},{account:r.account,payload:row.payload},{source_sha256:r.source_sha256});
}
export async function readReviewIndex(storage,catalog,now=Date.now()){
  try{
    const raw=storage.getItem(REVIEWS),rawJournal=storage.getItem(TRANSACTIONS);
    if((raw?.length||0)>12000000||(rawJournal?.length||0)>12000000)throw Error('Oversized local records');
    const rows=readReviews({getItem:()=>raw}),journal=JSON.parse(rawJournal||'[]');
    if(!Array.isArray(journal)||journal.length>200||journal.some(e=>!e||typeof e.id!=='string'||!e.review||e.review.action!=='deploy'||!['pending','complete','failed','rejected'].includes(e.phase)||e.hash!==undefined&&!hash(e.hash)||['complete','failed'].includes(e.phase)&&!hash(e.hash)))throw Error('Invalid review journal');
    if(new Set(journal.map(e=>e.id)).size!==journal.length)throw Error('Duplicate transaction IDs');
    if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate review IDs');
    const entries=[];
    for(const row of rows){
      if(!row.id||row.id.length>200)throw Error('Invalid review ID');
      await validateCapture(row,catalog,{historical:true});
      const related=journal.filter(e=>e.requestId===row.id);
      if(related.some(e=>!intentMatches(e,row)))throw Error('Review intent mismatch');
      let label='Evidence saved · Not assessed',tone='unreviewed';
      if(row.session){
        const entry=related.find(e=>e.phase==='complete'&&e.hash?.toLowerCase()===row.session.deployment?.toLowerCase());
        if(!entry||!validSession(row.session,row,entry))throw Error('Unmatched saved assessment');
        const out=outcome(row,now),next=reviewNextStep(row,catalog,now);
        label=out.label;tone=out.status;
        if(out.health.status==='completed'&&next.kind==='refresh'){label='Review needs updating';tone='confirm';}
        if(out.health.status==='completed'&&next.title==='Check the updated catalog'){label='Catalog changed since review';tone='confirm';}
      }else if(related[0]){
        label={pending:'Review processing',complete:'Result ready to check',failed:'Review couldn’t complete',rejected:'Review not submitted'}[related[0].phase];
      }
      entries.push({id:row.id,planId:row.evidence.plan.id,requirements:requirements(row.evidence.requirements),capturedAt:row.evidence.capturedAt,label,tone,href:'/review#'+new URLSearchParams({id:row.id})});
    }
    entries.sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt));
    return {entries,unavailable:false};
  }catch{return {entries:[],unavailable:true};}
}
export function matchingReview(index,planId,req){
  if(!index||index.unavailable)return null;
  const wanted=key(req),matches=index.entries.filter(e=>e.planId===planId&&key(e.requirements)===wanted);
  return matches.length?{...matches[0],count:matches.length}:null;
}
