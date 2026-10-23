#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const report=path.join(root,'reports/verification');
mkdirSync(report,{recursive:true});
const results=[];
function run(name, executable, args, expected=0) {
 const npm=executable==='npm';
 const actual=npm&&process.platform==='win32'?'npm.cmd':executable;
 let r;
 if (npm && process.platform==='win32') {
   if (args.some(a=>/["%\r\n]/.test(a))) throw new Error('Unsafe npm argument');
   const command=actual+' '+args.map(a=>'"'+a+'"').join(' ');
   r=spawnSync(command,{cwd:root,encoding:'utf8',timeout:180000,shell:true});
 } else r=spawnSync(actual,args,{cwd:root,encoding:'utf8',timeout:180000});
 writeFileSync(path.join(report,`final-${name}.log`),(r.stdout??'')+(r.stderr??''));
 results.push({name,command:[executable,...args],exit_code:r.status,expected,matched:r.status===expected,error:r.error?.message});
 if (['install','tests','build'].includes(name) && r.status!==expected) {
   writeFileSync(path.join(report,'final-commands.json'),JSON.stringify({at:new Date().toISOString(),results,stopped:'Required prerequisite failed; no packaging attempted'},null,2));
   console.error(`${name}: FAIL (exit ${r.status}; expected ${expected})`);
   if(r.error) console.error(r.error.message);
   console.error(((r.stdout??'')+(r.stderr??'')).slice(-16000));
   process.exit(1);
 }
 return r;
}
run('install','npm',['ci']);
run('tests','npm',['test']);
run('benchmark',process.execPath,['scripts/benchmark.mjs']);
const demoFixturePath='reports/verification/demo-registry.fixture.json';
const demoFixture=JSON.parse(readFileSync('demo/registry.fixture.json','utf8'));
demoFixture.generated_at=new Date().toISOString();
for(const record of demoFixture.models) {
 for(const source of [record.source,record.replacement_source].filter(Boolean)) {
  if(source.kind!=='fixture') throw new Error('Cannot refresh official observation dates as demo data');
  source.observed_at=demoFixture.generated_at;
 }
}
writeFileSync(demoFixturePath,JSON.stringify(demoFixture,null,2));
const cli=['dist/cli.js'];
run('version',process.execPath,[...cli,'--version']);
run('registry',process.execPath,[...cli,'registry','validate']);
run('healthy',process.execPath,[...cli,'check','demo/repository/healthy','--registry',demoFixturePath]);
run('retired',process.execPath,[...cli,'check','demo/repository/retired','--registry',demoFixturePath],1);
const plan='reports/verification/demo-plan.json';
run('plan',process.execPath,[...cli,'plan','demo/repository/migration-breaks-tool-use','--registry',demoFixturePath,'--output',plan]);
for (const [name,command,exit] of [['eval-failed','node -e "process.exit(1)"',1],['eval-passed','node -e "process.exit(0)"',0],['eval-missing',undefined,1]]) {
 run(name,process.execPath,[...cli,'verify','--plan',plan,'--registry',demoFixturePath,...(command?['--command',command]:[]),'--output',`reports/verification/${name}.json`],exit);
}
run('apply-dry',process.execPath,[...cli,'apply','--plan',plan,'--registry',demoFixturePath],1);
run('pack-dry','npm',['pack','--ignore-scripts','--dry-run','--json']);
const pack=run('pack','npm',['pack','--ignore-scripts','--json','--pack-destination','reports/verification']);
try {
 const info=JSON.parse(pack.stdout)[0];
 const forbidden=info.files.filter(f=> /(^|\/)(node_modules|reports|\.git|\.env)(\/|$)|\.test\.|\.log$|\.backup$|\.tmp$/.test(f.path));
 if (forbidden.length) throw new Error(`Forbidden package paths: ${forbidden.map(f=>f.path).join(', ')}`);
 for (const f of info.files) {
   if (f.size>12000000) throw new Error(`Oversize package file: ${f.path}`);
   const text=readFileSync(path.join(root,f.path),'utf8');
   if (/sk-[A-Za-z0-9]{24,}|ghp_[A-Za-z0-9]{30,}|[CD]:\\(?:Users|16479)\\/.test(text)) throw new Error(`Potential secret/personal path: ${f.path}`);
 }
 results.push({name:'package-content-audit',exit_code:0,expected:0,matched:true});
 const temp=mkdtempSync(path.join(os.tmpdir(),'modeldeps-package-'));
 const tgz=path.join(root,'reports/verification',info.filename);
 run('install-package','npm',['install','--prefix',temp,'--ignore-scripts','--no-audit','--no-fund',tgz]);
 run('installed-version',process.execPath,[path.join(temp,'node_modules/modeldeps-cli/dist/cli.js'),'--version']);
 run('installed-registry',process.execPath,[path.join(temp,'node_modules/modeldeps-cli/dist/cli.js'),'registry','validate']);
} catch(error) { results.push({name:'package-content-audit',matched:false,error:error.message}); }
writeFileSync(path.join(report,'final-commands.json'),JSON.stringify({at:new Date().toISOString(),node:process.version,platform:process.platform,results},null,2));
for (const result of results) console.log(`${result.name}: ${result.matched?'PASS':'FAIL'} (exit ${result.exit_code})`);
if (results.some(r=>!r.matched)) process.exitCode=1;
