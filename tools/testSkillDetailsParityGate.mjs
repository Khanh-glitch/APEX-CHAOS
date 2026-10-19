// A1.5 — P1/P2 skill-details parity gate (node layer).
//
// Proves the DATA and the SYMMETRY contract without a browser:
//   · heroRegistry (the single skill authority) carries complete authored
//     PASSIVE/A1/A2 data for every playable fighter, with VIE translations
//     for every description in the locale catalog,
//   · the bridge exposes exactly one projection (skillDetailsFor) built from
//     the registry + canonical skill copy + approved icons,
//   · the runtime installs the SAME component on BOTH sides from one loop,
//     reads the shell's presented fighter (dataset.hero), blocks background
//     actions, and restores focus — no P2-only implementation can exist.
// Real pointer/keyboard/touch behaviour is proven by the browser acceptance
// (tools/testSkillDetailsBrowser.mjs); a pass here never implies P1 or P2
// browser behaviour on its own.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

const notes = [];
const failures = [];
function check(name, cond, detail) {
  if (cond) { notes.push(`PASS ${name}`); return true; }
  failures.push(`FAIL ${name}${detail ? ' :: ' + detail : ''}`);
  return false;
}

const PLAYABLE = ['ROBOT', 'HUNTER', 'CRYSTAL', 'MAGNET', 'ICE', 'MIRROR', 'BOXE', 'SHURI'];

// ── 1. registry data completeness (executes the real registry) ────────────
const registrySource = read('public/game/hero-rework/heroRegistry.js');
const catalog = read('src/game/localeCatalog.js');
const windowStub = {
  console, addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
};
const ctx = vm.createContext({
  window: windowStub, console, Object, Array, String, Number, Boolean,
  Math, JSON, Set, Map, Error, RegExp, Date,
});
vm.runInContext(`(function(){ with (window) {\n${registrySource}\n} })();`, ctx, { filename: 'heroRegistry.js' });
const REG = windowStub.APEX_HERO_REWORK_REGISTRY;
check('heroRegistry executes and registers', !!REG && !!REG.HEROES);
for (const id of PLAYABLE) {
  const hero = REG.HEROES[id];
  if (!check(`${id}: registry hero exists`, !!hero && !!hero.skills)) continue;
  for (const slot of ['PASSIVE', 'A1', 'A2']) {
    const def = hero.skills[slot];
    const desc = def && def.archiveProfile && def.archiveProfile.description;
    check(`${id}/${slot}: authored name + description`,
      !!(def && def.displayName && typeof desc === 'string' && desc.length >= 20),
      def ? `desc=${JSON.stringify(desc)}` : 'missing def');
    check(`${id}/${slot}: description has a VIE translation`,
      typeof desc === 'string' && catalog.includes(desc));
    if (slot !== 'PASSIVE') {
      const cfg = typeof REG.resolveSkillLevel === 'function'
        ? REG.resolveSkillLevel(id, slot, 1) : def.baseConfig;
      check(`${id}/${slot}: authoritative cooldown resolvable`,
        !!cfg && Number(cfg.cooldown) > 0, `cd=${cfg && cfg.cooldown}`);
    }
  }
}
check('identity map NEWBOT↔ROBOT resolves through the registry',
  typeof REG.displayNameFor === 'function' && REG.displayNameFor('ROBOT') === 'NEWBOT');

// ── 2. one bridge projection, fed by the one authority ────────────────────
const bridge = read('public/game/gold/goldProductBridge.js');
check('bridge exposes BRIDGE.skillDetailsFor exactly once',
  (bridge.match(/BRIDGE\.skillDetailsFor\s*=/g) || []).length === 1);
check('skillDetailsFor reads registry HEROES + archiveProfile descriptions',
  /skillDetailsFor[\s\S]{0,2600}hero\.skills/.test(bridge)
  && /archiveProfile\.description/.test(bridge));
check('skillDetailsFor uses canonical GOLD_SKILL_COPY names + heroUiArt icons',
  /skillDetailsFor[\s\S]{0,2600}GOLD_SKILL_COPY/.test(bridge)
  && /skillDetailsFor[\s\S]{0,2600}heroUiArt/.test(bridge));
check('skillDetailsFor resolves shell keys via the canonical production map',
  /skillDetailsFor[\s\S]{0,2600}PRODUCTION_ID_BY_SHELL_KEY/.test(bridge));
check('identity mappings exist for newbot/crystala/frost shell keys',
  /newbot:\s*'ROBOT'/.test(bridge) && /crystala:\s*'CRYSTAL'/.test(bridge) && /frost:\s*'ICE'/.test(bridge));
check('the projection fabricates no description fallback copy',
  !/skillDetailsFor[\s\S]{0,2600}desc:\s*'[^']{4,}'/.test(bridge));

// ── 3. runtime symmetry contract ──────────────────────────────────────────
const runtime = read('public/game/ui/skillDetailsRuntime.js');
check('runtime registers its ready flag + testable API',
  /window\.apexSkillDetailsRuntime = 'ready'/.test(runtime)
  && /window\.APEX_SKILL_DETAILS/.test(runtime));
check('BOTH sides come from one SIDES table (p1 + p2, same code path)',
  /side: 'p1', sideId: 'p1Side'/.test(runtime) && /side: 'p2', sideId: 'p2Side'/.test(runtime)
  && /for \(const cfg of SIDES\) if \(!installButton\(cfg\)\)/.test(runtime));
check('presented fighter is the shell render state (dataset.hero)',
  /node\.dataset\.hero/.test(runtime));
check('P2-empty law is honoured (no stale BOT/P2 data)',
  /fighter-p2-empty/.test(runtime));
check('details resolve through the ONE bridge projection',
  /bridge\.skillDetailsFor\(key\)/.test(runtime)
  && (runtime.match(/skillDetailsFor/g) || []).length <= 3);
check('inspection cannot select/lock: buttons + overlay stop propagation',
  (runtime.match(/stopPropagation\(\)/g) || []).length >= 4);
check('modal closes on ESC and restores focus to the invoker',
  /e\.key === 'Escape'/.test(runtime) && /lastInvoker\.focus/.test(runtime));
check('modal is an accessible dialog (role/aria-modal/labelledby)',
  /role', 'dialog'/.test(runtime) && /aria-modal', 'true'/.test(runtime) && /aria-labelledby/.test(runtime));
check('background keys are swallowed while open (capture phase)',
  /addEventListener\('keydown', onCaptureKeydown, true\)/.test(runtime));
check('fighter changes re-render the open panel (no stale P1/P2 data)',
  /MutationObserver/.test(runtime) && /attributeFilter: \['data-hero', 'class'\]/.test(runtime));
check('runtime never writes selection/ownership state',
  !/setLast|canPublicSelect|selectHero|owns\(|buy\(|spin\(/.test(runtime));

// ── 4. registration + localization ────────────────────────────────────────
const manifest = read('src/game/runtimeManifest.js');
check('runtime is registered in the hub group with the revision stamp',
  /\['\/game\/ui\/skillDetailsRuntime\.js\?v=' \+ APEX_ARSENAL_RUNTIME_REVISION, 'apexSkillDetailsRuntime'\]/.test(manifest));
check('SKILL DETAILS + ALWAYS ACTIVE have VIE translations',
  catalog.includes("['SKILL DETAILS','CHI TIẾT KỸ NĂNG']")
  && catalog.includes("['ALWAYS ACTIVE','LUÔN KÍCH HOẠT']"));

const lines = ['A1.5 SKILL DETAILS PARITY GATE (node)', ...notes];
if (failures.length) {
  lines.push('', ...failures, '', `RESULT: FAIL (${failures.length})`);
  console.error(lines.join('\n'));
  process.exit(1);
}
lines.push('', `RESULT: PASS (${notes.length} checks)`);
console.log(lines.join('\n'));
process.exit(0);
