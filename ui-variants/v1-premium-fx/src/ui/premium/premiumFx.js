// APEX PREMIUM FX — presentation-only interaction polish, installed once.
//  • click shockwave on any pointer-affordance element (never on the arena canvas)
//  • premium scrollbar / selection / focus language pushed into same-origin
//    iframes (Lucky Draw, Result Gold, Mission/Account) so the whole product
//    shares one feel, including surfaces the repo keeps hash-locked.
// It reads no game state and writes no game state.

const FRAME_CSS = `
:root{color-scheme:dark}
::selection{background:rgba(255,178,56,.38);color:#fff}
html{scrollbar-color:rgba(255,178,56,.55) rgba(8,10,14,.9);scrollbar-width:thin}
*::-webkit-scrollbar{width:9px;height:9px}
*::-webkit-scrollbar-track{background:rgba(8,10,14,.9)}
*::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#ffc24a,#c9700a);border:2px solid rgba(8,10,14,.9);border-radius:6px}
*::-webkit-scrollbar-corner{background:transparent}
:where(button,[role=button],a,input,select,textarea,[tabindex]):focus-visible{outline:2px solid #ffc24a;outline-offset:3px;box-shadow:0 0 0 5px rgba(255,194,74,.16),0 0 22px rgba(255,178,56,.35)}
.apx-shock{position:fixed;z-index:2147483300;pointer-events:none;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;border:2px solid rgba(255,198,90,.95);box-shadow:0 0 18px rgba(255,170,40,.55),inset 0 0 8px rgba(255,210,120,.5);animation:apx-shock .52s cubic-bezier(.16,.9,.24,1) forwards}
.apx-shock::after{content:"";position:absolute;inset:-2px;border-radius:50%;background:radial-gradient(circle,rgba(255,214,130,.45),transparent 62%)}
@keyframes apx-shock{0%{transform:scale(.3);opacity:1}100%{transform:scale(5.2);opacity:0}}
@media (prefers-reduced-motion:reduce){.apx-shock{display:none}}
`;

// Typography authority for hash-locked Gold sub-apps: Mission/Account declares
// Chakra Petch / Barlow families that are not shipped, so players saw a system
// sans fallback. Alias those names onto the SHIPPED Oswald files (the same single
// typeface the shell already uses) with a Vietnamese fallback face.
const ALIAS_FAMILIES = ['Chakra Petch', 'Barlow Condensed', 'Barlow', 'Be Vietnam Pro'];
const VI_RANGE = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
function fontUrl(path) {
  try { if (typeof window.APEX_APP_URL === 'function') return window.APEX_APP_URL(path); } catch { /* fall through */ }
  return path;
}
function buildFontAliasCss() {
  const out = [];
  for (const family of ALIAS_FAMILIES) {
    for (const w of [400, 500, 600, 700]) {
      out.push(`@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${fontUrl(`/gold/fonts/oswald-latin-${w}-normal.woff2`)}) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215}`);
    }
    // identical weight keys → Chrome merges latin + vietnamese into ONE segmented face
    for (const w of [400, 500, 600, 700]) {
      out.push(`@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${fontUrl('/gold/fonts/apex-oswald-vietnamese.ttf')}) format("truetype");unicode-range:${VI_RANGE}}`);
    }
  }
  return out.join('\n');
}

const INTERACTIVE = 'button,[role="button"],a[href],summary,select,label[for],[data-apx-shock]';
const marked = new WeakSet();

function isReducedMotion() {
  try {
    if (document.documentElement?.dataset?.apexMotion === 'reduced') return true;
    if (window.APEX_SETTINGS?.get?.()?.reducedMotion) return true;
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch { return false; }
}

function shockAt(doc, x, y) {
  try {
    if (isReducedMotion()) return;
    const node = doc.createElement('i');
    node.className = 'apx-shock';
    node.setAttribute('aria-hidden', 'true');
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    (doc.body || doc.documentElement).appendChild(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
    window.setTimeout(() => node.remove(), 900);
  } catch { /* purely cosmetic */ }
}

function isPressable(doc, target) {
  if (!target || target.nodeType !== 1) return false;
  const tag = target.tagName;
  if (tag === 'CANVAS' || tag === 'HTML' || tag === 'BODY') return false;
  if (target.closest?.('[disabled],[aria-disabled="true"],.apx-shock')) return false;
  if (target.closest?.(INTERACTIVE)) return true;
  try {
    const view = doc.defaultView || window;
    return view.getComputedStyle(target).cursor === 'pointer';
  } catch { return false; }
}

function wireDocument(doc, { injectCss }) {
  if (!doc || marked.has(doc)) return;
  marked.add(doc);
  if (injectCss && !doc.getElementById('apx-frame-premium')) {
    const style = doc.createElement('style');
    style.id = 'apx-frame-premium';
    style.textContent = FRAME_CSS + '\n' + buildFontAliasCss();
    (doc.head || doc.documentElement).appendChild(style);
  }
  doc.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    if (isPressable(doc, event.target)) shockAt(doc, event.clientX, event.clientY);
  }, { passive: true, capture: true });
}

function wireFrame(frame) {
  const attempt = () => {
    try {
      const doc = frame.contentDocument;
      if (doc && doc.documentElement && doc.readyState !== 'uninitialized') {
        // a navigated frame gets a fresh document → WeakSet naturally re-wires
        wireDocument(doc, { injectCss: true });
      }
    } catch { /* cross-origin frame: leave untouched */ }
  };
  frame.addEventListener('load', attempt);
  attempt();
}

// Cinematic grade for live battles: soft edge vignette + faint scanlines.
// Pointer-transparent and below every toast; follows #battleHudHost.is-open.
function installBattleGrade() {
  const grade = document.createElement('div');
  grade.className = 'apx-battle-grade';
  grade.setAttribute('aria-hidden', 'true');
  document.body.appendChild(grade);
  const sync = () => {
    const host = document.getElementById('battleHudHost');
    grade.classList.toggle('is-on', !!host && host.classList.contains('is-open'));
  };
  const mo = new MutationObserver(sync);
  const attach = () => {
    const host = document.getElementById('battleHudHost');
    if (host) { mo.observe(host, { attributes: true, attributeFilter: ['class'] }); sync(); return true; }
    return false;
  };
  if (!attach()) {
    const wait = window.setInterval(() => { if (attach()) window.clearInterval(wait); }, 700);
  }
}

export function installPremiumFx() {
  if (typeof window === 'undefined' || window.__apexPremiumFx) return;
  window.__apexPremiumFx = true;
  wireDocument(document, { injectCss: false });
  if (document.body) installBattleGrade(); else window.addEventListener('DOMContentLoaded', installBattleGrade, { once: true });

  const seen = new WeakSet();
  const scan = (root) => {
    root.querySelectorAll?.('iframe').forEach((frame) => {
      if (seen.has(frame)) return;
      seen.add(frame);
      wireFrame(frame);
    });
  };
  scan(document);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IFRAME') { if (!seen.has(node)) { seen.add(node); wireFrame(node); } }
        else scan(node);
      });
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // frames that navigate in place (srcdoc swaps) are re-wired on a slow beat
  window.setInterval(() => {
    if (document.hidden) return;
    document.querySelectorAll('iframe').forEach((frame) => {
      try { if (frame.contentDocument && !marked.has(frame.contentDocument)) wireDocument(frame.contentDocument, { injectCss: true }); } catch { /* ignore */ }
    });
  }, 1500);
}
