// R48B — deterministic Battle HUD adaptation.
// Presentation-only: production combat truth stays in goldProductBridge.js and
// the existing game runtimes. This module adapts the generated Gold donor
// without changing hero mechanics, damage, physics, inputs, or arena geometry.

export function adaptGoldBattleHudR48b(input) {
  let out = String(input || '');

  function replaceOnce(needle, replacement, label) {
    const i = out.indexOf(needle);
    if (i < 0) throw new Error('R48B ' + label + ' seam missing');
    if (out.indexOf(needle, i + needle.length) >= 0) throw new Error('R48B ' + label + ' seam duplicated');
    out = out.slice(0, i) + replacement + out.slice(i + needle.length);
  }

  replaceOnce(
    '.sk-art svg{position:relative;z-index:1;width:60%;height:60%;display:block;transition:opacity .2s}',
    '.sk-art svg{position:relative;z-index:1;width:60%;height:60%;display:block;transition:opacity .2s}\n' +
    '.sk-art>.apex-skill-icon{position:relative;z-index:1;width:100%;height:100%;display:block;object-fit:cover;transition:opacity .2s}\n' +
    '.sk-art.has-production-icon>svg{display:none}\n' +
    '.skill[data-state="cd"] .sk-art>.apex-skill-icon{opacity:.35}\n' +
    '.skill[data-state="active"]{background:linear-gradient(90deg,var(--accA),#10161a)}\n' +
    '.skill[data-state="active"] .sk-state{color:var(--bone)}\n' +
    '.skill[data-kind="charges"] .sk-state{min-width:7.2em}',
    'skill production image CSS'
  );

  replaceOnce(
    '.wp-ico svg{width:100%;height:100%;display:block}\n.side[data-mirror] .wp-ico svg{transform:scaleX(-1)}',
    '.wp-ico svg{width:100%;height:100%;display:block}\n' +
    '.wp-ico>.apex-weapon-asset{width:100%;height:100%;display:block;object-fit:contain;filter:drop-shadow(0 3px 3px rgba(0,0,0,.55))}\n' +
    '.side[data-mirror] .wp-ico svg,.side[data-mirror] .wp-ico>.apex-weapon-asset{transform:scaleX(-1)}\n' +
    '.weapon.no-ammo .wp-mag{opacity:.3}\n' +
    '.weapon.no-ammo .wp-cur{color:var(--mute)}',
    'weapon production image CSS'
  );

  replaceOnce(
    '#globalFx{z-index:20}\n#copyLayer{z-index:30}\n#ruptureLayer{position:absolute;inset:0;z-index:18;pointer-events:none;overflow:hidden}',
    '#arenaZone{z-index:1}\n' +
    '#globalFx{z-index:20;overflow:visible}\n' +
    '#ruptureLayer{position:absolute;inset:0;z-index:18;pointer-events:none;overflow:hidden}\n' +
    '#copyLayer{z-index:40}\n' +
    '#p1Side,#p2Side,#versusRail,#matchCenter{z-index:30}',
    'combat FX compositor CSS'
  );

  replaceOnce(
`const R={stage:$('#stage'),hud:$('#hud'),vr:$('#versusRail'),mc:$('#matchCenter'),time:$('#mcTime'),roundEl:$('#mcRound'),
 arena:$('#arena'),cv:$('#arenaCanvas'),afx:$('#arenaFx'),fx:$('#globalFx'),fxCv:$('#fxCanvas'),rupture:$('#ruptureLayer'),flash:$('.gfx-flash'),tension:$('.gfx-tension'),
 frac:$('#fracture'),copy:$('#copyLayer'),diag:$('#diag'),rail:[],side:[],ruptures:[null,null],fxTimers:[]};
R.ctx=R.cv.getContext('2d');
R.fxCtx=R.fxCv.getContext('2d');`,
`const R={stage:$('#stage'),hud:$('#hud'),vr:$('#versusRail'),mc:$('#matchCenter'),time:$('#mcTime'),roundEl:$('#mcRound'),
 arena:$('#arena'),cv:$('#arenaCanvas'),afx:$('#arenaFx'),fx:$('#globalFx'),fxCv:$('#fxCanvas'),rupture:$('#ruptureLayer'),flash:$('.gfx-flash'),tension:$('.gfx-tension'),
 frac:$('#fracture'),copy:$('#copyLayer'),diag:$('#diag'),rail:[],side:[],ruptures:[null,null],fxTimers:[]};
// Explicit compositor: arena < critical/heavy combat FX < HUD chrome.
// #hud fills #stage, so reparenting this absolute full-screen node preserves
// stage-space coordinates while preventing the live arena from covering it.
if(R.fx&&R.hud&&R.fx.parentElement!==R.hud)R.hud.appendChild(R.fx);
R.ctx=R.cv.getContext('2d');
R.fxCtx=R.fxCv.getContext('2d');`,
    'global FX reparent'
  );

  replaceOnce(
    "skills:[...sd.querySelectorAll('.skill')].map(el=>({el,mask:$('.sk-mask',el),cdn:$('.sk-cdn',el),bar:$('.sk-bar i',el),pips:[...el.querySelectorAll('.sk-pips i')],state:$('.sk-state',el),slot:$('.sk-slot',el),sweep:$('.sk-sweep',el),flash:$('.sk-flash',el),st:'ready',k:{}})),",
    "skills:[...sd.querySelectorAll('.skill')].map(el=>({el,art:$('.sk-art',el),name:$('.sk-name',el),desc:$('.sk-desc',el),mask:$('.sk-mask',el),cdn:$('.sk-cdn',el),bar:$('.sk-bar i',el),pipsRoot:$('.sk-pips',el),pips:[...el.querySelectorAll('.sk-pips i')],state:$('.sk-state',el),slot:$('.sk-slot',el),sweep:$('.sk-sweep',el),flash:$('.sk-flash',el),st:'ready',k:{}})),",
    'skill node cache'
  );

  replaceOnce(
`function renderWeapon(i){
 const p=S.players[i],h=HEROES[i],w=h.weapons[p.wi],alt=h.weapons[p.wi^1],u=R.side[i].wp;
 if(u.wi!==p.wi){u.ico.innerHTML=w.icon;u.name.textContent=w.name;u.type.textContent=w.type;if(u.alt)u.alt.textContent=alt.name;u.mag.style.setProperty('--seg',(100/w.mag)+'%');u.wi=p.wi;}
 const rel=!!p.reloadUntil,am=p.ammo[p.wi],key=rel?'R':am+'/'+w.mag;
 if(u.k!==key){u.k=key;u.cur.textContent=rel?'––':am;u.max.textContent=rel?'RELOAD':'/'+w.mag;u.root.classList.toggle('reloading',rel);
   if(!rel)u.mag.style.clipPath=\`inset(0 \${(100-am/w.mag*100).toFixed(2)}% 0 0)\`;}
}`,
`function renderWeapon(i){
 const p=S.players[i],h=HEROES[i],w=h.weapons[p.wi],u=R.side[i].wp;
 const usesAmmo=w.usesAmmo!==false&&Number(w.mag)>0;
 const ident=[p.wi,w.name,w.type,w.asset||'',usesAmmo?1:0,w.mag,w.alt||''].join('|');
 if(u.wi!==ident){
   if(w.asset){
     u.ico.innerHTML='';
     const img=document.createElement('img');img.className='apex-weapon-asset';img.alt='';img.draggable=false;img.src=w.asset;
     img.addEventListener('error',()=>{img.remove();if(w.icon)u.ico.innerHTML=w.icon;},{once:true});
     u.ico.appendChild(img);
   }else u.ico.innerHTML=w.icon||'';
   u.name.textContent=w.name;u.type.textContent=w.type;if(u.alt)u.alt.textContent=w.alt||'';
   u.mag.style.setProperty('--seg',usesAmmo?(100/Math.max(1,w.mag))+'%':'100%');u.wi=ident;
 }
 const rel=!!p.reloadUntil,am=usesAmmo?Math.max(0,Number(p.ammo[p.wi])||0):0,key=rel?'R':(usesAmmo?am+'/'+w.mag:'NA');
 if(u.k!==key){u.k=key;u.cur.textContent=rel?'––':(usesAmmo?am:'—');u.max.textContent=rel?'RELOAD':(usesAmmo?'/'+w.mag:'');u.root.classList.toggle('reloading',rel);u.root.classList.toggle('no-ammo',!usesAmmo);
   if(!rel)u.mag.style.clipPath=usesAmmo?\`inset(0 \${(100-am/Math.max(1,w.mag)*100).toFixed(2)}% 0 0)\`:'inset(0 0 0 0)';}
}`,
    'weapon renderer'
  );

  replaceOnce(
`function renderSkills(now){
 for(let i=0;i<2;i++)for(let k=0;k<2;k++){
  const a=S.players[i].abil[k],u=R.side[i].skills[k];
   if(a.next&&now>=a.next){a.charges++;a.next=a.charges<a.max?a.next+a.cd*1000:0;readyPop(u,i,k);}
  const frac=a.next?clamp((a.next-now)/(a.cd*1000),0,1):0;
  const st=now<a.castUntil?'cast':a.charges>0?'ready':'cd';
  if(st!==u.st){u.el.dataset.state=st;u.st=st;}
  const m=\`scaleY(\${a.charges>0?0:frac.toFixed(3)})\`;if(u.k.m!==m){u.mask.style.transform=m;u.k.m=m;}
  const b=\`scaleX(\${a.next?(1-frac).toFixed(3):1})\`;if(u.k.b!==b){u.bar.style.transform=b;u.k.b=b;}
  const secs=(frac*a.cd).toFixed(1);
  const txt=st==='cast'?'CAST':st==='cd'?secs+'s':(a.max>1?a.charges+'/'+a.max:'READY');
  if(u.k.t!==txt){u.state.textContent=txt;u.k.t=txt;}
  const cd=st==='cd'?secs:'';if(u.k.c!==cd){u.cdn.textContent=cd;u.k.c=cd;}
  if(u.k.p!==a.charges){u.pips.forEach((el,j)=>el.classList.toggle('on',j<a.charges));u.k.p=a.charges;}
 }
}`,
`function renderSkills(now){
 for(let i=0;i<2;i++)for(let k=0;k<2;k++){
  const a=S.players[i].abil[k],u=R.side[i].skills[k];
  const remaining=a.next?Math.max(0,(a.next-now)/1000):0;
  const frac=a.next?clamp(remaining/Math.max(.05,a.cd),0,1):0;
  const activeRemaining=a.activeUntil?Math.max(0,(a.activeUntil-now)/1000):0;
  const activeFrac=a.duration>0?clamp(activeRemaining/a.duration,0,1):0;
  const st=now<a.castUntil?'cast':activeRemaining>0?'active':a.charges>0?'ready':'cd';
  const prevSt=u.st;
  if(st!==prevSt){
   if(prevSt==='cd'&&st==='ready'){u.readyAgainUntil=now+720;readyPop(u,i,k);}
   else if(st!=='ready')u.readyAgainUntil=0;
   u.el.dataset.state=st;u.st=st;
  }
  u.el.dataset.kind=a.kind||'cooldown';
  const maskFrac=(st==='cd'&&a.charges<=0)?frac:0;
  const m=\`scaleY(\${maskFrac.toFixed(3)})\`;if(u.k.m!==m){u.mask.style.transform=m;u.k.m=m;}
  const meter=activeRemaining>0?activeFrac:(a.next?(1-frac):1);
  const b=\`scaleX(\${meter.toFixed(3)})\`;if(u.k.b!==b){u.bar.style.transform=b;u.k.b=b;}
  const secs=remaining.toFixed(1),activeSecs=activeRemaining.toFixed(1);
  let txt='READY';
  if(st==='cast')txt='PRESS-CAST';
  else if(activeRemaining>0)txt='ACTIVE '+activeSecs+'s';
  else if(st==='ready'&&now<(u.readyAgainUntil||0))txt='READY AGAIN';
  else if(st==='cd')txt='COOLDOWN '+secs+'s';
  else if(a.kind==='charges')txt=a.next&&a.charges<a.max?('READY · '+a.charges+'/'+a.max+' · '+secs+'s'):('READY · '+a.charges+'/'+a.max);
  if(u.k.t!==txt){u.state.textContent=txt;u.k.t=txt;}
  const cd=st==='cd'?secs:'';if(u.k.c!==cd){u.cdn.textContent=cd;u.k.c=cd;}
  if(u.k.p!==a.charges){u.pips.forEach((el,j)=>el.classList.toggle('on',j<a.charges));u.k.p=a.charges;}
 }
}`,
    'skill renderer'
  );

  replaceOnce(
    "      if(s.accent&&HEROES[i].accent!==s.accent)HEROES[i].accent=s.accent;",
`      if(s.accent&&HEROES[i].accent!==s.accent){
        HEROES[i].accent=s.accent;ACC[i]=s.accent;
        const key=i===0?'p1':'p2';
        R.stage.style.setProperty('--'+key,s.accent);
        R.stage.style.setProperty('--'+key+'m','color-mix(in srgb,'+s.accent+' 76%,#000)');
        R.stage.style.setProperty('--'+key+'a','color-mix(in srgb,'+s.accent+' 16%,transparent)');
        R.stage.style.setProperty('--'+key+'b','color-mix(in srgb,'+s.accent+' 42%,transparent)');
        R.side[i].root.style.setProperty('--acc',s.accent);
        R.rail[i].root.style.setProperty('--acc',s.accent);
        R.rail[i].root.style.setProperty('--fill0','color-mix(in srgb,'+s.accent+' 34%,#050607)');
        R.rail[i].root.style.setProperty('--fill1','color-mix(in srgb,'+s.accent+' 78%,#050607)');
        R.rail[i].root.style.setProperty('--fill2','color-mix(in srgb,'+s.accent+' 88%,#fff)');
      }`,
    'hero accent projection'
  );

  replaceOnce(
`          if(s.weapon.name)w.name=s.weapon.name;
          if(s.weapon.type)w.type=s.weapon.type;
          if(Number.isFinite(s.weapon.mag)&&s.weapon.mag>0)w.mag=s.weapon.mag;
          if(Number.isFinite(s.weapon.ammo))p.ammo[0]=s.weapon.ammo;`,
`          if(s.weapon.name)w.name=s.weapon.name;
          if(s.weapon.type)w.type=s.weapon.type;
          if(typeof s.weapon.asset==='string')w.asset=s.weapon.asset;
          if(typeof s.weapon.alt==='string')w.alt=s.weapon.alt;
          w.usesAmmo=s.weapon.usesAmmo!==false;
          if(Number.isFinite(s.weapon.mag))w.mag=Math.max(0,s.weapon.mag);
          if(Number.isFinite(s.weapon.ammo))p.ammo[0]=Math.max(0,s.weapon.ammo);`,
    'weapon production projection'
  );

  replaceOnce(
`          if(sk.name){
            a.name=sk.name;
            const el=R.side[i].skills[k].el.querySelector('.sk-name');
            if(el&&el.textContent!==sk.name)el.textContent=sk.name;
          }
          if(Number.isFinite(sk.cd))a.cd=Math.max(.05,sk.cd);
          if(Number.isFinite(sk.max))a.max=Math.max(1,sk.max);
          if(Number.isFinite(sk.charges))a.charges=Math.max(0,Math.min(a.max,sk.charges));
          // nextIn is the REAL remaining time from production; the donor
          // only re-derives its own absolute deadline from it.
          a.next=Number.isFinite(sk.nextIn)&&sk.nextIn>0?now+sk.nextIn*1000:0;
          a.__truth=!!sk.truth;
          if(sk.castUntil)a.castUntil=now+380;`,
`          const u=R.side[i].skills[k];
          if(sk.name){a.name=sk.name;if(u.name&&u.name.textContent!==sk.name)u.name.textContent=sk.name;}
          if(sk.desc&&u.desc&&u.desc.textContent!==sk.desc)u.desc.textContent=sk.desc;
          if(sk.kind){a.kind=sk.kind;u.slot.textContent=sk.kind==='charges'?'CHARGES':(sk.kind==='duration'?'ACTIVE WINDOW':'ABILITY '+(k+1));}
          if(Number.isFinite(sk.duration))a.duration=Math.max(0,sk.duration);
          if(sk.icon&&u.k.icon!==sk.icon){
            let img=u.art&&u.art.querySelector(':scope > .apex-skill-icon');
            if(!img&&u.art){img=document.createElement('img');img.className='apex-skill-icon';img.alt='';img.draggable=false;u.art.insertBefore(img,u.art.firstChild);}
            if(img){img.src=sk.icon;img.onerror=()=>{img.remove();u.art&&u.art.classList.remove('has-production-icon');};u.art.classList.add('has-production-icon');}
            u.k.icon=sk.icon;
          }
          if(Number.isFinite(sk.cd))a.cd=Math.max(.05,sk.cd);
          if(Number.isFinite(sk.max)){
            const max=Math.max(1,sk.max);
            if(a.max!==max&&u.pipsRoot){u.pipsRoot.innerHTML=max>1?'<i></i>'.repeat(max):'';u.pips=[...u.pipsRoot.querySelectorAll('i')];u.k.p=undefined;}
            a.max=max;
          }
          if(Number.isFinite(sk.charges))a.charges=Math.max(0,Math.min(a.max,sk.charges));
          // nextIn is REAL production cooldown/recharge truth. The donor never
          // increments charges or fabricates its own cooldown completion.
          a.next=Number.isFinite(sk.nextIn)&&sk.nextIn>0?now+sk.nextIn*1000:0;
          a.__truth=!!sk.truth;
          if(sk.castUntil)a.castUntil=now+380;`,
    'skill production projection'
  );

  replaceOnce(
`  seam.cast=function castEvent(pi,ai){
    cast(pi,ai,'production');
  };`,
`  seam.cast=function castEvent(pi,ai){
    const a=S.players[pi]&&S.players[pi].abil[ai],u=R.side[pi]&&R.side[pi].skills[ai];
    if(!a||!u)return;
    const now=performance.now();a.castUntil=now+380;
    if(a.kind==='duration'&&a.duration>0)a.activeUntil=now+a.duration*1000;
    if(!RM.matches)u.el.animate([{scale:1},{scale:.92,offset:.16},{scale:1.035,offset:.52},{scale:1}],{duration:380,easing:'cubic-bezier(.2,.8,.2,1)'});
    u.flash.animate([{opacity:1},{opacity:0}],{duration:380,easing:'ease-out'});
    if(!RM.matches)u.sweep.animate([{transform:'translateX(-140%) skewX(-18deg)'},{transform:'translateX(330%) skewX(-18deg)'}],{duration:420,easing:'ease-out'});
    streakTo(pi,u.el);
  };`,
    'production cast visual'
  );

  replaceOnce(
`  seam.setSkill=function setSkill(pi,ai,patch){
    const a=S.players[pi]&&S.players[pi].abil[ai];if(!a||!patch)return;
    a.castUntil=patch.castUntil?performance.now()+380:0;
  };`,
`  seam.setSkill=function setSkill(pi,ai,patch){
    const a=S.players[pi]&&S.players[pi].abil[ai];if(!a||!patch)return;
    if(patch.kind)a.kind=patch.kind;
    if(patch.castUntil)a.castUntil=performance.now()+380;
    if(Number.isFinite(patch.activeFor)&&patch.activeFor>0){a.duration=patch.activeFor;a.activeUntil=performance.now()+patch.activeFor*1000;}
  };`,
    'semantic cast state'
  );

  replaceOnce(
`      // Production truth owns skill readiness: while a projection is
      // active the donor must not auto-restore charges between frames.
      for(let k=0;k<2;k++){
        const a=p.abil[k];if(!a||!a.__truth)continue;
        if(a.next&&now>=a.next){
          if(a.charges<a.max){a.charges++;a.next=a.charges<a.max?a.next+a.cd*1000:0;}
          else a.next=0;
        }
      }`,
`      // Production projection is the ONLY cooldown/charge authority.
      // The donor never increments charges or completes cooldowns locally.`,
    'remove donor skill authority'
  );

  const must = [
    'apex-weapon-asset',
    'apex-skill-icon',
    'Explicit compositor: arena < critical/heavy combat FX < HUD chrome',
    "u.el.dataset.kind=a.kind||'cooldown'",
    'ACC[i]=s.accent',
    'nextIn is REAL production cooldown/recharge truth',
    'Production projection is the ONLY cooldown/charge authority',
  ];
  for (const token of must) {
    if (!out.includes(token)) throw new Error('R48B invariant missing: ' + token);
  }
  return out;
}
