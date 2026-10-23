import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreFindings, groupedScores, treeUsage, boundedGit } from './benchmark-support.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('scoring uses line/column, exposes false positives/negatives and N/A', () => {
 const a={file:'src/a.ts',line:1,column:2,provider:'openai',surface:'openai-api',model_id:'gpt-test',framework:'sdk'};
 const b={...a,line:2};
 const score=scoreFindings([a],[b]);
 assert.deepEqual([score.tp,score.fp,score.fn,score.f1],[0,1,1,0]);
 assert.equal(score.false_positives[0].line,1);
 assert.equal(score.false_negatives[0].line,2);
 assert.equal(scoreFindings([],[]).precision,null);
 assert.equal(scoreFindings([],[]).recall,null);
 assert.equal(scoreFindings([],[]).f1,null);
 assert.equal(groupedScores([a],[a],'language').TypeScript.tp,1);
 assert.equal(groupedScores([a],[a],'framework').sdk.tp,1);
});
test('repository disk/file budgets reject over-budget tree',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'modeldeps-budget-'));
 try { await writeFile(path.join(dir,'a'),'12345'); await assert.rejects(treeUsage(dir,4,20),/budget/); await assert.rejects(treeUsage(dir,100,0),/budget/); }
 finally { await rm(dir,{recursive:true,force:true}); }
});
test('Git process obeys timeout',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'modeldeps-timeout-'));
 try { await assert.rejects(boundedGit(['-c','alias.wait=!sleep 2','wait'],dir,dir,{timeoutMs:50,maxBytes:100000,maxFiles:100}),/timeout/); }
 finally { await rm(dir,{recursive:true,force:true}); }
});
