import {Wallet} from './wallet.js';
import {Commerce,api,labels,hash,nextSteps,paymentVerified} from './commerce-model.js';
import {wei,formatWei,offer as checkOffer} from './workspace-model.js';

// Reuse the workspace's semantic elements and visual vocabulary. No automatic
// wallet connection, signature, funding, polling, or transaction resubmission.
export function mountCommerce(host,{el,button,row=null,deployment=null}) {
  let live=true,working=false,wallet=null,config=null,session=null,preview=null,error='',notice='';
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
  function walletControls() {
    const panel=block(el('h2',{},wallet?.account?'Connected wallet':'Connect when you’re ready'));
    if(!providers.size) {
      panel.append(el('p',{class:'subtle'},'Open this page in a browser with your wallet extension. You can read everything here without a wallet. Never share a seed phrase or private key.'));
      return panel;
    }
    const select=el('select',{'aria-label':'Available wallet',disabled:working||!!preview});
    for(const [id,p] of providers)select.append(el('option',{value:id,selected:id===selected},p.name));
    select.addEventListener('change',()=>{selected=select.value;wallet?.dispose();wallet=null;preview=null;draw();});
    const controls=el('div',{},select);
    if(wallet?.account)controls.append(el('p',{class:'wallet-address'},wallet.account));
    controls.append(el('div',{class:'actions'},control(wallet?.account?'Reconnect wallet':'Connect wallet',async()=>{
      if(!wallet)wallet=new Wallet(providers.get(selected).provider,()=>{preview=null;notice='The wallet account or network changed. Reconnect before preparing another action.';if(live)draw();});
      await wallet.connect();notice='Account connected. Switch to Studio before signing.';
    }),control('Switch to Studio',async()=>{
      if(!wallet)throw new Error('Connect your wallet first.');await wallet.switchNetwork();notice='Studio selected · Test GEN only.';
    })));
    if(wallet?.account)panel.append(el('details',{},el('summary',{},`${wallet.account.slice(0,8)}…${wallet.account.slice(-6)} · Wallet settings`),controls));
    else panel.append(controls);
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
    const panel=block(el('h2',{},'Review before signing'),
      el('p',{class:'subtle'},'Only the request below will be sent. Studio uses its zero-address transaction router; this is not a normal token transfer to that address.'),
      detail('Action',labels[r.action]),detail('Signing account',r.account),detail('Network','GenLayer Studio · 61999'),
      detail('Value sent',`${formatWei(r.value_wei)} test GEN`),detail('Payment recipient',r.recipient||'No payment in this action'),
      terms('Exact arguments, contract and source',JSON.stringify({contract:r.contract,args:r.args,source_sha256:r.source_sha256,transport_gas_price:0},null,2)));
    panel.append(el('div',{class:'actions'},control('Approve in wallet',async()=>{
      const entry=await controller.send({wallet,plan,request,config,session,requestId:row?.id});
      preview=null;extra=null;notice='Transaction submitted. Check its result below; do not submit it again.';
      // No automatic second transaction or background receipt loop.
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
    const statePanel=block(el('p',{class:'subtle'},s.title),el('h2',{},step.title),el('p',{},step.detail));
    if(current.review_until&&current.permit!=='CANCELLED')statePanel.append(detail('Payment opens (includes safety margin)',date(current.review_until+5)));
    statePanel.append(el('p',{class:'subtle'},`Finalized state read ${date(session.observed_at)}. Refresh to check another person’s actions.`));
    if(!preview&&!extra) {
      const actions=el('div',{class:'actions'});
      step.actions.forEach((item,i)=>actions.append(control(item.label,async()=>{
        if(['challenge_claim','publish_claim'].includes(item.action)){extra=item;return;}
        await prepare(item.action,item.fields);
      },i===0&&item.action!=='cancel_purchase')));
      if(!s.accepted)actions.append(control('Copy agreement link',async()=>{
        try{await navigator.clipboard.writeText(url);notice='Agreement link copied. Send it to the supplier to accept with their wallet.';}
        catch{notice='Open Agreement details below to select and copy the supplier link.';}
      }));
      actions.append(control('Refresh state',refresh));statePanel.append(actions);
    }
    const offers=block(el('h2',{},'Offer history'));
    for(const o of s.offers) {
      const paid=paymentVerified(session,o,entries);
      const state=o.permit==='SCHEDULED'?(paid?'Paid · Recipient transfer verified':'Submitted · Transfer not yet verified here'):o.permit==='CANCELLED'?'Canceled':o.status==='VALID'?'Terms supported':o.status==='DISPUTED'?'Change under review':o.status==='INVALID'?'Terms not supported':o.status==='UNKNOWN'?'Assessment inconclusive':'Not assessed';
      offers.append(el('div',{class:'offer-record'},detail(`${o.id} · ${formatWei(o.amount_wei)} test GEN`,state),
        o.judgment?el('p',{class:'subtle'},o.judgment.reason):null,terms('Supplier terms',o.terms),o.counter_terms?terms('Reported amendment',o.counter_terms):null));
    }
    return [statePanel,offers,el('div',{class:'block'},el('details',{},el('summary',{},'Agreement details and supplier link'),panel))];
  }
  function transactions() {
    const entries=controller.entries();
    const relevant=entries.filter(e=>e.phase==='pending'||(row&&e.requestId===row.id)||(deployment&&(e.deployment===deployment||e.hash===deployment)));
    if(!relevant.length)return null;
    const panel=block(el('h2',{},'Transaction activity'));
    for(const entry of relevant) {
      const title=entry.phase==='complete'?(entry.review.action==='execute_purchase'?'Finalized · Recipient transfer matched':'Finalized · Execution matched'):entry.phase==='failed'?'Finalized · Execution failed':entry.phase==='rejected'?'Rejected in wallet':entry.hash?'Awaiting verification':'Outcome uncertain · Check wallet activity';
      const line=el('div',{class:'offer-record'},el('h3',{},labels[entry.review.action]),el('p',{class:'status-line'},title));
      if(entry.hash)line.append(el('code',{class:'wallet-address'},entry.hash));
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
      if(entry.phase==='pending')panel.append(line);
      else panel.append(el('details',{},el('summary',{},`${labels[entry.review.action]} · ${title}`),line));
    }
    return panel;
  }
  function draw() {
    if(!live)return;
    host.replaceChildren();host.setAttribute('aria-busy',String(working));
    if(error)host.append(el('p',{class:'error',role:'alert'},error));
    if(notice)host.append(el('p',{class:'notice',role:'status'},notice));
    if(!config){host.append(el('p',{class:'status-line'},'Loading Studio configuration…'));return;}
    const sheet=el('section',{class:'sheet'},block(el('p',{class:'subtle'},'Custom-purchase Studio preview · Public terms · Up to 0.100 test GEN. This new contract version still needs its first wallet-approved Studio validation.')));
    try {
      const pending=controller.pending();
      if(pending.length)sheet.append(block(el('h2',{},'Check your outstanding transaction'),el('p',{},'Signing is paused until the earlier result is known. Check its receipt below. Missing hashes must be recovered from wallet activity, not resubmitted.')));
      sheet.append(walletControls());
      if(session)sheet.append(...agreementPanel());
      else if(deployment)sheet.append(block(el('h2',{},'Agreement not loaded'),control('Retry loading agreement',refresh,true)));
      else if(row?.reply) {
        const reply=checkOffer(row.reply);
        sheet.append(block(el('h2',{},'Create your Studio agreement'),el('p',{},'Your connected wallet becomes the buyer. The supplier must then sign their acceptance. Creating this agreement sends no payment.'),
          control('Review agreement creation',async()=>prepare('deploy',{seller:reply.seller,title:reply.request.title,criterion:reply.request.conditions.join('\n'),budget_wei:wei(reply.request.budget),amount_wei:wei(reply.price),terms:reply.terms}),true)));
      }
      if(extra&&!preview)sheet.append(extraForm(extra.action,extra.fields));
      if(preview)sheet.append(previewPanel());
      const activity=transactions();if(activity)sheet.append(activity);
      if(working||pending.length)for(const b of sheet.querySelectorAll('button'))b.disabled=working||!['Check receipt','Check recovery hash','Refresh state','Retry loading agreement','Copy agreement link'].includes(b.textContent);
      if(working)for(const input of sheet.querySelectorAll('input,textarea,select'))input.disabled=true;
    }catch(e){sheet.append(block(el('p',{class:'error',role:'alert'},e.message)));}
    host.append(sheet);
  }
  const changed=event=>{if(event.key==='recall.commerce.v2'||event.key===null){preview=null;notice='Transaction history changed in another tab. Refresh before continuing.';if(live&&!working)draw();}};
  window.addEventListener('storage',changed);
  draw();
  (async()=>{
    try{const candidate=await api({op:'config'});if(candidate.version!==2||candidate.chain_id!==61999||!/^[a-f0-9]{64}$/.test(candidate.source_sha256))throw new Error('Unexpected Studio configuration.');config=candidate;await refresh();}
    catch(e){error=e.message;if(!config&&live){host.replaceChildren(el('p',{class:'error',role:'alert'},error),button('Retry configuration',()=>{dispose();mountCommerce(host,{el,button,row,deployment});}));return;}}
    if(live)draw();
  })();
  function dispose(){live=false;wallet?.dispose();window.removeEventListener('eip6963:announceProvider',announce);window.removeEventListener('storage',changed);}
  return dispose;
}
