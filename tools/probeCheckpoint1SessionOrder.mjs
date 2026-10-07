#!/usr/bin/env node
// Checkpoint 1 truth probe — exact-baseline session-order isolation.
//
// PURPOSE:
//   Observe the real Arsenal + Hero Rework runtime across mode changes without
//   changing product behavior. This intentionally starts from the CP1 baseline
//   commit and uses the existing shared headless harness.
//
// PROVES:
//   - LOCAL and BOT each get a fresh Arsenal profile.
//   - P2 cast AI is suppressed by CURRENT LOCAL match state, not by mutating the
//     persistent HR.aiEnabled master switch.
//   - LOCAL -> BOT restores CPU casting without a page reload.
//   - BOT -> LOCAL returns P2 to human ownership.
//   - Hero Rework installs a fresh match object after teardown.
//
// DOES NOT:
//   - patch gameplay,
//   - patch HUD geometry,
//   - force HR.setAiEnabled(),
//   - infer anything from commits after the checkpoint baseline.

import { bootHarness } from './lib/crystalaHarness.mjs';

const H = await bootHarness();
const { win, T } = H;
const HR = win.APEX_HERO_REWORK;

const report = {
  baseline: 'd0328808da80fbfad673ce32c757287490e7ef6f',
  probe: 'checkpoint-1-session-order',
  observations: [],
  failures: [],
};

function fail(name, detail) {
  report.failures.push({ name, detail });
}

function setProfile(mode) {
  win.__apexArsenalBattleProfile = mode;
  win.__apexArsenalSelectionMode = mode.toLowerCase();
}

function snapshot(label) {
  const aq = win.APEX_ARSENAL?.state || null;
  const hr = HR?.debugState?.() || { active: false };
  const p2 = hr.combatants?.[1] || null;
  const row = {
    label,
    arsenalMode: aq?.battleMode || null,
    arsenalActive: !!aq?.active,
    hrActive: !!hr.active,
    hrAiEnabled: hr.aiEnabled,
    p2Hero: p2?.heroId || null,
    p2FirstSkillCastAt: p2?.telemetry?.firstSkillCastAt ?? null,
    p2A1Cd: p2?.skills?.A1?.cd ?? null,
    p2A2Cd: p2?.skills?.A2?.cd ?? null,
  };
  report.observations.push(row);
  return row;
}

function startRobotMirror(mode, label) {
  setProfile(mode);
  const match = T.start('ROBOT', 'ROBOT');
  if (!match) {
    fail(label + ':start', 'startArsenalBattleMode returned no Hero Rework match');
    return { match: null, state: snapshot(label + ':failed-start') };
  }
  T.holdSpawns();
  // Robot A1 has no valid pickup in this fixture. A2 is unconditional once its
  // deterministic CPU plan delay elapses, making it a clean ownership oracle.
  T.step(2.25, 1 / 120);
  return { match, state: snapshot(label) };
}

function goldHostedExit(label) {
  // Mirror the production ownership condition so the runtime tears down only
  // the match and never opens a retired legacy product surface.
  win.__apexGoldBattleHosted = true;
  const result = win.exitArsenalBattleMode?.({ goldHosted: true, silentGoldExit: true });
  win.__apexGoldBattleHosted = false;
  const hr = HR?.debugState?.() || { active: false };
  report.observations.push({ label: label + ':after-exit', exitResult: result, hrActive: !!hr.active });
  if (hr.active) fail(label + ':teardown', 'Hero Rework match survived exit');
}

// Sequence A: LOCAL -> BOT. This is the owner-reported contamination direction.
const localA = startRobotMirror('LOCAL', 'local-before-bot');
const localMatch = localA.match;
if (localA.state.arsenalMode !== 'LOCAL') fail('local-profile', localA.state);
if (localA.state.hrAiEnabled !== true) {
  fail('local-master-ai-mutated', 'LOCAL changed persistent HR.aiEnabled; baseline should gate by current battleMode instead');
}
if (localA.state.p2FirstSkillCastAt != null || (localA.state.p2A1Cd || 0) > 0 || (localA.state.p2A2Cd || 0) > 0) {
  fail('local-p2-ai-fired', localA.state);
}
goldHostedExit('local-before-bot');

const botA = startRobotMirror('BOT', 'bot-after-local');
const botMatch = botA.match;
if (botA.state.arsenalMode !== 'BOT') fail('bot-profile-after-local', botA.state);
if (botA.state.hrAiEnabled !== true) fail('bot-master-ai-disabled', botA.state);
if (botA.state.p2FirstSkillCastAt == null || !((botA.state.p2A1Cd || 0) > 0 || (botA.state.p2A2Cd || 0) > 0)) {
  fail('bot-p2-ai-did-not-resume', botA.state);
}
if (localMatch && botMatch && localMatch === botMatch) fail('match-object-reused-local-to-bot', 'same HR.match object');
goldHostedExit('bot-after-local');

// Sequence B: BOT -> LOCAL. This catches a CPU ownership leak in the reverse direction.
const botB = startRobotMirror('BOT', 'bot-before-local');
const botMatchB = botB.match;
if (botB.state.arsenalMode !== 'BOT') fail('bot-profile-before-local', botB.state);
if (botB.state.p2FirstSkillCastAt == null) fail('bot-p2-ai-missing-before-local', botB.state);
goldHostedExit('bot-before-local');

const localB = startRobotMirror('LOCAL', 'local-after-bot');
const localMatchB = localB.match;
if (localB.state.arsenalMode !== 'LOCAL') fail('local-profile-after-bot', localB.state);
if (localB.state.p2FirstSkillCastAt != null || (localB.state.p2A1Cd || 0) > 0 || (localB.state.p2A2Cd || 0) > 0) {
  fail('local-p2-ai-leaked-from-bot', localB.state);
}
if (botMatchB && localMatchB && botMatchB === localMatchB) fail('match-object-reused-bot-to-local', 'same HR.match object');
goldHostedExit('local-after-bot');

console.log(JSON.stringify(report, null, 2));
if (report.failures.length) {
  console.error(`CHECKPOINT 1 SESSION ORDER: FAIL (${report.failures.length})`);
  process.exit(1);
}
console.log('CHECKPOINT 1 SESSION ORDER: PASS');
