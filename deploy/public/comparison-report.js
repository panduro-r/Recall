import {categoryOf,categoryMatches,scopeFor,workload,extraCondition,extraLabel,priceText,unitPrice,assessmentAvailable,assessmentNotice} from './service-categories.js';
// Read-only decision summary and portable, script-free report. No storage or network access.
import {requirements,validateCatalog,assess,isStale,reviewDate} from './compare-model.js';
import {matchingReview} from './review-index.js';
import {FINDING_NAMES} from './review-model.js';

const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const condition=FINDING_NAMES;
const verdict={SUPPORTED:'Supported by captured terms',CONDITIONAL:'Requires setup',REFUTED:'Not supported by captured terms',INCONCLUSIVE:'Needs clarification',NOT_ASSESSED:'Not assessed'};
export function buildComparisonReport(catalog,input,ids,index,now=Date.now()){
  validateCatalog(catalog);const req=requirements(input);
  if(!Number.isFinite(now)||!Array.isArray(ids)||ids.length<1||ids.length>2||new Set(ids).size!==ids.length||ids.some(id=>!catalog.plans.some(p=>p.id===id&&categoryMatches(p,req))))throw Error('Choose distinct catalog plans for the report.');
  const options=ids.map(id=>{
    const plan=catalog.plans.find(p=>p.id===id),date=reviewDate(catalog,plan),result=assess(plan,req,isStale({reviewedAt:date},now));
    const match=matchingReview(index,id,req),questions=[];
    if(result.stale)questions.push('The catalog review is out of date. Confirm current pricing and policy.');
    if(result.trainingBlocked)questions.push('The default configuration does not meet your no-training requirement. Choose a different configuration or provider.');
    if(result.trainingConditional)questions.push('Request the training opt-out and confirm its effective date and resulting rate before using customer data.');
    if(result.paidTierRequired)questions.push('Confirm the API project has active billing and the documented paid-service data terms apply before sending customer data. Unpaid terms and rates differ.');
    if(plan.pricing==='estimated')questions.push('Billing is token-based. Confirm the token usage and effective price for your audio; the hourly equivalent is approximate.');
    if(plan.pricing==='from')questions.push('Confirm the actual rate and minimum usage commitment. The from-rate calculation is not a quote.');
    if(result.byteRange)questions.push('Fish Audio bills UTF-8 bytes, not characters. Supply the byte volume to narrow the displayed 1–4 byte-per-character range.');
    if(result.trainingUnknown)questions.push('An applicable no-training commitment has not been established. Confirm it directly before using customer data.');
    if(result.streamingUnknown)questions.push('Confirm streaming output availability on this plan.');
    if(categoryOf(req)==='text')questions.push('Check provider-specific token counts and include billed reasoning/thinking output. Tool calls, caching and other processing tiers are outside this estimate.');
    if(!assessmentAvailable(req,plan))questions.push(assessmentNotice);
    if(result.labelsUnknown)questions.push('Confirm speaker-identification availability and its additional cost.');
    if(!result.uncertainPrice&&result.estimate>req.budget)questions.push(`The usage estimate is ${usd(result.estimate-req.budget)} above your monthly budget.`);
    const reviewLabel=!index?'Checking saved reviews':index.unavailable?'Saved review status unavailable':match?match.label:'No matching saved assessment';
    if(!index||index.unavailable)questions.push('Saved review records could not be checked. No assessment is assumed.');
    else if(!match)questions.push('Read the public sources or capture a review for these exact requirements.');
    else if(match.tone!=='fit')questions.push(`Saved review: ${match.label}. Read its findings before deciding.`);
    return {id,name:plan.name,plan:plan.plan,result,catalogDate:date,
      price:plan.pricing==='from'?`Quote needed · ${usd(result.estimate)} from-rate calculation`:plan.pricing==='estimated'?`≈ ${usd(result.estimate)} / month · approximate token-based cost`:`${priceText(plan,result)} / month · ${result.byteRange?'UTF-8 size range':result.uncertainPrice?'illustrative base cost only':'estimated usage cost'}`,
      priceNote:plan.priceNote,unitPrice:unitPrice(plan,result),training:plan.trainingNote,speakers:categoryOf(req)!=='transcription'?(req.streaming?(result.streamingUnknown?'Availability needs confirmation.':'Streaming output documented; latency not benchmarked.'):'Streaming not required.'):!req.speakers?'Not selected; excluded from this estimate.':result.labelsUnknown?'Availability and cost need confirmation.':plan.diarization===0?'Included with no separate per-hour surcharge in the catalog.':`${usd(plan.diarization)} additional per audio hour, included in this estimate.`,
      questions,review:{label:reviewLabel,capturedAt:match?.capturedAt??null,report:match?.report??null},
      sources:plan.sources.map(id=>({label:catalog.sources[id].label,url:catalog.sources[id].url}))};
  });
  const uncertain=options.some(p=>p.result.uncertainPrice),stale=options.some(p=>p.result.stale),blocked=options.some(p=>p.result.trainingBlocked);
  const fit=options.filter(p=>p.result.status==='fit').length;
  const headline=stale?'Check the current terms first':blocked?'A data-use condition is not met':uncertain?'Resolve the open pricing conditions':fit===0?'Neither estimate is within budget':fit===options.length?'Both estimates are within budget':'One estimate is within budget';
  let difference=uncertain?'These amounts are not like-for-like confirmed prices. Resolve the conditions before comparing savings.':stale?'The displayed amounts use an out-of-date catalog. They are not current quotes.':blocked?'A lower price does not resolve the data-use mismatch.':'';
  if(!difference&&options.length===2){
    const [a,b]=options,delta=Math.round(Math.abs(a.result.estimate-b.result.estimate)*100)/100;
    difference=delta?`${a.result.estimate<b.result.estimate?a.name:b.name} has a ${usd(delta)} lower monthly usage estimate for this configuration. This is a cost difference, not an accuracy or overall-quality ranking.`:'The monthly usage estimates are equal. Compare the terms and test accuracy to distinguish these options.';
  }
  return {generatedAt:new Date(now).toISOString(),requirements:req,options,summary:{headline:options.length===1?'Review this option before choosing':headline,difference},
    scope:scopeFor(req),
    limits:'Catalog calculations are rules-based, not GenLayer judgments or provider quotes. Estimates exclude taxes, free credits, unselected add-ons, integration costs and negotiated discounts. Saved assessments concern dated captured text; they do not prove service quality, compliance or real-world behavior. No provider was contacted, no order was placed and no payment was made by creating this report.',
    next:'Confirm the selected configuration and account data settings, then test representative, non-sensitive input before committing. Purchase separately with the provider; Recall has no provider checkout integration.'};
}

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(url,label)=>{try{const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port)return escape(label);return `<a href="${escape(u.href)}" rel="noreferrer noopener">${escape(label)}</a>`;}catch{return escape(label);}};
const list=items=>`<ul>${items.map(x=>`<li>${escape(x)}</li>`).join('')}</ul>`;
const date=value=>new Date(value).toISOString().replace('T',' ').replace('.000Z',' UTC').replace(/Z$/,' UTC');
export function comparisonReportHTML(report){
  const e=escape,r=report.requirements;
  const row=(label,values)=>`<tr><th scope="row">${e(label)}</th>${values.map(v=>`<td>${e(v)}</td>`).join('')}</tr>`;
  const assessment=p=>{
    const a=p.review.report;
    return `<section class="assessment"><h3>${e(p.name)} · saved review</h3><p><strong>${e(p.review.label)}</strong></p>${p.review.capturedAt?`<p class="muted">Evidence captured ${e(date(p.review.capturedAt))}. Matches every selected requirement above.</p>`:''}${a?`<p>${e(a.notice)}</p>${a.findings.map(f=>`<div class="finding"><h4>${e(condition[f.id]||f.id)} · ${e(f.label||verdict[f.verdict]||f.verdict)}</h4><p>${e(f.reason)}</p>${f.required_actions?.length?`<h4>Required before use</h4>${list(f.required_actions)}<p class="muted">Not completed or verified by Recall. Confirm the resulting account price.</p>`:''}${f.citations.map(c=>`<blockquote>${e(c.quote)}<cite>${link(c.url,c.label)}</cite></blockquote>`).join('')}</div>`).join('')}<p class="fingerprint">Evidence SHA-256: ${e(a.digest)}</p>`:'<p class="muted">No verified saved assessment findings are included for this option. This is not a finding against the provider.</p>'}</section>`;
  };
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Recall comparison · ${e(report.options.map(p=>p.name).join(' vs '))}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#182235;font:15px/1.65 system-ui,-apple-system,Arial,sans-serif}main{max-width:1040px;margin:32px auto;padding:40px;background:white;border:1px solid #dfe5ef;border-radius:12px}header{border-bottom:2px solid #2852df;padding-bottom:24px;margin-bottom:28px}.brand{color:#2448c5;font-size:17px;font-weight:750}h1{font-size:30px;line-height:1.2;letter-spacing:-.025em;margin:16px 0 10px}h2{font-size:21px;line-height:1.4;margin:30px 0 12px}h3{font-size:18px;margin:0 0 12px}h4{font-size:15px;margin:0 0 8px}p{margin:8px 0;max-width:78ch}.muted,small{color:#526079;font-size:13px}a{color:#2448c5;overflow-wrap:anywhere}ul{padding-left:22px;margin:12px 0}li+li{margin-top:7px}.summary{background:#f0f4ff;padding:20px 24px;border-radius:8px}.summary h2{margin:0 0 8px}.requirements{display:flex;flex-wrap:wrap;gap:8px 24px;margin:18px 0;font-size:14px}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;margin:18px 0}th,td{border-bottom:1px solid #dfe5ef;padding:14px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead th{background:#f5f7fb}th:first-child{width:20%}tbody th{font-size:13px;color:#526079}.option,.assessment{border-top:1px solid #dfe5ef;padding-top:22px;margin-top:24px}.finding{margin-top:20px}.fingerprint{font:11px/1.6 ui-monospace,monospace;overflow-wrap:anywhere;color:#526079;margin-top:18px}blockquote{margin:14px 0;padding:14px 18px;background:#f7f8fb;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}cite{display:block;font-style:normal;margin-top:10px}footer{border-top:1px solid #dfe5ef;padding-top:20px;margin-top:32px;font-size:12px;color:#526079}.print-help{font-size:12px;color:#526079;margin-top:12px}
@media(max-width:640px){body{font-size:14px}main{margin:0;padding:22px 18px;border:0;border-radius:0}h1{font-size:26px}.summary{padding:16px}th,td{padding:10px 6px;font-size:12px}th:first-child{width:24%}.requirements{gap:8px 16px}}
@media print{@page{margin:16mm}body{background:white;font-size:10pt}main{max-width:none;margin:0;padding:0;border:0}header{margin-bottom:16px;padding-bottom:14px}h1{font-size:23pt}h2{font-size:15pt}h3{font-size:12pt}h4{font-size:10pt}h1,h2,h3,h4{break-after:avoid}p,li{orphans:3;widows:3}tr,blockquote,.summary{break-inside:avoid}thead{display:table-header-group}table{font-size:9pt}th,td{padding:8px}blockquote{font-size:9pt}.table-wrap{overflow:visible}.print-help{display:none}a{color:inherit}a:after{content:' (' attr(href) ')';font-size:8pt;overflow-wrap:anywhere}footer{font-size:9pt}}
</style></head><body><main><header><div class="brand">Recall / Comparison report</div><h1>${e(report.options.map(p=>p.name).join(' vs '))}</h1><p>${e(report.scope)}</p><p class="muted">Report created ${e(date(report.generatedAt))}. Evidence dates are listed separately; creating this report does not refresh them.</p><p class="print-help">Keep or share this file. To save a PDF, open your browser’s Print menu and choose Save as PDF.</p></header>
<div class="requirements"><span>${e(workload(r))}</span><span>${e(usd(r.budget))} monthly budget</span><span>${r.noTraining?'No model training required':'No training restriction selected'}</span><span>${e(extraCondition(r))}</span></div>
<section class="summary"><h2>${e(report.summary.headline)}</h2>${report.options.map(p=>`<p><strong>${e(p.name)}:</strong> ${e(p.price)}.</p>`).join('')}<p>${e(report.summary.difference)}</p></section>
<h2>Cost and configuration</h2><div class="table-wrap"><table><thead><tr><th scope="col">Compare</th>${report.options.map(p=>`<th scope="col">${e(p.name)}<br><small>${e(p.plan)}</small></th>`).join('')}</tr></thead><tbody>${row('Monthly estimate',report.options.map(p=>p.price))}${row('Unit rates',report.options.map(p=>p.unitPrice))}${categoryOf(r)==='text'?row('Input + output cost',report.options.map(p=>`${usd(p.result.inputCost)} input + ${usd(p.result.outputCost)} output`)):''}${row('Budget',report.options.map(p=>p.result.budgetLabel))}${row('Data-use policy',report.options.map(p=>p.training))}${row(extraLabel(r),report.options.map(p=>p.speakers))}${row('Catalog reviewed',report.options.map(p=>p.catalogDate+(p.result.stale?' · Out of date':'')))}</tbody></table></div>
<h2>Before you choose</h2>${report.options.map(p=>`<section class="option"><h3>${e(p.name)} · ${e(p.plan)}</h3><p>${e(p.priceNote)}</p>${p.questions.length?list(p.questions):'<p>No additional catalog condition was flagged for these inputs. Confirm account settings, usage rights and output quality.</p>'}<p class="muted">Catalog sources · reviewed ${e(p.catalogDate)}${p.result.stale?' (out of date)':''}</p><ul>${p.sources.map(s=>`<li>${link(s.url,s.label)}</li>`).join('')}</ul></section>`).join('')}
<h2>Saved assessment results</h2><p>These results are separate from the current catalog estimates. Only the latest saved review matching each plan and every requirement is included. A copied report is not a signed certificate or independently authenticated evidence.</p>${report.options.map(assessment).join('')}
<h2>Your next step</h2><p>${e(report.next)}</p><footer><p>${e(report.limits)}</p><p>This offline report contains the selected requirements, public source links, and any included saved findings. It does not include the connected account, local review links, or wallet credentials. Sharing the file shares its contents.</p></footer></main></body></html>`;
}
