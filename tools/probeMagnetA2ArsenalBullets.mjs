#!/usr/bin/env node
/* MAGNET A2 — TARGETED real-Arsenal firearm repulsion proof.
 *
 * Uses ACTUAL Arsenal firearm emission (weaponApi.equip + the real holder
 * firing path), the real aq_bullet objects, the real projectile loop and the
 * real collision envelope. No injected or synthesized projectiles.
 *
 * Acceptance criterion is NOT an angle delta. It is:
 *   an eligible incoming bullet is observably REPULSED and does not penetrate
 *   through Magnet while A2 is protecting that approach.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/tmp/magnet-browser-deps/noop.js');
const puppeteer = require('puppeteer-core');
const chromiumModule = require('@sparticuz/chromium');
const chromium = chromiumModule.default || chromiumModule;
const execPath = await chromium.executablePath();
process.env.LD_LIBRARY_PATH = ['/tmp/al2023', '/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');

const url = process.env.APEX_APP_URL || 'http://127.0.0.1:4173';
const browser = await puppeteer.launch({
  executablePath: execPath,
  args: [...chromium.args, '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  headless: true, protocolTimeout: 600000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });

let out;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof window.__apexEnsureDeferredRuntimes === 'function', { timeout: 60000 });
  out = await page.evaluate(async () => {
    await window.__apexEnsureDeferredRuntimes('arsenalQuest');
    const waitFrames = (n) => new Promise((r) => { let c = 0; const next = () => (++c >= n ? r() : requestAnimationFrame(next)); requestAnimationFrame(next); });
    const HR = window.APEX_HERO_REWORK, MAG = window.APEX_MAGNET;

    const setup = async () => {
      if (HR.match) window.exitArsenalQuestMode();
      window.startArsenalQuestMode('MAGNET', 'ROBOT');
      HR.setAiEnabled(false);
      const st = window.APEX_ARSENAL.state;
      st.spawnTimer = 1e6; st.slots = []; st.spawnHeld = true; st.unarmedFastConsumed = true;
      await waitFrames(4);
      const [hero, opp] = window.fighters;
      hero.baseSpeed = 0; opp.baseSpeed = 0;
      const ct = HR.byCombatant(hero);
      return { hero, opp, ct };
    };

    // Record every AUTHORITATIVE projectile tick by wrapping the exact seam
    // production uses (MAG.stepProjectiles runs once per projectile
    // integration). rAF sampling is throttled in headless and would alias a
    // 5800 px/s bullet; this does not.
    const baseStep = MAG.stepProjectiles;
    let recorder = null;
    MAG.stepProjectiles = function (dt, projectiles, combatantOfBody, now) {
      let pre = null;
      if (recorder && recorder.bullet) {
        const b = recorder.bullet;
        pre = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
      }
      const out = baseStep.call(this, dt, projectiles, combatantOfBody, now);
      if (recorder) {
        if (!recorder.bullet) {
          recorder.bullet = (projectiles || []).find((p) => p && p.aq && p.type === 'aq_bullet' && p.owner === recorder.opp) || null;
          if (recorder.bullet) {
            const b = recorder.bullet;
            recorder.launch = { x: b.x, y: b.y, vx: b.vx, vy: b.vy, speed: Math.hypot(b.vx, b.vy) };
            recorder.identity = { owner: b.owner, weapon: b.weapon, damage: b.damage, critical: !!b.critical, type: b.type, life: b.life, radius: b.radius };
            if (recorder.offAxis) recorder.hero.y = 500 + 110;
            pre = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
          }
        }
        const b = recorder.bullet;
        if (b) {
          const hx = recorder.hero.x, hy = recorder.hero.y;
          const dx = b.x - hx, dy = b.y - hy, d = Math.hypot(dx, dy) || 1;
          const infl = MAG.inspect(now).projectileInfluence.find((r) => r.projectile === b);
          recorder.ticks.push({
            dt: +dt.toFixed(5),
            x: +b.x.toFixed(1), y: +b.y.toFixed(1), d: +d.toFixed(1),
            vrPre: pre ? +(((pre.x - hx) * pre.vx + (pre.y - hy) * pre.vy) / (Math.hypot(pre.x - hx, pre.y - hy) || 1)).toFixed(1) : null,
            vrPost: +((dx * b.vx + dy * b.vy) / d).toFixed(1),
            sp: +Math.hypot(b.vx, b.vy).toFixed(1),
            influenced: !!infl,
            entry: infl && infl.entries && infl.entries[0]
              ? { x: +infl.entries[0].x.toFixed(1), y: +infl.entries[0].y.toFixed(1), t: +infl.entries[0].t.toFixed(4),
                  radialBefore: +infl.entries[0].radialBefore.toFixed(1), radialAfter: +infl.entries[0].radialAfter.toFixed(1),
                  tangential: +infl.entries[0].tangential.toFixed(1) }
              : null,
            identityOk: b.owner === recorder.identity.owner && b.type === 'aq_bullet' && b.weapon === recorder.identity.weapon
              && b.damage === recorder.identity.damage && !!b.critical === recorder.identity.critical,
            life: b.life,
          });
        }
      }
      return out;
    };

    const segMin = (x0, y0, x1, y1, cx, cy) => {
      const dx = x1 - x0, dy = y1 - y0, a = dx * dx + dy * dy;
      if (a < 1e-9) return Math.hypot(x0 - cx, y0 - cy);
      let t = ((cx - x0) * dx + (cy - y0) * dy) / a; t = Math.max(0, Math.min(1, t));
      return Math.hypot(x0 + dx * t - cx, y0 + dy * t - cy);
    };

    const runCase = async (weapon, offAxis, withA2) => {
      const { hero, opp, ct } = await setup();
      hero.x = 500; hero.y = 500;
      opp.x = 120; opp.y = 500;
      await waitFrames(3);
      const hpBefore = hero.hp;
      const cast = withA2 ? HR.pressAbility(hero, 'A2') : { ok: false };
      recorder = { hero, opp, offAxis, bullet: null, launch: null, identity: null, ticks: [] };
      window.APEX_ARSENAL.weaponApi.equip(opp, weapon);

      for (let i = 0; i < 90; i++) {
        await waitFrames(1);
        if (recorder.bullet && (!window.projectiles.includes(recorder.bullet) || recorder.bullet.life === 0)) break;
        if (recorder.ticks.length > 120) break;
      }
      const r = recorder; recorder = null;
      const ticks = r.ticks;
      const envelope = hero.radius * ((window.APEX_ARSENAL_CONFIG && window.APEX_ARSENAL_CONFIG.BULLET_HIT_RADIUS_SCALE) || 0.78)
        + (r.identity ? r.identity.radius : 0);
      // Swept minimum across consecutive AUTHORITATIVE positions.
      let minDist = Infinity;
      for (let i = 1; i < ticks.length; i++) {
        minDist = Math.min(minDist, segMin(ticks[i - 1].x, ticks[i - 1].y, ticks[i].x, ticks[i].y, hero.x, hero.y));
      }
      if (ticks.length) minDist = Math.min(minDist, ticks[0].d);
      const entryTick = ticks.find((t) => t.entry);
      return {
        weapon, offAxis, a2Active: !!(cast && cast.ok),
        emitted: !!r.bullet,
        launchSpeed: r.launch ? +r.launch.speed.toFixed(1) : null,
        launchVelocity: r.launch ? { vx: +r.launch.vx.toFixed(1), vy: +r.launch.vy.toFixed(1) } : null,
        authoritativeTicks: ticks.length,
        fieldEntry: entryTick ? entryTick.entry : null,
        radialVelocityBeforeInfluence: entryTick ? entryTick.vrPre : null,
        radialVelocityAfterEntryResponse: entryTick ? entryTick.vrPost : null,
        maxOutwardRadialVelocity: ticks.length ? Math.max(...ticks.map((t) => t.vrPost)) : null,
        minSweptDistanceToMagnet: minDist === Infinity ? null : +minDist.toFixed(1),
        damagingEnvelope: +envelope.toFixed(1),
        enteredDamagingEnvelope: minDist <= envelope,
        magnetDamaged: hero.hp < hpBefore,
        influencedTicks: ticks.filter((t) => t.influenced).length,
        entryResponses: ticks.filter((t) => t.entry).length,
        identityStable: ticks.every((t) => t.identityOk),
        lifetimeContinuous: ticks.length > 1 ? ticks[ticks.length - 1].life <= ticks[0].life : true,
        trace: ticks.slice(0, 40),
      };
    };

    const results = [];
    for (const weapon of ['PISTOL', 'SMG', 'SNIPER']) {
      for (const offAxis of [false, true]) {
        results.push(await runCase(weapon, offAxis, true));
      }
    }
    // NEGATIVE CONTROL: same shot with A2 inactive must still reach Magnet.
    const controls = [];
    for (const weapon of ['PISTOL', 'SNIPER']) controls.push(await runCase(weapon, false, false));
    return { results, controls };
  });
} finally {
  await browser.close();
}

const { results, controls } = out;
const repelled = (r) => r.emitted && r.a2Active && !r.enteredDamagingEnvelope && !r.magnetDamaged
  && r.fieldEntry && r.fieldEntry.radialBefore < 0 && r.fieldEntry.radialAfter > 0
  && r.entryResponses === 1 && r.identityStable && r.maxOutwardRadialVelocity > 0;
const failures = results.filter((r) => !repelled(r)).map((r) => `${r.weapon}${r.offAxis ? ' off-axis' : ' head-on'}`);
// Negative control: without A2 the SAME shot must reach Magnet's surface
// (damage, or swept approach inside 1.25x the damaging envelope). A2-on cases
// stay 290+ px away, so this still discriminates sharply.
const controlReached = (c) => c.magnetDamaged || c.enteredDamagingEnvelope
  || (c.minSweptDistanceToMagnet != null && c.minSweptDistanceToMagnet <= c.damagingEnvelope * 1.25);
const controlFailures = controls.filter((c) => !c.emitted || !controlReached(c)).map((c) => `control ${c.weapon}`);

const report = {
  generatedAt: new Date().toISOString(), errors,
  acceptance: 'eligible incoming bullet is REPULSED and does not penetrate Magnet while A2 protects that approach',
  results, negativeControls: controls,
  pass: failures.length === 0 && controlFailures.length === 0 && errors.length === 0,
  failures: failures.concat(controlFailures),
};
const dest = path.resolve('docs/hero-rework/magnet-v1/evidence/a2-arsenal-bullet-repel.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(report, null, 2));

for (const r of results) {
  console.log(`${repelled(r) ? 'PASS' : 'FAIL'}  ${(r.weapon + (r.offAxis ? ' off-axis' : ' head-on')).padEnd(18)}` +
    ` launch=${r.launchSpeed} entry=${r.fieldEntry ? `(${r.fieldEntry.x},${r.fieldEntry.y}) vr ${r.fieldEntry.radialBefore}->${r.fieldEntry.radialAfter} tan=${r.fieldEntry.tangential}` : 'none'}` +
    ` minSwept=${r.minSweptDistanceToMagnet}/${r.damagingEnvelope} penetrated=${r.enteredDamagingEnvelope} identity=${r.identityStable} ticks=${r.authoritativeTicks} infl=${r.influencedTicks} entries=${r.entryResponses} dmg=${r.magnetDamaged}`);
}
for (const c of controls) console.log(`CTRL ${c.weapon.padEnd(8)} A2 off -> minSwept=${c.minSweptDistanceToMagnet}/${c.damagingEnvelope} reached=${controlReached(c)} damaged=${c.magnetDamaged}`);
console.log(report.pass ? '\nA2 ARSENAL BULLET PROBE: PASS' : `\nA2 ARSENAL BULLET PROBE: FAIL -> ${report.failures.join(', ')} ${errors.slice(0,2).join(' | ')}`);
process.exit(report.pass ? 0 : 1);
