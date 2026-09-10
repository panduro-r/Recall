import {validateCatalog} from './compare-model.js';
import {REVIEWS,TRANSACTIONS,sha,selection,reviewLink,validateCapture,readReviews,saveReview,matchesReview,validSession,outcome,reviewHealth,LEGACY_FALLBACK,evidenceChanges,reviewAPI} from './review-model.js';
import {Commerce,PurchaseUpdates} from './commerce-model.js';
import {Wallet,CHAIN_ID} from './wallet.js';
import {registerWallet} from './wallet-discovery.js';
const $=s=>document.querySelector(s),root=$('#review-content'),notice=$('#review-notice'),dialog=$('#review-dialog');
function el(tag,attrs={},...children){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k.startsWith('on'))n.addEventListener(k.slice(2),v);else if(k in n&&!['class','role'].includes(k))n[k]=v;else n.setAttribute(k,v);}n.append(...children.filter(c=>c!==null&&c!==undefined));return n;}
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const date=s=>new Date(s).toLocaleString();
let catalog,selected,current,rows=[],wallet,config,busy=false,trigger,storageError='';
const providers=new Map();
const journal=new Commerce({storage:localStorage,call:reviewAPI,locks:navigator.locks,journal:TRANSACTIONS,match:matchesReview});
function message(text){notice.textContent=text;}
function close(){dialog.close();}
function modal(title,...children){trigger=document.activeElement;dialog.classList.remove('wallet-dialog');dialog.removeAttribute('aria-describedby');$('#dialog-content').replaceChildren(el('div',{class:'dialog-header'},el('h2',{id:'dialog-title'},title),el('button',{class:'close-dialog',type:'button','aria-label':'Close',onclick:close},'×')),el('div',{class:'dialog-body'},...children));if(!dialog.open)dialog.showModal();}
dialog.addEventListener('close',()=>trigger?.isConnected&&trigger.focus());
async function work(fn){if(busy)return;busy=true;render();try{await fn();}catch(e){message(e.message||'Could not finish this step. Your saved evidence is unchanged.');}finally{busy=false;render();}}
function store(row){saveReview(localStorage,row);rows=readReviews(localStorage);current=row;}
function download(row){const url=URL.createObjectURL(new Blob([JSON.stringify(row,null,2)],{type:'application/json'}));const a=el('a',{href:url,download:`recall-${row.evidence.plan.id}-${row.id}.json`});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function nav(id){location.hash=new URLSearchParams({id});}
function history(){
  const section=el('section',{class:'review-section'},el('h2',{},'Your saved reviews'),el('p',{class:'review-note'},'Each capture stays separate. Nothing runs in the background when this page is closed.'));
  section.append(el('div',{class:'review-history'},...rows.map(r=>el('a',{href:'/review#'+new URLSearchParams({id:r.id})},el('div',{},el('strong',{},r.evidence.plan.name+' · '+r.evidence.plan.plan),el('small',{},date(r.evidence.capturedAt))),el('span',{class:`status-badge ${outcome(r).status}`},outcome(r).label)))));
  if(!rows.length)section.append(el('p',{},'No reviews yet. Choose a plan from the comparison to start.'));
  return section;
}
function sourceDetails(e){
  const section=el('section',{class:'review-section'},el('h2',{},'The evidence behind this review'),el('p',{class:'review-note'},'Recall captures public page text. Scripts, navigation and interactive pricing controls are not evaluated. GenLayer assesses the supplied text; it does not independently verify its web origin or your provider account settings.'));
  for(const d of e.documents){
    section.append(el('details',{class:'review-source'},el('summary',{},d.label),el('small',{},`${date(d.checkedAt)} · ${d.status==='retrieved'?(d.complete?'Text captured':'Incomplete text capture'):'Could not retrieve'}`),el('a',{href:d.url,target:'_blank',rel:'noopener noreferrer'},'Open original source ↗'),
      d.text?el('pre',{class:'review-text',tabIndex:0},d.text):el('p',{},d.reason||'Source unavailable.'),d.textSha256?el('small',{},'Text fingerprint: ',el('code',{},d.textSha256)):null));
  }
  return section;
}
function changes(row){
  const baseline=rows.find(r=>r.id===row.baselineId);if(!baseline)return null;
  const diffs=evidenceChanges(baseline,row),count=diffs.filter(d=>d.changed).length;
  const section=el('section',{class:'review-section'},el('h2',{},count?`${count} source ${count===1?'text changed':'texts changed'}`:'No changes in captured text'),el('p',{class:'review-note'},`Compared with ${date(baseline.evidence.capturedAt)}. A text change is not automatically a policy change. A new assessment is needed to interpret it.`),el('a',{href:'/review#'+new URLSearchParams({id:baseline.id})},'Open previous review →'));
  for(const d of diffs.filter(d=>d.changed)){
    section.append(el('details',{class:'review-source'},el('summary',{},d.label),d.unavailable?el('p',{},'One capture is unavailable. A reliable text comparison is not possible.'):el('div',{class:'review-changes'},el('p',{class:'review-note'},`${d.added.length} added lines · ${d.removed.length} removed lines. Showing up to 40 of each; export both snapshots for full text.`),...d.removed.slice(0,40).map(t=>el('p',{class:'removed'},'− '+t)),...d.added.slice(0,40).map(t=>el('p',{},'+ '+t)))));
  }
  return section;
}
function findings(row){
  const section=el('section',{class:'review-section'},el('h2',{},'What the documents support'));
  if(!row.session){section.append(el('p',{},'Your evidence is saved. Ask GenLayer to assess it, or read the source text below without connecting a wallet.'));return section;}
  const health=reviewHealth(row.session.state);
  if(health.status!=='completed'){
    section.firstElementChild.textContent=health.label;
    section.append(el('p',{class:'progress-copy'},health.message));
  }
  const names={service:'Transcription API',training:'No model training',speakers:'Speaker labels'},labels={SUPPORTED:'Supported by captured terms',REFUTED:'Conflicts with your condition',INCONCLUSIVE:'Needs clarification',NOT_ASSESSED:'Not assessed'};
  for(const r of row.session.state.results){
    const legacy=row.session.state.version===1&&(health.status==='evidence_incomplete'||r.reason===LEGACY_FALLBACK),unchecked=legacy||r.verdict==='NOT_ASSESSED';
    section.append(el('article',{class:'review-finding'},el('h3',{},names[r.id]),el('span',{class:`status-badge ${unchecked?'unreviewed':r.verdict==='SUPPORTED'?'fit':r.verdict==='REFUTED'?'notfit':'confirm'}`},legacy?'No usable result':labels[r.verdict]),legacy?null:el('p',{},r.reason),...r.citations.map(c=>el('blockquote',{},c.quote,el('br'),el('a',{href:row.evidence.documents.find(d=>d.id===c.source).url,target:'_blank',rel:'noopener noreferrer'},'Source ↗')))));
  }
  section.append(el('p',{class:'review-note'},'An assessment checks documented commitments. It cannot guarantee accuracy, legal compliance or real-world behavior.'));
  return section;
}
function pendingBlock(){
  const pending=journal.pending();if(!pending.length)return null;
  return el('section',{class:'review-section'},el('h2',{},'Your review is processing'),el('p',{class:'progress-copy'},'We check its status automatically while this page is open. You can reconnect or disconnect your wallet; the same request stays saved. Do not submit it again.'),...pending.map(p=>{
    const input=el('input',{type:'text',placeholder:'Transaction hash from wallet activity','aria-label':'Transaction hash from wallet activity',maxLength:66});
    return el('div',{},p.hash?el('p',{class:'review-note'},'Reference: ',el('code',{},p.hash)):el('div',{},el('p',{},'The wallet did not return a reference. Open its activity and recover the existing transaction, without resubmitting.'),input),el('button',{class:'button',type:'button',disabled:busy,onclick:()=>work(async()=>{await checkEntry(p,input.value||undefined);})},p.hash?'Check status now':'Recover existing transaction'));
  }));
}
function render(){
  if(!catalog)return;
  const e=current?.evidence,p=e?.plan||selected?.plan,req=e?.requirements||selected?.requirements;
  $('#wallet-settings').hidden=!wallet?.account;$('#wallet-settings').disabled=busy;$('#wallet-settings').textContent=wallet?.account?'Wallet · '+wallet.account.slice(0,6)+'…'+wallet.account.slice(-4):'Wallet';
  if(!p){root.replaceChildren(...[el('div',{class:'review-heading'},el('div',{},el('p',{class:'eyebrow'},'EVIDENCE, SAVED FOR YOUR NEXT DECISION'),el('h1',{},'Provider reviews'))),pendingBlock(),history()].filter(Boolean));return;}
  const header=el('div',{class:'review-heading'},el('div',{class:'review-title'},el('span',{class:'review-title-mark','aria-hidden':'true'},p.initials),el('div',{},el('p',{class:'eyebrow'},'PROVIDER REVIEW'),el('h1',{},p.name),el('p',{},p.plan))),el('span',{class:'status-badge'},'Research only'));
  const facts=el('div',{class:'review-facts'},el('span',{},`${req.hours} audio hours / month`),el('span',{},`${money(req.budget)} budget`),req.noTraining?el('span',{},'No model training'):null,req.speakers?el('span',{},'Speaker labels'):null);
  const left=el('div',{class:'review-card'},el('section',{class:'review-section'},facts,el('p',{class:'review-note'},e?`Evidence captured ${date(e.capturedAt)}. This snapshot is saved in this browser.`:'Start with the provider’s public sources. No supplier outreach, reply links or wallet needed to save the evidence.'),!e?el('p',{class:'review-note'},'Capturing sends this plan and your requirements to Recall’s server to assemble the snapshot. Nothing is sent to Studio at this stage.'):null),pendingBlock());
  if(current)left.append(...[changes(current),findings(current),sourceDetails(e)].filter(Boolean));
  else left.append(el('section',{class:'review-section'},el('div',{class:'review-step'},el('span',{class:'section-number'},'01'),el('div',{},el('h2',{},'Capture the evidence'),el('p',{},'Save the current text from this plan’s official pricing and policy pages. You can inspect exactly what the review will use.'))),el('div',{class:'review-step'},el('span',{class:'section-number'},'02'),el('div',{},el('h2',{},'Get a documented assessment'),el('p',{},'Optionally ask GenLayer to check the captured terms. This needs one Studio wallet approval and makes the requirements and evidence public.'))),el('div',{class:'review-step'},el('span',{class:'section-number'},'03'),el('div',{},el('h2',{},'Revisit with context'),el('p',{},'Return later to capture a new review and see what changed. Each previous snapshot stays intact.')))));
  const out=current?outcome(current):null;
  const issue=out?.health&&out.health.status!=='completed';
  const issueSummary={legacy_unknown:'The original cause was not recorded. This is not a finding against the provider.',failed:'A technical problem prevented assessment. This is not a finding against the provider.',partial:'Some checks could not complete. Read each finding before drawing a conclusion.',evidence_incomplete:'A complete set of source text was not available. The provider was not assessed.'};
  const side=el('aside',{class:'review-card review-sidebar'},el('section',{class:'review-section'},el('h2',{},out?out.label:'Your next step'),out?el('span',{class:`status-badge ${out.status}`},current.session?out.health.badge:'Evidence saved'):null,
    issue?el('p',{class:'progress-copy'},issueSummary[out.health.status]):null,
    out?el('div',{},el('p',{class:'review-note'},'Catalog cost calculation · not a model quote'),
      el('div',{class:'cost'},el('strong',{},(p.pricing==='estimated'?'≈ ':'')+money(out.cost.estimate))),
      el('small',{},`${out.cost.costLabel} / month. ${out.cost.budgetLabel}.`)):
      el('p',{},'Capture a dated copy of the evidence. You decide whether to submit it for a public assessment.'),
    el('button',{class:'button primary',type:'button',disabled:busy||!!storageError||(!current?.session&&journal.pending().length>0),onclick:()=>issue?download(current):current?(current.session?newCapture():startAssessment()):newCapture()},busy?'Working…':issue?'Export saved review':current?(current.session?'Capture a new review':'Review with GenLayer'):'Capture evidence'),
    current?el('button',{class:'button',type:'button',disabled:busy,onclick:()=>issue?newCapture():download(current)},issue?'Start a separate review':'Export saved review'):null,
    issue?el('p',{class:'review-note'},'A separate review captures new evidence and keeps this record intact. Nothing is submitted to Studio without another wallet approval.'):null,
    current?el('details',{class:'review-source'},el('summary',{},'How this estimate works'),el('p',{class:'review-note'},p.priceNote)):null,
    current&&!current.session?el('button',{class:'text-button',type:'button',disabled:busy,onclick:newCapture},'Capture new evidence'):null,
    el('p',{class:'review-note'},'No order, supplier acceptance or payment. Recall does not control purchases on provider websites.')));
  if(current?.session)side.append(el('section',{class:'review-section'},el('h2',{},'Transaction confirmed'),el('small',{},'The transaction finalized and matches this saved evidence. This confirms execution, not the quality or completeness of the assessment. No provider payment was made.'),el('details',{class:'review-source'},el('summary',{},'Transaction details'),el('small',{},'Transaction: ',el('code',{},current.session.deployment)),el('small',{},'Evidence SHA-256: ',el('code',{},current.digest)),el('small',{},`Review format: v${current.session.state.version}`),...current.session.state.results.filter(r=>r.error_code).map(r=>el('small',{},`${r.id}: `,el('code',{},r.error_code))),out.health.status==='legacy_unknown'?el('small',{},'Diagnostic cause: not recorded by this older contract.'):null)));
  root.replaceChildren(header,el('div',{class:'review-grid'},left,side),history());
}
function newCapture(){return work(async()=>{
  const previous=current,choice=previous?{plan:previous.evidence.plan,requirements:previous.evidence.requirements}:selected;
  message('Reading the official sources and saving a new evidence snapshot…');
  const bundle=await reviewAPI({op:'capture',request:{planId:choice.plan.id,requirements:choice.requirements}});
  await validateCapture(bundle,catalog);
  const row={...bundle,id:crypto.randomUUID(),baselineId:previous?.id||null};store(row);nav(row.id);
  message('Evidence saved. Read it below or choose Review with GenLayer. Nothing has been submitted to Studio.');
});}
function walletSymbol(name){
  const paths={wallet:'M4 7V5a2 2 0 0 1 2-2h12v4 M4 7h16v14H4z M16 12h4v5h-4z',check:'m5 12 4 4L19 6',chevron:'m9 6 6 6-6 6',close:'m6 6 12 12 M18 6 6 18',disconnect:'M9 4H4v16h5 M9 12h12m-4-4 4 4-4 4'};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');
  for(const[k,v]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(k,v);
  path.setAttribute('d',paths[name]);svg.append(path);return svg;
}
function reviewWalletLogo(entry){
  const mark=el('span',{class:'review-wallet-logo','aria-hidden':'true'});
  if(entry?.icon)mark.append(el('img',{src:entry.icon,alt:'',width:32,height:32,referrerPolicy:'no-referrer',onerror:()=>mark.replaceChildren(walletSymbol('wallet'))}));
  else mark.append(walletSymbol('wallet'));
  return mark;
}
function walletChoices(after){
  const connected=!!wallet?.account,currentEntry=[...providers.values()].find(entry=>entry.provider===wallet?.provider);
  const body=el('div',{class:'wallet-picker'},el('p',{id:'wallet-picker-description'},connected?'Manage your connection to this review.':'Choose a wallet to continue. Connecting won’t submit your review.'));
  if(connected)body.append(el('div',{class:'wallet-picker-account'},reviewWalletLogo(currentEntry),el('div',{},el('strong',{},currentEntry?.name||'Browser wallet'),el('span',{},wallet.account.slice(0,6)+'…'+wallet.account.slice(-4))),el('span',{class:'wallet-connected-label'},'Connected')));
  if(!providers.size)body.append(el('div',{class:'wallet-picker-empty'},reviewWalletLogo(),el('strong',{},'No wallet detected'),el('p',{},'Open Recall in a browser with an Ethereum-compatible wallet extension. Your saved evidence will stay here.')));
  const choices=el('div',{class:'wallet-picker-list',role:'group','aria-label':connected?'Switch wallet':'Available wallets'});
  if(providers.size)body.append(el('p',{class:'wallet-picker-label'},connected?'Switch wallet':'Available wallets'),choices);
  // Keep the unbranded injected connection available, after named extensions.
  const entries=[...providers.values()].sort((a,b)=>Number(!a.announced)-Number(!b.announced));
  for(const entry of entries){const active=connected&&entry.provider===wallet.provider;
    choices.append(el('button',{class:'button review-wallet',type:'button','aria-label':entry.name,'aria-pressed':String(active),onclick:async()=>{
    close();await work(async()=>{wallet?.dispose();wallet=new Wallet(entry.provider,()=>{close();message('Wallet account or network changed. Reconnect before submitting. Your saved review is unchanged.');render();});await wallet.connect();
      const chain=await entry.provider.request({method:'eth_chainId'});if(BigInt(chain)!==BigInt(CHAIN_ID))await wallet.switchNetwork();
      message('Wallet connected to Studio. No review has been submitted.');});if(wallet?.account&&after)after();
  }},reviewWalletLogo(entry),el('span',{class:'review-wallet-name'},entry.name),el('span',{class:'review-wallet-state'},walletSymbol(active?'check':'chevron'))));}
  modal(connected?'Wallet settings':'Connect wallet',body);
  dialog.classList.add('wallet-dialog');dialog.setAttribute('aria-describedby','wallet-picker-description');
  dialog.querySelector('.close-dialog').replaceChildren(walletSymbol('close'));
  const footer=el('div',{class:'wallet-picker-footer'});
  if(connected)footer.append(el('button',{class:'button wallet-picker-disconnect',type:'button',onclick:()=>{wallet.dispose();wallet=null;close();render();message('Wallet disconnected from this review page. Extension permissions and saved transactions are unchanged.');}},walletSymbol('disconnect'),'Disconnect wallet'),el('p',{},'Disconnects this page only. Saved reviews stay.'));
  else footer.append(el('span',{class:'wallet-picker-network'},el('span',{'aria-hidden':'true'}),'GenLayer Studio · Test network'),el('p',{},'You’ll review any transaction before signing.'));
  $('#dialog-content').append(footer);
}
async function startAssessment(consentedId){
  if(consentedId!==current?.id){
    const id=current.id;
    modal('Before you share with GenLayer',el('p',{},'Recall will send this saved provider evidence, your selected requirements and your public wallet address to Studio to prepare the assessment. Preparation does not sign or broadcast a transaction.'),el('div',{class:'progress-copy'},'If you then approve in your wallet, the evidence and requirements are recorded publicly. Use public or test information only. This is not a provider purchase.'),el('div',{class:'actions'},el('button',{class:'button primary',type:'button',onclick:()=>{close();startAssessment(id);}},'Continue with public evidence'),el('button',{class:'button',type:'button',onclick:close},'Keep private for now')));
    return;
  }
  if(!wallet?.account){walletChoices(()=>startAssessment(consentedId));return;}
  await work(async()=>{
    const row=current;
    if(row.evidence.documents.some(d=>d.status!=='retrieved'||!d.complete))throw Error('Some source text is missing or incomplete. Read the available evidence or capture a new review before submitting to GenLayer.');
    config=await reviewAPI({op:'config'});
    const request={account:wallet.account,payload:row.payload},plan=await journal.review(request,config);
    modal('Review before submitting',el('p',{},`Assess ${row.evidence.plan.name} against your saved requirements.`),el('div',{class:'progress-copy'},'This makes your selected requirements and the captured public terms visible on GenLayer Studio. There is no provider purchase or payment. Do not submit confidential information.'),el('p',{},'Value sent: 0 test GEN · Network: Studio (61999)'),el('p',{class:'review-note'},'This preview supports the stable Studio compatibility router only. Zero transport gas is not a promise of zero protocol fees on other network versions. Review any wallet request before approving.'),el('details',{class:'review-source'},el('summary',{},'Exact evidence and contract'),el('pre',{class:'review-text',tabIndex:0},row.payload),el('small',{},'Review contract source SHA-256: ',el('code',{},plan.review.source_sha256))),el('p',{class:'review-note'},config.notice),el('div',{class:'actions'},el('button',{class:'button primary',type:'button',onclick:()=>{close();work(async()=>{
      if(current?.id!==row.id)throw Error('The selected review changed. Review it again.');
      message('Approve this review in your wallet. It will be submitted once.');
      const entry=await journal.send({wallet,plan,request,config,requestId:row.id});
      message('Review submitted. Waiting for GenLayer to finalize the result…');await checkEntry(entry);
    });}},'Approve in wallet'),el('button',{class:'button',type:'button',onclick:close},'Not now')));
  });
}
async function checkEntry(entry,recovery){
  const checked=entry.phase==='complete'?entry:await journal.check(entry.id,recovery);
  if(checked.phase==='failed'){message('The review failed on Studio. No provider payment was made. Your evidence remains saved.');return;}
  if(checked.phase!=='complete')return;
  const row=readReviews(localStorage).find(r=>r.id===checked.requestId);if(!row||row.session)return;
  const session=await reviewAPI({op:'inspect',deployment:checked.hash});
  if(!validSession(session,row,checked))throw Error('The result does not match the saved evidence. No assessment has been accepted.');
  const updated={...row,session};saveReview(localStorage,updated);rows=readReviews(localStorage);if(current?.id===row.id)current=updated;
  const health=reviewHealth(session.state);
  message(health.status==='completed'?'Assessment saved with its explanations and any supporting quotes.':`${health.label}. Your evidence and transaction receipt are saved. No provider payment was made.`);render();
}
const updates=new PurchaseUpdates({ready:()=>!document.hidden&&!busy&&!dialog.open&&!!catalog,read:async()=>{
  for(const entry of journal.entries().filter(e=>e.phase==='pending'||e.phase==='complete'))await checkEntry(entry);
  return 12000;
},onError:e=>message(e.message)});
async function route(){try{
  rows=readReviews(localStorage);const id=new URLSearchParams(location.hash.slice(1)).get('id');current=id?rows.find(r=>r.id===id):null;selected=id?null:selection(location.hash,catalog);
  if(current){await validateCapture(current,catalog);const entry=journal.entries().find(e=>e.requestId===current.id&&e.hash===current.session?.deployment);if(current.session&&(!entry||!validSession(current.session,current,entry)))throw Error('Saved assessment could not be verified against its receipt. Preserve the evidence and recheck the transaction.');}
  if(id&&!current)message('This review is not saved in this browser. Review links do not transfer your evidence.');render();
}catch(e){storageError=e.message;message(storageError);root.replaceChildren(el('a',{class:'button',href:'/compare'},'Return to comparison'));}}
window.addEventListener('hashchange',()=>{close();route();});
window.addEventListener('storage',e=>{if([REVIEWS,TRANSACTIONS,null].includes(e.key))route();});
window.addEventListener('eip6963:announceProvider',event=>registerWallet(providers,event.detail));
if(window.ethereum?.request)providers.set('injected',{name:'Browser wallet',provider:window.ethereum,icon:null});
window.dispatchEvent(new Event('eip6963:requestProvider'));
$('#wallet-settings').addEventListener('click',()=>walletChoices());
window.addEventListener('pagehide',()=>updates.stop());
try{const response=await fetch('/service-catalog.json',{cache:'no-store'});if(!response.ok)throw Error('Provider catalog unavailable.');catalog=await response.json();validateCatalog(catalog);await route();if(!storageError)message('');updates.start();}catch(e){message(e.message);}
