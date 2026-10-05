import fs from 'node:fs';

const app=fs.readFileSync('src/App.jsx','utf8');
const battle=fs.readFileSync('public/game/core/apexBattleAudioRuntime.js','utf8');
const music=fs.readFileSync('public/game/product/productMusicAuthority.js','utf8');
const failures=[];const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}

check('App never rewinds product theme', !app.includes('currentTime = 0'));
check('legacy reset calls removed', !app.includes('stopMenuMusic(true)') && !app.includes('playMenuMusic(true)'));
check('menu stop routes through one authority', app.includes("authority && typeof authority.fadeOut === 'function'"));
check('menu play routes through one authority', app.includes("musicAuthority && typeof musicAuthority.request === 'function'"));
// R51: the battle audio session is owned by the PRODUCTION runtimes now (the
// Gold shell only drives the product surface). The law is unchanged — every
// begin/end must carry an explicit reason so apexAudioHealth()/
// battleAudioLastTransition can explain a silent session — but it is asserted
// on the real call sites instead of on the retired App wrapper names.
const engine = fs.readFileSync('public/apexEngine.js', 'utf8');
const modes = fs.readFileSync('public/game/modes/arsenalBattleRuntime.js', 'utf8');
const audioSurface = app + '\n' + battle + '\n' + engine + '\n' + modes;
const beginSites = [...audioSurface.matchAll(/apexBeginBattleAudioSession\s*\??\.?\s*\(([^)]*)\)/g)].map((m) => m[1].trim());
const endSites = [...audioSurface.matchAll(/apexEndBattleAudioSession\s*\??\.?\s*\(([^)]*)\)/g)].map((m) => m[1].trim());
const stopSites = [...engine.matchAll(/(?<!function )stopBattleAudio\(([^)]*)\)/g)].map((m) => m[1].trim());
check('battle begin carries reason at every production call site',
  beginSites.length >= 2 && beginSites.every((a) => /^['"`]/.test(a)));
check('battle end carries reason at every production call site',
  endSites.length >= 1 && endSites.every((a) => /^['"`]/.test(a))
  && stopSites.length >= 1 && stopSites.every((a) => /^['"`]/.test(a)));
check('battle runtime records lifecycle transition', battle.includes('battleAudioLastTransition') && battle.includes("kind: 'begin'") && battle.includes("kind: 'end'"));
check('battle probe exposes AudioContext state', battle.includes('contextState: audioCtx.state'));
check('battle probe exposes master and unlock state', battle.includes('unlockArmed: battleAudioUnlockArmed') && battle.includes('masterGain'));
check('battle probe exposes active/registered media', battle.includes('activeMediaElements: activeBattleMediaElements.size') && battle.includes('registeredMediaElements: battleMediaElements.size'));
check('single cross-audio health probe exists', battle.includes('window.apexAudioHealth = function apexAudioHealth()'));
check('health probe includes product music state', battle.includes('productMusicDiagnostics') && battle.includes('window.apexProductMusic.state'));
check('music diagnostics expose interruption reasons', music.includes('interruptedBy: [...interruptionReasons]'));
check('music diagnostics expose fade activity', music.includes('fadeActive: !!fadeFrame'));
check('music diagnostics expose last request reason', music.includes("lastRequestReason: ''") && music.includes("diag.lastRequestReason = String(reason || 'play')"));
check('hidden/blur lifecycle remains single-authority', music.includes("doc.addEventListener('visibilitychange', handleVisibility)") && music.includes("win.addEventListener('blur', handleBlur)") && music.includes("win.addEventListener('focus', handleFocus)"));
check('battle WebAudio still rearms after resume', battle.includes("audioCtx.addEventListener('statechange'") && battle.includes("if (!document.hidden && audioCtx.state !== 'running') armBattleAudioUnlock()"));

console.log(['AUDIO AUTHORITY GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
