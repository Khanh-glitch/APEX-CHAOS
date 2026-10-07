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
