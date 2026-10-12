// D0-D4 REFERENCE ONLY. This is not loaded by runtimeManifest or game.
// Owner 2026-10-13: Crystala A1 Wall/HEXA reflects the original attack Stream.
// The real stream collision authority must supply actual contact witnesses.
const ret = (status, reason, extra={}) => Object.freeze({status,reason,...extra});
const str = x => typeof x === 'string' && x.length > 0;
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const unit = v => {
  const n=Math.hypot(v.x,v.y);
  return n > 1e-9 ? {x:v.x/n,y:v.y/n} : null;
};
export function previewCrystalaStreamRedirect(sample, contacts, context={}) {
  if(!sample || sample.carrierForm!=='stream') return ret('denied','not-a-stream');
  if(sample.protection==='T6' || sample.tier==='T6')
    return ret('denied','t6-manipulation-protected');
  if(!str(sample.attackId)||!str(sample.sliceId)||!str(sample.originSource))
    return ret('unresolved','missing-semantic-attack-identity');
  if(!Number.isFinite(sample.tick)||sample.tick<0||!point(sample.direction)||!unit(sample.direction))
    return ret('unresolved','invalid-stream-sample');
  if(!Array.isArray(contacts))
    return ret('unresolved','missing-authoritative-contact-witness');
  if(!str(context.crystalController)) return ret('unresolved','missing-crystal-controller');
  for(const c of contacts) {
    if(!c||!str(c.id)||!['construct','body','world'].includes(c.kind)||
       !Number.isFinite(c.t)||c.t<0||c.t>1||!point(c.point))
      return ret('unresolved','invalid-contact-witness');
    if(c.kind==='construct'&&(!['wall','hexa'].includes(c.constructForm)||
       !str(c.constructId)||typeof c.solid!=='boolean'||
       typeof c.hostile!=='boolean'||!point(c.normal)||!unit(c.normal)))
      return ret('unresolved','incomplete-construct-contact-witness');
  }
  // Injected witnesses must already come from REAL attack collision geometry.
  // Sorting here is not a substitute for swept/volumetric collision detection.
  const sorted=[...contacts].sort((a,b)=>a.t-b.t||a.id.localeCompare(b.id));
  const first=sorted[0];
  if(!first) return ret('denied','no-contact');
  if(first.kind!=='construct') return ret('denied','earlier-nonconstruct-contact');
  if(!first.solid) return ret('denied','construct-not-solid');
  if(!first.hostile) return ret('denied','own-or-allied-stream');
  const direction=unit(sample.direction),normal=unit(first.normal);
  const incidence=direction.x*normal.x+direction.y*normal.y;
  if(incidence>=-1e-9) return ret('unresolved','invalid-incidence-or-surface-normal');
  const reflected=unit({x:direction.x-2*incidence*normal.x,
                        y:direction.y-2*incidence*normal.y});
  const receiptKey=[sample.attackId,sample.tick,sample.sliceId,first.constructId,first.id].join(':');
  return ret('allowed','same-carrier-stream-reflection-preview',{
    receiptKey,
    plan:Object.freeze({
      ownerAbility:'crystal.context_construct', // WALL and HEXA = same A1
      attackId:sample.attackId,tick:sample.tick,sliceId:sample.sliceId,
      carrierForm:'stream', // do NOT synthesize a projectile
      originSource:sample.originSource,fromController:sample.controller??null,
      toController:context.crystalController,contactAt:first.t,
      contactPoint:Object.freeze({...first.point}),
      reflectedDirection:Object.freeze(reflected),
      constructId:first.constructId,constructForm:first.constructForm,
      facetId:first.facetId??null,
      structuralOutcome:'REQUIRES_AUTHORITATIVE_WALL_OR_HEXA_ADJUDICATION',
      damageOutcome:'NO_DAMAGE_APPLIED_IN_REFERENCE'
    })
  });
}
// Shared A1 impact rule for BOTH Wall and HEXA. No HP mutation in reference.
// Each true projectile hit OR real Stream damage tick is one impact.
// Returns an authoritative-transaction SHAPE, NOT a live game transaction.
export function adjudicateA1ConstructImpact(surface, hit) {
  if(!surface || !['wall','hexa'].includes(surface.form) || !str(surface.id))
    return ret('unresolved','unknown-construct-surface');
  if(!Number.isFinite(surface.hp) || !(surface.hp>0))
    return ret('unresolved','invalid-or-inactive-surface-hp');
  if(!hit || !Number.isFinite(hit.structuralDamage) || !(hit.structuralDamage>0))
    return ret('unresolved','missing-positive-structural-damage');
  if(!['projectile','stream'].includes(hit.carrierForm))
    return ret('unresolved','unknown-attack-carrier');
  const breaking = hit.structuralDamage >= surface.hp;
  return ret('allowed',breaking?'breaking-hit-passes-through':'nonbreaking-hit-reflects',{
    effect:breaking?'break-through':'reflect',
    surfaceId:surface.id,
    form:surface.form,
    hpBefore:surface.hp,
    hpAfter:Math.max(0,surface.hp-hit.structuralDamage),
    damageApplied:hit.structuralDamage,
    originalAttackContinues:breaking,
    reflectOriginalAttack:!breaking,
    // No residual-damage arithmetic. Breaking strike retains its FULL payload.
    damageOutcome:'NO_DAMAGE_APPLIED_IN_REFERENCE'
  });
}

// A preview may only be committed after an actual collision/structural witness.
// A formerly injected "reflect-first" HEXA outcome is actively rejected.
export function approveStreamReflectionPreview(preview, structural, seen) {
  if(preview?.status!=='allowed') return preview??ret('unresolved','missing-preview');
  if(!seen||typeof seen.has!=='function'||typeof seen.add!=='function')
    return ret('unresolved','missing-receipt-deduplication-authority');
  if(!structural||structural.constructId!==preview.plan.constructId)
    return ret('unresolved','missing-or-mismatched-structural-witness');
  if(seen.has(preview.receiptKey))
    return ret('denied','stream-tick-already-adjudicated');
  // The input must report the *current* HP of the exact collided Wall / HEXA facet.
  const adjudication=adjudicateA1ConstructImpact({
    id:structural.constructId,
    form:preview.plan.constructForm,
    hp:structural.hpBefore
  },{
    carrierForm:'stream',
    structuralDamage:structural.structuralDamage
  });
  if(adjudication.status!=='allowed') return adjudication;
  if(str(structural.outcome) && structural.outcome!==adjudication.effect)
    return ret('unresolved','structural-outcome-conflicts-with-unified-A1-law');
  seen.add(preview.receiptKey);
  return ret('allowed',adjudication.reason,{
    effect:adjudication.effect,
    hpAfter:adjudication.hpAfter,
    originalAttackContinues:adjudication.originalAttackContinues,
    redirect:adjudication.reflectOriginalAttack?preview.plan:null,
    damageOutcome:'NO_DAMAGE_APPLIED_IN_REFERENCE'
  });
}
