import {Wallet} from './wallet.js';
import {Commerce,PurchaseUpdates,api,labels,hash,nextSteps,paymentVerified} from './commerce-model.js';
import {wei,formatWei,offer as checkOffer} from './workspace-model.js';

// Reuse the workspace's semantic elements and visual vocabulary. No automatic
// permission request, signature, funding, or transaction resubmission.
export function mountCommerce(host,{el,button,row=null,deployment=null}) {
  let live=true,working=false,wallet=null,config=null,session=null,preview=null,error='',notice='';
  let chain=null,identityVersion=0,updateError='';
  const providers=new Map();let selected='';
  const controller=new Commerce({storage:localStorage,locks:navigator.locks});
  const equal=(a,b)=>a?.toLowerCase()===b?.toLowerCase();
  const date=value=>new Date(value*1000).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'});
  function announce(event) {
    const info=event.detail?.info,provider=event.detail?.provider;
    if(info?.uuid&&provider?.request&&!providers.has(info.uuid)){providers.set(info.uuid,{name:info.name,provider});if(!selected)selected=info.uuid;if(live&&!working&&!preview)draw();}
  }
  window.addEventListener('eip6963:announceProvider',announce);
  if(window.ethereum?.request){providers.set('injected',{name:'Browser wallet',provider:window.ethereum});selected='injected';}
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  function safe(fn) {return async()=>{
    if(working)return;working=true;error='';draw();
    try{await fn();}catch(e){error=e.message||'The action could not be completed. Check transaction history before retrying.';}
    finally{working=false;if(live)draw();}
  };}
  function control(label,fn,primary=false){const b=button(label,safe(fn),primary);b.disabled=working;return b;}
  function signingControl(label,fn,primary=false){const b=control(label,fn,primary);b.dataset.signing='true';return b;}
  function detail(label,value){return el('div',{class:'summary-row'},el('span',{},label),el('strong',{},String(value)));}
  function block(...children){return el('div',{class:'block'},...children);}
  function terms(title,value){return el('details',{},el('summary',{},title),el('pre',{class:'terms'},value));}
  async function refresh() {
    if(!deployment&&row) {
      const created=controller.entries().find(e=>e.requestId===row.id&&e.review.action==='deploy'&&e.phase==='complete');
      if(created)deployment=created.hash;
    }
    if(deployment)session=await api({op:'inspect',deployment});
  }
  async function syncWallet() {
    const current=wallet,version=++identityVersion;
    if(!current)return;
    const [accounts,network]=await Promise.all([current.provider.request({method:'eth_accounts'}),current.provider.request({method:'eth_chainId'})]);
    if(!live||current!==wallet||version!==identityVersion)return;
    current.account=/^0x[0-9a-f]{40}$/i.test(accounts?.[0]||'')?accounts[0]:null;
    chain=BigInt(network)===61999n;
  }
  function useWallet() {
    if(wallet)return;
    wallet=new Wallet(providers.get(selected).provider,()=>{
      preview=null;chain=null;
      syncWallet().then(()=>{notice='';if(live&&!working)draw();}).catch(()=>{if(live&&!working)draw();});
    });
  }
  function walletControls() {
    const account=wallet?.account,s=session?.state;
    const role=account?(s?(equal(account,s.buyer)?'Buyer':equal(account,s.seller)?'Supplier':'Different account'):(equal(account,row?.reply?.seller)?'Supplier':'Buyer')):null;
    const panel=block(el('h2',{},account?`Connected as ${role.toLowerCase()}`:'Connect to continue'));
    if(!providers.size) {
      panel.append(el('p',{class:'subtle'},'Open this page in a browser with your wallet extension. You can read everything here without a wallet. Never share a seed phrase or private key.'));
      return panel;
    }
    const select=el('select',{'aria-label':'Available wallet',disabled:working||!!preview});
    for(const [id,p] of providers)select.append(el('option',{value:id,selected:id===selected},p.name));
    select.addEventListener('change',()=>{selected=select.value;wallet?.dispose();wallet=null;chain=null;identityVersion++;preview=null;draw();});
    const controls=el('div',{},select);
    if(wallet?.account)controls.append(el('p',{class:'wallet-address'},wallet.account));
    controls.append(el('div',{class:'actions'},control(wallet?.account?'Reconnect wallet':'Connect wallet',async()=>{
      useWallet();await wallet.connect();await syncWallet();notice='';
    },!account)));
    if(account){
      panel.append(el('p',{class:'subtle'},`${account.slice(0,8)}…${account.slice(-6)} · ${chain?'Studio test network':'Network change needed'}`));
      if(!chain)panel.append(control('Use Studio test network',async()=>{await wallet.switchNetwork();await syncWallet();notice='';},true));
      panel.append(el('details',{},el('summary',{},'Change wallet or account'),el('p',{class:'subtle'},'Select the other account in your wallet extension. Recall detects the change automatically; it never switches accounts or signs for you.'),controls));
      if(s&&role==='Different account')panel.append(el('p',{class:'notice'},'This account is not a participant. Select the buyer or supplier account listed in Purchase details.'));
    }else panel.append(el('p',{class:'subtle'},'Connecting identifies your role. It does not approve terms or send money.'),controls);
    return panel;
  }
  async function prepare(action,fields) {
    if(!wallet?.account)throw new Error('Connect the required wallet first.');
    await wallet.assertIdentity(wallet.account);
    if(deployment)await refresh();
    const request={account:wallet.account,action,fields,...(deployment?{deployment}:{})};
    const plan=await controller.review(request,config,session);
    preview={plan,request};
  }
  function previewPanel() {
    const {plan,request}=preview,r=plan.review;
    const panel=block(el('h2',{},r.action==='execute_purchase'?'Confirm payment':'Confirm this step'),
      el('p',{class:'subtle'},r.action==='execute_purchase'?`You will send ${formatWei(r.value_wei)} test GEN to the supplier. Check the recipient before approving.`:r.action==='cancel_purchase'?'This permanently cancels the selected offer and releases its reserved budget. No payment is sent.':r.action==='queue_purchase'?'This records your approval and reserves budget. Your funds stay in your wallet; paying is a separate step.':'Your wallet will ask you to approve this action. No payment is sent.'),
      detail('Action',labels[r.action]),detail('Signing account',r.account),detail('Network','GenLayer Studio · 61999'),
      detail('Value sent',`${formatWei(r.value_wei)} test GEN`),detail('Payment recipient',r.recipient||'No payment in this action'),
      terms('Technical transaction details',`Studio uses a zero-address transaction router, not a normal transfer to that address.\n${JSON.stringify({contract:r.contract,args:r.args,source_sha256:r.source_sha256,transport_gas_price:0},null,2)}`));
    panel.append(el('div',{class:'actions'},signingControl('Approve in wallet',async()=>{
      const entry=await controller.send({wallet,plan,request,config,session,requestId:row?.id});
      preview=null;extra=null;notice='';updates.queue(0);
      // Verification is automatic; a second transaction never is.
      if(!hash(entry.hash))throw new Error('Inspect wallet activity for the submitted transaction.');
    },true),control('Discard review',async()=>{preview=null;})));
    return panel;
  }
  function extraForm(action,fields) {
    const panel=block(el('h2',{},labels[action]));
    const textarea=el('textarea',{required:true,minLength:30,maxLength:6000,rows:5,value:extra?.terms||'','aria-label':action==='publish_claim'?'Replacement terms':'Amended terms',placeholder:'Paste the public terms, including the order they apply to and what changed.',oninput:event=>{if(extra)extra.terms=event.target.value;}});
    const price=el('input',{inputMode:'decimal',value:extra?.price||'',maxLength:8,'aria-label':'Replacement price in test GEN',placeholder:'0.040',oninput:event=>{if(extra)extra.price=event.target.value;}});
    if(action==='publish_claim')panel.append(el('label',{class:'field'},el('span',{},'Replacement price · test GEN'),price));
    panel.append(el('label',{class:'field'},el('span',{},action==='publish_claim'?'Replacement terms':'Amended terms'),textarea),
      el('p',{class:'subtle'},'30–6,000 characters. Public text only. Clearly identify which offer or order these terms apply to.'));
    // Capture input before a redraw disables/replaces controls.
    const review=button('Review action',()=>{
      const text=textarea.value.trim(),priceValue=price.value;
      safe(async()=>{
        if(text.length<30||text.length>6000)throw new Error('Use 30–6,000 characters for the public terms.');
        await prepare(action,action==='publish_claim'?{amount_wei:wei(priceValue),terms:text}:{...fields,terms:text});
      })();
    },true);
    review.dataset.signing='true';
    panel.append(el('div',{class:'actions'},review,button('Back to purchase',()=>{extra=null;draw();})));
    return panel;
  }
  let extra=null;
  function agreementPanel() {
    const s=session.state,current=s.offers.at(-1),step=nextSteps(session,wallet?.account),entries=controller.entries();
    if(paymentVerified(session,current,entries)){step.title='Supplier paid';step.detail=`The finalized recipient transfer matches ${formatWei(current.amount_wei)} test GEN to the supplier. This verifies the Studio transfer, not real-world service delivery.`;}
    const panel=block(el('h2',{},s.title),detail('Maximum budget',`${formatWei(s.budget_wei)} test GEN`),
      terms('Buyer’s conditions',s.criterion),detail('Buyer wallet',s.buyer),detail('Supplier wallet',s.seller),
      detail('Agreement expires',date(s.expires_at)));
    const url=`${location.origin}/workspace#agreement=${deployment}`;
    const input=el('input',{readOnly:true,value:url,'aria-label':'Studio agreement link'});
    panel.append(el('label',{class:'field'},el('span',{},'Share with your supplier'),input),control('Copy agreement link',async()=>{
      try{await navigator.clipboard.writeText(url);notice='Agreement link copied. The supplier can open it and connect their own wallet.';}
      catch{notice='Automatic copying is unavailable. Select and copy the agreement link above.';}
    }));
    const statePanel=block(!row?el('p',{class:'subtle'},s.title):null,el('h2',{},step.title),el('p',{},step.detail));
    statePanel.classList.add('next-step');
    if(current.judgment&&['VALID','INVALID','UNKNOWN'].includes(current.status))statePanel.append(el('p',{class:'assessment-reason'},current.judgment.reason));
    if(current.review_until&&current.permit!=='CANCELLED'&&current.permit!=='SCHEDULED') {
      const remaining=Math.max(0,current.review_until+5-Math.floor(Date.now()/1000));
      statePanel.append(el('p',{class:'review-clock'},remaining?`Review period: about ${Math.ceil(remaining/60)} min remaining. Payment becomes available automatically at ${date(current.review_until+5)}.`:'The review period has ended. Payment is available only while the terms remain supported.'));
    }
    if(!wallet?.account)statePanel.append(el('p',{class:'notice'},'Connect your wallet below to see your next action.'));
    else if(!step.actions.some(a=>!['cancel_purchase','challenge_claim'].includes(a.action))&&!s.paid&&current.permit!=='SCHEDULED') {
      const expected=!s.accepted||current.permit==='CANCELLED'?s.seller:s.buyer;
      if(!equal(wallet.account,expected))statePanel.append(el('p',{class:'role-help'},`Next action: ${equal(expected,s.buyer)?'buyer':'supplier'} account ${expected.slice(0,8)}…${expected.slice(-6)}. This page updates when they finish.`));
    }
    if(!preview&&!extra) {
      const actions=el('div',{class:'actions'});
      const other=el('details',{class:'other-actions'},el('summary',{},'Change or cancel this purchase'));
      step.actions.forEach(item=>{
        const secondary=['challenge_claim','cancel_purchase'].includes(item.action);
        const b=signingControl(item.label,async()=>{
        if(['challenge_claim','publish_claim'].includes(item.action)){extra=item;return;}
        await prepare(item.action,item.fields);
        },!secondary);
        b.disabled=working||!wallet?.account||!chain;
        (secondary?other:actions).append(b);
      });
      if(!s.accepted)actions.append(control('Copy agreement link',async()=>{
        try{await navigator.clipboard.writeText(url);notice='Agreement link copied. Send it to the supplier to accept with their wallet.';}
        catch{notice='Open Agreement details below to select and copy the supplier link.';}
      }));
      statePanel.append(actions);if(other.children.length>1)statePanel.append(other);
    }
    const offers=block(el('h2',{},'Offer history'));
    for(const o of s.offers) {
      const paid=paymentVerified(session,o,entries);
      const state=o.permit==='SCHEDULED'?(paid?'Paid · Recipient transfer verified':'Submitted · Transfer not yet verified here'):o.permit==='CANCELLED'?'Canceled':o.status==='VALID'?'Terms supported':o.status==='DISPUTED'?'Change under review':o.status==='INVALID'?'Terms not supported':o.status==='UNKNOWN'?'Assessment inconclusive':'Not assessed';
      offers.append(el('div',{class:'offer-record'},detail(`${o.id} · ${formatWei(o.amount_wei)} test GEN`,state),
        o.judgment?el('p',{class:'subtle'},o.judgment.reason):null,terms('Supplier terms',o.terms),o.counter_terms?terms('Reported amendment',o.counter_terms):null));
    }
    const progress=el('ol',{class:'purchase-progress','aria-label':'Purchase progress'});
    const stage=paymentVerified(session,current,entries)?4:!s.accepted?0:current.status==='PENDING'?1:current.permit==='NONE'||current.status==='DISPUTED'?2:3;
    ['Agreement','Check terms','Approval','Payment'].forEach((name,i)=>progress.append(el('li',{'aria-current':i===stage?'step':'false',class:i<stage?'done':i===stage?'current':''},`${i<stage?'✓ ':''}${name}`)));
    statePanel.prepend(progress);
    return [statePanel,el('div',{class:'block'},el('details',{},el('summary',{},'Offer history and assessments'),offers)),el('div',{class:'block'},el('details',{},el('summary',{},'Purchase details and supplier link'),panel))];
  }
  function transactions() {
    const entries=controller.entries();
    const relevant=entries.filter(e=>e.phase==='pending'||(row&&e.requestId===row.id)||(deployment&&(e.deployment===deployment||e.hash===deployment)));
    if(!relevant.length)return null;
    const panel=block(el('h2',{},'Transaction activity'));
    for(const entry of relevant) {
      const title=entry.phase==='complete'?(entry.review.action==='execute_purchase'?'Payment verified':'Completed'):entry.phase==='failed'?'Transaction failed':entry.phase==='rejected'?'Declined in wallet':entry.hash?'Confirming automatically. No need to submit again.':'Wallet result missing. Check wallet activity before continuing.';
      const line=el('div',{class:'offer-record'},el('h3',{},labels[entry.review.action]),el('p',{class:'status-line'},title));
      if(entry.hash)line.append(terms('Transaction reference',entry.hash));
      if(entry.phase==='pending'||entry.phase==='complete') {
        const input=entry.hash?null:el('input',{'aria-label':'Recovery transaction hash',placeholder:'0x… transaction hash from wallet activity'});
        if(input)line.append(el('label',{class:'field'},el('span',{},'Recover the submitted transaction'),input));
        line.append(button(entry.hash?'Check receipt':'Check recovery hash',()=>{
          const candidate=input?.value.trim();
          safe(async()=>{
            const checked=await controller.check(entry.id,candidate);
            if(checked.phase==='complete'&&checked.review.action==='deploy')deployment=checked.hash;
            if(deployment)await refresh();
            if(checked.phase==='complete')preview=null;
            notice=checked.phase==='complete'?'Receipt matched the reviewed action.':checked.phase==='failed'?'Execution failed. No successful action was established.':'No finalized matching success yet. Do not submit again.';
          })();
        }));
      }
      if(entry.receipt?.child)line.append(terms('Recipient transfer details',JSON.stringify(entry.receipt.child,null,2)));
      panel.append(el('details',{open:entry.phase==='pending'},el('summary',{},`${labels[entry.review.action]} · ${title}`),line));
    }
    return panel;
  }
  function draw() {
    if(!live)return;
    host.replaceChildren();host.setAttribute('aria-busy',String(working));
    if(error)host.append(el('p',{class:'error',role:'alert'},error));
    if(notice)host.append(el('p',{class:'notice',role:'status'},notice));
    if(!config){host.append(el('p',{class:'status-line'},'Loading Studio configuration…'));return;}
    const sheet=el('section',{class:'sheet'});
    try {
      const pending=controller.pending();
      if(pending.length){
        const missing=pending.some(e=>!hash(e.hash));
        sheet.append(block(el('h2',{},missing?'Recover your wallet result':`Confirming ${labels[pending[0].review.action].toLowerCase()}`),el('p',{},missing?'Your wallet did not return a transaction reference. Open Transaction activity below and paste the hash from your wallet. Do not submit again.':'You can keep this page open. Recall checks the result automatically before enabling the next transaction. You can still connect or change accounts.')));
      }
      let agreement=[];if(session)agreement=agreementPanel();
      if(session&&!preview&&!extra)sheet.append(agreement[0]);
      sheet.append(walletControls());
      if(session){} 
      else if(deployment)sheet.append(block(el('h2',{},'Agreement not loaded'),control('Retry loading agreement',refresh,true)));
      else if(row?.reply) {
        const reply=checkOffer(row.reply);
        sheet.append(block(el('h2',{},'Create your Studio agreement'),el('p',{},'Your connected wallet becomes the buyer. The supplier must then sign their acceptance. Creating this agreement sends no payment.'),
          signingControl('Review agreement creation',async()=>prepare('deploy',{seller:reply.seller,title:reply.request.title,criterion:reply.request.conditions.join('\n'),budget_wei:wei(reply.request.budget),amount_wei:wei(reply.price),terms:reply.terms}),true)));
      }
      if(extra&&!preview)sheet.append(extraForm(extra.action,extra.fields));
      if(preview)sheet.append(previewPanel());
      if(session)sheet.append(...agreement.slice(1));
      const activity=transactions();if(activity)sheet.append(activity);
      for(const b of sheet.querySelectorAll('button'))if(working||b.dataset.signing)b.disabled=working||!!pending.length||!wallet?.account||!chain;
      if(working)for(const input of sheet.querySelectorAll('input,textarea,select'))input.disabled=true;
      sheet.append(block(el('p',{class:'subtle',role:'status'},updateError||'Status updates automatically while this page is open.'),control('Check status now',async()=>{await checkUpdates();}),el('details',{},el('summary',{},'About this test purchase'),el('p',{class:'subtle'},'Studio preview · Test GEN only. This new flow is still being validated. Assessments compare public written terms; they do not prove service delivery. Each transaction needs your wallet approval.'))));
    }catch(e){sheet.append(block(el('p',{class:'error',role:'alert'},e.message)));}
    host.append(sheet);
  }
  async function checkUpdates(){
    for(const entry of controller.pending().filter(e=>hash(e.hash))) {
      if(!live)return 12000;
      const checked=await controller.check(entry.id);
      if(checked.phase==='complete'&&checked.review.action==='deploy'&&(!row||checked.requestId===row.id))deployment=checked.hash;
    }
    if(live)await refresh();updateError='';
    return controller.pending().length?4000:12000;
  }
  const updates=new PurchaseUpdates({ready:()=>live&&!!config&&!working&&!preview&&!extra&&document.visibilityState!=='hidden'&&!(host.contains(document.activeElement)&&document.activeElement?.matches('input,textarea,select')),read:async()=>{
    const before=JSON.stringify([session?.state,controller.entries().map(e=>[e.id,e.phase]),updateError,nextStepsSafe()]);
    const delay=await checkUpdates();
    if(live&&!working&&!preview&&!extra&&before!==JSON.stringify([session?.state,controller.entries().map(e=>[e.id,e.phase]),updateError,nextStepsSafe()]))draw();
    return delay;
  },onError:()=>{updateError='Live status is temporarily unavailable. Your progress is saved; Recall will retry without resubmitting.';if(live&&!working&&!preview&&!extra)draw();}});
  function nextStepsSafe(){return session?nextSteps(session,wallet?.account).actions.map(a=>a.action):[];}
  const changed=event=>{if(event.key==='recall.commerce.v2'||event.key===null){preview=null;notice='';if(live&&!working)draw();updates.queue(0);}};
  window.addEventListener('storage',changed);
  draw();
  (async()=>{
    try{const candidate=await api({op:'config'});if(!live)return;if(candidate.version!==2||candidate.chain_id!==61999||!/^[a-f0-9]{64}$/.test(candidate.source_sha256))throw new Error('Unexpected Studio configuration.');config=candidate;await refresh();if(live&&providers.size){useWallet();await syncWallet();}}
    catch(e){error=e.message;if(!config&&live){host.replaceChildren(el('p',{class:'error',role:'alert'},error),button('Retry configuration',()=>{dispose();mountCommerce(host,{el,button,row,deployment});}));return;}}
    if(live){draw();updates.start();}
  })();
  function dispose(){live=false;updates.stop();identityVersion++;wallet?.dispose();window.removeEventListener('eip6963:announceProvider',announce);window.removeEventListener('storage',changed);}
  return dispose;
}
