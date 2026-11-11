// WORLD ONTOLOGY D1/D4 REFERENCE ONLY (not loaded by game runtime).
// A commercial "skin" may include a cosmetic AND an approved GameplayVariant.
// Marketplace/entitlement may select content, NEVER directly mutate simulation.
// A ModePolicy decides whether a GameplayVariant is allowed, normalized or denied.
// Do not hand-register weapon IDs here: pass effective content from real registry.
const result=(status,reason,extra={})=>Object.freeze({status,reason,...extra});
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ident=x=>typeof x==='string'&&/^[A-Za-z0-9_.:-]+$/.test(x);
const copy=x=>Array.isArray(x)?x.map(copy):record(x)?
  Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copy(v)])):x;
const ordered=x=>Array.isArray(x)?x.map(ordered):record(x)?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const seal=x=>{if(record(x)||Array.isArray(x)){Object.values(x).forEach(seal);Object.freeze(x);}return x;};
export const BASE_PRESENTATION_CHANNELS=Object.freeze([
  'heroModel','weaponSprite','projectileSprite','impactVfx','muzzleVfx',
  'streamVfx','trailVfx','uiTheme','animationSet','sfxSet'
]);
const allowedVariantPolicies=new Set(['allow','normalize','deny']);
export function resolveEffectiveContent({
  equipment, cosmetic=null, gameplayVariant=null, modePolicy=null,
  registries={}
}={}) {
  if(!record(equipment)||!ident(equipment.id)||!record(equipment.gameplay)
    ||!ident(equipment.executorId))
    return result('unresolved','missing-effective-base-definition');
  // Presentation channels are explicitly declared: unknown art channels need
  // their own versioned schema instead of being treated as mechanics.
  const presentationChannels=new Set([
    ...BASE_PRESENTATION_CHANNELS,
    ...(Array.isArray(registries.presentationChannels)?registries.presentationChannels:[])
  ]);
  if(cosmetic!==null) {
    if(!record(cosmetic)||!ident(cosmetic.id)||!record(cosmetic.changes))
      return result('unresolved','invalid-cosmetic');
    for(const [channel,asset] of Object.entries(cosmetic.changes)) {
      if(!presentationChannels.has(channel)||!ident(asset))
        return result('denied','cosmetic-contains-nonpresentation-or-invalid-channel',{
          channel
        });
    }
  }
  const base=copy(equipment.gameplay);
  let effective=copy(base),variantApplied=null;
  if(gameplayVariant!==null) {
    if(!record(gameplayVariant)||!ident(gameplayVariant.id)||
       gameplayVariant.baseId!==equipment.id||
       !ident(gameplayVariant.executorId)||
       !Array.isArray(gameplayVariant.changes)||gameplayVariant.changes.length===0)
      return result('unresolved','invalid-gameplay-variant-declaration');
    // No executor can be guessed from weapon name; caller must supply the
    // canonical contract list from the runtime/admission graph.
    const executor=registries.executors?.[gameplayVariant.executorId];
    if(!executor||!Array.isArray(executor.allowedFields))
      return result('unresolved','variant-executor-contract-not-registered');
    const allowed=new Set(executor.allowedFields);
    const seen=new Set();
    for(const entry of gameplayVariant.changes){
      if(!record(entry)||!ident(entry.field)||seen.has(entry.field))
        return result('unresolved','invalid-or-duplicate-variant-knob');
      seen.add(entry.field);
      if(!allowed.has(entry.field))
        return result('unresolved','unregistered-variant-knob',{field:entry.field});
      if(typeof entry.value!=='string'&&
         !(typeof entry.value==='number'&&Number.isFinite(entry.value))&&
         typeof entry.value!=='boolean')
        return result('unresolved','unsupported-variant-value',{field:entry.field});
      // A genuinely new mechanic field must have a registered executor and
      // formal contract; it is not made valid by changing a string ID.
      if(!Object.hasOwn(base,entry.field)&&
         !executor.allowNewMechanicFields?.includes(entry.field))
        return result('unresolved','variant-adds-unknown-gameplay-semantics',{
          field:entry.field
        });
    }
    if(!record(modePolicy)||!ident(modePolicy.id)||
       !allowedVariantPolicies.has(modePolicy.variantPolicy))
      return result('unresolved','missing-explicit-mode-variant-policy');
    if(modePolicy.variantPolicy==='deny')
      return result('denied','gameplay-variant-prohibited-by-mode',{modeId:modePolicy.id});
    if(modePolicy.variantPolicy==='allow') {
      for(const change of gameplayVariant.changes)effective[change.field]=copy(change.value);
      variantApplied=gameplayVariant.id;
    }
    // 'normalize': keep base mechanics even when the product owns an alternate
    // visual skin. Source gameplay variant cannot secretly influence simulation.
  }
  // Cosmetic and store data are EXCLUDED from simulation fingerprint.
  const fingerprintInput=JSON.stringify(ordered({
    equipmentId:equipment.id,
    executorId:variantApplied?gameplayVariant.executorId:equipment.executorId,
    appliedVariantId:variantApplied,
    gameplay:effective
  }));
  return result('allowed','content-package-resolved',{
    gameplay:seal(copy(effective)),
    presentation:seal(copy(cosmetic?.changes||{})),
    effectiveExecutorId:variantApplied?gameplayVariant.executorId:equipment.executorId,
    gameplayVariantApplied:variantApplied,
    modeVariantPolicy:gameplayVariant?modePolicy.variantPolicy:'base-only',
    fingerprintInput
  });
}
