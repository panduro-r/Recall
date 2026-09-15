// Prepare a GitHub tree payload only. Publishing is a separate reviewed operation.
import {readFile,writeFile,readdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {resolve,dirname,relative} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {planRetiredFunctions} from "./retired-functions.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const artifact=resolve(process.argv[2]||"");
if(!relative(resolve(root,".build"),artifact).startsWith("recall-vercel-")||relative(root,artifact).includes(".."))throw Error("Choose an allowlisted build artifact");
const repo="repos/panduro-r/Recall";
const get=path=>JSON.parse(execFileSync("gh",["api",`${repo}/${path}`],{encoding:"utf8"}));
const head=get("commits/main"),remote=get(`git/trees/${head.commit.tree.sha}?recursive=1`);
if(remote.truncated)throw Error("Remote tree truncated");
const manifest=JSON.parse(await readFile(resolve(artifact,"deployment-manifest.json"),"utf8"));
const entries=[],blobs=new Map();
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
function binary(path,bytes){
  const id=createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  blobs.set(id,{sha:id,encoding:"base64",content:bytes.toString("base64")});
  return {path,mode:"100644",type:"blob",sha:id};
}
for(const file of manifest.files){
  if(file.path.startsWith("/")||file.path.split("/").includes(".."))throw Error("Unsafe artifact path");
  const bytes=await readFile(resolve(artifact,file.path));
  if(sha(bytes)!==file.sha256)throw Error("Artifact drift");
  entries.push(/\.(woff2|png)$/.test(file.path)?binary("deploy/"+file.path,bytes):{path:"deploy/"+file.path,mode:"100644",type:"blob",content:bytes.toString("utf8")});
}
entries.push({path:"deploy/deployment-manifest.json",mode:"100644",type:"blob",content:await readFile(resolve(artifact,"deployment-manifest.json"),"utf8")});
// Retire only the eleven hash-pinned duplicate wrappers. Unknown files still fail closed.
const deletions=planRetiredFunctions(remote.tree,entries.map(e=>e.path));
entries.push(...deletions);
const sources=["README.md","DEMO.md","VERIFICATION.md","PRODUCT.md","DESIGN.md","tests/COMMERCE-QA.md","ui/Inter-LICENSE.txt",".gitignore","server.py","purchase_flow.py","commerce_flow.py","contracts/recall_purchase.py","studio_read.py","hosted_app.py","catalog_sources.py","ui/service-catalog.json","live/commerce-payment-2026-09-08.json",
 "provider_evidence.py","provider_review_flow.py","contracts/provider_review.py","hosting/api/provider-review.py","tests/PROVIDER-REVIEW-QA.md","tests/SPEECHMATICS-RECEIPT-2026-09-10.md","tests/PROVIDER-CONSENSUS-V3-QA.md","live/provider-review-preflight-2026-09-10.json",
 "live/verify_wallet_run.py","live/wallet-run-2026-09-07.json","hosting/README.md","hosting/build.mjs","hosting/prepare-release.mjs","tests/CATEGORY-EXPANSION-QA.md","submission/pitch.md","submission/usability-check.md","submission/verified-reviews-2026-09-14.json",
 "hosting/vercel.json","hosting/requirements.txt","hosting/.python-version","hosting/api/dispatch.py","hosting/check-entrypoint.cjs","hosting/check-live.mjs","hosting/retired-functions.mjs","submission/agent-tank.json","submission/demo-script.md","submission/logo-notes.md",
 "tests/SPEECH-LIVE-QA-2026-09-14.md","submission/verified-speech-reviews-2026-09-14.json","tests/PROVIDER-REVIEW-V6-QA.md","submission/verified-fish-v6-2026-09-15.json","tests/CATALOG-REFRESH-2026-09-15.md","tests/TEXT-CATEGORY-QA-2026-09-15.md",
 ...["runtime","recorded","proof","check-studio","session/config","session/prepare","session/inspect","session/receipt","commerce","catalog/check"].map(p=>`hosting/api/${p}.py`)];
for(const folder of ["ui","tests"]){
  for(const name of await readdir(resolve(root,folder)))
    // The standalone disposable-wallet runner and its tests remain local-only.
    if(/\.(html|css|js|mjs|py)$/.test(name)&&!["test_review_test_wallet.py","test_fish_v6_test.py"].includes(name))sources.push(folder+"/"+name);
}
for(const path of sources){
  const content=await readFile(resolve(root,path),"utf8");
  if(new RegExp("co"+"dex","i").test(content))throw Error("Remove assistant branding before publishing: "+path);
  entries.push({path,mode:"100644",type:"blob",content});
}
const out=resolve(artifact,"github-tree.json");
entries.push(binary("ui/InterVariable.woff2",await readFile(resolve(root,"ui/InterVariable.woff2"))));
entries.push(binary("submission/recall-logo.png",await readFile(resolve(root,"submission/recall-logo.png"))));
await writeFile(out,JSON.stringify({base_tree:head.commit.tree.sha,tree:entries}));
await writeFile(resolve(artifact,"github-blobs.json"),JSON.stringify([...blobs.values()]));
await writeFile(resolve(artifact,"github-parent.json"),JSON.stringify({parent:head.sha,base_tree:head.commit.tree.sha,files:entries.map(e=>e.path),removedFiles:deletions.map(e=>e.path)},null,2)+"\n");
console.log(JSON.stringify({parent:head.sha,files:entries.length,removedFiles:deletions.map(e=>e.path),payload:out}));
