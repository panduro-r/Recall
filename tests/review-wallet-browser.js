// Run only in a fresh isolated localhost context, with a fixture window.ethereum.
// All providers, evidence and preparation responses are fixtures. Never signs.
async function testReviewWalletView(){
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/review'||!window.reviewWalletFixture)throw Error('Fresh local fixture required');
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out: '+fn);};
  const find=name=>[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===name||b.textContent.trim()===name);
  const {sha,REVIEWS,TRANSACTIONS}=await import('/review-model.js');
  assert(!localStorage.getItem(REVIEWS),'Do not overwrite existing reviews');
  const catalog=await(await fetch('/service-catalog.json')).json(),plan=catalog.plans.find(p=>p.id==='speechmatics-standard');
  const text='Local layout fixture only. Example English transcription API terms are supplied for testing the wallet view. This is not provider evidence or a GenLayer finding.';
  const evidence={version:1,plan,requirements:{hours:100,budget:50,noTraining:true,speakers:false},capturedAt:new Date().toISOString(),documents:await Promise.all(plan.sources.map(async id=>({id,...catalog.sources[id],status:'retrieved',complete:true,text,textSha256:await sha(text),sha256:'a'.repeat(64)})))};
  const payload=JSON.stringify(evidence),row={id:'wallet-layout-fixture',evidence,payload,digest:await sha(payload)};
  localStorage.setItem(REVIEWS,JSON.stringify([row]));location.hash='id='+row.id;window.dispatchEvent(new HashChangeEvent('hashchange'));
  await wait(()=>find('Review with GenLayer'));
  const originalFetch=window.fetch;
  window.fetch=async(url,options)=>{
    if(url!=='/api/provider-review')return originalFetch(url,options);
    const data=JSON.parse(options.body);let result;
    if(data.op==='config')result={source_sha256:'a'.repeat(64),notice:'Local layout fixture only.'};
    else if(data.op==='prepare')result={review:{action:'deploy',account:reviewWalletFixture.account,contract:'0x'+'0'.repeat(40),recipient:'',value_wei:'0',args:[payload],chain_id:61999,source_sha256:'a'.repeat(64)}};
    else throw Error('Unexpected fixture API operation: '+data.op);
    return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const names=['Blue Wallet','Violet Wallet','Orange Wallet','Green Wallet','Rose Wallet','Legacy Wallet','Broken Icon Wallet'];
  const colors=['#2f55e7','#9d90ea','#e68040','#268867','#de6692'];
  names.forEach((name,i)=>{
    const icon=i<5?'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="${colors[i]}"/><circle cx="16" cy="16" r="8" fill="white"/></svg>`):i===5?'https://not-requested.invalid/icon.png':'data:image/png;base64,broken';
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'layout-'+i,name,icon},provider:{request:ethereum.request}}}));
  });
  const open=async()=>{find('Review with GenLayer').focus();find('Review with GenLayer').click();await wait(()=>find('Continue with public evidence'));find('Continue with public evidence').click();await wait(()=>document.querySelector('.wallet-dialog[open]'));};
  const dimensions=()=>{
    const dialog=document.querySelector('.wallet-dialog'),rect=dialog.getBoundingClientRect();
    assert(rect.width<=420.5&&rect.left>=0&&rect.right<=innerWidth,'Dialog is compact and inside viewport');
    assert(rect.top>=0&&rect.bottom<=innerHeight,'Dialog height fits viewport');
    assert(dialog.querySelector('.wallet-picker-footer').getBoundingClientRect().bottom<=innerHeight,'Footer stays visible');
    const buttons=[...dialog.querySelectorAll('.review-wallet')],left=buttons[0].querySelector('.review-wallet-logo').getBoundingClientRect().left;
    assert(buttons.length===8,'All eight fixture providers remain selectable');
    for(const button of buttons){
      const icon=button.querySelector('.review-wallet-logo').getBoundingClientRect(),label=button.querySelector('.review-wallet-name').getBoundingClientRect();
      assert(Math.abs(icon.left-left)<1&&label.left>icon.right,'Icons and names share aligned columns');
      assert(icon.width===32&&icon.height===32,'Icon containers have a fixed size');
      assert(button.getBoundingClientRect().height>=44,'Rows meet touch-target size');
    }
    assert(buttons.at(-1).getAttribute('aria-label')==='Browser wallet','Generic injected connection is after named wallets');
    assert(find('Browser wallet').querySelector('.review-wallet-logo svg'),'Generic icon is a wallet SVG, not a symbol');
    assert(!dialog.textContent.includes('◈'),'Diamond placeholder removed');
    assert(document.documentElement.scrollWidth<=innerWidth,'No horizontal overflow');
    return {width:rect.width,height:rect.height,viewport:innerWidth};
  };
  await open();await wait(()=>find('Broken Icon Wallet').querySelector('.review-wallet-logo svg'));
  assert(find('Legacy Wallet').querySelector('.review-wallet-logo svg'),'Untrusted remote icon uses local fallback');
  assert(reviewWalletFixture.calls.length===0,'Opening chooser makes no wallet calls');
  const disconnected=dimensions();find('Close').click();
  await wait(()=>document.activeElement===find('Review with GenLayer'));
  await open();find('Browser wallet').click();await wait(()=>find('Not now'));
  assert(!document.querySelector('.wallet-dialog'),'Signing review does not inherit wallet-only dimensions');
  find('Not now').click();document.querySelector('#wallet-settings').click();
  assert(document.querySelector('.wallet-picker-account').textContent.includes('Browser wallet'),'Connected wallet is identified');
  assert(find('Browser wallet').getAttribute('aria-pressed')==='true','Current wallet has a selected state');
  const connected=dimensions(),saved=localStorage.getItem(REVIEWS),journal=localStorage.getItem(TRANSACTIONS),calls=reviewWalletFixture.calls.length;
  find('Disconnect wallet').click();
  assert(document.querySelector('#wallet-settings').hidden,'Disconnect detaches wallet');
  assert(reviewWalletFixture.calls.length===calls,'Disconnect makes no wallet requests');
  assert(localStorage.getItem(REVIEWS)===saved&&localStorage.getItem(TRANSACTIONS)===journal,'Disconnect preserves evidence and transactions');
  assert(!reviewWalletFixture.calls.includes('eth_sendTransaction'),'No transaction submitted');
  // Leave the chooser open for visual inspection, then restore the real local fetch.
  await open();window.fetch=originalFetch;
  return {passed:true,fixtureOnly:true,checks:18,disconnected,connected,submissions:0};
}
