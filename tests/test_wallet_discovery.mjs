import test from 'node:test';
import assert from 'node:assert/strict';
import {walletIcon,registerWallet,canRestoreWallet,rememberDisconnect,DISCONNECT_KEY} from '../ui/wallet-discovery.js';

const provider=()=>({request:async()=>[]});
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>');
const detail=(p=provider(),overrides={})=>({provider:p,info:{uuid:'test-wallet',name:'Example Wallet',icon:image,...overrides}});
test('wallet icons accept bounded data images, not remote or executable URLs',()=>{
  for(const value of [image,'data:image/png;base64,YQ==','data:image/webp;base64,YQ==','data:image/svg+xml;charset=utf-8,%3Csvg/%3E'])assert.equal(walletIcon(value),value);
  for(const value of [null,{},'',123,'https://tracker.example/icon.png','javascript:alert(1)','data:text/html,<script/>','data:image/svg+xml;other=1,<svg/>','data:image/svg+xml,','data:image/png;base64,'+'a'.repeat(262144)])assert.equal(walletIcon(value),null);
});
test('Phantom-style line-wrapped icon data is normalized without allowing external URLs',()=>{
  const png='data:image/png;base64,YQ==';
  for(const data of [png,image])assert.equal(walletIcon('\n \t'+data+'\r\n'),data);
  for(const data of ['\nhttps://tracker.example/icon.png\n','\ndata:text/html,<script/>\n','\njavascript:alert(1)\n','\n \t',' '.repeat(262144)+png])assert.equal(walletIcon(data),null);
  const providers=new Map();registerWallet(providers,detail(provider(),{name:'Phantom',icon:'\n'+png+'\n'}));
  assert.equal(providers.get('test-wallet').icon,png);
});
test('discovery upgrades injected metadata without creating a duplicate or changing provider',()=>{
  const p=provider(),providers=new Map([['injected',{provider:p,name:'Browser wallet'}]]);
  assert.equal(registerWallet(providers,detail(p)),'injected');
  assert.equal(providers.size,1);assert.equal(providers.get('injected').provider,p);
  assert.equal(providers.get('injected').icon,image);assert.equal(providers.get('injected').name,'Example Wallet');
  assert.equal(registerWallet(providers,detail(p,{uuid:'second-announcement',name:'Changed'})),null);
  assert.equal(providers.size,1);assert.equal(providers.get('injected').name,'Example Wallet');
});
test('different wallets remain selectable; identifier collisions cannot replace providers',()=>{
  const providers=new Map(),first=detail();registerWallet(providers,first);
  assert.equal(registerWallet(providers,detail()),null);assert.equal(providers.get('test-wallet').provider,first.provider);
  assert.equal(registerWallet(providers,detail(provider(),{uuid:'another-wallet'})),'another-wallet');assert.equal(providers.size,2);
});
test('bad metadata falls back without HTML rendering, control characters or remote icons',()=>{
  const providers=new Map();registerWallet(providers,detail(provider(),{name:'\u202eMy\u0000 Wallet',icon:'https://remote/icon'}));
  assert.equal(providers.get('test-wallet').name,'My Wallet');assert.equal(providers.get('test-wallet').icon,null);
  registerWallet(providers,detail(provider(),{uuid:'blank',name:{},icon:{}}));assert.equal(providers.get('blank').name,'Browser wallet');
  registerWallet(providers,detail(provider(),{uuid:'long',name:'a'.repeat(200)}));assert.equal(providers.get('long').name.length,80);
  for(const data of [null,{},detail({},{}),detail(provider(),{uuid:{}}),detail(provider(),{uuid:' '}),detail(provider(),{uuid:'a'.repeat(129)})])assert.equal(registerWallet(providers,data),null);
});
test('disconnect preference survives a new reader without touching transaction storage',()=>{
  const data=new Map([['recall.commerce.v2','pending transaction'],['recall.requests.v1','saved purchase']]);
  const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  assert.equal(canRestoreWallet(storage),true);assert.equal(rememberDisconnect(storage,true),true);
  assert.equal(canRestoreWallet(storage),false);assert.equal(data.get(DISCONNECT_KEY),'true');
  assert.equal(data.get('recall.commerce.v2'),'pending transaction');assert.equal(data.get('recall.requests.v1'),'saved purchase');
  assert.equal(rememberDisconnect(storage,false),true);assert.equal(canRestoreWallet(storage),true);
});
test('unavailable connection storage fails closed for automatic reconnection',()=>{
  const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(canRestoreWallet(denied),false);assert.equal(rememberDisconnect(denied,true),false);
  assert.equal(canRestoreWallet(undefined),false);assert.equal(rememberDisconnect(undefined,true),false);
});
