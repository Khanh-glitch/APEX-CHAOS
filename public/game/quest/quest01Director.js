// QUEST 01 — Q1 director. Story/checkpoint authority only: NEVER simulate combat.
// No Arsenal imports. No live Fighter objects persisted. Q1 is an unfinished opening.
(function quest01DirectorModule(root) {
  'use strict';
  if (root.APEX_QUEST01_DIRECTOR) return;
  const STORAGE_KEY = 'apex-chaos.quest01.progress.v1';
  const SCHEMA_VERSION = 1;
  const QUEST_ID = 'THE_ONES_THROWN_AWAY';
  const CONTENT_REVISION = 'q1-director-20261008';
  const NODES = Object.freeze([
    { id:'WAKE', label:'WAKE', type:'STORY', status:'PENDING_IMPLEMENTATION', copy:'NEWBOT awakens in SCRAP BASIN. The opening scene is not yet implemented.' },
    { id:'REFLEX', label:'REFLEX', type:'ENCOUNTER', encounterId:'E01', status:'PENDING_IMPLEMENTATION', copy:'The first J/K tutorial must use real accepted casts. This encounter is not yet implemented.' },
    { id:'WORKSHOP', label:'WORKSHOP — THREE FAILURES', type:'STORY', status:'PENDING_IMPLEMENTATION', copy:'NEWBOT, T.O.T and RIVET meet in the workshop. This story scene is not yet implemented.' },
    { id:'FIRST_WAKE', label:'FIRST WAKE', type:'ENCOUNTER', encounterId:'E02', status:'CP04_PREVIEW_ONLY', copy:'The isolated four-Fighter combat prototype can be played separately from Quest progression.' },
    { id:'SCRAP_SWARM', label:'SCRAP SWARM', type:'ENCOUNTER', encounterId:'E03', status:'PENDING_IMPLEMENTATION' },
    { id:'WEAPON_RAIN', label:'WEAPON RAIN', type:'ENCOUNTER', encounterId:'E04', status:'PENDING_IMPLEMENTATION' },
    { id:'CHARGE_THE_BREAKER', label:'CHARGE THE BREAKER', type:'ENCOUNTER', encounterId:'E05', status:'PENDING_IMPLEMENTATION' },
    { id:'BREACH_WAVES', label:'BREACH WAVES', type:'ENCOUNTER', encounterId:'E06', status:'PENDING_IMPLEMENTATION' },
    { id:'RIVET_OVERRIDDEN', label:'RIVET OVERRIDDEN', type:'ENCOUNTER', encounterId:'E07', status:'PENDING_IMPLEMENTATION' },
    { id:'TOT_LAST_CHOICE', label:'T.O.T — LAST CHOICE', type:'ENCOUNTER', encounterId:'E08', status:'PENDING_IMPLEMENTATION' },
    { id:'OUTSIDE', label:'OUTSIDE', type:'STORY', status:'PENDING_IMPLEMENTATION' }
  ]);
  const NODE_IDS = NODES.map(n => n.id);
  const byId = id => NODES.find(n => n.id === id) || null;
  const copy = value => JSON.parse(JSON.stringify(value));
  const safeStr = x => typeof x === 'string' ? x : '';
  let nextSession = 0;
  function makeState() {
    return {
      schemaVersion: SCHEMA_VERSION, questId: QUEST_ID, contentRevision: CONTENT_REVISION,
      checkpointId:'WAKE', encounterId:null, phaseId:'ENTRY',
      completedCueIds:[], stormbreakerArtifactPhase:'SEALED',
      sessionId:'quest01-' + Date.now() + '-' + (++nextSession),
      updatedAt:Date.now()
    };
  }
  function sanitize(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.schemaVersion !== SCHEMA_VERSION || value.questId !== QUEST_ID) return null;
    if (!byId(value.checkpointId)) return null;
    if (safeStr(value.contentRevision) !== CONTENT_REVISION) return null; // future migration must be explicit
    const node = byId(value.checkpointId);
    if (value.encounterId !== (node.encounterId || null)) return null;
    if (value.phaseId !== 'ENTRY') return null; // Q1 never persists mid-combat frames
    if (!Array.isArray(value.completedCueIds) || value.completedCueIds.length > 150
      || value.completedCueIds.some(x => typeof x !== 'string' || x.length > 128)) return null;
    if (value.stormbreakerArtifactPhase !== 'SEALED') return null;
    const id = safeStr(value.sessionId);
    if (!id || id.length > 128) return null;
    return {
      schemaVersion:SCHEMA_VERSION,questId:QUEST_ID,contentRevision:CONTENT_REVISION,
      checkpointId:node.id,encounterId:node.encounterId || null,phaseId:'ENTRY',
      completedCueIds:[...new Set(value.completedCueIds)],
      stormbreakerArtifactPhase:'SEALED',sessionId:id,
      updatedAt:Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now()
    };
  }
  function create(storage) {
    let current = null;
    let readError = null;
    function load() {
      if (current) return copy(current);
      let parsed = null;
      try { const raw = storage && storage.getItem(STORAGE_KEY); parsed = raw ? JSON.parse(raw) : null; }
      catch (error) { readError = String(error && error.message || error); }
      current = sanitize(parsed) || makeState();
      return copy(current);
    }
    function persist() {
      const state = load();
      try { storage && storage.setItem(STORAGE_KEY,JSON.stringify(state)); }
      catch (error) { readError = String(error && error.message || error); }
      return state;
    }
    function beginOrResume() { load(); return persist(); }
    function checkpoint() { return load(); }
    function diagnostics() {
      return {checkpointId:load().checkpointId,storageError:readError,revision:CONTENT_REVISION};
    }
    function transitionForTest(target) {
      // Not exposed on browser singleton. Node/VM-only proof of deterministic
      // route ordering. NOT quest completion and NOT a cheat/unlock API.
      const prev=load(),from=NODE_IDS.indexOf(prev.checkpointId),to=NODE_IDS.indexOf(target);
      if (to !== from + 1) return {ok:false,reason:'non-adjacent-or-unknown'};
      current={...prev,checkpointId:target,encounterId:byId(target).encounterId || null,
        phaseId:'ENTRY',updatedAt:Date.now()};
      return {ok:true,state:persist()};
    }
    return { beginOrResume,checkpoint,diagnostics, _transitionForNodeTest:transitionForTest };
  }
  const storage = root.localStorage || null;
  const core = create(storage);
  // Presentation lives only in the Gold Home document and never touches the
  // existing Gold HUD geometry, canvas or battle engine.
  let overlay = null;
  let callbacks = null;
  let previousFocus = null;
  const HAS_DOM = !!(root.document && root.document.createElement);
  function ensureView() {
    if (!HAS_DOM || overlay) return overlay;
    const d = root.document;
    const style = d.createElement('style');
    style.id='apexQuest01StageStyles';
    style.textContent=[
      '#apexQuest01Stage{position:fixed;inset:0;z-index:9200;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:rgba(3,5,8,.95);color:#e8e9e5;font-family:Arial,sans-serif;}',
      '#apexQuest01Stage[hidden]{display:none;}',
      '#apexQuest01Stage .q1-panel{width:min(580px,100%);max-height:90vh;overflow:auto;border:1px solid #665536;background:linear-gradient(140deg,#171b20,#0a0d12);box-shadow:0 18px 70px #000a;padding:clamp(20px,5vw,42px);}',
      '#apexQuest01Stage .q1-eyebrow{font-size:11px;letter-spacing:.22em;color:#c5a069;font-weight:700;}',
      '#apexQuest01Stage h2{font-size:clamp(36px,7vw,72px);line-height:1;margin:22px 0 10px;letter-spacing:.045em;}',
      '#apexQuest01Stage .q1-sub{font-size:13px;line-height:1.7;color:#c9cbd0;max-width:48ch;}',
      '#apexQuest01Stage .q1-status{margin:24px 0 12px;color:#c4a777;font-size:11px;letter-spacing:.13em;}',
      '#apexQuest01Stage .q1-actions{display:grid;gap:10px;margin-top:22px;}',
      '#apexQuest01Stage button{font:700 13px Arial,sans-serif;letter-spacing:.1em;min-height:48px;padding:12px 15px;border:1px solid #9a8259;color:#f6eee0;background:#403725;cursor:pointer;}',
      '#apexQuest01Stage button:focus-visible{outline:3px solid #f6c981;outline-offset:3px;}',
      '#apexQuest01Stage button.q1-back{background:transparent;border-color:#61666b;color:#d1d1cf;}',
      '#apexQuest01Stage .q1-fine{margin-top:16px;font-size:11px;color:#9fa5ad;line-height:1.5;}'
    ].join('\n');
    d.head.appendChild(style);
    overlay = d.createElement('section');
    overlay.id='apexQuest01Stage';overlay.hidden=true;overlay.tabIndex=-1;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Quest 01 story checkpoint');
    // Static trusted template: copy is set via textContent only.
    overlay.innerHTML='<div class="q1-panel"><div class="q1-eyebrow">QUEST 01 // THE ONES THROWN AWAY</div><h2 id="q1Title"></h2><p class="q1-sub" id="q1Copy"></p><p class="q1-status" id="q1Status"></p><div class="q1-actions"><button type="button" id="q1Preview">PLAYTEST FIRST WAKE · CP04</button><button type="button" id="q4ReflexPreview">PLAYTEST REFLEX · Q4A</button><button type="button" id="q4eStoryPreview">STORY + REFLEX · Q4E3</button><button type="button" class="q1-back" id="q1Exit">RETURN HOME</button></div><div class="q1-fine">Q1 DIRECTOR BUILD — This is a checkpoint shell, not the finished WAKE or REFLEX scene. Neither preview completes story checkpoints; REFLEX currently stops before the unauthored RIVET suppression.</div></div>';
    d.body.appendChild(overlay);
    overlay.querySelector('#q1Exit').addEventListener('click',hide);
    overlay.querySelector('#q1Preview').addEventListener('click',()=>{const cb=callbacks && callbacks.onPreview;hide(); if(typeof cb==='function')cb();});
    overlay.querySelector('#q4ReflexPreview').addEventListener('click',()=>{const cb=callbacks && callbacks.onReflexPreview;hide();root.__APEX_QUEST_STORY_PLAYBACK=false;if(typeof cb==='function')cb();});
    // The Story preview is an isolated alternative presentation of the same
    // Arsenal duel. It cannot mark REFLEX complete, unlock a checkpoint or
    // be reached by a generic Story save transition.
    overlay.querySelector('#q4eStoryPreview').addEventListener('click',()=>{
      const cb=callbacks&&callbacks.onReflexPreview;hide();
      root.__APEX_QUEST_STORY_PLAYBACK=true;
      if(typeof cb==='function')cb();
    });
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();hide();}else if(e.key==='Tab'){const els=[overlay.querySelector('#q1Preview'),overlay.querySelector('#q4ReflexPreview'),overlay.querySelector('#q4eStoryPreview'),overlay.querySelector('#q1Exit')];const index=els.indexOf(d.activeElement);if(e.shiftKey&&index===0){e.preventDefault();els[els.length-1].focus();}if(!e.shiftKey&&index===els.length-1){e.preventDefault();els[0].focus();}}});
    return overlay;
  }
  function show(options) {
    const el=ensureView();
    const state=core.beginOrResume();
    if (!el) return state;
    callbacks=options||{};
    const node=byId(state.checkpointId);
    el.dataset.node=node.id;
    el.querySelector('#q1Title').textContent=node.label;
    el.querySelector('#q1Copy').textContent=node.copy || 'This story chapter has not yet been implemented.';
    el.querySelector('#q1Status').textContent='CHECKPOINT ' + String(NODE_IDS.indexOf(node.id)+1).padStart(2,'0') + ' / 11 · ' + node.status.replaceAll('_',' ');
    previousFocus=root.document.activeElement;
    el.hidden=false;
    el.querySelector('#q1Exit').focus({preventScroll:true});
    return state;
  }
  function hide() {
    if (!overlay || overlay.hidden) return false;
    overlay.hidden=true;callbacks=null;
    if (previousFocus && typeof previousFocus.focus==='function') previousFocus.focus({preventScroll:true});
    return true;
  }
  const api=Object.freeze({
    beginOrResume:core.beginOrResume, checkpoint:core.checkpoint,
    diagnostics:core.diagnostics, show, hide, isVisible:()=>!!(overlay&&!overlay.hidden),
    sequence:()=>NODES.map(({id,label,type,status,encounterId})=>({id,label,type,status,encounterId:encounterId||null})),
    STORAGE_KEY
  });
  root.APEX_QUEST01_DIRECTOR = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports={create,makeState,sanitize,NODES,STORAGE_KEY,CONTENT_REVISION};
  }
})(typeof window !== 'undefined' ? window : globalThis);
