export const CHAIN_ID = "0xf22f";
export const ZERO = "0x" + "0".repeat(40);
export const ACTIONS = ["deploy", "accept_terms", "publish_claim", "evaluate_claim", "queue_purchase", "challenge_claim", "resolve_challenge", "cancel_purchase", "execute_purchase"];
const address = value => typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value) && value.toLowerCase() !== ZERO;

export function validatePrepared(plan, account) {
  const tx = plan?.transaction, review = plan?.review;
  if (!tx || !review || !ACTIONS.includes(review.action) || !address(account)) throw new Error("Invalid wallet request.");
  if (!Number.isFinite(plan.prepared_at) || !/^[0-9a-f]{64}$/i.test(plan.intent_id || "")) throw new Error("Incomplete transaction review.");
  if (Object.keys(tx).some(key=>!["from","to","chainId","value","data","gasPrice","gas","nonce"].includes(key))) throw new Error("Unexpected transaction fields.");
  if (tx.chainId !== CHAIN_ID || review.chain_id !== 61999 || tx.to !== ZERO || tx.gasPrice !== "0x0") throw new Error("Only the verified gasless Studio routing is supported.");
  if (!address(tx.from) || !address(review.account) || tx.from.toLowerCase() !== account.toLowerCase() || review.account.toLowerCase() !== account.toLowerCase()) throw new Error("The connected account changed. Review again.");
  if (!/^0x[0-9a-f]+$/i.test(tx.data) || !/^0x[0-9a-f]+$/i.test(tx.gas) || !/^0x[0-9a-f]+$/i.test(tx.nonce)) throw new Error("Malformed unsigned transaction.");
  const value = BigInt(tx.value);
  if (value !== BigInt(review.value_wei) || value < 0n || value > 100000000000000000n || (review.action !== "execute_purchase" && value !== 0n)) throw new Error("Unexpected payment value.");
  if (value > 0n && !address(review.recipient)) throw new Error("A payment recipient is required.");
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
  async switchNetwork() {
    try { await this.provider.request({method:"wallet_switchEthereumChain",params:[{chainId:CHAIN_ID}]}); }
    catch (error) {
      if (error.code !== 4902) throw error;
      await this.provider.request({method:"wallet_addEthereumChain",params:[{chainId:CHAIN_ID,chainName:"GenLayer Studio",nativeCurrency:{name:"Test GEN",symbol:"GEN",decimals:18},rpcUrls:["https://studio.genlayer.com/api"]}]});
      await this.provider.request({method:"wallet_switchEthereumChain",params:[{chainId:CHAIN_ID}]});
    }
    return this.connect();
  }
  async assertIdentity(account) {
    const chain = await this.provider.request({method:"eth_chainId"});
    const accounts = await this.provider.request({method:"eth_accounts"});
    if (BigInt(chain) !== BigInt(CHAIN_ID)) throw new Error("Switch your wallet to GenLayer Studio (61999), then review again.");
    if (!accounts?.[0] || accounts[0].toLowerCase() !== account.toLowerCase()) throw new Error("Wallet account changed. Reconnect and review again.");
  }
  async approve(preview, refresh, beforeSend = () => {}) {
    if (this.busy) throw new Error("A wallet request is already in progress.");
    const account = this.account;
    validatePrepared(preview, account);
    this.busy = true;
    try {
      await this.assertIdentity(account);
      const fresh = await refresh();
      const tx = validatePrepared(fresh, account);
      if (fresh.intent_id !== preview.intent_id || tx.data !== preview.transaction.data || tx.value !== preview.transaction.value) throw new Error("The action changed. Review the updated request first.");
      await this.assertIdentity(account);
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
