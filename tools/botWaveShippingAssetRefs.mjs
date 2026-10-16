// BOT WAVE — shipping dependency audit derived from the exact native
// P0 weapon registry, not a second set of manually listed wave guns.
import fs from 'node:fs';
import vm from 'node:vm';
const ALLOWED=new Set(['png','webp','ogg','mp3','wav']);
let cached;
function nativeConfig(){
 if(cached)return cached;
 const win={addEventListener(){},removeEventListener(){}};
 const doc={getElementById(){return null},createElement(){return {style:{},append(){},appendChild(){},remove(){}}},addEventListener(){},querySelector(){return null}};
 win.window=win;win.document=doc;
 const source=fs.readFileSync('public/game/arsenal/arsenalConfig.js','utf8');
 vm.runInNewContext(source,{window:win,document:doc,console,
  setTimeout(){return 0},clearTimeout(){},Math,Date},{timeout:2000});
 cached=win.APEX_ARSENAL_CONFIG;
 if(!cached||cached.P0_WEAPON_IDS?.length!==41)throw Error('BOT_WAVE_NATIVE_41_REGISTRY_UNAVAILABLE');
 return cached;
}
export function nativeWaveWeaponAssetRefs(){
 const config=nativeConfig();
 return config.P0_WEAPON_IDS.map(id=>{
  if(!/^[A-Z0-9_]+$/.test(id))throw Error('INVALID_APEX_GUN_ID_'+id);
  if(!config.WEAPONS[id])throw Error('MISSING_NATIVE_WEAPON_'+id);
  return config.V43_WEAPONS?.[id]?.art||
   (id==='STORMBREAKER'?'/assets/arsenal/weapons/c/STORMBREAKER.webp':
    '/assets/arsenal/weapons/c/'+id+'.png');
 }).sort();
}
export function botWaveShippingAssetRefs(goldHtml){
 if(typeof goldHtml!=='string'||!goldHtml.includes('APEX_GUN_ART')||
   !goldHtml.includes('waveGunCue')||!goldHtml.includes('WAVE_STICKY_ASSIST'))
  throw Error('BOXE_GOLD_R5_RUNTIME_NOT_INTACT');
 const paths=new Set(nativeWaveWeaponAssetRefs());
 for(const m of goldHtml.matchAll(/\\/assets\\/arsenal\\/av\\/sfx\\/[A-Za-z0-9_./-]+\\.(?:mp3|ogg|wav)/g))paths.add(m[0]);
 for(const item of paths){
  const ext=item.slice(item.lastIndexOf('.')+1);
  if(!ALLOWED.has(ext)||item.includes('..'))throw Error('INVALID_BOT_WAVE_ASSET_'+item);
 }
 if(paths.size<=41)throw Error('BOT_WAVE_NO_ARSENAL_SFX');
 return [...paths].sort();
}
