import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {AWARD_RULE_TEMPLATES,englishAwardRule} from '../src/game/localeAwardRules.js';
import {COPY,PROPER_NAMES,translateCopy,VIETNAMESE_DIALOGUE_EN,VIETNAMESE_UI_EN} from '../src/game/localeCatalog.js';

assert.equal(translateCopy('FREE BATTLE','vie'),'ĐẤU TỰ DO');
for(const name of ['WEAPON DASH','VIRTUAL ARMOR','HEXA CONSTRUCT','AWAKENING','MIRROR ARSENAL','ATOMIC EXCHANGE',"PREDATOR'S LAW",'REFRACTION','MAGNETIC ACCELERATION','FROZEN BULLET','RECYCLE SNAP','MECHANICAL GENESIS','ANCIENT CRYSTAL ENTITY','FIELD CONTROL UNIT','CRYO EDGE UNIT']) assert.notEqual(translateCopy(name,'vie'),name,'untranslated production fighter copy: '+name);
assert.equal(translateCopy('4.5S COOLDOWN','vie'),'HỒI CHIÊU 4,5s');
assert.equal(translateCopy('2 CHARGES · 4.5S RECHARGE','vie'),'2 LẦN · NẠP 4,5s');
assert.equal(translateCopy('1.0S ACTIVE · 11.0S CD','vie'),'HIỆU LỰC 1,0s · HỒI 11,0s');

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

assert.equal(translateCopy('CHIẾN THẮNG','eng'),'VICTORY');
assert.equal(translateCopy('THẤT BẠI','eng'),'DEFEAT');
assert.equal(translateCopy('Xem chi tiết: Không Thể Trốn Thoát, Huyền Thoại','eng'),'View details: No Escape, Legendary');
assert.equal(translateCopy('Độ hiếm Hiếm','eng'),'Rarity Rare');
assert.equal(translateCopy('Đóng góp cao nhất: REDLINE_KAI','eng'),'Top contributor: REDLINE_KAI');
assert.equal(translateCopy('Player 1: REDLINE_KAI — chiến thắng','eng'),'Player 1: REDLINE_KAI — victory');
assert.equal(translateCopy('REDLINE_KAI gây 6,240 sát thương, chiếm 57%. NULL.SPECTRE gây 4,710 sát thương, chiếm 43%.','eng'),'REDLINE_KAI dealt 6,240 damage (57%). NULL.SPECTRE dealt 4,710 damage (43%).');
assert.equal(translateCopy('32 lần','eng'),'32 times');

assert.equal(translateCopy('Sát thương chuỗi: ≥ 500 DMG · Khoảng ngắt tối đa: ≤ 1,2 giây','eng'),'Chain damage: ≥ 500 DMG · Maximum gap: ≤ 1,2 seconds');
assert.equal(translateCopy('Sát thương chuỗi ≥ 500 DMG · Khoảng ngắt tối đa ≤ 1,2 giây','eng'),'Chain damage ≥ 500 DMG · Maximum gap ≤ 1,2 seconds');
assert.equal(translateCopy('10 danh hiệu của ROBOT. Bấm vào huy hiệu để xem chi tiết.','eng'),'10 achievements earned by ROBOT. Select a badge to view details.');
assert.equal(translateCopy('Danh hiệu của HUNTER','eng'),'Achievements earned by HUNTER');
assert.equal(translateCopy('có 3 lỗi','eng'),'3 issues found');
assert.equal(translateCopy('nhất quán · 7/7 kiểm tra','eng'),'consistent · 7/7 checks');
assert.equal(translateCopy('Đã đạt / Yêu cầu','eng'),'Earned / Required');

assert.equal(translateCopy('Đấu Tay Đôi · Xếp Hạng','eng'),'Ranked Duel');
assert.equal(translateCopy('Kỹ năng · Phá Cổng Nhiệt','eng'),'Skill · Thermal Breach');

assert.equal(translateCopy('Nguồn sát thương','eng'),'Damage sources');
assert.equal(Object.keys(VIETNAMESE_DIALOGUE_EN).length,13);
const fixtureSource=readFileSync(new URL('../result-gold/src/data/fixture.ts',import.meta.url),'utf8');
const expectedFixtureCopy=['Pháo Ray','Hạng nặng','Đường ray kép xuyên giáp','Hạng trung','Nòng kép cận chiến','Tiểu Liên','Hạng nhẹ','Nhịp bắn dồn dập','Súng Bắn Tỉa','Tầm xa, độ chính xác cao','Cơn mưa đạn','Súng Phóng','Đạn nổ hồ quang','Xung phong hạng nặng','Kỹ năng · Phá Cổng Nhiệt','Du kích tầm xa','Kỹ năng · Xung Tĩnh Điện','Đấu Tay Đôi · Xếp Hạng','Mùa 7'];
for(const label of expectedFixtureCopy){
 assert.ok(fixtureSource.includes(label),'fixture source changed: '+label);
 assert.notEqual(translateCopy(label,'eng'),label,'missing ENG fixture: '+label);
}

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

const canvas=document.createElement('canvas');canvas.id='game-canvas';
document.querySelector('#stage').appendChild(canvas);
const canvasDraws=[];
const context={
 font:'900 64px Impact, Bahnschrift, sans-serif',
 fillText(text,x,y){canvasDraws.push({method:'fillText',text,x,y,font:this.font});},
 strokeText(text,x,y){canvasDraws.push({method:'strokeText',text,x,y,font:this.font});}
};
const baseFill=context.fillText;
dom.window.HTMLCanvasElement.prototype.getContext=function(type){
 return type==='2d'&&this.id==='game-canvas'?context:null;
};

const {installLocalization}=await import('../src/game/localizationRuntime.js');
installLocalization();
const settle=()=>new Promise(r=>setTimeout(r,0));
const label=()=>document.querySelector('#freeBattle').textContent;
assert.equal(label(),'FREE BATTLE');
const vieBtn=document.querySelector('#apex-language-vie');
assert.ok(vieBtn,'HOME picker must mount');
assert.equal(document.querySelector('#apex-language-eng').getAttribute('aria-pressed'),'true','ENG starts pressed');
vieBtn.click();
assert.equal(vieBtn.getAttribute('aria-pressed'),'true','VIE pressed after click');
await settle();
assert.equal(label(),'ĐẤU TỰ DO');
assert.equal(document.querySelector('#freeBattle').getAttribute('aria-label'),'ĐẤU TỰ DO');
assert.equal(document.querySelector('#text').textContent,'NEWBOT');
assert.equal(localStorage.getItem('apex-chaos.ui-language.v1'),'vie');
assert.equal(document.documentElement.lang,'vi');

assert.equal(canvas.__apexCanvasLocaleInstalled,true,'only real game canvas has a draw-time adapter');
context.fillText('WAVE 02',500,455);
assert.equal(canvasDraws.at(-1).text,'ĐỢT 02');
assert.ok(canvasDraws.at(-1).font.includes('ApexVietCondensed'),'Vietnamese Canvas must use the bundled glyph-complete Gold face');
assert.equal(context.font,'900 64px Impact, Bahnschrift, sans-serif','original Gold font restored');
context.strokeText('FOUR CONTACTS INBOUND',500,491);
assert.equal(canvasDraws.at(-1).text,'BỐN KẺ ĐỊCH ĐANG ÁP SÁT');
context.fillText('SWARM  /  01—02',40,57);
assert.equal(canvasDraws.at(-1).text,'BẦY PHẾ LIỆU / 01—02');
context.fillText('LOCK STORMBREAKER · 200u',100,100);
assert.equal(canvasDraws.at(-1).text,'KHÓA STORMBREAKER · 200u');
context.fillText('NEWBOT',100,100);
assert.equal(canvasDraws.at(-1).text,'NEWBOT','names remain immutable on canvas');

const changing=document.createElement('span');changing.textContent='LOCK IN';
document.querySelector('#stage').append(changing);
await settle();
assert.equal(changing.textContent,'XÁC NHẬN','dynamic UI text must translate');
changing.textContent='BOTH FIGHTERS LOCKED';
await settle();
assert.equal(changing.textContent,'CẢ HAI ĐÃ KHÓA CHỌN','in-place mutations must translate');
document.querySelector('#apex-language-eng').click();
await settle();
assert.equal(label(),'FREE BATTLE','English restoration must use original copy');
context.fillText('WAVE 02',500,455);
assert.equal(canvasDraws.at(-1).text,'WAVE 02','English canvas output remains byte-identical');
assert.equal(context.fillText===baseFill,false,'only installed 2D context is decorated');

assert.equal(changing.textContent,'BOTH FIGHTERS LOCKED','English restoration must be lossless');
assert.equal(document.querySelector('#freeBattle').getAttribute('aria-label'),'Free Battle');
console.log('i18n VIE/ENG contract: PASS ('+Object.keys(COPY).length+' curated phrases, '+PROPER_NAMES.length+' proper names, '+Object.keys(VIETNAMESE_DIALOGUE_EN).length+' dialogue lines)');
