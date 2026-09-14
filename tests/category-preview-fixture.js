// Explicit synthetic display fixture. Served only by the isolated QA server.
import {sha,REVIEWS,TRANSACTIONS} from '/review-model.js';
const button=document.querySelector('#fixture');
button.addEventListener('click',async()=>{
  if(location.hostname!=='127.0.0.1'||location.port!=='4204')throw Error('Isolated QA only');
  const catalog=await(await fetch('/service-catalog.json')).json(),plan=catalog.plans.find(p=>p.id==='fish-speech');
  const text='SYNTHETIC UI TEST ONLY. Not provider evidence. The standard voice API generates English speech from text. Streaming output is available. A training opt-out needs account confirmation.';
  const req={category:'speech',characters:1000000,budget:50,noTraining:true,streaming:true,utf8Bytes:null};
  const documents=await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],text,textSha256:await sha(text),sha256:'a'.repeat(64),status:'retrieved',complete:true,checkedAt:new Date().toISOString()})));
  const evidence={version:1,plan,requirements:req,documents,capturedAt:new Date().toISOString()},payload=JSON.stringify(evidence),digest=await sha(payload),hash='0x'+'7'.repeat(64),account='0x'+'8'.repeat(40),source='9'.repeat(64);
  const results=['speech_api','speech_english','training','streaming'].map(id=>({id,verdict:'SUPPORTED',reason:'Synthetic display fixture. This is not a live GenLayer result.',citations:[{source:plan.sources[0],quote:text}]}));
  Object.assign(results[2],{verdict:'CONDITIONAL',required_actions:['Confirm the opt-out with the provider before use.']});
  const receipt={hash,status:'FINALIZED',execution:'SUCCESS',from:account,value_wei:'0',args:[payload],source_sha256:source};
  const row={id:'qa-speech-v5',evidence,payload,digest,session:{deployment:hash,receipt,state:{version:5,kind:'provider-review',account,digest,evidence_json:payload,complete:true,review_status:'completed',results}}};
  const entry={id:'qa-speech-entry',requestId:row.id,hash,phase:'complete',review:{action:'deploy',account,contract:'0x'+'0'.repeat(40),recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:source}};
  // This test server owns a separate origin. Never clear or replace other rows.
  for(const [key,value] of [[REVIEWS,row],[TRANSACTIONS,entry]]){
    const old=JSON.parse(localStorage.getItem(key)||'[]');
    if(old.some(r=>r.id===value.id))continue;
    localStorage.setItem(key,JSON.stringify([value,...old]));
  }
  location.href='/review#id=qa-speech-v5';
});
