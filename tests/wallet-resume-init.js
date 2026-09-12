// Install before document scripts, in an isolated localhost browser only.
// Persist fixture authorization across reloads; never accesses an extension.
(() => {
  if(location.hostname!=='127.0.0.1')throw Error('Local wallet fixture only');
  const key='recall.qa.wallet.calls';
  const record=(wallet,method)=>{const calls=JSON.parse(sessionStorage.getItem(key)||'[]');calls.push({wallet,method,path:location.pathname});sessionStorage.setItem(key,JSON.stringify(calls));};
  function provider(name,account,flag){
    const listeners=new Map();
    return {[flag]:true,on:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},removeListener:(event,fn)=>listeners.get(event)?.delete(fn),
      emit:(event,value)=>{for(const fn of listeners.get(event)||[])fn(value);},
      request:async({method})=>{
        record(name,method);
        if(method==='eth_requestAccounts'){sessionStorage.setItem('recall.qa.authorized.'+name,'true');return [account];}
        if(method==='eth_accounts')return sessionStorage.getItem('recall.qa.locked')==='true'||sessionStorage.getItem('recall.qa.authorized.'+name)!=='true'?[]:[account];
        if(method==='eth_chainId')return '0xf22f';
        throw Error('Forbidden wallet call in connection fixture: '+method);
      }};
  }
  const selected=provider('Rabby','0x'+'1'.repeat(40),'isRabby'),other=provider('Other','0x'+'2'.repeat(40),'isMetaMask');
  Object.defineProperty(window,'ethereum',{configurable:true,value:other});
  const announce=(wallet,name,rdns)=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{provider:wallet,info:{uuid:crypto.randomUUID(),name,rdns,icon:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#6678ee"/><circle cx="16" cy="16" r="7" fill="white"/></svg>')}}}));
  const send=()=>{announce(other,'Other wallet','test.other');setTimeout(()=>announce(selected,'Rabby fixture','io.rabby'),250);};
  window.addEventListener('eip6963:requestProvider',send);send();
  window.walletResumeFixture={selected,other,calls:()=>JSON.parse(sessionStorage.getItem(key)||'[]')};
})();
