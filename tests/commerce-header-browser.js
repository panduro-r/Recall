// Run after installRecallFixture in an isolated localhost workspace.
async function testCommerceHeader(){
  if(location.hostname!=='127.0.0.1'||!window.recallFixture)throw Error('Isolated commerce fixture required');
  const $=s=>document.querySelector(s),calls=[],checks=[],initial=recallFixture.sent;
  const assert=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+fn);};
  const original=ethereum.request;ethereum.request=async args=>{calls.push(args.method);return original(args);};
  try{
    recallFixture.account('buyer');await wait(()=>$('#connect-wallet').textContent.includes('0x1111'));
    const draft=localStorage.getItem('recall.requests.v1'),journal=localStorage.getItem('recall.commerce.v2');
    $('#connect-wallet').click();assert($('#connection-dialog').open,'Header opens settings for purchase wallet');
    $('#connection-disconnect').click();
    assert($('#connect-wallet').textContent==='Connect wallet'&&!$('#wallet-trigger'),'Both header and purchase wallet disconnect together');
    assert(calls.every(m=>m!=='eth_requestAccounts'),'Disconnect does not request access');
    const choice=[...document.querySelectorAll('#connection-choices button')].find(b=>b.textContent.includes('Browser wallet'))||$('#connection-choices button');
    choice.click();await wait(()=>$('#wallet-trigger')&&!$('#connection-dialog').open);
    assert($('#connect-wallet').textContent.includes('0x1111')&&$('#wallet-trigger').textContent.includes('0x1111'),'Header connection is used by purchase actions');
    recallFixture.account('seller');await wait(()=>$('#connect-wallet').textContent.includes('0x2222'));
    assert($('#wallet-trigger').textContent.includes('supplier'),'Identity changes update both controls');
    assert(localStorage.getItem('recall.requests.v1')===draft&&localStorage.getItem('recall.commerce.v2')===journal,'Connection changes preserve purchases and receipt journal');
    assert(!calls.includes('eth_sendTransaction')&&recallFixture.sent===initial,'Header never submits');
    assert(document.documentElement.scrollWidth<=innerWidth,'Header stays within viewport');
    return {passed:true,checks,calls,additionalSignatures:0};
  }finally{ethereum.request=original;}
}
