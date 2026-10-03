// ARSENAL V3 meta: Hub / Shop / Lucky Draw / AC economy / owned roster.
(function apexArsenalMetaRuntime() {
  if (window.apexArsenalMetaRuntime === 'ready') return;
  const KEY = 'apexChaos.arsenalMeta.v1';
  const SHOP_COST = 1000;
  const DRAW_COST = 350;
  const START_CREDITS = 350;

  // The product graph is the authority for roster availability. The visible
  // twelve and the currently ACTIVE six are intentionally distinct: historic
  // ownership remains saved, but locked future fighters never become a public
  // selection, purchase, or draw result merely because an old save owns them.
  function product() { return window.APEX_PRODUCT_SURFACES || null; }
  function visibleRosterIds() {
    const P = product();
    if (P && P.visibleRosterIds) return P.visibleRosterIds();
    return (window.APEX_ARSENAL_SHELLS && window.APEX_ARSENAL_SHELLS.visibleIds) || ['ROBOT'];
  }
  function activeRosterIds() {
    const P = product();
    if (P && P.activeRosterIds) return P.activeRosterIds();
    return (window.APEX_ARSENAL_SHELLS && window.APEX_ARSENAL_SHELLS.ids) || ['ROBOT'];
  }
  function displayNameFor(id) {
    const P = product();
    return P && P.displayNameFor ? P.displayNameFor(id) : String(id || '').toUpperCase();
  }
  function canSelect(id) {
    const P = product();
    return P && P.canSelectFighter ? P.canSelectFighter(id) : activeRosterIds().includes(String(id || '').toUpperCase());
  }
  function canPurchase(id) {
    const P = product();
    return P && P.canPurchaseFighter ? P.canPurchaseFighter(id) : activeRosterIds().includes(String(id || '').toUpperCase());
  }
  function canDraw(id) {
    const P = product();
    return P && P.canDrawFighter ? P.canDrawFighter(id) : activeRosterIds().includes(String(id || '').toUpperCase());
  }
  function canonicalFighterId(id) {
    const P = product();
    return P && P.normalizeId ? P.normalizeId(id) : String(id == null ? '' : id).trim().toUpperCase();
  }

  // HERO REWORK (doc 06): ROBOT replaces legacy NEWBIE as the default-owned
  // playable hero. Migration is IDEMPOTENT: any persisted NEWBIE ownership/
  // selection/unlock maps to ROBOT exactly once and never rewrites a state
  // that has already migrated.
  function migrateNewbieToRobot(st) {
    if (!st) return st;
    if (Array.isArray(st.ownedFighters) && st.ownedFighters.includes('NEWBIE')) {
      st.ownedFighters = st.ownedFighters.filter((n) => n !== 'NEWBIE' && n !== 'ROBOT');
      st.ownedFighters.unshift('ROBOT');
    }
    if (!st.ownedFighters.includes('ROBOT')) st.ownedFighters.unshift('ROBOT');
    // Preserve ownership history, but current selections are an ACTIVE product
    // concern. A saved future/retired selection must never inject a locked
    // fighter into the picker or match; prefer ROBOT deterministically.
    if (st.lastSelectedP1 === 'NEWBIE' || !st.ownedFighters.includes(st.lastSelectedP1) || !canSelect(st.lastSelectedP1)) st.lastSelectedP1 = 'ROBOT';
    if (st.lastSelectedP2 === 'NEWBIE' || !st.ownedFighters.includes(st.lastSelectedP2) || !canSelect(st.lastSelectedP2)) st.lastSelectedP2 = 'ROBOT';
    if (st.unlockedAt) {
      if (st.unlockedAt.NEWBIE != null) {
        st.unlockedAt.ROBOT = st.unlockedAt.ROBOT != null
          ? Math.min(st.unlockedAt.ROBOT, st.unlockedAt.NEWBIE)
          : st.unlockedAt.NEWBIE;
        delete st.unlockedAt.NEWBIE;
      }
      if (st.unlockedAt.ROBOT == null) st.unlockedAt.ROBOT = 0;
    }
    return st;
  }

  function emptyState() {
    return {
      version: 1,
      credits: START_CREDITS,
      ownedFighters: ['ROBOT'],
      lastSelectedP1: 'ROBOT',
      lastSelectedP2: 'ROBOT',
      totalSpins: 0,
      unlockedAt: { ROBOT: 0 },
      // §D: Chamber-01 arena palette lives in THIS authority — no second
      // storage island. Null means the curated default.
      arenaPaletteId: null,
    };
  }
  function sanitize(raw) {
    const s = emptyState();
    if (!raw || typeof raw !== 'object') return s;
    s.credits = Math.max(0, raw.credits | 0);
    const owned = Array.isArray(raw.ownedFighters) ? raw.ownedFighters.map(canonicalFighterId).filter(Boolean) : [];
    s.ownedFighters = Array.from(new Set(['ROBOT', ...owned]));
    const savedP1 = canonicalFighterId(raw.lastSelectedP1);
    const savedP2 = canonicalFighterId(raw.lastSelectedP2);
    s.lastSelectedP1 = s.ownedFighters.includes(savedP1) ? savedP1 : 'ROBOT';
    s.lastSelectedP2 = s.ownedFighters.includes(savedP2) ? savedP2 : 'ROBOT';
    s.totalSpins = Math.max(0, raw.totalSpins | 0);
    s.unlockedAt = raw.unlockedAt && typeof raw.unlockedAt === 'object' ? { ...raw.unlockedAt } : { ROBOT: 0 };
    // AUDIT-E: state truth must match rendered truth — unknown/stale palette
    // ids sanitize to the canonical default representation (null => graphite-mid
    // in the palette runtime). Validated against the curated list when the
    // palette runtime is present; absent (partial boot) means default too.
    const P = window.APEX_CHAMBER_PALETTE;
    s.arenaPaletteId = (typeof raw.arenaPaletteId === 'string' && P && P.isKnown(raw.arenaPaletteId)) ? raw.arenaPaletteId : null;
    return migrateNewbieToRobot(s);
  }
  function load() {
    // No automatic owner-test credit migration: historic balances remain
    // untouched, while a brand-new profile starts at the unchanged 350 AC.
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
      return raw ? sanitize(JSON.parse(raw)) : emptyState();
    } catch (e) {
      return emptyState();
    }
  }
  function save(st) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {}
    state = st;
    return st;
  }
  let state = load();
  const lastAward = { reasons: [], amount: 0, balance: state.credits };

  // §D palette persistence (sanitized again by the palette runtime against
  // its curated list — unknown ids simply resolve to the default there).
  function palette() { return state.arenaPaletteId || null; }
  function setPalette(id) {
    const PR = window.APEX_CHAMBER_PALETTE;
    const v = id == null ? null : String(id);
    state.arenaPaletteId = (v && PR && PR.isKnown(v)) ? v : null;
    save(state);
    if (PR && PR.refreshSelector) PR.refreshSelector();
    return state.arenaPaletteId;
  }
  function getState() { return JSON.parse(JSON.stringify(state)); }
  function credits() { return state.credits; }
  function owns(name) { return state.ownedFighters.includes(canonicalFighterId(name)); }
  function poolLocked() {
    // Draw pool authority is below the wheel UI: only ACTIVE eligible fighters
    // can ever be selected, even if historical saves own/contain other ids.
    return activeRosterIds().filter((id) => canDraw(id) && !owns(id));
  }
  function buy(name) {
    const id = canonicalFighterId(name);
    if (!id || !visibleRosterIds().includes(id) || !canPurchase(id)) return { ok: false, reason: 'not-available' };
    if (owns(id)) return { ok: false, reason: 'owned' };
    if (state.credits < SHOP_COST) return { ok: false, reason: 'need', need: SHOP_COST - state.credits };
    state.credits -= SHOP_COST;
    state.ownedFighters.push(id);
    state.unlockedAt[id] = Date.now();
    save(state);
    return { ok: true, name: id, credits: state.credits };
  }
  function spin(rng) {
    if (spin._busy) return { ok: false, reason: 'spinning' };
    const pool = poolLocked();
    if (!pool.length) return { ok: false, reason: 'complete' };
    if (state.credits < DRAW_COST) return { ok: false, reason: 'need', need: DRAW_COST - state.credits };
    const random = typeof rng === 'function' ? rng : Math.random;
    const pick = pool[Math.floor(random() * pool.length) % pool.length];
    state.credits -= DRAW_COST;
    state.totalSpins += 1;
    save(state);
    state.ownedFighters.push(pick);
    state.unlockedAt[pick] = Date.now();
    save(state);
    return { ok: true, name: pick, credits: state.credits, totalSpins: state.totalSpins };
  }
  function award(reason, amount) {
    const n = Math.max(0, amount | 0);
    if (!n) return { ok: false, amount: 0, balance: state.credits };
    state.credits += n;
    save(state);
    lastAward.reasons = Array.isArray(reason) ? reason : [reason];
    lastAward.amount = n;
    lastAward.balance = state.credits;
    return { ok: true, ...lastAward };
  }
  function filterOwned(list) {
    const arr = list || [];
    return arr.filter((ft) => {
      const n = canonicalFighterId(ft && (ft.name || ft));
      return canSelect(n) && (owns(n) || n === 'ROBOT');
    });
  }
  function setLast(p1, p2) {
    // Do not mutate historic ownership, but never persist a locked/future
    // current selection. This is the save-layer enforcement paired with the
    // picker and shop checks above.
    if (p1 && owns(p1) && canSelect(p1)) state.lastSelectedP1 = canonicalFighterId(p1);
    if (p2 && owns(p2) && canSelect(p2)) state.lastSelectedP2 = canonicalFighterId(p2);
    save(state);
  }

  const PICK_ASSETS = '/assets/pick_ui_final/assets/';
  let shopSelected = state.lastSelectedP1 || 'ROBOT'; // HERO REWORK: NEWBIE retired
  let lastDrawResult = null;
  let drawBusy = false;
  let drawTimer = 0;
  let drawSpinToken = 0;

  function cancelDrawSpinAnimation() {
    drawSpinToken += 1;
    drawBusy = false;
    if (drawTimer) {
      window.clearTimeout(drawTimer);
      drawTimer = 0;
    }
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
  }
  const FIGHTER_ART = Object.freeze({
    ICE: 'ice',
    STRING: 'string',
    NOVA: 'galaxy',
  });
  function fighterInfo(name) {
    const id = String(name || 'ROBOT').toUpperCase();
    const shell = window.APEX_ARSENAL_SHELLS && window.APEX_ARSENAL_SHELLS.typeFor
      ? window.APEX_ARSENAL_SHELLS.typeFor(id) : null;
    const artId = FIGHTER_ART[id] || null;
    return {
      id,
      displayName: displayNameFor(id),
      color: (shell && shell.color) || '#d7bd72',
      desc: (shell && shell.desc) || 'Arsenal fighter',
      mark: (typeof window.fighterGlyph === 'function' && window.fighterGlyph(id)) || id.slice(0, 2),
      standing: artId ? `${PICK_ASSETS}standing/${artId}-standing.webp` : '',
      icon: artId ? `${PICK_ASSETS}hero-icons/${artId}-icon.webp` : '',
    };
  }
  function wireGridNav(root, selector, cols) {
    if (!root) return;
    root.addEventListener('keydown', (e) => {
      const items = Array.from(root.querySelectorAll(selector)).filter((el) => !el.disabled);
      const i = items.indexOf(document.activeElement);
      if (i < 0) return;
      let next = i;
      if (e.key === 'ArrowRight') next = Math.min(items.length - 1, i + 1);
      if (e.key === 'ArrowLeft') next = Math.max(0, i - 1);
      if (e.key === 'ArrowDown') next = Math.min(items.length - 1, i + cols);
      if (e.key === 'ArrowUp') next = Math.max(0, i - cols);
      if (next !== i) { e.preventDefault(); items[next].focus(); }
    });
  }

  const META_CSS = `
    #aq-meta-root{position:fixed;inset:0;z-index:520;display:none;pointer-events:auto;overflow:auto;overscroll-behavior:contain;background:#080b0f;color:#f4f0e6;font-family:"ApcKanit","Segoe UI",sans-serif;}
    #aq-meta-root *{box-sizing:border-box}
    #aq-meta-root button{pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-height:44px}
    #aq-meta-root button:focus-visible{outline:2px solid #f0d67e;outline-offset:3px}
    #aq-meta-root button:disabled{pointer-events:none}
    #aq-meta-stage{--aq-accent:#d7bd72;--aq-panel:#12171d;--aq-panel2:#1a2027;--aq-line:#343c45;--aq-muted:#8e99a4;position:relative;min-height:100dvh;width:100%;overflow:hidden;background:#080b0f;}
    #aq-meta-stage .aq-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.6) contrast(1.08) brightness(.42);pointer-events:none;}
    #aq-meta-stage .aq-veil{position:fixed;inset:0;background:radial-gradient(circle at 62% 42%,rgba(115,130,150,.12),transparent 34%),linear-gradient(180deg,rgba(4,7,10,.3),rgba(4,7,10,.78)),linear-gradient(90deg,rgba(2,4,7,.84),rgba(4,7,10,.35) 54%,rgba(2,4,7,.82));pointer-events:none;}
    .aq-ui{position:relative;z-index:2;width:100%;max-width:1920px;min-height:100dvh;margin:0 auto;padding:clamp(18px,2.2vw,38px) clamp(18px,3vw,56px) clamp(24px,3vw,50px);}
    .aq-topbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:center;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.1);}
    .aq-brand{display:flex;align-items:center;gap:14px;min-width:0}
    .aq-brand-copy{min-width:0}
    .aq-kicker{color:var(--aq-accent);font:800 10px/1 ui-monospace,monospace;letter-spacing:.22em;text-transform:uppercase}
    .aq-title{margin:4px 0 0;color:#f4f0e6;font-size:clamp(24px,3vw,42px);line-height:.92;font-style:italic;font-weight:900;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .aq-meta-stats{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
    .aq-stat{min-width:118px;padding:9px 12px;border:1px solid var(--aq-line);background:linear-gradient(180deg,#1a2027,#10151a);box-shadow:inset 0 1px rgba(255,255,255,.04);}
    .aq-stat span{display:block;color:var(--aq-muted);font:800 9px/1 ui-monospace,monospace;letter-spacing:.14em}
    .aq-stat b{display:block;margin-top:5px;color:#f2ead2;font:900 16px/1 "ApcKanit","Segoe UI",sans-serif}
    #aq-splatter-mode{padding:7px 12px;border:1px solid #5d6670;background:#1b242c;color:#f4e7c5;cursor:pointer;font:800 11px/1.25 "Segoe UI",sans-serif;text-align:left}
    .aq-back,.aq-exit{display:grid;place-items:center;width:44px;height:44px;flex:0 0 auto;border:1px solid #4a5057;background:linear-gradient(180deg,#2b3138,#151a20);color:#f4f0e6;cursor:pointer;font:900 18px/1 sans-serif;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px);}
    @media(hover:hover){.aq-back:hover,.aq-exit:hover{filter:brightness(1.14);transform:translateY(-1px)}}
    .aq-action{position:relative;border:1px solid var(--aq-line);background:linear-gradient(160deg,#1a2027,#0e1318 72%);color:#f4f0e6;cursor:pointer;text-align:left;overflow:hidden;box-shadow:inset 0 1px rgba(255,255,255,.035);transition:transform .14s ease,filter .14s ease,border-color .14s ease;clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);}
    .aq-action::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--aq-tile-accent,var(--aq-accent));opacity:.82}
    .aq-action-locked{cursor:default;opacity:.62;filter:saturate(.35)}
    .aq-action-locked .aq-action-meta{color:#9aa3ab}
    @media(hover:hover){.aq-action:not(.aq-action-locked):hover{transform:translateY(-5px);filter:brightness(1.08);border-color:#59636d}}
    .aq-action:active{transform:translateY(0) scale(.985)}
    .aq-action-index{display:block;color:var(--aq-tile-accent,var(--aq-accent));font:800 10px/1 ui-monospace,monospace;letter-spacing:.18em}
    .aq-action-title{display:block;margin-top:14px;font-size:clamp(22px,2.1vw,34px);line-height:.92;font-style:italic;font-weight:900;letter-spacing:.01em}
    .aq-action-desc{display:block;margin-top:12px;max-width:34ch;color:#aab3bc;font:650 13px/1.4 "Segoe UI",sans-serif}
    .aq-action-meta{display:block;margin-top:15px;color:#d9c57f;font:800 11px/1.25 ui-monospace,monospace;letter-spacing:.08em}
    .aq-hub-layout{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(0,1.55fr);gap:clamp(18px,2vw,28px);padding-top:clamp(22px,3vh,36px)}
    .aq-ident{min-height:min(690px,calc(100dvh - 142px));display:grid;grid-template-rows:auto minmax(190px,1fr) auto auto auto;align-items:center;padding:22px;border:1px solid #39424c;background:linear-gradient(180deg,#171d24,#0d1217);clip-path:polygon(14px 0,100% 0,100% calc(100% - 14px),calc(100% - 14px) 100%,0 100%,0 14px);}
    .aq-ident-label{justify-self:start;color:#7f8b97;font:800 9px/1 ui-monospace,monospace;letter-spacing:.18em}
    .aq-plate{position:relative;display:grid;place-items:center;width:min(82%,290px);aspect-ratio:1;justify-self:center;margin:18px 0;border:1px solid color-mix(in srgb,var(--fighter-accent) 45%,#46515d);background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--fighter-accent) 18%,transparent),transparent 50%),linear-gradient(180deg,#222a33,#10151b);color:#f3eee1;font:900 clamp(56px,7vw,96px)/1 "ApcKanit","Segoe UI",sans-serif;font-style:italic;overflow:hidden;clip-path:polygon(16% 0,84% 0,100% 16%,100% 84%,84% 100%,16% 100%,0 84%,0 16%);}
    .aq-plate::after{content:"";position:absolute;z-index:3;left:18%;right:18%;bottom:10%;height:2px;background:var(--fighter-accent);box-shadow:0 0 16px color-mix(in srgb,var(--fighter-accent) 55%,transparent)}
    .aq-standing{position:absolute;inset:4% 2% 0;width:96%;height:96%;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 18px 18px rgba(0,0,0,.48));transform:scale(1.04);transform-origin:center bottom}
    .aq-plate-mark{position:relative;z-index:2;text-shadow:0 4px 18px rgba(0,0,0,.6)}
    .aq-sel{font-size:clamp(24px,2.4vw,36px);font-weight:900;font-style:italic;line-height:.94;text-align:center;overflow-wrap:anywhere}
    .aq-tag{margin-top:7px;color:var(--fighter-accent);font:800 10px/1 ui-monospace,monospace;letter-spacing:.18em;text-align:center}
    .aq-primary-btn{min-height:48px;margin-top:18px;border:1px solid #5a5541;background:linear-gradient(180deg,#4a4024,#282312);color:#f5e8bb;cursor:pointer;font:900 13px/1 "Segoe UI",sans-serif;letter-spacing:.08em;clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px);}
    @media(hover:hover){.aq-primary-btn:hover{filter:brightness(1.14)}}
    .aq-hub-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(220px,1fr);gap:16px;min-height:min(690px,calc(100dvh - 142px));}
    .aq-hub-grid .aq-action{padding:24px 24px 22px}
    .aq-shop-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,.7fr);gap:18px;padding-top:24px}
    .aq-shop-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-content:start;max-height:calc(100dvh - 152px);overflow:auto;padding-right:6px;scrollbar-width:thin;scrollbar-color:#59636d #0b0f13}
    .aq-shop-grid::-webkit-scrollbar{width:8px}.aq-shop-grid::-webkit-scrollbar-track{background:#0b0f13}.aq-shop-grid::-webkit-scrollbar-thumb{background:#4a535d;border:2px solid #0b0f13}
    .aq-fighter-card{position:relative;min-height:132px;padding:15px;border:1px solid #333c45;background:linear-gradient(180deg,#161c22,#0d1217);color:#f0ece2;cursor:pointer;text-align:left;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px);}
    .aq-fighter-card.is-selected{border-color:var(--fighter-accent);filter:brightness(1.08)}
    @media(hover:hover){.aq-fighter-card:hover{border-color:var(--fighter-accent);filter:brightness(1.08)}}
    .aq-fighter-card.is-selected{box-shadow:inset 3px 0 var(--fighter-accent)}
    .aq-fighter-card.is-locked{opacity:.62;filter:saturate(.45)}
    .aq-fighter-mark{display:grid;place-items:center;width:52px;height:52px;border:1px solid color-mix(in srgb,var(--fighter-accent) 48%,#46515d);background:#11171c;color:#f4f0e6;font:900 20px/1 "ApcKanit","Segoe UI",sans-serif;font-style:italic;overflow:hidden}
    .aq-fighter-mark img{width:100%;height:100%;object-fit:cover;object-position:center}
    .aq-fighter-name{display:block;margin-top:13px;font:900 15px/1 "ApcKanit","Segoe UI",sans-serif;font-style:italic;overflow-wrap:anywhere}
    .aq-fighter-state{display:block;margin-top:7px;color:var(--fighter-accent);font:800 9px/1 ui-monospace,monospace;letter-spacing:.08em}
    .aq-detail{align-self:start;position:sticky;top:18px;min-height:360px;padding:24px;border:1px solid #39424c;background:linear-gradient(180deg,#171d24,#0c1116);clip-path:polygon(12px 0,100% 0,100% calc(100% - 12px),calc(100% - 12px) 100%,0 100%,0 12px);}
    .aq-detail-mark{display:grid;place-items:center;width:112px;height:112px;border:1px solid var(--fighter-accent);background:radial-gradient(circle at center,color-mix(in srgb,var(--fighter-accent) 12%,transparent),#11171c 70%);color:#f4f0e6;font:900 32px/1 "ApcKanit","Segoe UI",sans-serif;font-style:italic;overflow:hidden}
    .aq-detail-mark img{width:100%;height:100%;object-fit:contain;object-position:center bottom}
    .aq-detail h2{margin:18px 0 0;font-size:clamp(24px,2.4vw,34px);line-height:.95;font-style:italic}
    .aq-detail p{margin:14px 0 0;color:#aab3bc;font:650 13px/1.55 "Segoe UI",sans-serif}
    .aq-detail-status{margin-top:20px;padding-top:14px;border-top:1px solid #2f3740;color:var(--fighter-accent);font:800 11px/1.2 ui-monospace,monospace;letter-spacing:.1em}
    .aq-detail-message{min-height:20px;margin-top:12px;color:#e7ca72;font:800 11px/1.35 ui-monospace,monospace}
    .aq-buy{width:100%;min-height:48px;margin-top:16px;border:1px solid #5a5541;background:linear-gradient(180deg,#4a4024,#282312);color:#f5e8bb;font:900 13px/1 "Segoe UI",sans-serif;cursor:pointer}
    .aq-buy:disabled{opacity:.38;cursor:default}
    .aq-draw-layout{display:grid;grid-template-columns:minmax(320px,1.25fr) minmax(280px,.75fr);gap:22px;padding-top:24px;align-items:center;min-height:calc(100dvh - 122px)}
    .aq-wheel-wrap{display:grid;place-items:center;min-height:0}
    .aq-wheel{position:relative;width:min(62vmin,610px);aspect-ratio:1;border-radius:50%;border:7px solid #5e5438;background:radial-gradient(circle at 50% 50%,#131920 0 31%,transparent 32%),conic-gradient(#493d22 0 12.5%,#182029 12.5% 25%,#5a4724 25% 37.5%,#151c24 37.5% 50%,#493d22 50% 62.5%,#182029 62.5% 75%,#5a4724 75% 87.5%,#151c24 87.5% 100%);box-shadow:0 24px 60px rgba(0,0,0,.38),inset 0 0 0 2px #17120a,inset 0 0 42px rgba(0,0,0,.55);transition:transform 4.2s cubic-bezier(.12,.74,.08,1);}
    .aq-wheel::before{content:"";position:absolute;left:50%;top:-22px;transform:translateX(-50%);width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:0;border-bottom:26px solid #e0c877;filter:drop-shadow(0 2px 2px #000)}
    .aq-wheel-core{position:absolute;inset:31%;display:grid;place-items:center;border:1px solid #4b5560;border-radius:50%;background:#0c1116;text-align:center}
    .aq-wheel-core b{display:block;font-size:clamp(30px,5vmin,56px);line-height:.85;font-style:italic}
    .aq-wheel-core span{display:block;margin-top:8px;color:#9ba5ae;font:800 9px/1 ui-monospace,monospace;letter-spacing:.14em}
    .aq-wheel-label{position:absolute;left:50%;top:50%;width:94px;margin-left:-47px;margin-top:-8px;color:#d8d2c4;font:800 9px/1 ui-monospace,monospace;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform-origin:47px 8px}
    .aq-draw-side{padding:24px;border:1px solid #39424c;background:linear-gradient(180deg,#171d24,#0c1116)}
    .aq-draw-side h2{margin:0;font-size:clamp(26px,2.5vw,36px);line-height:.95;font-style:italic}
    .aq-draw-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:18px}
    .aq-draw-fact{padding:10px;border:1px solid #303842;background:#0d1217}
    .aq-draw-fact span{display:block;color:#86919c;font:800 8px/1 ui-monospace,monospace;letter-spacing:.12em}
    .aq-draw-fact b{display:block;margin-top:5px;font-size:15px}
    .aq-draw-result{margin-top:18px;padding:16px;border:1px solid #4a4430;background:#13130e}
    .aq-draw-result strong{display:block;font-size:clamp(24px,2vw,32px);font-style:italic}
    .aq-draw-result span{display:block;margin-top:6px;color:#d7bd72;font:800 10px/1 ui-monospace,monospace;letter-spacing:.14em}
    .aq-draw-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
    .aq-draw-actions button{min-height:42px;border:1px solid #434c56;background:#171d24;color:#f2eee5;font:800 11px/1 "Segoe UI",sans-serif;cursor:pointer}
    .aq-draw-actions button:first-child{border-color:#5a5541;background:#3d351f;color:#f2df9b}
    .aq-spin{width:100%;min-height:52px;margin-top:20px;border:1px solid #5a5541;background:linear-gradient(180deg,#4b4124,#282311);color:#f7e7ac;cursor:pointer;font:900 14px/1 "Segoe UI",sans-serif;letter-spacing:.08em}
    .aq-spin:disabled{opacity:.42;cursor:default}
    .aq-note{margin-top:12px;color:#87929c;font:650 12px/1.45 "Segoe UI",sans-serif}
    @media(min-width:1600px){
      .aq-ui{max-width:none;padding-left:clamp(42px,3.4vw,72px);padding-right:clamp(42px,3.4vw,72px)}
      .aq-hub-layout{grid-template-columns:clamp(320px,22vw,430px) minmax(0,1fr)}
      .aq-ident,.aq-hub-grid{min-height:calc(100dvh - 146px)}
      .aq-shop-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
      .aq-action-title{font-size:clamp(28px,2vw,40px)}
    }
    @media(max-width:1240px){
      .aq-shop-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
      .aq-hub-layout{grid-template-columns:minmax(230px,.65fr) minmax(0,1.35fr)}
    }
    @media(max-width:900px),(orientation:portrait){
      #aq-meta-root{overflow-y:auto}
      .aq-ui{min-height:100dvh;padding:16px}
      .aq-topbar{grid-template-columns:1fr}
      .aq-meta-stats{justify-content:flex-start}
      .aq-hub-layout,.aq-shop-layout,.aq-draw-layout{grid-template-columns:1fr}
      .aq-ident{min-height:auto;grid-template-columns:96px 1fr;grid-template-rows:auto auto auto;column-gap:16px;padding:16px}
      .aq-ident-label{grid-column:1/-1}
      .aq-plate{grid-row:2/4;width:92px;margin:0}
      .aq-sel,.aq-tag{text-align:left}
      .aq-primary-btn{grid-column:1/-1;margin-top:8px}
      .aq-hub-grid{min-height:auto;grid-auto-rows:minmax(156px,auto)}
      .aq-shop-grid{grid-template-columns:repeat(2,minmax(0,1fr));max-height:none}
      .aq-detail{position:relative;top:auto}
      .aq-draw-layout{min-height:auto}
      .aq-wheel{width:min(82vw,520px)}
    }
    @media(max-width:600px){
      .aq-ui{padding:12px 10px max(18px,env(safe-area-inset-bottom))}
      .aq-title{font-size:clamp(22px,8vw,32px)}
      .aq-brand{gap:9px}
      .aq-back,.aq-exit{width:44px;height:44px}
      .aq-hub-grid{grid-template-columns:1fr;gap:10px}
      .aq-hub-grid .aq-action{padding:18px}
      .aq-action-title{font-size:clamp(22px,7vw,30px)}
      .aq-action-desc{font-size:12px}
      .aq-shop-grid{grid-template-columns:1fr}
      .aq-fighter-card{min-height:110px}
      .aq-meta-stats{display:grid;grid-template-columns:1fr 1fr;width:100%}
      .aq-stat{min-width:0}
      .aq-draw-facts{grid-template-columns:1fr}
      .aq-draw-actions{grid-template-columns:1fr}
      .aq-wheel{width:min(90vw,440px)}
    }
    @media(max-height:650px) and (min-width:901px){
      .aq-ui{padding-top:12px;padding-bottom:14px}
      .aq-ident,.aq-hub-grid{min-height:calc(100dvh - 104px)}
      .aq-hub-grid{grid-auto-rows:minmax(150px,1fr)}
      .aq-hub-grid .aq-action{padding:18px}
      .aq-plate{width:min(68%,220px);margin:10px 0}
      .aq-shop-grid{max-height:calc(100dvh - 112px)}
      .aq-draw-layout{min-height:calc(100dvh - 90px)}
      .aq-wheel{width:min(56vmin,520px)}
    }
  `;

  function host() {
    return document.body;
  }
  function shell(inner) {
    return `<div id="aq-meta-stage"><img class="aq-bg" alt="" src="${PICK_ASSETS}01-select-screen-background.webp"/><div class="aq-veil"></div>${inner}</div><style>${META_CSS}</style>`;
  }
  function ensureRoot() {
    let el = document.getElementById('aq-meta-root');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'aq-meta-root';
    host().appendChild(el);
    return el;
  }
  function hideMeta() {
    cancelDrawSpinAnimation();
    const el = document.getElementById('aq-meta-root');
    if (el) el.style.display = 'none';
  }
  function paintHub() {
    cancelDrawSpinAnimation();
    const el = ensureRoot();
    const P = product();
    const surfaces = P && P.publicSurfaces ? P.publicSurfaces() : [];
    const ownedN = activeRosterIds().filter(owns).length;
    const total = activeRosterIds().length;
    const info = fighterInfo(state.lastSelectedP1 || 'ROBOT');
    const detail = {
      'quest-01': 'Quest 01 is planned for a later rollout.',
      'bot-battle': 'Choose one owned Core fighter. P2 uses the accepted Arsenal CPU seam.',
      'local-1v1': 'Choose two owned Core fighters and jump into accepted Arsenal Free Battle.',
      'fighter-shop': 'Unlock currently active fighters with Arsenal Credits.',
      'lucky-draw': 'Draw one currently active, unowned fighter with no duplicates.',
      'fighter-upgrade': 'Upgrade systems are not available in this product cut.',
      dictionary: 'Reference data is not available in this product cut.',
      missions: 'Mission systems are not available in this product cut.',
      achievements: 'Achievement systems are not available in this product cut.',
      'account-profile': 'Account and profile systems are not available in this product cut.',
    };
    const cards = surfaces.map((entry, index) => {
      const active = entry.availability === 'ACTIVE';
      const stateLabel = active ? 'AVAILABLE NOW' : 'LOCKED';
      const tag = active ? 'button type="button"' : 'div role="group" aria-disabled="true"';
      const go = active ? ` data-go="${esc(entry.id)}"` : ` data-surface="${esc(entry.id)}"`;
      return `<${tag}${go} class="aq-action ${active ? '' : 'aq-action-locked'}" style="--aq-tile-accent:${active ? '#d7bd72' : '#59636d'}"><span class="aq-action-index">${String(index + 1).padStart(2, '0')} · ${stateLabel}</span><span class="aq-action-title">${esc(entry.title)}</span><span class="aq-action-desc">${esc(detail[entry.id] || '')}</span><span class="aq-action-meta">${stateLabel}</span></${active ? 'button' : 'div'}>`;
    }).join('');
    el.style.display = 'block';
    el.innerHTML = shell(`
      <main class="aq-ui" id="aq-hub" data-product-graph="pre-pilot">
        <header class="aq-topbar">
          <div class="aq-brand">
            <button id="aq-hub-exit" class="aq-exit" type="button" aria-label="Back to product menu">←</button>
            <div class="aq-brand-copy"><div class="aq-kicker">APEX CHAOS · PRE-PILOT</div><h1 class="aq-title">PRODUCT GRAPH</h1></div>
          </div>
          <div class="aq-meta-stats">
            <div class="aq-stat"><span>ARSENAL CREDITS</span><b id="aq-ac">${state.credits} AC</b></div>
            <div class="aq-stat"><span>ACTIVE ROSTER</span><b>${ownedN} / ${total}</b></div>
          </div>
        </header>
        <section class="aq-hub-layout">
          <article class="aq-ident" style="--fighter-accent:${esc(info.color)}">
            <div class="aq-ident-label">CURRENT PRODUCT FIGHTER</div>
            <div class="aq-plate" aria-hidden="true">${info.standing ? `<img class="aq-standing" src="${esc(info.standing)}" alt=""/>` : `<span class="aq-plate-mark">${esc(info.mark)}</span>`}</div>
            <div class="aq-sel">${esc(info.displayName)}</div>
            <div class="aq-tag">ACTIVE / OWNED</div>
            <button id="aq-change" class="aq-primary-btn" type="button">OPEN LOCAL 1V1</button>
          </article>
          <div class="aq-hub-grid" aria-label="APEX CHAOS product surfaces">${cards}</div>
        </section>
      </main>`);
    el.querySelectorAll('[data-go]').forEach((b) => {
      b.addEventListener('click', () => openProductSurface(b.getAttribute('data-go')));
    });
    el.querySelector('#aq-change')?.addEventListener('click', openFreePick);
    el.querySelector('#aq-hub-exit')?.addEventListener('click', () => {
      hideMeta();
      if (typeof goToMenu === 'function') goToMenu();
      else if (typeof window.goToMenu === 'function') window.goToMenu();
    });
    wireGridNav(el.querySelector('.aq-hub-grid'), '[data-go]', 2);
  }
  function paintShop(selectedName) {
    cancelDrawSpinAnimation();
    const el = ensureRoot();
    const ids = visibleRosterIds();
    shopSelected = canonicalFighterId(selectedName || state.lastSelectedP1 || shopSelected || 'ROBOT');
    if (!ids.includes(shopSelected)) shopSelected = 'ROBOT';
    const selected = fighterInfo(shopSelected);
    const selectedOwned = owns(shopSelected);
    const selectedAvailable = canPurchase(shopSelected);
    const cards = ids.map((n) => {
      const owned = owns(n);
      const available = canPurchase(n);
      const info = fighterInfo(n);
      const label = !available ? 'LOCKED · COMING SOON' : owned ? 'OWNED' : '1000 AC';
      return `<button type="button" data-shop-card="${esc(n)}" class="aq-fighter-card ${owned || !available ? 'is-locked' : ''} ${n === shopSelected ? 'is-selected' : ''}" style="--fighter-accent:${esc(info.color)}"><span class="aq-fighter-mark">${info.icon ? `<img src="${esc(info.icon)}" alt=""/>` : esc(info.mark)}</span><span class="aq-fighter-name">${esc(info.displayName)}</span><span class="aq-fighter-state">${label}</span></button>`;
    }).join('');
    el.style.display = 'block';
    el.innerHTML = shell(`
      <main class="aq-ui">
        <header class="aq-topbar">
          <div class="aq-brand"><button class="aq-back" id="aq-shop-back" type="button" aria-label="Back to Arsenal Hub">←</button><div class="aq-brand-copy"><div class="aq-kicker">ARSENAL · ROSTER</div><h1 class="aq-title">FIGHTER SHOP</h1></div></div>
          <div class="aq-meta-stats"><div class="aq-stat"><span>ARSENAL CREDITS</span><b>${state.credits} AC</b></div></div>
        </header>
        <section class="aq-shop-layout">
          <div class="aq-shop-grid" role="listbox" aria-label="Fighter roster">${cards}</div>
          <aside class="aq-detail" id="aq-shop-detail" style="--fighter-accent:${esc(selected.color)}">
            <div class="aq-detail-mark">${selected.standing ? `<img src="${esc(selected.standing)}" alt=""/>` : esc(selected.mark)}</div>
            <div class="aq-kicker" style="margin-top:18px">FIGHTER PROFILE</div>
            <h2>${esc(selected.displayName)}</h2>
            <p>${esc(selected.desc)}</p>
            <div class="aq-detail-status">${!selectedAvailable ? 'LOCKED · COMING SOON' : selectedOwned ? 'OWNED' : 'AVAILABLE · 1000 AC'}</div>
            <div id="aq-shop-message" class="aq-detail-message"></div>
            <button id="aq-buy" class="aq-buy" type="button" ${(!selectedAvailable || selectedOwned) ? 'disabled' : ''}>${!selectedAvailable ? 'LOCKED' : selectedOwned ? 'OWNED' : 'UNLOCK · 1000 AC'}</button>
          </aside>
        </section>
      </main>`);
    el.querySelector('#aq-shop-back').onclick = paintHub;
    el.querySelectorAll('[data-shop-card]').forEach((b) => {
      b.onclick = () => paintShop(b.getAttribute('data-shop-card'));
    });
    const buyBtn = el.querySelector('#aq-buy');
    if (buyBtn && !buyBtn.disabled) {
      buyBtn.onclick = () => {
        const r = buy(shopSelected);
        const msg = el.querySelector('#aq-shop-message');
        if (!r.ok) {
          msg.textContent = r.reason === 'need' ? `NEED ${r.need} AC` : String(r.reason).toUpperCase();
          return;
        }
        paintShop(shopSelected);
        const nextMsg = ensureRoot().querySelector('#aq-shop-message');
        if (nextMsg) nextMsg.textContent = `${displayNameFor(shopSelected)} UNLOCKED`;
      };
    }
    wireGridNav(el.querySelector('.aq-shop-grid'), '[data-shop-card]', window.innerWidth < 860 ? 2 : 4);
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape') paintHub(); }, { once: true });
  }
  function paintDraw() {
    const el = ensureRoot();
    const locked = poolLocked();
    const labels = locked.slice(0, 12).map((n, i, arr) => {
      const a = (360 / Math.max(1, arr.length)) * i;
      return `<span class="aq-wheel-label" style="transform:rotate(${a}deg) translateY(max(-25vmin,-245px)) rotate(${-a}deg)">${esc(displayNameFor(n))}</span>`;
    }).join('');
    const result = lastDrawResult
      ? `<div class="aq-draw-result"><strong>${esc(displayNameFor(lastDrawResult.name))}</strong><span>UNLOCKED</span><div class="aq-draw-actions"><button id="aq-use-now" type="button">USE NOW</button><button id="aq-spin-again" type="button">SPIN AGAIN</button></div></div>`
      : '';
    el.style.display = 'block';
    el.innerHTML = shell(`
      <main class="aq-ui">
        <header class="aq-topbar">
          <div class="aq-brand"><button class="aq-back" id="aq-draw-back" type="button" aria-label="Back to Arsenal Hub">←</button><div class="aq-brand-copy"><div class="aq-kicker">ARSENAL · UNLOCK</div><h1 class="aq-title">LUCKY DRAW</h1></div></div>
          <div class="aq-meta-stats"><div class="aq-stat"><span>ARSENAL CREDITS</span><b>${state.credits} AC</b></div></div>
        </header>
        <section class="aq-draw-layout">
          <div class="aq-wheel-wrap">
            <div id="aq-wheel" class="aq-wheel">${labels}<div class="aq-wheel-core"><div><b>${locked.length}</b><span>LOCKED</span></div></div></div>
          </div>
          <aside class="aq-draw-side">
            <div class="aq-kicker">NO DUPLICATES</div><h2>ONE NEW FIGHTER</h2>
            <div class="aq-draw-facts"><div class="aq-draw-fact"><span>COST</span><b>350 AC</b></div><div class="aq-draw-fact"><span>POOL</span><b>${locked.length} LEFT</b></div></div>
            <p class="aq-note">The draw only contains fighters you do not own. When the pool is empty, the roster is complete.</p>
            <button id="aq-spin" class="aq-spin" type="button" ${(!locked.length || drawBusy) ? 'disabled' : ''}>${!locked.length ? 'ROSTER COMPLETE' : drawBusy ? 'SPINNING…' : 'SPIN · 350 AC'}</button>
            <div id="aq-draw-message" class="aq-detail-message"></div>
            ${result}
          </aside>
        </section>
      </main>`);
    el.querySelector('#aq-draw-back').onclick = () => { if (!drawBusy) { lastDrawResult = null; paintHub(); } };
    const spinBtn = el.querySelector('#aq-spin');
    if (spinBtn && !spinBtn.disabled) {
      spinBtn.onclick = () => {
        const before = locked.slice();
        const r = spin();
        const out = el.querySelector('#aq-draw-message');
        if (!r.ok) {
          out.textContent = r.reason === 'need' ? `NEED ${r.need} AC` : (r.reason === 'complete' ? 'ROSTER COMPLETE' : String(r.reason).toUpperCase());
          return;
        }
        drawBusy = true;
        lastDrawResult = null;
        spinBtn.disabled = true;
        spinBtn.textContent = 'SPINNING…';
        const wheel = el.querySelector('#aq-wheel');
        const idx = Math.max(0, before.indexOf(r.name));
        const stop = 360 * 5 + (360 - (idx * (360 / Math.max(1, before.length))));
        wheel.style.transform = `rotate(${stop}deg)`;
        const spinToken = ++drawSpinToken;
        drawTimer = window.setTimeout(() => {
          drawTimer = 0;
          if (spinToken !== drawSpinToken) return;
          drawBusy = false;
          lastDrawResult = r;
          paintDraw();
        }, 4200);
      };
    }
    el.querySelector('#aq-use-now')?.addEventListener('click', () => {
      if (!lastDrawResult) return;
      setLast(lastDrawResult.name, state.lastSelectedP2);
      lastDrawResult = null;
      openFreePick();
    });
    el.querySelector('#aq-spin-again')?.addEventListener('click', () => {
      lastDrawResult = null;
      paintDraw();
      ensureRoot().querySelector('#aq-spin')?.focus();
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawBusy) paintHub(); }, { once: true });
  }
  function openFighterPick(opts) {
    const mode = (opts && opts.mode) || 'local';
    const legacyQuest = mode === 'legacy-quest' || mode === 'quest';
    window.__apexArsenalSelectPending = true;
    window.__apexArsenalSelectionMode = legacyQuest ? 'legacy-quest' : mode;
    window.__apexArsenalFreeBattle = mode === 'local' || mode === 'free';
    window.__apexArsenalBotBattle = mode === 'bot';
    window.__apexArsenalQuestPick = legacyQuest;
    // The JSON picker is only a renderer. Selection legality is enforced by
    // Meta.filterOwned + APEX_ARSENAL_SHELLS.selectionTypeFor before a match
    // can launch; no locked save entry can bypass it through this route.
    const open = () => {
      hideMeta();
      const shells = window.APEX_ARSENAL_SHELLS;
      if (shells && typeof shells.beginSelection === 'function') shells.beginSelection({ mode: window.__apexArsenalSelectionMode });
      else if (typeof goToSelect === 'function') goToSelect();
      else if (typeof window.goToSelect === 'function') window.goToSelect();
    };
    if (window['__apexDeferredRuntimesReady_select']) { open(); return; }
    const ensure = window.__apexEnsureDeferredRuntimes;
    if (typeof ensure === 'function') { ensure('select').then(open).catch(open); return; }
    open();
  }
  function openFreePick() {
    openFighterPick({ mode: 'local' });
  }
  function openBotPick() {
    openFighterPick({ mode: 'bot' });
  }
  function openProductSurface(id) {
    const P = product();
    const request = P && P.request ? P.request(id) : { ok: false, reason: 'product-authority-unavailable' };
    if (!request.ok) return request;
    if (id === 'local-1v1') { openFreePick(); return request; }
    if (id === 'bot-battle') { openBotPick(); return request; }
    if (id === 'fighter-shop') { paintShop(); return request; }
    if (id === 'lucky-draw') { paintDraw(); return request; }
    return { ok: false, reason: 'no-public-launcher', surface: request.surface };
  }
  function openDeveloperLab() {
    const P = product();
    const request = P && P.request ? P.request('arsenal-lab', { developer: true }) : { ok: false, reason: 'product-authority-unavailable' };
    if (!request.ok) return request;
    const launch = () => {
      hideMeta();
      window.startArsenalLab?.();
      return request;
    };
    if (window.apexArsenalGameplayBarrierSync && window.apexArsenalGameplayBarrierSync('lab')) return launch();
    if (window.apexArsenalGameplayBarrier) {
      window.apexArsenalGameplayBarrier('lab').then((ok) => { if (ok) launch(); });
      return request;
    }
    const ensure = window.__apexEnsureDeferredRuntimes;
    if (typeof ensure === 'function') ensure('arsenalCore').then(launch).catch(() => {});
    else launch();
    return request;
  }
  function openHub() {
    state = load();
    paintHub();
  }

  // Compatibility entry remains intentionally non-public. The React product
  // menu calls openApexProductSurface() instead of this historical name.
  window.beginArsenalQuestSelection = function () {
    openHub();
  };
  window.openApexProductSurface = openProductSurface;
  // Deliberate admin seam: the Lab remains available to developers without
  // being a normal product card or public route.
  window.openArsenalLab = openDeveloperLab;

  // The historical ladder may be loaded after this small product Meta group.
  // Install its reward bridge lazily when (and only when) that explicit
  // compatibility runtime exists. Product Local/Bot results use the shared
  // result HUD directly and do not require a hidden quest dependency.
  function installLegacyResultHook() {
    const Q = window.APEX_ARSENAL_QUEST;
    if (!Q || !Q.onMatchOver || Q.__apexMetaResultHookInstalled) return false;
    const prev = Q.onMatchOver;
    Q.onMatchOver = function (winnerName) {
      const st = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
      const before = Q.loadSave ? Q.loadSave() : {};
      prev(winnerName);
      if (st && st.questStage) {
        const p1 = (typeof fighters !== 'undefined' && fighters[0]) ? fighters[0].name : null;
        const won = winnerName === p1 || winnerName === 'P1';
        if (won) {
          const first = !(before.completedStages || []).includes(st.questStage);
          award(first ? 'quest_first' : 'quest_replay', first ? 150 : 40);
        }
      } else if (st && !st.questStage) {
        const p1 = (typeof fighters !== 'undefined' && fighters[0]) ? fighters[0].name : null;
        const won = winnerName === p1;
        award(won ? ['free_complete', 'free_winner'] : 'free_complete', won ? 50 : 25);
      }
    };
    Q.__apexMetaResultHookInstalled = true;
    return true;
  }
  window.__apexArsenalInstallMetaResultHook = installLegacyResultHook;
  installLegacyResultHook();

  window.APEX_ARSENAL_META = {
    KEY, SHOP_COST, DRAW_COST, START_CREDITS,
    getState, credits, owns, buy, spin, award, filterOwned, setLast,
    palette, setPalette,
    load, save, emptyState, sanitize, poolLocked, lastAward: () => lastAward,
    visibleRosterIds, activeRosterIds, canSelect, canPurchase, canDraw, displayNameFor,
    openHub, hideMeta, paintShop, paintDraw, openFreePick, openBotPick, openFighterPick,
    openProductSurface, openDeveloperLab,
  };
  window.apexArsenalMetaRuntime = 'ready';
})();
