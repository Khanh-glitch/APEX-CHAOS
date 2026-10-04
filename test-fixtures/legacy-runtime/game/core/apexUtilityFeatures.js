// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_UTILITY_FEATURES_PATCH(){
  if (window.__apexUtilityFeaturesPatch) return;
  window.__apexUtilityFeaturesPatch = true;
  const recorder = {
    media:null, chunks:[], stream:null, raf:0, canvas:null, ctx:null,
    url:null, blob:null, ext:'mp4', started:false, stopping:false,
    audioDestination:null, panelCache:null, panelCacheAt:0,
    hpVisual:[{pct:1,trail:1,holdUntil:0,lastAt:0},{pct:1,trail:1,holdUntil:0,lastAt:0}]
  };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function bestMime() {
    if (typeof MediaRecorder === 'undefined') return '';
    const prefs = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    return prefs.find(m => MediaRecorder.isTypeSupported(m)) || '';
  }
  function hpText(f) {
    if (!f) return '0 / 0';
    const hp = Number.isFinite(f.hp) ? f.hp.toFixed(1) : 'INF';
    const max = Number.isFinite(f.maxHp) ? f.maxHp.toFixed(0) : 'INF';
    return `${hp} / ${max}`;
  }
  function drawRecordHeader(rctx, x, y, w, f, side) {
    const index = side === 'P1' ? 0 : 1;
    const now = performance.now();
    const visual = recorder.hpVisual[index];
    const pctHp = f && Number.isFinite(f.maxHp) ? clamp(f.hp / Math.max(1,f.maxHp),0,1) : 1;
    const dt = visual.lastAt ? Math.min(.05, (now - visual.lastAt) / 1000) : 0;
    if (pctHp < visual.pct - .0001) {
      const loss = visual.pct - pctHp;
      visual.trail = Math.max(visual.trail, visual.pct);
      visual.holdUntil = now + (loss >= .16 ? 950 : 650);
    }
    if (now > visual.holdUntil) visual.trail += (pctHp - visual.trail) * (1 - Math.exp(-dt * .9));
    visual.trail = clamp(Math.max(pctHp, visual.trail), 0, 1);
    visual.pct = pctHp;
    visual.lastAt = now;
    rctx.save();
    rctx.fillStyle = f?.color || '#f3efe3';
    rctx.font = '900 30px Segoe UI, Arial';
    rctx.textAlign = side === 'P1' ? 'left' : 'right';
    rctx.fillText(f?.name || side, side === 'P1' ? x : x+w, y+34);
    const barY = y + 50;
    rctx.fillStyle = '#090909';
    rctx.fillRect(x,barY,w,26);
    const trailW = w * Math.max(0, visual.trail - pctHp);
    if (trailW > .5) {
      const trailX = side === 'P1' ? x + w * pctHp : x + w * (1 - visual.trail);
      const glow = rctx.createLinearGradient(trailX,0,trailX+trailW,0);
      glow.addColorStop(0,'rgba(255,255,255,.98)');
      glow.addColorStop(1,'rgba(255,239,184,.88)');
      rctx.fillStyle = glow;
      rctx.shadowColor = 'rgba(255,255,255,.9)';
      rctx.shadowBlur = 18;
      rctx.fillRect(trailX,barY,trailW,26);
      rctx.shadowBlur = 0;
    }
    rctx.fillStyle = f?.color || '#ffe7a0';
    const hpW = w * pctHp;
    rctx.fillRect(side === 'P1' ? x : x+w-hpW,barY,hpW,26);
    rctx.strokeStyle = '#6c6557';
    rctx.lineWidth = 2;
    rctx.strokeRect(x,barY,w,26);
    rctx.fillStyle = '#fff4cf';
    rctx.font = '900 17px Segoe UI, Arial';
    rctx.textAlign = 'center';
    rctx.fillText(hpText(f), x+w/2, y+70);
    rctx.restore();
  }
  function readRecordRows() {
    const now = performance.now();
    if (recorder.panelCache && now - recorder.panelCacheAt < 100) return recorder.panelCache;
    recorder.panelCache = [1,2].map(player => Array.from(document.querySelectorAll(`#ci-p${player}-rows .ci-row`)).slice(0,3).map(row => {
      const label = row.querySelector('.ci-label span')?.textContent || row.querySelector('.ci-textonly b')?.textContent || 'STAT';
      const value = row.querySelector('.ci-label b')?.textContent || row.querySelector('.ci-textonly')?.textContent?.replace(label,'') || '';
      const fill = row.querySelector('.ci-fill');
      const inlinePct = parseFloat(fill?.style?.width || '');
      const track = fill?.parentElement;
      const measuredPct = fill && track?.clientWidth ? fill.clientWidth / track.clientWidth * 100 : NaN;
      return {label:label.replace(':','').trim(),value:value.trim(),pct:clamp((Number.isFinite(inlinePct)?inlinePct:measuredPct)||0,0,100)};
    }));
    recorder.panelCacheAt = now;
    return recorder.panelCache;
  }
  function drawRecordPanel(rctx, x, y, w, h, f, side) {
    rctx.save();
    rctx.fillStyle = 'rgba(8,7,6,.94)';
    rctx.strokeStyle = f?.color || '#ffe7a0';
    rctx.lineWidth = 2;
    rctx.fillRect(x,y,w,h);
    rctx.strokeRect(x,y,w,h);
    rctx.fillStyle = f?.color || '#f3efe3';
    rctx.font = '900 22px Segoe UI, Arial';
    rctx.textAlign = 'left';
    rctx.fillText(`${side}  ${f?.name || ''}`, x+18, y+30);
    const rows = readRecordRows()[side === 'P1' ? 0 : 1];
    rows.forEach((row, i) => {
      const rowY = y + 64 + i * 96;
      rctx.font = '800 17px Segoe UI, Arial';
      rctx.fillStyle = '#cfc3a8';
      rctx.textAlign = side === 'P1' ? 'left' : 'right';
      rctx.fillText(row.label, side === 'P1' ? x+18 : x+w-18, rowY);
      rctx.fillStyle = '#fff4cf';
      rctx.textAlign = side === 'P1' ? 'right' : 'left';
      rctx.fillText(row.value, side === 'P1' ? x+w-18 : x+18, rowY);
      const trackX = x + 18, trackY = rowY + 15, trackW = w - 36, trackH = 22;
      rctx.fillStyle = '#111';
      rctx.fillRect(trackX,trackY,trackW,trackH);
      const fillW = trackW * row.pct / 100;
      rctx.fillStyle = f?.color || '#ffe7a0';
      rctx.fillRect(side === 'P1' ? trackX : trackX+trackW-fillW,trackY,fillW,trackH);
      rctx.strokeStyle = '#6c6557';
      rctx.lineWidth = 2;
      rctx.strokeRect(trackX,trackY,trackW,trackH);
    });
    rctx.restore();
  }
  function drawRecordingFrame() {
    if (!recorder.started || !recorder.ctx) return;
    const rctx = recorder.ctx;
    rctx.fillStyle = '#050403';
    rctx.fillRect(0,0,720,1280);
    const arenaSize = 720;
    const arenaY = 144;
    rctx.drawImage(canvas, 0, arenaY, arenaSize, arenaSize);
    rctx.strokeStyle = '#6c6557';
    rctx.lineWidth = 4;
    rctx.strokeRect(2,arenaY+2,arenaSize-4,arenaSize-4);
    drawRecordHeader(rctx, 18, 18, 328, fighters[0], 'P1');
    drawRecordHeader(rctx, 374, 18, 328, fighters[1], 'P2');
    drawRecordPanel(rctx, 18, 884, 332, 372, fighters[0], 'P1');
    drawRecordPanel(rctx, 370, 884, 332, 372, fighters[1], 'P2');
    recorder.raf = requestAnimationFrame(drawRecordingFrame);
  }
  function setSaveButton(enabled, label) {
    const btn = document.getElementById('save-replay-btn');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.textContent = label || (enabled ? 'Save Replay' : 'Recording...');
  }
  function clearRecordingBlob() {
    if (recorder.url) URL.revokeObjectURL(recorder.url);
    recorder.url = null;
    recorder.blob = null;
    recorder.chunks = [];
    setSaveButton(false, 'Save Replay');
  }
  function startMatchRecording() {
    clearRecordingBlob();
    if (typeof MediaRecorder === 'undefined' || !canvas?.captureStream) return;
    try { if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (error) {}
    const mime = bestMime();
    recorder.ext = mime.includes('mp4') ? 'mp4' : 'webm';
    recorder.canvas ||= document.createElement('canvas');
    recorder.canvas.width = 720;
    recorder.canvas.height = 1280;
    recorder.ctx = recorder.canvas.getContext('2d');
    recorder.panelCache = null;
    recorder.panelCacheAt = 0;
    recorder.hpVisual = [{pct:1,trail:1,holdUntil:0,lastAt:0},{pct:1,trail:1,holdUntil:0,lastAt:0}];
    recorder.stream = recorder.canvas.captureStream(30);
    try {
      recorder.audioDestination = audioCtx.createMediaStreamDestination();
      battleAudioMaster.connect(recorder.audioDestination);
      window.__apexRecordingAudioDestination = recorder.audioDestination;
      for (const track of recorder.audioDestination.stream.getAudioTracks()) recorder.stream.addTrack(track);
    } catch (error) {
      recorder.audioDestination = null;
      window.__apexRecordingAudioDestination = null;
    }
    try {
      recorder.media = new MediaRecorder(recorder.stream, mime ? { mimeType:mime, videoBitsPerSecond:6000000 } : { videoBitsPerSecond:6000000 });
    } catch (error) {
      try { recorder.stream?.getTracks?.().forEach(t => t.stop()); } catch (cleanupError) {}
      if (recorder.audioDestination) {
        try { battleAudioMaster.disconnect(recorder.audioDestination); } catch (cleanupError) {}
      }
      recorder.audioDestination = null;
      window.__apexRecordingAudioDestination = null;
      recorder.media = null;
      return;
    }
    recorder.chunks = [];
    recorder.started = true;
    recorder.stopping = false;
    recorder.media.ondataavailable = ev => { if (ev.data && ev.data.size) recorder.chunks.push(ev.data); };
    recorder.media.onstop = () => {
      recorder.started = false;
      recorder.stopping = false;
      cancelAnimationFrame(recorder.raf);
      const type = recorder.media?.mimeType || (recorder.ext === 'mp4' ? 'video/mp4' : 'video/webm');
      recorder.blob = new Blob(recorder.chunks, { type });
      recorder.url = URL.createObjectURL(recorder.blob);
      try { recorder.stream?.getTracks?.().forEach(t => t.stop()); } catch (error) {}
      if (recorder.audioDestination) {
        try { battleAudioMaster.disconnect(recorder.audioDestination); } catch (error) {}
      }
      recorder.audioDestination = null;
      window.__apexRecordingAudioDestination = null;
      setSaveButton(true, `Save Replay .${recorder.ext}`);
    };
    setSaveButton(false, 'Recording...');
    recorder.media.start(1000);
    requestAnimationFrame(drawRecordingFrame);
  }
  function stopMatchRecording() {
    if (!recorder.media || recorder.stopping || !recorder.started) return;
    recorder.stopping = true;
    try { recorder.media.stop(); } catch (error) {}
  }
  function replayFilename() {
    const clean = value => String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'fighter';
    const left = clean(fighters[0]?.name || 'P1');
    const right = clean(fighters[1]?.name || 'P2');
    return `apex-chaos-${left}-vs-${right}-${Date.now()}.${recorder.ext}`;
  }
  function downloadReplay(filename) {
    const a = document.createElement('a');
    a.href = recorder.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.saveLastReplay = async function() {
    if (!recorder.url || !recorder.blob) {
      setSaveButton(false, 'Replay unavailable');
      return;
    }
    const filename = replayFilename();
    const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
    if (isLocal) {
      setSaveButton(false, 'Saving Replay...');
      try {
        const response = await fetch(`/__apex-save-replay?filename=${encodeURIComponent(filename)}`, {
          method: 'POST',
          headers: { 'Content-Type': recorder.blob.type || 'application/octet-stream' },
          body: recorder.blob
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
        setSaveButton(true, `Saved: ${result.filename}`);
        window.setTimeout(() => setSaveButton(true, `Save Replay .${recorder.ext}`), 3200);
        return result;
      } catch (error) {
        console.warn('[replay] Local save failed; using browser download.', error);
      }
    }
    downloadReplay(filename);
    setSaveButton(true, `Save Replay .${recorder.ext}`);
  };
  function applySandboxHero(fn) {
    const hero = fighters?.[0];
    if (!hero) return;
    fn(hero);
    updateHUD();
  }
  window.sandboxToggleRage = function() {
    applySandboxHero(f => {
      f.isRage = !f.isRage;
      if (f.isRage && f.type?.onRage) f.type.onRage(f);
    });
  };
  window.sandboxResetCooldowns = function() {
    applySandboxHero(f => {
      for (const key of Object.keys(f.data || {})) if (/cd|cooldown|timer|reload/i.test(key) && typeof f.data[key] === 'number') f.data[key] = 0;
      if (f.name === 'GALAXY') f.data.galaxyPressureCd = 0;
    });
  };
  window.sandboxSlowMotion = function() {
    timeScale = .5;
    setTimeout(() => { if (timeScale === .5) timeScale = 1; }, 5000);
  };
  window.runMatchupStats = function() {
    if (!p1Selection || !p2Selection) {
      const panel = document.getElementById('matchup-report') || document.getElementById('stats-panel');
      if (panel) panel.innerHTML = '<div class="stats-headline">Pick both fighters first</div>';
      return;
    }
    const panel = document.getElementById('matchup-report') || document.getElementById('stats-panel');
    const ft1 = p1Selection;
    const ft2 = p2Selection;
    const runs = 20;
    let p1Wins = 0;
    let p2Wins = 0;
    let draws = 0;
    let totalTime = 0;
    let totalDmg1 = 0;
    let totalDmg2 = 0;
    if (panel) panel.innerHTML = `<div class="stats-headline">RUNNING MATCHUP STATS x${runs}</div>`;
    const oldEndMatch = endMatch;
    const oldMediaPlay = typeof HTMLMediaElement !== 'undefined' ? HTMLMediaElement.prototype.play : null;
    const oldMasterValue = battleAudioMaster?.gain?.value ?? 1;
    try { battleAudioMaster.disconnect(); } catch (error) {}
    const audioPatches = [];
    const patchAudioSource = (proto) => {
      if (!proto) return;
      const oldStart = proto.start;
      const oldStop = proto.stop;
      if (typeof oldStart === 'function') {
        proto.start = function(...args) { if (window.__apexStatsSilent) { this.__apexStatsSkipped = true; return; } return oldStart.apply(this, args); };
        audioPatches.push(() => { proto.start = oldStart; });
      }
      if (typeof oldStop === 'function') {
        proto.stop = function(...args) { if (window.__apexStatsSilent || this.__apexStatsSkipped) return; return oldStop.apply(this, args); };
        audioPatches.push(() => { proto.stop = oldStop; });
      }
    };
    try {
      window.__apexStatsSilent = true;
      stopBattleAudio();
      if (oldMediaPlay) HTMLMediaElement.prototype.play = function() { return Promise.resolve(); };
      patchAudioSource(window.AudioScheduledSourceNode?.prototype);
      if (!window.AudioScheduledSourceNode) {
        patchAudioSource(window.AudioBufferSourceNode?.prototype);
        patchAudioSource(window.OscillatorNode?.prototype);
      }
      endMatch = function() {
        if (gameState !== 'PLAYING') return;
        gameState = 'END';
        autoBattlePaused = false;
        autoBattleControlsActive = false;
      };
      for (let i = 0; i < runs; i += 1) {
        startSpecificMatch(ft1, ft2, {countdown:false,tournament:false,statsRun:true});
        try { battleAudioMaster.gain.setValueAtTime(0, audioCtx.currentTime); } catch (error) {}
        let guard = 0;
        while (gameState === 'PLAYING' && guard++ < 20*90) update(1/20);
        const a = fighters[0];
        const b = fighters[1];
        if (Math.abs((a?.hp || 0) - (b?.hp || 0)) < .001) draws += 1;
        else if ((a?.hp || 0) > (b?.hp || 0)) p1Wins += 1;
        else p2Wins += 1;
        totalTime += matchClock || guard / 60;
        totalDmg1 += a?.damageDone || 0;
        totalDmg2 += b?.damageDone || 0;
      }
    } finally {
      endMatch = oldEndMatch;
      if (oldMediaPlay) HTMLMediaElement.prototype.play = oldMediaPlay;
      for (const restore of audioPatches.reverse()) restore();
      window.__apexStatsSilent = false;
      try { battleAudioMaster.connect(audioCtx.destination); } catch (error) {}
      try { battleAudioMaster.gain.setValueAtTime(oldMasterValue || 1, audioCtx.currentTime); } catch (error) {}
      stopBattleAudio();
      p1Selection = ft1;
      p2Selection = ft2;
      gameState = 'SELECT';
      autoBattlePaused = false;
      autoBattleControlsActive = false;
      updateAutoBattleControls();
      document.getElementById('select-screen')?.classList.remove('hidden');
      document.getElementById('menu-screen')?.classList.add('hidden');
      document.getElementById('end-screen')?.classList.add('hidden');
      document.getElementById('tournament-screen')?.classList.add('hidden');
      const hud = document.getElementById('hud');
      if (hud) hud.style.opacity = 0;
      if (typeof syncSelectedFighterVfx === 'function') syncSelectedFighterVfx();
      document.querySelectorAll('#roster-grid .fighter-card').forEach(card => {
        const name = card.dataset.fighter;
        card.classList.toggle('selected-p1', name === ft1.name);
        card.classList.toggle('selected-p2', name === ft2.name);
      });
    }
    if (panel) {
      const p1Rate = p1Wins / runs * 100;
      const p2Rate = p2Wins / runs * 100;
      panel.innerHTML = `<div class="stats-headline">MATCHUP STATS x${runs}</div>
      <div class="stats-grid">
        <div class="stat-card"><h3>${esc(ft1.name)}</h3><div class="stat-line"><span>Win rate</span><b>${p1Rate.toFixed(1)}%</b></div><div class="stat-line"><span>Wins</span><b>${p1Wins}/${runs}</b></div><div class="stat-line"><span>Avg DMG</span><b>${(totalDmg1/runs).toFixed(1)}</b></div></div>
        <div class="stat-card"><h3>${esc(ft2.name)}</h3><div class="stat-line"><span>Win rate</span><b>${p2Rate.toFixed(1)}%</b></div><div class="stat-line"><span>Wins</span><b>${p2Wins}/${runs}</b></div><div class="stat-line"><span>Avg DMG</span><b>${(totalDmg2/runs).toFixed(1)}</b></div></div>
      </div><div class="battle-tags"><span class="battle-tag">Avg finish ${(totalTime/runs).toFixed(1)}s</span>${draws ? `<span class="battle-tag">Draws ${draws}</span>` : ''}</div>`;
    }
  };
  const prevStartRecord = startSpecificMatch;
  startSpecificMatch = function(ft1, ft2, opts = {}) {
    const result = prevStartRecord(ft1, ft2, opts);
    if (!opts.statsRun) {
      const startedAt = matchStartTime;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if ((gameState === 'PLAYING' || gameState === 'COUNTDOWN') && matchStartTime === startedAt) startMatchRecording();
      }));
    }
    return result;
  };
  const prevEndRecord = endMatch;
  endMatch = function() {
    const result = prevEndRecord();
    stopMatchRecording();
    return result;
  };
  const prevMenuRecord = goToMenu;
  goToMenu = function() {
    clearRecordingBlob();
    return prevMenuRecord();
  };
  Object.assign(window.apexReactBridge || {}, {
    saveLastReplay: window.saveLastReplay,
    sandboxToggleRage: window.sandboxToggleRage,
    sandboxResetCooldowns: window.sandboxResetCooldowns,
    sandboxSlowMotion: window.sandboxSlowMotion,
    runMatchupStats: window.runMatchupStats,
    startSpecificMatch,
    endMatch,
    goToMenu
  });
  Object.assign(window, window.apexReactBridge || {});

  const prevUtilityUpdate = update;
  update = function(dt) {
    const result = prevUtilityUpdate(dt);
    if (typeof window.updateCombatInspector === 'function') window.updateCombatInspector();
    return result;
  };
})();
