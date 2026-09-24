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
 "hosting/vercel.json","hosting/requirements.txt","hosting/.python-version","hosting/api/dispatch.py","hosting/check-entrypoint.cjs","hosting/check-live.mjs","hosting/retired-functions.mjs","submission/agent-tank.json","submission/demo-script.md","submission/logo-notes.md","tests/PROVIDER-REVIEW-V8-QA.md",
 "tests/SPEECH-LIVE-QA-2026-09-14.md","submission/verified-speech-reviews-2026-09-14.json","tests/PROVIDER-REVIEW-V6-QA.md","submission/verified-fish-v6-2026-09-15.json","tests/CATALOG-REFRESH-2026-09-15.md","tests/TEXT-CATEGORY-QA-2026-09-15.md","tests/PROVIDER-REVIEW-V7-QA.md","submission/observed-text-v7-2026-09-15.json","submission/observed-quality-v8-2026-09-15.json",
 ...["runtime","recorded","proof","check-studio","session/config","session/prepare","session/inspect","session/receipt","commerce","catalog/check"].map(p=>`hosting/api/${p}.py`)];
sources.push("studio_next.py","provider_review_archive.py","provider_review_next_flow.py","contracts/provider_review_studio_next.py","contracts/provider_review_v6_archive.py","tests/fixtures/studio-next-plan.json","tests/STUDIO-NEXT-MIGRATION-QA.md","submission/studio-next-migration-2026-09-17.json",
 "provider_review_decisions_read.py","provider_review_decisions_schema.py");
sources.push("submission/BUILDER-PROJECT.md","submission/completion-status-2026-09-17.md",
 "submission/studio-next-v26-speechmatics-2026-09-24.json",
 "experiments/provider_review_facts_v19.py","experiments/provider_review_decisions_v26.py",
 "experiments/assemble_review_decisions_v26.py","experiments/contracts/provider_review_decisions_v26.py");
for(const folder of ["ui","tests"]){
  for(const name of await readdir(resolve(root,folder)))
    // The standalone disposable-wallet runner and its tests remain local-only.
    if(/\.(html|css|js|mjs|py)$/.test(name)&&!["test_studio_next_migration.py","test_studio_next_corrected.py","test_studio_next_vm.py","test_review_test_wallet.py","test_fish_v6_test.py","test_text_v7_wallet.py","test_quality_v8_wallet.py","test_facts_v9_smoke.py","test_facts_v9_validation.py","test_facts_v10_validation.py","test_facts_v11_validation.py","test_facts_v12_validation.py","test_facts_v13_validation.py","test_facts_v14_validation.py","test_facts_v15_validation.py","test_facts_v16_validation.py","test_facts_v17_validation.py","test_facts_v10_diagnostic.py","test_review_facts_v10_trace.py","test_runner_header.py","test_review_facts_v9.py","test_review_facts_v9_vm.py","test_review_quality_v9.py","test_review_facts_v10.py","test_review_facts_v10_vm.py","test_review_facts_v10_regression.py","test_review_facts_v10_observed_audit.py","test_review_facts_v11.py","test_review_facts_v11_vm.py","test_review_facts_v11_observed_audit.py","test_review_facts_v12.py","test_review_facts_v12_vm.py","test_review_facts_v12_controls.py","test_review_facts_v13.py","test_review_facts_v13_vm.py","test_review_facts_v13_controls.py", "test_review_facts_v13_observed.py", "test_review_facts_v13_trace.py", "test_facts_v13_diagnostic.py", "test_review_facts_v14.py", "test_review_facts_v14_vm.py", "test_review_facts_v14_regression.py","test_review_facts_v15.py","test_review_facts_v16.py","test_review_facts_v17.py","test_review_facts_v15_vm.py","test_review_facts_v15_regression.py"].includes(name))sources.push(folder+"/"+name);
}
for(const path of sources){
  const content=await readFile(resolve(root,path),"utf8");
  if(new RegExp("co"+"dex","i").test(content))throw Error("Remove assistant branding before publishing: "+path);
  entries.push({path,mode:"100644",type:"blob",content});
}
entries.push(binary("ui/InterVariable.woff2",await readFile(resolve(root,"ui/InterVariable.woff2"))));
entries.push(binary("submission/recall-logo.png",await readFile(resolve(root,"submission/recall-logo.png"))));
const readerPaths=new Set([
 "deploy/provider_review_decisions_read.py","deploy/provider_review_decisions_schema.py",
 "deploy/public/review-decisions.js","deploy/deployment-manifest.json",
 "provider_review_decisions_read.py","provider_review_decisions_schema.py","ui/review-decisions.js",
 "tests/test_v26_reader_public.py","tests/test_review_decisions.mjs",
 "README.md","submission/BUILDER-PROJECT.md",
 "submission/completion-status-2026-09-17.md",
 "submission/studio-next-v26-speechmatics-2026-09-24.json",
 "experiments/provider_review_facts_v19.py","experiments/provider_review_decisions_v26.py",
 "experiments/assemble_review_decisions_v26.py","experiments/contracts/provider_review_decisions_v26.py",
 "hosting/prepare-release.mjs"
]);
const targeted=process.argv.includes("--v26-reader");
const releaseEntries=targeted?entries.filter(e=>readerPaths.has(e.path)):entries;
if(targeted&&(releaseEntries.length!==readerPaths.size||deletions.length))throw Error("Targeted reader release has missing or destructive paths");
const out=resolve(artifact,"github-tree.json");
await writeFile(out,JSON.stringify({base_tree:head.commit.tree.sha,tree:releaseEntries}));
await writeFile(resolve(artifact,"github-blobs.json"),JSON.stringify([...blobs.values()]));
await writeFile(resolve(artifact,"github-parent.json"),JSON.stringify({parent:head.sha,base_tree:head.commit.tree.sha,files:releaseEntries.map(e=>e.path),removedFiles:deletions.map(e=>e.path)},null,2)+"\n");
console.log(JSON.stringify({parent:head.sha,files:releaseEntries.length,removedFiles:deletions.map(e=>e.path),targeted,payload:out}));
