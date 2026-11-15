// Tactical Pulse HUD B — source-owned Gold Battle HUD adapter.
// Preserves all canonical Gold layout zones, hero motifs, R48B/R50C/R55/R83/R91
// invariants, and full arena footprint while enforcing:
//   1. Strict 4-state skill truth: STANDBY, READY (CASTABLE), ACTIVE, COOLDOWN
//      plus transient non-destructive fail feedback (never optimistic charge/cd).
//   2. Real simulation-clock active windows + config-backed mitigation readouts
//      (e.g. -55% DMG during Virtual Armor) across heroes without fake timers.
//   3. Reason-accurate standby labels across heroes (STUNNED, LOCKED, RETURNING,
//      WAIT · GUN only for Robot A1 without floor gun, STANDBY for other heroes).
//   4. Mode-accurate role subtitle in .id-sub and live aria-label synchronization.

export const TACTICAL_PULSE_HUD_CSS = `/* TACTICAL PULSE HUD B: distinct STANDBY vs CASTABLE vs ACTIVE vs COOLDOWN */
.skill[data-tp-state="standby"]{
  border-color:rgba(138,150,164,.16);
  background:linear-gradient(90deg,rgba(255,255,255,.02),rgba(10,13,16,.92));
}
.skill[data-tp-state="standby"]::before{opacity:.24;background:#7d8894}
.skill[data-tp-state="standby"] .sk-art{opacity:.52}
.skill[data-tp-state="standby"] .sk-name{color:rgba(226,232,238,.74)}
.skill[data-tp-state="standby"] .sk-key{color:#9aa4ae;background:#14191e;box-shadow:inset 0 0 0 1px rgba(154,164,174,.38)}
.skill[data-tp-state="standby"] .sk-slot{color:rgba(164,176,188,.72)}
.skill[data-tp-state="standby"] .sk-state{color:#9aa4ae}
.skill[data-tp-state="standby"] .sk-bar i{
  background:repeating-linear-gradient(90deg,rgba(148,162,176,.55) 0 8px,rgba(148,162,176,.14) 8px 13px);
}
.skill[data-tp-reject="1"]{
  box-shadow:inset 0 0 0 1.5px rgba(255,156,74,.78);
}
.skill[data-tp-reject="1"] .sk-state{color:#ffb36b}
.skill[data-tp-castable="1"][data-state="ready"]{
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 54%,transparent),0 0 16px color-mix(in srgb,var(--acc) 14%,transparent);
  background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 17%,#11161b),#0c0f13 78%);
}
.skill[data-tp-castable="1"][data-state="ready"] .sk-key{
  background:var(--acc);
  color:#090b0d;
  font-weight:800;
  box-shadow:0 0 10px color-mix(in srgb,var(--acc) 42%,transparent);
}
.skill[data-tp-castable="1"][data-state="ready"] .sk-state{
  color:color-mix(in srgb,var(--acc) 76%,#ffffff);
  font-weight:700;
}
.skill[data-tp-target="1"][data-state="ready"]{
  box-shadow:inset 0 0 0 1.5px rgba(86,224,255,.78),0 0 18px rgba(86,224,255,.18);
  background:linear-gradient(90deg,rgba(86,224,255,.17),#0b1015 78%);
}
.skill[data-tp-target="1"][data-state="ready"] .sk-slot{color:#7ee8ff;font-weight:700}
.skill[data-tp-target="1"][data-state="ready"] .sk-state{color:#a8f3ff;font-weight:800}
.skill[data-state="active"]{
  box-shadow:inset 0 0 0 1.5px rgba(86,224,255,.72),0 0 16px rgba(86,224,255,.16);
  background:linear-gradient(90deg,rgba(86,224,255,.16),#0b1015 80%);
}
.skill[data-state="active"] .sk-key{background:#56e0ff;color:#06080a;font-weight:800}
.skill[data-state="active"] .sk-slot{color:#7ee8ff;font-weight:700}
.skill[data-state="active"] .sk-state{color:#56e0ff;font-weight:800}
.skill[data-state="active"] .sk-bar i{background:#56e0ff}
/* Prevent long localized slot labels (e.g. VIE 2P) from ever shrinking key caps (NUM1/NUM2) */
.sk-top{min-width:0}
.sk-top .sk-key{flex:0 0 auto!important;min-width:max-content!important}
.sk-top .sk-slot{min-width:0!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* Mobile landscape & square P90 polish: crisp spacing around P1 identity, top HP numerals & proportional skill height */
#hud:not([data-quest="1"])[data-layout="land"][data-mode="1p"] #p1Side .ident{
  align-items:center;
  min-height:42px;
}
#hud:not([data-quest="1"])[data-layout="land"][data-mode="1p"] #p1Side .skills{
  max-height:264px;
}
#hud:not([data-quest="1"])[data-layout="land"][data-mode="1p"] .vr-top{
  align-items:baseline;
  padding-bottom:1px;
}
/* Mobile portrait 1p thumb zone: anchor J/K in thumb reach and preserve HUD-free safe band */
#hud:not([data-quest="1"])[data-layout="port"][data-mode="1p"] #p1Side .ident{
  align-self:start;
}
/* Issue #105: VS BOT portrait 1P. The P1 row reserves only its content minimum\n   (ident 44 + gap 8 + J/K >=96). The square arena takes the freed height on\n   short phones; J/K sit directly under the identity row, capped, so no empty\n   band remains between them. This later rule wins the cascade over the donor 200px. */\n#hud:not([data-quest=\"1\"])[data-layout=\"port\"][data-mode=\"1p\"]{--p1Min:150px}\n#hud:not([data-quest=\"1\"])[data-layout=\"port\"][data-mode=\"1p\"] #p1Side .skills{\n  align-self:start;\n  height:min(100%,280px);\n}
#hud:not([data-quest="1"])[data-layout="port"][data-mode="1p"] #p1Side .sk-art{
  aspect-ratio:auto!important;
  height:100%!important;
  min-height:0;
  overflow:hidden;
}
/* Scoped 1p opponent mini-skill label readability: isolate LTR reading order inside
   mirrored #p2Side (prevents RTL left-prefix clipping such as "...TUAL ARMOR") and
   allow 2 compact lines within the existing 64px column on portrait 1p without
   expanding column width or shrinking the arena on 320x568 / 390x844 ENG/VIE. */
#hud:not([data-quest="1"])[data-mode="1p"] #p2Side .sk-name{
  direction:ltr;
  unicode-bidi:isolate;
}
#hud:not([data-quest="1"])[data-layout="port"][data-mode="1p"] #p2Side .skills{
  height:44px;
}
#hud:not([data-quest="1"])[data-layout="port"][data-mode="1p"] #p2Side .sk-info{
  padding:2px 4px;
  gap:2px;
}
#hud:not([data-quest="1"])[data-layout="port"][data-mode="1p"] #p2Side .sk-name{
  text-align:right;
  padding:2px 2px 0;
  white-space:normal;
  display:-webkit-box;
  -webkit-box-orient:vertical;
  -webkit-line-clamp:2;
  line-clamp:2;
  font-size:9px;
  line-height:1.1;
  letter-spacing:0;
  max-width:66px;
}
@media(max-width:340px){
  #hud:not([data-quest="1"])[data-layout="port"][data-mode="1p"] #p2Side .sk-name{
    font-size:8.5px;
    max-width:76px;
  }
}
`;

function replaceOnce(src, label, before, after) {
  const parts = src.split(before);
  if (parts.length !== 2) {
    throw new Error(`TacticalPulse adapter anchor drift (${label}): matches=${parts.length - 1}`);
  }
  return parts[0] + after + parts[1];
}

export function adaptGoldBattleHudTacticalPulse(src) {
  if (src.includes('TACTICAL PULSE HUD B')) {
    throw new Error('TacticalPulse duplicate law');
  }
  let out = src;

  // 1. Insert CSS cleanly right before closing </style> of primary stylesheet.
  const styleIdx = out.indexOf('</style>');
  if (styleIdx < 0) throw new Error('TacticalPulse adapter missing primary </style>');
  out = out.slice(0, styleIdx) + TACTICAL_PULSE_HUD_CSS + out.slice(styleIdx);

  // 2. Keep fantasy tag in rail.sub while surfacing mode-accurate roleHint in side.sub.
  out = replaceOnce(
    out,
    'identity-role-hint',
    'if(sub){HEROES[i].sub=sub;if(side.sub&&side.sub.textContent!==sub)side.sub.textContent=sub;if(rail.sub&&rail.sub.textContent!==sub)rail.sub.textContent=sub;}',
    'if(sub){HEROES[i].sub=sub;const sideSub=String(identity.roleHint||sub);if(side.sub&&side.sub.textContent!==sideSub)side.sub.textContent=sideSub;if(rail.sub&&rail.sub.textContent!==sub)rail.sub.textContent=sub;}'
  );

  // 3. Project full Tactical Pulse truth fields in seam.applyState & add seam.castFail.
  out = replaceOnce(
    out,
    'applyState-truth-fields',
    `          if(sk.kind){a.kind=sk.kind;u.slot.textContent=sk.kind==='charges'?'CHARGES':(sk.kind==='duration'?'ACTIVE WINDOW':'ABILITY '+(k+1));}`,
    `          if(sk.kind){a.kind=sk.kind;a.__baseSlot=sk.kind==='charges'?'CHARGES':(sk.kind==='duration'?'ACTIVE WINDOW':'ABILITY '+(k+1));}`
  );

  out = replaceOnce(
    out,
    'applyState-legality',
    `          a.__truth=!!sk.truth;
          a.locked=sk.locked===true;
          if(sk.castUntil)a.castUntil=now+380;`,
    `          a.__truth=!!sk.truth;
          a.__castable=sk.truth===true&&sk.castable===true;
          a.__castReason=String(sk.castReason||(sk.truth?'condition':'syncing'));
          a.__mechanic=String(sk.mechanic||'');
          a.__targetWeaponId=String(sk.targetWeaponId||'');
          a.__targetName=String(sk.targetName||'');
          a.__activeRemainSec=Number.isFinite(sk.activeRemainSec)?Math.max(0,sk.activeRemainSec):0;
          a.__mitigationPct=Number.isFinite(sk.mitigationPct)?Math.max(0,Math.round(sk.mitigationPct)):0;
          a.locked=sk.locked===true;
          if(sk.castUntil)a.castUntil=now+380;`
  );

  out = replaceOnce(
    out,
    'seam-castFail',
    `  seam.cast=function castEvent(pi,ai){`,
    `  seam.castFail=function castFailEvent(pi,ai,reason){
    const a=S.players[pi]&&S.players[pi].abil[ai],u=R.side[pi]&&R.side[pi].skills[ai];
    if(!a||!u)return;
    a.__failReason=String(reason||'condition');
    a.__failUntil=performance.now()+850;
    if(!RM.matches){
      u.el.animate([{translate:'0 0'},{translate:'-3px 0'},{translate:'2px 0'},{translate:'0 0'}],{duration:210,easing:'ease-out'});
    }
  };
  seam.cast=function castEvent(pi,ai){`
  );

  // 4. Authoritative simulation-clock active window, distinct standby vs castable,
  //    hero-accurate reason copy, mitigation readout, and live accessible name.
  //    Preserves every exact R48B/R70 token pinned by production gates!
  out = replaceOnce(
    out,
    'renderSkills-tactical-pulse',
    `  const activeRemaining=a.activeUntil?Math.max(0,(a.activeUntil-now)/1000):0;
  const activeFrac=a.duration>0?clamp(activeRemaining/a.duration,0,1):0;
  const st=a.locked===true?'locked':now<a.castUntil?'cast':activeRemaining>0?'active':a.charges>0?'ready':'cd';
  const prevSt=u.st;
  if(st!==prevSt){
   if(prevSt==='cd'&&st==='ready'){u.readyAgainUntil=now+720;readyPop(u,i,k);}
   else if(st!=='ready')u.readyAgainUntil=0;
   u.el.dataset.state=st;u.el.disabled=st==='locked';u.st=st;
  }
  u.el.dataset.kind=a.kind||'cooldown';
  const maskFrac=(st==='cd'&&a.charges<=0)?frac:0;
  const m=\`scaleY(\${maskFrac.toFixed(3)})\`;if(u.k.m!==m){u.mask.style.transform=m;u.k.m=m;}
  const meter=activeRemaining>0?activeFrac:(a.next?(1-frac):1);
  const b=\`scaleX(\${meter.toFixed(3)})\`;if(u.k.b!==b){u.bar.style.transform=b;u.k.b=b;}
  const secs=remaining.toFixed(1),activeSecs=activeRemaining.toFixed(1);
  let txt='READY';
  if(st==='locked')txt='LOCKED';
  else if(st==='cast')txt='PRESS-CAST';
  else if(activeRemaining>0)txt='ACTIVE '+activeSecs+'s';
  else if(st==='ready'&&now<(u.readyAgainUntil||0))txt='READY AGAIN';
  else if(st==='cd')txt='COOLDOWN '+secs+'s';
  else if(a.kind==='charges')txt=a.next&&a.charges<a.max?('READY · '+a.charges+'/'+a.max+' · '+secs+'s'):('READY · '+a.charges+'/'+a.max);
  if(u.k.t!==txt){u.state.textContent=txt;u.k.t=txt;}`,
    `  const activeRemaining=typeof a.__activeRemainSec==='number'?a.__activeRemainSec:(a.activeUntil?Math.max(0,(a.activeUntil-now)/1000):0);
  const activeFrac=a.duration>0?clamp(activeRemaining/a.duration,0,1):0;
  const st=a.locked===true?'locked':now<a.castUntil?'cast':activeRemaining>0?'active':a.charges>0?'ready':'cd';
  const isStandby=(st==='ready'&&(a.__truth===false||a.__castable!==true));
  const tpState=isStandby?'standby':st;
  const isCastable=(tpState==='ready'&&a.__truth===true&&a.__castable===true);
  const rejecting=(isStandby&&now<(a.__failUntil||0));
  const prevSt=u.st;
  if(st!==prevSt||u.tpSt!==tpState){
   if(prevSt==='cd'&&st==='ready'){if(!isStandby){u.readyAgainUntil=now+720;readyPop(u,i,k);}}
   else if(u.tpSt==='standby'&&isCastable){u.readyAgainUntil=now+720;readyPop(u,i,k);}
   else if(!isCastable)u.readyAgainUntil=0;
   u.el.dataset.state=st;u.el.disabled=st==='locked';
   u.el.dataset.tpState=tpState;
   u.el.dataset.tpCastable=isCastable?'1':'0';
   u.el.dataset.tpTarget=(isCastable&&a.__targetName)?'1':'0';
   u.st=st;u.tpSt=tpState;
  }
  const tpTargetVal=(isCastable&&a.__targetName)?'1':'0';
  if(u.el.dataset.tpTarget!==tpTargetVal)u.el.dataset.tpTarget=tpTargetVal;
  const tpRejectVal=rejecting?'1':'0';
  if(u.el.dataset.tpReject!==tpRejectVal)u.el.dataset.tpReject=tpRejectVal;
  u.el.dataset.kind=a.kind||'cooldown';
  const maskFrac=(st==='cd'&&a.charges<=0)?frac:0;
  const m=\`scaleY(\${maskFrac.toFixed(3)})\`;if(u.k.m!==m){u.mask.style.transform=m;u.k.m=m;}
  const meter=activeRemaining>0?activeFrac:(a.next?(1-frac):1);
  const b=\`scaleX(\${meter.toFixed(3)})\`;if(u.k.b!==b){u.bar.style.transform=b;u.k.b=b;}
  const secs=remaining.toFixed(1),activeSecs=activeRemaining.toFixed(1);
  const isVie=(typeof window!=='undefined'&&window.APEX_I18N?.getLanguage?.()==='vie');
  const isTouch=(S.viewport.layout!=='desk');
  const isNarrowCard=(u.el.clientWidth>0&&u.el.clientWidth<240);
  const isBotSide=(S.mode==='1p'&&i===1);
  const defaultKey=i===1?(k?'NUM2':'NUM1'):(k?'K':'J');
  const liveKey=String(u.key?.textContent||'').trim()||defaultKey;
  let slotLabel=a.__baseSlot||(a.kind==='charges'?'CHARGES':(a.kind==='duration'?'ACTIVE WINDOW':'ABILITY '+(k+1)));
  let txt='READY';
  if(st==='locked'){txt=isVie?'KHÓA':'LOCKED';}
  else if(st==='cast'){txt='PRESS-CAST';}
  else if(activeRemaining>0)txt='ACTIVE '+activeSecs+'s';
  else if(isStandby){
    const rsn=rejecting?(a.__failReason||a.__castReason):a.__castReason;
    if(rsn==='cc'){txt=isVie?'BỊ CHOÁNG':'STUNNED';slotLabel=isVie?'KHỐNG CHẾ':'CROWD CONTROL';}
    else if(rsn==='quest-stage-locked'){txt=isVie?'KHÓA':'LOCKED';}
    else if(rsn==='recast-returning'){txt=isVie?'ĐANG THU':'RETURNING';}
    else if(rsn==='syncing'){txt=isVie?'CHUẨN BỊ':'STANDBY';}
    else if(a.__mechanic==='robot.weapon_dash'){
      txt=rejecting?(isVie?'CHƯA CÓ SÚNG':'NO TARGET'):(isVie?'CHỜ SÚNG':'STANDBY');
      slotLabel=rejecting?(isVie?'TỰ NHẶT SÚNG':'AUTO PICKUP'):(isVie?'CHƯA CÓ MỤC TIÊU':'NO TARGET YET');
    }else{
      txt=isVie?'CHỜ ĐIỀU KIỆN':'STANDBY';
    }
  }
  else if(isBotSide){
    if(st==='cd')txt='COOLDOWN '+secs+'s';
    else txt=isVie?'SẴN SÀNG':'READY';
  }
  else if(isCastable&&a.__targetName){
    slotLabel=(isVie?'MỤC TIÊU: ':'TARGET: ')+a.__targetName;
    txt=isTouch?(isVie?'CHẠM · LƯỚT':'TAP · DASH'):((isVie?'BẤM ':'PRESS ')+(liveKey||'J'));
  }
  else if(st==='ready'&&now<(u.readyAgainUntil||0)){txt='READY AGAIN';}
  else if(st==='cd'){txt='COOLDOWN '+secs+'s';}
  else if(a.kind==='charges'){txt=a.next&&a.charges<a.max?('READY · '+a.charges+'/'+a.max+' · '+secs+'s'):('READY · '+a.charges+'/'+a.max);}
  else if(isCastable){
    txt=isTouch?(isVie?'CHẠM · DÙNG':'TAP · CAST'):((isVie?'BẤM ':'CAST · ')+liveKey);
  }
  if(activeRemaining>0&&a.__mitigationPct>0){
    txt=isNarrowCard?('-'+a.__mitigationPct+'% · '+activeSecs+'s'):('ACTIVE '+activeSecs+'s · -'+a.__mitigationPct+'%');
    slotLabel=isVie?('GIẢM '+a.__mitigationPct+'% SÁT THƯƠNG'):('-'+a.__mitigationPct+'% DMG SHIELD');
  }
  if(st==='cd'&&isNarrowCard)txt='CD '+secs+'s';
  if(u.slot&&u.k.sl!==slotLabel){u.slot.textContent=slotLabel;u.k.sl=slotLabel;}
  if(u.k.t!==txt){u.state.textContent=txt;u.k.t=txt;}
  const ariaParts=[String(a.name||'SKILL')+(liveKey?' ('+liveKey+')':''),txt];
  if(slotLabel&&slotLabel.indexOf('TARGET:')===0)ariaParts.push(slotLabel);
  const ariaLabel=ariaParts.join(' — ');
  if(u.k.ar!==ariaLabel){u.el.setAttribute('aria-label',ariaLabel);u.k.ar=ariaLabel;}`
  );

  // 5. Never allow local donor cast() to mutate charges or invent fake cooldown
  //    when production truth marks the ability non-castable.
  out = replaceOnce(
    out,
    'cast-guard-non-castable',
    `function cast(pi,ai,src){
 const now=performance.now(),a=S.players[pi].abil[ai],u=R.side[pi].skills[ai];
 if(S.ko)return;`,
    `function cast(pi,ai,src){
 const now=performance.now(),a=S.players[pi].abil[ai],u=R.side[pi].skills[ai];
 if(S.ko)return;
 if(a.__truth&&src&&a.__castable!==true)return;`
  );

  return out;
}
