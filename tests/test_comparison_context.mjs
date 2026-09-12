import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {comparisonLink,comparisonContext,comparisonViewLink,withComparisonReturn,comparisonReturn} from '../ui/compare-model.js';
const catalog=JSON.parse(readFileSync('ui/service-catalog.json','utf8'));
const req={hours:237,budget:151.23,noTraining:false,speakers:true},plans=['soniox-async','assembly-pro'];
const back=(url,extra='')=>'id=fixture&'+new URLSearchParams({back:url})+extra;
test('comparison address roundtrips both selected plans, exact requirements and view',()=>{
  for(const view of ['browse','compare']){
    const url=comparisonViewLink(req,plans,view),context=comparisonContext(url.slice(9));
    assert.deepEqual(context,{requirements:req,planId:plans[0],from:'comparison',plans,view});
    assert.equal(comparisonViewLink(context.requirements,context.plans,context.view),url);
  }
  assert.deepEqual(plans,['soniox-async','assembly-pro']);
});
test('old review and shortlist links remain valid without inventing a stored comparison',()=>{
  for(const from of ['review','saved']){
    const c=comparisonContext(comparisonLink(req,'speechmatics-standard',from).slice(9));
    assert.equal(c.from,from);assert.equal(c.plans,undefined);assert.deepEqual(c.requirements,req);
  }
});
test('snapshot parameters are bounded and fail closed on unknown, repeated or missing fields',()=>{
  const valid=comparisonViewLink(req,plans).slice(9);
  for(const s of [valid+'&view=browse',valid+'&extra=yes',valid.replace('view=compare','view=evil'),valid.replace('alternative=assembly-pro','alternative=soniox-async'),valid.replace('plan=soniox-async','plan='),valid.replace('speakers=true','speakers=1'),valid.replace('budget=151.23','budget=0'),'x'.repeat(1201)])assert.throws(()=>comparisonContext(s));
  for(const ps of [[],['bad/id'],['a','a'],['a','b','c'],[null]])assert.throws(()=>comparisonViewLink(req,ps));
  assert.throws(()=>comparisonViewLink(req,plans,'unknown'));
});
test('single-plan catalogs can still preserve a valid comparison',()=>{
  const url=comparisonViewLink(req,['soniox-async']);
  assert.deepEqual(comparisonContext(url.slice(9)).plans,['soniox-async']);
});
test('return links keep opaque review IDs intact and contain only a local comparison destination',()=>{
  const url=comparisonViewLink(req,plans),href=withComparisonReturn('/review#'+new URLSearchParams({id:'a/#?& test'}),url);
  const params=new URLSearchParams(href.slice(8));
  assert.equal(params.get('id'),'a/#?& test');assert.equal(params.get('back'),url);
  assert.equal(comparisonReturn(href.slice(8),catalog,'assembly-pro',req),url);
  for(const bad of ['https://example.com/review#id=a','//example.com/review#id=a','/workspace#id=a'])assert.throws(()=>withComparisonReturn(bad,url));
});
test('return navigation requires all four requirements and the actual compared plan',()=>{
  const url=comparisonViewLink(req,plans),hash=back(url);
  for(const altered of [{...req,hours:238},{...req,budget:151.24},{...req,noTraining:true},{...req,speakers:false}])assert.equal(comparisonReturn(hash,catalog,'assembly-pro',altered),null);
  assert.equal(comparisonReturn(hash,catalog,'speechmatics-standard',req),null);
  assert.equal(comparisonReturn(hash,catalog,'removed-plan',req),null);
  assert.equal(comparisonReturn(hash,catalog,null,req),null);
});
test('browsing returns to the full list for a catalog plan without imposing the selected pair',()=>{
  const url=comparisonViewLink(req,plans,'browse');
  assert.equal(comparisonReturn(back(url),catalog,'speechmatics-standard',req),url);
});
test('external, malformed, duplicate, stale-catalog and oversized return addresses are ignored',()=>{
  const url=comparisonViewLink(req,plans);
  for(const bad of ['https://example.com/compare#'+url.slice(9),'//example.com/compare#'+url.slice(9),'/compare?evil=1#'+url.slice(9),'/compare#'+url.slice(9)+'&destination=https://example.com','/compare#'+url.slice(9).replace('assembly-pro','removed-plan'),'/compare#'+url.slice(9).replace('151.23','NaN'),'javascript:alert(1)'])assert.equal(comparisonReturn(back(bad),catalog,'soniox-async',req),null);
  assert.equal(comparisonReturn(back(url,'&back='+encodeURIComponent(url)),catalog,'soniox-async',req),null);
  assert.equal(comparisonReturn('x'.repeat(4001),catalog,'soniox-async',req),null);
  assert.equal(comparisonReturn(back(comparisonLink(req,'soniox-async')),catalog,'soniox-async',req),null);
});
