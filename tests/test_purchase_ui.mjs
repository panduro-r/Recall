import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import vm from "node:vm";
import {verifiedPermitPayment, paymentWindow} from "../ui/wallet.js";

// Run the real controller with a minimal DOM/provider harness. FormData models
// successful controls: fields under a disabled fieldset are omitted.
async function controller({rejectPrepare=false,savedJournal=null,liveSession=null}={}) {
  const elements=new Map(), requests=[], walletCalls=[];
  const buyer="0x"+"1".repeat(40);
  const fields={seller:" 0x"+"2".repeat(40)+" ",agent:"0x"+"3".repeat(40),challenger:"0x"+"4".repeat(40)};
  function element(id) {
    if(!elements.has(id))elements.set(id,{
      value:"",disabled:false,hidden:false,options:[],textContent:"",
      children:[],addEventListener(){},scrollIntoView(){},append(...children){this.children.push(...children);},
      querySelector(){return element("action-submit");},
      replaceChildren(...children){this.options=children;if(!this.value)this.value=children[0]?.value||"";}
    });
    return elements.get(id);
  }
  const context=vm.createContext({
    console,Date,JSON,Map,Event,AbortSignal,setTimeout,clearTimeout,
    amount:String,humanize:String,displayName:c=>[c.id],receiptMatches:()=>false,verifiedPermitPayment,paymentWindow,
    document:{getElementById:element,createElement:()=>element(Symbol())},
    window:{ethereum:{request(){}},addEventListener(){},dispatchEvent(){}},
    localStorage:{getItem:()=>JSON.stringify(savedJournal),setItem(){}},
    FormData:class {
      constructor(form){assert.equal(form,element("deploy-form"));this.entries=element("deploy-fields").disabled?[]:Object.entries(fields);}
      [Symbol.iterator](){return this.entries[Symbol.iterator]();}
    },
    Wallet:class {
      async connect(){this.account=buyer;}
      async assertIdentity(account){assert.equal(account,buyer);}
      async approve(){walletCalls.push("approve");}
      dispose(){}
    },
    async fetch(path,options) {
      if(path==="/api/session/config")return {ok:true,json:async()=>({offers:[],criterion:"EU only",evidence:{},source_root:"https://example.test/"})};
      if(path==="/api/session/inspect")return {ok:true,json:async()=>liveSession};
      assert.equal(path,"/api/session/prepare");
      const request=JSON.parse(options.body);requests.push(request);
      assert.equal(element("deploy-fields").disabled,true,"fields should be locked during preparation");
      return {ok:!rejectPrepare,json:async()=>rejectPrepare?{error:"Studio temporarily unavailable"}:{review:{...request,value_wei:"0",args:Object.values(request.fields)}}};
    }
  });
  const source=await readFile(new URL("../ui/purchase.js",import.meta.url),"utf8");
  vm.runInContext(source.replace(/^import .*;\n/gm,""),context);
  await new Promise(resolve=>setImmediate(resolve));
  await element("connect-wallet").onclick();
  return {element,requests,walletCalls,fields,buyer,async submit(){
    await element("deploy-form").onsubmit({preventDefault(){},currentTarget:element("deploy-form"),target:element("deploy-form")});
  }};
}

test("deployment captures all three addresses before busy state disables the form",async()=>{
  const h=await controller();
  assert.equal(h.element("deploy-fields").disabled,false);
  await h.submit();
  assert.deepEqual(h.requests,[{account:h.buyer,action:"deploy",fields:Object.fromEntries(Object.entries(h.fields).map(([k,v])=>[k,v.trim()]))}]);
  assert.equal(h.element("review-section").hidden,false);
  assert.equal(h.element("deploy-fields").disabled,false);
  assert.deepEqual(h.walletCalls,[],"preparing a review must not request a signature");
});

test("failed preparation preserves inputs, unlocks the form and allows a fresh review",async()=>{
  const h=await controller({rejectPrepare:true}), original={...h.fields};
  await h.submit();
  assert.equal(h.element("flow-error").textContent,"Studio temporarily unavailable");
  assert.equal(h.element("deploy-fields").disabled,false);
  assert.deepEqual(h.fields,original);
  await h.submit();
  assert.equal(h.requests.length,2);
  assert.deepEqual(h.requests[1],h.requests[0]);
  assert.deepEqual(h.walletCalls,[]);
});

test("resumed completed wallet history renders verified payment and disables empty payment selection",async()=>{
  const report=JSON.parse(await readFile(new URL("../live/wallet-run-2026-09-07.json",import.meta.url),"utf8"));
  const receipt=report.receipts.at(-1),session=report.session;
  const review={action:"execute_purchase",account:receipt.from,contract:session.contract,args:receipt.args,recipient:receipt.child.to_address,value_wei:receipt.value_wei};
  const savedJournal={deployment:session.deployment,entries:[{hash:receipt.hash,action:"execute_purchase",phase:"complete",review,receipt,created_at:receipt.observed_at}]};
  const h=await controller({savedJournal,liveSession:session});
  const text=n=>[n.textContent,...n.children.map(text)].join(" ");
  const claims=h.element("live-claims").options.map(text).join(" ");
  assert.match(claims,/Paid · Recipient transfer verified/);
  assert.match(claims,/Contract permit: SCHEDULED \(consumed\)/);
  assert.match(claims,/Reservation cancelled/);
  h.element("action").value="execute_purchase";
  h.element("action").onchange();
  assert.equal(h.element("action-submit").disabled,true);
  assert.match(h.element("permit-choice").options[0].textContent,/No reserved permits/);
  assert.deepEqual(h.walletCalls,[]);
});
