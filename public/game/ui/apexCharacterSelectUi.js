// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_CHARACTER_SELECT_UI_UPGRADE(){
  if (window.__apexCharacterSelectUpgrade) return;
  window.__apexCharacterSelectUpgrade = true;

  const ROOT = '/assets/pick_ui_final/assets/';
  const path = file => ROOT + encodeURIComponent(file).replace(/%2F/g, '/');
  const requiredRoster = ['SHOTGUN','KATANA','ENGINEER','GALAXY','ICE','NINJA','SOCCER','STRING','FANG'];
  const fitDefault = { scale:1, offsetX:0, offsetY:0, focalX:.5, focalY:.5 };
  const championData = Object.freeze({
    SHOTGUN:{ id:'shotgun', name:'SHOTGUN', accent:'#FF6A2A', glow:'#FFB075', standing:path('standing/shotgun-standing.webp'), cardArt:path('hero-cards/shotgun-card.webp'), icon:path('hero-icons/shotgun-icon.webp'), stats:{ hp:1000, dmg:100 } },
    KATANA:{ id:'katana', name:'KATANA', accent:'#FF5AAE', glow:'#FFC1DF', standing:path('standing/katana-standing.webp'), cardArt:path('hero-cards/katana-card.webp'), icon:path('hero-icons/katana-icon.webp'), stats:{ hp:1000, dmg:100 } },
    ENGINEER:{ id:'engineer', name:'ENGINEER', accent:'#F5A623', glow:'#FFD27A', standing:path('standing/engineer-standing.webp'), cardArt:path('hero-cards/engineer-card.webp'), icon:path('hero-icons/engineer-icon.webp'), stats:{ hp:1000, dmg:100 } },
    GALAXY:{ id:'galaxy', name:'GALAXY', accent:'#8A5CFF', glow:'#C6A8FF', standing:path('standing/galaxy-standing.webp'), cardArt:path('hero-cards/galaxy-card.webp'), icon:path('hero-icons/galaxy-icon.webp'), stats:{ hp:1000, dmg:100 } },
    ICE:{ id:'ice', name:'ICE', accent:'#63D6FF', glow:'#BDF4FF', standing:path('standing/ice-standing.webp'), cardArt:path('hero-cards/ice-card.webp'), icon:path('hero-icons/ice-icon.webp'), stats:{ hp:1000, dmg:100 } },
    NINJA:{ id:'ninja', name:'NINJA', accent:'#4EA8FF', glow:'#B6DCFF', standing:path('standing/ninja-standing.webp'), cardArt:path('hero-cards/ninja-card.webp'), icon:path('hero-icons/ninja-icon.webp'), stats:{ hp:1000, dmg:100 } },
    SOCCER:{ id:'soccer', name:'SOCCER', accent:'#FF3B30', glow:'#FF7A70', standing:path('standing/soccer-standing.webp'), cardArt:path('hero-cards/soccer-card.webp'), icon:path('hero-icons/soccer-icon.webp'), stats:{ hp:1000, dmg:100 } },
    STRING:{ id:'string', name:'STRING', accent:'#FF4FB3', glow:'#FF9DDA', standing:path('standing/string-standing.webp'), cardArt:path('hero-cards/string-card.webp'), icon:path('hero-icons/string-icon.webp'), stats:{ hp:1000, dmg:100 } },
    FANG:{ id:'fang', name:'FANG', accent:'#FF3A3A', glow:'#FF8B8B', standing:path('standing/fang-standing.webp'), cardArt:path('hero-cards/fang-card.webp'), icon:path('hero-icons/fang-icon.webp'), stats:{ hp:1000, dmg:100 } }
  });
  const uiAssetManifest = Object.freeze({
    root: ROOT,
    assets: Object.freeze({
      selectBackground: path('01-select-screen-background.webp'),
      sideFrameBase: path('02-side-frame-base.webp'),
      sideColorMask: path('03-side-frame-color-mask.webp'),
      sideFrameHighlight: path('04-side-frame-highlight.webp'),
      sideBackdrop: path('05-portrait-inner-backdrop.webp'),
      statsPanelBase: path('06-stats-panel-base.webp'),
      cardFrameNormal: path('07-card-frame-normal.webp'),
      cardFrameSelected: path('08-card-frame-selected.webp'),
      cardSelectedMask: path('09-card-selected-color-mask.webp'),
      cardBack: path('10-card-back.webp'),
      startNormal: path('11-start-normal.webp'),
      startHover: path('12-start-hover.webp'),
      startPressed: path('13-start-pressed.webp'),
      exitNormal: path('14-exit-normal.webp'),
      exitHover: path('15-exit-hover.webp'),
      exitPressed: path('16-exit-pressed.webp'),
      arrowLeftNormal: path('17-arrow-left-normal.webp'),
      arrowLeftHover: path('18-arrow-left-hover.webp'),
      arrowRightNormal: path('19-arrow-right-normal.webp'),
      arrowRightHover: path('20-arrow-right-hover.webp'),
      cardFrameBase: path('card-frame-imagen-portrait-3x4-exact-layers/41-card-frame-imagen-portrait-3x4-base.webp'),
      cardFrameTint: path('card-frame-imagen-portrait-3x4-exact-layers/52-card-frame-imagen-portrait-3x4-neutral-tint-mask-exact.webp'),
      cardFrameSoftGloss: path('card-frame-imagen-portrait-3x4-exact-layers/50-card-frame-imagen-portrait-3x4-soft-gloss-exact.webp'),
      cardFrameBevel: path('card-frame-imagen-portrait-3x4-exact-layers/48-card-frame-imagen-portrait-3x4-bevel-highlight-exact.webp'),
      cardFrameRim: path('card-frame-imagen-portrait-3x4-exact-layers/49-card-frame-imagen-portrait-3x4-rim-highlight-exact.webp'),
      cardFrameSelectedGlow: path('card-frame-imagen-portrait-3x4-exact-layers/53-card-frame-imagen-portrait-3x4-selected-glow-mask-exact.webp')
    }),
    championSelectUI: Object.freeze({
      ...championData
    })
  });
  window.uiAssetManifest = uiAssetManifest;

  let focusedIndex = 0;
  let currentRoster = [];
  const alphaBoundsCache = new Map();
  const warnedMissing = new Set();
  const preloaded = new Map();

  function fighterMeta(ft) {
    return uiAssetManifest.championSelectUI[ft?.name] || null;
  }
  function sidePickedArtwork(fighter) {
    if (!fighter) return '';
    return fighterMeta(fighter)?.standing || SELECTED_FIGHTER_VFX?.[fighter.name] || '';
  }
  function selectScreenVisible() {
    const screen = document.getElementById('select-screen');
    return !!screen && !screen.classList.contains('hidden');
  }
  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (preloaded.has(src)) return preloaded.get(src);
    const promise = new Promise(resolve => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = async () => {
        try { if (img.decode) await img.decode(); } catch (error) {}
        resolve(img);
      };
      img.onerror = () => {
        if (!warnedMissing.has(src)) {
          warnedMissing.add(src);
          console.warn('[select-ui] Missing image asset', src);
        }
        resolve(null);
      };
      img.src = src;
    });
    preloaded.set(src, promise);
    return promise;
  }
  function preloadSelectUi() {
    const screen = document.getElementById('select-screen');
    if (!screen) return Promise.resolve();
    screen.classList.add('select-loading');
    setManifestSources();
    const sources = [
      ...Object.values(uiAssetManifest.assets),
      ...Object.values(uiAssetManifest.championSelectUI).flatMap(meta => [meta.cardArt, meta.icon, meta.standing])
    ];
    return Promise.all(sources.map(loadImage)).then(() => {
      screen.classList.remove('select-loading');
      screen.classList.add('select-assets-ready');
      scheduleFitAll();
    });
  }
  function setCssUrl(name, value) {
    document.documentElement.style.setProperty(name, `url("${value}")`);
  }
  function setManifestSources() {
    const assets = uiAssetManifest.assets;
    document.querySelectorAll('[data-select-asset]').forEach(el => {
      const key = el.getAttribute('data-select-asset');
      if (assets[key] && el.getAttribute('src') !== assets[key]) el.setAttribute('src', assets[key]);
    });
    setCssUrl('--select-bg-image', assets.selectBackground);
    setCssUrl('--select-side-mask', assets.sideColorMask);
    setCssUrl('--select-card-mask', assets.cardSelectedMask);
    setCssUrl('--select-start-normal', assets.startNormal);
    setCssUrl('--select-start-hover', assets.startHover);
    setCssUrl('--select-start-pressed', assets.startPressed);
    setCssUrl('--select-exit-normal', assets.exitNormal);
    setCssUrl('--select-exit-hover', assets.exitHover);
    setCssUrl('--select-exit-pressed', assets.exitPressed);
    setCssUrl('--select-arrow-left-normal', assets.arrowLeftNormal);
    setCssUrl('--select-arrow-left-hover', assets.arrowLeftHover);
    setCssUrl('--select-arrow-right-normal', assets.arrowRightNormal);
    setCssUrl('--select-arrow-right-hover', assets.arrowRightHover);
    setCssUrl('--select-card-tint-mask', assets.cardFrameTint);
    setCssUrl('--select-card-focus-mask', assets.cardFrameSelectedGlow);
  }
  function getAlphaBounds(img) {
    const src = img.currentSrc || img.src;
    if (alphaBoundsCache.has(src)) return alphaBoundsCache.get(src);
    const w = img.naturalWidth || 0, h = img.naturalHeight || 0;
    if (!w || !h) return { x:0, y:0, width:1, height:1 };
    let bounds = { x:0, y:0, width:w, height:h };
    try {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently:true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3] > 8) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= minX && maxY >= minY) bounds = { x:minX, y:minY, width:maxX - minX + 1, height:maxY - minY + 1 };
    } catch (error) {
      bounds = { x:0, y:0, width:w, height:h };
    }
    alphaBoundsCache.set(src, bounds);
    return bounds;
  }
  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function applyFocalFit(img, aperture, fitInput) {
    if (!img || !aperture || !img.complete || !img.naturalWidth) return;
    const rect = aperture.getBoundingClientRect();
    const aw = rect.width, ah = rect.height;
    if (aw < 2 || ah < 2) return;
    const fit = Object.assign({}, fitDefault, fitInput || {});
    fit.scale = clampValue(Number(fit.scale) || 1, .9, 1.15);
    fit.offsetX = clampValue(Number(fit.offsetX) || 0, -.12, .12);
    fit.offsetY = clampValue(Number(fit.offsetY) || 0, -.12, .12);
    fit.focalX = clampValue(Number(fit.focalX) || .5, .18, .82);
    fit.focalY = clampValue(Number(fit.focalY) || .5, .18, .82);
    const bounds = getAlphaBounds(img);
    const baseScale = Math.max(aw / bounds.width, ah / bounds.height);
    const scale = Math.max(baseScale, baseScale * fit.scale);
    let left = aw * fit.focalX - (bounds.x + bounds.width * fit.focalX) * scale + fit.offsetX * aw;
    let top = ah * fit.focalY - (bounds.y + bounds.height * fit.focalY) * scale + fit.offsetY * ah;
    const minLeft = aw - (bounds.x + bounds.width) * scale;
    const maxLeft = -bounds.x * scale;
    const minTop = ah - (bounds.y + bounds.height) * scale;
    const maxTop = -bounds.y * scale;
    left = minLeft <= maxLeft ? clampValue(left, minLeft, maxLeft) : (aw - img.naturalWidth * scale) / 2;
    top = minTop <= maxTop ? clampValue(top, minTop, maxTop) : (ah - img.naturalHeight * scale) / 2;
    img.style.width = `${img.naturalWidth * scale}px`;
    img.style.height = `${img.naturalHeight * scale}px`;
    img.style.left = `${left}px`;
    img.style.top = `${top}px`;
  }
  function scheduleFitAll() {
    if (scheduleFitAll.raf) cancelAnimationFrame(scheduleFitAll.raf);
    scheduleFitAll.raf = requestAnimationFrame(() => {
      document.querySelectorAll('.side-art-aperture img[data-fit-kind="side"]').forEach(img => {
        const ft = FighterTypes.find(q => q.name === img.dataset.fighter);
        applyFocalFit(img, img.closest('.side-art-aperture'), fighterMeta(ft)?.sideFit);
      });
      document.querySelectorAll('.select-card-art img[data-fit-kind="card"]').forEach(img => {
        const ft = FighterTypes.find(q => q.name === img.dataset.fighter);
        applyFocalFit(img, img.closest('.select-card-art'), fighterMeta(ft)?.cardFit);
      });
    });
  }
  function getSelectRoster() {
    return requiredRoster.map(name => FighterTypes.find(ft => ft && ft.name === name)).filter(Boolean);
  }
  function makeCard(ft, index) {
    const meta = fighterMeta(ft);
    const assets = uiAssetManifest.assets;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'fighter-card';
    card.dataset.fighter = ft.name;
    card.dataset.index = String(index);
    card.style.setProperty('--champion-accent', meta?.accent || ft.color || '#7fd4ff');
    card.style.setProperty('--champion-glow', meta?.glow || ft.color || '#ffffff');
    card.style.color = meta?.accent || ft.color || '#f3efe3';
    card.setAttribute('aria-label', `${ft.name} fighter`);

    const artWrap = document.createElement('span');
    artWrap.className = 'select-card-art';
    const art = document.createElement('img');
    art.alt = '';
    art.draggable = false;
    art.decoding = 'async';
    art.dataset.fighter = ft.name;
    art.dataset.fitKind = 'card-static';
    art.src = meta?.cardArt || assets.cardBack;
    art.onload = () => {};
    art.onerror = () => {
      art.src = assets.cardBack;
      card.classList.add('art-failed');
    };
    artWrap.appendChild(art);

    const frameBase = document.createElement('img');
    frameBase.className = 'select-card-layer select-card-frame-base';
    frameBase.alt = '';
    frameBase.draggable = false;
    frameBase.src = assets.cardFrameBase;

    const tint = document.createElement('span');
    tint.className = 'select-card-layer select-card-tint-mask';
    tint.setAttribute('aria-hidden', 'true');

    const gloss = document.createElement('img');
    gloss.className = 'select-card-layer select-card-gloss';
    gloss.alt = '';
    gloss.draggable = false;
    gloss.src = assets.cardFrameSoftGloss;

    const bevel = document.createElement('img');
    bevel.className = 'select-card-layer select-card-bevel';
    bevel.alt = '';
    bevel.draggable = false;
    bevel.src = assets.cardFrameBevel;

    const rim = document.createElement('img');
    rim.className = 'select-card-layer select-card-rim';
    rim.alt = '';
    rim.draggable = false;
    rim.src = assets.cardFrameRim;

    const selectedGlow = document.createElement('span');
    selectedGlow.className = 'select-card-layer select-card-focus-glow';
    selectedGlow.setAttribute('aria-hidden', 'true');

    const icon = document.createElement('img');
    icon.className = 'select-card-icon';
    icon.alt = '';
    icon.draggable = false;
    icon.decoding = 'async';
    icon.src = meta?.icon || assets.cardBack;

    const name = document.createElement('span');
    name.className = 'f-name';
    name.textContent = ft.name;

    card.append(artWrap, frameBase, tint, gloss, bevel, rim, selectedGlow, icon, name);
    card.onclick = () => {
      focusedIndex = index;
      selectFighter(ft, card);
    };
    return card;
  }
  function syncRosterVisuals() {
    const grid = document.getElementById('roster-grid');
    if (!grid) return;
    grid.querySelectorAll('.fighter-card').forEach((card, index) => {
      const ft = FighterTypes.find(q => q && q.name === card.dataset.fighter);
      const selected = ft && (p1Selection === ft || p2Selection === ft);
      const focused = index === focusedIndex;
      const prev = index === (focusedIndex - 1 + currentRoster.length) % currentRoster.length;
      const next = index === (focusedIndex + 1) % currentRoster.length;
      card.classList.toggle('is-focused', focused);
      card.classList.toggle('slot-focused', focused);
      card.classList.toggle('slot-previous', prev);
      card.classList.toggle('slot-next', next);
      card.classList.toggle('slot-hidden', !focused && !prev && !next);
      card.classList.toggle('selected-p1', ft && p1Selection === ft);
      card.classList.toggle('selected-p2', ft && p2Selection === ft);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
      card.setAttribute('aria-hidden', !focused && !prev && !next ? 'true' : 'false');
      card.tabIndex = (focused || prev || next) ? 0 : -1;
    });
    updateArrows();
  }
  function setFocusedIndex(next, scroll = true) {
    if (!currentRoster.length) return;
    focusedIndex = (next + currentRoster.length) % currentRoster.length;
    syncRosterVisuals();
    updateInfo();
    if (scroll) {
      document.querySelector(`#roster-grid .fighter-card[data-index="${focusedIndex}"]`)?.scrollIntoView({ behavior:'smooth', inline:'center', block:'nearest' });
    }
  }
  function updateArrows() {
    const has = currentRoster.length > 1;
    document.getElementById('select-arrow-left')?.toggleAttribute('disabled', !has);
    document.getElementById('select-arrow-right')?.toggleAttribute('disabled', !has);
  }
  function renderRoster() {
    const grid = document.getElementById('roster-grid');
    if (!grid) return;
    setManifestSources();
    document.getElementById('roster-tabs')?.remove();
    currentRoster = getSelectRoster();
    focusedIndex = clampValue(focusedIndex, 0, Math.max(0, currentRoster.length - 1));
    grid.innerHTML = '';
    currentRoster.forEach((ft, index) => grid.appendChild(makeCard(ft, index)));
    bindSelectControls();
    syncRosterVisuals();
    syncSelectPresentation();
    scheduleFitAll();
  }
  function updateSide(player, fighter) {
    const slot = document.querySelector(`.picked-fighter-slot[data-player="${player}"]`);
    const image = document.getElementById(`p${player}-fighter-vfx`);
    if (!slot || !image) return;
    const meta = fighterMeta(fighter);
    slot.dataset.fighter = fighter?.name || '';
    slot.style.setProperty('--champion-accent', meta?.accent || fighter?.color || (player === 1 ? '#7fd4ff' : '#ff776f'));
    slot.style.setProperty('--champion-glow', meta?.glow || fighter?.color || '#ffffff');
    image.dataset.fighter = fighter?.name || '';
    image.dataset.fitKind = 'side-static';
    image.alt = fighter ? `Player ${player}: ${fighter.name}` : `Player ${player} fighter`;
    const nextSrc = sidePickedArtwork(fighter) || uiAssetManifest.assets.cardBack;
    if (image.getAttribute('src') !== nextSrc) {
      image.onload = null;
      image.onerror = () => {
        if (fighter && !warnedMissing.has(nextSrc)) {
          warnedMissing.add(nextSrc);
          console.warn('[select-ui] Falling back for side artwork', fighter.name, nextSrc);
        }
        image.src = uiAssetManifest.assets.cardBack;
      };
      image.src = nextSrc;
    } else {
      image.onload = null;
    }
    image.classList.toggle('has-fighter', Boolean(fighter));
    const name = document.getElementById(`p${player}-select-name`);
    if (name) {
      if (fighter) name.textContent = fighter.name;
      else name.textContent = player === 1 ? 'SELECTING' : 'WAITING';
    }
    const hp = document.getElementById(`p${player}-select-hp`);
    const dmg = document.getElementById(`p${player}-select-dmg`);
    if (hp) hp.textContent = fighter ? String(meta?.stats?.hp ?? 1000) : '1000';
    if (dmg) dmg.textContent = fighter ? String(meta?.stats?.dmg ?? 100) : '100';
  }
  function updateInfo() {
    const focus = currentRoster[focusedIndex] || p2Selection || p1Selection;
    const status = !p1Selection ? 'P1_SELECTING' : !p2Selection ? 'P2_SELECTING' : 'BOTH_READY';
    const statusEl = document.getElementById('select-info-status');
    const phaseEl = document.getElementById('select-phase-label');
    const nameEl = document.getElementById('select-info-name');
    const descEl = document.getElementById('select-info-desc');
    const speedEl = document.getElementById('select-info-speed');
    if (statusEl) statusEl.textContent = status.replace(/_/g, ' ');
    if (phaseEl) phaseEl.textContent = status.replace(/_/g, ' ');
    if (nameEl) nameEl.textContent = focus?.name || 'CHOOSE FIGHTER';
    if (descEl) descEl.textContent = focus?.desc || 'Pick a champion to preview combat data.';
    if (speedEl) speedEl.textContent = Number.isFinite(focus?.speed) ? String(focus.speed) : '--';
    const title = document.getElementById('select-title');
    if (title) title.textContent = !p1Selection ? 'SELECT PLAYER 1' : !p2Selection ? 'SELECT PLAYER 2' : 'READY TO FIGHT';
  }
  function syncSelectPresentation() {
    setManifestSources();
    updateSide(1, p1Selection);
    updateSide(2, p2Selection);
    syncRosterVisuals();
    updateInfo();
  }
  function activateFocused() {
    const ft = currentRoster[focusedIndex];
    const card = document.querySelector(`#roster-grid .fighter-card[data-index="${focusedIndex}"]`);
    if (ft && card) selectFighter(ft, card);
  }
  function bindSelectControls() {
    if (bindSelectControls.done) return;
    bindSelectControls.done = true;
    document.getElementById('select-arrow-left')?.addEventListener('click', () => setFocusedIndex(focusedIndex - 1));
    document.getElementById('select-arrow-right')?.addEventListener('click', () => setFocusedIndex(focusedIndex + 1));
    window.addEventListener('resize', scheduleFitAll);
    document.addEventListener('keydown', event => {
      if (!selectScreenVisible()) return;
      const target = event.target;
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); setFocusedIndex(focusedIndex - 1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); setFocusedIndex(focusedIndex + 1); }
      else if (event.key === 'Enter' || event.key === ' ') {
        if (document.activeElement?.matches?.('button') && document.activeElement.id !== 'roster-grid') return;
        event.preventDefault();
        activateFocused();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        goToMenu();
      }
    });
  }

  const previousPopulateRosterSelectUi = populateRoster;
  populateRoster = function() {
    renderRoster();
  };
  syncSelectedFighterVfx = function(...args) {
    syncSelectPresentation();
  };
  const previousSelectFighterSelectUi = selectFighter;
  selectFighter = function(ft, card) {
    const result = previousSelectFighterSelectUi(ft, card);
    const index = currentRoster.findIndex(q => q === ft || q?.name === ft?.name);
    if (index >= 0) focusedIndex = index;
    syncSelectPresentation();
    return result;
  };
  const previousGoToSelectSelectUi = goToSelect;
  goToSelect = function(...args) {
    const result = previousGoToSelectSelectUi.apply(this, args);
    focusedIndex = 0;
    if (!window.__apexJsonPickRuntime) {
      renderRoster();
      preloadSelectUi();
    }
    return result;
  };
  Object.assign(window.apexReactBridge || {}, { goToSelect, startMatch, goToMenu });
  Object.assign(window, window.apexReactBridge || {}, { uiAssetManifest });
})();
