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

  const PICK_ASSETS = '/assets/pick_ui_final/assets/';
  const META_CSS = `
    #aq-meta-root{position:absolute;inset:0;z-index:520;display:none;pointer-events:auto;background:#020305;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;color:#fff;}
    #aq-meta-stage{position:absolute;left:50%;top:50%;width:1672px;height:941px;transform:translate(-50%,-50%);overflow:hidden;background:#020305;}
    #aq-meta-stage .aq-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;}
    #aq-meta-stage .aq-veil{position:absolute;inset:0;background:linear-gradient(90deg,rgba(4,6,10,.55),rgba(4,6,10,.22) 42%,rgba(4,6,10,.55));pointer-events:none;}
    #aq-meta-head{position:absolute;left:72px;right:72px;top:28px;display:flex;align-items:center;justify-content:space-between;z-index:3;}
    #aq-meta-head h1{margin:0;font:800 34px/1 "Segoe UI",sans-serif;letter-spacing:3px;text-shadow:0 2px 12px #000;}
    #aq-meta-head .aq-meta-stats{display:flex;gap:18px;font:700 16px/1 "Segoe UI",sans-serif;background:rgba(8,10,16,.55);padding:10px 16px;border:1px solid rgba(255,255,255,.18);}
    .aq-back{min-width:44px;min-height:44px;border:0;background:transparent url(${PICK_ASSETS}14-exit-normal.webp) center/contain no-repeat;color:transparent;cursor:pointer;}
    .aq-ident{position:absolute;left:72px;top:118px;width:500px;height:690px;background:url(${PICK_ASSETS}02-side-frame-base.webp) center/100% 100% no-repeat;display:flex;flex-direction:column;align-items:center;padding:86px 36px 40px;box-sizing:border-box;z-index:2;}
    .aq-ident .aq-plate{width:78%;flex:1;background:linear-gradient(180deg,#2a3140,#12151c);border:1px solid rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font:800 72px/1 "Segoe UI",sans-serif;letter-spacing:2px;}
    .aq-ident .aq-sel{margin-top:18px;font:800 28px/1 "Segoe UI",sans-serif;}
    .aq-ident .aq-tag{margin-top:8px;opacity:.8;font:600 13px/1 "Segoe UI",sans-serif;letter-spacing:2px;}
    #aq-change{margin-top:22px;min-height:48px;min-width:220px;border:0;cursor:pointer;color:#fff;font:800 14px "Segoe UI",sans-serif;letter-spacing:1px;background:transparent url(${PICK_ASSETS}11-start-normal.webp) center/100% 100% no-repeat;padding:0 18px;}
    #aq-hub-grid{position:absolute;left:625px;top:150px;width:965px;height:640px;display:grid;grid-template-columns:1fr 1fr;gap:22px;z-index:2;}
    #aq-hub .aq-tile{position:relative;min-height:44px;border:0;cursor:pointer;color:#fff;text-align:left;padding:36px 28px 28px;font:800 26px/1.1 "Segoe UI",sans-serif;letter-spacing:1px;background:url(${PICK_ASSETS}06-stats-panel-base.webp) center/100% 100% no-repeat;filter:drop-shadow(0 10px 18px rgba(0,0,0,.45));transition:transform .14s ease, filter .14s ease;}
    #aq-hub .aq-tile:hover{transform:translateY(-6px);filter:drop-shadow(0 16px 22px rgba(0,0,0,.55)) brightness(1.08);}
    #aq-hub .aq-tile:active{transform:scale(.98);}
    #aq-hub .aq-tile div{margin-top:12px;font:600 14px/1.35 "Segoe UI",sans-serif;opacity:.82;letter-spacing:0;}
    .aq-shop-grid{position:absolute;left:72px;top:110px;right:430px;bottom:48px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;overflow:auto;z-index:2;}
    .aq-shop-grid button{min-height:110px;border:0;cursor:pointer;color:#fff;font:800 13px "Segoe UI",sans-serif;background:url(${PICK_ASSETS}07-card-frame-normal.webp) center/100% 100% no-repeat;padding:18px 10px 12px;}
    .aq-shop-grid button div{margin-top:8px;font:700 11px "Segoe UI",sans-serif;opacity:.85;}
    .aq-detail{position:absolute;right:72px;top:110px;width:330px;bottom:48px;background:url(${PICK_ASSETS}06-stats-panel-base.webp) center/100% 100% no-repeat;padding:36px 28px;box-sizing:border-box;z-index:2;font:600 15px/1.4 "Segoe UI",sans-serif;}
    .aq-draw-wrap{position:absolute;inset:110px 72px 48px;display:flex;gap:28px;z-index:2;}
    #aq-wheel{width:610px;height:610px;border-radius:50%;border:10px solid rgba(255,210,140,.85);box-shadow:0 0 40px rgba(0,0,0,.55), inset 0 0 40px rgba(0,0,0,.35);background:conic-gradient(#6a4a22,#1c2230,#8a6a38,#1c2230,#6a4a22);}
    .aq-draw-side{width:360px;background:url(${PICK_ASSETS}06-stats-panel-base.webp) center/100% 100% no-repeat;padding:32px 26px;box-sizing:border-box;}
    #aq-spin{margin-top:22px;min-height:52px;width:100%;border:0;cursor:pointer;color:#fff;font:800 16px "Segoe UI",sans-serif;background:transparent url(${PICK_ASSETS}11-start-normal.webp) center/100% 100% no-repeat;}
  `;
  function host() {
    return document.getElementById('game-wrap') || document.getElementById('game-wrapper') || document.body;
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
    const el = document.getElementById('aq-meta-root');
    if (el) el.style.display = 'none';
  }
  function paintHub() {
    const el = ensureRoot();
    const ownedN = state.ownedFighters.length;
    const total = ROSTER().length;
    const quest = window.APEX_ARSENAL_QUEST && window.APEX_ARSENAL_QUEST.loadSave ? window.APEX_ARSENAL_QUEST.loadSave() : { completedStages: [] };
    const cleared = (quest.completedStages || []).length;
    const glyph = String(state.lastSelectedP1 || 'NEWBIE').slice(0, 2);
    el.style.display = 'block';
    el.innerHTML = shell(`
      <div id="aq-hub">
        <div id="aq-meta-head">
          <h1>ARSENAL QUEST</h1>
          <div class="aq-meta-stats"><span id="aq-ac">AC ${state.credits}</span><span>FIGHTERS ${ownedN} / ${total}</span></div>
        </div>
        <div class="aq-ident">
          <div class="aq-plate">${glyph}</div>
          <div class="aq-sel">${state.lastSelectedP1}</div>
          <div class="aq-tag">SELECTED</div>
          <button id="aq-change" type="button">CHANGE FIGHTER</button>
        </div>
        <div id="aq-hub-grid">
          <button data-go="free" class="aq-tile">FREE BATTLE<div>Local 1v1 — choose both fighters</div></button>
          <button data-go="quest" class="aq-tile">QUEST MAP<div>20-stage Arsenal ladder</div><div>${cleared} / 20 CLEARED</div></button>
          <button data-go="shop" class="aq-tile">FIGHTER SHOP<div>Direct unlock — 1000 AC</div></button>
          <button data-go="draw" class="aq-tile">LUCKY DRAW<div>Random new fighter — 350 AC — no duplicates</div></button>
        </div>
      </div>`);
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
      const vis = owned ? 'opacity:1' : 'opacity:0.62;filter:grayscale(0.55)';
      return `<button data-buy="${n}" style="${vis}">${n}<div>${label}</div></button>`;
    }).join('');
    el.style.display = 'block';
    el.innerHTML = shell(`
      <div id="aq-meta-head"><button class="aq-back" id="aq-shop-back" type="button">BACK</button><h1>FIGHTER SHOP</h1><div class="aq-meta-stats">AC ${state.credits}</div></div>
      <div class="aq-shop-grid">${cards}</div>
      <div class="aq-detail" id="aq-shop-detail">Select a fighter. Direct unlock is 1000 AC. Newbie cannot be bought.</div>`);
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
    el.innerHTML = shell(`
      <div id="aq-meta-head"><button class="aq-back" id="aq-draw-back" type="button">BACK</button><h1>LUCKY DRAW</h1><div class="aq-meta-stats">AC ${state.credits}</div></div>
      <div class="aq-draw-wrap">
        <div id="aq-wheel"></div>
        <div class="aq-draw-side">
          <div>Cost 350 AC</div>
          <div style="margin-top:8px">Locked ${locked.length}</div>
          <div style="margin-top:8px">No duplicates</div>
          <button id="aq-spin" type="button">${locked.length ? 'SPIN' : 'ROSTER COMPLETE'}</button>
          <div id="aq-draw-result" style="margin-top:16px;"></div>
        </div>
      </div>`);
    el.querySelector('#aq-draw-back').onclick = paintHub;
    el.querySelector('#aq-spin').onclick = () => {
      const r = spin();
      const out = el.querySelector('#aq-draw-result');
      if (!r.ok) { out.textContent = r.reason === 'need' ? `NEED ${r.need} AC` : (r.reason === 'complete' ? 'ROSTER COMPLETE' : r.reason); return; }
      out.innerHTML = `<div style="font:800 22px Segoe UI">${r.name}</div><div>UNLOCKED</div><button id="aq-use-now" style="margin-top:12px;min-height:44px;width:100%;border:0;color:#fff;font:800 14px Segoe UI;background:transparent url(${PICK_ASSETS}11-start-normal.webp) center/100% 100% no-repeat;">USE NOW</button>`;
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
