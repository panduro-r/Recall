// Browser-only test fixture. Run in an isolated context against localhost.
// Intercepts ALL commerce requests and supplies a fake provider: never signs.
async function installRecallFixture() {
  if(location.hostname!=='127.0.0.1')throw Error('Local isolated test context only');
  const {expectedArgs}=await import('/commerce-model.js');
  const config=await (await fetch('/api/commerce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'config'})})).json();
  const buyer='0x'+'1'.repeat(40),seller='0x'+'2'.repeat(40),contract='0x'+'3'.repeat(40);
  const req={version:1,id:'browser-test-request',title:'Support API',budget:'0.100',conditions:['Customer inputs must never be used to train models.']};
  const reply={request:req,seller,price:'0.040',terms:'Order 1: all customer inputs are excluded from model training, without exceptions.'};
  const state={version:2,buyer,seller,title:req.title,criterion:req.conditions.join('\n'),budget_wei:'100000000000000000',accepted:false,paid:false,expires_at:Math.floor(Date.now()/1000)+86400,
    offers:[{id:'offer-1',amount_wei:'40000000000000000',terms:reply.terms,status:'PENDING',permit:'NONE',review_until:0,counter_terms:'',judgment:null}]};
  let account=buyer,lastPlan,lastRequest,seq=0;
  const receipts={},listeners={};let deployment='0x'+'d'.repeat(64);
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(url,options)=>{
    if(url!=='/api/commerce')return originalFetch(url,options);
    const data=JSON.parse(options.body);let result;
    if(data.op==='config')result=config;
    else if(data.op==='inspect')result={deployment,contract,state:structuredClone(state),observed_at:Date.now()/1000};
    else if(data.op==='receipt')result=receipts[data.hash]||{hash:data.hash,status:'NOT_FOUND'};
    else if(data.op==='prepare') {
      lastRequest=data.request;const r=lastRequest,offer=state.offers.at(-1);
      const review={action:r.action,account:r.account,contract:r.action==='deploy'?'0x'+'0'.repeat(40):contract,recipient:r.action==='execute_purchase'?seller:'',value_wei:r.action==='execute_purchase'?offer.amount_wei:'0',args:expectedArgs(r.action,r.fields),chain_id:61999,source_sha256:config.source_sha256};
      result={review,prepared_at:Date.now()/1000,intent_id:'a'.repeat(64),transaction:{from:r.account,to:'0x'+'0'.repeat(40),chainId:'0xf22f',gasPrice:'0x0',gas:'0x100000',nonce:'0x0',value:'0x'+BigInt(review.value_wei).toString(16),data:'0x1234'}};
      lastPlan=result;
    } else throw Error('Unknown fixture API');
    return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const provider={on:(event,fn)=>(listeners[event]??=[]).push(fn),removeListener:(event,fn)=>{listeners[event]=(listeners[event]||[]).filter(f=>f!==fn);},request:async({method})=>{
    if(['eth_requestAccounts','eth_accounts'].includes(method))return [account];
    if(method==='eth_chainId')return '0xf22f';
    if(method==='wallet_switchEthereumChain')return null;
    if(method!=='eth_sendTransaction')throw Error('Unexpected fixture wallet method');
    const hash='0x'+(++seq).toString(16).padStart(64,'0'),r=structuredClone(lastPlan.review),o=state.offers.at(-1),fields=lastRequest.fields;
    if(r.action==='deploy')deployment=hash;
    if(r.action==='accept_terms')state.accepted=true;
    if(r.action==='evaluate_claim'){o.status='VALID';o.review_until=Math.floor(Date.now()/1000)+600;o.judgment={verdict:'SUPPORTED',reason:'Fixture: the terms exclude model training.'};}
    if(r.action==='queue_purchase')o.permit='RESERVED';
    if(r.action==='challenge_claim'){o.counter_terms=fields.terms;o.status='DISPUTED';}
    if(r.action==='resolve_challenge'){o.status='INVALID';o.judgment={verdict:'REFUTED',reason:'Fixture: the amendment now allows model training.'};}
    if(r.action==='cancel_purchase')o.permit='CANCELLED';
    if(r.action==='publish_claim')state.offers.push({id:'offer-'+(state.offers.length+1),amount_wei:fields.amount_wei,terms:fields.terms,status:'PENDING',permit:'NONE',review_until:0,counter_terms:'',judgment:null});
    if(r.action==='execute_purchase'){o.permit='SCHEDULED';state.paid=true;}
    receipts[hash]={hash,status:'FINALIZED',execution:'SUCCESS',from:account,to:contract,value_wei:r.value_wei,method:r.action,args:r.args,source_sha256:r.source_sha256,settlement:r.action==='execute_purchase'?'child-finalized':'unverified',
      ...(r.action==='execute_purchase'?{child:{hash:'0x'+'f'.repeat(64),from_address:contract,to_address:seller,value:r.value_wei,triggered_by:hash,status:'FINALIZED'}}:{})};
    return hash;
  }};
  Object.defineProperty(window,'ethereum',{configurable:true,value:provider});
  localStorage.setItem('recall.requests.v1',JSON.stringify([{...req,shared:true,reply}]));
  localStorage.setItem('recall.commerce.v2','[]');
  window.recallFixture={state,receipts,get sent(){return seq;},account:(role)=>{account=role==='buyer'?buyer:seller;for(const fn of listeners.accountsChanged||[])fn([account]);},closeReview:()=>{state.offers.at(-1).review_until=Math.floor(Date.now()/1000)-10;}};
  location.hash='#agreement='+deployment;
  document.title='Recall — Isolated fixture (not live transactions)';
  return {fixture:true,networkWrites:0};
}
