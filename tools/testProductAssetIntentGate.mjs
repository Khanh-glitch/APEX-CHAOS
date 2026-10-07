import fs from 'node:fs';

const manifest = fs.readFileSync('src/game/runtimeManifest.js','utf8');
const loader = fs.readFileSync('src/game/runtimeLoader.js','utf8');
const bridge = fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const shell = fs.readFileSync('public/gold/shell.html','utf8');
const generator = fs.readFileSync('tools/buildGoldCutover.mjs','utf8');
const assetRuntime = fs.readFileSync('public/game/product/productAssetRuntime.js','utf8');
const shipping = fs.readFileSync('src/game/goldAssetManifest.js','utf8');
const frostPresentation = fs.readFileSync('public/game/hero-rework/frostPresentationRuntime.js','utf8');
const magnetGold = fs.readFileSync('public/game/hero-rework/magnetGoldV1.js','utf8');

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
check('Fighter per-selection intent includes the selected hero rig',
  assetRuntime.includes("if (id === 'fighter-hero') {")
  && assetRuntime.includes("...rigUrls(context.heroIds, new Set(['rig']))")
  && !/fighter-hero[^\n]*heroIds === null/.test(assetRuntime));
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
check('accepted Pick selection starts a selected-only rig decode before LOCK IN',
  bridge.includes('BRIDGE.warmFighterSelection = function warmFighterSelection')
  && bridge.includes("assets.prepare('fighter-hero'")
  && bridge.includes("scope: 'intent:fighter-hero:' + id")
  && shell.includes("APEX_GOLD.warmFighterSelection&&void APEX_GOLD.warmFighterSelection([id])"));
check('selected-fighter warm is memoized per hero instead of abort/restart spam',
  bridge.includes('const fighterSelectionWarm = new Map();')
  && bridge.includes('if (fighterSelectionWarm.has(id)) return fighterSelectionWarm.get(id);')
  && bridge.includes('fighterSelectionWarm.set(id, job);'));
check('Battle runtime load is awaited by prepareSurface', bridge.includes("ensureDeferredRuntimes('arsenalProduct').then") && bridge.includes("throw new Error('arsenalProduct runtime group did not reach READY')"));
check('battle readiness waits for selected presentation art, not just runtime evaluation',
  bridge.includes('async function warmMatchHeroPresentation(...keys)')
  && bridge.includes('warmMatchHeroPresentation(...heroIds)')
  && bridge.includes('warmMatchHeroPresentation(p1Shell, p2Shell)')
  && bridge.includes("throw new Error('Frost presentation readiness authority unavailable')")
  && bridge.includes("throw new Error('Magnet presentation readiness authority unavailable')"));
check('Frost builds one full-quality shared mip cache before reveal',
  frostPresentation.includes('let sharedArtPromise = null')
  && frostPresentation.includes('function prepareSharedArt()')
  && frostPresentation.includes('api.prepareArt = function prepareArt()')
  && frostPresentation.includes('sharedArt = { mips: loader.mips, shadow: loader.shadowCanvas }')
  && !frostPresentation.includes('createState.loadStarted'));
check('Magnet exposes the same one-shot Gold loader promise to battle readiness',
  magnetGold.includes('const assetReady=loadAssets();')
  && magnetGold.includes('prepareArt(){return assetReady.then')
  && (magnetGold.match(/loadAssets\(\)/g) || []).length === 2);
check('shell awaits scene preparation before reveal', shell.includes("if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface(next,{heroIds})") && shell.includes("if(APEX_GOLD.prepareSurface)await APEX_GOLD.prepareSurface('battle',{heroIds})"));
check('Fighter readiness covers world-stage art', shell.includes("await tr?.prepareElement?.(stage,{verifyImages:false})") && shell.includes("await tr?.prepareElement?.(surfaceRoot)"));
check('Lucky remains click intent', bridge.includes("surface === 'lucky'") && assetRuntime.includes("'/gold/lucky-draw.html'") && shell.includes("name:'home->lucky'"));
check('transition runtime is a shipping asset', shipping.includes("'/gold/transition/mechanical-door-v4.gold.js'"));
check('runtime loader still exposes priority route path', loader.includes('loadDeferredGameRuntimes(group, { priority = true } = {})'));

console.log(['PRODUCT ASSET INTENT GATE',...notes].join('\n'));
if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RESULT: PASS ('+notes.length+' checks)');
