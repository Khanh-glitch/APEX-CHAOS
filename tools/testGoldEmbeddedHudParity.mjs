import fs from 'node:fs';
import { createHash } from 'node:crypto';

// A mechanical merge-law check, never an auto-resolution.
// Quest and responsive Gold each embed Battle HUD HTML in shell.html as
// Base64: merging only the visible standalone HUD may silently leave stale
// Quest/solo/gameplay rules inside the shell payload.
const shell=fs.readFileSync('public/gold/shell.html','utf8');
const hud=fs.readFileSync('public/gold/battle-hud.html');
const scripts=[...shell.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)];
const candidates=scripts.filter(([,attrs])=>/\\bid\\s*=\\s*["']battleHudPayload["']/i.test(attrs));
if(candidates.length!==1)throw new Error('Expected exactly one embedded Battle HUD donor, found '+candidates.length);
const text=candidates[0][2].trim();
if(!/^[a-z0-9+/=\\s]+$/i.test(text))throw new Error('Embedded Battle HUD payload contains non-Base64 characters');
const embedded=Buffer.from(text.replace(/\\s+/g,''),'base64');
const sha=b=>createHash('sha256').update(b).digest('hex');
const equal=embedded.equals(hud);
console.log(JSON.stringify({matching:equal,embeddedBytes:embedded.length,standaloneBytes:hud.length,
  embeddedSha256:sha(embedded),standaloneSha256:sha(hud)},null,2));
if(!equal) {
  console.error('MERGE-BLOCKER: Shell embedded HUD differs from standalone battle-hud.html. Rebuild payload from the merged Gold HUD using canonical cutover tooling; never take an arbitrary ours/theirs Base64 blob.');
  process.exitCode=1;
}
