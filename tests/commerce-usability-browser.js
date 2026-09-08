// Run after commerce-browser-fixture.js in an isolated localhost browser.
// All wallet writes and commerce responses are fixtures, never network writes.
async function testRecallUsability() {
  if(location.hostname!=='127.0.0.1'||!window.recallFixture)throw Error('Isolated fixture required');
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const wait=async(fn,label)=>{for(let i=0;i<400;i++){if(fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+label);};
  const find=name=>[...document.querySelectorAll('button')].find(b=>b.textContent===name);
  const click=async name=>{await wait(()=>find(name)&&!find(name).disabled,name);find(name).click();await wait(()=>!document.querySelector('[aria-busy="true"]'),name+' complete');};
  const journal=()=>JSON.parse(localStorage.getItem('recall.commerce.v2'));
  let hold=true,disconnected=false;
  const fetchFixture=window.fetch,requestFixture=ethereum.request;
  window.fetch=(url,options)=>url==='/api/commerce'&&JSON.parse(options.body).op==='receipt'&&hold
    ?Promise.resolve(new Response(JSON.stringify({hash:JSON.parse(options.body).hash,status:'PENDING'}),{headers:{'Content-Type':'application/json'}})):fetchFixture(url,options);
  ethereum.request=async args=>{if(args.method==='eth_accounts'&&disconnected)return [];if(args.method==='eth_requestAccounts')disconnected=false;return requestFixture(args);};
  await wait(()=>document.body.innerText.includes('Connected as buyer'),'restore authorized account');
  recallFixture.account('seller');await wait(()=>document.body.innerText.includes('Connected as supplier'),'seller account change');
  await click('Accept terms');await click('Approve in wallet');
  assert(journal()[0].phase==='pending','Hold receipt verification');
  disconnected=true;recallFixture.account('buyer');
  await wait(()=>find('Connect wallet'),'disconnected state');
  assert(!find('Connect wallet').disabled,'Connection must remain enabled with a pending transaction');
  await click('Connect wallet');
  assert(document.body.innerText.includes('Connected as buyer'),'Buyer detected without tab navigation');
  assert(recallFixture.sent===1,'Connecting cannot sign');
  hold=false;
  await wait(()=>journal()[0].phase==='complete','automatic acceptance verification');
  await wait(()=>find('Assess supplier terms')&&!find('Assess supplier terms').disabled,'buyer next action');
  for(const action of ['Assess supplier terms','Approve purchase']){
    await click(action);await click('Approve in wallet');await wait(()=>journal()[0].phase==='complete',action+' auto confirmation');
  }
  assert(!find('Pay supplier'),'No payment before review closes');
  recallFixture.closeReview();
  await wait(()=>find('Pay supplier')&&!find('Pay supplier').disabled,'review period automatically opens payment');
  await click('Pay supplier');await click('Approve in wallet');
  await wait(()=>document.body.innerText.includes('Supplier paid'),'matching recipient transfer');
  assert(recallFixture.sent===4,'Exactly four user-approved fixture transactions');
  assert(!find('Pay supplier'),'Completed payment cannot be submitted again');
  return {pendingReconnect:true,accountSwitch:true,automaticReceipts:true,automaticReviewOpening:true,verifiedPayment:true,simulatedWrites:recallFixture.sent};
}
