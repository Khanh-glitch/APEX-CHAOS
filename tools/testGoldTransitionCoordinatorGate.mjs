import fs from 'node:fs';
import crypto from 'node:crypto';

const app=fs.readFileSync('src/App.jsx','utf8');
const css=fs.readFileSync('src/styles.css','utf8');
const coordinator=fs.readFileSync('src/game/sceneTransitionCoordinator.js','utf8');
const shell=fs.readFileSync('public/gold/shell.html','utf8');
const bridge=fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const assets=fs.readFileSync('public/game/product/productAssetRuntime.js','utf8');
const runtime=fs.readFileSync('public/gold/transition/mechanical-door-v4.gold.js');
const runtimeText=runtime.toString('utf8');
const apexEngine=fs.readFileSync('public/apexEngine.js','utf8');
const build=fs.readFileSync('tools/buildGoldCutover.mjs','utf8');
const adapter=fs.readFileSync('tools/goldShellR50k.mjs','utf8');
const manifest=fs.readFileSync('src/game/runtimeManifest.js','utf8');
const goldUrls=fs.readFileSync('src/game/goldAssetManifest.js','utf8');

const failures=[];const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}
const sha=(buf)=>crypto.createHash('sha256').update(buf).digest('hex');

check('runtime revision is current R59 recovery', manifest.includes("20261007-r59-recovery-hunter-ai"));
check('Gold runtime hash matches audited donor adaptation',
  sha(runtime)==='6d338906e477c13fa42cd6727be7c41bdd0c5b66e12fc140e3836c7858ce0dd2');
check('Gold close timing preserved', runtimeText.includes('closeEnd: 1.68'));
check('Gold minimum seal preserved', runtimeText.includes('sealedMin: 0.075'));
check('Gold opening timing preserved', runtimeText.includes('openingEnd: 1.68'));
check('Gold ultra-fast opening profile preserved', runtimeText.includes('releaseSpeed = 1.85'));
check('Gold state machine preserved', ['CLOSING','SEALED','OPENING','DONE'].every((x)=>runtimeText.includes(x)));
check('Gold cover callback preserved', runtimeText.includes('onCover'));
check('Gold adaptive close authority preserved', runtimeText.includes('openBoostTarget'));
check('coordinator preserves fast-load close adaptation', coordinator.includes('primeAdaptiveClose(tx)'));

for(const token of ['TRIGGER CLOSE','READY → OPEN','closeBtn','readyBtn','resetBtn','menu-bg.jpg','arena-bg.jpg']){
  check(`production transition has no demo token: ${token}`, !runtimeText.includes(token));
}

check('boot begins black', app.includes('id="apex-boot-blackout"') && !app.includes('id="loading-screen"'));
check('one transition canvas is mounted', app.includes('id="apex-scene-transition"'));
check('Home Core is awaited before boot READY', app.includes("await window.APEX_GOLD.prepareSurface('home')") && app.includes('signalBootReady'));
check('boot paint settle never scans future HUD images',
  coordinator.includes("settleSceneElement(defaultRoot(), { verifyImages: false })"));
check('boot readiness promise can reject instead of orphaning forever',
  coordinator.includes('return { promise, resolve, reject }') && coordinator.includes('bootReady.reject(error)'));
check('coordinator consumes generated transition URL', coordinator.includes("import { GOLD_TRANSITION_URL } from './goldAssetManifest.js'") && coordinator.includes('const GOLD_DOOR_RUNTIME_URL = GOLD_TRANSITION_URL'));
check('Gold Door runtime is module-scoped away from engine globals',
  coordinator.includes("script.type = 'module'") &&
  coordinator.includes("s.type === 'module'") &&
  coordinator.includes("script.dataset.apexSceneTransitionRuntime = 'true'"));
check('known TAU global collision is isolated by module loading',
  apexEngine.includes('var TAU') &&
  runtimeText.includes('const TAU') &&
  coordinator.includes("script.type = 'module'"));
check('generated transition URL carries current product revision', goldUrls.includes('/gold/transition/mechanical-door-v4.gold.js?v=20261007-r59-recovery-hunter-ai'));
check('real DOM replaces demo background tile', coordinator.includes("engine.open({ from: null, autoReadyAfter: null })"));
check('destination commits only after covered + prepared',
  coordinator.includes('(!tx.covered && !tx.coverFailed) || !tx.prepared'));
// R53 (owner law: a scene intent is never swallowed): the cover may only be
// bypassed by the forced recovery of a destination that IS prepared - the door
// failing is presentation, the scene still has to land.
check('the cover bypass is reserved for a forced recovery of a prepared destination',
  /const forceCommit = \(\) => \{\s*const tx = active;\s*if \(!tx \|\| tx\.committed \|\| !tx\.prepared\) return false;/.test(coordinator)
  && coordinator.includes('tx.coverFailed = true')
  && coordinator.includes('tx.forced = true'));
check('destination settles before READY', coordinator.indexOf('await settleSceneElement(revealRoot)') < coordinator.indexOf('engine?.ready()'));
check('semantic readyGate precedes READY', coordinator.indexOf('if (tx.readyGate && !tx.failed) await tx.readyGate()') < coordinator.indexOf('engine?.ready()'));
check('adaptive close prime uses Gold READY without authorizing reveal',
  coordinator.includes('primeAdaptiveClose') &&
  coordinator.includes('engine.ready();') &&
  coordinator.includes("state === 'SEALED'") &&
  coordinator.includes('engine.readyRequested = false'));
check('final production READY remains singular', (coordinator.match(/engine\?\.ready\(\)/g)||[]).length===1);
check('already-failed images terminate scene settle instead of waiting for a lost event',
  coordinator.includes('if (img.complete)') &&
  coordinator.includes("if (!(img.naturalWidth > 0)) throw assetError()") &&
  coordinator.includes('settleFromCurrentState()'));
check('source collapse matches Gold standalone',
  css.includes('transform:scale(.54)!important') &&
  css.includes('transform .48s cubic-bezier(.72,0,1,.55)') &&
  css.includes('opacity .34s cubic-bezier(.85,0,1,1) .06s'));
check('target reveal scale matches Gold standalone', coordinator.includes('(1.12 - 0.12 * p).toFixed(4)'));
check('responsive engine owns canvas resize', runtimeText.includes('window.addEventListener(\'resize\'') && runtimeText.includes('computeGeo'));
check('canvas DPR budget preserved', runtimeText.includes('3.2e6'));

// R51 route policy (owner law 2026-10-05): Home / Mode / Fighter Pick are
// screens of ONE Gold shell surface and already own their authored screen
// transitions, so the router must NEVER run a Door transaction. The Door is a
// SCENE authority: boot + the Lucky Draw bay.
check('screen router never runs a Mechanical Door transaction',
  !shell.includes("name:`${screen}->${next}`"));
for(const route of ["name:'home->lucky'","name:'lucky->home'"]){
  check(`Lucky Draw scene uses Mechanical Door: ${route}`, shell.includes(route));
}
check('Battle is excluded from Mechanical Door routes',
  !shell.includes("name:'fighter->battle'") &&
  !shell.includes("name:'battle->fighter'") &&
  shell.includes('Battle is NOT a Mechanical Door route'));
// R52 / N3 (owner law): the canonical Gold rail transition IS the battle-entry
// beat again. What must stay true is that it is ONE authority and that the Door
// never routes Battle (asserted by the checks around this one).
check('the canonical rail transition is the battle-entry beat, driven by the adapter',
  shell.includes('id="battleTransition"') && shell.includes('phase-clamp') && shell.includes('phase-handoff')
  && !shell.includes('transitionSound(') && !shell.includes('battleTransitionToken'));
check('active HUD/UI transition still serializes Escape/input', shell.includes('window.APEX_SCENE_TRANSITION?.active?.()'));
check('Battle lazy-load remains lock-in scoped without using the Door',
  shell.includes("APEX_GOLD.prepareSurface('battle',{heroIds})") &&
  shell.includes('Battle is NOT a Mechanical Door route') &&
  !shell.includes("name:'fighter->battle'"));
// R59 B2: Battle HUD is same-document. The iframe is donor-era markup and
// MUST NOT own handoff/readiness after the first unmount.
check('same-document Battle handoff is never gated by the retired iframe',
  shell.includes("if(!battleHudConfig||battleHudConfig.live===true||!window.APEX_GOLD_HUD)return;")
  && !shell.includes("if(!battleHudConfig||battleHudConfig.live===true||!battleHudFrame?.contentWindow)return;"));
check('Battle remount readiness uses the bridge callback, not iframe load',
  shell.includes("try{APEX_GOLD.mountBattleHud(decodeBattleHud(),ready)}")
  && !shell.includes('battleHudFrame.onload=ready;')
  && !shell.includes('battleHudFrame.onload=null;')
  && !shell.includes("if(!battleMode||!battleHudHost||!battleHudFrame||screen==='transition'||screen==='battle')return;"));
check('generator owns the remount-safe same-document lifecycle',
  build.includes("if(!battleHudConfig||battleHudConfig.live===true||!window.APEX_GOLD_HUD)return;")
  && !adapter.includes('battleHudFrame.onload=ready;')
  && !adapter.includes('battleHudFrame.onload=null;')
  && adapter.includes("if(!battleMode||!battleHudHost||screen==='transition'||screen==='battle')return;"));
check('Lucky READY verifies iframe document', shell.includes('frame.contentDocument') && shell.includes('doc?.documentElement'));
check('Fighter READY settles actual world stage', shell.includes('await tr?.prepareElement?.(surfaceRoot)') && shell.includes('await tr?.prepareElement?.(stage,{verifyImages:false})'));
check('Doorless steps verify the destination panel, then settle the stage',
  shell.includes("const surfaceRoot=next==='mode'?modeScreen:(next==='fighter'?fighterScreen:null);")
  && shell.includes('await tr?.prepareElement?.(surfaceRoot)')
  && shell.includes('await tr?.prepareElement?.(stage,{verifyImages:false})'));

check('activation is separate from preparation', bridge.includes('BRIDGE.prepareSurface = async function prepareSurface') && bridge.includes('BRIDGE.onSurface = function onSurface'));
check('Battle preparation awaits arsenalProduct', bridge.includes("ensureDeferredRuntimes('arsenalProduct').then"));
// R52: the battle surface is selected-hero scoped for BOTH the hero art and the
// arena rig (the rig is what makes a hero body render at all).
check('Battle asset set is selected-hero scoped',
  assets.includes("heroUrls(context.heroIds, ['battleAvatar', 'skillIcons'])")
  && /rigUrls\(context\.heroIds/.test(assets));
check('empty hero selection never expands to all', assets.includes("heroIds === null") && assets.includes("Array.isArray(heroIds) ? heroIds.filter(Boolean) : []"));

check('generator chains R50K shell adapter', build.includes("import { adaptGoldShellR50k }") && build.includes('adaptGoldShellR50k(out)'));
check('generator stages transition runtime', build.includes("outputs.set('transition/mechanical-door-v4.gold.js'"));
check('generator pins transition hash', build.includes('6d338906e477c13fa42cd6727be7c41bdd0c5b66e12fc140e3836c7858ce0dd2'));
check('adapter rejects duplicate shell seams', adapter.includes('duplicate shell seam') || adapter.includes('superseded/duplicate shell seam'));
check('no known duplicated shell seam remains',
  !shell.includes('function uiFocusMove(){  function uiFocusMove(){') &&
  !shell.includes("addEventListener('message',e=>{  addEventListener('message',e=>{") &&
  !shell.includes('window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell;  window.APEX_GOLD_SHELL_NAVIGATE=navigateGoldShell;') &&
  !shell.includes("openBtn?.addEventListener('click',e=>{  openBtn?.addEventListener('click',e=>{"));

console.log(['GOLD TRANSITION COORDINATOR GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
