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

/* R59 C1 — Local tablet composition is its own allocation tier.
   Give weapons real visual mass, keep the arena dominant, and shorten only
   the HP bar/accent geometry instead of scaling the whole HUD. BOT/1P is
   deliberately excluded from every selector below. */
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"]{--sideMin:clamp(236px,22cqw,260px);--localHpW:clamp(320px,36cqw,400px)}
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] .side{--wpH:clamp(96px,14cqh,116px)}
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p1Rail .vr-bar,
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p1Rail .vr-acc{width:min(100%,var(--localHpW));justify-self:end}
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p2Rail .vr-bar,
#hud[data-layout="land"][data-size="tablet"][data-mode="2p"] #p2Rail .vr-acc{width:min(100%,var(--localHpW));justify-self:start}
#hud[data-layout="port"][data-size="tablet"][data-mode="2p"]{--zoneMin:clamp(198px,18cqh,216px)}
#hud[data-layout="port"][data-size="tablet"][data-mode="2p"] .side{--wpH:clamp(92px,8.8cqh,112px)}

/* BOT: fit REAL production assets into Gold's EXISTING slots. No skill zoom,
   no row rewrite, no Local geometry. */
#hud[data-mode="1p"] .wp-ico>.apex-weapon-asset,
#hud[data-mode="1p"] .sk-art>.apex-skill-icon{width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}
#hud[data-mode="1p"] .weapon{min-height:0;max-height:100%}

/* R59 C2 — BOT weapon containment stays inside the authored 1P composition.
   Desk/land reserve a bounded footer row instead of letting the weapon auto-row
   fall through the side's lower edge. Portrait tablet keeps the Gold enemy-strip
   order, but gives that strip enough height for real weapon/media content. */
#hud[data-layout="desk"][data-mode="1p"] .side{--botWpH:clamp(72px,11cqh,104px);grid-template-rows:auto minmax(0,1fr) minmax(0,var(--botWpH))}
#hud[data-layout="land"][data-mode="1p"] #p1Side{--botWpH:clamp(56px,12cqh,82px);grid-template-rows:auto minmax(0,1fr) minmax(0,var(--botWpH))}
#hud[data-layout="land"][data-mode="1p"] #p2Side{--botWpH:clamp(52px,11cqh,76px);grid-template-rows:auto auto minmax(0,1fr) minmax(0,var(--botWpH))}
#hud[data-layout="desk"][data-mode="1p"] .weapon,
#hud[data-layout="land"][data-mode="1p"] .weapon{height:100%;max-height:var(--botWpH);align-self:end;overflow:visible;box-sizing:border-box}
#hud[data-layout="land"][data-mode="1p"] #p2Side .wp-ico{max-width:100%}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"]{--stripH:64px;--p1Min:240px;--arena:min(var(--availW),calc(var(--availH) - var(--stripH) - var(--railH) - var(--p1Min) - 3 * var(--g)))}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p2Side{--porW:42px;--porH:42px;--thW:38px;--wpIW:52px;--amF:15px}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p2Side .skills{height:50px}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] .weapon{overflow:visible;box-sizing:border-box}

/* R61 compact Local: keep arena sizing at the canonical 132px floor;
   reduce only secondary metadata within existing player territories. */
@media (max-width:430px) and (max-height:720px){
 #hud[data-layout="port"][data-size="compact"][data-mode="2p"] .duel-feed{height:16px;padding:1px 3px}
 #hud[data-layout="port"][data-size="compact"][data-mode="2p"] .side{row-gap:2px;--porW:32px;--porH:32px;--idGap:5px}
 #hud[data-layout="port"][data-size="compact"][data-mode="2p"] .side .sk-info{padding:3px 4px;gap:2px}
 #hud[data-layout="port"][data-size="compact"][data-mode="2p"] .side .weapon{padding:2px 0 3px}
}
/* R59 C3 — BOT tablet skill media uses a stable square well.
   Core Six production A1/A2 files are square/near-square assets; the old land
   grid stretched the media CELL vertically even though object-fit preserved the
   bitmap. Keep Gold tile/text geometry, center one square media well inside it. */
#hud[data-layout="land"][data-size="tablet"][data-mode="1p"] .skill .sk-art{width:var(--artW);height:var(--artW);aspect-ratio:1/1;align-self:center;justify-self:start}
#hud[data-layout="land"][data-size="tablet"][data-mode="1p"] .sk-art>.apex-skill-icon{width:100%;height:100%;object-fit:contain;object-position:center}

/* R62 tablet portrait BOT: hero-control dock for two-thumb grip.
   Arena and opponent threat strip are untouched; this affects P1 only. */
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side{
  grid-template-columns:clamp(150px,19cqw,190px) clamp(180px,23cqw,250px) clamp(150px,19cqw,190px);
  grid-template-rows:auto minmax(152px,1fr);
  grid-template-areas:"id id id" "s1 wp s2";
  justify-content:space-between;column-gap:10px;row-gap:7px;--artW:100%;
}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skills{display:contents}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"art" "info";max-height:192px}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill:first-child{grid-area:s1}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill:last-child{grid-area:s2}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .sk-art{width:min(100%,124px);height:min(100%,124px);justify-self:center}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .sk-info{padding:4px 5px 6px;gap:3px;align-items:center}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .sk-top{justify-content:center}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .sk-desc{display:none}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .sk-name{font-size:12px;text-align:center}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .weapon{
  grid-area:wp;display:grid;align-content:center;justify-items:center;
  grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(76px,1fr) auto auto;
  grid-template-areas:"ico" "txt" "amm";padding:8px 6px;
  border-top:1px solid var(--acc);background:linear-gradient(180deg,var(--accA),rgba(8,12,16,.93));
}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .weapon .wp-ico{width:100%;height:100%;min-height:76px}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .weapon .wp-txt{display:block;text-align:center}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .weapon .wp-amm{justify-self:center}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .weapon .wp-mag{display:none}

/* R65 geometric field floats behind readable controls, never shows donor symbols. */
#hud[data-layout="desk"] .side-art.apex-hero-motif,
#hud[data-layout="land"] .side-art.apex-hero-motif{display:block;opacity:.10;overflow:hidden}
#hud .side-art.apex-hero-motif svg{display:block;transform:rotate(-12deg) scale(1.17)}
/* R62 hero-aware backdrop: portrait source is game-authoritative for each side;
   hide both legacy donor glyphs instead of hardcoding Frost/Hunter motifs. */
#hud[data-layout="desk"] .side-art.apex-hero-watermark,
#hud[data-layout="land"] .side-art.apex-hero-watermark{display:block;opacity:.17;overflow:hidden}
#hud[data-layout="desk"] .side-art:not(.apex-hero-motif)>svg,
#hud[data-layout="land"] .side-art:not(.apex-hero-motif)>svg{display:none}
#hud .side-art.apex-hero-watermark>.apex-hero-watermark-img{
  width:100%;height:100%;object-fit:contain;display:block;
  filter:saturate(.6) contrast(1.12);
}
/* R63 skill readability: emphasize actual Gold runtime cast/active/cd/ready
   authority, not a second timer. Restrict to the solo iPad portrait dock. */
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill[data-state="cast"]{
  box-shadow:inset 0 0 0 2px #ffc15a;background:linear-gradient(180deg,rgba(255,175,62,.21),#101418);
}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill[data-state="active"]{
  box-shadow:inset 0 0 0 2px var(--acc);
}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill[data-state="cd"] .sk-art{
  filter:grayscale(.65) brightness(.72);
}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill[data-state="ready"] .sk-art{
  filter:none;
}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill .sk-state{
  text-align:center;max-width:100%;font-weight:900;font-size:11px;letter-spacing:.03em;
  white-space:normal;overflow-wrap:anywhere;
}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill[data-state="cast"] .sk-state{color:#ffc15a}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill[data-state="cd"] .sk-state{color:#d5d7db}
/* R65 — skill artwork carries live authority; captions remain supplementary. */
#hud .skill .sk-art{isolation:isolate;transition:filter .17s ease,box-shadow .17s ease}
#hud .skill .sk-art::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0;transition:opacity .16s ease;background:var(--acc)}
#hud .skill[data-state="cd"] .sk-art{filter:brightness(.30) saturate(.28)}
#hud .skill[data-state="cd"] .sk-art::after{opacity:.19;background:#030508}
#hud .skill[data-state="cast"] .sk-art{filter:brightness(1.45) saturate(1.2);box-shadow:inset 0 0 25px var(--acc)}
#hud .skill[data-state="cast"] .sk-art::after{opacity:.22;mix-blend-mode:screen}
#hud .skill[data-state="active"] .sk-art{filter:brightness(1.62) saturate(1.45);box-shadow:inset 0 0 30px var(--acc),0 0 16px color-mix(in srgb,var(--acc) 72%,transparent)}
#hud .skill[data-state="active"] .sk-art::after{opacity:.28;mix-blend-mode:screen}
#hud .skill[data-state="ready"] .sk-art{filter:brightness(1.07) saturate(1.05)}
#hud .skill[data-state="ready"] .sk-art::after{opacity:0}
/* R65 — unequal thumb reach zones and subordinate weapon console; arena law unchanged. */
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side{
 grid-template-columns:minmax(130px,1fr) minmax(130px,.72fr) minmax(130px,1fr);
 align-content:end;column-gap:clamp(12px,2.2cqw,27px);
}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill{align-self:end;max-height:180px;min-height:138px}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .skill .sk-art{width:min(100%,138px);height:min(100%,138px)}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .weapon{align-self:end;max-height:124px;min-height:98px;padding:5px 7px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(7,10,14,.84))}
#hud[data-layout="port"][data-size="tablet"][data-mode="1p"] #p1Side .weapon .wp-ico{min-height:48px}
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

  // R60 Heavy: do the expensive live-panel sanitize once per hit, not per shard.
  // Keep every shard's independent CSS clip and animation exactly as authored.
  once(
    ' const maxSpan=Math.max(w,h);\n cells.forEach((cell,index)=>{',
    ' const maxSpan=Math.max(w,h);\n // One sanitized live snapshot per impact: each Voronoi piece retains independent motion.\n const shardTemplate=makePanelSnapshot(panel.v,w,h);\n cells.forEach((cell,index)=>{',
    'Heavy snapshot preparation'
  );
  once(
    '  const clone=makePanelSnapshot(panel.v,w,h);piece.appendChild(clone);group.appendChild(piece);',
    '  const clone=shardTemplate.cloneNode(true);piece.appendChild(clone);group.appendChild(piece);',
    'Heavy shards reuse sanitized template'
  );

  // Hero identities are projected from production; watermark comes from real avatar.
  once(
    "    const avatar=String(identity.battleAvatar||'');",
    "    const avatar=String(identity.battleAvatar||'');\n    // R62: Side art follows actual player identity, never the two donor glyphs.\n    if (avatar) {\n      const art=side.root.querySelector('.side-art');\n      if (art) {\n        let image=art.querySelector('.apex-hero-watermark-img');\n        if (!image) {\n          image=document.createElement('img');\n          image.className='apex-hero-watermark-img';\n          image.alt=''; image.draggable=false;\n          art.appendChild(image);\n        }\n        if (image.getAttribute('src')!==avatar) image.setAttribute('src',avatar);\n        art.classList.add('apex-hero-watermark');\n      }\n    }",
    'hero-aware panel watermark projection'
  );
  // R62 Crit + Heavy concurrency: batch all Voronoi DOM insertion; preserve
  // every shard and its original animation keyframes and delay.
  once(" const shardTemplate=makePanelSnapshot(panel.v,w,h);\n cells.forEach((cell,index)=>{"," const shardTemplate=makePanelSnapshot(panel.v,w,h);\n // Build every shard off-DOM; a single insertion avoids per-shard style invalidation.\n const shardBatch=document.createDocumentFragment(),shardAnimations=[];\n cells.forEach((cell,index)=>{",'off-DOM Heavy shard preparation');
  once("piece.appendChild(clone);group.appendChild(piece);","piece.appendChild(clone);shardBatch.appendChild(piece);",'single Heavy batch insertion');
  once("  piece.animate([{opacity:0,transform:'translate(0,0) rotate(0deg)'},{opacity:.96,transform:'translate(0,0) rotate(0deg)',offset:.14},{opacity:.9,transform:`translate(${tx}px,${ty}px) rotate(${rot}deg)`,offset:.38},{opacity:.52,transform:`translate(${tx*.62}px,${ty*.62}px) rotate(${rot*.64}deg)`,offset:.68},{opacity:0,transform:`translate(${tx*.36}px,${ty*.36}px) rotate(${rot*.42}deg)`}],{duration:930,delay:index*9,easing:'cubic-bezier(.18,.72,.25,1)',fill:'forwards'});","  shardAnimations.push(()=>piece.animate([{opacity:0,transform:'translate(0,0) rotate(0deg)'},{opacity:.96,transform:'translate(0,0) rotate(0deg)',offset:.14},{opacity:.9,transform:`translate(${tx}px,${ty}px) rotate(${rot}deg)`,offset:.38},{opacity:.52,transform:`translate(${tx*.62}px,${ty*.62}px) rotate(${rot*.64}deg)`,offset:.68},{opacity:0,transform:`translate(${tx*.36}px,${ty*.36}px) rotate(${rot*.42}deg)`}],{duration:930,delay:index*9,easing:'cubic-bezier(.18,.72,.25,1)',fill:'forwards'}));",'delayed Heavy animation setup');
  once(" });\n const r=clamp(maxSpan*.095,18,44),lens=document.createElement('i');"," });\n group.appendChild(shardBatch);\n shardAnimations.forEach(start=>start());\n const r=clamp(maxSpan*.095,18,44),lens=document.createElement('i');",'single Heavy insert before animations');
  // R65 replace the prior enlarged-avatar watermark with vector motifs.
  once("    const avatar=String(identity.battleAvatar||'');\n    // R62: Side art follows actual player identity, never the two donor glyphs.\n    if (avatar) {\n      const art=side.root.querySelector('.side-art');\n      if (art) {\n        let image=art.querySelector('.apex-hero-watermark-img');\n        if (!image) {\n          image=document.createElement('img');\n          image.className='apex-hero-watermark-img';\n          image.alt=''; image.draggable=false;\n          art.appendChild(image);\n        }\n        if (image.getAttribute('src')!==avatar) image.setAttribute('src',avatar);\n        art.classList.add('apex-hero-watermark');\n      }\n    }\n","    const avatar=String(identity.battleAvatar||'');\n    // R65: hero-specific geometric field, never a scaled portrait.\n    const heroId=String(identity.id||identity.heroId||identity.key||name||'').toLowerCase();\n    const motif=heroId.includes('frost')?'frost':heroId.includes('hunter')?'hunter':heroId.includes('crystal')?'crystala':heroId.includes('magnet')?'magnet':heroId.includes('mirror')?'mirror':'robot';\n    const art=side.root.querySelector('.side-art');\n    if(art){\n      const patterns={\n        robot:'<path d=\"M30 150L130 40 210 150 130 260Z M130 40V260 M30 150H210\"/><circle cx=\"130\" cy=\"150\" r=\"49\"/><circle cx=\"130\" cy=\"150\" r=\"16\"/>',\n        frost:'<path d=\"M130 15V285 M14 150H246 M40 60L220 240 M220 60L40 240\"/><path d=\"M130 15L105 75 155 75Z M130 285L105 225 155 225Z\"/>',\n        hunter:'<path d=\"M20 260Q120 190 60 30 M240 260Q140 190 200 30 M60 30L130 130 200 30 M75 245L130 150 185 245\"/>',\n        crystala:'<path d=\"M130 12L245 122 205 260 55 260 15 122Z M130 12V280 M15 122H245 M55 260L130 122 205 260\"/>',\n        magnet:'<circle cx=\"130\" cy=\"150\" r=\"103\"/><circle cx=\"130\" cy=\"150\" r=\"60\"/><circle cx=\"130\" cy=\"150\" r=\"21\"/><path d=\"M5 150H255 M130 20V280\"/>',\n        mirror:'<path d=\"M130 5V290 M130 25L25 100 65 255 130 290 M130 25L235 100 195 255 130 290 M25 100L130 180 235 100 M65 255L130 180 195 255\"/>'\n      };\n      art.innerHTML='<svg aria-hidden=\"true\" viewBox=\"0 0 260 300\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linejoin=\"bevel\">'+patterns[motif]+'</svg>';\n      art.classList.add('apex-hero-motif');\n    }\n",'hero-specific vector motif');
  // R67: image-bounded energy progress and cooling shade; live ability clock.
  once("/* Shared live-ammo state. */","/* R68 themed panels: stronger hero motifs and refined iPad dock material.\n   No geometry, input ownership, arena or ability authority changes. */\n#hud[data-layout=\"desk\"] .side-art.apex-hero-motif,\n#hud[data-layout=\"land\"] .side-art.apex-hero-motif{opacity:.34;mix-blend-mode:screen}\n#hud[data-layout=\"desk\"] .side-art.apex-hero-motif svg,\n#hud[data-layout=\"land\"] .side-art.apex-hero-motif svg{display:block;filter:drop-shadow(0 0 6px color-mix(in srgb,var(--acc) 54%,transparent))}\n#hud[data-layout=\"port\"][data-size=\"tablet\"][data-mode=\"1p\"] #p1Side .skill{\nborder:1px solid color-mix(in srgb,var(--acc) 34%,#202830);background:linear-gradient(160deg,rgba(21,29,36,.90),rgba(8,12,16,.96))}\n#hud[data-layout=\"port\"][data-size=\"tablet\"][data-mode=\"1p\"] #p1Side .weapon{\nborder:1px solid color-mix(in srgb,var(--acc) 27%,#161b21);background:linear-gradient(180deg,rgba(26,30,36,.91),rgba(8,12,16,.96))}\n/* R67 art-first status: perimeter progress (not blurred artwork).\n   CD shade descends within the image; active edge advances for actual duration. */\n#hud .skill .sk-art{isolation:isolate;filter:none!important;box-shadow:none!important;overflow:hidden}\n#hud .skill .sk-art::after{display:none!important}\n#hud .skill .sk-art .apex-state-ring{\n position:absolute;inset:0;z-index:6;pointer-events:none;opacity:0;\n border:3px solid transparent;\n background:conic-gradient(from -90deg,var(--acc) calc(var(--apex-active-progress,0)*1turn),transparent 0) border-box;\n -webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);\n -webkit-mask-composite:xor;mask-composite:exclude;\n filter:none;transition:opacity .08s;\n}\n@keyframes apex-art-orbit{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}\n#hud .skill[data-state=\"active\"] .sk-art .apex-state-ring::before{\n content:\"\";position:absolute;inset:-1px;\n background:radial-gradient(circle at 50% 3px,#fff 0 2px,var(--acc) 3px,transparent 8px);\n animation:apex-art-orbit var(--apex-active-duration,1s) linear both;\n filter:drop-shadow(0 0 3px var(--acc));pointer-events:none;\n}\n#hud .skill[data-state=\"active\"] .sk-art .apex-state-ring{opacity:1}\n/* R69 art authority: avoid stacking the donor's old dark mask on the\n   new curtain; keep countdown glyph above the moving shade. */\n#hud .skill .sk-art>.sk-mask{display:none!important}\n#hud .skill .sk-art>.sk-cdn{z-index:8}\n#hud .skill .sk-art .apex-state-shade{\n position:absolute;inset:0;z-index:5;pointer-events:none;\n background:rgba(0,2,6,.79);opacity:0;transform-origin:50% 0;\n transform:scaleY(var(--apex-cd-shade,0));transition:opacity .12s;\n}\n#hud .skill[data-state=\"cd\"] .sk-art .apex-state-shade{opacity:1}\n#hud .skill[data-state=\"active\"] .sk-art{\n outline:2px solid var(--acc);outline-offset:-2px;\n}\n#hud .skill[data-state=\"cast\"] .sk-art{\n outline:2px solid #ffd18a;outline-offset:-2px;\n}\n#hud .skill[data-state=\"ready\"] .sk-art{outline:0}\n/* Shared live-ammo state. */",'art-first status styling');
  once("     <span class=\"sk-art\">${a.icon}<span class=\"sk-mask\"></span>","     <span class=\"sk-art\">${a.icon}<span class=\"apex-state-shade\"></span><span class=\"apex-state-ring\"></span><span class=\"sk-mask\"></span>",'art-first skill elements');
  once("  const meter=activeRemaining>0?activeFrac:(a.next?(1-frac):1);","  // Source-of-truth state controls artwork, not just the label below it.\n  // Active perimeter fills in exact proportion to the ability's active duration.\n  // CD shade decreases from fully covered to clear as recharge completes.\n  u.art.style.setProperty('--apex-active-progress',String(st==='active'?1-activeFrac:0));\n  u.art.style.setProperty('--apex-cd-shade',String(st==='cd'?frac:0));\n  const meter=activeRemaining>0?activeFrac:(a.next?(1-frac):1);",'art-first live ability progress');
  once("#hud .skill[data-state=\"active\"] .sk-art .apex-state-ring{opacity:1}","@keyframes apex-art-orbit{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}\n#hud .skill[data-state=\"active\"] .sk-art .apex-state-ring::before{\n content:\"\";position:absolute;inset:-1px;\n background:radial-gradient(circle at 50% 3px,#fff 0 2px,var(--acc) 3px,transparent 8px);\n animation:apex-art-orbit var(--apex-active-duration,1s) linear both;\n filter:drop-shadow(0 0 3px var(--acc));pointer-events:none;\n}\n#hud .skill[data-state=\"active\"] .sk-art .apex-state-ring{opacity:1}",'ACTIVE perimeter spark');
  once("  u.art.style.setProperty('--apex-active-progress',String(st==='active'?1-activeFrac:0));","  u.art.style.setProperty('--apex-active-duration',Math.max(.05,Number(a.duration)||.05)+'s');\n  u.art.style.setProperty('--apex-active-progress',String(st==='active'?1-activeFrac:0));",'ACTIVE perimeter orbit duration');
  once("#hud .skill .sk-art .apex-state-shade{","/* R69 art authority: avoid stacking the donor's old dark mask on the\n   new curtain; keep countdown glyph above the moving shade. */\n#hud .skill .sk-art>.sk-mask{display:none!important}\n#hud .skill .sk-art>.sk-cdn{z-index:8}\n#hud .skill .sk-art .apex-state-shade{",'single cooldown shade and readable glyph');
  return out;
}
