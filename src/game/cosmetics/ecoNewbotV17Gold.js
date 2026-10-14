// CP8 ECO NEWBOT RECYCLE CORE V17 owner-Gold presentation module.
// Exact V17 art layers and mechanical part hierarchy extracted below.
// Spring integration reads native Robot's pose/velocity/event observations only.
// NO simulation of A1, A2, collision, pickups, projectiles or audio exists here.
const TAU=Math.PI*2,HS=172,HSC=HS/1280;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));const ecl=clamp;
const mix=(a,b,t)=>a+(b-a)*t;
const PIV=[{x:191,y:626},{x:1089,y:626}];
const SLOT=[[300,-200],[980,-200],[980,300],[777,300],[745,383],[694,448],[680,452],[680,540],[600,540],[600,452],[586,448],[535,383],[503,300],[300,300]];
const EYE=[new Path2D('M404 675 Q475 711 558 752 L540 795 Q476 781 419 732 Z'),new Path2D('M876 675 Q805 711 722 752 L740 795 Q804 781 861 732 Z')];
const SOCK=[new Path2D('M373 653 Q465 686 563 741 L586 808 505 833 Q423 800 379 762 Z'),new Path2D('M907 653 Q815 686 717 741 L694 808 775 833 Q857 800 901 762 Z')];
const SEAM=[[474,318],[522,328],[472,488],[372,548],[318,652]];
const mkCanvas=(w,h=w)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
function poly(g,p){g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();}
let R=null, ECO=null, ticks=[], lockFlash=0, pulses=[], stress=[], ecoRotorA=0,ecoRotorRA=0;
const pivotNow=s=>({x:PIV[s].x+(s?-1:1)*R.calDx[s].x+R.lagX.x,y:PIV[s].y+R.calDy[s].x+R.lagY.x});
function partialLine(g, pts, f0, f1) {
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  const a = clamp(f0, 0, 1) * total, b = clamp(f1, 0, 1) * total;
  if (b <= a) return;
  let acc = 0, started = false;
  g.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const s0 = acc, s1 = acc + seg[i - 1];
    const x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1];
    if (s1 >= a && s0 <= b) {
      const ta = clamp((a - s0) / seg[i - 1], 0, 1), tb = clamp((b - s0) / seg[i - 1], 0, 1);
      if (!started) { g.moveTo(mix(x0, x1, ta), mix(y0, y1, ta)); started = true; }
      g.lineTo(mix(x0, x1, tb), mix(y0, y1, tb));
    }
    acc = s1;
  }
  g.stroke();
}
function drawEyes(g) {
  const lid = clamp(R.lid.x, 0, 1), gl = Math.max(0, R.glow.x);
  for (let s = 0; s < 2; s++) {
    const cx = s ? 798 : 482;
    g.save(); g.clip(EYE[s]);
    if (gl > 1.01) {
      g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(cx, 742, 6, cx, 742, 130);
      rg.addColorStop(0, 'rgba(255,240,196,' + clamp((gl - 1) * .95, 0, 1) + ')');
      rg.addColorStop(.55, 'rgba(255,170,60,' + clamp((gl - 1) * .5, 0, 1) + ')');
      rg.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = rg; g.fillRect(cx - 150, 620, 300, 220);
    } else if (gl < .99) {
      g.fillStyle = 'rgba(18,10,4,' + clamp((1 - gl) * .9, 0, .92) + ')'; g.fillRect(cx - 150, 620, 300, 220);
    }
    g.restore();
    if (lid > .01) {
      const sg = s ? -1 : 1, y = mix(688, 792, lid), x0 = cx - 160, x1 = cx + 160;
      const y0 = y + (x0 - cx) * .5 * sg, y1 = y + (x1 - cx) * .5 * sg;
      g.save(); g.clip(SOCK[s]);
      const lg = g.createLinearGradient(0, 600, 0, y + 40);
      lg.addColorStop(0, '#0c0d0f'); lg.addColorStop(1, '#23262a');
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(x0, 560); g.lineTo(x1, 560); g.lineTo(x1, y1); g.lineTo(x0, y0); g.closePath(); g.fill();
      g.strokeStyle = '#9a968d'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.restore();
    }
  }
}
function drawTicks(g) {
  if (ticks[0] + ticks[1] + ticks[2] < .02) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  [559, 602, 649].forEach((y, i) => {
    if (ticks[i] < .02) return;
    g.strokeStyle = 'rgba(255,196,110,' + ticks[i] + ')'; g.lineWidth = 12;
    g.beginPath(); g.moveTo(606, y); g.lineTo(674, y); g.stroke();
  });
  g.restore();
}
function drawStruts(g) {
  for (let s = 0; s < 2; s++) {
    const a = { x: s ? 852 : 428, y: 700 }, p = pivotNow(s);
    const dx = p.x - a.x, dy = p.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    g.lineCap = 'butt';
    g.strokeStyle = '#1f2226'; g.lineWidth = 34;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x + ux * L * .55, a.y + uy * L * .55); g.stroke();
    g.strokeStyle = '#6e7177'; g.lineWidth = 13;
    g.beginPath(); g.moveTo(a.x + ux * L * .45, a.y + uy * L * .45); g.lineTo(p.x, p.y); g.stroke();
    g.strokeStyle = '#9c7a44'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(a.x + ux * L * .55 - uy * 17, a.y + uy * L * .55 + ux * 17); g.lineTo(a.x + ux * L * .55 + uy * 17, a.y + uy * L * .55 - ux * 17); g.stroke();
  }
}
function ecLeaf(g,x,y,length,width,angle,col='#94d45f',alpha=1){
  g.save();g.translate(x,y);g.rotate(angle);g.globalAlpha*=ecl(alpha,0,1);
  g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-width*.95,-length*.18,-width*.96,-length*.78,0,-length);
  g.bezierCurveTo(width*.83,-length*.7,width*.68,-length*.12,0,0);g.closePath();
  const gr=g.createLinearGradient(-width,0,width,-length);gr.addColorStop(0,'#365c38');gr.addColorStop(.45,col);gr.addColorStop(1,'#d9fa80');
  g.fillStyle=gr;g.fill();g.strokeStyle='#1c412a';g.lineWidth=Math.max(1,length*.023);g.stroke();
  g.strokeStyle='#e0f6a2';g.lineWidth=Math.max(.8,length*.02);
  g.beginPath();g.moveTo(0,3);g.quadraticCurveTo(3,-length*.46,0,-length*.93);g.stroke();
  g.lineWidth=Math.max(.5,length*.008);g.globalAlpha*=.45;
  for(const f of [.28,.49,.68]){g.beginPath();g.moveTo(0,-length*f);g.lineTo(-width*(f<.5?.42:.28),-length*(f+.11));g.moveTo(0,-length*f);g.lineTo(width*(f<.5?.34:.29),-length*(f+.11));g.stroke();}
  g.restore();
}
function ecoStatusGlow(g){
  if(!ECO.active)return;
  if(ECO.flash>.015){
    const a=ecl(ECO.flash*.52,0,.58);
    g.save();g.globalCompositeOperation='lighter';g.globalAlpha=a;
    g.strokeStyle='#a7c291';g.lineWidth=6;g.lineCap='round';g.shadowColor='#99b983';g.shadowBlur=24;
    // No big oval bloom: only structural energy traces.
    g.beginPath();g.moveTo(582,502);g.quadraticCurveTo(615,548,628,620);g.stroke();
    g.beginPath();g.moveTo(698,502);g.quadraticCurveTo(665,548,652,620);g.stroke();
    g.strokeStyle='rgba(225,255,210,.8)';g.lineWidth=3.2;
    g.beginPath();g.moveTo(640,484);g.lineTo(640,648);g.stroke();
    g.fillStyle='rgba(210,255,198,.26)';g.fillRect(635,520,10,102);
    g.restore();
  }
  if(ECO.armorFold>.01){
    g.save();g.globalAlpha=ECO.armorFold*.8;g.globalCompositeOperation='lighter';
    g.strokeStyle='#9fb98b';g.lineWidth=7;g.shadowColor='#9db88a';g.shadowBlur=20;
    for(const sign of [-1,1]){
      g.beginPath();g.moveTo(640+sign*108,485);g.quadraticCurveTo(640+sign*170,537,640+sign*158,636);g.stroke();
    }
    g.restore();
  }
}
const V4 = {ready:false, atlas:{}, noise:null, layerStats:{}, name:'MINERAL FOREST / SOLID ENAMEL · ARENA V15'};
const RC15 = Object.freeze({
  chassis:'#142520', deep:'#0D1B18', recess:'#1B332A',
  greenShadow:'#224B36', greenMid:'#3F7955', greenLight:'#639775',
  greenEdge:'#95BD9C', stoneGreen:'#416855', stoneLight:'#709780',
  glassWell:'#1A3D34', root:'#9B7956'
});
const C4 = {
  ivory:'#376B54', highlight:'#8A9E97', shade:'#446E58', celadon:'#397F5A', moss:'#366B4E',
  dark:'#192622', seam:'#0b1715', copper:'#8B9057', gold:'#89AC70', energy:'#a8f4ac',
  glass:'#376c63', eye:'#ffb247'
};
function v4Path(d){return new Path2D(d)}
function v4Line(g,d,col,w=4,a=1){g.save();g.globalAlpha=a;g.lineCap='round';g.lineJoin='round';g.strokeStyle=col;g.lineWidth=w;g.stroke(v4Path(d));g.restore();}
function v4Noise(){
 const c=mkCanvas(100),g=c.getContext('2d'),dat=g.createImageData(100,100);let v=33471;
 for(let y=0;y<100;y++)for(let x=0;x<100;x++){v=(Math.imul(v,1664525)+1013904223)>>>0;let i=(y*100+x)*4;const m=(v>>>23)&255;dat.data[i]=m;dat.data[i+1]=m;dat.data[i+2]=m;dat.data[i+3]=(v&1)?13:5;}
 g.putImageData(dat,0,0);return c;
}
function v4Surface(g,d,b,colors,opt={}){
 const p=new Path2D(d),[x,y,w,h]=b;
 let base=g.createLinearGradient(x-w*.12,y-h*.12,x+w*.92,y+h*.94);
 colors.forEach((c,i)=>base.addColorStop(i/(colors.length-1),c));
 const edge=opt.stroke===undefined?12:opt.stroke;
 g.save();g.lineJoin='round';g.lineCap='round';
 // Physically separated side-wall / extrusion. Replaces the random scratches of V6.
 if(edge>=5){
  g.save();g.translate(0,Math.min(10,edge*.48));g.fillStyle='#081510';g.fill(p);g.restore();
 }
 g.shadowColor='rgba(0,0,0,.76)';g.shadowBlur=opt.shadow===undefined?10:Math.min(opt.shadow+1,17);
 g.shadowOffsetX=5;g.shadowOffsetY=9;
 g.fillStyle=base;g.fill(p);
 g.shadowBlur=0;g.shadowOffsetX=g.shadowOffsetY=0;
 // Narrow gasket and the thickness of the outer machined rim.
 g.strokeStyle=opt.border||'#0B2119';g.lineWidth=edge;g.stroke(p);
 g.save();g.clip(p);
 // Broad form-light follows the shaped surface, not a random line texture.
 let volume=g.createRadialGradient(x+w*.22,y+h*.08,4,x+w*.53,y+h*.56,Math.max(w,h)*.91);
 volume.addColorStop(0,'rgba(236,255,232,.14)');volume.addColorStop(.23,'rgba(201,242,209,.035)');
 volume.addColorStop(.48,'rgba(0,0,0,.06)');volume.addColorStop(1,'rgba(0,0,0,.44)');
 g.fillStyle=volume;g.fillRect(x-30,y-30,w+60,h+60);
 let metal=g.createLinearGradient(x,y,x+w,y);
 metal.addColorStop(0,'rgba(255,255,255,.10)');metal.addColorStop(.13,'rgba(255,255,255,.02)');
 metal.addColorStop(.42,'rgba(255,255,255,.035)');metal.addColorStop(.66,'rgba(0,0,0,.14)');metal.addColorStop(1,'rgba(0,0,0,.27)');
 g.fillStyle=metal;g.fillRect(x-25,y-25,w+50,h+50);
 if(opt.grain!==false){
   g.globalAlpha=opt.grainAlpha||.025;
   g.fillStyle=g.createPattern(V4.noise,'repeat');
   g.fillRect(x-12,y-12,w+24,h+24);
   g.globalAlpha=1;
 }
 // Inner recess gradient follows a real contour; no arbitrary topographic squiggles.
 if(edge>4){g.strokeStyle='rgba(222,251,223,.12)';g.lineWidth=Math.min(2.6,edge*.19);g.stroke(p);}
 g.restore();g.restore();return p;
}
function v4Inset(g,d,b){
 v4Surface(g,d,b,['#060f0d','#20312b','#243d34','#101a16'],{stroke:8,border:'#7d9284',shadow:11,grain:false});
 v4Line(g,d,'rgba(255,255,237,.17)',2);
}
function v4Edge(g,d,alpha=.65,w=5){v4Line(g,d,'#8ED5A5',w,alpha)}
function v4Bolt(g,x,y,r=7){g.save();g.translate(x,y);let l=g.createLinearGradient(-r,-r,r,r);l.addColorStop(0,'#A3CF99');l.addColorStop(.5,'#5B926F');l.addColorStop(1,'#3b4f48');g.fillStyle=l;g.strokeStyle='#14231e';g.lineWidth=2;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();g.stroke();v4Line(g,`M ${-r*.45} ${r*.38} L ${r*.45} ${-r*.38}`,'#26342f',2);g.restore()}
function v4Tick(g,x,y,w,h){v4Surface(g,`M ${x} ${y} l ${w} -3 l ${w*.14} ${h} l ${-w} 3 Z`,[x,y-3,w*1.2,h+8],['#7CA174','#79674e','#4F7652'],{border:'#293329',stroke:3,grain:false,shadow:4})}
function v7Screw(g,x,y,r=6){
 g.save();g.translate(x,y);
 let gr=g.createLinearGradient(-r,-r,r,r);
 gr.addColorStop(0,'#b6d3a8');gr.addColorStop(.28,'#719c81');gr.addColorStop(.6,'#304b3e');gr.addColorStop(1,'#13241c');
 g.fillStyle='#0b1913';g.beginPath();g.arc(0,1,r+2,0,TAU);g.fill();
 g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
 g.strokeStyle='#0e241a';g.lineWidth=1.8;g.beginPath();g.moveTo(-r*.5,r*.28);g.lineTo(r*.5,-r*.28);g.stroke();g.restore();
}
function v7Reactor(g,x,y){
 g.save();g.translate(x,y);
 let voidGrad=g.createRadialGradient(-8,-9,1,0,0,65);
 voidGrad.addColorStop(0,'#1c3d2d');voidGrad.addColorStop(.45,'#091b15');voidGrad.addColorStop(1,'#030f0b');
 g.fillStyle=voidGrad;g.beginPath();g.ellipse(0,0,49,66,0,0,TAU);g.fill();
 g.strokeStyle='#081810';g.lineWidth=9;g.stroke();
 g.save();g.scale(1,.98);
 for(let j=0;j<3;j++){
  const a=-1.7+j*(TAU/3);
  const gr=g.createLinearGradient(-25,-25,25,25);
  gr.addColorStop(0,'#c6e5b5');gr.addColorStop(.5,'#5c9571');gr.addColorStop(1,'#233d31');
  g.strokeStyle=gr;g.lineCap='round';g.lineWidth=9;
  g.beginPath();g.arc(0,0,34,a,a+TAU/3-.25);g.stroke();
  g.strokeStyle='rgba(208,255,191,.55)';g.lineWidth=2;
  g.beginPath();g.arc(0,0,32,a+.14,a+.52);g.stroke();
 }
 g.restore();
 let ax=g.createRadialGradient(-5,-6,2,0,0,20);ax.addColorStop(0,'#dcffd0');ax.addColorStop(.22,'#9be5a0');ax.addColorStop(.55,'#397453');ax.addColorStop(1,'#0c281d');
 g.fillStyle=ax;g.beginPath();g.arc(0,0,19,0,TAU);g.fill();
 g.strokeStyle='#10291d';g.lineWidth=5;g.stroke();
 g.fillStyle='#d8ffd2';g.beginPath();g.arc(-6,-6,4,0,TAU);g.fill();
 g.restore();
}
function v4CoreArtwork(g){
 // Gold-format hull but fully repainted: all shapes drawn directly for new skin.
 v4Surface(g,'M 628 170 C 774 182 915 316 1010 455 Q 1075 602 995 825 Q 904 1014 716 1087 Q 628 1139 538 1085 Q 362 1020 278 824 Q 213 627 291 451 Q 390 277 628 170 Z',[250,170,815,968],[RC15.stoneGreen,RC15.chassis,'#385744',RC15.deep],{stroke:21,border:'#101617'});
 // Deep side service gutters, visible through negative gaps.
 for(const s of [-1,1]){g.save();if(s>0){g.translate(1280,0);g.scale(-1,1)}
   v4Inset(g,'M 372 377 Q 418 340 469 374 L 538 524 L 493 663 Q 424 670 367 615 Q 323 493 372 377 Z',[333,338,213,345]);
   for(let j=0;j<4;j++)v4Tick(g,389+j*21,402+j*13,12,65);
   g.restore();}
 // Upper forehead is a stamped pressure plate with recessed reinforcement.
 v4Surface(g,'M 505 273 L 641 202 L 777 273 Q 765 320 716 350 L 641 334 L 566 350 Q 514 321 505 273 Z',[501,199,279,157],['#5c8266','#23392f','#101e18','#3b674e'],{stroke:11,border:'#0d2017',shadow:9});
 v4Surface(g,'M 552 292 L 640 252 L 729 292 L 690 322 L 642 311 L 589 324 Z',[550,251,181,75],['#8bb497','#446e58','#253f33'],{stroke:7,border:'#183027',shadow:4,grain:false});
 v7Screw(g,642,285,7);

 // Main Celadon armor — cut as curved ceramic facets, under eye sockets.
 v4Surface(g,'M 441 312 Q 481 280 521 309 L 576 420 Q 609 459 640 463 Q 670 459 704 420 L 759 309 Q 802 279 843 312 Q 906 386 915 488 Q 894 554 822 596 L 731 659 Q 640 724 549 657 L 458 596 Q 387 554 367 488 Q 379 381 441 312 Z',[365,276,548,434],[RC15.greenLight,RC15.greenMid,RC15.greenShadow,RC15.recess,'#366D4C'],{stroke:17,border:'#17251e',shadow:24});
 v4Surface(g,'M 427 358 Q 478 325 506 351 Q 531 424 579 484 L 540 551 Q 464 536 418 489 Q 399 421 427 358 Z',[397,326,188,238],['#6CA17E',RC15.greenMid,RC15.greenShadow,'#315940'],{stroke:8,border:'#3b5445'});
 v4Surface(g,'M 853 358 Q 802 325 774 351 Q 749 424 701 484 L 740 551 Q 816 536 862 489 Q 881 421 853 358 Z',[696,326,188,238],['#699879','#3B7253','#254D3B',RC15.recess],{stroke:8,border:'#334a3f'});
 // The central recycled loop is a real three-depth engine cartridge.
 v4Surface(g,'M 596 474 Q 641 445 684 476 L 716 570 L 681 691 Q 639 741 600 695 L 564 574 Z',[564,445,153,300],['#677A71','#242f29','#0d1a17','#3E7958'],{stroke:15,border:'#0a1310'});
 v4Surface(g,'M 612 506 Q 640 490 670 508 L 687 577 L 662 660 Q 641 680 618 660 L 592 577 Z',[592,493,95,190],['#142e24','#51645d','#a8d4a2','#0c261d'],{stroke:9,border:'#1b2a22',grain:false});
 // Actual 3-stage reclaim rotor, seated in the vertical cartridge, not a luminous doodle.
 g.save();const window=v4Path('M 612 506 Q 640 490 670 508 L 687 577 L 662 660 Q 641 680 618 660 L 592 577 Z');g.clip(window);
 v7Reactor(g,640,584);
 g.restore();
 // Energy inlet/outlet are framed slots at physically legible joints.

 for(const [x,y] of [[447,460],[831,460],[542,594],[736,594]])v4Bolt(g,x,y,6);
 // Both lower cheek beam mounts are real separate bodies with notches.


 // New dark precision face bridge and NEWBOT eye seats; painterly eye regions use Gold optics only.
 v4Surface(g,'M 368 631 Q 446 627 562 686 L 597 760 L 543 841 Q 427 847 370 783 Q 334 721 368 631 Z',[330,626,279,218],['#666d6b','#0d1213','#1c2021','#4c5453'],{stroke:14,border:'#0b1210',grain:false});
 v4Surface(g,'M 912 631 Q 834 627 718 686 L 683 760 L 737 841 Q 853 847 910 783 Q 946 721 912 631 Z',[680,626,275,218],['#5c6663','#111718','#101617','#202728'],{stroke:14,border:'#0b1210',grain:false});
 // Lower nose and framing between Gold eyes and the ceramic chin.
 v4Surface(g,'M 619 727 L 641 711 L 661 727 L 683 814 L 643 860 L 597 815 Z',[592,713,91,146],['#6E9C79',RC15.greenMid,RC15.greenShadow],{stroke:11});
 
}
function v4BackArtwork(g){
 v4Surface(g,'M 602 274 Q 640 234 680 274 L 850 351 L 1046 558 L 997 834 L 774 1047 L 640 1125 L 506 1047 L 280 834 L 234 557 L 431 352 Z',[234,233,812,895],['#2D4B3D',RC15.deep,'#355344','#121E1B'],{stroke:22,border:'#07110f'});
 for(const sx of [430,850]){
  g.save();g.translate(sx,480);g.strokeStyle='#789483';g.lineWidth=7;g.beginPath();g.arc(0,0,104,.3,Math.PI*1.7);g.stroke();g.restore();
 }
 
}
function v4CrestArtwork(g){
 v4Surface(g,'M 636 56 Q 662 52 681 88 Q 743 203 734 288 L 696 405 L 647 462 L 591 414 L 546 286 Q 539 202 601 86 Q 621 58 636 56 Z',[540,51,205,413],['#74AA83','#4F8264','#2D5540',RC15.recess],{stroke:18,border:'#152b24'});
 v4Surface(g,'M 640 82 C 622 162 601 246 632 367 L 642 402 L 671 342 Q 692 219 640 82 Z',[593,81,98,321],['#619578','#3F7659','#2D5944'],{stroke:7,border:'#72927f',shadow:5});
 v4Inset(g,'M 632 211 L 651 211 L 667 315 L 644 357 L 622 317 Z',[620,210,48,150]);
 v4Surface(g,'M 637 224 L 646 224 L 650 299 L 643 327 L 637 301 Z',[636,222,20,111],['#9EB4A7','#5eaa92','#173a2a'],{stroke:4,border:'#283e31',grain:false});
 
 
}
function v4ChinArtwork(g){
 v4Surface(g,'M 518 916 Q 574 869 640 844 Q 706 867 766 917 L 731 1026 Q 690 1094 641 1137 Q 588 1106 549 1033 Z',[518,844,248,300],['#63967A','#2D644A','#5D886A','#173328'],{stroke:18,border:'#12231d'});
 v4Surface(g,'M 556 934 L 641 893 L 725 934 L 701 1014 L 640 1084 L 578 1014 Z',[553,889,173,200],['#4D805C','#659675','#28513C'],{stroke:7,border:'#425b4a'});
 v4Surface(g,'M 626 943 L 656 943 L 660 1001 L 641 1027 L 622 1000 Z',[619,940,43,90],['#222d25','#73897D','#98AEA1'],{stroke:4,border:'#314a39',grain:false});
 v4Edge(g,'M 562 941 L 639 904',.66,5);
}
function v4CheekArtwork(g){
 v4Surface(g,'M 323 894 Q 352 850 468 823 Q 502 848 533 903 L 481 1008 L 375 1001 Q 324 971 305 933 Z',[305,823,228,187],['#699C79','#396C4D','#709A7D','#1A4432'],{stroke:14,border:'#16291e'});
 v4Surface(g,'M 353 886 Q 391 861 457 843 L 480 886 L 433 974 L 371 969 Z',[350,839,133,140],['#4D855F','#25543C','#426D52'],{stroke:5,border:'#42594b'});
 
 v4Bolt(g,389,943,6);
}
function v4SideArtwork(g,side){
  g.save();if(side){g.translate(1280,0);g.scale(-1,1)}
  // Underframe uses Gold pivot and jaw contact coordinates, but NO Gold caliper pixels.
  v4Surface(g,'M 416 127 Q 357 113 289 176 Q 186 254 129 399 Q 76 516 106 683 Q 134 817 275 911 L 369 1061 Q 408 1110 454 1065 L 422 970 L 360 827 Q 338 747 355 640 Q 335 492 403 341 Q 460 218 416 127 Z',[88,114,365,990],['#304C3E','#0C201B','#264336','#476A56','#101E1A'],{stroke:21,border:'#0c1713',shadow:27});
  // Genuinely replacement upper swept ceramic fin.
  v4Surface(g,'M 411 138 Q 366 130 309 199 Q 238 277 190 370 Q 183 407 209 439 L 291 426 Q 329 345 394 297 Q 440 211 411 138 Z',[181,126,267,320],['#74A987','#4F815F','#31583F','#244A38'],{stroke:13,border:'#13271e'});
  v4Edge(g,'M 399 151 Q 340 181 254 325',.8,8);
  

  v7Screw(g,271,414,6);
  // Lower caliper jaw: the physical clamp endpoint remains fixed near JAW (414,1094).
  v4Surface(g,'M 282 743 Q 339 749 361 837 L 393 946 Q 443 998 458 1041 Q 456 1074 422 1093 Q 376 1071 339 1006 L 260 887 Q 217 816 282 743 Z',[218,741,249,360],['#6D9B78','#3D7252','#5B8B6B','#1D4A34'],{stroke:17,border:'#14261e'});
  v4Surface(g,'M 281 782 Q 315 775 334 851 L 407 1015 L 420 1052 Q 381 1048 352 989 L 263 851 Z',[256,778,164,276],['#548866','#6D9D7A','#366C4D','#244832'],{stroke:5,border:'#6e927e'});
  v4Edge(g,'M 282 798 Q 332 880 396 1014',.46,5);
  v4Bolt(g,356,934,7);

  // Distinct primary module architectures: left turbine chassis, right glass case.
  if(!side){
    // Gold ratio retained but machinery is industrial performance design.
    v4Surface(g,'M 282 365 Q 177 352 129 435 Q 83 518 107 683 Q 124 762 219 786 L 326 705 Q 377 567 328 447 Z',[96,355,274,439],['#518B68','#315D47','#1E3E31','#102820','#628D73'],{stroke:16,border:'#14221c'});
    v4Inset(g,'M 231 421 Q 139 434 134 531 Q 123 648 212 702 Q 300 693 314 584 Q 332 471 231 421 Z',[128,419,205,288]);
    for(let j=0;j<3;j++){
      const yy=461+j*70;
      v4Surface(g,`M 101 ${yy} Q 78 ${yy-6} 75 ${yy+22} Q 105 ${yy+46} 147 ${yy+35} L 152 ${yy+2} Z`,[73,yy-10,81,62],['#758A81','#376E51','#576b5e'],{stroke:7,border:'#24382c',grain:false});
    }
    
    v4Bolt(g,324,441,9);v4Bolt(g,327,684,9);
    
  }else{
    // Bio capsule: high, long oval window, continuous metal pressure frame.
    v4Surface(g,'M 269 291 Q 163 279 133 387 Q 102 500 121 685 Q 141 789 259 824 Q 356 755 365 598 Q 378 427 318 321 Z',[105,289,273,542],['#3E6553','#233C32','#638774','#142B26'],{stroke:17,border:'#1d2626'});
    v4Inset(g,'M 236 337 Q 161 345 153 452 Q 135 568 167 717 Q 199 773 267 756 Q 325 717 333 582 Q 346 447 304 372 Q 278 334 236 337 Z',[140,332,203,434]);
    // Clear sapphire-jade curvature, ceramic/sage no giant glow tube.
    const glass=v4Path('M 238 351 Q 176 351 170 456 Q 151 570 181 707 Q 208 758 259 741 Q 307 703 315 584 Q 330 449 292 379 Q 272 350 238 351 Z');
    let gr=g.createLinearGradient(146,370,312,748);gr.addColorStop(0,'#477A60');gr.addColorStop(.18,'#2E5C4A');gr.addColorStop(.42,'#18392E');gr.addColorStop(.67,'#28513F');gr.addColorStop(1,'#375C4A');
    g.save();g.fillStyle=gr;g.fill(glass);g.clip(glass);
    // V5: soil is INSIDE the pressurized glass, rooted plant is not glued to shell.
    // Uneven organic humus surface, mineral strata, live roots and fine moss.
    const earth=g.createLinearGradient(0,614,0,767);
    earth.addColorStop(0,'#A0774B');earth.addColorStop(.23,'#705039');
    earth.addColorStop(.72,'#322721');earth.addColorStop(1,'#1e211b');
    g.fillStyle=earth;g.beginPath();g.moveTo(148,650);
    g.bezierCurveTo(178,623,204,645,224,633);
    g.bezierCurveTo(252,610,279,640,311,622);
    g.lineTo(318,789);g.lineTo(151,789);g.closePath();g.fill();
    g.fillStyle='rgba(42,29,21,.45)';g.beginPath();g.moveTo(156,695);g.bezierCurveTo(194,681,237,706,305,683);g.lineTo(313,753);g.lineTo(161,756);g.closePath();g.fill();
    // Sediment layering follows actual slopes rather than freehand surface strokes.
    
    
    // Visible growth media; no floating brown ellipse or pot underneath robot.
    for(let j=0;j<37;j++){
       let sx=166+(j*41%138),sy=646+(j*29%93);
       g.fillStyle=j%5===0?'rgba(159,119,75,.64)':j%3===0?'rgba(27,27,23,.65)':'rgba(115,83,58,.48)';
       g.beginPath();g.ellipse(sx,sy,2+(j%3)*1.4,1.1+(j%4)*.6,j*.19,0,TAU);g.fill();
    }
    
    
    for(let j=0;j<9;j++){
      const xx=167+j*16, yy=637+Math.sin(j*2.7)*6;
      v4Line(g,`M ${xx} ${yy+7} q ${2+(j%3)} -12 ${j%2?8:-4} -19`,'#709e65',2.4,.8);
    }
    // Fine root crown bridges the sapling stem into visible earth, no separate pot.
    
    // Internal plant, roots and nutrient filament, partially submerged.
    
    
    ecLeaf(g,233,523,65,24,-.81,'#7d9a78',.92);
    ecLeaf(g,240,479,73,27,.67,'#99ae88',.94);
    ecLeaf(g,248,427,53,20,-.26,'#7b9b8d',.9);
    let gl=g.createLinearGradient(160,410,312,498);gl.addColorStop(0,'rgba(250,255,237,.10)');gl.addColorStop(.3,'rgba(255,255,255,.015)');gl.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle=gl;g.beginPath();g.moveTo(177,409);g.quadraticCurveTo(215,343,243,372);g.quadraticCurveTo(189,449,177,628);g.closePath();g.fill();
    // Two separate curved optical reflections, obeying the right glass wall.
    const refr=g.createLinearGradient(174,400,242,686);
    refr.addColorStop(0,'rgba(235,255,238,.055)');refr.addColorStop(.38,'rgba(236,255,247,.01)');refr.addColorStop(1,'rgba(236,255,247,0)');
    g.fillStyle=refr;g.beginPath();g.moveTo(192,390);g.quadraticCurveTo(178,469,181,548);
    g.quadraticCurveTo(183,589,188,625);g.quadraticCurveTo(171,531,176,455);g.closePath();g.fill();
    g.restore();
    // Multiple nested glass lips demonstrate actual pressure-glass thickness.
    v4Line(g,'M 238 351 Q 176 351 170 456 Q 151 570 181 707 Q 208 758 259 741 Q 307 703 315 584 Q 330 449 292 379 Q 272 350 238 351','#101819',13,.98);
    v4Line(g,'M 238 351 Q 176 351 170 456 Q 151 570 181 707 Q 208 758 259 741 Q 307 703 315 584 Q 330 449 292 379 Q 272 350 238 351','#9EBAA4',3,.78);
    
    
    v4Surface(g,'M 178 361 Q 218 315 284 350 L 317 397 L 305 428 Q 236 393 166 435 Z',[160,310,159,129],['#81958D','#556B63','#75837C'],{stroke:11,border:'#263b31'});
    v4Surface(g,'M 159 698 Q 218 757 297 708 L 304 747 Q 251 818 197 792 L 165 761 Z',[153,690,155,126],['#536C63','#597a65','#263f35'],{stroke:11,border:'#20342b'});
    v4Bolt(g,166,482,7);v4Bolt(g,305,674,7);
    
  }
  g.restore();
}
function v4PivotStatic(g,s){
 const x=PIV[s].x,y=PIV[s].y;
 g.save();g.translate(x,y);
 const outer=s?42:86;
 let edge=g.createRadialGradient(-outer*.25,-outer*.35,3,0,0,outer+3);
 edge.addColorStop(0,'#b7d9ac');edge.addColorStop(.24,'#76977c');edge.addColorStop(.53,'#314c3e');edge.addColorStop(.80,'#101f19');edge.addColorStop(1,'#567760');
 g.fillStyle=edge;g.strokeStyle='#0a1b14';g.lineWidth=s?9:12;
 g.beginPath();g.arc(0,0,outer,0,TAU);g.fill();g.stroke();
 // External blade clearance / retention ring.
 g.strokeStyle='#0d2117';g.lineWidth=s?7:11;g.beginPath();g.arc(0,0,outer*.83,0,TAU);g.stroke();
 g.strokeStyle='#9cc59b';g.lineWidth=s?2.5:3.4;g.beginPath();g.arc(0,0,outer*.91,3.35,5.68);g.stroke();
 g.strokeStyle='#2d4435';g.lineWidth=2;g.beginPath();g.arc(0,0,outer*.89,.35,2.7);g.stroke();
 if(!s){
   // Static housing only. Live rotor blades are drawn dynamically so the fan does not double-stack.
   g.strokeStyle='#0b231a';g.lineWidth=5;g.beginPath();g.arc(0,0,23,0,TAU);g.stroke();
 }else{
   // Bio cell has a tiny mechanical support bearing, not a second full turbine.
   for(let i=0;i<3;i++){g.save();g.rotate(i*TAU/3);g.fillStyle='#547c61';g.beginPath();g.roundRect(-3,-31,7,21,2);g.fill();g.restore();}
 }
 let center=g.createRadialGradient(-7,-7,2,0,0,s?20:25);
 center.addColorStop(0,'#f0ffcf');center.addColorStop(.22,'#accda2');center.addColorStop(.55,'#4c7957');center.addColorStop(1,'#142a1e');
 g.fillStyle=center;g.beginPath();g.arc(0,0,s?15:23,0,TAU);g.fill();
 g.strokeStyle='#0e2519';g.lineWidth=5;g.stroke();
 g.fillStyle='rgba(255,255,255,.36)';g.beginPath();g.ellipse(-6,-7,s?4:5,2,-.6,0,TAU);g.fill();
 g.restore();
}
function v4DynamicSide(g,s){
 // Current context is inside moving caliper transform; use its local coordinates.
 g.save();if(s){g.translate(1280,0);g.scale(-1,1)}
 const t=ECO.armorFold;
 if(s){
   // Living liquid pulse and physical split shutter on the TRUE capsule, not a fake world shield.
   g.save();g.globalAlpha=.05+.10*ECO.charge+.12*t;g.globalCompositeOperation='lighter';
   g.strokeStyle='#bdd8c9';g.lineCap='round';
   g.lineWidth=3.2;g.beginPath();g.moveTo(210,414);g.quadraticCurveTo(199,505,204,610);g.stroke();
   g.lineWidth=2.1;g.beginPath();g.moveTo(254,392);g.quadraticCurveTo(273,493,262,670);g.stroke();
   g.lineWidth=1.6;g.strokeStyle='rgba(205,255,214,.65)';g.beginPath();g.moveTo(236,444);g.lineTo(236,650);g.stroke();g.restore();
   if(t>.008){
     g.save();g.globalAlpha=t;
     v4Surface(g,'M 161 457 Q 201 416 237 465 L 242 588 L 171 624 Q 158 566 161 457 Z',[154,417,90,208],['#4D7E5F','#25523E','#1D3F34'],{stroke:7,border:'#274233',grain:false,shadow:0});
     v4Surface(g,'M 314 468 Q 273 419 241 476 L 238 607 L 307 623 Q 321 553 314 468 Z',[235,417,87,208],['#60906D','#3A6E51','#25513B'],{stroke:7,border:'#2b4434',grain:false,shadow:0});
     g.restore();
   }
 }else if(t>.005){
   // Reclaimer lock: brakes the rotor and seats individual armor teeth.
   g.save();g.globalAlpha=t;
   for(let i=0;i<3;i++){
     const y=451+i*82;
     v4Surface(g,`M 108 ${y} Q 142 ${y-18} 171 ${y+17} L 186 ${y+42} Q 137 ${y+55} 108 ${y+26} Z`,[103,y-18,88,74],['#7A9087','#566E65','#4A5C56'],{stroke:7,border:'#203c2c',grain:false,shadow:2});
   }
   g.restore();
 }
 if(ECO.armorShock>.02){
   g.save();g.globalCompositeOperation='lighter';g.globalAlpha=ECO.armorShock*.47;g.shadowColor='#c2ff98';g.shadowBlur=24;
   g.restore();
 }
 g.restore();
}
function v4OpticsArt(g){
 for(let s=0;s<2;s++){
   g.save();if(s){g.translate(1280,0);g.scale(-1,1)}
   const socket=new Path2D('M 373 653 Q 465 686 563 741 L 586 808 L 505 833 Q 423 800 379 762 Z');
   g.fillStyle='#070e0a';g.fill(socket);g.strokeStyle='#26382d';g.lineWidth=15;g.stroke(socket);
   g.strokeStyle='#83a38c';g.lineWidth=2.8;g.beginPath();g.moveTo(380,654);g.quadraticCurveTo(472,682,558,740);g.stroke();
   const iris=new Path2D('M 404 675 Q 475 711 558 752 L 540 795 Q 476 781 419 732 Z');
   let optic=g.createLinearGradient(410,680,541,797);
   optic.addColorStop(0,'#7e300e');optic.addColorStop(.22,'#f77c19');optic.addColorStop(.54,'#ffc44c');optic.addColorStop(.81,'#ffe6a0');optic.addColorStop(1,'#b45418');
   g.save();g.shadowColor='#e47a12';g.shadowBlur=14;g.fillStyle=optic;g.fill(iris);g.restore();
   g.strokeStyle='#7b3d17';g.lineWidth=5;g.stroke(iris);
   // Controlled optic prism: sharp faceted reflection, no random hatch/scuff.
   const lens=new Path2D('M 434 700 L 514 745 L 523 768 L 465 752 Z');
   const lensGrad=g.createLinearGradient(439,705,513,758);lensGrad.addColorStop(0,'#fff6d4');lensGrad.addColorStop(.45,'#ffe4a3');lensGrad.addColorStop(1,'#df8e32');
   g.fillStyle=lensGrad;g.fill(lens);
   g.fillStyle='rgba(255,255,255,.46)';g.beginPath();g.moveTo(438,701);g.lineTo(479,728);g.lineTo(468,727);g.closePath();g.fill();
   g.fillStyle='rgba(76,25,7,.23)';g.beginPath();g.moveTo(460,750);g.lineTo(512,761);g.lineTo(509,769);g.closePath();g.fill();
   v4Line(g,'M 409 684 Q 478 712 546 753','#522513',11,.82);
   g.restore();
 }
}
function v4DrawCached(g,key){g.drawImage(V4.atlas[key],0,0,1280,1280)}
function v4Prepare(){
 if(V4.ready)return;
 V4.noise=v4Noise();
 const renders={back:v4BackArtwork,core:v4CoreArtwork,crest:v4CrestArtwork,chin:v4ChinArtwork,cheek:v4CheekArtwork,left:g=>v4SideArtwork(g,0),right:g=>v4SideArtwork(g,1),pivotLeft:g=>v4PivotStatic(g,0),pivotRight:g=>v4PivotStatic(g,1)};
 for(const [name,draw] of Object.entries(renders)){
   const out=mkCanvas(1600),g=out.getContext('2d');g.scale(1600/1280,1600/1280);g.imageSmoothingQuality='high';draw(g);V4.atlas[name]=out;
 }
 // Eye silhouettes and amber color are reproduced from the provided Gold SVG
 // with the exact Gold optic paths; Gold body pixels are NOT reused.
 const eye=mkCanvas(1600),g=eye.getContext('2d');g.scale(1600/1280,1600/1280);g.imageSmoothingQuality='high';
 v4OpticsArt(g);V4.atlas.eye=eye;V4.ready=true;
}
function v4Rig(g){
 v4Prepare();
 v4DrawCached(g,'back');
 // Rear plant tied to body root, slim enough not to become a chibi robot with leaves on top.
 g.save();g.translate(846,271);g.rotate(-.14);
 
 ecLeaf(g,8,-3,55,22,-.7,'#99d89b',.9);
 ecLeaf(g,11,-30,48,19,.49,'#b8e5aa',.88);g.restore();
 // Gold's attachment struts are real rig parts, but metal is now redesigned.
 drawStruts(g);
 // Crest moves in its locked slot; its shape is fully replaced, not tinted.
 g.save();g.beginPath();poly(g,SLOT);g.clip();g.translate(R.coreX.x*.8,R.crest.x+R.coreY.x*.6);
 v4DrawCached(g,'crest');g.restore();
 // Central cowl and exact original amber optics.
 g.save();g.translate(R.coreX.x,R.coreY.x);
 v4DrawCached(g,'core');v4DrawCached(g,'eye');drawEyes(g);drawTicks(g);
 if(ECO.charge>.02){g.save();g.globalAlpha=ECO.charge*.34;g.globalCompositeOperation='lighter';
   const beam=g.createLinearGradient(641,492,641,664);beam.addColorStop(0,'rgba(180,255,180,0)');beam.addColorStop(.28,'rgba(205,255,198,.26)');beam.addColorStop(.52,'rgba(225,255,219,.18)');beam.addColorStop(1,'rgba(180,255,180,0)');
   g.fillStyle=beam;g.fillRect(633,492,16,172);g.restore();}
 g.restore();
 // Same animated jaw transforms as Gold; actual artwork is skin-specific.
 g.save();g.translate(R.lagX.x*.35,R.chin.x+R.calDy[0].x*.3+R.lagY.x*.5);v4DrawCached(g,'chin');g.restore();
 for(let s=0;s<2;s++){g.save();g.translate((s?-1:1)*R.cheekX.x+R.lagX.x*.6,R.cheekY.x+R.lagY.x*.6);
   g.save();if(s){g.translate(1280,0);g.scale(-1,1)}v4DrawCached(g,'cheek');g.restore();g.restore();}
 // Side modules REPLACE the original Gold caliper bitmaps. Only old transform retained.
 for(let s=0;s<2;s++){
   const sg=s?-1:1,P=PIV[s];g.save();
   g.translate(P.x+sg*R.calDx[s].x+R.lagX.x,P.y+R.calDy[s].x+R.lagY.x);
   g.rotate(sg*R.calTh[s].x);g.translate(-P.x,-P.y);
   v4DrawCached(g,s?'right':'left');v4DynamicSide(g,s);
   if(R.seam.x>.04){g.save();g.globalCompositeOperation='lighter';g.globalAlpha=Math.min(.6,R.seam.x*.58);
     v4Line(g,s?'M 830 308 Q 908 441 949 653':'M 450 308 Q 362 440 327 650','#c3f6b3',9,.8);g.restore();}
   // Disk rotates at existing Gold pivot, no replacement of its kinematics.
   g.save();g.translate(P.x,P.y);g.rotate(sg*R.spin[s].x);g.translate(-P.x,-P.y);
   v4DrawCached(g,s?'pivotRight':'pivotLeft');
   if(ECO.active){
     g.save();g.translate(P.x,P.y);
     if(!s){
       // Clean fan: no cast-shadow styling, just solid blades rotating.
       g.rotate(ecoRotorA);
       for(let i=0;i<6;i++){
         g.save();g.rotate(i*TAU/6);
         g.fillStyle=i%2===0?'#7ea88a':'#6a8f77';
         g.strokeStyle='#173325';g.lineWidth=2.2;g.lineJoin='round';
         g.beginPath();
         g.moveTo(-4,-8);
         g.quadraticCurveTo(-26,-24,-22,-49);
         g.quadraticCurveTo(-3,-60,19,-42);
         g.quadraticCurveTo(10,-32,8,-12);
         g.closePath();
         g.fill();g.stroke();
         g.restore();
       }
       g.strokeStyle='#132a1f';g.lineWidth=4;g.beginPath();g.arc(0,0,22,0,TAU);g.stroke();
       g.fillStyle='#365745';g.beginPath();g.arc(0,0,16,0,TAU);g.fill();
       g.strokeStyle='#9cbca4';g.lineWidth=2;g.beginPath();g.arc(0,0,7,0,TAU);g.stroke();
       g.fillStyle='#b6cbb5';g.beginPath();g.arc(0,0,3.6,0,TAU);g.fill();
     } else {
       g.rotate(-ecoRotorRA);
       for(let i=0;i<3;i++){
         g.save();g.rotate(i*TAU/3);g.fillStyle='#688f73';g.beginPath();g.roundRect(-2.5,-27,5,18,2);g.fill();g.restore();
       }
       g.fillStyle='#2f4c3c';g.beginPath();g.arc(0,0,9,0,TAU);g.fill();
       g.strokeStyle='#a6c5ab';g.lineWidth=1.6;g.beginPath();g.arc(0,0,4.2,0,TAU);g.stroke();
     }
     g.restore();
   }
   g.restore();
   if(lockFlash>.02){g.save();g.globalCompositeOperation='lighter';g.globalAlpha=lockFlash*.38;
     const h=g.createRadialGradient(P.x,P.y,5,P.x,P.y,120);h.addColorStop(0,'#e1ffb5');h.addColorStop(1,'rgba(189,255,144,0)');g.fillStyle=h;g.fillRect(P.x-120,P.y-120,240,240);g.restore();}
   g.restore();
 }
 ecoStatusGlow(g);
 // Preserve Gold combat force-routing and hit-location cues, with recolor only.
 for(const p of pulses){const f=clamp(p.t/p.dur,0,1),e=1-Math.pow(1-f,2);g.save();g.globalCompositeOperation='lighter';g.lineCap='round';
   g.strokeStyle=`rgba(123,213,140,${.26*(1-f)})`;g.lineWidth=p.w*2;partialLine(g,p.pts,0,e);
   g.strokeStyle=`rgba(229,255,196,${.9-f*.5})`;g.lineWidth=p.w;partialLine(g,p.pts,e-.28,e);g.restore();}
 for(const m of stress){const f=clamp(m.t/m.dur,0,1);g.save();g.globalCompositeOperation='lighter';g.globalAlpha=1-f;
   const h=g.createRadialGradient(m.x,m.y,1,m.x,m.y,66);h.addColorStop(0,'#fff3da');h.addColorStop(.35,m.armored?'#a5f4bd':'#dfb891');h.addColorStop(1,'rgba(0,0,0,0)');
   g.fillStyle=h;g.fillRect(m.x-66,m.y-66,132,132);g.strokeStyle='#B6E3A3';g.lineWidth=7;
   g.beginPath();g.moveTo(m.x-m.ny*35,m.y+m.nx*35);g.lineTo(m.x+m.ny*35,m.y-m.nx*35);g.stroke();g.restore();}
}
const rotorStates=new Map();
function springRead(source){const out={};for(const [key,val] of Object.entries(source||{}))out[key]=Array.isArray(val)?val.map(n=>({x:Number(n)||0})):{x:Number(val)||0};return out;}
export function prepareEcoGold(){v4Prepare();return V4.ready;}
export function drawEcoGoldActor(ctx,pose){
 if(!V4.ready||!pose.robot)return false;
 const m=pose.robot;
 R=springRead(m.springs);if(!R.calTh||!R.rootX||!R.tilt)return false;
 ticks=m.ticks||[0,0,0];lockFlash=m.lockFlash||0;pulses=m.pulses||[];stress=m.stress||[];
 const side=pose.side||'unknown';let state=rotorStates.get(side);
 if(!state||Number(m.time)<state.time){state={time:Number(m.time)||0,v:2.4,vr:1.2,a:0,ar:0};rotorStates.set(side,state);}
 const dt=clamp((Number(m.time)||0)-state.time,0,.05);
 const focus=!!m.scanning&&!m.held,armored=!!m.armor;
 const speed=focus?17.5:armored?6.4:2.4, speedR=focus?7.5:armored?3.4:1.2;
 state.v+=(speed-state.v)*Math.min(1,dt*7.5);
 state.vr+=(speedR-state.vr)*Math.min(1,dt*7.5);
 state.a+=state.v*dt;state.ar+=state.vr*dt;state.time=Number(m.time)||0;
 ecoRotorA=state.a;ecoRotorRA=state.ar;
 ECO={active:true,charge:focus?1:0,flash:lockFlash,armorFold:armored?clamp(R.seam.x*.9+.10):0,armorShock:armored?lockFlash:0};
 ctx.save();
 try{
  ctx.translate(R.rootX.x*HSC,R.rootY.x*HSC);ctx.rotate(R.tilt.x);ctx.scale(HSC,HSC);ctx.translate(-640,-600);v4Rig(ctx);
  return true;
 }finally{ctx.restore();R=null;ECO=null;pulses=[];stress=[];}
}

// Reuse the EXACT Gold V3 living-leaf shape in world-space FX.
export {ecLeaf as drawEcoLeafGold};
