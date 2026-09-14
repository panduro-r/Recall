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
    const cli=require(resolve(root,".build/vercel-debug/node_modules/vercel/dist/chunks/chunk-332LMJLZ.js"));
    const {detectBuilders}=cli.require_dist2();
    const result=await detectBuilders(files,null,{...config,projectSettings:config,workPath:artifact});
    assert.equal(result.errors,null,JSON.stringify(result.errors));
    assert.deepEqual(result.builders.filter(b=>b.use==="@vercel/python").map(b=>b.src),["api/dispatch.py"],"Exactly one dependency-bearing Python function");
    for(const file of files.filter(p=>p.startsWith("api/"))) {
      assert.equal(await findAppOrHandler(readFileSync(resolve(artifact,file),"utf8")),"handler");
      assert.ok(result.builders.some(b=>b.src===file&&b.use==="@vercel/python"),file);
    }
    assert.ok(result.builders.some(b=>b.src==="public/**/*"&&b.use==="@vercel/static"));
    const {convertRewrites,getTransformedRoutes}=cli.require_dist();
    const transformed=getTransformedRoutes(config);
    assert.equal(transformed.error,null,JSON.stringify(transformed.error));
    const routes=convertRewrites(config.rewrites);
    for(const rewrite of config.rewrites){
      const matches=routes.filter(r=>new RegExp(r.src).test(rewrite.source));
      assert.equal(matches.length,1,rewrite.source);
      const destination=new URL(matches[0].dest,"https://example.test");
      assert.equal(destination.pathname,"/api/dispatch");
      assert.deepEqual([...destination.searchParams],[["route",rewrite.source]],"No wildcard parameters may leak into the strict dispatcher");
    }
    for(const path of ["/api/dispatch","/api/run","/api/session/unknown","/api/proof/extra","/api/PROOF","/private","/compare","/review"])
      assert.ok(!routes.some(r=>new RegExp(r.src).test(path)),path);
    const [old]=convertRewrites([{source:"/api/:path*",destination:"/api/dispatch?route=/api/:path*"}]);
    assert.ok(new URL(old.dest,"https://example.test").searchParams.has("path"),"Reproduce the former wildcard's extra parameter and 404 cause");
    console.log("Exact CLI checks: one Python function, public static assets, and 11 non-recursive explicit API rewrites; no errors.");
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
