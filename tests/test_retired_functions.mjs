import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {retiredFunctions,planRetiredFunctions} from "../hosting/retired-functions.mjs";
const rows=Object.entries(retiredFunctions).map(([path,sha])=>({path,sha,mode:"100644",type:"blob"}));
test("release retires exactly the eleven known duplicate generated wrappers",async()=>{
  assert.equal(rows.length,11);
  for(const row of rows){
    const bytes=await readFile(row.path.replace("deploy/","hosting/"));
    assert.equal(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"),row.sha);
  }
  assert.deepEqual(planRetiredFunctions(rows,[]),rows.map(({path})=>({path,mode:"100644",type:"blob",sha:null})));
});
test("migration is idempotent and leaves retained runtime and unrelated files alone",()=>{
  assert.deepEqual(planRetiredFunctions([],[]),[]);
  assert.deepEqual(planRetiredFunctions([
    {path:"deploy/api/dispatch.py",type:"blob",sha:"current"},
    {path:"deploy/api",type:"tree"}, {path:"README.md",type:"blob"}
  ],["deploy/api/dispatch.py"]),[]);
});
test("unknown or changed generated files require a new explicit review",()=>{
  for(const row of [
    {path:"deploy/api/dispatch.py",type:"blob"},
    {path:"deploy/public/review.html",type:"blob"},
    {path:"deploy/secret.json",type:"blob"},
    {...rows[0],sha:"changed"}, {...rows[0],mode:"120000"}, {...rows[0],type:"commit"}
  ])assert.throws(()=>planRetiredFunctions([row],[]),/Unexpected existing deployment file/);
});
