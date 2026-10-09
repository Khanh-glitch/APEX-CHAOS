import assert from 'node:assert/strict';
import fs from 'node:fs';
const p=fs.readFileSync(new URL('../public/gold/battle-hud.html',import.meta.url),'utf8');
const base=fs.readFileSync(new URL('../tools/buildGoldCutover.mjs',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../tools/goldQuestPresentation.css',import.meta.url),'utf8');
let n=0;const gate=(name,x)=>{assert.ok(x,name);n++;console.log('PASS B3 '+name)};
gate('Quest-only style appended after donor Gold',p.includes('<style id="apexQuestArenaFirstProfile">'));
gate('same Gold generator owns responsive + Quest',base.includes('applyQuestGoldPresentation(applyB05Overlay'));
gate('normal BOT/LOCAL keep R90 geometry',css.includes('#hud[data-quest="1"][data-layout="desk"]')
  &&!css.includes('#hud[data-layout="desk"]{'));
gate('Quest desktop/land MUST NOT shift R90 arena center',
  !/#[^\n{]*data-quest="1"[^{}]*\{[^}]*--(?:arena|cl|cr|q-left|q-right)\s*:/.test(css));
gate('Quest cannot miniaturize original Gold J/K skills',
  !/--(?:tileH|artW|skNF|infoPad|wpIW)\s*:/.test(css)
  &&!css.includes('width:min(100%,265px)'));
gate('Quest land preserves visible real skill status',
  css.includes('#p1Side .sk-meter')&&css.includes('flex-direction:column')
  &&css.includes('#p1Side .sk-state'));
gate('Quest E01 LOCKED dims real icon with R70 effects disabled',
  css.includes('.skill[data-state="locked"] .sk-art>.apex-skill-icon{opacity:.35}'));

gate('1P portrait arena-first and vertical safe controls',css.includes('--p1Min:clamp(148px,24dvh,190px)'));
gate('Quest 1P landscape right side compressed for arena',
  css.includes('--q-right:clamp(36px,6vw,56px)'));
gate('one rail has no interactor divider',css.includes('.vr-quest-slots>span')&&css.includes('gap:0'));
gate('actual current HP occupies share of team maximum',p.includes('const portion=Math.max(0,Math.min(1,(Number(actor.hp)||0)/Math.max(1,teamMax)))'));
gate('linear segment widths not per-actor fake full slots',p.includes("if(slot.style.flexBasis!==basis)slot.style.flexBasis=basis;"));
console.log('B3 Gold Quest HUD '+n+' PASS / 0 FAIL');
