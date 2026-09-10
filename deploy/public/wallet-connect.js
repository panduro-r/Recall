import {registerWallet} from './wallet-discovery.js';
import {WalletConnection} from './wallet-connection.js';

const $=selector=>document.querySelector(selector);
const trigger=$('#connect-wallet'),providers=new Map();
let dialog=$('#connection-dialog');
const paths={wallet:'M4 7V5a2 2 0 0 1 2-2h12v4 M4 7h16v14H4z M16 12h4v5h-4z',close:'m6 6 12 12 M18 6 6 18',chevron:'m9 6 6 6-6 6',check:'m5 12 4 4L19 6',disconnect:'M9 4H4v16h5 M9 12h12m-4-4 4 4-4 4'};
const short=account=>`${account.slice(0,6)}…${account.slice(-4)}`;
function el(tag,className,text) {
  const node=document.createElement(tag);if(className)node.className=className;
  if(text!==undefined)node.textContent=text;return node;
}
function symbol(name) {
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}))svg.setAttribute(key,value);
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);svg.append(path);return svg;
}
function logo(entry) {
  const container=el('span','connection-logo');
  if(entry?.icon){const img=el('img');img.src=entry.icon;img.alt='';img.addEventListener('error',()=>container.replaceChildren(symbol('wallet')),{once:true});container.append(img);}
  else container.append(symbol('wallet'));
  return container;
}
// Pages with transaction flows bind their existing wallet controller here.
// The header must never maintain a second, unrelated signing identity.
let adapter=null;
const connection=new WalletConnection(render);
function state(){return adapter?adapter.state():connection;}
export function updateWalletHeader(){if(trigger)render();}
export function bindWalletHeader(next){
  if(!trigger)return ()=>{};
  if(typeof window.ethereum?.request==='function'&&![...providers.values()].some(p=>p.provider===window.ethereum))providers.set('injected',{name:'Browser wallet',provider:window.ethereum,icon:null});
  const previous=connection.account&&[...providers.values()].find(p=>p.provider===connection.provider);
  connection.disconnect();adapter=next;render();
  if(previous)next.adopt?.(previous);
  return ()=>{if(adapter===next){adapter=null;dialog.close();render();}};
}
function createDialog(){
  const node=el('dialog','connection-dialog');node.id='connection-dialog';
  node.setAttribute('aria-labelledby','connection-title');node.setAttribute('aria-describedby','connection-description');
  const shell=el('div','connection-shell'),heading=el('header','connection-heading');
  const title=el('h2',null,'Connect your wallet');title.id='connection-title';
  const close=el('button');close.id='connection-close';close.type='button';close.setAttribute('aria-label','Close wallet settings');heading.append(title,close);
  const body=el('div','connection-body'),description=el('p',null,'Connecting requests account access only. No review, signature or payment is submitted.');description.id='connection-description';
  const account=el('div');account.id='connection-account';account.hidden=true;
  const choices=el('div');choices.id='connection-choices';const status=el('p');status.id='connection-status';status.setAttribute('role','status');
  body.append(description,account,el('p','connection-label','Available wallets'),choices,status);
  const footer=el('footer','connection-footer'),disconnect=el('button','button','Disconnect wallet');footer.hidden=true;disconnect.id='connection-disconnect';disconnect.type='button';
  footer.append(disconnect,el('p',null,'Disconnects this page. Saved records and wallet permissions stay unchanged.'));
  shell.append(heading,body,footer);node.append(shell);document.body.append(node);return node;
}
function status(text){$('#connection-status').textContent=text;}
function render() {
  if(!trigger||!dialog)return;
  const current=state(),entry=[...providers.values()].find(p=>p.provider===current.provider);
  const {account,busy}=current;
  trigger.disabled=!!adapter&&!!busy;
  trigger.replaceChildren(account?logo(entry):symbol('wallet'),el('span',null,account?short(account):'Connect wallet'));
  trigger.classList.toggle('is-connected',!!account);
  trigger.setAttribute('aria-label',account?`Wallet settings, ${entry?.name||'Browser wallet'}, ${short(account)}`:'Connect wallet');
  if(account)trigger.append(el('span','connection-dot'));
  $('#connection-title').textContent=account?'Your wallet':'Connect your wallet';
  const profile=$('#connection-account');profile.hidden=!account;profile.replaceChildren();
  if(account){
    const identity=el('div','connection-identity');identity.append(logo(entry),el('strong',null,entry?.name||'Browser wallet'),el('span','connection-badge','Connected'));
    profile.append(identity,el('p','connection-address',account));
  }
  // Keep keyboard focus when a wallet announces itself after the dialog opens.
  const focused=document.activeElement?.dataset?.wallet;
  const choices=$('#connection-choices');choices.replaceChildren();
  for(const [id,wallet] of [...providers].sort((a,b)=>Number(!a[1].announced)-Number(!b[1].announced))){
    const selected=!!account&&wallet.provider===current.provider;
    const button=el('button','connection-choice');button.type='button';button.dataset.wallet=id;button.disabled=busy;
    button.setAttribute('aria-pressed',String(selected));
    button.append(logo(wallet),el('span','connection-name',wallet.name),symbol(selected?'check':'chevron'));
    button.addEventListener('click',async()=>{
      status(`Check ${wallet.name} to allow account access.`);
      try{if(await (adapter?adapter.connect(wallet):connection.connect(wallet.provider))){status('Wallet connected. No transaction submitted.');dialog.close();}}
      catch(error){status(error.message);}
      finally{render();}
    });choices.append(button);
  }
  if(!providers.size)choices.append(el('p','connection-empty','No wallet detected. Open Recall in a browser with an Ethereum-compatible wallet extension. Comparing and saving still work without one.'));
  if(focused&&dialog.open)[...choices.children].find(node=>node.dataset.wallet===focused)?.focus();
  $('.connection-footer').hidden=!account&&!busy;
  $('#connection-disconnect').textContent=busy?'Cancel connection':'Disconnect wallet';
  $('#connection-disconnect').disabled=!!adapter&&!!busy;
  if(adapter&&busy)$('#connection-disconnect').textContent='Waiting for wallet…';
  $('#connection-disconnect').prepend(symbol('disconnect'));
}
if(trigger){
if(!dialog)dialog=createDialog();
trigger.addEventListener('click',()=>{if(!state().busy)status('');render();dialog.showModal();trigger.setAttribute('aria-expanded','true');$('#connection-close').focus();});
$('#connection-close').append(symbol('close'));
$('#connection-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');trigger.focus();});
$('#connection-disconnect').addEventListener('click',()=>{
  const busy=state().busy;if(adapter)adapter.disconnect();else connection.disconnect();render();
  status(busy?'Connection cancelled on this page. You can dismiss the open wallet prompt.':'Wallet disconnected. Your saved options are unchanged.');
});
window.addEventListener('eip6963:announceProvider',event=>{if(registerWallet(providers,event.detail))render();});
if(typeof window.ethereum?.request==='function')providers.set('injected',{name:'Browser wallet',provider:window.ethereum,icon:null});
window.dispatchEvent(new Event('eip6963:requestProvider'));
render();
}
