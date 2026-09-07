import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFile,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve} from "node:path";
test("hosting build copies only manifested runtime and public evidence",async()=>{
  const dest=execFileSync("node",["hosting/build.mjs"],{encoding:"utf8"}).trim();
  const manifest=JSON.parse(await readFile(resolve(dest,"deployment-manifest.json"),"utf8"));
  const paths=manifest.files.map(f=>f.path);
  for(const file of manifest.files){
    const bytes=await readFile(resolve(dest,file.path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"),file.sha256);
    assert.doesNotMatch(file.path,/(private|journal|accounts|__pycache__|\.env|harness|server\.py|test_)/i);
  }
  assert.ok(paths.includes("public/index.html"));
  assert.ok(paths.includes("api/dispatch.py"));
  assert.ok(paths.includes("public/proof-model.js"));
  assert.ok(paths.includes("public/workspace.html"));
  assert.ok(paths.includes("public/workspace-model.js"));
  assert.ok(paths.includes("public/proof.html"));
  assert.ok(!paths.includes("server.py"));
  assert.deepEqual((await readdir(resolve(dest,"live"))).sort(),["full-flow-report.json","wallet-run-2026-09-07.json"]);
  const config=JSON.parse(await readFile(resolve(dest,"vercel.json"),"utf8"));
  assert.equal(config.framework,null);
  assert.equal(config.outputDirectory,"public");
  assert.equal(config.rewrites,undefined);
  assert.equal(config.functions["api/**/*.py"].maxDuration,60);
  assert.equal(paths.filter(p=>p.startsWith("api/")).length,10);
  assert.ok(paths.includes("commerce_flow.py"));
  assert.ok(paths.includes("contracts/recall_purchase.py"));
  assert.ok(paths.includes("api/session/receipt.py"));
});
