export const CHAIN_ID = "0xf22f";
export const NEXT_CHAIN_ID = "0xf22d";
export const NEXT_ROUTER = "0xb7278A61aa25c888815aFC32Ad3cC52fF24fE575";
export function formatTestGen(wei) {
  if(typeof wei!=='string'||!/^\d+$/.test(wei))throw new Error('Invalid test GEN amount.');
  const n=BigInt(wei),fraction=(n%1000000000000000000n).toString().padStart(18,'0').replace(/0+$/,'');
  return (n/1000000000000000000n).toString()+(fraction?'.'+fraction:'');
}
export const ZERO = "0x" + "0".repeat(40);
export const ACTIONS = ["deploy", "accept_terms", "publish_claim", "evaluate_claim", "queue_purchase", "challenge_claim", "resolve_challenge", "cancel_purchase", "execute_purchase"];
const address = value => typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value) && value.toLowerCase() !== ZERO;

// Canonical SDK 0.19 fee-aware deployment envelope. No arbitrary method,
// destination, contract value, child-payment allocation or trailing ABI data.
function validateNextEnvelope(tx, review, account) {
  const reject=()=>{throw new Error("Unexpected Studio Next fee envelope.");};
  if(tx.chainId!==NEXT_CHAIN_ID||tx.to!==NEXT_ROUTER||review.router!==NEXT_ROUTER||tx.gasPrice!=="0x0"||review.action!=="deploy"||review.contract!==ZERO||review.recipient!==""||review.value_wei!=="0")reject();
  if(!/^[0-9]+$/.test(review.protocol_fee_wei)||BigInt(review.protocol_fee_wei)<=0n||BigInt(review.protocol_fee_wei)>50000000000000000n||BigInt(tx.value)!==BigInt(review.protocol_fee_wei))reject();
  if(!/^0x35a251fb(?:[0-9a-f]{64})+$/i.test(tx.data))reject();
  const data=tx.data.slice(10),word=byte=>{const s=data.slice(byte*2,byte*2+64);if(s.length!==64)reject();return BigInt('0x'+s);};
  if(word(0)!==32n||word(32)!==BigInt(account)||word(64)!==0n||word(96)!==5n||word(128)!==3n||[160,192,224].some(i=>word(i)!==0n))reject();
  if(word(256)!==320n||word(288)!==704n)reject();
  const d=review.fee_distribution,keys=['leaderTimeunitsAllocation','validatorTimeunitsAllocation','appealRounds','executionBudgetPerRound','executionConsumed','totalMessageFees',null,'maxPriceGenPerTimeUnit','storageFeeMaxGasPrice','receiptFeeMaxGasPrice'];
  if(!d||!Array.isArray(d.rotations)||d.rotations.length!==1||d.rotations[0]!=="3")reject();
  keys.forEach((key,i)=>{if(word(352+i*32)!==(key===null?320n:BigInt(d[key]??(key==='executionConsumed'?'0':'-1'))))reject();});
  if(word(416)!==0n||word(480)!==0n||word(512)!==0n||word(672)!==1n||word(704)!==3n)reject();
  const length=word(736);if(length<=0n||length>400000n)reject();
  const padded=Math.ceil(Number(length)/32)*32,allocation=768+padded;
  if(word(320)!==BigInt(allocation-32)||word(allocation)!==0n||data.length/2!==allocation+32)reject();
  if(!/^0*$/.test(data.slice((768+Number(length))*2,allocation*2)))reject();
}

export function validatePrepared(plan, account) {
  const tx = plan?.transaction, review = plan?.review;
  if (!tx || !review || !ACTIONS.includes(review.action) || !address(account)) throw new Error("Invalid wallet request.");
  if (!Number.isFinite(plan.prepared_at) || !/^[0-9a-f]{64}$/i.test(plan.intent_id || "")) throw new Error("Incomplete transaction review.");
  if (Object.keys(tx).some(key=>!["from","to","chainId","value","data","gasPrice","gas","nonce"].includes(key))) throw new Error("Unexpected transaction fields.");
  const next=review.chain_id===61997;
  if(next)validateNextEnvelope(tx,review,account);
  else if (tx.chainId !== CHAIN_ID || review.chain_id !== 61999 || tx.to !== ZERO || tx.gasPrice !== "0x0") throw new Error("Only the verified Studio routing is supported.");
  if (!address(tx.from) || !address(review.account) || tx.from.toLowerCase() !== account.toLowerCase() || review.account.toLowerCase() !== account.toLowerCase()) throw new Error("The connected account changed. Review again.");
  if (!/^0x[0-9a-f]+$/i.test(tx.data) || !/^0x[0-9a-f]+$/i.test(tx.gas) || !/^0x[0-9a-f]+$/i.test(tx.nonce)) throw new Error("Malformed unsigned transaction.");
  const value = BigInt(tx.value);
  if (!next&&(value !== BigInt(review.value_wei) || value < 0n || value > 100000000000000000n || (review.action !== "execute_purchase" && value !== 0n))) throw new Error("Unexpected payment value.");
  if (!next&&value > 0n && !address(review.recipient)) throw new Error("A payment recipient is required.");
  if (Date.now() / 1000 - plan.prepared_at > 45 || plan.prepared_at > Date.now() / 1000 + 5) throw new Error("The review expired. Prepare it again.");
  return tx;
}

export class Wallet {
  constructor(provider, changed = () => {}) {
    this.provider = provider;
    this.account = null;
    this.busy = false;
    this.changed = () => { this.account = null; changed(); };
    provider.on?.("accountsChanged", this.changed);
    provider.on?.("chainChanged", this.changed);
    provider.on?.("disconnect", this.changed);
  }
  dispose() { for (const event of ["accountsChanged", "chainChanged", "disconnect"]) this.provider.removeListener?.(event, this.changed); }
  async connect() {
    const accounts = await this.provider.request({method:"eth_requestAccounts"});
    if (!address(accounts?.[0])) throw new Error("No account was selected.");
    this.account = accounts[0];
    return this.account;
  }
  async switchNetwork(chainId=CHAIN_ID) {
    if(![CHAIN_ID,NEXT_CHAIN_ID].includes(chainId))throw new Error("Unsupported review network.");
    const next=chainId===NEXT_CHAIN_ID;
    try { await this.provider.request({method:"wallet_switchEthereumChain",params:[{chainId}]}); }
    catch (error) {
      if (error.code !== 4902) throw error;
      await this.provider.request({method:"wallet_addEthereumChain",params:[{chainId,chainName:next?"GenLayer Studio Next":"GenLayer Studio",nativeCurrency:{name:"Test GEN",symbol:"GEN",decimals:18},rpcUrls:[next?"https://studio-dev.genlayer.com/api":"https://studio.genlayer.com/api"]}]});
      await this.provider.request({method:"wallet_switchEthereumChain",params:[{chainId}]});
    }
    return this.connect();
  }
  async assertIdentity(account,expectedChain=CHAIN_ID) {
    const chain = await this.provider.request({method:"eth_chainId"});
    const accounts = await this.provider.request({method:"eth_accounts"});
    if (BigInt(chain) !== BigInt(expectedChain)) throw new Error(`Switch your wallet to ${expectedChain===NEXT_CHAIN_ID?'Studio Next (61997)':'GenLayer Studio (61999)'}, then review again.`);
    if (!accounts?.[0] || accounts[0].toLowerCase() !== account.toLowerCase()) throw new Error("Wallet account changed. Reconnect and review again.");
  }
  async approve(preview, refresh, beforeSend = () => {}) {
    if (this.busy) throw new Error("A wallet request is already in progress.");
    const account = this.account;
    validatePrepared(preview, account);
    this.busy = true;
    try {
      await this.assertIdentity(account,preview.transaction.chainId);
      const fresh = await refresh();
      const tx = validatePrepared(fresh, account);
      if (fresh.intent_id !== preview.intent_id || tx.data !== preview.transaction.data || tx.value !== preview.transaction.value) throw new Error("The action changed. Review the updated request first.");
      await this.assertIdentity(account,preview.transaction.chainId);
      beforeSend();
      // Exactly one submission. Rejections and uncertain outcomes are never retried.
      const hash = await this.provider.request({method:"eth_sendTransaction",params:[tx]});
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("Wallet returned no usable transaction hash. Inspect wallet activity before retrying.");
      return hash;
    } finally { this.busy = false; }
  }
}

export function receiptMatches(row, review) {
  if (!review || row.status !== "FINALIZED" || row.execution !== "SUCCESS") return false;
  if((row.chain_id??61999)!==(review.chain_id??61999))return false;
  if(review.chain_id===61997&&row.protocol_fee_deposit_wei!==review.protocol_fee_wei)return false;
  if (row.consensus_result !== undefined && !["AGREE", "MAJORITY_AGREE"].includes(row.consensus_result)) return false;
  if (row.from?.toLowerCase() !== review.account.toLowerCase() || BigInt(row.value_wei) !== BigInt(review.value_wei)) return false;
  if (review.action === "deploy") return row.source_sha256 === review.source_sha256 && JSON.stringify(row.args) === JSON.stringify(review.args);
  if (row.to?.toLowerCase() !== review.contract.toLowerCase() || row.method !== review.action || JSON.stringify(row.args) !== JSON.stringify(review.args)) return false;
  if (BigInt(review.value_wei) === 0n) return true;
  return row.settlement === "child-finalized" && row.child?.to_address.toLowerCase() === review.recipient.toLowerCase()
    && BigInt(row.child.value) === BigInt(review.value_wei);
}

// Presentation only: retain raw permit state and require matching payment proof.
// A saved 'complete' flag or SCHEDULED permit alone is never payment evidence.
export function verifiedPermitPayment(permit, session, entries) {
  if (permit?.status !== "SCHEDULED") return false;
  return entries.some(entry => {
    try {
      const r=entry.review, row=entry.receipt;
      return r?.action === "execute_purchase" && r.contract.toLowerCase() === session.contract.toLowerCase()
        && r.account.toLowerCase() === session.snapshot.agreement.buyer.toLowerCase()
        && JSON.stringify(r.args) === JSON.stringify([permit.id])
        && r.recipient.toLowerCase() === permit.recipient.toLowerCase()
        && BigInt(r.value_wei) === BigInt(permit.amount_wei)
        && entry.hash === row.hash && row.child?.triggered_by === row.hash
        && row.child?.status === "FINALIZED" && row.child.from_address.toLowerCase() === session.contract.toLowerCase()
        && receiptMatches(row,r);
    } catch { return false; }
  });
}

export function paymentWindow(claim, expiry, now=Date.now()/1000) {
  const opens=claim.review_until+5;
  if(now>=expiry-5)return {state:"expired",opens};
  return {state:now<opens?"waiting":"open",opens};
}
