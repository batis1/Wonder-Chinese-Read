import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { grammarFor } from '../src/grammar.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const catalog=read('data/catalog.json');
const vocabulary=read('data/vocabulary.json');
const lessons=catalog.map(l=>read(`data/lessons/${l.id}.json`));

test('both books have all 36 distinct lessons with source notes and original audio',()=>{
  assert.deepEqual(lessons.map(l=>l.number),Array.from({length:36},(_,i)=>i+1));
  assert.equal(lessons.filter(l=>l.volume==='上').length,18);
  assert.equal(lessons.filter(l=>l.volume==='下').length,18);
  for(const l of lessons){
    assert.ok(l.text.length>450,`${l.id} has an incomplete passage`);
    assert.ok(fs.existsSync(path.join(root,l.audio.replaceAll('\\','/'))),`${l.id} missing audio`);
    assert.ok(l.grammarPages.length>=2,`${l.id} missing course notes`);
    assert.ok(grammarFor(l).length>=2,`${l.id} missing usage points`);
  }
  assert.match(lessons[6].audio,/07-combined/);
});

test('optional original scans cover the grammar page references', {skip: !fs.existsSync(path.join(root,'data/pages'))}, ()=>{
  for(const l of lessons)for(const page of l.grammarPages)assert.ok(fs.existsSync(path.join(root,'data/pages',`${l.volume==='上'?'upper':'lower'}-${page}.jpg`)));
});
test('annotations preserve passage text and use exact current syllabus levels',()=>{
  assert.equal(Object.keys(vocabulary).length,10896);
  assert.equal(vocabulary['如何'].level,5);
  assert.equal(vocabulary['夫妻'].level,3);
  assert.equal(vocabulary['电台'].level,7);
  for(const l of lessons){
    const tokens=l.paragraphs.flatMap(p=>p.sentences.flatMap(s=>s.tokens));
    assert.equal(tokens.map(t=>t.text).join('').replace(/\s/g,''),l.text.replace(/\s/g,''),l.id);
    for(const token of tokens)assert.equal(token.level,vocabulary[token.text]?.level??null,`${l.id}: ${token.text}`);
  }
});
test('audio intervals are monotone and every lesson reports alignment quality',()=>{
  for(const l of lessons){
    assert.ok(['machine-aligned','needs-review'].includes(l.alignmentStatus),`${l.id}: ${l.alignmentStatus}`);
    assert.ok(l.alignmentQuality?.method.includes('forced alignment'));
    const tokens=l.paragraphs.flatMap(p=>p.sentences.flatMap(s=>s.tokens));
    let previous=0;
    for(const t of tokens.filter(t=>t.start!=null)){
      assert.ok(Number.isFinite(t.start)&&Number.isFinite(t.end)&&t.start>=0&&t.end>t.start,`${l.id}: ${t.text}`);
      assert.ok(t.start+.001>=previous,`${l.id}: timestamp order at ${t.text}`);
      previous=t.start;
    }
  }
});
test('custom text can surface supported conditional grammar',()=>{
  const grammar=grammarFor({text:'如果今天有时间，我就去图书馆。',paragraphs:[{sentences:[{text:'如果今天有时间，我就去图书馆。'}]}]});
  assert.ok(grammar.some(g=>g.point==='如果'&&g.examples.length===1));
});
