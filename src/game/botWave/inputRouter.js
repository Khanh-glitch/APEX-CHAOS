// Shared input semantics for BOT WAVE. Both desktop keydown and mobile touch
// call the same action router. No DOM/UI implementation or synthetic keypresses.
// This prevents the locked ultimate from being triggered through hidden hotkeys.
import {BOXE_WAVE} from '../boxe/boxeConfig.js';
import {unlockedKeys,enabledGoldSkills} from './upgradeRegistry.js';

const ACTIONS=Object.freeze(['J','K','L','U','I']);
export function waveControlsFor(state){
 const keys=unlockedKeys(state);
 const gold=new Set(enabledGoldSkills(state));
 return ACTIONS.map(key=>Object.freeze({
  key,enabled:keys.includes(key),
  inputMethod:'keyboard-or-touch',
  baseAction:BOXE_WAVE.controls[key].base,
  goldKey:BOXE_WAVE.controls[key].goldKey,
  goldEnabled:BOXE_WAVE.controls[key].goldKey?gold.has(BOXE_WAVE.controls[key].goldKey):false
 }));
}
export function createWaveInputRouter({getUpgradeState,onAction=()=>{}}){
 if(typeof getUpgradeState!=='function')throw Error('NO_UPGRADE_AUTHORITY');
 function trigger(key,{source='keyboard',phase='press'}={}){
  const normalized=String(key||'').toUpperCase();
  const c=waveControlsFor(getUpgradeState()).find(a=>a.key===normalized);
  if(!c||!c.enabled)return {accepted:false,reason:'LOCKED_OR_UNKNOWN_ACTION'};
  if(!['press','release'].includes(phase))throw Error('INVALID_ACTION_PHASE');
  if(!['keyboard','touch','gamepad'].includes(source))throw Error('UNTRUSTED_INPUT_SOURCE');
  onAction({type:'wave:control',action:normalized,source,phase,goldKey:c.goldKey,
    activeGoldKeys:enabledGoldSkills(getUpgradeState())});
  return {accepted:true,action:normalized};
 }
 return {trigger,controls:()=>waveControlsFor(getUpgradeState())};
}
// Mobile auto-targeting is a deterministic aim suggestion only, not proof of
// hit, and never applies gameplay damage. The gameplay engine still owns LOS.
export function pickWaveAutoTarget({x,y},candidates){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 const eligible=(candidates||[]).filter(e=>e&&e.alive!==false&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&e.id);
 if(!eligible.length)return null;
 const sorted=eligible.map(e=>({id:e.id,d2:(e.x-x)**2+(e.y-y)**2}))
  .sort((a,b)=>a.d2-b.d2||String(a.id).localeCompare(String(b.id)));
 return sorted[0].id;
}
export function joystickVector(dx,dy,deadZone=.12){
 const x=Number.isFinite(dx)?dx:0,y=Number.isFinite(dy)?dy:0,m=Math.hypot(x,y);
 if(m<deadZone)return {x:0,y:0};
 return {x:+(x/Math.max(1,m)).toFixed(5),y:+(y/Math.max(1,m)).toFixed(5)};
}
