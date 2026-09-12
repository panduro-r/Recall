import test from 'node:test';
import assert from 'node:assert/strict';
import {passageContext,passageBlocks,citationGroups} from '../ui/review-passages.js';

test('finishes clipped lines using contiguous saved context, without losing exceptions',()=>{
  const source='Title\nTraining is off by default, but you may opt in. It applies only to future usage.\nNext section';
  const quote='ing is off by default, but you may opt in. It applies only to fut';
  const result=passageContext(quote,source);
  assert.equal(result.text,'Training is off by default, but you may opt in. It applies only to future usage.');
  assert.equal(result.expanded,true);assert.equal(result.matched,true);
  assert.equal(result.leading,false);assert.equal(result.trailing,false);
  assert.ok(source.includes(result.text)&&result.text.includes(quote));
});
test('does not expand a complete line or invent missing context',()=>{
  assert.deepEqual(passageContext('Exact line.','Before\nExact line.\nAfter'),{text:'Exact line.',expanded:false,matched:true,leading:false,trailing:false});
  assert.deepEqual(passageContext('Not in source','Different text'),{text:'Not in source',expanded:false,matched:false,leading:false,trailing:false});
});
test('bounds context for very long lines and marks partial passages',()=>{
  const source='context '.repeat(100)+'The full quote stays intact.'+' caveat'.repeat(100);
  const result=passageContext('The full quote stays intact.',source);
  assert.ok(result.text.length<=27+160);
  assert.equal(result.leading,true);assert.equal(result.trailing,true);
  assert.ok(result.text.includes('The full quote stays intact.'));
});
test('handles source boundaries, Unicode and repeated quotes deterministically',()=>{
  const source='🎧 Audio is never used for training.\n🎧 Audio is never used for training.';
  const result=passageContext('Audio is never',source);
  assert.equal(result.text,'🎧 Audio is never used for training.');
  assert.equal(result.leading,false);
  assert.equal(passageContext(source,source).text,source);
});
test('formats headings, paragraphs and lists, preserving all qualification words',()=>{
  const blocks=passageBlocks('# Privacy\n**Never** used by default.\n<br />\n- Unless you opt in.\n- You can opt out.');
  assert.deepEqual(blocks,[{type:'heading',text:'Privacy'},{type:'paragraph',text:'Never used by default.'},{type:'item',text:'Unless you opt in.'},{type:'item',text:'You can opt out.'}]);
});
test('keeps link labels without URL clutter or executable markup',()=>{
  const blocks=passageBlocks('Read our [terms](https://example.test/terms_(2026)).\n## API[\u200b](#api "Direct link")\n![Diagram](https://tracker.test/pixel)\n[Do not train](javascript:alert(1))\n<img src=x onerror=alert(1)>');
  assert.deepEqual(blocks.map(b=>b.text),['Read our terms.','API','Diagram','Do not train','<img src=x onerror=alert(1)>']);
  assert.ok(blocks.every(b=>Object.keys(b).sort().join(',')==='text,type'));
});
test('finishes a clipped Markdown link from captured context before formatting',()=>{
  const source='## API[\u200b](#api "Direct link to API")\nNext line';
  const result=passageContext('## API[\u200b](#ap',source);
  assert.equal(passageBlocks(result.text)[0].text,'API');
});
test('plain URLs, unsupported syntax and meaningful punctuation are retained',()=>{
  assert.equal(passageBlocks('Email hello@example.test; 0.0043/min. ~~Not allowed~~.')[0].text,'Email hello@example.test; 0.0043/min. ~~Not allowed~~.');
  assert.equal(passageBlocks('See [unfinished link')[0].text,'See [unfinished link');
  assert.equal(passageBlocks('3. Exceptions apply.')[0].text,'3. Exceptions apply.');
  assert.equal(passageContext('\nFirst line','\nFirst line').text,'\nFirst line');
});
test('groups repeated source citations without dropping, reordering or mutating quotes',()=>{
  const citations=[{source:'one',quote:'First quote'},{source:'two',quote:'Other quote'},{source:'one',quote:'Second quote'}];
  const documents=[{id:'one',label:'First source'},{id:'two',label:'Second source'}];
  const before=JSON.stringify({citations,documents}),groups=citationGroups(citations,documents);
  assert.deepEqual(groups.map(g=>g.document.id),['one','two']);
  assert.deepEqual(groups[0].citations.map(c=>c.quote),['First quote','Second quote']);
  assert.equal(JSON.stringify({citations,documents}),before);
});
test('unrecognized fence-like lines do not hide a qualification',()=>{
  assert.equal(passageBlocks('```note exceptions apply')[0].text,'```note exceptions apply');
  assert.equal(passageBlocks('~~~ Unless you opt in.')[0].text,'~~~ Unless you opt in.');
});
