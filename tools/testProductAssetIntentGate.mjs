import fs from 'node:fs';

const manifest = fs.readFileSync('src/game/runtimeManifest.js','utf8');
const loader = fs.readFileSync('src/game/runtimeLoader.js','utf8');
const bridge = fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const shell = fs.readFileSync('public/gold/shell.html','utf8');
const generator = fs.readFileSync('tools/buildGoldCutover.mjs','utf8');
const assetRuntime = fs.readFileSync('public/game/product/productAssetRuntime.js','utf8');
const shipping = fs.readFileSync('src/game/goldAssetManifest.js','utf8');
const robotPresentation = fs.readFileSync('public/game/hero-rework/robotPresentationRuntime.js','utf8');
const hunterPresentation = fs.readFileSync('public/game/hero-rework/hunterPresentationRuntime.js','utf8');
const frostPresentation = fs.readFileSync('public/game/hero-rework/frostPresentationRuntime.js','utf8');
const magnetGold = fs.readFileSync('public/game/hero-rework/magnetGoldV1.js','utf8');
const magnetPresentation = fs.readFileSync('public/game/hero-rework/magnetPresentationRuntime.js','utf8');
const mirrorGold = fs.readFileSync('public/game/hero-rework/mirrorGoldV1.js','utf8');
const mirrorPresentation = fs.readFileSync('public/game/hero-rework/mirrorPresentationRuntime.js','utf8');
const crystalaPresentation = fs.readFileSync('public/game/hero-rework/crystalaPresentationRuntime.js','utf8');

const failures=[];
const notes=[];
function check(name, cond, detail=''){
  if(cond){notes.push('PASS '+name);return;}
  failures.push('FAIL '+name+(detail?' :: '+detail:''));
}

check('heavy background warmup disabled', /export const WARMUP_GROUP_SEQUENCE = \[\];/.test(manifest));
check('asset authority is menu-interactive', manifest.includes('/game/product/productAssetRuntime.js?v='));
check('asset authority exposes prepare/warm/state', assetRuntime.includes('prepare,') && assetRuntime.includes('warm,') && assetRuntime.includes('state: snapshot'));

check('Home Core is explicit', assetRuntime.includes("home: Object.freeze([") && assetRuntime.includes("'/gold/assets/gold/home-robot-body.png'") && assetRuntime.includes("'/gold/assets/gold/home-world-background.png'"));
check('hero preload all-vs-selected is explicit', assetRuntime.includes("heroIds === null") && assetRuntime.includes("Array.isArray(heroIds) ? heroIds.filter(Boolean) : []"));
check('Fighter covers may preload all visible', assetRuntime.includes("const covers = heroUrls(null, ['portrait'])"));
check('Fighter large art is selected-only', assetRuntime.includes("const focused = heroUrls(context.heroIds, ['art'])"));
// R52 (owner: MAGNET had no battle visuals, FROST loaded late): the battle
// surface preloads the selected combatants' arena rig as well, and it stays
// strictly selected-only — the rig table is never expanded to all heroes.
check('Battle hero art is selected-only',
  assetRuntime.includes("heroUrls(context.heroIds, ['battleAvatar', 'skillIcons'])")
  && /rigUrls\(context\.heroIds/.test(assetRuntime));
check('Battle rig is selected-only (never an all-hero preload)',
  !/rigUrls\(null/.test(assetRuntime));

check('Mode art has no eager src', !shell.includes('<img src="assets/gold/mode-solo.webp"') && !shell.includes('<img src="assets/gold/mode-local.webp"'));
check('Mode art is data-src deferred', shell.includes('data-apex-src="assets/gold/mode-solo.webp"') && shell.includes('data-apex-src="assets/gold/mode-local.webp"'));
check('Mode hydration exists', shell.includes("if(next==='mode')hydrateDeferredImages(modeScreen)"));
check('Home does not build Fighter roster', !shell.includes("buildRoster(); renderFighter(); APEX_GOLD.onSurface&&APEX_GOLD.onSurface('home');"));
check('Fighter roster materializes only after route intent', shell.includes("if(!roster.childElementCount)buildRoster();renderFighter();void setScreen('fighter')"));

check('reference-only Pick images absent from shell', !shell.includes('pick-reference-overlay.png') && !shell.includes('pick-hidden-gold-source.png'));
check('reference-only Pick images absent from shipping manifest', !shipping.includes('pick-reference-overlay.png') && !shipping.includes('pick-hidden-gold-source.png'));
check('generator excludes reference-only assets', generator.includes('NON_SHIPPING_GOLD_ASSETS'));

check('surface activation and preparation are separate', bridge.includes('BRIDGE.onSurface = function onSurface') && bridge.includes('BRIDGE.prepareSurface = async function prepareSurface'));
check('Battle runtime load is awaited by prepareSurface', bridge.includes("ensureDeferredRuntimes('arsenalProduct').then") && bridge.includes("throw new Error('arsenalProduct runtime group did not reach READY')"));
check('shell awaits scene preparation before reveal', shell.includes("if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface(next,{heroIds})") && shell.includes("if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface('battle',{heroIds})"));
check('Fighter readiness covers world-stage art', shell.includes("await tr?.prepareElement?.(stage,{verifyImages:false})") && shell.includes("await tr?.prepareElement?.(surfaceRoot)"));
check('Lucky remains click intent', bridge.includes("surface === 'lucky'") && assetRuntime.includes("'/gold/lucky-draw.html'") && shell.includes("name:'home->lucky'"));
check('transition runtime is a shipping asset', shipping.includes("'/gold/transition/mechanical-door-v4.gold.js'"));
check('runtime loader still exposes priority route path', loader.includes('loadDeferredGameRuntimes(group, { priority = true } = {})'));

// E3 — profiling only. These checks intentionally prove observability rather
// than performance: optimization belongs to E4/E5 after owner/browser samples.
check('asset records capture request/fetch/decode/bytes',
  assetRuntime.includes('requestedAt: 0')
  && assetRuntime.includes('fetchStartedAt: 0')
  && assetRuntime.includes('bytes: 0')
  && assetRuntime.includes('decodeStartedAt: 0')
  && assetRuntime.includes('readyAt: 0'));
check('asset fetch measures actual response bytes',
  assetRuntime.includes('const bytes = await response.arrayBuffer()')
  && assetRuntime.includes('rec.bytes = bytes.byteLength || 0'));
check('Core Six profiler API is public and read-only',
  assetRuntime.includes('window.apexHeroLoadTelemetry = Object.freeze')
  && assetRuntime.includes('profile: heroProfile')
  && assetRuntime.includes('snapshot: heroProfiles'));
check('profile reports full cold-load ladder',
  ['requestStartAt','fetchDoneAt','decodeDoneAt','runtimeReadyAt','preprocessReadyAt','firstCompleteFrameAt']
    .every((token)=>assetRuntime.includes(token)));
check('E3 does not change the bounded load pool',
  /const PREPARE_CONCURRENCY = 8;/.test(assetRuntime)
  && /Array\.from\(\{ length: Math\.max\(1, Math\.min\(PREPARE_CONCURRENCY, urls\.length\)\) \}, worker\)/.test(assetRuntime));

const probes = [
  ['newbot', robotPresentation],
  ['hunter', hunterPresentation],
  ['frost', frostPresentation],
  ['magnet', magnetPresentation],
  ['mirror', mirrorPresentation],
  ['crystala', crystalaPresentation],
];
for (const [hero, source] of probes) {
  check(`${hero} publishes runtime-ready`, source.includes("'runtime-ready'"));
  check(`${hero} publishes first-complete-frame`, source.includes("'first-complete-frame'"));
}
check('Robot measures synchronous sprite preprocess',
  robotPresentation.includes("'preprocess-start'") && robotPresentation.includes("'preprocess-ready'"));
check('Hunter measures Gold load/derive preprocess',
  hunterPresentation.includes("'preprocess-start'") && hunterPresentation.includes("'preprocess-ready'"));
check('Frost measures Gold mip/surface preprocess',
  frostPresentation.includes("'preprocess-start'") && frostPresentation.includes("'preprocess-ready'"));
check('Magnet measures the Gold image fanout loader itself',
  magnetGold.includes("'preprocess-start'") && magnetGold.includes("'preprocess-ready'")
  && magnetGold.includes('assetJobs:jobs.length'));
check('Mirror measures first-use raster bake',
  mirrorGold.includes("'preprocess-start'") && mirrorGold.includes("'preprocess-ready'"));
check('Crystala reports procedural preprocess explicitly',
  crystalaPresentation.includes("'preprocess-start'") && crystalaPresentation.includes("'preprocess-ready'"));

console.log(['PRODUCT ASSET INTENT GATE',...notes].join('\n'));
if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RESULT: PASS ('+notes.length+' checks)');
