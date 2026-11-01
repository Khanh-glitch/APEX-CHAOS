import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const text = fs.readFileSync('src/game/ownerPlaytestCapture.js', 'utf8');
const meta = fs.readFileSync('public/game/arsenal/arsenalMetaRuntime.js', 'utf8');
const bridge = fs.readFileSync('public/game/gold/goldProductBridge.js', 'utf8');
const main = fs.readFileSync('src/main.jsx', 'utf8');
const config = fs.readFileSync('public/game/arsenal/arsenalConfig.js', 'utf8');
assert.match(main, /installOwnerPlaytestCapture\(window\)/, 'main installs F7/F8 capture before game runtimes');
assert.match(meta, /APEX_OWNER_TOOLS\?\.isPlaytestActive\?\.\(\)/, 'selection gate reads ephemeral owner state');
assert.match(meta, /function masteryTestActive\(\)/, 'test mode reward gate remains active');
assert.match(bridge, /apex:gold-result-ready/, 'real Gold result begins tail');
assert.match(bridge, /apex:owner-result-recorded/, 'continue waits for recording tail');
assert.match(config, /if \(window\.APEX_OWNER_TOOLS\) return/, 'old F8 handler delegates');
assert.match(text, /const TAIL_MS = 10000/);
assert.match(text, /const W = 1080, H = 1920/);
assert.match(text, /portraitFrameCrop/, 'real phone viewport is cropped from tab');
assert.match(text, /portraitStudio\(\)/, 'only active phone viewport can record');
assert.match(text, /navigator\.mediaDevices\.getDisplayMedia/, 'uses authentic browser tab capture');
assert.match(text, /document\.getElementById\('battleHudHost'\)/, 'requires real Gold HUD');
assert.match(text, /getSettings\?\.\(\)\.displaySurface/, 'rejects wrong capture surface');
assert.match(text, /window\.apexLaunchProductSurface\?\.\('bot-battle'\)/, 'canonical BOT product id');

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.org/' });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.CustomEvent = window.CustomEvent;
globalThis.Event = window.Event;
let opened = null;
window.apexLaunchProductSurface = async (id) => { opened = id; return true; };
window.APEX_ARSENAL_OWNER_TEST = { active: false, selectedWeaponId: 'PISTOL' };
const mod = await import('../src/game/ownerPlaytestCapture.js');
const authority = mod.installOwnerPlaytestCapture(window);
assert.equal(authority.isPlaytestActive(),false);
assert.equal(window.APEX_ARSENAL_OWNER_TEST.active,false);
window.dispatchEvent(new window.KeyboardEvent('keydown', { code:'F8', ctrlKey:true, shiftKey:true }));
const panel = document.getElementById('apex-owner-password-panel');
assert.ok(panel, 'F8 opens password modal');
const input = panel.querySelector('input[type=password]');
input.value = 'invalid';
panel.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles:true, cancelable:true }));
assert.equal(authority.isPlaytestActive(), false, 'invalid password denied');
input.value = '500509';
panel.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles:true, cancelable:true }));
await Promise.resolve(); await Promise.resolve();
assert.equal(authority.isPlaytestActive(),true);
assert.equal(opened,'bot-battle', 'correct password opens canonical BOT Fighter Pick');
assert.equal(window.APEX_ARSENAL_OWNER_TEST.active,true);
assert.equal(window.APEX_ARSENAL_OWNER_TEST.selectedWeaponId,null);
window.dispatchEvent(new window.KeyboardEvent('keydown', { code:'F8', ctrlKey:true, shiftKey:true }));
assert.equal(authority.isPlaytestActive(),false, 'second F8 disables owner playtest');
assert.equal(window.APEX_ARSENAL_OWNER_TEST.active,false);
assert.equal(authority.isRecording(),false);
// Regress the exact policy failure observed in the itch.io cross-origin embed:
// no display-capture prompt may be attempted when policy rejects the feature.
Object.defineProperty(document,'featurePolicy',{configurable:true,value:{
  allowsFeature(feature){ return feature !== 'display-capture'; }
}});
window.APEX_ARSENAL = { state: { active:true, battleMode:'BOT', over:null } };
const liveHud=document.createElement('div');
liveHud.id='battleHudHost';liveHud.classList.add('is-open');document.body.append(liveHud);
window.dispatchEvent(new window.KeyboardEvent('keydown',{
  code:'F7',key:'F7',ctrlKey:true,shiftKey:true
}));
assert.equal(authority.isCaptureBlockedByPolicy(),true);
const policyPanel=document.getElementById('apex-owner-standalone-recording');
assert.ok(policyPanel,'blocked embedded F7 offers standalone rather than reporting raw policy exception');
assert.equal(policyPanel.querySelector('a').href,new URL('portrait-studio.html',window.location.href).href);
assert.equal(policyPanel.querySelector('a').target,'_blank');
assert.equal(authority.isRecording(),false);
assert.equal(authority.isPortraitStudio(),false,'desktop game never records its screen as the TikTok video');
const crop=mod.portraitFrameCrop(1920,1080,{left:500,top:20,width:432,height:768,viewportWidth:1440,viewportHeight:900});
assert.ok(Math.abs(crop.sx-500*1920/1440)<0.01);
assert.ok(Math.abs(crop.sw-432*1920/1440)<0.01);
assert.ok(Math.abs(crop.sy-20*1080/900)<0.01);
assert.ok(Math.abs(crop.sh-768*1080/900)<0.01);
const edgeAligned=mod.portraitFrameCrop(1440,900,{left:380,top:0,width:506.25,height:900,viewportWidth:1440,viewportHeight:900});
assert.equal(edgeAligned.sy,0,'full-height phone viewport starts at top edge without failing capture');
assert.throws(()=>mod.portraitFrameCrop(1920,1080,{left:0,top:20,width:768,height:432,viewportWidth:1440,viewportHeight:900}),/Khung/);
console.log('PASS owner shortcuts: F8 invalid/valid, BOT navigation, selection-session scope, second F8 off, Gold HUD recording contracts');
