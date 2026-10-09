// R89 Gold viewport contract. The ORIGINAL Gold CSS/HUD own every layout.
// A device class selects an authored family; a reference aspect selects a
// composition inside that family. Physical viewport size NEVER selects a
// different composition inside the same device class and aspect.
export const GOLD_PROFILES=Object.freeze([
  Object.freeze({id:'portrait-tall',width:390,height:844,family:'portrait',device:'phone',hud:'port',size:'compact',label:'Gold tall portrait'}),
  Object.freeze({id:'portrait-standard',width:550,height:857,family:'portrait',device:'phone',hud:'port',size:'compact',label:'Gold standard portrait'}),
  Object.freeze({id:'portrait-tablet',width:820,height:1180,family:'portrait',device:'tablet',hud:'port',size:'tablet',label:'Gold tablet portrait'}),
  Object.freeze({id:'landscape-tablet',width:960,height:720,family:'landscape',device:'tablet',hud:'land',size:'tablet',label:'Gold tablet landscape'}),
  Object.freeze({id:'landscape-phone',width:900,height:550,family:'landscape',device:'phone',hud:'land',size:'compact',label:'Gold compact landscape'}),
  Object.freeze({id:'landscape-ultrawide',width:960,height:440,family:'landscape',device:'phone',hud:'land',size:'compact',label:'Gold ultra-wide mobile landscape'}),
  Object.freeze({id:'desktop',width:1440,height:900,family:'landscape',device:'desktop',hud:'desk',size:'desktop',label:'Gold desktop'}),
  Object.freeze({id:'desktop-wide',width:1920,height:1080,family:'landscape',device:'desktop',hud:'desk',size:'wide',label:'Gold wide desktop'})
]);
const validSize=(w,h)=>Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0;
const nearest=(candidates,ratio)=>candidates.reduce((best,p)=>{
  const error=Math.abs(Math.log((p.width/p.height)/ratio));
  return !best||error<best.error-1e-12?{profile:p,error}:best;
},null)?.profile??null;

// Device class is deliberately separate from a viewport's CSS pixel count:
// desktop 16:9 and phone 16:9 are DIFFERENT designer-authored Gold compositions.
// URL overrides are reserved for accessibility/ambiguous hybrid hardware/tests.
// iPadOS desktop UA requires touch detection; physical model lists are not used.
export function detectGoldDeviceClass({
  userAgent='',mobileHint=false,coarsePointer=false,touchPoints=0,
  screenWidth=NaN,screenHeight=NaN,override=null
}={}) {
  if(override!=null) {
    if(!['phone','tablet','desktop'].includes(override))return null;
    return override;
  }
  if(/iPad|Android(?!.*Mobile)|\bTablet\b|Kindle|Silk\//i.test(userAgent))return 'tablet';
  if(/iPhone|iPod|Android.*Mobile|Windows Phone/i.test(userAgent))return 'phone';
  if(/Macintosh/i.test(userAgent)&&touchPoints>1)return 'tablet';
  if(mobileHint)return 'phone';
  if(coarsePointer||touchPoints>0){
    // This distinguishes handheld from tablet, not individual phone models.
    // A known device class stays constant when the browser window is resized.
    const short=Math.min(screenWidth,screenHeight);
    return Number.isFinite(short)&&short>=700?'tablet':'phone';
  }
  return 'desktop';
}

export function chooseGoldProfile(width,height,forcedId=null,{deviceClass=null}={}) {
  if(!validSize(width,height))return null;
  if(forcedId) {
    // A forced id MUST remain exact; never silently select something else.
    return GOLD_PROFILES.find(p=>p.id===forcedId)??null;
  }
  const family=height>width?'portrait':'landscape',ratio=width/height;
  let candidates=GOLD_PROFILES.filter(p=>p.family===family);
  if(deviceClass==='phone') {
    candidates=candidates.filter(p=>p.device==='phone');
  } else if(deviceClass==='tablet') {
    // Gold's landscape tablet rules require a 700px minimum short side
    // while Shell's mobile landscape CSS requires <=980px wide. There is
    // NO native tablet-landscape Gold at an aspect above 980/700.
    candidates=candidates.filter(p=>p.device===(family==='portrait'||ratio<=980/700+1e-9?'tablet':'phone'));
  } else if(deviceClass==='desktop') {
    // Gold's desktop Battle HUD begins at aspect >=1.5; narrower desktop
    // windows natively use Gold's landscape composition.
    if(family==='landscape')
      candidates=candidates.filter(p=>p.device===(ratio>=1.5?'desktop':'tablet'));
    else candidates=candidates.filter(p=>p.device==='phone'||p.device==='tablet');
  }
  return nearest(candidates.length?candidates:GOLD_PROFILES.filter(p=>p.family===family),ratio);
}

// Work in Gold's own CSS-pixel design space. Match the REAL aspect, adjusting
// both dimensions within the selected native layout's feasible breakpoint
// envelope. Never stretch a rendered image or change Gold's DOM/styles.
// This is important near Gold's 980px mobile shell / 700px tablet HUD breaks.
export function deriveGoldDesignSpace(profile,layoutWidth,layoutHeight) {
  if(!profile||!validSize(layoutWidth,layoutHeight))return null;
  const ratio=layoutWidth/layoutHeight;
  let height=profile.height;
  if(profile.hud==='land'&&profile.size==='tablet'){
    if(ratio>980/700+1e-9||ratio<=1)return null;
    height=Math.min(height,980/ratio);
    if(height<700-1e-8)return null;
  } else if(profile.hud==='land') {
    height=Math.min(height,980/ratio);
  } else if(profile.size==='compact') {
    // Prevent a very wide portrait from silently becoming Gold tablet HUD.
    height=Math.min(height,699/ratio);
  } else if(profile.size==='tablet') {
    height=Math.max(height,700/ratio);
  }
  // Desktop CSS/HUD has an aspect>=1.5 gate. Reject impossible forced
  // profiles instead of silently displaying the wrong Gold composition.
  if(profile.hud==='desk'&&ratio<1.5)return null;
  // Round at 1/1000 CSS pixel so the virtual viewport's aspect differs
  // from the real layout viewport by less than 0.001 CSS px.
  const width=Math.round(height*ratio*1000)/1000;
  height=Math.round(height*1000)/1000;
  if(!validSize(width,height))return null;
  return Object.freeze({...profile,width,height,
    anchor:Object.freeze({width:profile.width,height:profile.height})});
}
export function fitGoldProfile(profile,width,height,offsetLeft=0,offsetTop=0) {
  if(!profile||!validSize(width,height))return null;
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
