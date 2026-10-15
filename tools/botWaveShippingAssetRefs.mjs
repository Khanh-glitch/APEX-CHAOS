// Strict native Arsenal asset dependency extraction for the boxed 25MB Gold
// game. Parsing once saves rescanning its 20MB embedded image data thousands
// of times in tools/assetAudit.mjs. No per-gun handwritten shipping list.
import {APEX_WAVE_GUNS} from '../src/game/botWave/apexGunLoadouts.js';
const ALLOWED=new Set(['png','webp','ogg','mp3','wav']);
export function botWaveShippingAssetRefs(goldHtml){
 if(typeof goldHtml!=='string'||!goldHtml.includes('APEX_GUN_ART')||
   !goldHtml.includes('waveGunCue')||!goldHtml.includes('WAVE_STICKY_ASSIST'))
  throw Error('BOXE_GOLD_R5_RUNTIME_NOT_INTACT');
 const paths=new Set();
 for(const id of Object.keys(APEX_WAVE_GUNS)){
  if(!/^[A-Z0-9_]+$/.test(id))throw Error('INVALID_APEX_GUN_ID_'+id);
  paths.add('/assets/arsenal/weapons/c/'+id+'.png');
 }
 for(const match of goldHtml.matchAll(/\/assets\/arsenal\/av\/sfx\/[A-Za-z0-9_./-]+\.(?:mp3|ogg|wav)/g)){
  paths.add(match[0]);
 }
 for(const item of paths){
  const ext=item.slice(item.lastIndexOf('.')+1);
  if(!ALLOWED.has(ext)||item.includes('..'))throw Error('INVALID_BOT_WAVE_ASSET_'+item);
 }
 if(paths.size<=Object.keys(APEX_WAVE_GUNS).length)throw Error('BOT_WAVE_NO_GUN_SFX');
 return [...paths].sort();
}
