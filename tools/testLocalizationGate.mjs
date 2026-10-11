import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {AWARD_RULE_TEMPLATES,englishAwardRule} from '../src/game/localeAwardRules.js';
import {COPY,PROPER_NAMES,translateCopy,VIETNAMESE_DIALOGUE_EN,VIETNAMESE_UI_EN} from '../src/game/localeCatalog.js';

assert.equal(translateCopy('FREE BATTLE','vie'),'ĐẤU TỰ DO');
for(const name of ['WEAPON DASH','VIRTUAL ARMOR','CONTEXT CONSTRUCT','AWAKENING','MIRROR ARSENAL','MIRROR EXCHANGE','ANCIENT CRYSTAL ENTITY','FIELD CONTROL UNIT','CRYO EDGE UNIT']) assert.notEqual(translateCopy(name,'vie'),name,'untranslated production fighter copy: '+name);
assert.equal(translateCopy('4.5S COOLDOWN','vie'),'4,5 GIÂY HỒI CHIÊU');
assert.equal(translateCopy('2 CHARGES · 4.5S RECHARGE','vie'),'2 LẦN DÙNG · 4,5 GIÂY NẠP LẠI');
assert.equal(translateCopy('1.0S ACTIVE · 11.0S CD','vie'),'1,0 GIÂY HIỆU LỰC · 11,0 GIÂY HỒI CHIÊU');

assert.equal(translateCopy('  LOCK IN  ','vie'),'  XÁC NHẬN  ');
assert.equal(translateCopy('SCRAP BASIN','vie'),'SCRAP BASIN');
assert.equal(translateCopy('NEWBOT','vie'),'NEWBOT');
assert.equal(translateCopy('T.O.T','vie'),'T.O.T');
assert.equal(translateCopy('6 FIGHTERS // ONE CONFLICT','vie'),'6 ĐẤU SĨ // MỘT TRẬN CHIẾN');
assert.equal(translateCopy('3 HITS','vie'),'3 ĐÒN TRÚNG');
assert.equal(translateCopy('Chúng ta là bạn à?','eng'),'Are we friends?');
assert.equal(translateCopy('Chúng ta là bạn à?','vie'),'Chúng ta là bạn à?');
assert.equal(translateCopy('FIRST WAKE','eng'),'FIRST WAKE');
assert.equal(translateCopy('Hồ sơ danh hiệu','eng'),'Achievements archive');
assert.equal(translateCopy('Nguồn sát thương','eng'),'Damage sources');
assert.equal(Object.keys(VIETNAMESE_DIALOGUE_EN).length,13);
const awards=JSON.parse(readFileSync(new URL('../result-gold/src/data/ownerDecisions.json',import.meta.url))).items;
assert.equal(awards.length,50);
assert.equal(AWARD_RULE_TEMPLATES.length,52);
for(const item of awards){const rendered=item.rule.replace(/\{([a-zA-Z0-9_-]+)\}/g,(_m,k)=>String(item.params.find(p=>p.key===k)?.value??0));const out=englishAwardRule(rendered);assert.ok(out,`Missing English condition rule for ${item.id}: ${rendered}`);assert.ok(!out.includes('{'),`Incomplete translation for ${item.id}`);}
assert.match(englishAwardRule('Gây ≥ 250 DMG thực tế trong cửa sổ 0,1 giây.'),/250/);
assert.match(englishAwardRule('Trong cùng một lần Attraction, kéo và nhặt các súng hợp lệ rồi gây tổng ≥ 200 DMG bằng TẤT CẢ những súng đó.'),/200/);
for(const a of awards){
 assert.ok(VIETNAMESE_UI_EN[a.name],`Missing translated achievement name: ${a.id} / ${a.name}`);
 for(const p of a.params){
  if(/[À-ỹ]/u.test(p.label))assert.ok(VIETNAMESE_UI_EN[p.label],`Missing English metric label: ${a.id} / ${p.label}`);
 }
}
for(const name of PROPER_NAMES)assert.equal(translateCopy(name,'vie'),name,'name must stay canonical');
for(const [en,vi] of Object.entries(COPY)){
  assert.ok(en.length&&vi.length);
  assert.equal(translateCopy(en,'vie'),vi,'missing phrase: '+en);
}
const dom=new JSDOM('<!doctype html><html><head></head><body><div id="gold-shell-host"><main id="stage"><button id="freeBattle" aria-label="Free Battle">FREE BATTLE</button><div id="text">NEWBOT</div></main></div></body></html>',{url:'https://game.example/',pretendToBeVisual:true});
globalThis.window=dom.window;
globalThis.document=dom.window.document;
globalThis.localStorage=dom.window.localStorage;
globalThis.MutationObserver=dom.window.MutationObserver;
const {installLocalization}=await import('../src/game/localizationRuntime.js');
installLocalization();
const settle=()=>new Promise(r=>setTimeout(r,0));
const label=()=>document.querySelector('#freeBattle').textContent;
assert.equal(label(),'FREE BATTLE');
const picker=document.querySelector('#apex-language-select');
assert.ok(picker,'HOME picker must mount');
assert.equal(picker.value,'eng');
picker.value='vie';picker.dispatchEvent(new window.Event('change',{bubbles:true}));
await settle();
assert.equal(label(),'ĐẤU TỰ DO');
assert.equal(document.querySelector('#freeBattle').getAttribute('aria-label'),'ĐẤU TỰ DO');
assert.equal(document.querySelector('#text').textContent,'NEWBOT');
assert.equal(localStorage.getItem('apex-chaos.ui-language.v1'),'vie');
assert.equal(document.documentElement.lang,'vi');
const changing=document.createElement('span');changing.textContent='LOCK IN';
document.querySelector('#stage').append(changing);
await settle();
assert.equal(changing.textContent,'XÁC NHẬN','dynamic UI text must translate');
changing.textContent='BOTH FIGHTERS LOCKED';
await settle();
assert.equal(changing.textContent,'CẢ HAI ĐÃ KHÓA CHỌN','in-place mutations must translate');
picker.value='eng';picker.dispatchEvent(new window.Event('change',{bubbles:true}));
await settle();
assert.equal(label(),'FREE BATTLE','English restoration must use original copy');
assert.equal(changing.textContent,'BOTH FIGHTERS LOCKED','English restoration must be lossless');
assert.equal(document.querySelector('#freeBattle').getAttribute('aria-label'),'Free Battle');
console.log('i18n VIE/ENG contract: PASS ('+Object.keys(COPY).length+' curated phrases, '+PROPER_NAMES.length+' proper names, '+Object.keys(VIETNAMESE_DIALOGUE_EN).length+' dialogue lines)');
