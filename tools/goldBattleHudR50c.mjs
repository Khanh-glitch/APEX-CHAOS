// R50C — deterministic Battle HUD live-truth hardening.
// Runs AFTER R48B. Presentation-only: no combat/balance/physics authority.
export function adaptGoldBattleHudR50c(input) {
  let out = String(input || '');

  function once(needle, replacement, label) {
    const i = out.indexOf(needle);
    if (i < 0) throw new Error('R50C ' + label + ' seam missing');
    if (out.indexOf(needle, i + needle.length) >= 0) throw new Error('R50C ' + label + ' seam duplicated');
    out = out.slice(0, i) + replacement + out.slice(i + needle.length);
  }

  once(
    '.portrait svg{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.portrait svg{position:absolute;inset:0;width:100%;height:100%;display:block}\n' +
    '.portrait>.apex-battle-avatar{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;z-index:1;background:#0b0e10}\n' +
    '.portrait.has-production-avatar>svg{display:none}\n' +
    '.portrait>.id-status{z-index:2}',
    'battle avatar CSS'
  );

  once(
    '.wp-ico{grid-area:ico;display:block;width:var(--wpIW,90px);height:calc(var(--wpIW,90px) * .3);color:var(--bone2)}',
    '.wp-ico{grid-area:ico;position:relative;isolation:isolate;display:block;width:var(--wpIW,90px);height:calc(var(--wpIW,90px) * .3);color:var(--bone2)}\n' +
    '.wp-ico::before{content:"";position:absolute;z-index:0;left:4%;right:4%;bottom:-30%;height:74%;border-radius:50%;background:radial-gradient(ellipse at center,var(--tier,#0000) 0%,color-mix(in srgb,var(--tier,#0000) 48%,transparent) 45%,transparent 76%);filter:blur(7px);opacity:0;transform:scale(.86);transition:opacity .16s ease,transform .16s ease;pointer-events:none}\n' +
    '.wp-ico.has-tier::before{opacity:.82;transform:scale(1)}\n' +
    '.wp-ico>svg,.wp-ico>.apex-weapon-asset{position:relative;z-index:1}',
    'weapon rarity underlight CSS'
  );

  once(
    '#globalFx{z-index:20;overflow:visible}\n#ruptureLayer{position:absolute;inset:0;z-index:18;pointer-events:none;overflow:hidden}\n#copyLayer{z-index:40}\n#p1Side,#p2Side,#versusRail,#matchCenter{z-index:30}',
    '#globalFx{z-index:35;overflow:visible}\n#ruptureLayer{position:absolute;inset:0;z-index:36;pointer-events:none;overflow:hidden}\n#copyLayer{z-index:40}\n#p1Side,#p2Side,#versusRail,#matchCenter{z-index:30}',
    'impact compositor'
  );

  once(
    "R.rail[i]={root:rr,cur:$('.vr-cur',rr),bar:$('.vr-bar',rr),fill:$('.vr-fill',rr),ghost:$('.vr-ghost',rr),surge:$('.vr-surge',rr),heal:$('.vr-heal',rr),hpS:'',fS:'',gS:''};",
    "R.rail[i]={root:rr,name:$('.vr-name',rr),sub:$('.vr-sub',rr),tag:$('.vr-tag',rr),cur:$('.vr-cur',rr),bar:$('.vr-bar',rr),fill:$('.vr-fill',rr),ghost:$('.vr-ghost',rr),surge:$('.vr-surge',rr),heal:$('.vr-heal',rr),hpS:'',fS:'',gS:''};",
    'rail identity cache'
  );

  once(
    "R.side[i]={root:sd,portrait:$('.portrait',sd),status:$('.id-status',sd),light:$('.side-light',sd),ctrl:$('.id-ctrl',sd),rival:",
    "R.side[i]={root:sd,portrait:$('.portrait',sd),name:$('.id-name',sd),sub:$('.id-sub',sd),tag:$('.id-tag',sd),status:$('.id-status',sd),light:$('.side-light',sd),ctrl:$('.id-ctrl',sd),avatarSrc:'',rival:",
    'side identity cache'
  );

  once(
    "const ident=[p.wi,w.name,w.type,w.asset||'',usesAmmo?1:0,w.mag,w.alt||''].join('|');",
    "const ident=[p.wi,w.name,w.type,w.asset||'',w.tier||'',w.tierColor||'',usesAmmo?1:0,w.mag,w.alt||''].join('|');",
    'weapon rarity identity'
  );

  once(
    "   u.name.textContent=w.name;u.type.textContent=w.type;if(u.alt)u.alt.textContent=w.alt||'';\n   u.mag.style.setProperty('--seg',usesAmmo?(100/Math.max(1,w.mag))+'%':'100%');u.wi=ident;",
    "   u.name.textContent=w.name;u.type.textContent=w.type;if(u.alt)u.alt.textContent=w.alt||'';\n   const tierColor=w.tierColor||'';u.ico.classList.toggle('has-tier',!!tierColor);if(tierColor)u.ico.style.setProperty('--tier',tierColor);else u.ico.style.removeProperty('--tier');u.ico.dataset.tier=w.tier||'';\n   u.mag.style.setProperty('--seg',usesAmmo?(100/Math.max(1,w.mag))+'%':'100%');u.wi=ident;",
    'weapon rarity renderer'
  );

  once(
    "  // Per-frame production projection -> canonical renderers.",
    "  function applyIdentityProjection(i,identity){\n" +
    "    if(!identity)return;\n" +
    "    const side=R.side[i],rail=R.rail[i],name=String(identity.name||''),sub=String(identity.tag||'');\n" +
    "    if(name){HEROES[i].name=name;if(side.name&&side.name.textContent!==name)side.name.textContent=name;if(rail.name&&rail.name.textContent!==name)rail.name.textContent=name;const rival=R.side[i^1]&&R.side[i^1].rival&&R.side[i^1].rival.name;if(rival&&rival.textContent!==name)rival.textContent=name;}\n" +
    "    if(sub){HEROES[i].sub=sub;if(side.sub&&side.sub.textContent!==sub)side.sub.textContent=sub;if(rail.sub&&rail.sub.textContent!==sub)rail.sub.textContent=sub;}\n" +
    "    const avatar=String(identity.battleAvatar||'');\n" +
    "    if(side.portrait&&avatar&&side.avatarSrc!==avatar){let img=side.portrait.querySelector(':scope > .apex-battle-avatar');if(!img){img=document.createElement('img');img.className='apex-battle-avatar';img.alt='';img.draggable=false;side.portrait.insertBefore(img,side.portrait.firstChild);}img.onerror=()=>{if(side.avatarSrc===avatar){side.avatarSrc='';side.portrait.classList.remove('has-production-avatar');img.remove();}};img.src=avatar;side.avatarSrc=avatar;side.portrait.classList.add('has-production-avatar');}\n" +
    "  }\n\n" +
    "  // Per-frame production projection -> canonical renderers.",
    'identity projection helper'
  );

  once(
    "      const p=S.players[i];\n      if(s.accent&&HEROES[i].accent!==s.accent){",
    "      const p=S.players[i];\n      if(s.identity)applyIdentityProjection(i,s.identity);\n      if(s.accent&&HEROES[i].accent!==s.accent){",
    'identity projection call'
  );

  once(
    "          if(typeof s.weapon.alt==='string')w.alt=s.weapon.alt;\n          w.usesAmmo=s.weapon.usesAmmo!==false;",
    "          if(typeof s.weapon.alt==='string')w.alt=s.weapon.alt;\n          if(typeof s.weapon.tier==='string')w.tier=s.weapon.tier;\n          if(typeof s.weapon.tierColor==='string')w.tierColor=s.weapon.tierColor;\n          w.usesAmmo=s.weapon.usesAmmo!==false;",
    'weapon rarity projection'
  );

  once(
    "function localDuelStat(a,v,amt,tier){\n if(!(S.viewport.layout==='port'&&S.mode==='2p'))return;\n const col=tier==='crit'?'var(--crit)':tier==='heavy'?'#ff4a43':'var(--dmg)',label=tier==='heavy'?'HEAVY':tier==='crit'?'CRIT':'HIT';",
    "function localDuelStat(a,v,amt,tier,impactAccent){\n if(!(S.viewport.layout==='port'&&S.mode==='2p'))return;\n const col=(tier==='crit'||tier==='heavy')?(impactAccent||ACC[a]):'var(--dmg)',label=tier==='heavy'?'HEAVY':tier==='crit'?'CRIT':'HIT';",
    'local duel impact color'
  );

  once(
    "function applyDamage(a,v,amt,tier){\n if(S.ko)return;const now=performance.now(),p=S.players[v];amt=Math.round(amt);\n localDuelStat(a,v,amt,tier);",
    "function applyDamage(a,v,amt,tier,impactAccent){\n if(S.ko)return;const now=performance.now(),p=S.players[v];amt=Math.round(amt);\n const eventAccent=impactAccent||ACC[a]||'#ff8a1e';\n localDuelStat(a,v,amt,tier,eventAccent);",
    'impact accent capture'
  );

  once(
    " if(tier==='normal')fxNormal(a,v,amt);else if(tier==='crit')fxCrit(a,v,amt);else fxHeavy(a,v,amt);",
    " if(tier==='normal')fxNormal(a,v,amt);else if(tier==='crit')fxCrit(a,v,amt,eventAccent);else fxHeavy(a,v,amt,eventAccent);",
    'impact accent dispatch'
  );

  once('function fxCrit(a,v,amt){','function fxCrit(a,v,amt,impactAccent){','critical signature');
  once(
    "  flash('crit',v);railSurge(v,1);if(!RM.matches)railJolt(v,6);sideRecoil(v,10);edgeShock(v,'crit');sideLight(v,0.45,240);\n  popup(v,amt,'c');bigNumber(v,amt,'c');stamp(v,'CRITICAL','crit');",
    "  flash('crit',v,impactAccent);railSurge(v,1);if(!RM.matches)railJolt(v,6);sideRecoil(v,10);edgeShock(v,'crit',impactAccent);sideLight(v,0.45,240);\n  popup(v,amt,'c',impactAccent);bigNumber(v,amt,'c',impactAccent);stamp(v,'CRITICAL','crit',impactAccent);",
    'critical event color'
  );

  once('function fxHeavy(a,v,amt){','function fxHeavy(a,v,amt,impactAccent){','heavy signature');
  once(
    "  flash('heavy',v);sweep(a,v,'heavy');shake(v,7);sideRecoil(v,7);edgeShock(v,'heavy');railSurge(v,1);if(!RM.matches)railJolt(v,6);sideLight(v,.72,370);",
    "  flash('heavy',v,impactAccent);sweep(a,v,'heavy');shake(v,7);sideRecoil(v,7);edgeShock(v,'heavy',impactAccent);railSurge(v,1);if(!RM.matches)railJolt(v,6);sideLight(v,.72,370);",
    'heavy event color 1'
  );
  once(
    "  popup(v,amt,'h');bigNumber(v,amt,'h');stamp(v,'DEVASTATING','heavy');",
    "  popup(v,amt,'h',impactAccent);bigNumber(v,amt,'h',impactAccent);stamp(v,'DEVASTATING','heavy',impactAccent);",
    'heavy event color 2'
  );

  once('function fxThunder(a,v,amt){','function fxThunder(a,v,amt,impactAccent){','thunder signature');
  once(
    " railSurge(a,1);railSurge(v,1);if(!RM.matches){railJolt(v,7);sideRecoil(v,8);edgeShock(v,'crit');}\n queueFx(()=>{\n  popup(v,amt,'c');bigNumber(v,amt,'c');stamp(v,'THUNDER','crit');",
    " railSurge(a,1);railSurge(v,1);if(!RM.matches){railJolt(v,7);sideRecoil(v,8);edgeShock(v,'crit',impactAccent);}\n queueFx(()=>{\n  popup(v,amt,'c',impactAccent);bigNumber(v,amt,'c',impactAccent);stamp(v,'THUNDER','crit',impactAccent);",
    'thunder event color'
  );

  once('function flash(kind,v){','function flash(kind,v,impactAccent){','flash signature');
  once(
    "  el.style.background='radial-gradient(circle at '+fp.x+'px '+fp.y+'px,rgba(255,232,190,.58),rgba(255,138,30,.2) 38%,rgba(255,138,30,.045) 100%)';",
    "  const c=impactAccent||'#ff8a1e';el.style.background='radial-gradient(circle at '+fp.x+'px '+fp.y+'px,color-mix(in srgb,'+c+' 48%,white),color-mix(in srgb,'+c+' 28%,transparent) 38%,color-mix(in srgb,'+c+' 7%,transparent) 100%)';",
    'critical flash color'
  );

  // The donor uses template literals here; adapt the exact post-R48B source.
  once(
    "  el.style.background=\`radial-gradient(circle at \${fp.x}px \${fp.y}px,rgba(255,232,190,.58),rgba(255,138,30,.2) 38%,rgba(255,138,30,.045) 100%)\`;",
    "  const c=impactAccent||'#ff8a1e';el.style.background='radial-gradient(circle at '+fp.x+'px '+fp.y+'px,color-mix(in srgb,'+c+' 48%,white),color-mix(in srgb,'+c+' 28%,transparent) 38%,color-mix(in srgb,'+c+' 7%,transparent) 100%)';",
    'critical flash template color'
  );

  once(
    "  el.style.background=\`radial-gradient(circle at \${fp.x}px \${fp.y}px,rgba(255,250,240,.82),rgba(255,235,220,.34) 42%,rgba(200,30,30,.11) 100%)\`;",
    "  const c=impactAccent||'#ff4a43';el.style.background='radial-gradient(circle at '+fp.x+'px '+fp.y+'px,color-mix(in srgb,'+c+' 35%,white),color-mix(in srgb,'+c+' 30%,transparent) 42%,color-mix(in srgb,'+c+' 10%,transparent) 100%)';",
    'heavy flash color'
  );

  once('function edgeShock(v,tier){','function edgeShock(v,tier,impactAccent){','edge shock signature');
  once(
    " el.style.background=tier==='heavy'?'#fff':'var(--crit)';",
    " el.style.background=impactAccent||(tier==='heavy'?'#fff':'var(--crit)');",
    'edge shock color'
  );

  once('function popup(v,amt,kind){','function popup(v,amt,kind,impactAccent){','popup signature');
  once(
    " const el=document.createElement('div');el.className='dmg '+kind;el.textContent=(kind==='heal'?'+':'')+amt;",
    " const el=document.createElement('div');el.className='dmg '+kind;el.textContent=(kind==='heal'?'+':'')+amt;if(impactAccent)el.style.setProperty('--crit',impactAccent);",
    'popup color'
  );
  once('function stamp(v,text,kind){','function stamp(v,text,kind,impactAccent){','stamp signature');
  once(
    " const el=document.createElement('div');el.className='stamp '+kind;el.textContent=text;el.style.fontSize=fs+'px';",
    " const el=document.createElement('div');el.className='stamp '+kind;el.textContent=text;el.style.fontSize=fs+'px';if(impactAccent)el.style.setProperty('--crit',impactAccent);",
    'stamp color'
  );
  once('function bigNumber(v,amt,kind){','function bigNumber(v,amt,kind,impactAccent){','big number signature');
  once(
    " const el=document.createElement('div');el.className='bignum '+kind;el.textContent=amt;el.style.fontSize=fs+'px';",
    " const el=document.createElement('div');el.className='bignum '+kind;el.textContent=amt;el.style.fontSize=fs+'px';if(impactAccent)el.style.setProperty('--crit',impactAccent);",
    'big number color'
  );

  once(
    "  seam.hit=function hit(a,v,amt,tier,afterHp){\n    const p=S.players[v];if(!p)return;\n    if(Number.isFinite(afterHp)){p.hp=Math.max(0,afterHp+Math.round(amt));}\n    applyDamage(a,v,Math.round(amt),tier);\n  };",
    "  seam.hit=function hit(a,v,amt,tier,afterHp,impactAccent){\n    const p=S.players[v];if(!p)return;\n    if(Number.isFinite(afterHp)){p.hp=Math.max(0,afterHp+Math.round(amt));}\n    applyDamage(a,v,Math.round(amt),tier,impactAccent);\n  };",
    'production hit accent'
  );

  once(
    "  seam.hitStorm=function hitStorm(a,v,amt,afterHp){\n    const p=S.players[v];if(!p)return;\n    if(Number.isFinite(afterHp)){p.hp=Math.max(0,afterHp+Math.round(amt));}\n    applyDamage(a,v,Math.round(amt),'heavy');\n    fxThunder(a,v,Math.round(amt));\n  };",
    "  seam.hitStorm=function hitStorm(a,v,amt,afterHp,impactAccent){\n    const p=S.players[v];if(!p)return;\n    if(Number.isFinite(afterHp)){p.hp=Math.max(0,afterHp+Math.round(amt));}\n    applyDamage(a,v,Math.round(amt),'heavy',impactAccent);\n    fxThunder(a,v,Math.round(amt),impactAccent);\n  };",
    'storm hit accent'
  );

  const must = ['apex-battle-avatar','has-tier','applyIdentityProjection','impactAccent','#globalFx{z-index:35'];
  for (const token of must) if (!out.includes(token)) throw new Error('R50C invariant missing: ' + token);
  return out;
}
