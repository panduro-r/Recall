// Create a new allowlisted deployment directory; never upload the workspace.
import {readFile,copyFile,mkdir,mkdtemp,writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve,dirname} from "node:path";
import {createHash} from "node:crypto";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const buildRoot=resolve(root,".build");
await mkdir(buildRoot,{recursive:true});
const dest=await mkdtemp(resolve(buildRoot,"recall-vercel-"));
const files=[
  ["hosting/api/dispatch.py","api/dispatch.py"],["hosting/vercel.json","vercel.json"],
  ...["runtime","recorded","proof","check-studio","session/config","session/prepare","session/inspect","session/receipt","commerce"].map(p=>[`hosting/api/${p}.py`,`api/${p}.py`]),
  ["hosting/requirements.txt","requirements.txt"],["hosting/.python-version",".python-version"],
  ["ui/InterVariable.woff2","public/InterVariable.woff2"],["ui/Inter-LICENSE.txt","public/Inter-LICENSE.txt"],
  ["submission/recall-logo.png","public/recall-logo.png"],
  ...["hosted_app.py","purchase_flow.py","commerce_flow.py","studio_read.py","contracts/recall.py","contracts/recall_purchase.py","live/full-flow-report.json","live/wallet-run-2026-09-07.json"].map(p=>[p,p]),
  ...["commerce-model.js","commerce-ui.js","wallet-discovery.js"].map(p=>["ui/"+p,"public/"+p]),
  ...["style.css","purchase.css","app.js","model.js","purchase.js","wallet.js","purchase.html","proof.css","proof.js","proof-model.js","workspace.html","workspace.js","workspace-model.js","workspace.css"].map(p=>["ui/"+p,"public/"+p]),
  ["ui/proof.html","public/proof.html"],
  ["ui/index.html","public/recorded.html"],["ui/proof.html","public/index.html"],
  ["live/wallet-run-2026-09-07.json","public/wallet-run.json"],
  ...["inference-v1","inference-amendment","inference-replacement","storage-v1","monitoring-v1"].map(n=>[`evidence/flow/${n}.txt`,`evidence/flow/${n}.txt`])
];
const report=JSON.parse(await readFile(resolve(root,"live/wallet-run-2026-09-07.json"),"utf8"));
const sha=data=>createHash("sha256").update(data).digest("hex");
if(sha(await readFile(resolve(root,"contracts/recall.py")))!==report.source_sha256)throw Error("Contract source drift");
for(const [name,doc] of Object.entries(report.evidence)){
  if(!["inference-v1","inference-amendment","inference-replacement","storage-v1","monitoring-v1"].includes(name))throw Error("Unexpected evidence");
  if(sha(await readFile(resolve(root,`evidence/flow/${name}.txt`)))!==doc.sha256)throw Error("Evidence drift");
}
const manifest=[];
for(const [from,to] of files){
  await mkdir(dirname(resolve(dest,to)),{recursive:true});
  await copyFile(resolve(root,from),resolve(dest,to));
  manifest.push({path:to,sha256:sha(await readFile(resolve(dest,to)))});
}
await writeFile(resolve(dest,"deployment-manifest.json"),JSON.stringify({files:manifest},null,2)+"\n");
console.log(dest);
