// Alpha DOM acceptance: home controls, accessibility, and same-fighter sides.
// Gold source content remains unchanged. This tests the adaptation against a
// minimal canonical DOM without requiring a live browser or user's storage.
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { installAlphaHomeUsability } from '../src/game/alphaHomeUsability.js';

const dom=new JSDOM(`<!doctype html><html><body>
<section id="gold-shell-host"><main id="stage" class="screen-home">
<section class="profile">
<button class="profileIdentity"><span class="profileText"><b>Guest</b></span></button>
<div class="ac" data-apex-ac>350 AC</div>
<button class="settings" aria-label="Settings">☼</button>
</section>
<nav class="routes">
<button data-locked-route="missions" class="route is-locked" aria-disabled="true">Missions</button>
<button data-locked-route="account-profile" class="route is-locked" aria-disabled="true">Account</button>
</nav>
<section class="fighterSide p1"><span id="p1Name">NEWBOT</span></section>
<section class="fighterSide p2"><span id="p2Name">NEWBOT</span></section>
<span id="fighterModeBadge">VS BOT</span>
</main></section></body></html>`,{url:'https://game.example/',pretendToBeVisual:true});
globalThis.window=dom.window;
globalThis.document=dom.window.document;
globalThis.MutationObserver=dom.window.MutationObserver;
const stage=document.querySelector('#stage');
let guideCount=0;
window.addEventListener('apex:guide-open',()=>guideCount++);
const cleanup=installAlphaHomeUsability();
assert.equal(document.querySelector('.profileIdentity'),null,'top duplicate Account removed');
assert.equal(document.querySelector('.profile .settings'),null,'non-functional gear removed');
assert.ok(document.querySelector('.profile .ac'),'genuine credits remain on top');
for(const type of ['account','progress']){
 const btn=document.querySelector(`[data-apex-${type}-entry]`);
 assert.ok(btn,`lower ${type} route enabled`);
 assert.equal(btn.hasAttribute('data-locked-route'),false);
 assert.equal(btn.getAttribute('aria-disabled'),null);
}
document.querySelector('.apex-guide-reopen').click();
assert.equal(guideCount,1,'help is actionable and replayable');
stage.classList.add('screen-fighter');
await new Promise(resolve=>setTimeout(resolve,0));
assert.ok(stage.classList.contains('apex-mirror-duel'),'same fighter has explicit side marker');
document.querySelector('#p2Name').textContent='HUNTER';
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(stage.classList.contains('apex-mirror-duel'),false,'different hero removes mirror marker');
cleanup();
assert.equal(document.querySelector('.apex-guide-reopen'),null,'cleanup removes guide button');
console.log('ALPHA HOME USABILITY DOM PASS — Account, Missions, ENG/VIE host preserved, mirror cues, help');
