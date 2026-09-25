// ARSENAL V3 meta: Hub / Shop / Lucky Draw / AC economy / owned roster.
(function apexArsenalMetaRuntime() {
  if (window.apexArsenalMetaRuntime === 'ready') return;
  const KEY = 'apexChaos.arsenalMeta.v1';
  const SHOP_COST = 1000;
  const DRAW_COST = 350;
  const START_CREDITS = 350;
  const ROSTER = () => (window.APEX_ARSENAL_SHELLS && window.APEX_ARSENAL_SHELLS.ids) || ['NEWBIE'];

  function emptyState() {
    return {
      version: 1,
      credits: START_CREDITS,
      ownedFighters: ['NEWBIE'],
      lastSelectedP1: 'NEWBIE',
      lastSelectedP2: 'NEWBIE',
      totalSpins: 0,
      unlockedAt: { NEWBIE: 0 },
    };
  }
  function sanitize(raw) {
    const s = emptyState();
    if (!raw || typeof raw !== 'object') return s;
    s.credits = Math.max(0, raw.credits | 0);
    const owned = Array.isArray(raw.ownedFighters) ? raw.ownedFighters.map(String) : [];
    s.ownedFighters = Array.from(new Set(['NEWBIE', ...owned]));
    s.lastSelectedP1 = s.ownedFighters.includes(raw.lastSelectedP1) ? raw.lastSelectedP1 : 'NEWBIE';
    s.lastSelectedP2 = s.ownedFighters.includes(raw.lastSelectedP2) ? raw.lastSelectedP2 : 'NEWBIE';
    s.totalSpins = Math.max(0, raw.totalSpins | 0);
    s.unlockedAt = raw.unlockedAt && typeof raw.unlockedAt === 'object' ? raw.unlockedAt : { NEWBIE: 0 };
    s.unlockedAt.NEWBIE = s.unlockedAt.NEWBIE || 0;
    return s;
  }
  function load() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
      if (!raw) return emptyState();
      return sanitize(JSON.parse(raw));
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

  function getState() { return JSON.parse(JSON.stringify(state)); }
  function credits() { return state.credits; }
  function owns(name) { return state.ownedFighters.includes(String(name).toUpperCase()); }
  function poolLocked() {
    return ROSTER().filter((n) => n !== 'NEWBIE' && !owns(n));
  }
  function buy(name) {
    const id = String(name || '').toUpperCase();
    if (!id || id === 'NEWBIE') return { ok: false, reason: 'newbie' };
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
      const n = ft && (ft.name || ft);
      return owns(n) || n === 'NEWBIE';
    });
  }
  function setLast(p1, p2) {
    if (p1 && owns(p1)) state.lastSelectedP1 = p1;
    if (p2 && owns(p2)) state.lastSelectedP2 = p2;
    save(state);
  }

  function host() {
    return document.getElementById('game-wrap') || document.getElementById('game-wrapper') || document.body;
  }
  function ensureRoot() {
    let el = document.getElementById('aq-meta-root');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'aq-meta-root';
    el.style.cssText = 'position:absolute;inset:0;z-index:80;display:none;pointer-events:auto;font-family:Trebuchet MS,sans-serif;color:#efe6c8;';
    host().appendChild(el);
    return el;
  }
  function hideMeta() {
    const el = document.getElementById('aq-meta-root');
    if (el) el.style.display = 'none';
  }
  function paintHub() {
    const el = ensureRoot();
    const ownedN = state.ownedFighters.length;
    const total = ROSTER().length;
    const quest = window.APEX_ARSENAL_QUEST && window.APEX_ARSENAL_QUEST.loadSave ? window.APEX_ARSENAL_QUEST.loadSave() : { completedStages: [] };
    const cleared = (quest.completedStages || []).length;
    el.style.display = 'block';
    el.innerHTML = `<div id="aq-hub" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1672px,96%);height:min(941px,94%);background:rgba(12,14,18,0.96);border:2px solid #8a7a52;box-sizing:border-box;padding:18px 22px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font:800 22px/1 Trebuchet MS,sans-serif;letter-spacing:2px;">ARSENAL QUEST</div>
        <div style="display:flex;gap:24px;font:700 14px monospace;"><span id="aq-ac">AC ${state.credits}</span><span>FIGHTERS ${ownedN} / ${total}</span></div>
      </div>
      <div style="display:flex;margin-top:18px;height:calc(100% - 70px);gap:18px;">
        <div style="width:500px;background:#16181e;border:1px solid #4a4332;padding:16px;">
          <div style="opacity:.7;font:700 11px monospace;">SELECTED</div>
          <div style="font:800 28px/1.2 Trebuchet MS,sans-serif;margin-top:8px;">${state.lastSelectedP1}</div>
          <div style="margin-top:10px;opacity:.8;">Arsenal shell · owned</div>
          <button id="aq-change" style="margin-top:24px;min-height:44px;padding:10px 16px;background:#2a2418;color:#efe6c8;border:1px solid #c4a574;">CHANGE FIGHTER</button>
        </div>
        <div id="aq-hub-grid" style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <button data-go="free" class="aq-tile">FREE BATTLE<div>Local 1v1 — choose both fighters</div></button>
          <button data-go="quest" class="aq-tile">QUEST MAP<div>20-stage Arsenal ladder</div><div>${cleared} / 20 CLEARED</div></button>
          <button data-go="shop" class="aq-tile">FIGHTER SHOP<div>Direct unlock — 1000 AC</div></button>
          <button data-go="draw" class="aq-tile">LUCKY DRAW<div>Random new fighter — 350 AC — no duplicates</div></button>
        </div>
      </div>
    </div>
    <style>#aq-hub .aq-tile{min-height:44px;text-align:left;background:#1c1f26;color:#efe6c8;border:1px solid #6a5c3a;padding:18px;font:800 16px Trebuchet MS,sans-serif;}#aq-hub .aq-tile div{font:600 12px/1.4 Trebuchet MS,sans-serif;opacity:.8;margin-top:8px;}</style>`;
    el.querySelectorAll('[data-go]').forEach((b) => {
      b.addEventListener('click', () => {
        const go = b.getAttribute('data-go');
        if (go === 'free') openFreePick();
        if (go === 'quest') { hideMeta(); if (window.beginArsenalQuestMap) window.beginArsenalQuestMap(); }
        if (go === 'shop') paintShop();
        if (go === 'draw') paintDraw();
      });
    });
    const ch = el.querySelector('#aq-change');
    if (ch) ch.addEventListener('click', openFreePick);
  }
  function paintShop() {
    const el = ensureRoot();
    const ids = ROSTER();
    const cards = ids.map((n) => {
      const owned = owns(n);
      const label = n === 'NEWBIE' ? 'DEFAULT / OWNED' : owned ? 'OWNED' : '1000 AC';
      return `<button data-buy="${n}" style="min-height:44px;opacity:${owned ? 1 : 0.55};filter:${owned ? 'none' : 'grayscale(.6)'};background:#1c1f26;color:#efe6c8;border:1px solid #6a5c3a;padding:10px;">${n}<div>${label}</div></button>`;
    }).join('');
    el.style.display = 'block';
    el.innerHTML = `<div style="position:absolute;inset:4%;background:rgba(12,14,18,0.96);border:2px solid #8a7a52;padding:16px;">
      <div style="display:flex;justify-content:space-between;"><button id="aq-shop-back" style="min-height:44px;">BACK</button><div>FIGHTER SHOP</div><div>AC ${state.credits}</div></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:16px;">${cards}</div>
      <div id="aq-shop-detail" style="margin-top:16px;min-height:80px;"></div>
    </div>`;
    el.querySelector('#aq-shop-back').onclick = paintHub;
    el.querySelectorAll('[data-buy]').forEach((b) => {
      b.onclick = () => {
        const n = b.getAttribute('data-buy');
        const r = buy(n);
        const d = el.querySelector('#aq-shop-detail');
        d.textContent = r.ok ? `${n} UNLOCKED` : (r.reason === 'need' ? `NEED ${r.need} AC` : String(r.reason).toUpperCase());
        if (r.ok) paintShop();
      };
    });
  }
  function paintDraw() {
    const el = ensureRoot();
    const locked = poolLocked();
    el.style.display = 'block';
    el.innerHTML = `<div style="position:absolute;inset:4%;background:rgba(12,14,18,0.96);border:2px solid #8a7a52;padding:16px;display:flex;gap:24px;">
      <div style="flex:1;display:flex;align-items:center;justify-content:center;">
        <div id="aq-wheel" style="width:610px;height:610px;border-radius:50%;border:8px solid #c4a574;position:relative;background:conic-gradient(#3a2a18,#1c1f26,#3a2a18);"></div>
      </div>
      <div style="width:360px;">
        <button id="aq-draw-back" style="min-height:44px;">BACK TO HUB</button>
        <div style="margin-top:20px;">AC ${state.credits}</div>
        <div>Cost 350 AC</div>
        <div>Locked ${locked.length}</div>
        <div>No duplicates</div>
        <button id="aq-spin" style="margin-top:20px;min-height:44px;width:100%;">${locked.length ? 'SPIN' : 'ROSTER COMPLETE'}</button>
        <div id="aq-draw-result" style="margin-top:16px;"></div>
      </div>
    </div>`;
    el.querySelector('#aq-draw-back').onclick = paintHub;
    el.querySelector('#aq-spin').onclick = () => {
      const r = spin();
      const out = el.querySelector('#aq-draw-result');
      if (!r.ok) { out.textContent = r.reason === 'need' ? `NEED ${r.need} AC` : (r.reason === 'complete' ? 'ROSTER COMPLETE' : r.reason); return; }
      out.innerHTML = `<div>${r.name}</div><div>UNLOCKED</div><button id="aq-use-now" style="min-height:44px;">USE NOW</button>`;
      const u = el.querySelector('#aq-use-now');
      if (u) u.onclick = () => { setLast(r.name, state.lastSelectedP2); openFreePick(); };
    };
  }
  function openFreePick() {
    hideMeta();
    window.__apexArsenalSelectPending = true;
    window.__apexArsenalFreeBattle = true;
    window.__apexSkipHub = true;
    if (typeof goToSelect === 'function') goToSelect();
    else if (typeof window.goToSelect === 'function') window.goToSelect();
    window.__apexSkipHub = false;
  }
  function openHub() {
    state = load();
    paintHub();
  }

  const origBegin = window.beginArsenalQuestSelection;
  window.beginArsenalQuestSelection = function () {
    openHub();
  };
  if (window.APEX_ARSENAL_SHELLS) {
    const inner = window.APEX_ARSENAL_SHELLS.beginSelection;
    window.APEX_ARSENAL_SHELLS.beginSelection = function () {
      if (window.__apexSkipHub) return inner && inner();
      openHub();
    };
  }

  if (window.APEX_ARSENAL_QUEST && window.APEX_ARSENAL_QUEST.onMatchOver) {
    const prev = window.APEX_ARSENAL_QUEST.onMatchOver;
    window.APEX_ARSENAL_QUEST.onMatchOver = function (winnerName) {
      const st = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
      const before = window.APEX_ARSENAL_QUEST.loadSave();
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
  }

  window.APEX_ARSENAL_META = {
    KEY, SHOP_COST, DRAW_COST,
    getState, credits, owns, buy, spin, award, filterOwned, setLast,
    load, save, emptyState, sanitize, poolLocked, lastAward: () => lastAward,
    openHub, hideMeta, paintShop, paintDraw, openFreePick,
  };
  window.apexArsenalMetaRuntime = 'ready';
})();
