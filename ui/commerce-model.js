import {receiptMatches} from './wallet.js';
export const JOURNAL = 'recall.commerce.v2';
export const labels = {deploy:'Create Studio agreement',accept_terms:'Accept terms',evaluate_claim:'Assess supplier terms',queue_purchase:'Approve purchase',challenge_claim:'Report changed terms',resolve_challenge:'Assess changed terms',cancel_purchase:'Cancel purchase',publish_claim:'Offer a replacement',execute_purchase:'Pay supplier'};
export const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const equal = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function expectedArgs(action, fields) {
  switch(action) {
    case 'deploy':return [fields.seller,fields.title,fields.criterion,fields.budget_wei,fields.amount_wei,fields.terms];
    case 'accept_terms':return [];
    case 'publish_claim':return [fields.amount_wei,fields.terms];
    case 'challenge_claim':return [fields.offer_id,fields.terms];
    default:if (!(action in labels)) throw new Error('Unknown purchase action.'); return [fields.offer_id];
  }
}
export function matchesIntent(plan, request, config, session) {
  const review = plan?.review, fields = request.fields;
  if (!review || review.action !== request.action || !equal(review.account,request.account)
      || review.source_sha256 !== config.source_sha256 || review.chain_id !== 61999) return false;
  const args = expectedArgs(request.action,fields), actual = [...(review.args || [])];
  // The server converts addresses to checksum case, without changing their value.
  if (request.action === 'deploy' && equal(args[0],actual[0])) actual[0] = args[0];
  if (!same(args,actual)) return false;
  if (request.action !== 'deploy' && (!session || !equal(review.contract,session.contract))) return false;
  if (request.action === 'execute_purchase') {
    const selected = session.state.offers.find(o => o.id === fields.offer_id);
    return !!selected && equal(review.recipient,session.state.seller) && review.value_wei === selected.amount_wei;
  }
  return review.value_wei === '0';
}
export function paymentVerified(session, offer, entries) {
  if (offer.permit !== 'SCHEDULED') return false;
  return entries.some(entry => {
    try {
      const r=entry.review, tx=entry.receipt;
      return hash(entry.hash) && equal(entry.hash,tx.hash) && r.action==='execute_purchase'
        && equal(r.contract,session.contract) && equal(r.account,session.state.buyer)
        && same(r.args,[offer.id]) && equal(r.recipient,session.state.seller) && r.value_wei===offer.amount_wei
        && equal(tx.child?.triggered_by,tx.hash) && equal(tx.child?.from_address,session.contract)
        && tx.child?.status==='FINALIZED' && receiptMatches(tx,r);
    } catch { return false; }
  });
}
export function nextSteps(session,account,now=Date.now()/1000) {
  const s=session.state,o=s.offers.at(-1),buyer=equal(account,s.buyer),seller=equal(account,s.seller);
  const active=now<s.expires_at-5&&!s.paid,actions=[];
  const push=(action,label=labels[action])=>actions.push({action,label,fields:action==='accept_terms'?{}:{offer_id:o.id}});
  let title='Connect your wallet',detail='Read the terms below, then connect the buyer or supplier wallet to continue.';
  if(o.permit==='SCHEDULED')return {title:'Payment submitted',detail:'This approval has been consumed. Verify its recipient transfer below. Do not pay again.',actions};
  if(o.permit==='CANCELLED') {
    title='Purchase canceled';detail='No payment was sent for this offer. Its approval cannot be reused.';
    if(active&&s.accepted&&s.offers.length<3&&now+905<s.expires_at) {
      detail+=' The supplier can propose a replacement, with its own assessment and review period.';
      if(seller)push('publish_claim');
    }
  } else if(!active) {title='Agreement expired';detail='Payment is disabled. The buyer can still cancel the unpaid offer.';}
  else if(!s.accepted) {title='Waiting for supplier acceptance';detail='The supplier must approve these exact conditions and their initial offer with their wallet.';if(seller)push('accept_terms');}
  else if(o.status==='PENDING') {
    title='Ready to assess';detail='Ask GenLayer to compare the supplier’s documented commitments with your conditions. This does not prove real-world delivery.';
    if(buyer&&now+905<s.expires_at)push('evaluate_claim');
    else if(now+905>=s.expires_at)detail='There is not enough time left for a new assessment. The buyer can cancel.';
  } else if(o.status==='DISPUTED') {
    title='Payment blocked · Terms changed';detail='Assess the original terms together with the reported amendment before proceeding.';
    if((buyer||seller)&&now+5<o.review_until+300)push('resolve_challenge');
    else if(now+5>=o.review_until+300)detail='The assessment deadline has passed. The buyer can cancel this unpaid offer.';
  } else if(o.status==='VALID') {
    title=o.permit==='RESERVED'?'Purchase approved':'Terms support your conditions';
    detail=o.permit==='RESERVED'?'The approval reserves budget, not funds. Payment needs a separate buyer signature.':'The assessment supports the documented commitments. Approving reserves budget but sends no funds.';
    if(buyer&&o.permit==='NONE')push('queue_purchase');
    if(buyer&&o.permit==='RESERVED'&&now>=o.review_until+5)push('execute_purchase');
    if((buyer||seller)&&!o.counter_terms&&now+5<o.review_until)push('challenge_claim');
  } else {title='Payment blocked';detail=o.status==='INVALID'?'The terms do not meet the buyer’s conditions. Cancel this offer before requesting a replacement.':'The terms could not be assessed conclusively. This offer cannot be approved or paid.';}
  if(buyer&&['NONE','RESERVED'].includes(o.permit))push('cancel_purchase');
  return {title,detail,actions};
}
export async function api(data) {
  const response=await fetch('/api/commerce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(45000)});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Studio is unavailable. No transaction was sent by the server.');
  return result;
}
export class Commerce {
  constructor({storage,call=api,locks,now=()=>Date.now(),id=()=>crypto.randomUUID()}) {
    Object.assign(this,{storage,call,locks,now,id});this.busy=false;
  }
  entries() {
    let rows;
    try {rows=JSON.parse(this.storage.getItem(JOURNAL)||'[]');}catch{throw new Error('Transaction history cannot be read. Signing is blocked; preserve browser data and check wallet activity.');}
    if(!Array.isArray(rows)||rows.length>200||rows.some(r=>!r||typeof r.id!=='string'||!r.review||!(r.review.action in labels)||!['pending','complete','failed','rejected'].includes(r.phase)||!['string','undefined'].includes(typeof r.hash)))throw new Error('Transaction history is invalid. Signing is blocked.');
    return rows;
  }
  persist(entry) {
    const rows=this.entries(), next=[entry,...rows.filter(r=>r.id!==entry.id)];
    if(next.length>200)throw new Error('Transaction history is full. Signing is blocked to preserve recovery records.');
    this.storage.setItem(JOURNAL,JSON.stringify(next));
  }
  pending() {return this.entries().filter(e=>e.phase==='pending');}
  async review(request,config,session) {
    if(this.busy||this.pending().length)throw new Error('Check the outstanding transaction before preparing another action.');
    const plan=await this.call({op:'prepare',request});
    if(!matchesIntent(plan,request,config,session))throw new Error('The prepared action does not match this purchase. Nothing was submitted.');
    return plan;
  }
  async send({wallet,plan,request,config,session,requestId}) {
    if(this.busy)throw new Error('A wallet request is already in progress.');
    if(!this.locks?.request)throw new Error('Use a secure browser with Web Locks support to prevent duplicate submissions across tabs.');
    this.busy=true;
    try {
      return await this.locks.request('recall-commerce-signing',{ifAvailable:true},async lock=>{
        if(!lock||this.pending().length)throw new Error('A transaction is active in this browser. Check its status before continuing.');
        if(!matchesIntent(plan,request,config,session))throw new Error('The review changed. Prepare it again.');
        const entry={id:this.id(),review:plan.review,requestId:requestId||null,deployment:request.deployment||null,phase:'pending',created_at:this.now()};
        let attempted=false;
        try {
          const result=await wallet.approve(plan,async()=>{
            const fresh=await this.call({op:'prepare',request});
            if(!matchesIntent(fresh,request,config,session))throw new Error('The refreshed review changed. Nothing was submitted.');
            return fresh;
          },()=>{this.persist(entry);attempted=true;});
          if(!hash(result))throw new Error('Wallet did not return a usable hash. Check wallet activity before proceeding.');
          entry.hash=result.toLowerCase();this.persist(entry);return entry;
        } catch(error) {
          if(attempted&&error.code===4001){entry.phase='rejected';this.persist(entry);}
          // Every other post-request failure stays pending, even if the wallet
          // returned no hash. Never silently clear an uncertain submission.
          throw error;
        }
      });
    } finally {this.busy=false;}
  }
  async check(id,recoveryHash) {
    const entry=this.entries().find(e=>e.id===id);
    if(!entry)throw new Error('Transaction record not found.');
    const candidate=recoveryHash||entry.hash;
    if(!hash(candidate))throw new Error('Copy the full transaction hash from wallet activity. Do not submit the action again.');
    const row=await this.call({op:'receipt',hash:candidate.toLowerCase()});
    if(!equal(row.hash,candidate))throw new Error('The returned receipt does not match the requested transaction.');
    if(recoveryHash&&!receiptMatches(row,entry.review))throw new Error('This recovery hash is not yet a finalized successful match for the reviewed action. Nothing was replaced.');
    entry.hash=candidate.toLowerCase();entry.receipt=row;entry.checked_at=this.now();
    try {if(receiptMatches(row,entry.review))entry.phase='complete';}catch{/* Incomplete receipts remain pending. */}
    if(!recoveryHash&&row.status==='FINALIZED'&&row.execution==='ERROR')entry.phase='failed';
    this.persist(entry);return entry;
  }
}
