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
  let shopSelected = state.lastSelectedP1 || 'NEWBIE';
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
    const id = String(name || 'NEWBIE').toUpperCase();
    const shell = window.APEX_ARSENAL_SHELLS && window.APEX_ARSENAL_SHELLS.typeFor
      ? window.APEX_ARSENAL_SHELLS.typeFor(id) : null;
    const artId = FIGHTER_ART[id] || null;
    return {
      id,
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
    @media(hover:hover){.aq-action:hover{transform:translateY(-5px);filter:brightness(1.08);border-color:#59636d}}
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
    const ownedN = state.ownedFighters.length;
    const total = ROSTER().length;
    const quest = window.APEX_ARSENAL_QUEST && window.APEX_ARSENAL_QUEST.loadSave ? window.APEX_ARSENAL_QUEST.loadSave() : { completedStages: [] };
    const cleared = (quest.completedStages || []).length;
    const info = fighterInfo(state.lastSelectedP1 || 'NEWBIE');
    el.style.display = 'block';
    el.innerHTML = shell(`
      <main class="aq-ui" id="aq-hub">
        <header class="aq-topbar">
          <div class="aq-brand">
            <button id="aq-hub-exit" class="aq-exit" type="button" aria-label="Back to main menu">←</button>
            <div class="aq-brand-copy"><div class="aq-kicker">APEX CHAOS · ARMORY</div><h1 class="aq-title">ARSENAL QUEST</h1></div>
          </div>
          <div class="aq-meta-stats">
            <div class="aq-stat"><span>ARSENAL CREDITS</span><b id="aq-ac">${state.credits} AC</b></div>
            <div class="aq-stat"><span>ROSTER</span><b>${ownedN} / ${total}</b></div>
            <button type="button" id="aq-splatter-mode" aria-label="Arsenal splatter mode">SPLATTER<br><b>${window.APEX_ARSENAL_FEEL?.getSplatterMode?.() || 'BLOOD'}</b></button>
          </div>
        </header>
        <section class="aq-hub-layout">
          <article class="aq-ident" style="--fighter-accent:${esc(info.color)}">
            <div class="aq-ident-label">ACTIVE FIGHTER</div>
            <div class="aq-plate" aria-hidden="true">${info.standing ? `<img class="aq-standing" src="${esc(info.standing)}" alt=""/>` : `<span class="aq-plate-mark">${esc(info.mark)}</span>`}</div>
            <div class="aq-sel">${esc(info.id)}</div>
            <div class="aq-tag">SELECTED</div>
            <button id="aq-change" class="aq-primary-btn" type="button">CHANGE FIGHTER</button>
          </article>
          <div class="aq-hub-grid">
            <button type="button" data-go="free" class="aq-action" style="--aq-tile-accent:#d7bd72"><span class="aq-action-index">01 · VERSUS</span><span class="aq-action-title">FREE BATTLE</span><span class="aq-action-desc">Local 1v1. Choose both owned fighters and jump straight into combat.</span><span class="aq-action-meta">OWNED ROSTER ONLY</span></button>
            <button type="button" data-go="quest" class="aq-action" style="--aq-tile-accent:#8fb3d2"><span class="aq-action-index">02 · CAMPAIGN</span><span class="aq-action-title">QUEST MAP</span><span class="aq-action-desc">Climb the 20-stage Arsenal ladder against fixed opponents.</span><span class="aq-action-meta">${cleared} / 20 CLEARED</span></button>
            <button type="button" data-go="shop" class="aq-action" style="--aq-tile-accent:#a8bf8b"><span class="aq-action-index">03 · ROSTER</span><span class="aq-action-title">FIGHTER SHOP</span><span class="aq-action-desc">Inspect every fighter and unlock directly with Arsenal Credits.</span><span class="aq-action-meta">1000 AC · FIXED PRICE</span></button>
            <button type="button" data-go="draw" class="aq-action" style="--aq-tile-accent:#d29c74"><span class="aq-action-index">04 · DRAW</span><span class="aq-action-title">LUCKY DRAW</span><span class="aq-action-desc">Randomly unlock one fighter from the remaining unowned pool.</span><span class="aq-action-meta">350 AC · NO DUPLICATES</span></button>
            <button type="button" data-go="lab" class="aq-action" style="--aq-tile-accent:#91d7e5"><span class="aq-action-index">05 · TESTING</span><span class="aq-action-title">ARSENAL LAB</span><span class="aq-action-desc">NEWBIE vs NEWBIE · endless health. Spawn exact equipment on demand.</span><span class="aq-action-meta">NO RANDOM SPAWNS · NO REWARDS</span></button>
          </div>
        </section>
      </main>`);
    el.querySelectorAll('[data-go]').forEach((b) => {
      b.addEventListener('click', () => {
        const go = b.getAttribute('data-go');
        if (go === 'free') openFreePick();
        if (go === 'quest') { hideMeta(); if (window.beginArsenalQuestMap) window.beginArsenalQuestMap(); }
        if (go === 'shop') paintShop();
        if (go === 'draw') paintDraw();
        if (go === 'lab') { hideMeta(); window.startArsenalLab?.(); }
      });
    });
    el.querySelector('#aq-splatter-mode')?.addEventListener('click', () => {
      const feel = window.APEX_ARSENAL_FEEL;
      if (!feel) return;
      feel.setSplatterMode(feel.getSplatterMode() === 'BLOOD' ? 'FIGHTER COLOR' : 'BLOOD');
      el.querySelector('#aq-splatter-mode b').textContent = feel.getSplatterMode();
    });
    el.querySelector('#aq-change')?.addEventListener('click', openFreePick);
    el.querySelector('#aq-hub-exit')?.addEventListener('click', () => {
      hideMeta();
      if (typeof goToMenu === 'function') goToMenu();
      else if (typeof window.goToMenu === 'function') window.goToMenu();
    });
    const grid = el.querySelector('.aq-hub-grid');
    wireGridNav(grid, '[data-go]', 2);
  }
  function paintShop(selectedName) {
    cancelDrawSpinAnimation();
    const el = ensureRoot();
    const ids = ROSTER();
    shopSelected = String(selectedName || state.lastSelectedP1 || shopSelected || 'NEWBIE').toUpperCase();
    if (!ids.includes(shopSelected)) shopSelected = 'NEWBIE';
    const selected = fighterInfo(shopSelected);
    const selectedOwned = owns(shopSelected);
    const cards = ids.map((n) => {
      const owned = owns(n);
      const info = fighterInfo(n);
      const label = n === 'NEWBIE' ? 'DEFAULT / OWNED' : owned ? 'OWNED' : '1000 AC';
      return `<button type="button" data-shop-card="${esc(n)}" class="aq-fighter-card ${owned ? '' : 'is-locked'} ${n === shopSelected ? 'is-selected' : ''}" style="--fighter-accent:${esc(info.color)}"><span class="aq-fighter-mark">${info.icon ? `<img src="${esc(info.icon)}" alt=""/>` : esc(info.mark)}</span><span class="aq-fighter-name">${esc(n)}</span><span class="aq-fighter-state">${label}</span></button>`;
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
            <h2>${esc(selected.id)}</h2>
            <p>${esc(selected.desc)}</p>
            <div class="aq-detail-status">${shopSelected === 'NEWBIE' ? 'DEFAULT / OWNED' : selectedOwned ? 'OWNED' : 'LOCKED · 1000 AC'}</div>
            <div id="aq-shop-message" class="aq-detail-message"></div>
            <button id="aq-buy" class="aq-buy" type="button" ${(selectedOwned || shopSelected === 'NEWBIE') ? 'disabled' : ''}>${selectedOwned || shopSelected === 'NEWBIE' ? 'OWNED' : 'UNLOCK · 1000 AC'}</button>
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
        if (nextMsg) nextMsg.textContent = `${shopSelected} UNLOCKED`;
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
      return `<span class="aq-wheel-label" style="transform:rotate(${a}deg) translateY(max(-25vmin,-245px)) rotate(${-a}deg)">${esc(n)}</span>`;
    }).join('');
    const result = lastDrawResult
      ? `<div class="aq-draw-result"><strong>${esc(lastDrawResult.name)}</strong><span>UNLOCKED</span><div class="aq-draw-actions"><button id="aq-use-now" type="button">USE NOW</button><button id="aq-spin-again" type="button">SPIN AGAIN</button></div></div>`
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
    hideMeta();
    const mode = (opts && opts.mode) || 'free';
    window.__apexArsenalSelectPending = true;
    window.__apexArsenalFreeBattle = mode === 'free';
    window.__apexArsenalQuestPick = mode === 'quest';
    const shells = window.APEX_ARSENAL_SHELLS;
    if (shells && typeof shells.beginSelection === 'function') shells.beginSelection();
    else if (typeof goToSelect === 'function') goToSelect();
    else if (typeof window.goToSelect === 'function') window.goToSelect();
  }
  function openFreePick() {
    openFighterPick({ mode: 'free' });
  }
  function openHub() {
    state = load();
    paintHub();
  }

  window.beginArsenalQuestSelection = function () {
    openHub();
  };

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
    openHub, hideMeta, paintShop, paintDraw, openFreePick, openFighterPick,
  };
  window.apexArsenalMetaRuntime = 'ready';
})();
