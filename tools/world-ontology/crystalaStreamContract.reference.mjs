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
export function approveStreamReflectionPreview(preview, structural, seen) {
  if(preview?.status!=='allowed') return preview??ret('unresolved','missing-preview');
  if(!seen||typeof seen.has!=='function'||typeof seen.add!=='function')
    return ret('unresolved','missing-receipt-deduplication-authority');
  if(!structural||!['reflect','break-through','absorb'].includes(structural.outcome))
    return ret('unresolved','missing-structural-adjudication');
  if(structural.constructId!==preview.plan.constructId)
    return ret('unresolved','construct-receipt-mismatch');
  if(structural.outcome==='break-through')
    return ret('denied','wall-break-through-preserves-original-carrier');
  if(structural.outcome==='absorb')
    return ret('denied','structural-absorption-no-counter');
  if(seen.has(preview.receiptKey)) return ret('denied','stream-tick-already-adjudicated');
  seen.add(preview.receiptKey);
  return ret('allowed','stream-reflection-approved-without-damage-execution',{plan:preview.plan});
}
