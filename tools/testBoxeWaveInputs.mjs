// BOT WAVE input law — production pilot contract (F1).
// Proof level: SOURCE-CONTRACT (pilot seams inspected; runtime key/lock behavior is proven separately by tools/testBotWaveBrowserInputLock.mjs).
//
// History: this file unit-tested src/game/botWave/inputRouter.js, a staging
// prototype that shipping code never imported. The real router is the
// pilot's act(k,press) inside public/bot-wave/game.html, fed identically by
// keyboard and touch. This contract now gates THAT implementation and the
// prototype is deleted so the two can never drift apart again.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const game = fs.readFileSync('public/bot-wave/game.html', 'utf8');
const pilot = game.slice(game.indexOf('/* BOXE BOT WAVE pilot'));
assert.ok(pilot.length > 1000, 'pilot region not found');
const count = (needle) => pilot.split(needle).length - 1;

// One router for every input source.
assert.ok(pilot.includes('function act(k,press){'), 'pilot must keep a single act() input router');
assert.ok(pilot.includes("if(k==='K'&&!press){finishGuard('release');return;}"), 'K release must finish guard');
assert.ok(pilot.includes("if(k==='K'){beginGuard();return;}"), 'K press must begin guard (hold-K)');
assert.ok(pilot.includes("if(k==='L')engine.dash();"), 'L must use the native Gold dash');
assert.ok(pilot.includes('engine.basicAttack()'), 'J must use the native basic attack');

// U and I are card-locked: the ONLY cast sites sit behind owned-card checks,
// so neither a keyboard combo nor a hidden digit hotkey can fire them early.
assert.equal(count("engine.castSkill('phantom')"), 1, 'phantom must have exactly one cast site');
assert.equal(count("engine.castSkill('ult')"), 1, 'ult must have exactly one cast site');
assert.ok(pilot.includes("if(k==='U'&&state.owned.has('phantom'))engine.castSkill('phantom')"));
assert.ok(pilot.includes("if(k==='I'&&state.owned.has('ult'))engine.castSkill('ult')"));
assert.ok(pilot.includes("if(e.code.startsWith('Digit')){e.preventDefault();return;}"),
  'digit hotkeys must be swallowed so Gold skill digits cannot bypass card locks');
assert.ok(pilot.includes("['KeyJ','KeyK','KeyL','KeyU','KeyI'].includes(e.code)"),
  'keyboard surface is exactly J/K/L/U/I');
assert.ok(pilot.includes('if(!e.repeat)act(e.code.slice(3),true)'), 'keydown must route into act() once per press');

// Guard-cancel legality mirrors the same locks (only ready+owned skills cancel).
assert.ok(pilot.includes("(k==='U'&&state.owned.has('phantom')&&((engine.cds?.get('phantom')||0)<=0))"));
assert.ok(pilot.includes("(k==='I'&&state.owned.has('ult')&&((engine.cds?.get('ult')||0)<=0))"));

// Touch buttons are the same router (no synthetic keypress path): all five
// actions exist as [data-act] buttons, U/I ship disabled+LOCK, and the
// pointer handlers call act() directly.
for (const k of ['J', 'K', 'L', 'U', 'I']) {
  assert.ok(pilot.includes(`data-act="${k}"`), 'missing touch action button ' + k);
}
assert.ok(pilot.includes('data-act="U" data-key="U" aria-label="U khóa" disabled'), 'U touch pad must start locked');
assert.ok(pilot.includes('data-act="I" data-key="I" aria-label="I khóa" disabled'), 'I touch pad must start locked');
assert.ok(pilot.includes("document.querySelectorAll('[data-act]')"), 'touch pads must be wired');
assert.ok(pilot.includes('act(a,false)') && pilot.includes("b.addEventListener('pointerdown'"),
  'touch press/release must call act() directly');

// Combat-phase + pause gating lives in the router itself.
assert.ok(pilot.includes("if(state.phase!=='combat'||engine.paused)return;"), 'router must refuse actions outside combat');

// Anti-twin (F1): the prototype router must stay deleted.
assert.ok(!fs.existsSync('src/game/botWave/inputRouter.js'), 'inputRouter prototype twin must not return');
console.log('BOT WAVE dual-input PASS: production act() router — J/K/L live at start, U/I card-locked on keyboard+touch alike, digit hotkeys swallowed');
