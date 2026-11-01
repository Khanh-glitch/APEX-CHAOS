#!/usr/bin/env node
// Verify the Windows app is a byte-exact dist copy plus its SHA marker; retain
// the launcher shell and a self-contained verifier/restorer without a second dist.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, lstatSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function fileMap(root, omit = new Set()) {
  const out = {};
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name), rel = relative(root, full).split('\\').join('/');
      if (omit.has(rel)) continue;
      if (entry.isSymbolicLink()) throw new Error(`Symlink not supported: ${rel}`);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out[rel] = createHash('sha256').update(readFileSync(full)).digest('hex');
      else throw new Error(`Unsupported entry: ${rel}`);
    }
  }
  walk(root); return out;
}
function same(a,b, label) {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const differences = keys.filter(k => a[k] !== b[k]);
  if (differences.length) throw new Error(`${label} mismatch: ${differences.slice(0, 10).join(', ')}`);
}
function prepare(dist, launcher, stage) {
  dist=resolve(dist); launcher=resolve(launcher); stage=resolve(stage);
  if (stage === launcher || stage.startsWith(launcher + '/') || stage === dist || stage.startsWith(dist + '/')) throw new Error('Stage must be outside inputs');
  const app=join(launcher,'app'); const sha=readFileSync(join(app,'ARSENAL_BUILD_SHA.txt'),'utf8').trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('Invalid build SHA');
  const distFiles=fileMap(dist);
  if (!Object.keys(distFiles).length || distFiles['ARSENAL_BUILD_SHA.txt']) throw new Error('Missing dist or SHA marker collision');
  same(distFiles,fileMap(app,new Set(['ARSENAL_BUILD_SHA.txt'])),'Windows app vs dist');
  rmSync(stage,{recursive:true,force:true});
  cpSync(launcher,stage,{recursive:true,filter:source=>resolve(source)!==resolve(app)});
  mkdirSync(join(stage,'app'),{recursive:true});
  copyFileSync(join(app,'ARSENAL_BUILD_SHA.txt'),join(stage,'app','ARSENAL_BUILD_SHA.txt'));
  copyFileSync(fileURLToPath(import.meta.url),join(stage,'restore-launcher.mjs'));
  const manifest={schema:'apex-arsenal-launcher-layout-v1',source_sha:sha,dist_files:distFiles,launcher_files:fileMap(stage)};
  writeFileSync(join(stage,'artifact-layout-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`Verified ${Object.keys(distFiles).length} dist/app files; SHA ${sha}; launcher staged at ${stage}`);
}
function restore(dist,stage,output) {
  dist=resolve(dist);stage=resolve(stage);output=resolve(output);
  if (output===stage || output===dist || output.startsWith(stage+'/') || output.startsWith(dist+'/')) throw new Error('Output must be separate from inputs');
  const manifest=JSON.parse(readFileSync(join(stage,'artifact-layout-manifest.json'),'utf8'));
  if (manifest.schema!=='apex-arsenal-launcher-layout-v1') throw new Error('Unsupported manifest');
  same(manifest.dist_files,fileMap(dist),'downloaded dist');
  same(manifest.launcher_files,fileMap(stage,new Set(['artifact-layout-manifest.json'])),'downloaded launcher');
  if (readFileSync(join(stage,'app','ARSENAL_BUILD_SHA.txt'),'utf8').trim()!==manifest.source_sha) throw new Error('SHA marker mismatch');
  if (lstatExists(output)) throw new Error('Output already exists; refusing to overwrite');
  cpSync(stage,output,{recursive:true}); cpSync(dist,join(output,'app'),{recursive:true});
  same(manifest.dist_files,fileMap(join(output,'app'),new Set(['ARSENAL_BUILD_SHA.txt'])),'restored app');
  console.log(`Restored launcher ${output}; SHA ${manifest.source_sha}; ${Object.keys(manifest.dist_files).length} files verified`);
}
function lstatExists(path) { try { lstatSync(path); return true; } catch(e) { if(e.code==='ENOENT') return false; throw e; } }
const [op,dist,launcher,output]=process.argv.slice(2);
try {
  if (!dist || !launcher || !output || !['prepare','restore'].includes(op)) throw new Error('Usage: node arsenalArtifactLayout.mjs prepare <dist> <launcher> <staging> | restore <dist> <downloaded-launcher> <new-output>');
  if(op==='prepare') prepare(dist,launcher,output); else restore(dist,launcher,output);
} catch(e) { console.error(e.message); process.exitCode=1; }
