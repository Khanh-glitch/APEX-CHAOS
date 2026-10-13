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
  for (const name of ['projectile','blast','actor','weapon','skill']) {
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
  if (Array.isArray(fighters)) {
    if (owner===fighters[0] || owner?.anchor===fighters[0]) return 'p1';
    if (owner===fighters[1] || owner?.anchor===fighters[1]) return 'p2';
  }
  return null; // fail to DEFAULT; never borrow the opponent's look
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
    age:Number(payload?.age)||0,life:Number(payload?.life)||0,
    scale:Number(payload?.scale)||1,
    kind:String(payload?.kind||''),skinId:entry.id,
  });
  ctx.save();
  try {
    const result=fn(ctx,pose);
    if (result && typeof result.then==='function') throw new Error('Async render skin is forbidden');
    return result===true;
  } catch (error) {
    console.warn('[cosmetic] renderer failed; retaining gameplay and original art',error);
    return false;
  } finally { ctx.restore(); }
}
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
    const promise=new Promise((resolve,reject)=>{
      if (typeof Image==='undefined') { reject(new Error('No browser image runtime'));return; }
      if (/\.(mp3|ogg)$/.test(asset)) { resolve(true);return; }
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>reject(new Error('Skin asset failed: '+asset));
      img.src=asset;
      if(img.complete && img.naturalWidth)resolve(img);
    }).then(img=>{loadedAssets.set(asset,img);return img;},e=>{assetPromises.delete(asset);throw e;});
    assetPromises.set(asset,promise);return promise;
  }));
  return Object.freeze({ready:true,assetCount:unique.length});
}
export function createCosmeticAuthority(storage=typeof window!=='undefined'?window.localStorage:null) {
  read(storage);
  return Object.freeze({
    version:'cosmetics-v1', register, variants, selected,
    equip:(side,kind,base,id)=>equip(side,kind,base,id,storage),
    snapshot, subscribe, capture,captureProjectile,sideOf,
    resolve,render,suppressDefaultBlast,ready,
  });
}
export const cosmetics=createCosmeticAuthority();
if (typeof window!=='undefined') window.APEX_COSMETICS=cosmetics;
