// Cosmetic authority: presentation data ONLY. Weapon/hero IDs, damage,
// collision, hit provenance, cooldowns and AI are never resolved here.
// This module is evaluated before the Gold classic-script/runtime graph.
const STORAGE_KEY = 'apexChaos.cosmeticLoadout.v1';
const KINDS = new Set(['hero', 'weapon']);
const SIDES = ['p1', 'p2'];
const registry = new Map();
const loadedAssets = new Map();
const assetPromises = new Map();
const listeners = new Set();

function canonical(kind, baseId) {
  if (!KINDS.has(kind)) throw new Error('Unknown cosmetic type: ' + String(kind));
  const raw = String(baseId || '').trim().toUpperCase();
  if (!/^[A-Z0-9_]{1,90}$/.test(raw)) throw new Error('Invalid base entity ID');
  if (kind === 'hero') return ({ NEWBOT:'ROBOT', FROST:'ICE', CRYSTALA:'CRYSTAL' })[raw] || raw;
  return raw;
}
function validSide(side) {
  if (!SIDES.includes(side)) throw new Error('Invalid cosmetic owner side');
  return side;
}
function key(kind, baseId, skinId) { return kind + ':' + canonical(kind,baseId) + ':' + skinId; }
function fresh() {
  return { version:1, p1:{hero:{},weapon:{}}, p2:{hero:{},weapon:{}} };
}
function clean(raw) {
  const data = fresh();
  for (const side of SIDES) for (const kind of KINDS) {
    const src = raw?.[side]?.[kind];
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    for (const [base,skin] of Object.entries(src).slice(0,400)) {
      try {
        const id = canonical(kind,base);
        if (typeof skin === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(skin))
          data[side][kind][id] = skin;
      } catch (_) {}
    }
  }
  return data;
}
let loadout = fresh();
function read(storage) {
  try {
    const raw = storage?.getItem?.(STORAGE_KEY);
    loadout = raw ? clean(JSON.parse(raw)) : fresh();
  } catch (_) { loadout = fresh(); }
}
function persist(storage) {
  try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(loadout)); return true; }
  catch (_) { return false; }
}
function emit() {
  for (const fn of listeners) { try { fn(snapshot()); } catch (_) {} }
}
function safeAsset(asset) {
  if (typeof asset !== 'string' || !/^\/(assets|gold\/assets)\/[a-zA-Z0-9_./-]+\.(png|webp|jpg|jpeg|svg|ogg|mp3)$/.test(asset) || asset.includes('..'))
    throw new Error('Cosmetic asset must be a declared first-party path');
  return asset;
}
function register(def) {
  const kind = def?.kind, baseId = canonical(kind,def?.baseId);
  const id = String(def?.id || '');
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || id === 'default') throw new Error('Invalid non-default skin ID');
  if (Object.keys(def).some(k => /^(damage|speed|cooldown|knockback|blastRadius|radius|tier|weaponId|heroId|gameplay|physics)$/i.test(k)))
    throw new Error('A skin is forbidden to define gameplay authority');
  const idKey = key(kind,baseId,id);
  if (registry.has(idKey)) throw new Error('Duplicate cosmetic owner: '+idKey);
  const assets = Object.freeze([...(def.assets || [])].map(safeAsset));
  const hooks = {};
  for (const name of ['projectile','blast','actor','weapon','skill','worldBack','worldFront']) {
    if (def.render?.[name] != null) {
      if (typeof def.render[name] !== 'function') throw new Error('Skin render hook must be synchronous');
      hooks[name] = def.render[name];
    }
  }
  const record = Object.freeze({
    kind, baseId, id, label:String(def.label || id).slice(0,95),
    detail:String(def.detail || '').slice(0,240),
    preview:def.preview ? safeAsset(def.preview):null,
    assets, render:Object.freeze(hooks),
    prepare:typeof def.prepare==='function'?def.prepare:null,
    blastSeconds:Math.max(0,Math.min(3,Number(def.blastSeconds)||0)),
    trailHistorySeconds:Math.max(0,Math.min(3,Number(def.trailHistorySeconds)||0)),
    // A skin that renders its own flight trail owns that visual pass exclusively.
    // This never affects engine projectile physics, collision or default weapons.
    suppressBaseTrail:!!def.suppressBaseTrail && typeof hooks.projectile === 'function',
    suppressBaseBlast:!!def.suppressBaseBlast && typeof hooks.blast === 'function',
  });
  registry.set(idKey,record);
  emit();
  return record;
}
function variants(kind, baseId) {
  const id = canonical(kind,baseId);
  const defaults = Object.freeze({ kind, baseId:id, id:'default', label:'ORIGINAL', detail:'Original appearance', preview:null,assets:[],render:Object.freeze({}),suppressBaseBlast:false });
  return [defaults,...[...registry.values()].filter(d=>d.kind===kind && d.baseId===id)];
}
function selected(side,kind,baseId) {
  validSide(side);
  const base=canonical(kind,baseId);
  const value=loadout[side][kind][base] || 'default';
  return variants(kind,base).find(v=>v.id===value) || variants(kind,base)[0];
}
function equip(side,kind,baseId,skinId,storage=typeof window!=='undefined'?window.localStorage:null) {
  validSide(side);
  const base=canonical(kind,baseId), option=variants(kind,base).find(v=>v.id===skinId);
  if (!option) return { ok:false, reason:'SKIN_NOT_REGISTERED' };
  // All available non-default cosmetic packs are explicitly registered. The
  // ownership/unlock economy can be wired later without changing game balance.
  loadout[side][kind][base]=option.id;
  const persisted=persist(storage);
  emit();
  return {ok:true,persisted,side,kind,baseId:base,skinId:option.id};
}
function snapshot() {
  return JSON.parse(JSON.stringify(loadout));
}
function subscribe(fn) {
  if (typeof fn!=='function') throw new Error('Cosmetic observer must be a function');
  listeners.add(fn);return ()=>listeners.delete(fn);
}
function sideOf(owner, scope=typeof window!=='undefined'?window:null) {
  if (!owner) return null;
  const fighters=scope?.fighters;
  if (!Array.isArray(fighters)) return null;
  // The main engine-owned bodies are the fast path. Do not infer cosmetic
  // ownership from the current projectile owner after a reflection.
  const body=owner?.anchor || owner;
  if (body===fighters[0]) return 'p1';
  if (body===fighters[1]) return 'p2';

  // A promoted anchor, summoned body, clone or other future physical fighter
  // may legitimately shoot while never occupying fighters[0/1]. Resolve its
  // *combatant*, not its hero name or a fixed list of six species.
  const combatant=scope?.APEX_HERO_REWORK?.byCombatant?.(body)
    || body?.__hrCombatant || null;
  const idx=combatant?.idx;
  if (!Number.isInteger(idx) || idx<0 || idx>1 || !fighters[idx]) return null;
  const member=body===combatant.anchor || body?.__hrCombatant===combatant
    || (Array.isArray(combatant.bodies) && combatant.bodies.includes(body));
  const slot=fighters[idx];
  const slotOwned=slot===combatant.anchor || slot?.__hrCombatant===combatant
    || (Array.isArray(combatant.bodies) && combatant.bodies.includes(slot));
  if (member && slotOwned) return idx===0?'p1':'p2';
  return null; // unresolved third-party bodies retain ORIGINAL presentation
}
function capture(side,kind,baseId) {
  const skin=side ? selected(side,kind,baseId) : variants(kind,baseId)[0];
  // Immutable ownership receipt. Reflection, disarm, pickup and mirror never
  // re-query a different fighter/weapon loadout during projectile flight.
  return Object.freeze({side:side||null,kind,baseId:canonical(kind,baseId),skinId:skin.id});
}
function captureProjectile(owner, weaponId, scope=typeof window!=='undefined'?window:null) {
  return capture(sideOf(owner,scope),'weapon',weaponId);
}
function resolve(receipt) {
  if (!receipt || !KINDS.has(receipt.kind)) return null;
  try {
    const record=variants(receipt.kind,receipt.baseId).find(x=>x.id===receipt.skinId);
    return record || null; // missing skin pack => do not invent an effect
  } catch (_) { return null; }
}
// Copy only scalar presentation data. No mutable combat objects enter skin renderers.
function cosmeticData(v, depth=0, maxItems=90){
 if(depth>7)return null;
 if(typeof v==='number')return Number.isFinite(v)?v:0;
 if(typeof v==='boolean'||typeof v==='string')return v;
 if(Array.isArray(v))return Object.freeze(v.slice(-maxItems).map(x=>cosmeticData(x,depth+1)));
 if(v&&typeof v==='object'){
   const result={};for(const [k,x] of Object.entries(v).slice(0,48))result[k]=cosmeticData(x,depth+1);
   return Object.freeze(result);
 }
 return null;
}
function render(name,ctx,receipt,payload) {
  const entry=resolve(receipt), fn=entry?.render?.[name];
  if (typeof fn!=='function') return false;
  // Only frozen scalar pose data reaches a skin callback; NEVER pass the
  // projectile, health target, engine state or damage receipt into skin code.
  const pose=Object.freeze({
    x:Number(payload?.x)||0,y:Number(payload?.y)||0,
    width:Number(payload?.width)||0,height:Number(payload?.height)||0,
    vx:Number(payload?.vx)||0,vy:Number(payload?.vy)||0,
    angle:Number(payload?.angle)||0,
    // Ordinary aq_bullet carriers store remaining life, not age. Every
    // family gets a monotonic visual timeline without adding a new gameplay
    // clock or mutating physical projectile state.
    age:Number.isFinite(payload?.age)?payload.age:
      Math.max(0,(Number(payload?.maxLife)||0)-(Number(payload?.life)||0)),
    life:Number(payload?.life)||0,
    scale:Number(payload?.scale)||1,
    kind:String(payload?.kind||payload?.type||''),skinId:entry.id,
    side:receipt?.side||null,
    trail:cosmeticData(Array.isArray(payload?.visual)?payload.visual:[],0,240),
    robot:cosmeticData(payload?.robot||null),
  });
  // Skin renderers may only consume resources the shared READY barrier
  // decoded for THIS skin. No render-time image constructor, network load
  // or undeclared asset is needed to show a first-frame effect.
  const resources=Object.freeze({
    get:(path)=>entry.assets.includes(path)?(loadedAssets.get(path)||null):null,
  });
  ctx.save();
  try {
    const result=fn(ctx,pose,resources);
    if (result && typeof result.then==='function') throw new Error('Async render skin is forbidden');
    return result===true;
  } catch (error) {
    console.warn('[cosmetic] renderer failed; retaining gameplay and original art',error);
    return false;
  } finally { ctx.restore(); }
}
function trailHistorySeconds(receipt) {return resolve(receipt)?.trailHistorySeconds||0;}
function suppressDefaultTrail(receipt) {return resolve(receipt)?.suppressBaseTrail===true;}
function blastDuration(receipt) {return resolve(receipt)?.blastSeconds||0;}
function suppressDefaultBlast(receipt) {
  return resolve(receipt)?.suppressBaseBlast===true;
}
async function ready(sideHeroPairs=[], storage=typeof window!=='undefined'?window.localStorage:null) {
  const all=[];
  for (const pair of sideHeroPairs) {
    if (!pair?.side || !pair?.heroId) continue;
    all.push(selected(pair.side,'hero',pair.heroId));
  }
  for(const side of SIDES) for(const base of Object.keys(loadout[side].weapon))
    all.push(selected(side,'weapon',base));
  const unique=[...new Set(all.flatMap(r=>r.assets))];
  await Promise.all(unique.map(asset=>{
    if(loadedAssets.has(asset))return loadedAssets.get(asset);
    if(assetPromises.has(asset))return assetPromises.get(asset);
    const task=/\.(mp3|ogg)$/.test(asset)
      ?fetch(asset).then(r=>{if(!r.ok)throw new Error('Skin audio failed: '+asset);return r.arrayBuffer()})
      :new Promise((resolve,reject)=>{
        if (typeof Image==='undefined') { reject(new Error('No browser image runtime'));return; }
        const img=new Image();
        let claimed=false;
        const claimLoaded=()=>{
          if (claimed) return; // cached-complete and load can report the same image
          claimed=true;
          // Downloaded is not PREPROCESSED: decode() is the actual first-frame
          // barrier for a skin sprite/atlas (the same bug class as Frost A1).
          Promise.resolve().then(()=>typeof img.decode==='function'?img.decode():true)
            .then(()=>resolve(img),()=>reject(new Error('Skin asset decode failed: '+asset)));
        };
        img.onload=claimLoaded;
        img.onerror=()=>{
          if (claimed) return;
          claimed=true;
          reject(new Error('Skin asset failed: '+asset));
        };
        img.src=asset;
        if(img.complete && img.naturalWidth)claimLoaded();
      });
    const promise=task.then(file=>{loadedAssets.set(asset,file);return file;},
      e=>{assetPromises.delete(asset);throw e;});
    assetPromises.set(asset,promise);return promise;
  }));
  await Promise.all([...new Set(all)].filter(p=>p.prepare).map(p=>Promise.resolve().then(()=>p.prepare())));
  return Object.freeze({ready:true,assetCount:unique.length});
}
export function createCosmeticAuthority(storage=typeof window!=='undefined'?window.localStorage:null) {
  read(storage);
  return Object.freeze({
    version:'cosmetics-v1', register, variants, selected,
    equip:(side,kind,base,id)=>equip(side,kind,base,id,storage),
    snapshot, subscribe, capture,captureProjectile,sideOf,
    resolve,render,suppressDefaultBlast,blastDuration,trailHistorySeconds,ready,
  });
}
export const cosmetics=createCosmeticAuthority();
if (typeof window!=='undefined') window.APEX_COSMETICS=cosmetics;
