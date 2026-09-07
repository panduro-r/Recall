// Run against the analyzer bundled with the CLI version from the failed build.
// Setup: npm install --prefix .build/vercel-debug --no-save --ignore-scripts vercel@59.11.7
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const assert=require("node:assert/strict");
const root=resolve(__dirname,"..");
const {findAppOrHandler}=require(resolve(root,".build/vercel-debug/node_modules/@vercel/python-analysis"));
(async()=>{
  assert.equal(await findAppOrHandler("from hosted_app import handler\n"),null,"Old entry should reproduce the detection failure");
  const source=readFileSync(resolve(root,"hosting/api/dispatch.py"),"utf8");
  assert.equal(await findAppOrHandler(source),"handler","Entry must be recognized by Vercel's real analyzer");
  console.log("Vercel CLI 59.11.7 analyzer: old import rejected; local handler class detected.");
  if(process.argv[2]){
    const artifact=resolve(process.argv[2]);
    const config=JSON.parse(readFileSync(resolve(artifact,"vercel.json"),"utf8"));
    const files=JSON.parse(readFileSync(resolve(artifact,"deployment-manifest.json"),"utf8")).files.map(f=>f.path);
    const {detectBuilders}=require(resolve(root,".build/vercel-debug/node_modules/vercel/dist/chunks/chunk-332LMJLZ.js")).require_dist2();
    const result=await detectBuilders(files,null,{...config,projectSettings:config,workPath:artifact});
    assert.equal(result.errors,null,JSON.stringify(result.errors));
    assert.ok(result.builders.some(b=>b.src==="api/dispatch.py"&&b.use==="@vercel/python"));
    assert.ok(result.builders.some(b=>b.src==="public/**/*"&&b.use==="@vercel/static"));
    console.log("Exact CLI builder discovery: Python API and public static assets detected without errors.");
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
