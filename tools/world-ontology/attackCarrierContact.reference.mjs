// D6 REFERENCE-ONLY bridge. A generic AttackCarrier contact probe.
// NOT loaded by game runtimes. No HP, ownership, VFX, damage, or collision mutation.
// Ownership/eligibility and runtime material authority must be supplied separately.
const reply=(status,reason,more={})=>Object.freeze({status,reason,...more});
const finite=n=>Number.isFinite(n);
const point=p=>p&&finite(p.x)&&finite(p.y);
export function sampleAttackCarrierSurfaces(attack,surfaces,segmentCapsule) {
  if(!attack||!['stream','beam'].includes(attack.carrierKind))
    return reply('unresolved','unsupported-attack-carrier-form');
  if(attack.protection==='T6')return reply('denied','t6-protected');
  if(typeof attack.id!=='string'||!attack.id||!Number.isInteger(attack.tick)||attack.tick<0
    ||!point(attack.origin)||!point(attack.direction)||!(attack.range>0)
    ||!finite(attack.halfAngle)||attack.halfAngle<0||attack.halfAngle>Math.PI/2)
    return reply('unresolved','invalid-attack-emission');
  if(!Array.isArray(surfaces)||typeof segmentCapsule!=='function')
    return reply('unresolved','missing-material-or-TOI-authority');
  const rays=attack.sampleCount??65;
  if(!Number.isInteger(rays)||rays<1||rays>1025)
    return reply('unresolved','invalid-angular-sample-budget');
  const len=Math.hypot(attack.direction.x,attack.direction.y);
  if(!(len>1e-9))return reply('unresolved','zero-direction');
  const start=Math.atan2(attack.direction.y,attack.direction.x);
  const angularSamples=[];
  const grouped=new Map();
  for(let i=0;i<rays;i++) {
    const angle=start+(rays===1?0:(i/(rays-1)*2-1)*attack.halfAngle);
    const tx=attack.origin.x+Math.cos(angle)*attack.range;
    const ty=attack.origin.y+Math.sin(angle)*attack.range;
    let best=null;
    for(const cap of surfaces) {
      if(!cap||cap.solid===false||cap.cons?.state==='ENDED')continue;
      const cons=cap.cons||{};
      const kind=cap.constructForm||cons.kind;
      if(kind!=='wall'&&kind!=='prison'&&kind!=='hexa')continue;
      if(!finite(cap.ax)||!finite(cap.ay)||!finite(cap.bx)||!finite(cap.by)
        ||!finite(cap.r)||!Number.isInteger(cap.idx)
        ||typeof cons.id!=='string'||!cons.id)
        return reply('unresolved','invalid-authoritative-capsule');
      const hit=segmentCapsule(attack.origin.x,attack.origin.y,tx,ty,
        cap.ax,cap.ay,cap.bx,cap.by,cap.r);
      if(!hit||!finite(hit.t)||hit.t<0||hit.t>1)continue;
      const raw={constructId:cons.id,facetId:cap.idx,
        form:kind==='wall'?'wall':'hexa',
        rayIndex:i,t:hit.t,hitX:attack.origin.x+(tx-attack.origin.x)*hit.t,
        hitY:attack.origin.y+(ty-attack.origin.y)*hit.t,
        nx:hit.nx,ny:hit.ny,angle};
      if(!best||raw.t<best.t
        ||(Math.abs(raw.t-best.t)<1e-9&&
          String(raw.constructId+':'+raw.facetId)<String(best.constructId+':'+best.facetId)))
        best=raw;
    }
    const sample=Object.freeze({rayIndex:i,angle,firstMaterial:best?Object.freeze(best):null});
    angularSamples.push(sample);
    if(best){
      const key=best.constructId+':'+best.facetId;
      const curr=grouped.get(key);
      if(!curr)grouped.set(key,{surfaceKey:key,constructId:best.constructId,
        facetId:best.facetId,form:best.form,first:best,
        sampleCount:1,firstRay:i,lastRay:i});
      else {curr.sampleCount++;curr.lastRay=i;
        if(best.t<curr.first.t)curr.first=best;}
    }
  }
  const materialContacts=[...grouped.values()].sort((a,b)=>a.first.t-b.first.t
     ||a.surfaceKey.localeCompare(b.surfaceKey))
    .map(c=>Object.freeze({
      ...c,first:Object.freeze(c.first),
      // ONE potential structural transaction PER REAL attack tick and surface,
      // independently of sampled rays or visual particles.
      receiptKey:attack.id+':'+attack.tick+':'+c.surfaceKey
    }));
  return reply('allowed','attack-carrier-material-witness-only',{
    origin:Object.freeze({...attack.origin}),attackId:attack.id,
    tick:attack.tick,carrierKind:attack.carrierKind,
    materialContacts:Object.freeze(materialContacts),
    angularSamples:Object.freeze(angularSamples),
    // Validation is not completion of true continuous-sector collision.
    authoritativeDamageApplied:false,
    samplesAreApproximation:true
  });
}
