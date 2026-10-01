#!/usr/bin/env node
// MAGNET V1 R1 — production scheduler parity.
// This gate never calls APEX_MAGNET_GOLD.tick(). It advances only through the
// two shipping frame entry points and proves hrPostTick owns one Magnet tick.
import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;
const PRES = win.APEX_MAGNET_PRESENTATION;
const GOLD = win.APEX_MAGNET_GOLD;
const failures = [];

function gate(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${JSON.stringify(detail)}`);
  if (!ok) failures.push(name);
}
function counters() {
  return PRES.inspect().scheduler;
}
function delta(after, before, key) {
  return after[key] - before[key];
}
function start() {
  T.start('MAGNET', 'MIRROR');
  T.holdSpawns();
  HR.setAiEnabled(false);
  const fighter = H.fighters()[0];
  fighter.baseSpeed = 0;
  fighter.x = 300;
  fighter.y = 500;
  return HR.byCombatant(fighter);
}
function runPath(name, advance) {
  const ct = start();
  const clock0 = Number(win.matchClock) || 0;
  const scheduler0 = counters();
  const fixed0 = GOLD.inspect(ct).state?.fixedSteps || 0;
  advance(1 / 60);
  const clock1 = Number(win.matchClock) || 0;
  const scheduler1 = counters();
  const gold = GOLD.inspect(ct).state;
  const presentation = PRES.inspect(ct).state;
  const result = {
    clockDelta: clock1 - clock0,
    tickCalls: delta(scheduler1, scheduler0, 'tickCalls'),
    advancedFrames: delta(scheduler1, scheduler0, 'advancedFrames'),
    duplicateCalls: delta(scheduler1, scheduler0, 'duplicateCalls'),
    fixedSteps: (gold?.fixedSteps || 0) - fixed0,
    frameSample: presentation?.frameSample,
  };
  gate(`${name}-game-and-gold-advance`, result.clockDelta > 0 && result.fixedSteps === 2, result);
  gate(`${name}-exactly-one-frame-owner`, result.tickCalls === 1 && result.advancedFrames === 1 && result.duplicateCalls === 0, result);
  gate(`${name}-post-movement-sample`, !!result.frameSample
    && result.frameSample.dt === 1 / 60
    && Number.isFinite(result.frameSample.before.x)
    && Number.isFinite(result.frameSample.after.x), result.frameSample);
  win.exitArsenalQuestMode();
}

try {
  gate('no-independent-aq-step-clock', !win.APEX_ARSENAL.step.__magnetPresentationWrapped, {
    marker: win.APEX_ARSENAL.step.__magnetPresentationWrapped || false,
  });
  runPath('headless-aq-step', (dt) => win.APEX_ARSENAL.step(dt));
  runPath('production-global-update', (dt) => win.update(dt));
} catch (error) {
  gate('scheduler-parity-execution', false, String(error && error.stack || error));
}

console.log(`\n[MAGNET SCHEDULER PARITY] ${failures.length ? 'FAIL' : 'PASS'}`);
if (failures.length) console.error(`FAILURES: ${failures.join(', ')}`);
process.exit(failures.length ? 1 : 0);
