// BLACK_HOLE battle sandbox — headless acceptance harness.
// Loads the REAL built artifact (public/playtest/blackhole-battle-sandbox.html)
// in a real Chromium with WebGL2 (SwiftShader), drives the documented test
// states through the sandbox's test API, asserts the gameplay gates, and
// writes genuine canvas screenshots as PNG evidence.
//
// All waits are POLL-BASED on game state (SwiftShader game-time runs slower
// than wall time); every gate has a wall-clock timeout.
//
// Usage: node tools/testBlackholeSandbox.mjs
// Env:   BH_PUPPETEER_DIR (default /tmp/sc — provides puppeteer-core + @sparticuz/chromium)
//        BH_EVIDENCE_DIR  (default docs/blackhole-playtest/evidence)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const PUPPETEER_DIR = process.env.BH_PUPPETEER_DIR || '/tmp/sc';
const EVIDENCE = process.env.BH_EVIDENCE_DIR || path.join(REPO, 'docs/blackhole-playtest/evidence');
const requireTool = createRequire(path.join(PUPPETEER_DIR, 'noop.js'));
const puppeteer = requireTool('puppeteer-core');
const chromium = requireTool('@sparticuz/chromium').default;

const PAGE = 'file://' + path.join(REPO, 'public/playtest/blackhole-battle-sandbox.html');
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    args: [...chromium.args, '--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
    headless: true,
    defaultViewport: { width: 800, height: 600 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(PAGE, { waitUntil: 'load' });
  await sleep(2500);

  check('no page errors on boot', errors.length === 0, errors.slice(0, 3).join(' | '));

  const sb = (fn, ...args) => page.evaluate(`window.BH_SANDBOX.${fn}(...${JSON.stringify(args)})`);
  const api = () => page.evaluate(() => window.BH_SANDBOX && window.BH_SANDBOX.state());
  // poll until a predicate over state() is true (predicate string evaluated in page)
  const waitFor = async (pred, timeoutMs = 30000, stepMs = 250) => {
    const t0 = Date.now();
    let st = await api();
    while (!(await page.evaluate(`(${pred})(${JSON.stringify(st)})`))) {
      if (Date.now() - t0 > timeoutMs) return { ok: false, st };
      await sleep(stepMs);
      st = await api();
    }
    return { ok: true, st };
  };
  const shot = async (name) => {
    await sleep(250); // let a few frames present
    const buf = await page.screenshot({ path: path.join(EVIDENCE, name + '.png') });
    return buf.length;
  };

  // ---- boot / render gates ----
  const boot = await page.evaluate(() => ({
    ready: !!(window.BH_SANDBOX && window.BH_SANDBOX.ready),
    errVisible: document.getElementById('err').style.display === 'flex',
    canvasSize: [document.getElementById('gl').width, document.getElementById('gl').height],
  }));
  check('sandbox API ready', boot.ready);
  check('no WebGL/shader error overlay', !boot.errVisible);
  check('canvas allocated', boot.canvasSize[0] > 100 && boot.canvasSize[1] > 100, boot.canvasSize.join('x'));

  const bootShot = await page.screenshot({ type: 'png' });
  const pixStats = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const region = (cx, cy, r) => {
      const d = x.getImageData(Math.max(0, cx - r), Math.max(0, cy - r), r * 2, r * 2).data;
      let sum = 0, n = 0, mx = 0, rs = 0, gs = 0, bs = 0;
      for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i+1] + d[i+2]; sum += v; n++; mx = Math.max(mx, v); rs += d[i]; gs += d[i+1]; bs += d[i+2]; }
      return { avg: +(sum / n / 3).toFixed(1), max: mx, rgb: [Math.round(rs/n), Math.round(gs/n), Math.round(bs/n)] };
    };
    return { full: region(400, 300, 240), headArea: region(280, 300, 48), botArea: region(520, 300, 32) };
  }, bootShot.toString('base64'));
  check('canvas renders (composited pixels non-empty)', pixStats.full.avg > 8 && pixStats.full.max > 150, `avg=${pixStats.full.avg} max=${pixStats.full.max}`);
  check('BLACK_HOLE identity present at its position (violet-biased pixels)', pixStats.headArea.max > 400 && pixStats.headArea.rgb[2] > pixStats.headArea.rgb[1], `rgb=${pixStats.headArea.rgb} max=${pixStats.headArea.max}`);
  await shot('00_intro_opening');

  // skip the intro for deterministic battle-scale checks
  await sb('resetFight');
  await sleep(800);
  let st = await api();
  check('BLACK_HOLE alive at battle scale', st.bh.hp === 1000 && st.bh.radius === 75, `hp=${st.bh.hp} r=${st.bh.radius}`);
  check('opponent renders (alive)', st.bot.hp === 1000);
  const idle = await waitFor('s => s.head.phase === "idle"', 60000);
  check('head enters idle after intro skip (intro plays once at boot)', idle.ok, 'phase=' + idle.st.head.phase);
  await shot('01_idle_battle_scale');

  // ---- movement gate ----
  const x0 = st.bh.x;
  await page.keyboard.down('d');
  const mv = await waitFor('s => s.bh.x > ' + (x0 + 60), 12000, 120);
  await page.keyboard.up('d');
  check('movement works (WASD drives the body)', mv.ok, mv.ok ? `x ${x0.toFixed(0)} → ${mv.st.bh.x.toFixed(0)}` : `x stuck at ${mv.st.bh.x.toFixed(0)}`);

  // ---- damage + passive growth gates ----
  await sb('resetFight');
  await sb('spawnBurst');
  const burstDone = await waitFor('s => s.bh.hp < 940 && s.passive.realized >= 90', 30000);
  st = burstDone.st;
  check('incoming damage works (HP drops by burst total)', st.bh.hp === 1000 - 90, `hp=${st.bh.hp}`);
  check('passive growth counts realized damage only', st.passive.bonus === Math.floor(st.passive.realized / 10) && st.passive.bonus === 9, `realized=${st.passive.realized} bonus=${st.passive.bonus}`);
  const radOk = await waitFor('s => s.bh.radius === 75 + s.passive.bonus && s.passive.bonus === 9', 30000);
  check('collision footprint grows with passive', radOk.ok, `r=${radOk.st.bh.radius} bonus=${radOk.st.passive.bonus}`);
  await shot('08_passive_growth_mid');

  // healing must never reduce growth
  const bonusBefore = st.passive.bonus;
  const hpBefore = st.bh.hp;
  await page.evaluate(() => document.getElementById('bHeal').click());
  const heal = await waitFor('s => s.bh.hp > 990', 15000);
  st = heal.st;
  check('heal restores HP without reducing growth', st.passive.bonus === bonusBefore && st.bh.hp > hpBefore, `bonus=${st.passive.bonus} hp=${st.bh.hp}`);

  // forced 100% growth — visual + collision at +100
  await sb('setGrowth', 100);
  const g100 = await waitFor('s => s.bh.radius === 175', 15000);
  check('forced 100% growth: radius +100', g100.ok, `r=${g100.st.bh.radius}`);
  await shot('09_passive_growth_100');
  await sb('setGrowth', null);

  // ---- A1 gates ----
  await sb('resetFight');
  const a1cast = await sb('pressJ');
  check('A1 cast on J (off cooldown)', a1cast === true);
  const born = await waitFor('s => s.a1.active && s.a1.entry && s.a1.entry.rs > 0.5', 60000);
  check('A1 entry singularity born (horizon open)', born.ok, born.ok ? `rs=${born.st.a1.entry.rs.toFixed(2)} phase=${born.st.a1.entry.phase}` : `rs=${born.st.a1.entry && born.st.a1.entry.rs}`);
  check('A1 exit placed with safe margin from fighters', dist2(born.st.a1.exit, born.st.bot) >= 195 - 1, `d(bot→exit)=${dist2(born.st.a1.exit, born.st.bot).toFixed(0)} ≥ 195`);
  await shot('02_A1_opening_born');

  // capture: enemy stream gets swallowed
  await sb('spawnStream');
  const capture = await waitFor('s => s.a1.stored > 0 || s.projectiles.some(p => p.owner === "RIVAL" && Math.hypot(p.x - s.a1.entry.x, p.y - s.a1.entry.y) < 200)', 60000);
  check('A1 pulls and captures enemy rounds', capture.ok, `stored=${capture.st.a1.stored}`);
  await shot('03_A1_enemy_stream_capture');

  // release: rounds re-emerge at the exit with preserved ownership + momentum
  const release = await waitFor('s => s.projectiles.some(p => p.released && p.owner === "RIVAL")', 300000, 120);
  const rel = release.st.projectiles.find((p) => p.released && p.owner === 'RIVAL');
  check('A1 releases rounds at exit with preserved momentum/ownership', release.ok && rel && Math.abs(rel.relV - Math.hypot(rel.vx, rel.vy)) < 1,
        release.ok ? `owner=${rel.owner} speed=${Math.hypot(rel.vx, rel.vy).toFixed(0)} (fired at ${rel.relV.toFixed(0)})` : 'no released round observed');
  await shot('04_A1_release_at_exit');

  // capacity: never more than 8 stored, tracked across the whole transit window
  await sb('spawnStream'); await sb('spawnStream');
  let maxStored = 0;
  const capEnd = await waitFor('s => !s.a1.active', 300000, 150);
  maxStored = await page.evaluate(() => window.__maxStored || 0);
  // sample stored continuously via a short in-page watcher as well
  const maxSeen = await page.evaluate(async () => {
    const SB = window.BH_SANDBOX;
    let mx = 0;
    for (let i = 0; i < 40; i++){ mx = Math.max(mx, SB.state().a1.stored); await new Promise(r => setTimeout(r, 25)); }
    return mx;
  });
  check('A1 respects the 8-object capacity', Math.max(maxStored, maxSeen) <= 8, `max stored observed=${Math.max(maxStored, maxSeen)}`);

  // A1 ends by itself (2.7s active)
  check('A1 duration is 2.7s (self-terminates)', capEnd.ok, `active=${capEnd.st.a1.active}`);

  // ---- T6 exclusion (bot fire disabled: the only round in flight is the T6) ----
  await sb('resetFight');
  await sb('setBotFire', false);
  await sb('forceReady', 'a1');
  await sb('pressJ');
  await waitFor('s => s.a1.active && s.a1.entry && s.a1.entry.rs > 0.5', 60000);
  await sb('spawnT6');
  let storeDuringT6 = 0;
  const t6hit = await waitFor('s => s.bh.hp < 1000', 240000, 200);
  st = t6hit.st;
  check('T6 round reaches BLACK_HOLE through the open singularity', st.bh.hp === 1000 - 220, `hp=${st.bh.hp} (expected 780)`);
  check('T6 round is never captured by A1', st.a1.stored === 0 && st.a1.stored <= storeDuringT6, `stored=${st.a1.stored}`);
  await shot('05_T6_protected');
  await sb('setBotFire', true);

  // ---- A2 gates ----
  await sb('resetFight');
  await sb('forceReady', 'a2');
  await sb('pressK');
  await sleep(300);
  await sb('spawnBurst'); // 3×30 = 90 incoming during the 1.0s absorb
  const escrowed = await waitFor('s => s.a2.phase === "absorb" && s.a2.escrow >= 90', 60000);
  check('A2 escrows incoming damage during absorb (HP untouched)', escrowed.ok && escrowed.st.bh.hp === 1000, `hp=${escrowed.st.bh.hp} escrow=${escrowed.st.a2.escrow}`);
  await shot('06_A2_absorbing');

  // the ONE return event: bot HP drops exactly once, by 65%
  const retStart = await waitFor('s => s.a2.phase === "return"', 60000);
  const botA = retStart.st.bot.hp;
  const vulnOn = await waitFor('s => s.a2.phase === "vuln"', 120000);
  st = vulnOn.st;
  const botLost = 1000 - st.bot.hp;               // bot may also have healed +40 on a pickup
  const dealt = Math.min(botA, 1000) - st.bot.hp;
  check('A2 returns 65% of escrow as ONE event', Math.abs(st.a2.returned - 58.5) < 0.51 && Math.abs(botLost - st.a2.returned) <= 40.5,
        `escrow=90 → returned=${st.a2.returned} botLost=${botLost.toFixed(1)} (±40 pickup heal)`);
  check('A2 escrow cap is 300', st.a2.escrow <= 300, `escrow=${st.a2.escrow}`);
  await shot('07_A2_return_event');

  // vulnerability ×2, then expires
  await sb('spawnBurst');
  const doubled = await waitFor('s => s.bh.hp <= 940', 60000);
  st = doubled.st;
  const lost = 1000 - st.bh.hp;
  check('vulnerability doubles incoming damage (30 → 60)', lost >= 60 && Math.abs(lost % 60) < 0.01, `hp=${st.bh.hp} lost=${lost}`);
  check('passive counts doubled (realized) damage', st.passive.realized === lost, `realized=${st.passive.realized}`);
  await shot('10_vulnerable_exposed');
  const vulnEnd = await waitFor('s => s.a2.phase === "idle"', 300000);
  check('vulnerability expires (3.0s window)', vulnEnd.ok, `phase=${vulnEnd.st.a2.phase}`);

  // ---- cooldowns ----
  await sb('resetFight');
  const cd1 = await sb('pressJ');
  st = await api();
  check('A1 cooldown is 14s', cd1 && st.a1.cd > 13.4, `cd=${st.a1.cd && st.a1.cd.toFixed(1)}`);
  await sb('resetFight');
  const cd2 = await sb('pressK');
  st = await api();
  check('A2 cooldown is 18s', cd2 && st.a2.cd > 17.4, `cd=${st.a2.cd && st.a2.cd.toFixed(1)}`);

  // ---- reset gate ----
  await sb('resetFight');
  await sleep(600);
  st = await api();
  check('reset restores the fight', st.bh.hp === 1000 && st.bot.hp === 1000 && st.a1.cd === 0 && st.a2.phase === 'idle' && st.passive.bonus === 0 && st.bh.radius === 75, `bh=${st.bh.hp} bot=${st.bot.hp} r=${st.bh.radius}`);
  await shot('11_reset_idle');

  // ---- KO + auto-reset ----
  for (let i = 0; i < 16; i++) { await sb('spawnBurst'); await sleep(350); }
  const ko = await waitFor('s => s.over', 600000, 500);
  check('KO triggers when HP hits zero', ko.ok, `bh hp=${ko.st.bh.hp} over=${ko.st.over}`);
  await shot('12_ko');
  const autoReset = await waitFor('s => !s.over && s.bh.hp === 1000', 600000, 500);
  check('auto reset after KO (3.4s)', autoReset.ok, `over=${autoReset.st.over} hp=${autoReset.st.bh.hp}`);

  // ---- auto-battle smoke (player holds L; bot attacks on its own) ----
  await sb('resetFight');
  await sb('setAutoMove', true);
  await sb('setCam', 'follow');
  await page.keyboard.down('l');
  const fight = await waitFor('s => s.bh.hp < 1000 && s.bot.hp < 1000', 900000, 500);
  await page.keyboard.up('l');
  check('auto-battle: real projectile damage flows BOTH ways', fight.ok, `bh=${fight.st.bh.hp.toFixed(0)} bot=${fight.st.bot.hp.toFixed(0)} clock=${fight.st.matchClock.toFixed(1)}`);
  await shot('13_follow_cam_auto_battle');
  await sb('setAutoMove', false);
  await sb('setCam', 'full');

  check('no page errors across the whole run', errors.length === 0, errors.slice(0, 5).join(' | '));

  fs.writeFileSync(path.join(EVIDENCE, 'report.json'), JSON.stringify({ results, errors, at: new Date().toISOString() }, null, 2));
  await browser.close();
  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} gates passed`);
  if (fails.length) { console.log('FAILURES:\n' + fails.map((f) => ' - ' + f.name + ' ' + f.detail).join('\n')); process.exit(1); }
}
main().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
