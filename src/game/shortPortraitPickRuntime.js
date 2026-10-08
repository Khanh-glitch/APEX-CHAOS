import candidateCSS from './shortPortraitPick.css?raw';
import { solveShortPortraitPick } from './shortPortraitPickSolver.js';

// Opt-in R85 only. This authority is OFF for shipping/default URLs.
// It updates the same important inline coordinates written by Gold's
// applyWorldSlotGeometry, rather than adding another competing CSS rule.
const STYLE_ID = 'apex-r85-short-pick-solver';
const ROOT_SELECTOR = '#gold-shell-host #stage';
const HERO_KEYS = ['top', 'bottom', 'width', 'left', 'right'];
const DECK_KEYS = ['top', 'bottom'];
const VAR_KEYS = ['--r85DeckTop', '--r85LockReserve'];
const px = (value) => Number(value).toFixed(4) + 'px';

let enabled = new URLSearchParams(window.location.search).get('apexPickLab') === '1';
let stage = null;
let stageObserver = null;
let startObserver = null;
let viewportObserver = null;
let heroObserver = null;
let frameId = 0;
let active = false;
let saved = new Map();
let last = null;
const viewportEvents = ['resize', 'orientationchange'];

function setImportant(element, name, value) {
  if (!element) return;
  if (element.style.getPropertyValue(name) === value &&
      element.style.getPropertyPriority(name) === 'important') return;
  element.style.setProperty(name, value, 'important');
}
function remember(element, properties) {
  if (!element || saved.has(element)) return;
  saved.set(element, properties.map(name => ({
    name,
    value: element.style.getPropertyValue(name),
    priority: element.style.getPropertyPriority(name)
  })));
}
function restore() {
  if (!active) return;
  active = false;
  for (const [el, props] of saved) {
    if (!el.isConnected) continue;
    for (const {name, value, priority} of props) {
      if (value) el.style.setProperty(name, value, priority);
      else el.style.removeProperty(name);
    }
  }
  saved.clear();
  last = {active: false, reason: 'not a short portrait Fighter Pick'};
}
function solve() {
  frameId = 0;
  if (!enabled || !stage?.isConnected) { restore(); return; }
  const bounds = stage.getBoundingClientRect();
  const geom = stage.classList.contains('screen-fighter')
    ? solveShortPortraitPick({width:bounds.width, height:bounds.height})
    : null;
  const deck = stage.querySelector('.selectionDeckV6');
  const p1 = stage.querySelector('.worldHeroSlot.p1');
  const p2 = stage.querySelector('.worldHeroSlot.p2');
  const namePanel = stage.querySelector('.fighterIdentityZone.p1 .fighterIdentity');
  if (!geom || !deck || !p1 || !p2 || !namePanel) { restore(); return; }
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = candidateCSS;
    document.head.appendChild(style);
  }
  remember(stage, VAR_KEYS);
  remember(deck, DECK_KEYS);
  remember(p1, HERO_KEYS);
  remember(p2, HERO_KEYS);
  active = true;
  setImportant(stage, '--r85DeckTop', px(geom.deckTop));
  setImportant(stage, '--r85LockReserve', px(geom.lockReserve));
  setImportant(deck, 'top', px(geom.deckTop));
  setImportant(deck, 'bottom', px(geom.lockReserve));
  const infoHeight = namePanel.getBoundingClientRect().height;
  const heroBottom = geom.heroBottomForInfoHeight(infoHeight);
  for (const [el, player] of [[p1, 'p1'], [p2, 'p2']]) {
    setImportant(el, 'top', px(geom.heroTop));
    setImportant(el, 'bottom', px(heroBottom));
    setImportant(el, 'width', px(geom.heroWidth));
    setImportant(el, 'left', player === 'p1' ? px(geom.heroLeft) : 'auto');
    setImportant(el, 'right', player === 'p2' ? px(geom.heroLeft) : 'auto');
  }
  last = {active: true, ...geom, infoHeight, heroBottom};
}
function request() {
  if (!enabled || frameId) return;
  frameId = requestAnimationFrame(solve);
}
function attach() {
  if (!enabled) return;
  const found = document.querySelector(ROOT_SELECTOR);
  if (!found) {
    if (startObserver || !document.documentElement) return;
    startObserver = new MutationObserver(() => {
      if (document.querySelector(ROOT_SELECTOR)) {
        startObserver.disconnect();
        startObserver = null;
        attach();
      }
    });
    startObserver.observe(document.documentElement, {subtree: true, childList: true});
    return;
  }
  if (found === stage) { request(); return; }
  stage = found;
  stageObserver = new MutationObserver(request);
  stageObserver.observe(stage, {attributes: true, attributeFilter: ['class']});
  heroObserver = new MutationObserver(request);
  const p1 = stage.querySelector('.worldHeroSlot.p1');
  const p2 = stage.querySelector('.worldHeroSlot.p2');
  for (const el of [p1, p2]) {
    if (el) heroObserver.observe(el, {attributes: true, attributeFilter: ['style','data-hero']});
  }
  viewportObserver = new ResizeObserver(request);
  viewportObserver.observe(stage);
  for (const event of viewportEvents) window.addEventListener(event, request, {passive: true});
  window.visualViewport?.addEventListener('resize', request, {passive: true});
  request();
}
function disable() {
  enabled = false;
  if (frameId) cancelAnimationFrame(frameId);
  frameId = 0;
  restore();
  startObserver?.disconnect();
  stageObserver?.disconnect();
  heroObserver?.disconnect();
  viewportObserver?.disconnect();
  startObserver = stageObserver = heroObserver = viewportObserver = null;
  for (const event of viewportEvents) window.removeEventListener(event, request);
  window.visualViewport?.removeEventListener('resize', request);
  document.getElementById(STYLE_ID)?.remove();
  stage = null;
  return true;
}
function enable() { enabled = true; attach(); return true; }
window.__apexR85Pick = Object.freeze({
  enable, disable,
  snapshot: () => last ? {...last} : {active: false, enabled}
});
if (enabled) attach();
