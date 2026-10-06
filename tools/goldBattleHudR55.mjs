// R55 — phone panel law + the held-gun plate (owner playtest 2026-10-06).
// Runs AFTER R50C. Presentation only: no combat/balance/physics authority.
//
// WHAT THIS CHANGES AND WHY (owner report, in the owner's words)
//  1. "Bot mode's opponent panel renders differently from Local's — Gold has
//     the Local presentation; integrate it into Bot." The old wording built a
//     second, dimmer panel family: `[data-mode="1p"] #p2Side` collapsed the
//     opponent into a 40px threat strip (56px art well, faded name, muted
//     accent, hidden state). Those rules are DELETED here, not overridden, so
//     the two families cannot drift again. ONE Gold panel is rendered per side
//     in every mode; the mode changes INPUT LAW only — BOT's opponent keeps no
//     key labels, no tap targets and no swap it does not own.
//  2. "The phone gun/HP/dmg-taken cluster has a large dead slot: fill it and
//     allocate the space to weapon/ammo so the held gun is displayed
//     strongly." The phone weapon plate now takes the leftover height of its
//     column (the portrait Local/BOT zones used to park that height in a dead
//     spacer row), the held gun fills the plate (≈4× the old height instead
//     of a 48×14 icon), the live ammo reads big beside the mag segments and
//     the weapon name/tier owns the plate footer.
//  3. The portrait BOT match now composes like the portrait Local match:
//     a real opponent panel (identity, docked HP rail, rival readout, duel
//     damage feed, the gun plate, both ability tiles) above the arena and the
//     thumb-first player panel below it. Local's presentation is the reference;
//     nothing is scaled down to fit it.
export function adaptGoldBattleHudR55(input) {
  let out = String(input || '');

  function once(needle, replacement, label) {
    const i = out.indexOf(needle);
    if (i < 0) throw new Error('R55 ' + label + ' seam missing');
    if (out.indexOf(needle, i + needle.length) >= 0) throw new Error('R55 ' + label + ' seam duplicated');
    out = out.slice(0, i) + replacement + out.slice(i + needle.length);
  }

  // ── 1. delete the obsolete one-player panel family ────────────────────────
  // Every `#hud[...][data-mode="1p"]` CSS rule (the desk shrink, the landscape
  // collapse, the portrait strip, the portrait thumb zone) is removed here.
  // The single-player layout is re-authored from Local's panel law below; the
  // only surviving one-player rules are input-law locks re-declared in §7.
  {
    const before = out;
    const opens1p = (line) => /^#hud\[data-(?:mode="1p"|layout="(?:desk|land|port)"\]\[data-mode="1p"\])/.test(line);
    let dropping = false;
    out = out
      .split('\n')
      .filter((line) => {
        if (dropping) {
          if (line.endsWith('}')) dropping = false;
          return false;
        }
        if (!opens1p(line)) return true;
        if (!line.includes('}')) dropping = true;
        return false;
      })
      .join('\n');
    if (out === before) throw new Error('R55 one-player panel family: no rule matched');
  }

  // ── 2. portrait Local zone: the weapon plate takes the dead spacer row ─────
  once(
    '  grid-template-rows:auto auto auto auto minmax(0,1fr) auto;\n' +
    '  grid-template-areas:"id sk" "hp sk" "rival sk" "feed sk" ". sk" "wp sk";',
    '  grid-template-rows:auto auto auto auto minmax(0,1fr);\n' +
    '  grid-template-areas:"id sk" "hp sk" "rival sk" "feed sk" "wp sk";',
    'portrait zone without the dead spacer row'
  );

  // ── 3. rig law: input vs presentation ─────────────────────────────────────
  // The docked in-panel rails are Local's presentation, so every portrait match
  // docks them now (BOT docks the opponent's rail into the opponent panel; the
  // player's own rail stays on the centre rail where the player reads it).
  // The duel damage feed is presentation of real damage, not a two-player
  // privilege: it is live in every portrait match.
  // The phone is a touch surface by definition: the identity hint names the
  // input the player actually uses (TAP) instead of repeating "TOUCH", and a
  // CPU opponent is named CPU — the panel itself now carries its own state.
  once(
    " R.side[0].ctrl.textContent=desk?'LOCAL · J K':'LOCAL · TOUCH';",
    " R.side[0].ctrl.textContent=desk?'LOCAL · J K':'LOCAL · TAP';",
    'phone identity hint'
  );
  once(
    " R.side[1].ctrl.textContent=S.mode==='1p'?'CPU · THREAT':(desk?'LOCAL · NUM 1 2':'LOCAL · TOUCH');",
    " R.side[1].ctrl.textContent=S.mode==='1p'?'CPU':(desk?'LOCAL · NUM 1 2':'LOCAL · TAP');",
    'opponent identity hint'
  );

  // Live ammo law: the readout is a combat number, so the plate must show the
  // low-magazine state (real production ammo, mag size from the weapon truth).
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
  once(
    " const local=S.viewport.layout==='port'&&S.mode==='2p';\n for(let i=0;i<2;i++){\n  const node=R.rail[i].root,target=local?R.side[i].root:R.vr;",
    " const local=S.viewport.layout==='port';\n for(let i=0;i<2;i++){\n  const dock=local&&(S.mode==='2p'||i===1);\n  const node=R.rail[i].root,target=dock?R.side[i].root:R.vr;",
    'rail docking law'
  );
  once(
    " if(local)target.appendChild(node);\n  else if(i===0)target.insertBefore(node,R.mc);",
    " if(dock)target.appendChild(node);\n  else if(i===0)target.insertBefore(node,R.mc);",
    'rail docking target'
  );
  // Portrait has exactly one reader: the phone lies flat for the player at the
  // bottom. Mirroring is a facing law for side-by-side panels (desk/land), so
  // portrait never mirrors — the opponent panel reads exactly like the player's.
  once(
    " R.side[1].root.toggleAttribute('data-mirror',!(layout==='port'&&S.mode==='2p'));",
    " R.side[1].root.toggleAttribute('data-mirror',layout!=='port');",
    'portrait facing law'
  );
  once(
    " R.mc.classList.toggle('dual-local',local);",
    " R.mc.classList.toggle('dual-local',local&&S.mode==='2p');",
    'dual timer law'
  );
  once(
    " if(!(S.viewport.layout==='port'&&S.mode==='2p'))return;\n const col=",
    " if(S.viewport.layout!=='port')return;\n const col=",
    'duel feed law'
  );
  once(
    " if(!(S.viewport.layout==='port'&&S.mode==='2p'))return;const u=R.side[v].feed;",
    " if(S.viewport.layout!=='port')return;const u=R.side[v].feed;",
    'recover feed law'
  );

  // ── 4. the R55 CSS law, appended after every canonical section ─────────────
  // Appending (rather than editing canonical rules in place) keeps the donor's
  // composed rules intact and makes this slice one reviewable block.
  const anchor = '#hud.diag .side,#hud.diag #arenaZone,#hud.diag #versusRail{outline:1px dashed rgba(255,0,200,.45);outline-offset:-1px}\n';
  const LAW = anchor + `
/* ================= 7. R55 PHONE PANEL LAW =================
   One Gold panel per side in every mode. The mode owns input law (taps, key
   labels, swap), never the component: the opponent panel is the same vivid,
   stateful panel Local renders, so BOT and Local can never diverge again.
   The weapon plate is the cluster's feature: the held gun fills it, the live
   ammo reads big beside the mag segments and the name keeps the footer. */
#hud[data-mode="1p"] #p2Side .skill{pointer-events:none;cursor:default}
#hud[data-mode="1p"] #p2Side .sk-key,
#hud[data-mode="1p"] #p2Side .wp-swap,
#hud[data-mode="1p"] #p2Side .sk-slot{display:none}
#hud[data-layout="desk"][data-mode="1p"] #p2Side .skills{align-self:center;grid-auto-rows:var(--tileH);margin-top:0}
#hud[data-layout="desk"][data-mode="1p"] #p2Side .sk-name{font-size:var(--skNF)}

/* 7.1 the phone weapon plate: the held gun IS the plate */
#hud[data-layout="land"] .side,
#hud[data-layout="port"] .side{--wpH:clamp(60px,19cqh,96px);--amF:clamp(19px,5.2cqh,30px)}
#hud[data-layout="port"] .side{--wpH:clamp(58px,7.9cqh,92px);--amF:clamp(18px,4.8cqh,28px)}
#hud[data-layout="land"] .weapon,
#hud[data-layout="port"] .weapon{
  position:relative;align-items:center;min-height:var(--wpH);height:100%;
  grid-template-columns:minmax(0,1fr) auto auto;
  grid-template-rows:minmax(0,1fr) auto;
  grid-template-areas:"ico ico swp" "txt amm swp";
  column-gap:9px;row-gap:1px;padding:4px 0 5px;padding-inline-start:5px;
  border-top:1px solid var(--line);
  background:linear-gradient(90deg,color-mix(in srgb,var(--acc) 11%,transparent),transparent 74%)}
#hud[data-layout="land"] .side[data-mirror] .weapon,
#hud[data-layout="port"] .side[data-mirror] .weapon{background:linear-gradient(270deg,color-mix(in srgb,var(--acc) 11%,transparent),transparent 74%)}
#hud[data-layout="land"] .weapon .wp-ico,
#hud[data-layout="port"] .weapon .wp-ico{width:100%;height:100%;min-width:0;min-height:0;align-self:stretch;justify-self:stretch}
#hud[data-layout="land"] .weapon .wp-ico.has-tier::before,
#hud[data-layout="port"] .weapon .wp-ico.has-tier::before{opacity:.95;transform:scale(1);filter:blur(9px)}
#hud[data-layout="land"] .weapon .wp-txt,
#hud[data-layout="port"] .weapon .wp-txt{grid-area:txt;align-self:center}
#hud[data-layout="land"] .weapon .wp-name,
#hud[data-layout="port"] .weapon .wp-name{font-size:clamp(11px,2.6cqh,15px);letter-spacing:.11em;color:var(--bone2)}
#hud[data-layout="land"] .weapon .wp-amm,
#hud[data-layout="port"] .weapon .wp-amm{grid-area:amm;justify-self:end;align-self:center;gap:4px}
#hud[data-layout="land"] .weapon .wp-mag,
#hud[data-layout="port"] .weapon .wp-mag{position:absolute;left:0;right:0;bottom:0;height:3px}

/* 7.1b the phone ability well is a well, not a square floating in a dead band:
   on a phone/landscape tile the art is the tile's full height (a square edge),
   and in the vertical thumb tiles it is the tile's full width. Either way it
   bleeds edge to edge instead of parking a band of nothing beside the art. */
#hud[data-layout="port"] .skill .sk-art>.apex-skill-icon,
#hud[data-layout="land"] .skill .sk-art>.apex-skill-icon{object-fit:contain}
#hud[data-layout="port"] .skill .sk-art svg{width:58%;height:58%}
#hud[data-layout="land"] .skill{grid-template-columns:var(--artW) minmax(0,1fr)}
#hud[data-layout="land"] .skill .sk-art{width:100%;height:auto;aspect-ratio:1;align-self:center}
#hud[data-layout="port"][data-mode="1p"] #p2Side .skill{grid-template-columns:var(--artW) minmax(0,1fr)}
#hud[data-layout="port"][data-mode="1p"] #p2Side .sk-art{width:100%;height:auto;aspect-ratio:1;align-self:center}

/* 7.1c the ammo readout is a live combat number: it turns critical when the
   magazine can no longer finish a burst (≤25%), and never before. */
#hud .weapon.low-ammo .wp-cur{color:var(--crit);text-shadow:0 0 10px color-mix(in srgb,var(--crit) 46%,transparent)}
#hud .weapon.low-ammo .wp-mag i{background:var(--crit)}

/* 7.1d a mirrored panel mirrors its geometry, never its words: names keep
   reading order (and clip with the ellipsis on the right), the damage feed
   keeps its word order while the container still packs it inward. */
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
#hud[data-layout="desk"] .side[data-mirror] .duel-feed,
#hud[data-layout="land"] .side[data-mirror] .duel-feed{direction:ltr}

/* 7.2 portrait Local: in-panel rails + damage feed are part of the panel law */
#hud[data-layout="port"] .side .vrail{grid-area:hp;grid-column:auto;grid-row:auto;padding:0;direction:ltr;
  row-gap:1px;grid-template-rows:var(--lblH) var(--barH) var(--accH);
  --lblH:11px;--barH:8px;--accH:2px;--nmF:9px;--hpF:15px;--hpmF:8px;
  --tail:10px;--st1:6px;--st2:3px;--taper:11px}
#hud[data-layout="port"] .side .vr-tag{font-size:8px;padding:1px 4px;letter-spacing:.04em}
#hud[data-layout="port"] .side .vr-name{font-size:9px;letter-spacing:.1em}
#hud[data-layout="port"] .side .vr-hp{padding:0 3px;gap:1px}
#hud[data-layout="port"] .side #p2Rail .vr-shape{transform:none}
#hud[data-layout="port"][data-mode="1p"] #p2Side .rival-health{grid-area:rival;display:block;padding:1px 3px 2px 0}
#hud[data-layout="port"][data-mode="1p"] #p2Side .duel-feed{grid-area:feed;display:flex;opacity:.36}
#hud[data-layout="port"][data-mode="1p"] #p2Side .duel-feed.pulse{opacity:1}
#hud[data-layout="port"][data-mode="1p"]{
  --p2H:clamp(150px,20cqh,196px);
  --p1H:clamp(226px,33cqh,336px);
  --arena:min(var(--availW),calc(var(--availH) - var(--railH) - var(--p2H) - var(--p1H) - 3 * var(--g)));
  grid-template-rows:minmax(0,var(--p2H)) var(--railH) var(--arena) minmax(0,var(--p1H))}
#hud[data-layout="port"][data-mode="1p"] #p2Side{
  grid-template-columns:minmax(0,1fr) minmax(0,52%);
  grid-template-rows:auto auto auto minmax(0,1fr);
  grid-template-areas:"id sk" "hp sk" "feed sk" "wp sk";
  column-gap:7px;
  --porW:34px;--porH:34px;--idGap:9px;--nameF:14px;--artW:min(64px,34%);
  --skNF:12px;--stF:9.5px;--cdF:18px;--keyS:17px}
/* The opponent's rail already carries the CPU's live HP, and the player's own
   HP is on the centre rail: the rival row would repeat a number the player
   already reads twice over. The band height goes to the held-gun plate. */
#hud[data-layout="port"][data-mode="1p"] #p2Side .rival-health{display:none}
#hud[data-layout="port"][data-mode="1p"] #p2Side .skills{grid-template-columns:auto;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}
/* R56 SPACE LAW (owner: "cả khu vực đó bắt mắt và tối ưu không gian"): the
   opponent tile row was 81px tall while its art stayed a centred 64px square,
   which parked a flat ~116x32 band under every label - the last dead cell in
   the gun/HP/dmg cluster (measured on the rendered pixels, not read off a
   screenshot). The band is filled with the skill's real cooldown line instead
   of art resizing, so nothing is distorted and no label loses width. */
#hud[data-layout="port"][data-mode="1p"] #p2Side .skill{grid-template-columns:var(--artW) minmax(0,1fr);grid-template-rows:100%;grid-template-areas:"art info"}
/* The accepted 64px art column is kept exactly as it was (a wider or
   cover-cropped art either stole label width or turned into a sliver), and the
   band the tile used to leave blank under the label is filled with the skill's
   REAL cooldown/active line. That line already exists on the player's own phone
   panel, so the opponent panel now carries the same state language instead of
   dead space. */
#hud[data-layout="port"][data-mode="1p"] #p2Side .sk-desc{display:block}
#hud[data-layout="port"][data-mode="1p"] #p2Side .sk-info{padding:4px 7px;gap:3px}
#hud[data-layout="port"][data-mode="1p"] #p1Side{
  grid-template-columns:minmax(0,40%) minmax(0,1fr);
  grid-template-rows:auto minmax(0,1fr);
  grid-template-areas:"id wp" "sk sk";
  row-gap:8px;padding-bottom:2px;
  --porW:58px;--porH:clamp(56px,10cqh,76px);--idGap:10px;--nameF:19px;
  --skNF:15px;--stF:10.5px;--cdF:30px;--keyS:20px;--keyF:11.5px}
#hud[data-layout="port"][data-mode="1p"] #p1Side .skills{grid-template-columns:1fr 1fr}
#hud[data-layout="port"][data-mode="1p"] #p1Side .sk-desc{display:block}
#hud[data-layout="port"][data-mode="1p"] #p1Side .sk-art svg{width:52%;height:52%}
#hud[data-layout="port"][data-mode="1p"] #p1Side .weapon{border-top:1px solid var(--line);padding:4px 0 5px;padding-inline-start:5px}
`;
  once(anchor, LAW, 'phone panel law');

  return out;
}
