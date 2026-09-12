// Fresh isolated localhost context only. Synthetic receipt, no wallet or API use.
async function testReviewPassages(sample){
  if(location.hostname!=='127.0.0.1'||!['/review','/review.html'].includes(location.pathname))throw Error('Isolated local review required');
  const assert=(ok,label)=>{if(!ok)throw Error(label);};
  const {sha,REVIEWS,TRANSACTIONS}=await import('/review-model.js');
  assert(!localStorage.getItem(REVIEWS)&&!localStorage.getItem(TRANSACTIONS),'Fresh context required');
  const catalog=await (await fetch('/service-catalog.json')).json(),plan=catalog.plans.find(p=>p.id==='speechmatics-standard');
  sample??=[{id:'service',passages:[{quote:'# API\nRead the [batch guide](https://example.test/docs).\n<br />\n- **English** and mono WAV supported.',before:'',after:'\nEnd.'},{quote:'The service supports prerecorded audio transcription.',before:'',after:''}]},{id:'training',passages:[{quote:'training is off by default, but you can opt in. It applies only to fut',before:'Model ',after:'ure usage.\nNext.'},{quote:'<img src=x onerror=alert(1)> Never train without opt-in.\n[Policy](javascript:alert(1))',before:'',after:''}]}];
  const first=sample[0].passages,training=sample[1].passages;
  const quoteFor=[first[0],...training];
  const texts={
    [plan.sources[0]]:quoteFor.map(p=>(p.before||'')+p.quote+(p.after||'')).join('\n\n'),
    [plan.sources[3]]:(first[1].before||'')+first[1].quote+(first[1].after||'')
  };
  const documents=await Promise.all(plan.sources.map(async id=>{
    const text=(texts[id]||'Synthetic evidence for display testing. ').padEnd(120,' ');
    return {id,...catalog.sources[id],text,textSha256:await sha(text),sha256:'a'.repeat(64),status:'retrieved',complete:true,checkedAt:new Date().toISOString()};
  }));
  const evidence={version:1,plan,requirements:{hours:100,budget:50,noTraining:true,speakers:false},capturedAt:new Date().toISOString(),documents};
  const payload=JSON.stringify(evidence),digest=await sha(payload),account='0x'+'7'.repeat(40),hash='0x'+'8'.repeat(64),source='a'.repeat(64);
  const results=[{id:'service',verdict:'SUPPORTED',reason:'Display test: the assessment explanation remains unchanged. Technical documentation supports the requested transcription features.',citations:first.map((p,i)=>({source:plan.sources[i?3:0],quote:p.quote}))},{id:'training',verdict:'SUPPORTED',reason:'Display test: training is off by default. Opt-in qualifications remain available in the cited passages.',citations:training.map(p=>({source:plan.sources[0],quote:p.quote}))}];
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',consensus_result:'MAJORITY_AGREE',from:account,value_wei:'0',args:[payload],source_sha256:source};
  const row={id:'passage-display-test',payload,digest,evidence,session:{deployment:hash,receipt,state:{version:3,kind:'provider-review',account,digest,evidence_json:payload,review_status:'completed',complete:true,results}}};
  const entry={id:'display-test',requestId:row.id,hash,phase:'complete',review:{action:'deploy',account,contract:'0x'+'0'.repeat(40),recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source}};
  const before=JSON.stringify([row]),journal=JSON.stringify([entry]),calls=[];
  const nativeFetch=window.fetch;
  window.fetch=(url,options)=>{if(String(url).includes('/api/')||options?.method&&options.method!=='GET'){calls.push(url);throw Error('Network writes/API calls forbidden in display test');}return nativeFetch(url,options);};
  localStorage.setItem(REVIEWS,before);localStorage.setItem(TRANSACTIONS,journal);location.hash=new URLSearchParams({id:row.id});
  for(let i=0;i<250&&!document.querySelector('.citation-source');i++)await new Promise(r=>setTimeout(r,20));
  const sources=[...document.querySelectorAll('.citation-source')];
  assert(sources.length===3,'Duplicate source grouped within finding');
  assert(sources.every(s=>!s.open),'Passages collapsed by default');
  assert(!document.body.innerText.includes('Exact saved quote'),'Raw quotes not on initial screen');
  assert(document.body.innerText.includes('Transaction confirmed'),'Receipt still valid');
  sources.forEach(s=>s.querySelector('summary').click());
  assert(sources.every(s=>s.open),'Source rows expand');
  const raw=[...document.querySelectorAll('.citation-original pre')].map(n=>n.textContent);
  assert(JSON.stringify(raw)===JSON.stringify([...first,...training].map(p=>p.quote)),'Every exact saved quote preserved');
  assert(document.querySelectorAll('.citation-page').length===3,'Named source URLs accessible');
  assert([...document.querySelectorAll('.citation-page')].every(a=>a.protocol==='https:'&&a.rel.includes('noopener')),'Source links are safe external links');
  assert(!document.querySelector('.citation-reading img,.citation-reading script,.citation-reading a'),'Quote content cannot load media, execute or create links');
  assert(document.querySelectorAll('.citation-passage').length===4,'All cited passages remain inspectable');
  assert(document.body.innerText.includes('Surrounding text included'),'Added reading context disclosed');
  assert(![...document.querySelectorAll('.citation-reading')].some(b=>b.textContent.includes('<br />')||b.textContent.includes('](https://')),'Common formatting noise removed');
  document.querySelector('.citation-original summary').click();
  assert(document.querySelector('.citation-original').open,'Exact quote disclosure works');
  assert(localStorage.getItem(REVIEWS)===before&&localStorage.getItem(TRANSACTIONS)===journal,'Records byte-for-byte unchanged');
  assert(!calls.length,'No Studio/API calls');
  assert(document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow');
  // Leave a compact screen for inspection; raw/reading views are tested above.
  sources.forEach(s=>s.open=false);
  return {passed:true,checks:16,fixtureOnly:true,apiCalls:0,quotes:raw.length};
}
