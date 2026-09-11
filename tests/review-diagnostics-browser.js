// Explicit fixtures in an isolated localhost browser context. No wallet or RPC.
async function testReviewDiagnostics(version=3){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/review')throw Error('Isolated localhost review required');
  const {sha,REVIEWS,TRANSACTIONS,REVIEW_ERRORS,LEGACY_FALLBACK}=await import('/review-model.js');
  const catalog=await (await fetch('/service-catalog.json')).json(),plan=catalog.plans.find(p=>p.id==='speechmatics-standard');
  const text='The English pre-recorded transcription API supports single-channel audio. Customer audio and transcripts are never used to train models.';
  const account='0x'+'7'.repeat(40),hash='0x'+'8'.repeat(64),source='a'.repeat(64),zero='0x'+'0'.repeat(40);
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+fn);};
  let rpcCalls=0,checks=0;const originalFetch=window.fetch;
  window.fetch=async(url,...args)=>{if(String(url).includes('/api/')){rpcCalls++;throw Error('Unexpected API call in display-only fixture');}return originalFetch(url,...args);};
  const other=JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>![REVIEWS,TRANSACTIONS].includes(k))));
  try{
    for(const mode of ['failed','partial','ambiguous','incomplete','legacy']){
      const e={version:1,plan,requirements:{hours:100,budget:50,noTraining:true,speakers:false},capturedAt:new Date().toISOString(),documents:await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:mode!=='incomplete',text,textSha256:await sha(text),sha256:'a'.repeat(64)})))};
      const payload=JSON.stringify(e),digest=await sha(payload),id='diagnostic-'+mode;
      const review={action:'deploy',account,contract:zero,recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source};
      const receipt={hash,status:'FINALIZED',execution:'SUCCESS',from:account,value_wei:'0',args:[payload],source_sha256:source};
      const good=id=>({id,verdict:'SUPPORTED',reason:'Explicit browser fixture, not a real assessment.',citations:[{source:plan.sources[0],quote:text.slice(0,70)}]});
      const failure=(id,code)=>({id,verdict:'NOT_ASSESSED',reason:REVIEW_ERRORS[code],citations:[],error_code:code});
      let results=['service','training'].map(good),review_status='completed';
      if(mode==='failed'){results=results.map(r=>failure(r.id,'MODEL_CALL_FAILED'));review_status='failed';}
      if(mode==='partial'){results[1]=failure('training','INVALID_CITATION');review_status='partial';}
      if(mode==='ambiguous')results[1]={id:'training',verdict:'INCONCLUSIVE',reason:'The captured text does not confirm the account setting for this plan.',citations:[]};
      if(mode==='incomplete'){results=results.map(r=>failure(r.id,'INCOMPLETE_EVIDENCE'));review_status='evidence_incomplete';}
      if(mode==='legacy')results=results.map(r=>({id:r.id,verdict:'INCONCLUSIVE',reason:LEGACY_FALLBACK,citations:[]}));
      const state={version:mode==='legacy'?1:version,kind:'provider-review',account,digest,evidence_json:payload,complete:mode!=='incomplete',results,...(mode==='legacy'?{}:{review_status})};
      const row={id,evidence:e,payload,digest,session:{deployment:hash,receipt,state}};
      const saved=JSON.stringify([row]),journal=JSON.stringify([{id:'entry-'+mode,requestId:id,hash,review,phase:'complete'}]);
      localStorage.setItem(REVIEWS,saved);localStorage.setItem(TRANSACTIONS,journal);location.hash=new URLSearchParams({id});
      const expected={failed:'Review couldn’t complete',partial:'Review partially completed',ambiguous:'Needs clarification',incomplete:'Evidence capture incomplete',legacy:'Review result unavailable'}[mode];
      await wait(()=>document.querySelector('.review-sidebar h2')?.textContent===expected&&document.querySelector('#review-content').textContent.includes('Review format: v'+(mode==='legacy'?1:version)));
      const content=document.querySelector('#review-content');
      assert(!content.textContent.includes('GenLayer reviewed'),'no unqualified review badge');
      assert(content.textContent.includes('This confirms execution, not the quality or completeness'),'receipt does not imply assessment quality');
      if(mode!=='ambiguous'){
        assert(!content.querySelector('.review-sidebar').textContent.includes('Needs clarification'),'failure is not ambiguity');
        assert(content.querySelector('.review-sidebar .primary').textContent==='Export saved review','failure does not prompt immediate resubmission');
      }
      if(mode==='legacy')assert(!content.querySelector('.review-grid').textContent.includes(LEGACY_FALLBACK),'old generic fallback replaced only in presentation');
      if(mode==='partial')assert(content.textContent.includes('Supported by captured terms')&&content.textContent.includes('Not assessed'),'valid finding survives separate technical failure');
      assert(localStorage.getItem(REVIEWS)===saved&&localStorage.getItem(TRANSACTIONS)===journal,'saved evidence and journal unchanged');
      assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal overflow');
      checks+=6;
    }
    assert(!rpcCalls,'display changes make no API calls');
    assert(JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>![REVIEWS,TRANSACTIONS].includes(k))))===other,'unrelated storage preserved');
    return {passed:true,fixtureOnly:true,checks,rpcCalls};
  }finally{window.fetch=originalFetch;}
}
