// Issue #105 owner rejection R2, P0-B — deterministic Gold shell adapter: Fighter Pick
// roster rules (BOT opponent follows P1; Local P1/P2 never lock the same fighter).
//
// LAW (owner R2, engineering defaults decided by the owner):
//   · BOT CPU defaults to HUNTER. When P1 selects HUNTER, BOT auto-selects ROBOT.
//     The effective CPU is resolved by production (APEX_ARSENAL_SHELLS.botOpponentFor)
//     through APEX_GOLD.botOpponentShellKeyFor(p1), so the pick screen, the transition,
//     the HUD and the spawned CPU all read the same fighter.
//   · Local 1v1: P2 never opens on P1's fighter; a card equal to P1 is visibly TAKEN and
//     cannot be selected or locked. Quest is not touched (its own pilot route).
//   · A BOT choice that equals P1 is never stored: the shell writes the choice only when
//     P1 is not HUNTER (the auto-ROBOT case is derived, not remembered).
//
// Every replacement asserts its seam exactly once. A drift in the canonical shell fails
// the build loudly instead of silently shipping an unvalidated Pick screen.

const SEAMS = [
  {
    label: 'botHeroId reads the CPU for the current P1',
    find: "      if(g&&typeof g.botOpponentShellKey==='function'){\n        const key=g.botOpponentShellKey();\n        if(key&&HEROES[key])return key;\n      }\n",
    replace:
      "      // Owner R2 P0-B: the CPU for THIS P1 (P1 HUNTER -> ROBOT, never a mirror).\n" +
      "      if(g&&typeof g.botOpponentShellKeyFor==='function'){\n" +
      "        const key=g.botOpponentShellKeyFor(p1Hero);\n" +
      "        if(key&&HEROES[key])return key;\n" +
      "      }\n" +
      "      if(g&&typeof g.botOpponentShellKey==='function'){\n" +
      "        const key=g.botOpponentShellKey();\n" +
      "        if(key&&HEROES[key])return key;\n" +
      "      }\n",
  },
  {
    label: 'BOT P1 pick re-derives the CPU slot; BOT CPU rejects a tap equal to P1',
    find: "    if(battleMode==='bot'){if(!p1Locked){p1Hero=id;p1HasPicked=true;activePlayer='p1'}else if(!p2Locked){p2Hero=id;p2Empty=false;p2HasPicked=true}else return}",
    replace:
      "    if(battleMode==='bot'){\n" +
      "      if(!p1Locked){p1Hero=id;p1HasPicked=true;activePlayer='p1';if(!p2Locked)p2Hero=botHeroId()}\n" +
      "      else if(!p2Locked){if(id===p1Hero){uiSfx('ui.action.rejected');renderFighter();return}p2Hero=id;p2Empty=false;p2HasPicked=true}\n" +
      "      else return}",
  },
  {
    label: 'Local P2 opens on a fighter that is not P1',
    find: "activePlayer='p2';p2Hero='newbot';p2Empty=false;p2HasPicked=false;renderFighter();",
    replace: "activePlayer='p2';p2Hero=p1Hero==='newbot'?'hunter':'newbot';p2Empty=false;p2HasPicked=false;renderFighter();",
  },
  {
    label: 'Local P2 tap on P1 fighter is refused',
    find: "else if(activePlayer==='p2'&&!p2Locked){p2Hero=id;p2Empty=false;p2HasPicked=true} else return;",
    replace: "else if(activePlayer==='p2'&&!p2Locked){if(id===p1Hero){uiSfx('ui.action.rejected');renderFighter();return}p2Hero=id;p2Empty=false;p2HasPicked=true} else return;",
  },
  {
    label: 'Local P2 lock refuses an equal pair',
    find: "if(activePlayer==='p2'&&!p2Locked){p2HasPicked=true;p2Locked=true;renderFighter();",
    replace: "if(activePlayer==='p2'&&!p2Locked){if(p2Hero===p1Hero){uiSfx('ui.action.rejected');renderFighter();return}p2HasPicked=true;p2Locked=true;renderFighter();",
  },
  {
    label: 'BOT lock stores the choice only when it is not the auto-ROBOT case',
    find: "try{window.APEX_GOLD&&window.APEX_GOLD.setBotOpponent&&window.APEX_GOLD.setBotOpponent(p2Hero)}catch(_){}",
    replace: "if(p1Hero!=='hunter')try{window.APEX_GOLD&&window.APEX_GOLD.setBotOpponent&&window.APEX_GOLD.setBotOpponent(p2Hero)}catch(_){}",
  },
  {
    label: 'renderFighter marks the taken card and states why',
    find: "    document.querySelectorAll('.rosterCard').forEach(card=>{card.classList.toggle('p1-selected',card.dataset.hero===p1Hero);card.classList.toggle('p2-selected',!p2Empty&&(battleMode!=='bot'||p1Locked)&&card.dataset.hero===p2Hero)});",
    replace:
      "    // Owner R2 P0-B: while P2 (or the BOT slot) is choosing, P1's fighter is visibly TAKEN.\n" +
      "    const takenNow=p1Locked&&!p2Locked&&(battleMode==='bot'||activePlayer==='p2');\n" +
      "    document.querySelectorAll('.rosterCard').forEach(card=>{card.classList.toggle('p1-selected',card.dataset.hero===p1Hero);card.classList.toggle('p2-selected',!p2Empty&&(battleMode!=='bot'||p1Locked)&&card.dataset.hero===p2Hero);const taken=!!takenNow&&card.dataset.hero===p1Hero;card.classList.toggle('is-taken',taken);if(taken)card.setAttribute('aria-disabled','true');else card.removeAttribute('aria-disabled')});\n" +
      "    if(takenNow&&battleMode!=='bot'&&!p2Empty&&p2Tag)p2Tag.textContent=p2Hero===p1Hero?'P1 HAS THIS FIGHTER':'PICK A DIFFERENT FIGHTER';",
  },
];

const STYLE_SEAM = '</head>';
const STYLE =
  '<style id="r2-roster-pick-rules">\n' +
  '/* Owner R2 P0-B: P1 fighter is visibly TAKEN while P2 chooses (Local) or the CPU slot chooses (BOT). */\n' +
  '#stage .rosterCard.is-taken{opacity:.42!important;filter:grayscale(.75) brightness(.62)!important;cursor:not-allowed!important;transform:none!important}\n' +
  '#stage .rosterCard.is-taken::after{content:"P1";position:absolute;top:6px;right:6px;z-index:3;background:#ff941f;color:#160b00;font:900 11px/1 monospace;padding:3px 5px;letter-spacing:.06em}\n' +
  '</style>\n';

function assertOnce(src, needle, label) {
  const at = src.indexOf(needle);
  if (at < 0) throw new Error(`R2 roster pick: seam missing (${label})`);
  if (src.indexOf(needle, at + needle.length) >= 0) throw new Error(`R2 roster pick: seam duplicated (${label})`);
  return at;
}

export function adaptGoldShellR2RosterPick(input) {
  let out = String(input || '');
  for (const seam of SEAMS) {
    const at = assertOnce(out, seam.find, seam.label);
    out = out.slice(0, at) + seam.replace + out.slice(at + seam.find.length);
  }
  const headAt = assertOnce(out, STYLE_SEAM, 'head close');
  out = out.slice(0, headAt) + STYLE + out.slice(headAt);
  return out;
}
