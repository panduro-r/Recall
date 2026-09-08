// Run after the fixture and usability flow in an isolated localhost context.
// Network and wallet responses are synthetic. Never run against production.
async function testRecallComponents(){
  if(location.hostname!=='127.0.0.1'||!window.recallFixture)throw Error('Isolated fixture required');
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const wait=async(fn,label)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out: '+label);};
  const sent=recallFixture.sent;
  const trigger=()=>document.querySelector('#wallet-trigger'),popup=()=>document.querySelector('#wallet-popover');
  const headerHeight=document.querySelector('.wallet-panel').getBoundingClientRect().height;
  trigger().click();
  assert(!popup().hidden,'Account panel opens');
  assert(document.activeElement.id==='wallet-close','Initial focus is inside account panel');
  assert(document.querySelector('.wallet-panel').getBoundingClientRect().height===headerHeight,'Account settings cannot expand the page');
  const box=popup().getBoundingClientRect();assert(box.left>=0&&box.right<=innerWidth,'Account popover stays within viewport');
  assert(box.top>=0&&box.bottom<=innerHeight,'Account popover fits vertically');
  assert(!popup().querySelector('select'),'No native single-wallet dropdown');
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert(popup().hidden&&document.activeElement===trigger(),'Escape closes and restores focus');
  trigger().click();document.querySelector('.purchase-context').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
  assert(popup().hidden,'Outside pointer closes account panel');
  trigger().click();document.querySelector('#purchase-tab-activity').focus();
  assert(popup().hidden,'Tabbing out closes nonmodal panel');
  document.querySelector('#purchase-tab-activity').click();
  const events=[...document.querySelectorAll('.activity-event')];
  assert(events.length===4,'One event per fixture transaction');
  for(const event of events){
    event.open=true;
    assert(event.querySelectorAll('.event-copy>strong').length===1,'Event has one title');
    assert(!event.querySelector('.receipt-inspector details'),'Receipt does not contain nested disclosures');
    assert(event.querySelector('time[datetime]'),'Event has a real stored timestamp');
  }
  assert(![...document.querySelectorAll('#purchase-panel-activity button')].some(b=>b.textContent==='Check receipt'),'Completed events use quiet recheck, not recovery CTA');
  assert(!document.querySelector('.purchase-context').textContent.includes('Offer 1'),'Internal offer numbering is absent from header');
  document.querySelector('#purchase-tab-history').click();
  assert(document.querySelector('.proposal-record h3').textContent==='Original proposal','Original proposal has a human name');
  assert(!document.querySelector('.proposal-record>header').textContent.includes('offer-1'),'Internal ID is not a visible headline');
  for(const tab of document.querySelectorAll('[role=tab]')){tab.click();assert(document.documentElement.scrollWidth<=innerWidth,'Every panel fits the viewport');}

  // A missing hash must remain recoverable, without enabling new signatures.
  const journal=JSON.parse(localStorage.getItem('recall.commerce.v2'));
  const pending={...journal.at(-1),id:'component-recovery',phase:'pending',hash:undefined,receipt:undefined};
  localStorage.setItem('recall.commerce.v2',JSON.stringify([pending,...journal]));
  window.dispatchEvent(new StorageEvent('storage',{key:'recall.commerce.v2'}));
  document.querySelector('#purchase-tab-activity').click();
  assert(document.querySelector('.pending-panel'),'Recovery warning is outside information tabs');
  assert(document.querySelector('input[aria-label="Recovery transaction hash"]'),'Missing hash input remains available');
  assert(!trigger().disabled,'Pending outcome never disables account settings');
  assert([...document.querySelectorAll('[data-signing]')].every(b=>b.disabled),'Pending outcome blocks signing');
  localStorage.setItem('recall.commerce.v2',JSON.stringify(journal));
  window.dispatchEvent(new StorageEvent('storage',{key:'recall.commerce.v2'}));

  // Mount the actual draft entry route's component with its saved unsigned reply.
  location.hash='#';await new Promise(r=>setTimeout(r,100));
  const {mountCommerce}=await import('/commerce-ui.js');
  const el=(tag,props={},...children)=>{const n=document.createElement(tag);for(const[k,v]of Object.entries(props)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(k==='class')n.className=v;else if(k in n)n[k]=v;else n.setAttribute(k,v);}n.append(...children.filter(c=>c!=null));return n;};
  const button=(label,onclick,primary=false)=>el('button',{type:'button',class:'button'+(primary?' primary':''),onclick},label);
  const row=JSON.parse(localStorage.getItem('recall.requests.v1'))[0];
  const flow=el('div',{class:'commerce-flow'});document.querySelector('main').replaceChildren(flow);
  let dispose=mountCommerce(flow,{el,button,row});
  await wait(()=>flow.querySelector('.proposal-preview'),'pre-deployment proposal preview');
  assert(flow.querySelector('.condition-copy').textContent===row.conditions.join('\n'),'Pre-deployment conditions remain reviewable');
  assert(!flow.querySelector('.draft-archive'),'No historical duplicate before deployment');
  dispose();flow.replaceChildren();
  dispose=mountCommerce(flow,{el,button,row,deployment:'0x'+'d'.repeat(64)});
  await wait(()=>flow.querySelector('#purchase-tab-details'),'draft with live agreement');
  flow.querySelector('#purchase-tab-details').click();flow.querySelector('.draft-archive').open=true;
  assert(flow.querySelector('#purchase-panel-details .draft-archive'),'Unsigned draft lives inside Details');
  assert(flow.querySelectorAll('h1').length===1,'One live purchase title');
  assert(!document.querySelector('.saved-offer'),'No repeated document below the active purchase');
  assert(document.documentElement.scrollWidth<=innerWidth,'Expanded historical reply fits viewport');
  assert(recallFixture.sent===sent,'All component inspection and recovery setup produced zero signatures');
  dispose();location.hash='#agreement='+'0x'+'d'.repeat(64);
  return {accountPopover:true,dismissAndFocus:true,eventReceipts:true,proposalNames:true,unsignedArchive:true,pendingRecovery:true,responsive:true,additionalSignatures:0};
}
