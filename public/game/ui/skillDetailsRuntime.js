// A1.5 — Symmetrical P1/P2 SKILL DETAILS for Fighter Select.
//
// ONE component, ONE data path, BOTH sides. Each fighter side (#p1Side /
// #p2Side in the Gold shell) gets an identical SKILL DETAILS control inside
// its identity block. The currently presented fighter is read from the
// shell's own render state (`side.dataset.hero`, written by renderSide) and
// resolved through the single bridge projection
// APEX_GOLD.skillDetailsFor() → heroRegistry. There is no P1 table and no
// P2 table, no second selection state machine, and inspecting skills can
// never select, lock or launch a fighter: the modal swallows background
// input while open and the buttons stop propagation.
(function apexSkillDetailsRuntime() {
  if (window.apexSkillDetailsRuntime === 'ready') return;

  const SIDES = [
    { side: 'p1', sideId: 'p1Side', skillsId: 'p1Skills', flagId: 'p1Flag', label: 'P1' },
    { side: 'p2', sideId: 'p2Side', skillsId: 'p2Skills', flagId: 'p2Flag', label: 'P2' },
  ];

  const CSS = `
    /* The Gold fighter sides are pointer-events:none stages; interactive
       children must explicitly opt back in (same law as the roster cards). */
    .apex-skill-details-btn{pointer-events:auto;display:inline-flex;align-items:center;gap:7px;margin-top:9px;min-height:34px;
      padding:6px 12px;border:1px solid color-mix(in srgb,var(--heroAccent,#d7bd72) 55%,rgba(238,231,219,.14));
      background:linear-gradient(180deg,rgba(22,24,28,.88),rgba(9,10,13,.9));color:#f2e9d5;cursor:pointer;
      font:800 10px/1 "ApcKanit","Segoe UI",sans-serif;letter-spacing:.16em;text-transform:uppercase;
      clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);
      touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    .apex-skill-details-btn::before{content:"";width:7px;height:7px;flex:0 0 auto;background:var(--heroAccent,#d7bd72);
      clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
    .fighterSide.p2 .apex-skill-details-btn{margin-left:auto}
    @media(hover:hover){.apex-skill-details-btn:hover{filter:brightness(1.18)}}
    .apex-skill-details-btn:active{transform:scale(.98)}
    .apex-skill-details-btn:focus-visible{outline:2px solid #f0d67e;outline-offset:2px}
    .apex-skill-details-btn[hidden]{display:none}
    #apex-skill-details{position:fixed;inset:0;z-index:2147481000;display:none;place-items:center;padding:14px;text-align:left;
      background:rgba(3,4,6,.72);backdrop-filter:blur(3px);font-family:"ApcKanit","Segoe UI",sans-serif;color:#f4f0e6}
    #apex-skill-details.is-open{display:grid}
    .apex-sd-panel{width:min(580px,calc(100vw - 20px));max-height:min(88dvh,760px);overflow:auto;overscroll-behavior:contain;
      border:1px solid color-mix(in srgb,var(--sd-accent,#d7bd72) 46%,#3a424c);
      background:linear-gradient(180deg,#141a21,#0a0e13 78%);box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px rgba(255,255,255,.04);
      clip-path:polygon(16px 0,100% 0,100% calc(100% - 16px),calc(100% - 16px) 100%,0 100%,0 16px)}
    .apex-sd-head{position:relative;display:flex;gap:16px;align-items:center;padding:18px 20px 14px;border-bottom:1px solid rgba(238,231,219,.1)}
    .apex-sd-head::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--sd-accent,#d7bd72)}
    .apex-sd-portrait{width:72px;height:72px;flex:0 0 auto;object-fit:contain;object-position:center bottom;
      border:1px solid color-mix(in srgb,var(--sd-accent,#d7bd72) 40%,#39424c);background:#0d1217}
    .apex-sd-kicker{color:var(--sd-accent,#d7bd72);font:800 9px/1 ui-monospace,monospace;letter-spacing:.22em}
    .apex-sd-name{margin:5px 0 0;font-size:clamp(24px,5vw,34px);line-height:.92;font-style:italic;font-weight:900}
    .apex-sd-tag{margin-top:5px;color:#9aa6b1;font:800 9px/1.3 ui-monospace,monospace;letter-spacing:.18em}
    .apex-sd-close{margin-left:auto;align-self:flex-start;min-width:44px;min-height:44px;display:grid;place-items:center;
      border:1px solid #4a5057;background:linear-gradient(180deg,#2b3138,#151a20);color:#f4f0e6;cursor:pointer;
      font:900 15px/1 sans-serif;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
    @media(hover:hover){.apex-sd-close:hover{filter:brightness(1.16)}}
    .apex-sd-close:focus-visible{outline:2px solid #f0d67e;outline-offset:2px}
    .apex-sd-body{padding:14px 20px 20px;display:grid;gap:10px}
    .apex-sd-skill{display:grid;grid-template-columns:52px minmax(0,1fr);gap:13px;padding:13px 14px;
      border:1px solid #2e3741;background:linear-gradient(180deg,#12181f,#0b0f14)}
    .apex-sd-icon{width:52px;height:52px;object-fit:cover;border:1px solid color-mix(in srgb,var(--sd-accent,#d7bd72) 38%,#39424c);background:#0d1217}
    .apex-sd-icon.is-empty{display:grid;place-items:center;color:var(--sd-accent,#d7bd72);font:900 15px/1 "ApcKanit",sans-serif;font-style:italic}
    .apex-sd-slot{color:var(--sd-accent,#d7bd72);font:800 8.5px/1 ui-monospace,monospace;letter-spacing:.2em}
    .apex-sd-skillname{margin:4px 0 0;font-size:17px;line-height:1.05;font-style:italic;font-weight:900}
    .apex-sd-meta{margin-top:5px;color:#d9c57f;font:800 9.5px/1.3 ui-monospace,monospace;letter-spacing:.1em}
    .apex-sd-desc{margin:7px 0 0;color:#c3ccd4;font:600 13px/1.5 "Segoe UI",sans-serif}
    .apex-sd-desc.is-none{color:#7d8894;font-style:italic}
    .apex-sd-state{padding:0 20px 16px;color:#8e99a4;font:800 9px/1.4 ui-monospace,monospace;letter-spacing:.16em}
    @media(max-width:560px){
      .apex-sd-head{padding:14px 14px 11px;gap:11px}
      .apex-sd-portrait{width:54px;height:54px}
      .apex-sd-body{padding:11px 12px 14px}
      .apex-sd-skill{grid-template-columns:44px minmax(0,1fr);gap:10px;padding:11px}
      .apex-sd-icon{width:44px;height:44px}
      .apex-sd-desc{font-size:12.5px}
      .apex-sd-state{padding:0 14px 12px}
    }
  `;

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[ch]));
  const tr = (v) => {
    try {
      const i18n = window.APEX_I18N;
      return i18n && typeof i18n.translate === 'function' ? i18n.translate(v) : v;
    } catch (e) { return v; }
  };

  let overlay = null;
  let openSide = null;
  let lastInvoker = null;

  function sideConfig(side) { return SIDES.find((s) => s.side === side) || null; }
  function sideNode(side) {
    const cfg = sideConfig(side);
    return cfg ? document.getElementById(cfg.sideId) : null;
  }
  // The fighter CURRENTLY PRESENTED on a side, from the shell's render state.
  // The P2-empty law (Local, before P1 locks) presents no fighter: the shell
  // empties #p2Skills and flags the stage, so both are honoured here instead
  // of trusting a stale dataset value.
  function presentedHeroKey(side) {
    const cfg = sideConfig(side);
    const node = sideNode(side);
    if (!cfg || !node) return '';
    const stage = document.getElementById('stage');
    if (side === 'p2' && stage && stage.classList.contains('fighter-p2-empty')) return '';
    const rows = document.getElementById(cfg.skillsId);
    if (rows && !rows.children.length) return '';
    return String(node.dataset.hero || '');
  }
  function sideLabel(side) {
    const cfg = sideConfig(side);
    const flag = cfg ? document.getElementById(cfg.flagId) : null;
    const text = flag ? String(flag.textContent || '').trim() : '';
    return text || (cfg ? cfg.label : side.toUpperCase());
  }
  function detailsFor(side) {
    const key = presentedHeroKey(side);
    if (!key) return null;
    const bridge = window.APEX_GOLD;
    if (!bridge || typeof bridge.skillDetailsFor !== 'function') return null;
    try { return bridge.skillDetailsFor(key); } catch (e) { return null; }
  }

  function ensureOverlay() {
    if (overlay && overlay.isConnected) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'apex-skill-details';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="apex-sd-panel" role="document"></div>';
    // Backdrop interaction never reaches the shell behind, while clicks on
    // the panel's own controls must still land: swallow in the bubble phase
    // at the overlay (after children handled the event), not in capture.
    overlay.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target === overlay) close();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function render() {
    if (!openSide) return false;
    const data = detailsFor(openSide);
    const root = ensureOverlay();
    const panel = root.querySelector('.apex-sd-panel');
    if (!data) { close(); return false; }
    panel.style.setProperty('--sd-accent', data.accent || '#d7bd72');
    const slotLabels = { PASSIVE: 'PASSIVE', A1: 'ABILITY 1', A2: 'ABILITY 2' };
    const skillsHtml = data.skills.map((s) => `
      <article class="apex-sd-skill" data-slot="${esc(s.slot)}">
        ${s.icon
          ? `<img class="apex-sd-icon" src="${esc(s.icon)}" alt=""/>`
          : `<span class="apex-sd-icon is-empty" aria-hidden="true">${esc(s.slot === 'PASSIVE' ? 'P' : s.slot)}</span>`}
        <div>
          <div class="apex-sd-slot">${esc(tr(slotLabels[s.slot] || s.slot))}</div>
          <h3 class="apex-sd-skillname">${esc(tr(s.name))}</h3>
          <div class="apex-sd-meta">${esc(tr(s.meta || ''))}</div>
          ${s.desc
            ? `<p class="apex-sd-desc">${esc(tr(s.desc))}</p>`
            : `<p class="apex-sd-desc is-none">${esc(tr('LOCKED'))}</p>`}
        </div>
      </article>`).join('');
    panel.innerHTML = `
      <header class="apex-sd-head">
        ${data.portrait ? `<img class="apex-sd-portrait" src="${esc(data.portrait)}" alt=""/>` : ''}
        <div>
          <div class="apex-sd-kicker">${esc(sideLabel(openSide))} · ${esc(tr('SKILL DETAILS'))}</div>
          <h2 class="apex-sd-name" id="apex-sd-title">${esc(data.name)}</h2>
          <div class="apex-sd-tag">${esc(tr(data.tag || ''))}</div>
        </div>
        <button type="button" class="apex-sd-close" data-sd-close aria-label="${esc(tr('CLOSE'))}">✕</button>
      </header>
      <div class="apex-sd-body">${skillsHtml}</div>
      <div class="apex-sd-state">${data.playable ? (data.owned ? esc(tr('OWNED')) : esc(tr('LOCKED'))) : esc(tr('LOCKED'))}</div>`;
    root.setAttribute('aria-labelledby', 'apex-sd-title');
    const closeBtn = panel.querySelector('[data-sd-close]');
    if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    return true;
  }

  function onCaptureKeydown(e) {
    if (!openSide) return;
    // While the panel is open the background Fighter Select must not act on
    // ANY key — including keys whose target is inside the panel, because the
    // shell's global handler treats Enter as LOCK IN regardless of focus.
    // Everything is swallowed in the capture phase; the panel's own controls
    // are driven manually here.
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    if (e.key === 'Escape') { close(); return; }
    const root = overlay;
    const closeBtn = root && root.querySelector('[data-sd-close]');
    if (e.key === 'Tab') {
      // Minimal focus trap: the close control is the panel's one action.
      if (closeBtn) closeBtn.focus();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && closeBtn && e.target === closeBtn) close();
  }

  function open(side, invoker) {
    if (!sideConfig(side)) return false;
    if (!presentedHeroKey(side)) return false;
    openSide = side;
    lastInvoker = invoker || document.querySelector(`.apex-skill-details-btn[data-side="${side}"]`);
    const root = ensureOverlay();
    if (!render()) { openSide = null; return false; }
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    window.addEventListener('keydown', onCaptureKeydown, true);
    window.addEventListener('keyup', onCaptureKeydown, true);
    const closeBtn = root.querySelector('[data-sd-close]');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
    return true;
  }

  function close() {
    if (!openSide && !(overlay && overlay.classList.contains('is-open'))) return;
    openSide = null;
    if (overlay) {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
    }
    window.removeEventListener('keydown', onCaptureKeydown, true);
    window.removeEventListener('keyup', onCaptureKeydown, true);
    if (lastInvoker && lastInvoker.isConnected) lastInvoker.focus({ preventScroll: true });
    lastInvoker = null;
  }

  function refreshButtons() {
    for (const cfg of SIDES) {
      const btn = document.querySelector(`.apex-skill-details-btn[data-side="${cfg.side}"]`);
      if (!btn) continue;
      btn.hidden = !presentedHeroKey(cfg.side);
      btn.querySelector('span').textContent = tr('SKILL DETAILS');
      btn.setAttribute('aria-label', `${sideLabel(cfg.side)} — ${tr('SKILL DETAILS')}`);
    }
  }

  function installButton(cfg) {
    const node = sideNode(cfg.side);
    if (!node) return false;
    const identity = node.querySelector('.fighterIdentity');
    if (!identity) return false;
    if (identity.querySelector(`.apex-skill-details-btn[data-side="${cfg.side}"]`)) return true;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'apex-skill-details-btn';
    btn.dataset.side = cfg.side;
    btn.innerHTML = '<span>SKILL DETAILS</span>';
    // Inspecting is not selecting: never let the event reach shell handlers.
    btn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);
    btn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (openSide === cfg.side) close(); else open(cfg.side, btn);
    }, true);
    identity.appendChild(btn);
    return true;
  }

  function ensureInstalled() {
    if (!document.getElementById('apex-skill-details-css')) {
      const style = document.createElement('style');
      style.id = 'apex-skill-details-css';
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    let all = true;
    for (const cfg of SIDES) if (!installButton(cfg)) all = false;
    if (all) refreshButtons();
    return all;
  }

  function watch() {
    // Fighter changes re-render an open panel (never stale data) and refresh
    // button availability/labels. dataset.hero is the shell's render truth.
    const observer = new MutationObserver((records) => {
      let heroChanged = false;
      for (const r of records) {
        if (r.type === 'attributes' && (r.attributeName === 'data-hero' || r.attributeName === 'class' || r.attributeName === 'lang')) heroChanged = true;
        if (r.type === 'childList') heroChanged = true;
      }
      if (!heroChanged) return;
      ensureInstalled();
      refreshButtons();
      if (openSide) {
        if (!presentedHeroKey(openSide)) close();
        else render();
      }
    });
    const start = () => {
      for (const cfg of SIDES) {
        const node = sideNode(cfg.side);
        if (node) observer.observe(node, { attributes: true, attributeFilter: ['data-hero', 'class'] });
        const rows = document.getElementById(cfg.skillsId);
        if (rows) observer.observe(rows, { childList: true });
      }
      const stage = document.getElementById('stage');
      if (stage) observer.observe(stage, { attributes: true, attributeFilter: ['class'] });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    };
    if (ensureInstalled()) start();
    else {
      // Shell DOM not mounted yet (deferred runtimes may win the race):
      // poll briefly through the observer on body until both sides exist.
      const bodyObserver = new MutationObserver(() => {
        if (ensureInstalled()) { bodyObserver.disconnect(); start(); }
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
      window.setTimeout(() => bodyObserver.disconnect(), 30000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watch, { once: true });
  } else watch();

  window.APEX_SKILL_DETAILS = Object.freeze({
    open: (side) => open(side, null),
    close,
    isOpen: () => !!openSide,
    currentSide: () => openSide,
    presentedHeroKey,
    detailsFor,
  });
  window.apexSkillDetailsRuntime = 'ready';
})();
