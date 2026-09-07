"""Unsigned two-party Studio adapter. No storage, keys, signing or broadcasts."""
import base64
import hashlib
import json
import time
from pathlib import Path
import rlp
from genlayer_py.abi import calldata
from web3 import Web3
from purchase_flow import address, tx_hash, require, chain_check, execution, receipt, CHAIN, ZERO, LIMIT
from studio_read import rpc, RPC

SOURCE=Path(__file__).resolve().parent/"contracts/recall_purchase.py"
ACTIONS={"accept_terms","evaluate_claim","queue_purchase","challenge_claim","resolve_challenge","cancel_purchase","publish_claim","execute_purchase"}

def text(value,low,high):
    require(isinstance(value,str) and low<=len(value.strip())<=high and len(value.encode())<=high*3,"Check the length of your request or terms.")
    return value.strip()

def amount(value):
    require(isinstance(value,str) and value.isascii() and value.isdigit() and len(value)<=18 and 0<int(value)<=LIMIT,"Use an amount above zero, up to 0.100 test GEN.")
    return value

def config():
    return {"version":2,"chain_id":CHAIN,"rpc":RPC,"source_sha256":hashlib.sha256(SOURCE.read_bytes()).hexdigest(),"max_budget_wei":str(LIMIT),"review_seconds":600,
            "notice":"New two-party contract version. Local VM tested; a fresh wallet-approved Studio run is still required. Public terms only."}

def inspect(deployment,read=rpc):
    deployment=tx_hash(deployment);chain_check(read)
    tx=read("eth_getTransactionByHash",[deployment])
    require(isinstance(tx,dict) and tx.get("hash","").lower()==deployment and tx.get("status")=="FINALIZED" and execution(tx)=="SUCCESS","Wait for successful deployment finality, then refresh. Do not deploy again automatically.")
    code=base64.b64decode(tx.get("data",{}).get("contract_code",""),validate=True)
    require(hashlib.sha256(code).hexdigest()==config()["source_sha256"],"This link is not a deployment of this Recall purchasing version.")
    contract=address(tx.get("data",{}).get("contract_address") or tx.get("to_address"));buyer=address(tx.get("from_address"))
    payload="0x"+rlp.encode([calldata.encode({"method":"snapshot","args":[]}),b"\x00"]).hex()
    result=read("gen_call",[{"type":"read","from":buyer,"to":contract,"data":payload,"transaction_hash_variant":"latest-final"}])
    state=calldata.decode(bytes.fromhex(result.removeprefix("0x")))
    require(isinstance(state,dict) and state.get("version")==2 and state["buyer"].lower()==buyer.lower(),"Unexpected agreement state.")
    amount(state["budget_wei"])
    address(state["seller"])
    require(isinstance(state["offers"],list) and 1<=len(state["offers"])<=3,"Unexpected offer state.")
    return {"deployment":deployment,"contract":contract,"state":state,"observed_at":time.time()}

def plan_action(action,fields,account,state,now):
    require(action in ACTIONS,"Choose an available action.")
    roles=["seller"] if action in {"accept_terms","publish_claim"} else ["buyer","seller"] if action in {"challenge_claim","resolve_challenge"} else ["buyer"]
    require(account.lower() in [state[r].lower() for r in roles],"This action needs the "+" or ".join(roles)+" wallet.")
    if action!="cancel_purchase":require(now<state["expires_at"]-5 and not state["paid"],"This purchase is closed. An unpaid approval can still be canceled.")
    value=0;recipient="";offer=next((o for o in state["offers"] if o["id"]==fields.get("offer_id")),None)
    if action=="accept_terms":
        require(not state["accepted"],"Terms already accepted.");args=[]
    elif action=="publish_claim":
        require(state["accepted"] and state["offers"][-1]["permit"]=="CANCELLED" and len(state["offers"])<3 and now+905<state["expires_at"],"Wait for cancellation; replacement must have time for review.")
        price=amount(fields.get("amount_wei"));require(int(price)<=int(state["budget_wei"]),"Offer exceeds buyer budget.")
        args=[price,text(fields.get("terms"),30,6000)]
    else:
        require(offer is not None,"Select an existing offer.");args=[offer["id"]]
        if action=="evaluate_claim":require(state["accepted"] and offer["status"]=="PENDING" and offer["permit"]=="NONE" and now+905<state["expires_at"],"Supplier must accept before the open offer is assessed.")
        elif action=="queue_purchase":require(offer["status"]=="VALID" and offer["permit"]=="NONE" and not any(o["permit"]=="RESERVED" for o in state["offers"]),"This offer cannot be approved.")
        elif action=="cancel_purchase":require(offer["permit"] in {"NONE","RESERVED"},"This offer is already canceled or consumed.")
        elif action=="challenge_claim":
            require(offer["status"]=="VALID" and not offer["counter_terms"] and offer["permit"] not in {"CANCELLED","SCHEDULED"} and now+5<offer["review_until"],"The change-review window is closed.")
            args.append(text(fields.get("terms"),30,6000))
        elif action=="resolve_challenge":require(offer["status"]=="DISPUTED" and offer["permit"]!="CANCELLED" and now+5<offer["review_until"]+300,"Change review expired or canceled. The buyer can cancel an unpaid offer instead.")
        elif action=="execute_purchase":
            require(offer["status"]=="VALID" and offer["permit"]=="RESERVED" and now>=offer["review_until"]+5,"Payment is blocked or the review period is still open. Refresh after review closes.")
            value=int(amount(offer["amount_wei"]));recipient=address(state["seller"])
    return args,value,recipient

def prepare(data,read=rpc):
    require(isinstance(data,dict) and set(data)<={"account","action","fields","deployment"},"Unexpected request fields.")
    account=address(data.get("account"));action=data.get("action");fields=data.get("fields",{})
    require(isinstance(fields,dict),"Invalid action fields.")
    require(isinstance(action,str) and action in ACTIONS|{"deploy"},"Choose an available action.")
    allowed=({"seller","title","criterion","budget_wei","amount_wei","terms"} if action=="deploy" else
             set() if action=="accept_terms" else {"amount_wei","terms"} if action=="publish_claim" else
             {"offer_id","terms"} if action=="challenge_claim" else {"offer_id"})
    require(set(fields)==allowed,"Missing or unexpected action fields.")
    chain_check(read);require(int(read("eth_gasPrice",[]),16)==0,"Studio transport is no longer gasless. Signing is disabled.")
    router=read("sim_getConsensusContract",["ConsensusMain"])
    functions=[f for f in router.get("abi",[]) if f.get("name")=="addTransaction"]
    require(router.get("address","").lower()==ZERO and len(functions)==1 and [x["type"] for x in functions[0]["inputs"]]==["address","address","uint256","uint256","bytes"],"Studio router changed; signing is disabled.")
    code=None;value=0;recipient=""
    if action=="deploy":
        seller=address(fields.get("seller"));require(seller.lower()!=account.lower(),"Buyer and supplier must use different wallets.")
        budget=amount(fields.get("budget_wei"));price=amount(fields.get("amount_wei"));require(int(price)<=int(budget),"Offer exceeds budget.")
        args=[seller,text(fields.get("title"),3,100),text(fields.get("criterion"),10,1000),budget,price,text(fields.get("terms"),30,6000)]
        code=SOURCE.read_bytes();contract=ZERO;obj={"args":args}
    else:
        session=inspect(data.get("deployment"),read);contract=session["contract"]
        args,value,recipient=plan_action(action,fields,account,session["state"],time.time());obj={"method":action,"args":args}
        if value:require(int(read("eth_getBalance",[account,"latest"]),16)>=value,"Get test GEN from the Studio faucet first.")
    payload=rlp.encode([code,calldata.encode(obj),b""] if code else [calldata.encode(obj),b""])
    encoded=Web3().eth.contract(abi=functions).encode_abi("addTransaction",args=[account,contract,5,3,payload])
    tx={"from":account,"to":ZERO,"chainId":hex(CHAIN),"value":hex(value),"data":encoded,"gasPrice":"0x0"}
    tx["gas"]=hex(int(read("eth_estimateGas",[{"from":account,"to":ZERO,"data":encoded,"value":hex(value)}]),16))
    tx["nonce"]=hex(int(read("eth_getTransactionCount",[account,"pending"]),16))
    require(int(tx["gas"],16)>0,"Invalid gas estimate.")
    review={"action":action,"account":account,"contract":contract,"recipient":recipient,"value_wei":str(value),"args":args,"chain_id":CHAIN,"source_sha256":config()["source_sha256"]}
    return {"review":review,"transaction":tx,"prepared_at":time.time(),"intent_id":hashlib.sha256(json.dumps(review,sort_keys=True).encode()).hexdigest()}

def dispatch(data,read=rpc):
    require(isinstance(data,dict),"Expected a JSON object.")
    op=data.get("op")
    if op=="config" and set(data)=={"op"}:return config()
    if op=="inspect" and set(data)=={"op","deployment"}:return inspect(data["deployment"],read)
    if op=="receipt" and set(data)=={"op","hash"}:return receipt(data["hash"],read)
    if op=="prepare" and set(data)=={"op","request"}:return prepare(data["request"],read)
    raise ValueError("Unknown purchasing request.")
