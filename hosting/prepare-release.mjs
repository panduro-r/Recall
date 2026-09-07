// Prepare a GitHub tree payload only. Publishing is a separate reviewed operation.
import {readFile,writeFile,readdir} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {resolve,dirname,relative} from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const artifact=resolve(process.argv[2]||"");
if(!relative(resolve(root,".build"),artifact).startsWith("recall-vercel-")||relative(root,artifact).includes(".."))throw Error("Choose an allowlisted build artifact");
const repo="repos/panduro-r/Recall";
const get=path=>JSON.parse(execFileSync("gh",["api",`${repo}/${path}`],{encoding:"utf8"}));
const head=get("commits/main"),remote=get(`git/trees/${head.commit.tree.sha}?recursive=1`);
if(remote.truncated)throw Error("Remote tree truncated");
const manifest=JSON.parse(await readFile(resolve(artifact,"deployment-manifest.json"),"utf8"));
const entries=[];
const sha=bytes=>createHash("sha256").update(bytes).digest("hex");
for(const file of manifest.files){
  if(file.path.startsWith("/")||file.path.split("/").includes(".."))throw Error("Unsafe artifact path");
  const bytes=await readFile(resolve(artifact,file.path));
  if(sha(bytes)!==file.sha256)throw Error("Artifact drift");
  entries.push({path:"deploy/"+file.path,mode:"100644",type:"blob",content:bytes.toString("utf8")});
}
entries.push({path:"deploy/deployment-manifest.json",mode:"100644",type:"blob",content:await readFile(resolve(artifact,"deployment-manifest.json"),"utf8")});
// Never delete stale deployment entries silently; require explicit review instead.
for(const row of remote.tree.filter(r=>r.type==="blob"&&r.path.startsWith("deploy/")))
  if(!entries.some(e=>e.path===row.path))throw Error("Unexpected existing deployment file: "+row.path);
const sources=["README.md","DEMO.md","VERIFICATION.md",".gitignore","server.py","purchase_flow.py","studio_read.py","hosted_app.py",
 "live/verify_wallet_run.py","live/wallet-run-2026-09-07.json","hosting/README.md","hosting/build.mjs","hosting/prepare-release.mjs",
 "hosting/vercel.json","hosting/requirements.txt","hosting/.python-version","hosting/api/dispatch.py","hosting/check-entrypoint.cjs","submission/agent-tank.json"];
for(const folder of ["ui","tests"]){
  for(const name of await readdir(resolve(root,folder)))
    if(/\.(html|css|js|mjs|py)$/.test(name))sources.push(folder+"/"+name);
}
for(const path of sources){
  const content=await readFile(resolve(root,path),"utf8");
  if(new RegExp("co"+"dex","i").test(content))throw Error("Remove assistant branding before publishing: "+path);
  entries.push({path,mode:"100644",type:"blob",content});
}
const out=resolve(artifact,"github-tree.json");
await writeFile(out,JSON.stringify({base_tree:head.commit.tree.sha,tree:entries}));
await writeFile(resolve(artifact,"github-parent.json"),JSON.stringify({parent:head.sha,base_tree:head.commit.tree.sha,files:entries.map(e=>e.path)},null,2)+"\n");
console.log(JSON.stringify({parent:head.sha,files:entries.length,payload:out}));
