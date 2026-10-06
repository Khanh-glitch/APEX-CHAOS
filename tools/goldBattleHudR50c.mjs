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
    '--wpIW:clamp(92px,11cqh,124px);--wpNF:15px;--amF:24px;--swH:30px}',
    '--wpIW:clamp(108px,13cqh,148px);--wpNF:16px;--amF:26px;--swH:32px}',
    'desktop weapon scale'
  );
  once(
    '#hud[data-layout="desk"] .side>.weapon{width:min(100%,384px);justify-self:end}',
    '#hud[data-layout="desk"] .side>.weapon{width:min(100%,420px);justify-self:end}',
    'desktop panel width'
  );
  once(
    '--wpIW:44px;--wpNF:11px;--amF:15px;--swH:42px;--swW:46px}',
    '--wpIW:56px;--wpNF:12px;--amF:18px;--swH:42px;--swW:46px}',
    'compact landscape weapon scale'
  );
  once(
    '--wpIW:42px;--wpNF:10.5px;--amF:15px;--swH:44px;--swW:44px}',
    '--wpIW:48px;--wpNF:11px;--amF:17px;--swH:44px;--swW:44px}',
    'compact portrait weapon scale'
  );
  once(
    '.duel-feed .df-value{font-size:14px;font-weight:900;font-style:italic;font-variant-numeric:tabular-nums;color:var(--feed,var(--bone));text-shadow:var(--ol);line-height:1}',
    '.duel-feed .df-value{font-size:16px;font-weight:900;font-style:italic;font-variant-numeric:tabular-nums;color:var(--feed,var(--bone));text-shadow:var(--ol);line-height:1}',
    'duel damage scale'
  );
  once(
    '/* ---------- 5. 1P / 2P MODE MODIFIERS ---------- */',
    '/* ---------- R50F SIZE BANDS: redistribute; never whole-HUD scale ---------- */\n' +
    '#hud[data-layout="desk"][data-size="wide"] .side{--porW:clamp(88px,10.8cqh,124px);--tileH:clamp(116px,14.5cqh,168px);--wpIW:clamp(124px,14cqh,160px);--amF:28px}\n' +
    '#hud[data-layout="desk"][data-size="wide"] .side>.ident,#hud[data-layout="desk"][data-size="wide"] .side>.skills,#hud[data-layout="desk"][data-size="wide"] .side>.weapon{width:min(100%,440px)}\n' +
    '#hud[data-layout="land"][data-size="tablet"]{--pad:8px;--g:8px;--gx:8px;--railH:44px;--mcW:96px;--lblH:16px;--barH:17px;--nmF:13px;--hpF:22px;--sideMin:220px}\n' +
    '#hud[data-layout="land"][data-size="tablet"] .side{row-gap:10px;--porW:52px;--porH:52px;--idGap:11px;--nameF:20px;--artW:min(46%,140px);--skGap:8px;--infoPad:8px 11px;--keyS:21px;--skNF:15px;--stF:11px;--cdF:24px;--wpIW:82px;--wpNF:14px;--amF:22px;--swH:48px;--swW:52px}\n' +
    '#hud[data-layout="port"][data-size="tablet"]{--pad:8px;--g:8px;--railH:46px;--mcW:96px;--lblH:16px;--barH:16px;--nmF:13px;--hpF:22px;--zoneMin:180px}\n' +
    '#hud[data-layout="port"][data-size="tablet"] .side{column-gap:10px;row-gap:8px;--porW:50px;--porH:50px;--idGap:10px;--nameF:20px;--tw:min(170px,calc((100cqw - 32px) * .34));--skGap:8px;--keyS:21px;--skNF:14px;--stF:11px;--cdF:26px;--wpIW:68px;--wpNF:13px;--amF:21px;--swH:50px;--swW:50px}\n' +
    '#hud[data-layout="port"][data-size="tablet"] .duel-feed .df-value{font-size:18px}\n\n' +
    '/* ---------- 5. 1P / 2P MODE MODIFIERS ---------- */',
    'responsive size bands'
  );
  once(
    " const layout=H>W?'port':(W>=1000&&H>=560?'desk':'land');\n S.viewport.layout=layout;\n R.hud.dataset.layout=layout;R.hud.dataset.mode=S.mode;",
    " const aspect=W/Math.max(1,H);\n const layout=H>W?'port':(W>=1180&&H>=620&&aspect>=1.5?'desk':'land');\n const size=layout==='desk'?(W>=1600&&H>=800?'wide':'desktop'):(Math.min(W,H)>=700?'tablet':'compact');\n S.viewport.layout=layout;S.viewport.size=size;\n R.hud.dataset.layout=layout;R.hud.dataset.size=size;R.hud.dataset.mode=S.mode;",
    'viewport family classifier'
  );
  once(
    " const an=sideAnchor(v),fs=clamp(an.w*(kind==='h'?.2:.16),22,kind==='h'?84:64);",
    " const an=sideAnchor(v),fs=clamp(an.w*(kind==='h'?.23:.18),26,kind==='h'?92:72);",
    'combat number scale'
  );

  once(
    '.skill[data-kind="charges"] .sk-state{min-width:7.2em}',
    '.skill[data-kind="charges"] .sk-state{min-width:7.2em}\n' +
    '.skill.is-held{filter:brightness(1.08)}\n' +
    '.skill.is-held::after{border-color:color-mix(in srgb,var(--acc) 58%,transparent)}\n' +
    '.skill.is-held .sk-art{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 34%,transparent)}',
    'held skill visual'
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
    "  seam.pressSkill=function pressSkill(pi,ai){\n    const bridge=window.APEX_GOLD;\n    if(bridge&&bridge.pressSkill)bridge.pressSkill(pi,ai);\n  };",
    "  seam.pressSkill=function pressSkill(pi,ai,input){\n    const bridge=window.APEX_GOLD;\n    if(bridge&&bridge.pressSkill)bridge.pressSkill(pi,ai,input);\n  };",
    'pointer metadata forwarding'
  );

  once(
    "R.stage.addEventListener('pointerdown',e=>{\n const sk=e.target.closest('.skill');\n if(sk){e.preventDefault();const pi=+sk.dataset.p-1;if(S.mode==='1p'&&pi===1)return;APEX_GOLD_HUD.pressSkill(pi,+sk.dataset.i);return;}\n const sw=e.target.closest('.wp-swap');if(sw){e.preventDefault();const pi=+sw.dataset.p-1;if(S.mode==='1p'&&pi===1)return;APEX_GOLD_HUD.pressSwap(pi);return;}\n});",
    "const activeSkillPointers=new Map();\nconst activeSkillSlots=new Map();\nfunction skillSlotKey(pi,ai){return pi+':'+ai;}\nfunction finishSkillPointer(e,cast){\n const rec=activeSkillPointers.get(e.pointerId);if(!rec)return;activeSkillPointers.delete(e.pointerId);activeSkillSlots.delete(skillSlotKey(rec.pi,rec.ai));\n rec.sk.classList.remove('is-held');\n try{if(rec.sk.hasPointerCapture&&rec.sk.hasPointerCapture(e.pointerId))rec.sk.releasePointerCapture(e.pointerId);}catch(_){}\n if(cast)APEX_GOLD_HUD.pressSkill(rec.pi,rec.ai,{source:'pointer',pointerId:e.pointerId,pointerType:e.pointerType||'pointer'});\n}\nR.stage.addEventListener('pointerdown',e=>{\n const sk=e.target.closest('.skill');\n if(sk){\n  e.preventDefault();const pi=+sk.dataset.p-1;if(S.mode==='1p'&&pi===1)return;if(activeSkillPointers.has(e.pointerId))return;\n  const ai=+sk.dataset.i,slotKey=skillSlotKey(pi,ai);if(activeSkillSlots.has(slotKey))return;\n  const rec={sk,pi,ai};activeSkillPointers.set(e.pointerId,rec);activeSkillSlots.set(slotKey,e.pointerId);sk.classList.add('is-held');\n  try{sk.setPointerCapture&&sk.setPointerCapture(e.pointerId);}catch(_){}\n  return;\n }\n const sw=e.target.closest('.wp-swap');if(sw){e.preventDefault();const pi=+sw.dataset.p-1;if(S.mode==='1p'&&pi===1)return;APEX_GOLD_HUD.pressSwap(pi);return;}\n});\nR.stage.addEventListener('pointerup',e=>finishSkillPointer(e,true));\nR.stage.addEventListener('pointercancel',e=>finishSkillPointer(e,false));\nR.stage.addEventListener('lostpointercapture',e=>{if(activeSkillPointers.has(e.pointerId))finishSkillPointer(e,false);});",
    'multi-pointer release-to-cast state machine'
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

  // ── Owner law (R52): a Critical/Heavy hit affects the FULL panel ──────────
  // The panel shatter clones the whole side, but the clone is blended with
  // mix-blend-mode:screen, which is invisible on the ability tiles: they are the
  // only sub-block that paints its own near-black background (#0d1013), so the
  // owner read them as "excluded from the hit". The impact now stamps the tiles
  // with the source accent for the burst window, so every sub-block of the panel
  // carries the hit.
  once(
    '.rupture-whole{z-index:1;opacity:0;filter:url(#panelWarp) saturate(1.16) contrast(1.08);mix-blend-mode:screen}',
    '.rupture-whole{z-index:1;opacity:0;filter:url(#panelWarp) saturate(1.16) contrast(1.08);mix-blend-mode:screen}\n' +
    // The layout sections (#hud[data-layout=...]) own .skill, so the impact rule
    // is written with an id so it wins on every layout, portrait included.
    '#hud .side.is-panel-hit .skill{background:linear-gradient(90deg,color-mix(in srgb,var(--hitAcc,#ff8a1e) 20%,#161b20),#0d1013)}\n' +
    '#hud .side.is-panel-hit .skill::after{border-color:color-mix(in srgb,var(--hitAcc,#ff8a1e) 72%,transparent)}\n' +
    '#hud .side.is-panel-hit .sk-art{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hitAcc,#ff8a1e) 46%,transparent)}',
    'panel-wide impact law'
  );

  once(
    "function disposeRupture(v,token){\n const p=R.ruptures[v];if(p&&token!=null&&p.token!==token)return;",
    "function panelHitWindow(v,accent){\n const root=R.side[v]&&R.side[v].root;if(!root)return;\n root.style.setProperty('--hitAcc',accent||'#ff8a1e');root.classList.add('is-panel-hit');\n clearTimeout(R.hitTimers[v]);\n R.hitTimers[v]=setTimeout(()=>root.classList.remove('is-panel-hit'),RM.matches?120:1120);\n}\nfunction disposeRupture(v,token){\n const p=R.ruptures[v];if(p&&token!=null&&p.token!==token)return;",
    'panel hit window helper'
  );
  once(
    "function panelRupture(v,token){\n if(RM.matches)return null;\n disposeRupture(v);",
    "function panelRupture(v,token,accent){\n if(RM.matches)return null;\n disposeRupture(v);\n panelHitWindow(v,accent);",
    'panel rupture stamps the tiles'
  );
  once(
    'const panel=panelRupture(v,token);R.ruptures[v]=panel;',
    'const panel=panelRupture(v,token,impactAccent);R.ruptures[v]=panel;',
    'heavy burst passes its accent into the panel law'
  );
  once(
    " frac:$('#fracture'),copy:$('#copyLayer'),diag:$('#diag'),rail:[],side:[],ruptures:[null,null],fxTimers:[]};",
    " frac:$('#fracture'),copy:$('#copyLayer'),diag:$('#diag'),rail:[],side:[],ruptures:[null,null],fxTimers:[],hitTimers:[0,0]};",
    'panel hit timers state'
  );

  // C3 (owner report: one pad, two fingers, ONE cast): a slot is a single
  // press target. Independent pointers stay independent per (side, slot), but a
  // second pointer landing on a slot that is already held never re-casts it.
  once(
    '.skill{--chamf:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}',
    '.skill{--chamf:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px)}\n' +
    '#hud .skill,#hud .wp-swap{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}',
    'phone gesture ownership on the ability pads'
  );

  const must = ['apex-battle-avatar','has-tier','is-panel-hit','--hitAcc','panelHitWindow(v,accent)','applyIdentityProjection','impactAccent','#globalFx{z-index:35','activeSkillPointers','pointerId:e.pointerId','skill.is-held','data-size="tablet"','S.viewport.size=size','--wpIW:82px','activeSkillSlots','skillSlotKey','touch-action:none'];
  for (const token of must) if (!out.includes(token)) throw new Error('R50C invariant missing: ' + token);
  return out;
}
