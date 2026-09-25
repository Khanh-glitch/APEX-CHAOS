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
      el.style.cssText = 'position:absolute;inset:0;z-index:510;pointer-events:auto;';
      (document.getElementById('game-wrap') || document.getElementById('game-wrapper') || document.body).appendChild(el);
    }
    const save = loadSave();
    el.style.display = 'block';
    const cells = STAGES.map((s) => {
      const done = save.completedStages.includes(s.n);
      const open = canPlay(s.n, save);
      const st = done ? 'DONE' : open ? 'OPEN' : 'LOCK';
      const op = open ? '1' : '.45';
      return `<button data-n="${s.n}" ${open ? '' : 'disabled'} style="min-height:72px;opacity:${op};border:0;color:#fff;font:800 13px Segoe UI,sans-serif;background:url(/assets/pick_ui_final/assets/07-card-frame-normal.webp) center/100% 100% no-repeat;cursor:${open ? 'pointer' : 'default'};">${s.n}. ${s.opponent}<div style="margin-top:6px;font:700 11px Segoe UI">${st}</div></button>`;
    }).join('');
    el.innerHTML = `<div style="position:absolute;left:50%;top:50%;width:1672px;height:941px;transform:translate(-50%,-50%);overflow:hidden;background:#020305;font-family:Segoe UI,sans-serif;color:#fff">
      <img alt="" src="/assets/pick_ui_final/assets/01-select-screen-background.webp" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none"/>
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(4,6,10,.5),rgba(4,6,10,.2) 50%,rgba(4,6,10,.5));pointer-events:none"></div>
      <div style="position:relative;z-index:2;padding:28px 64px 24px;display:flex;justify-content:space-between;align-items:center">
        <div id="aq-quest-map-title" style="font:800 32px/1 Segoe UI;letter-spacing:2px">QUEST MAP</div>
        <div><button id="aq-quest-freeplay" style="min-height:44px;margin-right:12px;border:0;color:#fff;padding:0 22px;font:800 13px Segoe UI;background:transparent url(/assets/pick_ui_final/assets/11-start-normal.webp) center/100% 100% no-repeat">FREE PLAY</button>
        <button id="aq-quest-close" style="min-width:44px;min-height:44px;border:0;color:transparent;background:transparent url(/assets/pick_ui_final/assets/14-exit-normal.webp) center/contain no-repeat">CLOSE</button></div>
      </div>
      <div id="aq-quest-map-grid" style="position:relative;z-index:2;margin:8px 64px 0;display:grid;grid-template-columns:repeat(5,1fr);gap:12px">${cells}</div>
    </div>`;
    el.onclick = (e) => {
      const n = e.target && e.target.getAttribute && e.target.getAttribute('data-n');
      if (n) { requestStage(parseInt(n, 10)); return; }
      if (e.target && e.target.id === 'aq-quest-close') {
        pendingStage = null;
        el.style.display = 'none';
      }
      if (e.target && e.target.id === 'aq-quest-freeplay') {
        pendingStage = null;
        el.style.display = 'none';
        if (typeof window.beginArsenalQuestSelection === 'function') window.beginArsenalQuestSelection();
      }
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
