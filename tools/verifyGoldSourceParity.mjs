import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..','gold-mission-account','src');
// The owner JPEG is checked in as lossless base64 text because GitHub's
// contents connector uploads UTF-8. Restore exact bytes before Vite bundles it.
const binaryAsset=resolve(root,'assets','arena.jpg');
const encodedAsset=resolve(root,'assets','arena.jpg.b64');
const decoded=Buffer.from(readFileSync(encodedAsset,'utf8').replace(/\s+/g,''),'base64');
mkdirSync(resolve(root,'assets'),{recursive:true});
writeFileSync(binaryAsset,decoded);
const original=Object.freeze({
 'ui.tsx':'ce9b6eb029acb0792f92e36adb135848059dd2e8b6064e12f9efcc960034d50e',
 'fx.tsx':'dd20d4bc77bc6341ea41e9c370886e1cc1c1dfd44c50f5b948686889b2f0a663',
 'index.css':'cc90c5967287e7559c2be1b33abe57924b78a5f3440ced4ab436d89af3af0ae3',
 'assets/arena.jpg':'063eedbdfe9a5bd4dbd8674cb44d201b8071db45dc89ee7a1f3f0d9a482ff3a4',
});
for(const [file,expected] of Object.entries(original)){
 const hash=createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex');
 if(hash!==expected)throw new Error(`Gold visual source modified: ${file} ${hash} !== ${expected}`);
 console.log(`PASS EXACT OWNER GOLD ${file}`);
}
const store=readFileSync(resolve(root,'store.ts'),'utf8');
if(/apex-chaos-gold-v1|Guest_Raven|1850/.test(store))throw new Error('Prototype fake wallet or sample identity in production Gold store');
const missions=readFileSync(resolve(root,'Missions.tsx'),'utf8');
if(/PHÒNG LUYỆN TẬP · DEMO|onClick=\{\(\) => demo/.test(missions))throw new Error('Gold demo match controls still shipped');
console.log('PASS no demo economy controls');
