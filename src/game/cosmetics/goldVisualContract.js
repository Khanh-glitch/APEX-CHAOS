// CP11 / Gold fidelity admission. This is PRESENTATION metadata only: it
// cannot add combat authority, scene scheduling, draw calls or a second clock.
// A curated Gold skin is incomplete unless every expected visual pass and
// event family is explicitly accounted for before registration.
export const GOLD_PASSES=Object.freeze({
  hero:Object.freeze(['actor','worldBack','worldFront','targetLock','targetMeasure']),
  weapon:Object.freeze(['weapon','projectile','blast']),
});
const id=/^[a-z][a-z0-9-]*$/;
function nonempty(v){return typeof v==='string'&&v.trim().length>0;}
function uniqueStrings(values,label,allowed){
  if(!Array.isArray(values)||!values.length)throw Error('Gold visual '+label+' must be a nonempty array');
  const seen=new Set();
  for(const v of values){
    if(!nonempty(v)||seen.has(v)||allowed&&!allowed.includes(v))
      throw Error('Gold visual '+label+' invalid/duplicate: '+String(v));
    seen.add(v);
  }
  return Object.freeze([...values]);
}
// Contract is verified against the actual render callbacks, never a separate
// list of pretend hooks. "required" means missing hooks reject registration.
export function validateGoldVisualContract(def){
  if(def?.fidelity==null)return null;
  if(def.fidelity!=='owner-gold')throw Error('Unsupported cosmetic fidelity tier');
  const c=def.visualContract,kind=def.kind;
  if(!c||c.version!==1||!nonempty(c.ownerReference))
    throw Error('Owner Gold visual contract requires version 1 and ownerReference');
  const allowed=GOLD_PASSES[kind];
  if(!allowed)throw Error('Invalid Gold visual contract kind');
  const passes=uniqueStrings(c.requiredPasses,'requiredPasses',allowed);
  const actual=Object.keys(def.render||{});
  for(const pass of passes){
    if(typeof def.render?.[pass]!=='function')throw Error('Gold visual pass missing renderer: '+pass);
  }
  for(const pass of actual){
    if(!passes.includes(pass))throw Error('Gold renderer not declared in visual contract: '+pass);
  }
  if(!Array.isArray(c.families)||!c.families.length)
    throw Error('Gold visual contract must declare event families');
  const seen=new Set(),families=[];
  for(const family of c.families){
    if(!family||typeof family.name!=='string'||!id.test(family.name)||seen.has(family.name))
      throw Error('Invalid/duplicate Gold visual family: '+String(family?.name));
    seen.add(family.name);
    if(!nonempty(family.nativeSource)||!nonempty(family.proof))
      throw Error('Gold visual family missing native source/proof: '+family.name);
    const hooks=uniqueStrings(family.passes,'family '+family.name+' passes',passes);
    families.push(Object.freeze({
      name:family.name,nativeSource:family.nativeSource,
      passes:hooks,proof:family.proof
    }));
  }
  return Object.freeze({
    version:1,ownerReference:c.ownerReference,
    requiredPasses:passes,families:Object.freeze(families),
  });
}
