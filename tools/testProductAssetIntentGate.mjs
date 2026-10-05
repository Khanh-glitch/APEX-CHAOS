import fs from 'node:fs';

const manifest = fs.readFileSync('src/game/runtimeManifest.js','utf8');
const loader = fs.readFileSync('src/game/runtimeLoader.js','utf8');
const bridge = fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const shell = fs.readFileSync('public/gold/shell.html','utf8');
const generator = fs.readFileSync('tools/buildGoldCutover.mjs','utf8');
const assetRuntime = fs.readFileSync('public/game/product/productAssetRuntime.js','utf8');
const shipping = fs.readFileSync('src/game/goldAssetManifest.js','utf8');

const failures=[];
const notes=[];
function check(name, cond, detail=''){
  if(cond){notes.push('PASS '+name);return;}
  failures.push('FAIL '+name+(detail?' :: '+detail:''));
}

check('heavy background warmup disabled', /export const WARMUP_GROUP_SEQUENCE = \[\];/.test(manifest));
check('asset authority is menu-interactive', manifest.includes('/game/product/productAssetRuntime.js?v='));
check('asset authority exposes prepare/warm/state', assetRuntime.includes('prepare,') && assetRuntime.includes('warm,') && assetRuntime.includes('state: snapshot'));
check('Mode art has no eager src', !shell.includes('<img src="assets/gold/mode-solo.webp"') && !shell.includes('<img src="assets/gold/mode-local.webp"'));
check('Mode art is data-src deferred', shell.includes('data-apex-src="assets/gold/mode-solo.webp"') && shell.includes('data-apex-src="assets/gold/mode-local.webp"'));
check('Mode hydration exists', shell.includes("if(next==='mode')hydrateDeferredImages(modeScreen)"));
check('Home does not build Fighter roster', !shell.includes("buildRoster(); renderFighter(); APEX_GOLD.onSurface&&APEX_GOLD.onSurface('home');"));
check('Fighter roster materializes on Mode commit', shell.includes("if(!roster.childElementCount)buildRoster();renderFighter();setScreen('fighter')"));
check('reference-only Pick images absent from shell', !shell.includes('pick-reference-overlay.png') && !shell.includes('pick-hidden-gold-source.png'));
check('reference-only Pick images absent from shipping manifest', !shipping.includes('pick-reference-overlay.png') && !shipping.includes('pick-hidden-gold-source.png'));
check('generator excludes reference-only assets', generator.includes('NON_SHIPPING_GOLD_ASSETS'));
check('Gold surface bridge owns route intent', bridge.includes("__apexEnsureDeferredRuntimes?.('select'") && bridge.includes("__apexEnsureDeferredRuntimes?.('arsenalProduct'"));
check('Lucky remains click intent', bridge.includes("surface === 'lucky'") && assetRuntime.includes("'/gold/lucky-draw.html'"));
check('runtime loader still exposes priority route path', loader.includes('loadDeferredGameRuntimes(group, { priority = true } = {})'));

console.log(['PRODUCT ASSET INTENT GATE',...notes].join('\n'));
if(failures.length){
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('RESULT: PASS ('+notes.length+' checks)');
