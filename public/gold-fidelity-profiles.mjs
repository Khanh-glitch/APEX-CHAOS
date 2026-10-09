// R88: REPRESENTATIVE REFERENCE VIEWPORTS for native, existing Gold layouts.
//
// These are *not* new HUD designs. Each size activates existing authored
// Gold CSS and Battle HUD data-layout/data-size rules in the real game.
// A profile is chosen from ASPECT RATIO, never CSS viewport area; thus a
// fixed ratio always resolves to a fixed design space regardless of size.
// If two native Gold layouts have similar aspect (phone landscape/desktop),
// ?goldProfile=<id> can explicitly select the intended authored family.
// Avoid interpreting these dimensions as exhaustive designer-approved sizes.
export const GOLD_PROFILES=Object.freeze([
  Object.freeze({id:'portrait-tall',width:390,height:844,family:'portrait',label:'Gold tall portrait'}),
  Object.freeze({id:'portrait-standard',width:550,height:857,family:'portrait',label:'Gold standard portrait'}),
  Object.freeze({id:'portrait-tablet',width:820,height:1180,family:'portrait',label:'Gold tablet portrait'}),
  Object.freeze({id:'landscape-tablet',width:960,height:720,family:'landscape',label:'Gold tablet landscape'}),
  Object.freeze({id:'landscape-phone',width:900,height:550,family:'landscape',label:'Gold compact landscape'}),
  Object.freeze({id:'landscape-ultrawide',width:960,height:440,family:'landscape',label:'Gold ultra-wide mobile landscape'}),
  Object.freeze({id:'desktop',width:1440,height:900,family:'landscape',label:'Gold desktop'}),
  Object.freeze({id:'desktop-wide',width:1920,height:1080,family:'landscape',label:'Gold wide desktop'})
]);
export function chooseGoldProfile(width,height,forcedId=null) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) return null;
  if(forcedId) {
    const forced=GOLD_PROFILES.find(p=>p.id===forcedId);
    if(!forced)return null; // Invalid user-supplied profile is a visible error.
    return forced;
  }
  const family=height>width?'portrait':'landscape';
  const ratio=width/height;
  const candidates=GOLD_PROFILES.filter(p=>p.family===family);
  return candidates.reduce((best,p)=>{
    const error=Math.abs(Math.log((p.width/p.height)/ratio));
    if(!best||error<best.error-1e-12)return {profile:p,error};
    return best;
  },null)?.profile??null;
}
export function fitGoldProfile(profile,width,height,offsetLeft=0,offsetTop=0) {
  if(!profile||![width,height].every(Number.isFinite)||width<=0||height<=0)return null;
  const scale=Math.min(width/profile.width,height/profile.height);
  return Object.freeze({
    profile:profile.id,
    design:{width:profile.width,height:profile.height},
    outer:{width,height,offsetLeft,offsetTop},
    scale,
    left:offsetLeft+(width-profile.width*scale)/2,
    top:offsetTop+(height-profile.height*scale)/2,
    scaledWidth:profile.width*scale,
    scaledHeight:profile.height*scale,
    letterboxX:(width-profile.width*scale)/2,
    letterboxY:(height-profile.height*scale)/2
  });
}
