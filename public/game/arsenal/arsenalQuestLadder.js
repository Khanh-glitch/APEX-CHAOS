// Arsenal Quest V1 — first 20 stages. Data-driven ladder + versioned local save.
(function apexArsenalQuestLadder() {
  if (window.apexArsenalQuestLadder === 'ready') return;

  const STORAGE_KEY = 'apexChaos.arsenalQuest.v1';
  const STAGES = [
    { n: 1, opponent: 'PAINTER' },
    { n: 2, opponent: 'DRUM' },
    { n: 3, opponent: 'CARD' },
    { n: 4, opponent: 'ICE' },
    { n: 5, opponent: 'MATH' },
    { n: 6, opponent: 'BLADE' },
    { n: 7, opponent: 'TOXIC' },
    { n: 8, opponent: 'ORBIT' },
    { n: 9, opponent: 'FLASH' },
    { n: 10, opponent: 'ELECTRIC' },
    { n: 11, opponent: 'VAMPIRE' },
    { n: 12, opponent: 'SAW' },
    { n: 13, opponent: 'HUNTER' },
    { n: 14, opponent: 'WOLF' },
    { n: 15, opponent: 'CRYSTAL' },
    { n: 16, opponent: 'MAGNET' },
    { n: 17, opponent: 'BLACK_HOLE' },
    { n: 18, opponent: 'WITCH' },
    { n: 19, opponent: 'TIME' },
    { n: 20, opponent: 'MONK' },
  ];
  const QUEST_CSS = `
    #aq-quest-map{position:fixed!important;inset:0!important;z-index:510;pointer-events:auto;overflow:auto;background:#080b0f;color:#f4f0e6;font-family:"ApcKanit","Segoe UI",sans-serif}
    #aq-quest-map *{box-sizing:border-box}
    #aq-quest-map button{pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;min-height:44px}
    #aq-quest-map button:focus-visible{outline:2px solid #f0d67e;outline-offset:3px}
    .aq-map-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.55) contrast(1.08) brightness(.4);pointer-events:none}
    .aq-map-veil{position:fixed;inset:0;background:linear-gradient(180deg,rgba(3,6,9,.32),rgba(3,6,9,.82)),radial-gradient(circle at 50% 42%,rgba(100,120,145,.12),transparent 38%);pointer-events:none}
    .aq-map-ui{position:relative;z-index:2;width:100%;max-width:1920px;min-height:100dvh;margin:auto;padding:clamp(18px,2.2vw,38px) clamp(18px,3vw,56px) 34px}
    .aq-map-top{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:18px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,.1)}
    .aq-map-brand{display:flex;gap:14px;align-items:center}
    .aq-map-back{display:grid;place-items:center;width:44px;height:44px;border:1px solid #4a5057;background:linear-gradient(180deg,#2b3138,#151a20);color:#f4f0e6;cursor:pointer;font:900 18px/1 sans-serif;clip-path:polygon(7px 0,100% 0,100% calc(100% - 7px),calc(100% - 7px) 100%,0 100%,0 7px)}
    .aq-map-kicker{color:#d7bd72;font:800 10px/1 ui-monospace,monospace;letter-spacing:.22em}
    .aq-map-title{margin:4px 0 0;font-size:clamp(24px,3vw,42px);line-height:.92;font-style:italic}
    .aq-map-actions{display:flex;gap:9px;align-items:center}
    .aq-map-actions button{min-height:44px;padding:0 15px;border:1px solid #404953;background:#151b21;color:#f3efe5;cursor:pointer;font:800 11px/1 "Segoe UI",sans-serif;letter-spacing:.07em}
    .aq-map-progress{display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;margin:20px 0 16px;padding:13px 15px;border:1px solid #303842;background:#0e1318}
    .aq-map-track{height:8px;background:#05080a;border:1px solid #323a43;overflow:hidden}
    .aq-map-fill{height:100%;background:linear-gradient(90deg,#776628,#d7bd72)}
    .aq-map-progress b{color:#e7d28d;font:900 13px/1 ui-monospace,monospace}
    .aq-map-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .aq-stage{position:relative;min-height:122px;padding:14px;border:1px solid #343d46;background:linear-gradient(180deg,#171d24,#0d1217);color:#f2eee5;text-align:left;cursor:pointer;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
    @media(hover:hover){.aq-stage:hover:not(:disabled){transform:translateY(-3px);filter:brightness(1.08);border-color:#59636d}}
    .aq-stage:disabled{cursor:default;opacity:.42;filter:saturate(.25)}
    .aq-stage[data-state="DONE"]{border-color:#5d7654}
    .aq-stage[data-state="OPEN"]{box-shadow:inset 3px 0 #d7bd72}
    .aq-stage-num{display:block;color:#7f8993;font:800 9px/1 ui-monospace,monospace;letter-spacing:.12em}
    .aq-stage-name{display:block;margin-top:12px;font-size:clamp(16px,1.45vw,22px);font-style:italic;font-weight:900;line-height:.95;overflow-wrap:anywhere}
    .aq-stage-state{display:inline-block;margin-top:14px;padding:5px 7px;border:1px solid #39424b;color:#d7bd72;font:800 8px/1 ui-monospace,monospace;letter-spacing:.12em}
    .aq-stage[data-state="DONE"] .aq-stage-state{color:#9fc08f;border-color:#455b40}
    @media(min-width:1600px){.aq-map-ui{max-width:none;padding-left:clamp(42px,3.4vw,72px);padding-right:clamp(42px,3.4vw,72px)}.aq-map-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.aq-stage{min-height:140px}}
    @media(max-width:1050px){.aq-map-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}
    @media(max-width:760px),(orientation:portrait){.aq-map-top{grid-template-columns:1fr}.aq-map-actions{justify-content:flex-start;flex-wrap:wrap}.aq-map-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.aq-map-ui{padding:16px}.aq-map-progress{grid-template-columns:1fr}.aq-stage{min-height:108px}}
    @media(max-width:460px){.aq-map-ui{padding:12px 10px max(18px,env(safe-area-inset-bottom))}.aq-map-grid{grid-template-columns:1fr}.aq-map-actions button{width:100%}}
  `;


  let pendingStage = null;
  let lastQuestP1 = null;

  function emptySave() {
    return { unlockedThrough: 1, completedStages: [] };
  }

  function loadSave() {
    try {
      const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return emptySave();
      const p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return emptySave();
      const unlockedThrough = Math.max(1, Math.min(20, p.unlockedThrough | 0 || 1));
      const completedStages = Array.isArray(p.completedStages)
        ? p.completedStages.map((n) => n | 0).filter((n) => n >= 1 && n <= 20)
        : [];
      return { unlockedThrough, completedStages };
    } catch (e) {
      return emptySave();
    }
  }

  function persist(save) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch (e) {}
    return save;
  }

  function stage(n) {
    return STAGES.find((s) => s.n === n) || null;
  }

  function liveOpponent(name) {
    const shells = window.APEX_ARSENAL_SHELLS;
    if (shells && shells.typeFor) {
      const t = shells.typeFor(name);
      if (t) return t.name;
    }
    const aliases = { MONK: 'KUNGFU', NOVA: 'GALAXY', WIND: 'PUPPET' };
    return aliases[name] || name;
  }

  function canPlay(n, save) {
    const s = save || loadSave();
    if (n < 1 || n > 20) return false;
    if (n <= s.unlockedThrough) return true;
    if (s.completedStages.includes(n)) return true;
    return false;
  }

  function recordWin(n) {
    const s = loadSave();
    if (!s.completedStages.includes(n)) s.completedStages.push(n);
    if (n >= s.unlockedThrough && n < 20) s.unlockedThrough = n + 1;
    if (n === 20) s.unlockedThrough = 20;
    return persist(s);
  }

  function hideMap() {
    const el = document.getElementById('aq-quest-map');
    if (el) el.style.display = 'none';
  }

  function openP1Selector() {
    window.__apexArsenalSelectPending = true;
    window.__apexArsenalQuestPick = true;
    window.__apexArsenalFreeBattle = false;
    const meta = window.APEX_ARSENAL_META;
    if (meta && typeof meta.openFighterPick === 'function') {
      meta.openFighterPick({ mode: 'quest' });
      return;
    }
    const shells = window.APEX_ARSENAL_SHELLS;
    if (shells && shells.beginSelection) shells.beginSelection();
    else if (typeof window.goToSelect === 'function') window.goToSelect();
  }

  function startStage(n, p1Name) {
    const row = stage(n);
    if (!row) return { ok: false, reason: 'missing' };
    if (!canPlay(n)) return { ok: false, reason: 'locked' };
    if (!p1Name) return { ok: false, reason: 'needP1', pending: { n, opponent: row.opponent } };
    const p2 = liveOpponent(row.opponent);
    lastQuestP1 = p1Name;
    pendingStage = null;
    hideMap();
    if (typeof window.startArsenalQuestMode === 'function') {
      window.startArsenalQuestMode(p1Name, p2);
      if (window.APEX_ARSENAL && window.APEX_ARSENAL.state) {
        window.APEX_ARSENAL.state.questStage = n;
        window.APEX_ARSENAL.state.questOpponent = row.opponent;
        window.APEX_ARSENAL.state.questP1 = p1Name;
      }
    }
    return { ok: true, n, opponent: row.opponent, live: p2, p1: p1Name };
  }

  function requestStage(n) {
    const row = stage(n);
    if (!row) return { ok: false, reason: 'missing' };
    if (!canPlay(n)) return { ok: false, reason: 'locked' };
    pendingStage = { n, opponent: row.opponent };
    hideMap();
    openP1Selector();
    return { ok: true, started: false, pending: { n: pendingStage.n, opponent: pendingStage.opponent } };
  }

  function consumePending() {
    const p = pendingStage;
    pendingStage = null;
    return p;
  }

  function peekPending() {
    return pendingStage;
  }

  function confirmP1(p1Name) {
    const p = pendingStage || peekPending();
    if (!p) return { ok: false, reason: 'noPending' };
    return startStage(p.n, p1Name);
  }

  function replay() {
    const st = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
    const n = st && st.questStage;
    const p1 = (st && st.questP1) || lastQuestP1;
    if (!n || !p1) return { ok: false, reason: 'noQuest' };
    return startStage(n, p1);
  }

  function nextStage() {
    const st = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
    const n = st && st.questStage;
    const p1 = (st && st.questP1) || lastQuestP1;
    if (!n || n >= 20) return { ok: false, reason: 'noNext' };
    if (!p1) return { ok: false, reason: 'needP1' };
    return startStage(n + 1, p1);
  }

  function resultActions(state) {
    const st = state || (window.APEX_ARSENAL && window.APEX_ARSENAL.state);
    if (!st || !st.over) return { mode: 'none', actions: [] };
    if (!st.questStage) return { mode: 'freeplay', actions: ['REMATCH', 'MENU'] };
    const p1 = (typeof fighters !== 'undefined' && fighters[0]) ? fighters[0].name : st.questP1;
    const won = st.over === p1;
    if (won) {
      const actions = st.questStage >= 20 ? ['REPLAY', 'QUEST MAP'] : ['NEXT', 'REPLAY', 'QUEST MAP'];
      return { mode: 'quest-win', actions, stage: st.questStage };
    }
    return { mode: 'quest-loss', actions: ['RETRY', 'QUEST MAP'], stage: st.questStage };
  }

  function onMatchOver(winnerName) {
    const st = window.APEX_ARSENAL && window.APEX_ARSENAL.state;
    if (!st || !st.questStage) return;
    const p1 = (typeof fighters !== 'undefined' && fighters[0]) ? fighters[0].name : null;
    if (winnerName === p1 || winnerName === 'P1' || (fighters[0] && winnerName === fighters[0].type?.name)) {
      recordWin(st.questStage);
    }
  }

  function returnToMap() {
    pendingStage = null;
    if (typeof window.exitArsenalQuestMode === 'function' && window.APEX_ARSENAL && window.APEX_ARSENAL.state && window.APEX_ARSENAL.state.active) {
      window.exitArsenalQuestMode();
    }
    showMap();
  }

  function showMap() {
    let el = document.getElementById('aq-quest-map');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aq-quest-map';
      document.body.appendChild(el);
    }
    const save = loadSave();
    const cleared = save.completedStages.length;
    el.style.display = 'block';
    const cells = STAGES.map((s) => {
      const done = save.completedStages.includes(s.n);
      const open = canPlay(s.n, save);
      const st = done ? 'DONE' : open ? 'OPEN' : 'LOCK';
      return `<button type="button" class="aq-stage" data-n="${s.n}" data-state="${st}" ${open ? '' : 'disabled'}><span class="aq-stage-num">STAGE ${String(s.n).padStart(2,'0')}</span><span class="aq-stage-name">${s.opponent}</span><span class="aq-stage-state">${st}</span></button>`;
    }).join('');
    el.innerHTML = `<style>${QUEST_CSS}</style><img class="aq-map-bg" alt="" src="/assets/pick_ui_final/assets/01-select-screen-background.webp"/><div class="aq-map-veil"></div>
      <main class="aq-map-ui">
        <header class="aq-map-top">
          <div class="aq-map-brand"><button id="aq-quest-close" class="aq-map-back" type="button" aria-label="Back to Arsenal Hub">←</button><div><div class="aq-map-kicker">ARSENAL · CAMPAIGN</div><h1 class="aq-map-title">QUEST MAP</h1></div></div>
          <div class="aq-map-actions"><button id="aq-quest-freeplay" type="button">FREE BATTLE</button></div>
        </header>
        <section class="aq-map-progress"><div class="aq-map-track"><div class="aq-map-fill" style="width:${Math.round((cleared/20)*100)}%"></div></div><b>${cleared} / 20 CLEARED</b></section>
        <section id="aq-quest-map-grid" class="aq-map-grid">${cells}</section>
      </main>`;
    el.onclick = (e) => {
      const stageButton = e.target && e.target.closest ? e.target.closest('[data-n]') : null;
      if (stageButton) { requestStage(parseInt(stageButton.getAttribute('data-n'), 10)); return; }
      const close = e.target && e.target.closest ? e.target.closest('#aq-quest-close') : null;
      if (close) {
        pendingStage = null;
        el.style.display = 'none';
        const M = window.APEX_ARSENAL_META;
        if (M && typeof M.openHub === 'function') M.openHub();
        return;
      }
      const free = e.target && e.target.closest ? e.target.closest('#aq-quest-freeplay') : null;
      if (free) {
        pendingStage = null;
        el.style.display = 'none';
        if (window.APEX_ARSENAL_META && typeof window.APEX_ARSENAL_META.openFreePick === 'function') window.APEX_ARSENAL_META.openFreePick();
        else if (typeof window.beginArsenalQuestSelection === 'function') window.beginArsenalQuestSelection();
      }
    };
    el.onkeydown = (e) => {
      if (e.key === 'Escape') el.querySelector('#aq-quest-close')?.click();
    };
    return el;
  }

  function beginArsenalQuestMap() {
    if (typeof window.__apexEnsureDeferredRuntimes === 'function') {
      window.__apexEnsureDeferredRuntimes('arsenalQuest').then(() => showMap()).catch(() => showMap());
      return;
    }
    showMap();
  }

  const prevStart = window.startMatch;
  window.startMatch = function (...args) {
    if (pendingStage && window.__apexArsenalSelectPending) {
      window.__apexArsenalSelectPending = false;
      const p1 = (typeof p1Selection !== 'undefined' && p1Selection) ? p1Selection.name : null;
      if (p1) return startStage(pendingStage.n, p1);
    }
    if (typeof prevStart === 'function') return prevStart.apply(this, args);
  };

  const prevMenu = window.goToMenu;
  window.goToMenu = function (...args) {
    const had = !!pendingStage;
    if (had) pendingStage = null;
    const r = typeof prevMenu === 'function' ? prevMenu.apply(this, args) : undefined;
    if (had) showMap();
    return r;
  };

  window.beginArsenalQuestMap = beginArsenalQuestMap;

  window.APEX_ARSENAL_QUEST = {
    STORAGE_KEY,
    STAGES,
    loadSave,
    persist,
    emptySave,
    stage,
    liveOpponent,
    canPlay,
    recordWin,
    startStage,
    requestStage,
    consumePending,
    peekPending,
    confirmP1,
    replay,
    nextStage,
    resultActions,
    onMatchOver,
    returnToMap,
    showMap,
    beginArsenalQuestMap,
  };
  window.apexArsenalQuestLadder = 'ready';
})();
