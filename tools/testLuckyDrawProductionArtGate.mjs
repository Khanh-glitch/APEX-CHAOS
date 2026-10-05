import fs from 'node:fs';

const lucky=fs.readFileSync('public/gold/lucky-draw.html','utf8');
const shell=fs.readFileSync('public/gold/shell.html','utf8');
const bridge=fs.readFileSync('public/game/gold/goldProductBridge.js','utf8');
const build=fs.readFileSync('tools/buildGoldCutover.mjs','utf8');
const meta=fs.readFileSync('public/game/arsenal/arsenalMetaRuntime.js','utf8');
const failures=[];const passes=[];
function check(name,cond){(cond?passes:failures).push((cond?'PASS ':'FAIL ')+name);}

check('shipping Lucky has no placeholder art text', !lucky.includes('LUCKY DRAW ART PLACEHOLDER'));
check('generator has no placeholder art generator', !build.includes('LUCKY DRAW ART PLACEHOLDER'));
check('Lucky presentation derives from Gold roster', bridge.includes('BRIDGE0.luckyRoster = function goldLuckyRoster') && bridge.includes('return BRIDGE0.roster()'));
check('Lucky roster filters product playability not ownership', bridge.includes(".filter((hero) => hero && hero.playable !== false)") && !bridge.includes('luckyRoster = function goldLuckyRoster() {\n      return BRIDGE0.roster()\n        .filter((hero) => hero && hero.owned'));
check('shell passes registry snapshot before sync', shell.indexOf('w.APEX_GOLD_LUCKY_ROSTER=window.APEX_GOLD.luckyRoster()') < shell.indexOf("if(typeof w.APEX_LUCKY_SYNC==='function')w.APEX_LUCKY_SYNC()"));
check('runtime roster can grow without Lucky switch cases', lucky.includes('FIGHTERS.splice(0,FIGHTERS.length,...next)') && lucky.includes('roster.map(h => ({'));
check('real production art drives Lucky roster', lucky.includes('urlBase:String(h.drawArt)') && bridge.includes('drawArt: (art && art.art) || (art && art.portrait)'));
check('first frame fallback is real Git hero art', lucky.includes('/assets/gold-ui/heroes/newbot/pick_selected_large.webp') && lucky.includes('/assets/gold-ui/heroes/frost/pick_selected_large.webp'));
check('Mirror uses real roster art fallback instead of fabrication', lucky.includes('/assets/gold-ui/heroes/mirror/pick_roster_cover.webp'));
check('reel keeps authored diagonal stripe treatment', lucky.includes('for (let x = -H; x < w; x += 8)'));
check('reel fighter is black silhouette', lucky.includes("g.filter='brightness(0) saturate(0)'") && lucky.includes('g.drawImage(F.imgBase, dx, dy, dw, dh)'));
check('reveal uses same production art URL', lucky.includes('src="${F.urlBase}"') && lucky.includes('setHeroContent(newS, w)'));
check('production ID remains economy key', lucky.includes('if (FIGHTERS[i].id === id) return i') && meta.includes('return { ok: true, name: pick'));
check('empty locked pool stays empty', lucky.includes('if (Array.isArray(pool)) return pool.map'));
check('pool count reflects currently drawable locked pool', lucky.includes('pc.textContent = pad2(pool.length)'));
check('draw preflights presentation before AC spend', lucky.indexOf('drawPool.some(id => productionFighterIndex(id) < 0)') < lucky.indexOf('const res = meta.spin()'));
check('economy still owns draw result and debit', lucky.includes('const res = meta.spin()') && meta.includes('state.credits -= DRAW_COST'));
check('generator mirrors registry and silhouette laws', build.includes("id: 'LKY-R50I-1'") && build.includes("id: 'LKY-R50I-2'"));

console.log(['LUCKY DRAW PRODUCTION ART GATE',...passes].join('\n'));
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log('RESULT: PASS ('+passes.length+' checks)');
