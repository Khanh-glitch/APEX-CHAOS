import assert from 'node:assert/strict';
import {GOLD_PROFILES,chooseGoldProfile,deriveGoldDesignSpace,fitGoldProfile,detectGoldDeviceClass} from '../public/gold-fidelity-profiles.mjs';
const cases=[
  ['iPhone-SE-portrait',375,667,'phone','portrait-tall','port','compact'],
  ['iPhone-SE-landscape',667,375,'phone','landscape-phone','land','compact'],
  ['phone-16-9-landscape',640,360,'phone','landscape-phone','land','compact'],
  ['phone-ultrawide',844,390,'phone','landscape-ultrawide','land','compact'],
  ['large-phone-portrait',430,932,'phone','portrait-tall','port','compact'],
  ['tablet-portrait',820,1180,'tablet','portrait-tablet','port','tablet'],
  ['tablet-landscape',1024,768,'tablet','landscape-tablet','land','tablet'],
  ['tablet-wide-landscape',1180,820,'tablet','landscape-phone','land','compact'],
  ['desktop-16-9',1920,1080,'desktop','desktop-wide','desk','wide'],
  ['desktop-16-10',1440,900,'desktop','desktop','desk','desktop'],
  ['desktop-narrow-window',940,720,'desktop','landscape-tablet','land','tablet']
];
let count=0;
for(const [name,w,h,device,id,layout,size] of cases){
  const profile=chooseGoldProfile(w,h,null,{deviceClass:device});
  assert.equal(profile?.id,id,name+' selected');
  assert.equal(profile?.hud,layout,name+' native layout');
  assert.equal(profile?.size,size,name+' native size');
  const design=deriveGoldDesignSpace(profile,w,h);
  assert(design,name+' feasible design');
  const fit=fitGoldProfile(design,w,h);
  assert(fit&&fit.scale>0,name+' fit');
  assert(Math.abs(fit.letterboxX)<0.001&&Math.abs(fit.letterboxY)<0.001,name+' no structural letterbox');
  assert(Math.abs(design.width/design.height-w/h)<0.00001,name+' continuous aspect');
  count++;
}
assert.equal(detectGoldDeviceClass({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'}),'phone');
assert.equal(detectGoldDeviceClass({userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'}),'tablet');
assert.equal(detectGoldDeviceClass({userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',touchPoints:5}),'tablet');
assert.equal(detectGoldDeviceClass({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}),'desktop');
assert.equal(chooseGoldProfile(667,375,'desktop-wide',{deviceClass:'phone'}).id,'desktop-wide','explicit override remains authoritative');
assert.equal(deriveGoldDesignSpace(GOLD_PROFILES.find(x=>x.id==='desktop-wide'),375,667),null,'reject forced desktop on portrait');
assert.equal(chooseGoldProfile(667,375,'no-such-profile',{deviceClass:'phone'}),null,'reject invalid profile');
for(let w=320;w<=480;w+=16)for(let h=568;h<=960;h+=28){
  const p=chooseGoldProfile(w,h,null,{deviceClass:'phone'});
  const d=deriveGoldDesignSpace(p,w,h);
  assert(d&&d.hud==='port'&&d.size==='compact','portrait phone fuzz '+w+'x'+h);
  count++;
}
for(let w=560;w<=980;w+=20)for(let h=320;h<=550;h+=20)if(w>h){
  const p=chooseGoldProfile(w,h,null,{deviceClass:'phone'});
  const d=deriveGoldDesignSpace(p,w,h);
  assert(d&&d.hud==='land'&&d.width<=980.001,'landscape phone fuzz '+w+'x'+h);
  count++;
}
console.log('PASS R89 Gold family + breakpoint math: '+count+' device/aspect cases');
