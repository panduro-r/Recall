import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildComparisonReport,comparisonReportHTML} from '../ui/comparison-report.js';
const catalog=JSON.parse(readFileSync('ui/service-catalog.json','utf8')),now=Date.parse('2026-09-15T18:00:00Z');
const req={hours:100,budget:50,noTraining:true,speakers:false},empty={entries:[],unavailable:false};
const build=(ids=['speechmatics-standard','assembly-pro'],r=req,index=empty,time=now)=>buildComparisonReport(catalog,r,ids,index,time);

test('decision summary retains opt-out price uncertainty without declaring a winner',()=>{
  const report=build();assert.equal(report.options[0].result.estimate,45);assert.equal(report.options[1].result.estimate,21);
  assert.match(report.summary.headline,/open pricing/);assert.match(report.summary.difference,/not like-for-like/);
  assert.match(report.options[1].questions.join(' '),/effective date and resulting rate/);
  assert.doesNotMatch(report.summary.difference,/lower|save|winner/i);assert.match(report.options[1].price,/base cost only/);
});
test('comparable metered estimates get an exact cost delta, not an accuracy ranking',()=>{
  const r=build(undefined,{...req,noTraining:false});assert.match(r.summary.difference,/AssemblyAI has a \$24\.00 lower/);assert.match(r.summary.difference,/not an accuracy/);assert.equal(r.summary.headline,'Both estimates are within budget');
});
test('from rates, tokens, training and unknown speaker costs retain separate caveats',()=>{
  const from=build(['gladia-growth','soniox-async']);assert.match(from.options[0].price,/Quote needed/);assert.match(from.options[0].questions.join(' '),/minimum usage/);assert.match(from.options[1].price,/approximate token/);
  const altered=structuredClone(catalog);altered.plans[0].training='default-training';altered.plans[0].diarization=null;
  const report=buildComparisonReport(altered,{...req,speakers:true},[altered.plans[0].id,'speechmatics-standard'],empty,now);
  assert.match(report.summary.headline,/data-use condition/);assert.match(report.options[0].questions.join(' '),/speaker-identification/);assert.match(report.summary.difference,/not like-for-like/);
});
test('stale and over-budget estimates never turn into a recommended match',()=>{
  const stale=build(undefined,req,empty,now+8*86400000);assert.match(stale.summary.headline,/current terms/);assert.equal(stale.options[0].catalogDate,catalog.plans.find(p=>p.id==='speechmatics-standard').reviewedAt);
  const over=build(undefined,{...req,budget:1,noTraining:false});assert.match(over.summary.headline,/Neither/);assert.match(over.options[0].questions.join(' '),/above/);
  const one=build(undefined,{...req,budget:30,noTraining:false});assert.equal(one.summary.headline,'One estimate is within budget');
});
test('exact matching saved results are separate from catalog costs and remain unchanged',()=>{
  const index={entries:[{id:'saved',planId:'speechmatics-standard',requirements:req,capturedAt:'2026-09-12T15:00:00Z',label:'Needs clarification',tone:'confirm',report:{health:'completed',notice:'Saved test assessment.',digest:'a'.repeat(64),findings:[{id:'service',verdict:'INCONCLUSIVE',reason:'The source does not settle this.',citations:[]}]}}],unavailable:false};
  const before=JSON.stringify(index),report=build(undefined,req,index),html=comparisonReportHTML(report);
  assert.match(html,/Needs clarification/);assert.match(html,/The source does not settle this/);assert.equal(report.options[0].result.estimate,45);assert.equal(JSON.stringify(index),before);
  assert.equal(build(undefined,{...req,budget:50.01},index).options[0].review.report,null);
});
test('unavailable, loading and missing records cannot imply a successful assessment',()=>{
  for(const index of [undefined,{entries:[],unavailable:true},empty]){
    const r=build(undefined,req,index);assert.equal(r.options[0].review.report,null);assert.doesNotMatch(r.options[0].review.label,/supported|completed/i);assert.match(comparisonReportHTML(r),/not a finding against/);
  }
});
test('portable report escapes all text and refuses unsafe source links',()=>{
  const r=build();r.options[0].name='<script>alert(1)</script>';r.options[0].priceNote='<img src=x onerror=alert(2)>';
  r.options[0].sources=[{label:'Unsafe <a>',url:'javascript:alert(3)'}];r.options[0].review.report={notice:'Safe',digest:'a'.repeat(64),findings:[{id:'training',verdict:'SUPPORTED',reason:'</style><iframe>',citations:[{quote:'<script>evil</script>',label:'<bad>',url:'https://example.test/?a="&b=<'}]}]};
  const html=comparisonReportHTML(r);assert.doesNotMatch(html,/<script|<img|<iframe|javascript:/i);assert.match(html,/&lt;script&gt;/);assert.match(html,/Content-Security-Policy/);assert.match(html,/default-src 'none'/);assert.match(html,/@media print/);assert.doesNotMatch(html,/<link|<form|<input/i);
});
test('offline report retains exact quotes, timestamps and source URLs without wallet identity',()=>{
  const r=build();r.options[0].review.capturedAt='2026-09-11T15:00:00Z';r.options[0].review.report={health:'partial',notice:'Some conditions not assessed.',digest:'b'.repeat(64),findings:[{id:'training',verdict:'NOT_ASSESSED',reason:'Model request failed.',citations:[]},{id:'service',verdict:'SUPPORTED',reason:'Documented.',citations:[{quote:'Some exact words & <special> text.',label:'Official docs',url:'https://example.test/docs'}]}]};
  r.options[0].account='0xSECRET';r.options[0].review.report.privateKey='SECRETKEY';
  const html=comparisonReportHTML(r);assert.match(html,/2026-09-11 15:00:00 UTC/);assert.match(html,/Some exact words &amp; &lt;special&gt; text/);assert.match(html,/https:\/\/example.test\/docs/);assert.match(html,/Not assessed/);assert.doesNotMatch(html,/0xSECRET|SECRETKEY|\/review#/);
});
test('report is deterministic, immutable and validates plan selection and requirements',()=>{
  const before=JSON.stringify({catalog,req});assert.equal(comparisonReportHTML(build()),comparisonReportHTML(build()));assert.equal(JSON.stringify({catalog,req}),before);
  for(const ids of [[],['unknown'],['speechmatics-standard','speechmatics-standard'],['speechmatics-standard','assembly-pro','soniox-async']])assert.throws(()=>build(ids));
  assert.throws(()=>build(undefined,{...req,budget:NaN}));assert.throws(()=>build(undefined,req,empty,NaN));assert.equal(build(['speechmatics-standard']).summary.headline,'Review this option before choosing');
  const code=readFileSync('ui/comparison-report.js','utf8');assert.doesNotMatch(code,/fetch\(|setItem\(|removeItem\(|\.request\(|localStorage|sessionStorage|reviewAPI\(/);
});
test('v4 report carries readable technical checks and required setup without upgrading the verdict',()=>{
  const r=build();r.options[1].review.report={health:'completed',version:4,notice:'Saved synthetic assessment.',digest:'b'.repeat(64),findings:[
    {id:'service_channels',verdict:'SUPPORTED',label:'Supported',reason:'Mono input is documented.',citations:[]},
    {id:'training',verdict:'CONDITIONAL',label:'Requires setup',reason:'An opt-out is required.',required_actions:['Request <opt-out>.','Wait for confirmation & confirm the price.'],citations:[]}
  ]};
  const before=JSON.stringify(r),html=comparisonReportHTML(r);
  assert.match(html,/Single-channel audio/);assert.match(html,/Requires setup/);assert.match(html,/Required before use/);
  assert.match(html,/Request &lt;opt-out&gt;/);assert.match(html,/Not completed or verified by Recall/);
  assert.equal(JSON.stringify(r),before);
});
