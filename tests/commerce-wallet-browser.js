// Run after commerce-browser-fixture.js, before the usability flow, on localhost.
// All accounts, provider names/icons and transactions below are test fixtures.
async function testRecallWallets(){
  if(location.hostname!=='127.0.0.1'||!window.recallFixture)throw Error('Isolated fixture required');
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const wait=async(fn,label)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out: '+label);};
  const find=name=>[...document.querySelectorAll('button')].find(b=>b.textContent===name);
  const initialSent=recallFixture.sent;
  const originalRequest=ethereum.request,calls=[];
  let rejectConnect=false,holdAccounts=false,releaseAccounts;
  ethereum.request=async args=>{calls.push(args.method);if(args.method==='eth_requestAccounts'&&rejectConnect)throw Error('Connection declined');if(args.method==='eth_accounts'&&holdAccounts)return new Promise(resolve=>releaseAccounts=resolve);return originalRequest(args);};
  const svg=content=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${content}</svg>`);
  const metadata=[
    {info:{uuid:'test-first',name:'Example Blue Wallet',icon:svg('<rect width="32" height="32" rx="7" fill="#2554d9"/><circle cx="16" cy="16" r="10" fill="white"/><path fill="#2554d9" d="M12 12h8v8h-8z"/>')},provider:ethereum},
    {info:{uuid:'test-second',name:'Example Violet Wallet',icon:svg('<rect width="32" height="32" rx="7" fill="#9d90ea"/><circle cx="12" cy="15" r="3" fill="white"/><circle cx="22" cy="15" r="3" fill="white"/>')},provider:{...ethereum}},
    {info:{uuid:'test-third',name:'Legacy Wallet',icon:'https://not-requested.invalid/tracker.png'},provider:{...ethereum}},
    {info:{uuid:'test-broken',name:'Broken Icon Wallet',icon:'data:image/png;base64,broken'},provider:{...ethereum}},
    {info:{uuid:'test-svg',name:'SVG Image Wallet',icon:svg('<script>window.walletIconExecuted=true</script><rect width="32" height="32" fill="#15263c"/>')},provider:{...ethereum}}
  ];
  const announce=()=>{for(const detail of metadata)window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail}));};
  window.addEventListener('eip6963:requestProvider',announce);announce();
  await wait(()=>document.querySelector('#wallet-trigger'),'connected wallet');
  document.querySelector('#wallet-trigger').click();
  const popup=()=>document.querySelector('#wallet-popover');
  assert(popup().querySelectorAll('.wallet-choice').length===5,'Injected provider is upgraded, not duplicated');
  await wait(()=>popup().querySelector('.wallet-logo img')?.naturalWidth>0,'provider icon loads under CSP');
  await wait(()=>!popup().querySelector('[data-wallet-id="test-broken"] img'),'broken icon falls back');
  assert(!popup().querySelector('[data-wallet-id="test-third"] img'),'Remote icon is not requested');
  assert(!window.walletIconExecuted,'SVG metadata never executes script');
  assert(!popup().querySelector('script'),'SVG is an image, never inline HTML');
  assert(popup().getBoundingClientRect().bottom<=innerHeight,'Wallet list fits viewport');
  const readsBefore=calls.length;document.querySelector('[data-wallet-id="test-second"]').click();
  assert(calls.length===readsBefore,'Choosing a provider alone requests no permissions or signature');
  assert(document.querySelector('.wallet-disconnected'),'Changing provider requires connection');
  document.querySelector('[data-wallet-id="injected"]').click();
  find('Connect wallet').click();await wait(()=>document.querySelector('#wallet-trigger'),'connect chosen provider');

  // Keep an unresolved transaction in the journal throughout disconnect.
  const journal=localStorage.getItem('recall.commerce.v2'),draft=localStorage.getItem('recall.requests.v1');
  const pending={id:'wallet-disconnect-test',phase:'pending',created_at:Date.now(),review:{action:'accept_terms',account:recallFixture.state.seller,contract:'0x'+'3'.repeat(40),recipient:'',value_wei:'0',args:['offer-1']}};
  localStorage.setItem('recall.commerce.v2',JSON.stringify([pending]));
  window.dispatchEvent(new StorageEvent('storage',{key:'recall.commerce.v2'}));
  const preserved=localStorage.getItem('recall.commerce.v2');
  document.querySelector('#wallet-trigger').click();
  assert(!find('Disconnect wallet').disabled,'Unresolved transaction does not lock out disconnect');
  holdAccounts=true;recallFixture.account('buyer');
  const beforeDisconnect=calls.length;find('Disconnect wallet').click();
  assert(calls.length===beforeDisconnect,'Local disconnect makes no wallet RPC calls');
  holdAccounts=false;releaseAccounts([recallFixture.state.buyer]);await new Promise(r=>setTimeout(r,100));
  assert(document.querySelector('.notice')?.textContent.startsWith('Wallet disconnected.'),'Late identity reads cannot undo disconnect or its confirmation');
  assert(document.activeElement.id==='wallet-connect','Focus moves to reconnect action');
  assert(!document.querySelector('#wallet-trigger'),'Disconnected account is removed');
  assert(localStorage.getItem('recall.commerce.v2')===preserved,'Pending transaction survives disconnect');
  assert(localStorage.getItem('recall.requests.v1')===draft,'Purchase survives disconnect');
  assert(document.querySelector('.pending-panel'),'Pending recovery remains visible');
  assert([...document.querySelectorAll('[data-signing]')].every(b=>b.disabled),'Disconnected wallet cannot sign');
  recallFixture.account('seller');announce();await new Promise(r=>setTimeout(r,100));
  assert(!document.querySelector('#wallet-trigger'),'Provider events cannot silently reconnect');

  location.hash='#';await new Promise(r=>setTimeout(r,100));
  location.hash='#agreement='+'0x'+'d'.repeat(64);
  await wait(()=>document.querySelector('.wallet-disconnected'),'disconnect survives remount');
  assert(!document.querySelector('#wallet-trigger'),'Authorized extension is not silently restored');
  rejectConnect=true;find('Connect wallet').click();await wait(()=>document.querySelector('.error')?.textContent==='Connection declined','connection rejection');
  recallFixture.account('buyer');await new Promise(r=>setTimeout(r,100));
  assert(!document.querySelector('#wallet-trigger'),'Declined reconnect leaves account detached');
  assert(sessionStorage.getItem('recall.wallet.disconnected.v1')==='true','Rejected reconnect retains disconnect preference');
  rejectConnect=false;find('Connect wallet').click();await wait(()=>document.querySelector('#wallet-trigger'),'explicit reconnect');
  assert(sessionStorage.getItem('recall.wallet.disconnected.v1')==='false','Successful reconnect restores preference');
  assert(localStorage.getItem('recall.commerce.v2')===preserved,'Reconnect does not discard unknown result');
  assert(recallFixture.sent===initialSent,'Wallet UI makes zero transaction submissions');
  assert(!calls.some(method=>method==='wallet_revokePermissions'),'Local disconnect does not claim or request permission revocation');
  assert(document.documentElement.scrollWidth<=innerWidth,'Wallet picker fits narrow viewport');
  localStorage.setItem('recall.commerce.v2',journal);window.dispatchEvent(new StorageEvent('storage',{key:'recall.commerce.v2'}));
  ethereum.request=originalRequest;window.removeEventListener('eip6963:requestProvider',announce);
  return {icons:true,deduplicated:true,unsafeIconFallback:true,disconnect:true,lateIdentityIgnored:true,pendingPreserved:true,remountPersistence:true,rejectedReconnect:true,explicitReconnect:true,additionalSignatures:0};
}
