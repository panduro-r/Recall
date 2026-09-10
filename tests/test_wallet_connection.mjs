import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WalletConnection} from '../ui/wallet-connection.js';
const first='0x'+'1'.repeat(40),second='0x'+'2'.repeat(40);
function provider(request=async()=>[first]) {
  const calls=[],listeners=new Map();
  return {calls,listeners,request:async args=>{calls.push(args);return request(args);},
    on:(event,handler)=>listeners.set(event,handler),removeListener:(event,handler)=>{if(listeners.get(event)===handler)listeners.delete(event);},
    emit:(event,data)=>listeners.get(event)?.(data)};
}
test('connection is explicit, account access only, and reflects account changes',async()=>{
  const wallet=provider();let updates=0;const connection=new WalletConnection(()=>updates++);
  assert.equal(wallet.calls.length,0);assert.equal(connection.account,null);
  assert.equal(await connection.connect(wallet),true);assert.equal(connection.account,first);assert.equal(connection.busy,false);
  assert.deepEqual(wallet.calls,[{method:'eth_requestAccounts'}]);
  wallet.emit('accountsChanged',[second]);assert.equal(connection.account,second);
  wallet.emit('accountsChanged',[]);assert.equal(connection.account,null);assert.equal(wallet.listeners.size,0);assert.ok(updates>2);
});
test('disconnect and switching detach old providers; extension disconnect clears header',async()=>{
  const a=provider(),b=provider(async()=>[second]),connection=new WalletConnection();
  await connection.connect(a);const staleHandler=a.listeners.get('accountsChanged');
  await connection.connect(b);assert.equal(a.listeners.size,0);assert.equal(connection.account,second);
  staleHandler([first]);assert.equal(connection.account,second);
  b.emit('disconnect');assert.equal(connection.account,null);assert.equal(connection.provider,null);assert.equal(b.listeners.size,0);
  connection.disconnect();assert.deepEqual(b.calls,[{method:'eth_requestAccounts'}]);
});
test('pending duplicate requests are prevented and cancellation ignores a late response',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r),wallet=provider(()=>pending),connection=new WalletConnection();
  const result=connection.connect(wallet);assert.equal(connection.busy,true);
  assert.equal(await connection.connect(wallet),false);assert.equal(wallet.calls.length,1);
  connection.disconnect();resolve([first]);assert.equal(await result,false);
  assert.equal(connection.account,null);assert.equal(connection.provider,null);assert.equal(connection.busy,false);assert.equal(wallet.listeners.size,0);
});
test('a late cancelled failure cannot reset a newer connection',async()=>{
  let reject;const old=provider(()=>new Promise((_,r)=>reject=r)),fresh=provider(async()=>[second]),connection=new WalletConnection();
  const pending=connection.connect(old);connection.disconnect();await connection.connect(fresh);
  reject(Error('old failure'));assert.equal(await pending,false);assert.equal(connection.account,second);assert.equal(connection.provider,fresh);
});
test('invalid accounts and wallet errors are recoverable without retaining identity',async()=>{
  for(const response of [null,{},[],['bad'],['0x'+'0'.repeat(40)]]){
    const connection=new WalletConnection();await assert.rejects(connection.connect(provider(async()=>response)),/Could not connect/);
    assert.equal(connection.account,null);assert.equal(connection.busy,false);assert.equal(connection.provider,null);
  }
  for(const [code,message] of [[4001,/Connection cancelled/],[-32002,/already open/],[0,/Could not connect/]]){
    const connection=new WalletConnection();await assert.rejects(connection.connect(provider(async()=>{throw {code};})),message);
    assert.equal(connection.busy,false);await connection.connect(provider());assert.equal(connection.account,first);
  }
});
test('comparison connection cannot sign, switch networks, or alter saved data',()=>{
  for(const file of ['ui/wallet-connect.js','ui/wallet-connection.js']){
    const source=readFileSync(file,'utf8');
    assert.doesNotMatch(source,/eth_sendTransaction|personal_sign|eth_sign|wallet_switch|wallet_add|wallet_revoke|wallet\.js|commerce-ui|localStorage|sessionStorage|fetch\(|innerHTML/);
  }
  const html=readFileSync('ui/compare.html','utf8');
  assert.match(html,/class="header-actions"[\s\S]*id="saved-options"[\s\S]*id="connect-wallet"/);
  assert.match(html,/aria-labelledby="connection-title"/);
  assert.match(readFileSync('hosting/build.mjs','utf8'),/"wallet-connect.js","wallet-connection.js"/);
});
