// Run only in a fresh isolated localhost context. These are fake providers,
// never the user's extension. No transaction methods exist on the fixture.
async function testCompareWallet() {
  if(location.hostname!=='127.0.0.1'||location.pathname!=='/compare')throw Error('Isolated local comparison required');
  const $=selector=>document.querySelector(selector),checks=[];
  const assert=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  const wait=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
  const storage=JSON.stringify(Object.entries(localStorage)),session=JSON.stringify(Object.entries(sessionStorage));
  const dialog=$('#connection-dialog'),trigger=$('#connect-wallet');dialog.close();await new Promise(r=>setTimeout(r,20));
  if(!window.compareWalletFixture){
    assert(!$('#connection-choices button'),'no real wallet providers in isolated fixture');
    trigger.click();assert(dialog.textContent.includes('No wallet detected'),'empty state explains optional connection');dialog.close();
    const fixture={calls:[],mode:'success',listeners:new Map(),resolve:null};
    fixture.provider={request:async({method})=>{
      fixture.calls.push(method);if(method!=='eth_requestAccounts')throw Error('Unexpected wallet method');
      if(fixture.mode==='reject')throw {code:4001};
      if(fixture.mode==='pending')return new Promise(resolve=>fixture.resolve=resolve);
      return ['0x'+'1'.repeat(40)];
    },on:(event,handler)=>fixture.listeners.set(event,handler),removeListener:(event,handler)=>{if(fixture.listeners.get(event)===handler)fixture.listeners.delete(event);}};
    window.compareWalletFixture=fixture;
    // Exercise both branded data icons and a neutral SVG fallback.
    for(let i=0;i<8;i++)window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{provider:i?{request:async()=>['0x'+'2'.repeat(40)]}:fixture.provider,info:{uuid:'fixture-'+i,name:i===0?'Example Wallet':i===7?'Browser wallet':'Sample wallet '+i,icon:i===7?null:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#6678ee"/><circle cx="16" cy="16" r="7" fill="white"/></svg>')}}}));
    assert(fixture.calls.length===0,'discovery never requests permissions');
  }
  const fixture=window.compareWalletFixture;fixture.mode='success';
  const choice=()=>$('#connection-choices button[data-wallet="fixture-0"]');
  trigger.click();assert(dialog.open&&document.activeElement===$('#connection-close'),'visible header opens accessible dialog');
  assert($('#connection-choices button:last-child svg')&&!$('#connection-choices button:last-child img'),'browser wallet uses SVG, not text glyph');
  const modal=dialog.getBoundingClientRect();assert(modal.width<=420&&modal.left>=0&&modal.right<=innerWidth&&modal.top>=0&&modal.bottom<=innerHeight,'compact dialog fits viewport');
  assert(getComputedStyle(choice()).justifyContent==='flex-start','wallet rows are left aligned');
  const logo=choice().querySelector('.connection-logo').getBoundingClientRect();assert(logo.width===32&&logo.height===32,'wallet icons keep consistent size');
  choice().click();await wait(()=>!dialog.open&&document.activeElement===trigger);
  assert(trigger.textContent.includes('0x1111…1111'),'connected account is visible beside saved options');
  assert(document.activeElement===trigger,'focus returns to header after connection');
  fixture.listeners.get('accountsChanged')(['0x'+'2'.repeat(40)]);assert(trigger.textContent.includes('0x2222…2222'),'account changes update header');
  trigger.click();assert($('#connection-account').textContent.includes('Connected'),'settings show connected wallet');
  $('#connection-disconnect').click();assert(trigger.textContent==='Connect wallet'&&fixture.listeners.size===0,'disconnect clears connection and listeners');
  fixture.mode='reject';choice().click();await wait(()=>$('#connection-status').textContent.includes('cancelled'));
  assert(!choice().disabled&&dialog.open,'rejected permission is recoverable');
  fixture.mode='pending';choice().click();assert(choice().disabled,'pending request prevents duplicate clicks');
  $('#connection-disconnect').click();fixture.resolve(['0x'+'1'.repeat(40)]);await new Promise(r=>setTimeout(r,30));
  assert(trigger.textContent==='Connect wallet','cancelled pending request cannot silently reconnect');
  $('#connection-close').click();await wait(()=>document.activeElement===trigger&&trigger.getAttribute('aria-expanded')==='false');
  assert(document.activeElement===trigger&&trigger.getAttribute('aria-expanded')==='false','closing restores focus and expanded state');
  $('#saved-options').click();assert($('#option-dialog').open,'saved options still opens independently');$('#option-dialog').close();
  assert(JSON.stringify(Object.entries(localStorage))===storage&&JSON.stringify(Object.entries(sessionStorage))===session,'all saved data remains unchanged');
  assert(fixture.calls.every(method=>method==='eth_requestAccounts'),'no signatures, transactions or network changes');
  assert(document.documentElement.scrollWidth<=innerWidth,'header has no horizontal overflow');
  return {passed:true,checks};
}
