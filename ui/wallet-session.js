// A per-tab preference, never an authorization or a stored signing identity.
// EIP-6963 UUIDs last for one page; rdns is the stable selection hint.
import {DISCONNECT_KEY} from './wallet-discovery.js';
export const WALLET_CHOICE_KEY='recall.wallet.choice.v1';
const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)&&!/^0x0{40}$/i.test(value);
const rdns=value=>typeof value==='string'&&value.length<=253&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
const legacyFlags=['isRabby','isPhantom','isBackpack','isBraveWallet','isOkxWallet','isOKXWallet','isKeplr','isCoinbaseWallet','isMetaMask'];
function legacy(entry){return legacyFlags.find(flag=>entry?.provider?.[flag]===true)||null;}
function hint(entry){return rdns(entry?.rdns)?{kind:'rdns',id:entry.rdns}:legacy(entry)?{kind:'legacy',id:legacy(entry)}:null;}
function valid(value){return value&&Object.keys(value).sort().join(',')==='id,kind'&&((value.kind==='rdns'&&rdns(value.id))||(value.kind==='legacy'&&legacyFlags.includes(value.id)));}

export class WalletPreference {
  constructor(storage){this.storage=storage;this.version=0;this.blocked=false;}
  store(){try{return typeof this.storage==='function'?this.storage():this.storage;}catch{return null;}}
  cancel(){this.version++;}
  read(){
    try{const store=this.store();if(this.blocked||!store||store.getItem(DISCONNECT_KEY)==='true')return null;
      const value=JSON.parse(store.getItem(WALLET_CHOICE_KEY)||'null');return valid(value)?value:null;
    }catch{return null;}
  }
  remember(entry){
    this.cancel();this.blocked=false;
    try{const store=this.store();store.setItem(WALLET_CHOICE_KEY,JSON.stringify(hint(entry)));store.setItem(DISCONNECT_KEY,'false');return true;}catch{return false;}
  }
  disconnect(){
    this.cancel();this.blocked=true;
    try{const store=this.store();store.setItem(DISCONNECT_KEY,'true');store.removeItem(WALLET_CHOICE_KEY);return true;}catch{return false;}
  }
  candidate(providers){
    const saved=this.read();if(!saved)return null;
    const matches=[...providers.values()].filter(entry=>saved.kind==='rdns'?entry.rdns===saved.id:legacy(entry)===saved.id);
    const unique=[...new Map(matches.map(entry=>[entry.provider,entry])).values()];
    return unique.length===1?unique[0]:null;
  }
}

export class WalletRestorer {
  constructor(preference,providers,apply,eligible=()=>true){this.preference=preference;this.providers=providers;this.apply=apply;this.eligible=eligible;this.tried=new WeakSet();this.timer=null;this.version=0;this.disposed=false;}
  consider(){if(this.disposed)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.attempt(),150);}
  async attempt(){
    if(this.disposed||!this.eligible())return false;
    const entry=this.preference.candidate(this.providers);if(!entry||this.tried.has(entry.provider))return false;
    this.tried.add(entry.provider);
    const version=this.version,choiceVersion=this.preference.version,saved=JSON.stringify(this.preference.read());let timeout,invalidated=false;
    const changed=()=>{invalidated=true;},events=['accountsChanged','chainChanged','disconnect'];
    try{
      for(const event of events)entry.provider.on?.(event,changed);
      // Silent permission check only. Never request access, switch a chain,
      // prepare a transaction or fall back to a different installed wallet.
      const accounts=await Promise.race([Promise.resolve().then(()=>entry.provider.request({method:'eth_accounts'})),new Promise(resolve=>{timeout=setTimeout(()=>resolve(null),4000);})]);
      if(invalidated||this.disposed||version!==this.version||choiceVersion!==this.preference.version||saved!==JSON.stringify(this.preference.read())||this.preference.candidate(this.providers)?.provider!==entry.provider||!this.eligible()||!Array.isArray(accounts)||!address(accounts[0]))return false;
      this.apply(entry,accounts[0]);return true;
    }catch{return false;}finally{clearTimeout(timeout);for(const event of events){try{entry.provider.removeListener?.(event,changed);}catch{/* A broken extension must not interrupt page startup. */}}}
  }
  pause(){this.version++;clearTimeout(this.timer);}
  resume(){if(this.disposed)return;this.pause();this.tried=new WeakSet();this.consider();}
  dispose(){this.disposed=true;this.pause();}
}
export const walletPreference=new WalletPreference(()=>window.sessionStorage);
