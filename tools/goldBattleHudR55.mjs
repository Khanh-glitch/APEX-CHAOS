// R58 correction — production integration over the canonical Gold Battle HUD.
// Runs AFTER R50C. No gameplay/balance authority lives here.
//
// CRITICAL MODE LAW:
//   BOT/1P and Local/2P are two different authored Gold compositions.
//   BOT keeps the donor's desk threat panel, landscape asymmetric territory,
//   and portrait enemy-strip / arena / big-thumb-zone composition.
//   Production may project real hero art, weapon/ammo, cooldown/active state,
//   and input ownership into those slots. It may NOT replace BOT geometry with
//   Local geometry or enlarge BOT skill tiles to make assets fit.
export function adaptGoldBattleHudR55(input) {
  let out = String(input || '');

  function once(needle, replacement, label) {
    const i = out.indexOf(needle);
    if (i < 0) throw new Error('R58 Gold/BOT ' + label + ' seam missing');
    if (out.indexOf(needle, i + needle.length) >= 0) throw new Error('R58 Gold/BOT ' + label + ' seam duplicated');
    out = out.slice(0, i) + replacement + out.slice(i + needle.length);
  }

  // Local-only: remove its dead spacer. BOT portrait uses its own donor grid.
  once(
    '  grid-template-rows:auto auto auto auto minmax(0,1fr) auto;\n' +
    '  grid-template-areas:"id sk" "hp sk" "rival sk" "feed sk" ". sk" "wp sk";',
    '  grid-template-rows:auto auto auto auto minmax(0,1fr);\n' +
    '  grid-template-areas:"id sk" "hp sk" "rival sk" "feed sk" "wp sk";',
    'portrait Local dead spacer'
  );

  // Production input labels only; mode geometry remains Gold-owned.
  once(
    " R.side[0].ctrl.textContent=desk?'LOCAL · J K':'LOCAL · TOUCH';",
    " R.side[0].ctrl.textContent=desk?'LOCAL · J K':'LOCAL · TAP';",
    'phone P1 input hint'
  );
  once(
    " R.side[1].ctrl.textContent=S.mode==='1p'?'CPU · THREAT':(desk?'LOCAL · NUM 1 2':'LOCAL · TOUCH');",
    " R.side[1].ctrl.textContent=S.mode==='1p'?'CPU':(desk?'LOCAL · NUM 1 2':'LOCAL · TAP');",
    'CPU/local input hint'
  );

  // Production mode is also DATA truth. Handoff may seed it, but each live
  // projection must reassert BOT=1p / LOCAL=2p before any rendering.
  once(
    "  seam.applyState=function applyState(st){\n    if(!st)return;\n    const now=performance.now();",
    "  seam.applyState=function applyState(st){\n    if(!st)return;\n    // R59 MODE AUTHORITY: mode is production state, not a one-shot handoff.\n    // This closes Local -> BOT contamination when a stale/missed handoff leaves\n    // S.mode at 2p. Mode is applied before any side renderer runs.\n    if(st.mode==='1p'||st.mode==='2p')seam.setMode(st.mode);\n    const now=performance.now();",
    'per-frame production mode authority'
  );

  // Live-ammo state; data-only, no mode geometry.
  once(
    " const rel=!!p.reloadUntil,am=usesAmmo?Math.max(0,Number(p.ammo[p.wi])||0):0,key=rel?'R':(usesAmmo?am+'/'+w.mag:'NA');",
    " const rel=!!p.reloadUntil,am=usesAmmo?Math.max(0,Number(p.ammo[p.wi])||0):0,key=rel?'R':(usesAmmo?am+'/'+w.mag:'NA')+(usesAmmo&&am<=Math.max(1,w.mag)*.25?'!':'');",
    'low-ammo key'
  );
  once(
    "u.root.classList.toggle('reloading',rel);u.root.classList.toggle('no-ammo',!usesAmmo);",
    "u.root.classList.toggle('reloading',rel);u.root.classList.toggle('no-ammo',!usesAmmo);u.root.classList.toggle('low-ammo',usesAmmo&&am<=Math.max(1,w.mag)*.25&&am>0);",
    'low-ammo class'
  );

  // R59 HEAVY PERF — preserve every shard/filter/motion, but construct the
  // shard DOM off-tree and attach it once. No visual-count reduction.
  once(" const maxSpan=Math.max(w,h);\n cells.forEach((cell,index)=>{", " const maxSpan=Math.max(w,h),shardBatch=document.createDocumentFragment(),shardAnims=[];\n cells.forEach((cell,index)=>{", 'heavy shard detached batch start');
  once("  const clone=makePanelSnapshot(panel.v,w,h);piece.appendChild(clone);group.appendChild(piece);", "  const clone=makePanelSnapshot(panel.v,w,h);piece.appendChild(clone);shardBatch.appendChild(piece);", 'heavy shard off-tree append');
  once("  piece.animate([{opacity:0,transform:'translate(0,0) rotate(0deg)'},{opacity:.96,transform:'translate(0,0) rotate(0deg)',offset:.14},{opacity:.9,transform:`translate(${tx}px,${ty}px) rotate(${rot}deg)`,offset:.38},{opacity:.52,transform:`translate(${tx*.62}px,${ty*.62}px) rotate(${rot*.64}deg)`,offset:.68},{opacity:0,transform:`translate(${tx*.36}px,${ty*.36}px) rotate(${rot*.42}deg)`}],{duration:930,delay:index*9,easing:'cubic-bezier(.18,.72,.25,1)',fill:'forwards'});\n });\n const r=clamp(maxSpan*.095,18,44)", "  shardAnims.push({piece,index,tx,ty,rot});\n });\n group.appendChild(shardBatch);\n shardAnims.forEach(({piece,index,tx,ty,rot})=>piece.animate([{opacity:0,transform:'translate(0,0) rotate(0deg)'},{opacity:.96,transform:'translate(0,0) rotate(0deg)',offset:.14},{opacity:.9,transform:`translate(${tx}px,${ty}px) rotate(${rot}deg)`,offset:.38},{opacity:.52,transform:`translate(${tx*.62}px,${ty*.62}px) rotate(${rot*.64}deg)`,offset:.68},{opacity:0,transform:`translate(${tx*.36}px,${ty*.36}px) rotate(${rot*.42}deg)`}],{duration:930,delay:index*9,easing:'cubic-bezier(.18,.72,.25,1)',fill:'forwards'}));\n const r=clamp(maxSpan*.095,18,44)", 'heavy shard animate after one commit');
  once("function addSpectralRecovery(panel){\n if(!panel||!panel.group.isConnected)return;\n for(const variant of ['cyan','red']){\n  const ghost=makePanelSnapshot(panel.v,panel.w,panel.h,'rupture-spectrum');ghost.classList.add(variant);panel.group.appendChild(ghost);\n  const dx=variant==='cyan'?2:-2,dy=variant==='cyan'?-1:1;\n  ghost.animate([{opacity:0,transform:`translate(${dx*2}px,${dy*2}px)`},{opacity:.22,transform:`translate(${dx}px,${dy}px)`,offset:.22},{opacity:0,transform:'translate(0,0)'}],{duration:430,easing:'ease-out',fill:'forwards'});\n }\n}", "function addSpectralRecovery(panel){\n if(!panel||!panel.group.isConnected)return;\n const spectralBatch=document.createDocumentFragment(),spectral=[];\n for(const variant of ['cyan','red']){\n  const ghost=makePanelSnapshot(panel.v,panel.w,panel.h,'rupture-spectrum');ghost.classList.add(variant);spectralBatch.appendChild(ghost);\n  const dx=variant==='cyan'?2:-2,dy=variant==='cyan'?-1:1;spectral.push({ghost,dx,dy});\n }\n panel.group.appendChild(spectralBatch);\n spectral.forEach(({ghost,dx,dy})=>ghost.animate([{opacity:0,transform:`translate(${dx*2}px,${dy*2}px)`},{opacity:.22,transform:`translate(${dx}px,${dy}px)`,offset:.22},{opacity:0,transform:'translate(0,0)'}],{duration:430,easing:'ease-out',fill:'forwards'}));\n}", 'spectral detached batch');
  const anchor = '#hud.diag .side,#hud.diag #arenaZone,#hud.diag #versusRail{outline:1px dashed rgba(255,0,200,.45);outline-offset:-1px}\n';
  const LAW = anchor + `
/* ================= 7. R58 GOLD MODE INTEGRATION LAW =================
   BOT and Local remain TWO authored Gold compositions. */

/* CPU readouts are visible but are not local controls. */
#hud[data-mode="1p"] #p2Side .sk-slot{display:none}

/* Local-only weapon-row fit: reserve the gun row INSIDE Local's panel.
   It cannot override BOT because every selector explicitly says mode=2p. */
#hud[data-layout="desk"][data-mode="2p"] .side{--wpH:clamp(66px,10.5cqh,104px);grid-template-rows:auto minmax(0,1fr) minmax(0,var(--wpH))}
#hud[data-layout="land"][data-mode="2p"] .side{--wpH:clamp(52px,17cqh,84px);--amF:clamp(19px,5.2cqh,30px);grid-template-rows:auto minmax(0,1fr) minmax(0,var(--wpH))}
#hud[data-layout="port"][data-mode="2p"] .side{--wpH:clamp(52px,7.2cqh,84px);--amF:clamp(18px,4.8cqh,28px);grid-template-rows:auto auto auto auto minmax(0,var(--wpH));grid-template-areas:"id sk" "hp sk" "rival sk" "feed sk" "wp sk";row-gap:3px}
#hud[data-layout="land"][data-mode="2p"] .weapon,
#hud[data-layout="port"][data-mode="2p"] .weapon{position:relative;align-items:center;min-height:0;height:100%;max-height:var(--wpH);align-self:end;overflow:visible;grid-template-columns:minmax(0,1fr) auto auto;grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"ico ico swp" "txt amm swp";column-gap:9px;row-gap:1px;padding:4px 0 5px;padding-inline-start:5px;border-top:1px solid var(--line);background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 11%,transparent),transparent 74%)}
#hud[data-layout="land"][data-mode="2p"] .side[data-mirror] .weapon,
#hud[data-layout="port"][data-mode="2p"] .side[data-mirror] .weapon{background:linear-gradient(270deg,color-mix(in srgb,var(--acc) 11%,transparent),transparent 74%)}
#hud[data-layout="land"][data-mode="2p"] .weapon .wp-ico,
#hud[data-layout="port"][data-mode="2p"] .weapon .wp-ico{width:100%;height:100%;min-width:0;min-height:0;align-self:stretch;justify-self:stretch}
#hud[data-layout="land"][data-mode="2p"] .weapon .wp-txt,
#hud[data-layout="port"][data-mode="2p"] .weapon .wp-txt{grid-area:txt;align-self:center}
#hud[data-layout="land"][data-mode="2p"] .weapon .wp-name,
#hud[data-layout="port"][data-mode="2p"] .weapon .wp-name{font-size:clamp(11px,2.6cqh,15px);letter-spacing:.11em;color:var(--bone2)}
#hud[data-layout="land"][data-mode="2p"] .weapon .wp-amm,
#hud[data-layout="port"][data-mode="2p"] .weapon .wp-amm{grid-area:amm;justify-self:end;align-self:center;gap:4px}
#hud[data-layout="land"][data-mode="2p"] .weapon .wp-mag,
#hud[data-layout="port"][data-mode="2p"] .weapon .wp-mag{position:absolute;left:0;right:0;bottom:0;height:3px}

/* BOT: fit REAL production assets into Gold's EXISTING slots. No skill zoom,
   no row rewrite, no Local geometry. */
#hud[data-mode="1p"] .wp-ico>.apex-weapon-asset,
#hud[data-mode="1p"] .sk-art>.apex-skill-icon{width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}
#hud[data-mode="1p"] .weapon{min-height:0;max-height:100%}


/* R59 TABLET COMPOSITION — tablet is a real allocation tier, not a scaled phone.
   Local gets a shorter, centered HP read and a materially larger weapon plate.
   BOT keeps its authored asymmetric Gold geometry; only the media WELL is made
   square so portrait and landscape skill art both preserve intrinsic ratio. */
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] .side{
  --wpH:clamp(96px,15.5cqh,120px);--wpIW:clamp(112px,16cqh,140px);--amF:clamp(22px,3.5cqh,29px)}
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p1Rail,
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p2Rail{width:min(100%,430px)}
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p1Rail{justify-self:end}
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p2Rail{justify-self:start}

/* Gold BOT: do not stretch production art to a rectangular tablet cell. */
#hud[data-layout="land"][data-size="tablet"][data-mode="1p"] .skill .sk-art{
  width:var(--artW);height:var(--artW);aspect-ratio:1/1;align-self:center;justify-self:start}
#hud[data-layout="land"][data-size="tablet"][data-mode="1p"] #p2Side .skill .sk-art{
  width:var(--thW);height:var(--thW)}
#hud[data-layout="land"][data-size="tablet"][data-mode="1p"] .sk-art>.apex-skill-icon{
  width:100%;height:100%;object-fit:contain}

/* Portrait tablet BOT needs more than the phone's 48px enemy strip. The Gold
   ordering is unchanged; only the tablet allocation grows so weapon/art are
   never forced through the lower crop edge. */
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"]{
  --stripH:64px;--p1Min:240px;
  --arena:min(var(--availW),calc(var(--availH) - var(--stripH) - var(--railH) - var(--p1Min) - 3 * var(--g)))}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p2Side{
  --porW:42px;--porH:42px;--thW:38px;--wpIW:52px;--amF:15px}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p2Side .skills{height:50px}
#hud[data-mode="1p"] .weapon{overflow:visible;box-sizing:border-box}


/* R59 SKILL-STATE LEGIBILITY — state must read before the player reads copy.
   No zoom/reflow: cooldown and active use contrast, progress and edge light. */
#hud .skill{transition:background .14s ease,box-shadow .14s ease,opacity .14s ease}
#hud .skill[data-state="cd"]{
  background:linear-gradient(90deg,rgba(6,8,10,.94),rgba(12,15,18,.90));
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.035)}
#hud .skill[data-state="cd"] .sk-art{filter:saturate(.42) brightness(.72)}
#hud .skill[data-state="cd"] .sk-mask{
  background:repeating-linear-gradient(135deg,rgba(3,4,5,.84) 0 7px,rgba(11,13,15,.88) 7px 14px);
  border-bottom:1px solid rgba(255,255,255,.12)}
#hud .skill[data-state="cd"] .sk-cdn{
  font-size:calc(var(--cdF,22px) * 1.08);font-weight:900;color:#f2eee7;
  text-shadow:0 2px 8px #000,0 0 10px rgba(255,255,255,.10)}
#hud .skill[data-state="cd"] .sk-bar{height:5px;background:#181d21}
#hud .skill[data-state="cd"] .sk-bar i{opacity:.72}
#hud .skill[data-state="active"]{
  background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 22%,#11161a),#0e1215 76%);
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 68%,transparent),
             inset 0 0 20px color-mix(in srgb,var(--acc) 10%,transparent)}
#hud .skill[data-state="active"]::after{border-color:color-mix(in srgb,var(--acc) 72%,transparent)}
#hud .skill[data-state="active"] .sk-art{
  box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--acc) 62%,transparent),
             inset 0 0 18px color-mix(in srgb,var(--acc) 18%,transparent)}
#hud .skill[data-state="active"] .sk-art>.apex-skill-icon{opacity:1}
#hud .skill[data-state="active"] .sk-state{
  color:#fff;font-weight:900;text-shadow:0 0 10px color-mix(in srgb,var(--acc) 64%,transparent)}
#hud .skill[data-state="active"] .sk-bar{height:6px;background:color-mix(in srgb,var(--acc) 18%,#15191d)}
#hud .skill[data-state="active"] .sk-bar i{box-shadow:0 0 10px color-mix(in srgb,var(--acc) 72%,transparent)}
#hud .skill[data-state="ready"] .sk-state{color:var(--acc)}
@media(prefers-reduced-motion:no-preference){
  #hud .skill[data-state="active"]::before{animation:apexSkillActivePulse .72s ease-in-out infinite alternate}
}
@keyframes apexSkillActivePulse{from{opacity:.62}to{opacity:1}}

/* Shared live-ammo state. */
#hud .weapon.low-ammo .wp-cur{color:var(--crit);text-shadow:0 0 10px color-mix(in srgb,var(--crit) 46%,transparent)}
#hud .weapon.low-ammo .wp-mag i{background:var(--crit)}

/* Mirrored geometry never reverses readable words. */
#hud[data-layout="desk"] .side[data-mirror] .id-name,
#hud[data-layout="desk"] .side[data-mirror] .id-sub,
#hud[data-layout="desk"] .side[data-mirror] .wp-name,
#hud[data-layout="desk"] .side[data-mirror] .sk-name,
#hud[data-layout="desk"] .side[data-mirror] .sk-desc,
#hud[data-layout="desk"] .side[data-mirror] .rival-name,
#hud[data-layout="land"] .side[data-mirror] .id-name,
#hud[data-layout="land"] .side[data-mirror] .id-sub,
#hud[data-layout="land"] .side[data-mirror] .wp-name,
#hud[data-layout="land"] .side[data-mirror] .sk-name,
#hud[data-layout="land"] .side[data-mirror] .sk-desc,
#hud[data-layout="land"] .side[data-mirror] .rival-name{direction:ltr;text-align:right}
`;
  once(anchor, LAW, 'Gold mode integration law');

  return out;
}
