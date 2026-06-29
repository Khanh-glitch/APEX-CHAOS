// ===== JSON CHARACTER PICK RUNTIME =====
(function APEX_JSON_PICK_RUNTIME(){
  if (window.__apexJsonPickRuntime) return;
  window.__apexJsonPickRuntime = true;

  const DESIGN_W = 1672;
  const DESIGN_H = 941;
  const ROOT = '/assets/pick_ui_final/assets/';
  const LAYOUT_URL = '/assets/pick_ui_final/pick-layout-final-v1.json';
  const path = file => ROOT + encodeURIComponent(String(file).replace(/^\.\/assets\//, '')).replace(/%2F/g, '/');
  const rosterNames = ['SHOTGUN','KATANA','ENGINEER','GALAXY','ICE','NINJA','SOCCER','STRING','FANG'];
  const cardFrame = Object.freeze({
    base: path('card-frame-imagen-portrait-3x4-exact-layers/41-card-frame-imagen-portrait-3x4-base.webp'),
    tint: path('card-frame-imagen-portrait-3x4-exact-layers/52-card-frame-imagen-portrait-3x4-neutral-tint-mask-exact.webp'),
    softGloss: path('card-frame-imagen-portrait-3x4-exact-layers/50-card-frame-imagen-portrait-3x4-soft-gloss-exact.webp'),
    bevel: path('card-frame-imagen-portrait-3x4-exact-layers/48-card-frame-imagen-portrait-3x4-bevel-highlight-exact.webp'),
    rim: path('card-frame-imagen-portrait-3x4-exact-layers/49-card-frame-imagen-portrait-3x4-rim-highlight-exact.webp'),
    selectedGlow: path('card-frame-imagen-portrait-3x4-exact-layers/53-card-frame-imagen-portrait-3x4-selected-glow-mask-exact.webp')
  });
  const buttonStates = Object.freeze({
    'arrow-left': { normal:path('17-arrow-left-normal.webp'), hover:path('18-arrow-left-hover.webp'), pressed:path('18-arrow-left-hover.webp') },
    'arrow-right': { normal:path('19-arrow-right-normal.webp'), hover:path('20-arrow-right-hover.webp'), pressed:path('20-arrow-right-hover.webp') },
    'start-button': { normal:path('11-start-normal.webp'), hover:path('12-start-hover.webp'), pressed:path('13-start-pressed.webp') },
    'exit-button': { normal:path('14-exit-normal.webp'), hover:path('15-exit-hover.webp'), pressed:path('16-exit-pressed.webp') },
    'music-button': { normal:path('14-exit-normal.webp'), hover:path('15-exit-hover.webp'), pressed:path('16-exit-pressed.webp') },
    'fullscreen-button': { normal:path('14-exit-normal.webp'), hover:path('15-exit-hover.webp'), pressed:path('16-exit-pressed.webp') }
  });
  const buttonLabelIds = Object.freeze({
    'start-button': 'start-label',
    'exit-button': 'exit-label',
    'music-button': 'music label',
    'fullscreen-button': 'full screen label'
  });

  let layoutPromise = null;
  let layout = null;
  let carouselTouched = false;
  let stage = null;
  let pickAnimationTimer = 0;
  const PICK_CARD_ANIMATION_MS = 90;
  const refs = new Map();
  const pendingImages = [];
  const warmedPickChromeSources = new Set();
  let pendingImageTimer = 0;

  function pumpImageQueue() {
    pendingImageTimer = 0;
    const next = pendingImages.shift();
    if (next && next.img.isConnected && next.img.dataset.apexPendingSrc === next.src) {
      delete next.img.dataset.apexPendingSrc;
      next.img.src = next.src;
    }
    if (pendingImages.length) pendingImageTimer = window.setTimeout(pumpImageQueue, 16);
  }

  function assignImageSource(img, src, immediate = false) {
    if (!img || !src || img.getAttribute('src') === src) return;
    if (immediate || warmedPickChromeSources.has(src)) {
      delete img.dataset.apexPendingSrc;
      img.src = src;
      return;
    }
    img.dataset.apexPendingSrc = src;
    pendingImages.push({ img, src });
    if (!pendingImageTimer) pendingImageTimer = window.setTimeout(pumpImageQueue, 0);
  }
  const PickRuntimeController = {
    champions: [],
    centerIndex: 0,
    p1ChampionId: null,
    p2ChampionId: null,
    activePlayer: 1,
    isAnimating: false,
    animationDirection: 0,
    p1Hp: '1000',
    p2Hp: '1000',
    p1Dmg: '100',
    p2Dmg: '100',
    musicEnabled: true
  };
  window.PickRuntimeController = PickRuntimeController;

  function pickRoot() {
    return document.getElementById('apex-pick-runtime-root');
  }
  function layerStyle(el, layer) {
    el.classList.add('apex-pick-layer');
    el.dataset.layerId = layer.id;
    el.style.left = `${layer.x}px`;
    el.style.top = `${layer.y}px`;
    el.style.width = `${layer.w}px`;
    el.style.height = `${layer.h}px`;
    el.style.zIndex = String(layer.z ?? 0);
    el.style.opacity = String(layer.opacity ?? 1);
    el.style.visibility = layer.visible === false ? 'hidden' : 'visible';
  }
  function resolveLayerSrc(layer) {
    return path(layer.src || '');
  }
  function setTextAlign(el, align) {
    el.style.justifyContent = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
    el.style.textAlign = align || 'left';
  }
  function loadLayout() {
    if (!layoutPromise) {
      layoutPromise = fetch(LAYOUT_URL, { cache:'force-cache' })
        .then(response => {
          if (!response.ok) throw new Error(`Pick layout failed: ${response.status}`);
          return response.json();
        })
        .then(json => {
          layout = json.screens?.pick || json;
          return layout;
        });
    }
    return layoutPromise;
  }
  function championRecords() {
    const records = layout?.champions || [];
    return records.map(champ => ({
      ...champ,
      name: champ.name?.toUpperCase?.() || champ.id?.toUpperCase?.(),
      standing: path(champ.standing || `standing/${champ.id}-standing.webp`),
      cardArt: path(champ.cardArt || `hero-cards/${champ.id}-card.webp`),
      icon: path(champ.icon || `hero-icons/${champ.id}-icon.webp`),
      accentGlow: champ.accentGlow || champ.accent || '#ffffff'
    }));
  }
  function currentRoster() {
    const byName = new Map(championRecords().map(champ => [champ.name, champ]));
    const roster = rosterNames.map(name => byName.get(name)).filter(Boolean);
    PickRuntimeController.champions = roster;
    return roster;
  }
  function fighterForChampion(champ) {
    return FighterTypes.find(ft => ft && ft.name === champ?.name) || null;
  }
  function championForFighter(fighter) {
    if (!fighter) return null;
    return currentRoster().find(champ => champ.name === fighter.name) || null;
  }
  function championById(id) {
    if (!id) return null;
    return currentRoster().find(champ => champ.id === id || champ.name === String(id).toUpperCase()) || null;
  }
  function focusedChampion() {
    const roster = currentRoster();
    return roster[PickRuntimeController.centerIndex] || roster[0] || null;
  }
  function setLayerText(id, text) {
    const el = refs.get(id);
    if (!el) return;
    if ('value' in el) el.value = text;
    else el.textContent = text;
  }
  function setLayerColor(id, color) {
    const el = refs.get(id);
    if (el) el.style.color = color;
  }
  function setLayerImage(id, src) {
    const el = refs.get(id);
    if (el && src) assignImageSource(el, src, true);
  }
  function hiddenSetting(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = String(value);
  }
  function syncHiddenMatchSettings() {
    hiddenSetting('p1-hp-setting', PickRuntimeController.p1Hp);
    hiddenSetting('p2-hp-setting', PickRuntimeController.p2Hp);
    hiddenSetting('p1-dmg-setting', PickRuntimeController.p1Dmg);
    hiddenSetting('p2-dmg-setting', PickRuntimeController.p2Dmg);
  }
  function standingLayer(player) {
    return (layout?.layers || []).find(layer => layer.id === `p${player}-standing`);
  }
  const standingAlpha = Object.freeze({
    beast: { w:.991498, h:.940789 },
    fang: { w:.991498, h:.940789 },
    engineer: { w:.952854, h:.952782 },
    galaxy: { w:.953394, h:.953043 },
    ice: { w:.953177, h:.953408 },
    katana: { w:.967302, h:.974482 },
    ninja: { w:.952703, h:.953807 },
    shotgun: { w:.969398, h:.976032 },
    soccer: { w:.952941, h:.953448 },
    string: { w:.954071, h:.953871 }
  });
  function standingContentHeight(layer, aspect) {
    if (!layer || !Number.isFinite(aspect) || aspect <= 0) return 0;
    return (layer.w / layer.h) > aspect ? layer.h : layer.w / aspect;
  }
  function standingKeyFromSrc(src) {
    const match = String(src || '').match(/standing\/([^/?#]+?)-standing\.webp/i);
    return match?.[1] || '';
  }
  function layerById(id) {
    return (layout?.layers || []).find(layer => layer.id === id) || null;
  }
  function applyStandingFit(player) {
    const img = refs.get(`p${player}-standing`);
    const layer = standingLayer(player);
    if (!img || !layer) return;
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
      img.addEventListener('load', () => applyStandingFit(player), { once: true });
      return;
    }
    const alpha = standingAlpha[standingKeyFromSrc(img.getAttribute('src'))] || { w:1, h:1 };
    const currentHeight = standingContentHeight(layer, img.naturalWidth / img.naturalHeight);
    const visualHeight = currentHeight * alpha.h;
    const targetVisualHeight = 430;
    const visualScale = visualHeight ? targetVisualHeight / visualHeight : 1;
    const scale = Math.min(1, visualScale);
    const frame = layerById(`p${player}-frame-base`);
    const shiftX = player === 2 && frame
      ? (frame.x + frame.w / 2) - (layer.x + layer.w / 2)
      : 0;
    img.style.transform = `translateX(${shiftX}px) scale(${scale})`;
    img.style.transformOrigin = 'center bottom';
  }
  function renderStandingLayer(layer) {
    const shell = document.createElement('span');
    shell.className = 'apex-pick-standing-shell';
    layerStyle(shell, layer);
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.style.objectFit = layer.fit === 'contain' ? 'contain' : 'fill';
    img.style.objectPosition = layer.pos || 'center bottom';
    shell.appendChild(img);
    refs.set(layer.id, img);
    refs.set(`${layer.id}-shell`, shell);
    applyStandingFit(layer.id === 'p1-standing' ? 1 : 2);
    return shell;
  }
  function renderImageLayer(layer) {
    const interactive = buttonStates[layer.id];
    if (interactive) return renderButtonLayer(layer);
    if (layer.id === 'p1-standing' || layer.id === 'p2-standing') return renderStandingLayer(layer);
    const img = document.createElement('img');
    img.className = 'apex-pick-img';
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    assignImageSource(img, resolveLayerSrc(layer), layer.id === 'background');
    if (layer.fit === 'contain') img.classList.add('contain');
    img.style.objectPosition = layer.pos || 'center center';
    layerStyle(img, layer);
    refs.set(layer.id, img);
    return img;
  }
  function renderTextLayer(layer) {
    if (layer.id === 'heroesnameoncard') return document.createComment('runtime hero card name layer');
    if (['p1-hp-number','p2-hp-number','p1-dmg%-numbur','p2-dmg%-number'].includes(layer.id)) {
      return renderStatInputLayer(layer);
    }
    const div = document.createElement('div');
    div.className = 'apex-pick-text';
    div.textContent = layer.text || '';
    div.style.fontSize = `${layer.fontSize || 16}px`;
    div.style.color = layer.color || '#fff';
    div.style.lineHeight = `${layer.h || layer.fontSize || 16}px`;
    setTextAlign(div, layer.align);
    layerStyle(div, layer);
    refs.set(layer.id, div);
    return div;
  }
  function statKeyForLayer(id) {
    if (id === 'p1-hp-number') return 'p1Hp';
    if (id === 'p2-hp-number') return 'p2Hp';
    if (id === 'p1-dmg%-numbur') return 'p1Dmg';
    if (id === 'p2-dmg%-number') return 'p2Dmg';
    return null;
  }
  function renderStatInputLayer(layer) {
    const input = document.createElement('input');
    input.className = 'apex-pick-text apex-pick-stat-input';
    input.type = 'text';
    input.inputMode = layer.id.includes('hp') ? 'text' : 'numeric';
    input.value = PickRuntimeController[statKeyForLayer(layer.id)] || layer.text || '';
    input.style.fontSize = `${layer.fontSize || 16}px`;
    input.style.color = layer.color || '#fff';
    input.style.lineHeight = `${layer.h || layer.fontSize || 16}px`;
    setTextAlign(input, layer.align);
    layerStyle(input, layer);
    input.addEventListener('input', () => updateStatFromInput(layer.id, input.value));
    input.addEventListener('change', () => {
      input.value = sanitizeStatValue(layer.id, input.value);
      updateStatFromInput(layer.id, input.value);
      syncPickState();
    });
    refs.set(layer.id, input);
    return input;
  }
  function sanitizeStatValue(id, value) {
    const raw = String(value || '').trim().toUpperCase();
    if (id.includes('hp') && (raw === 'INF' || raw === 'INFINITY' || raw === '∞')) return 'INF';
    const n = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(n)) return id.includes('hp') ? '1000' : '100';
    if (id.includes('hp')) return String(Math.max(100, Math.round(n)));
    return String(Math.max(100, Math.min(1000, Math.round(n))));
  }
  function updateStatFromInput(id, value) {
    const key = statKeyForLayer(id);
    if (!key) return;
    PickRuntimeController[key] = value;
    syncHiddenMatchSettings();
  }
  function renderButtonLayer(layer) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'apex-pick-button';
    btn.setAttribute('aria-label', layer.id);
    layerStyle(btn, layer);
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    btn.appendChild(img);
    setButtonAsset(btn, layer.id, 'normal');
    btn.addEventListener('pointerenter', () => setButtonAsset(btn, layer.id, 'hover'));
    btn.addEventListener('pointerleave', () => setButtonAsset(btn, layer.id, 'normal'));
    btn.addEventListener('pointerdown', () => setButtonAsset(btn, layer.id, 'pressed'));
    btn.addEventListener('pointerup', () => setButtonAsset(btn, layer.id, 'hover'));
    if (layer.id === 'arrow-left') btn.addEventListener('click', () => setFocusedIndex(PickRuntimeController.centerIndex - 1));
    if (layer.id === 'arrow-right') btn.addEventListener('click', () => setFocusedIndex(PickRuntimeController.centerIndex + 1));
    if (layer.id === 'start-button') btn.addEventListener('click', () => {
      if (PickRuntimeController.p1ChampionId && PickRuntimeController.p2ChampionId) {
        window.apexStopMenuMusic?.(true);
        syncHiddenMatchSettings();
        startMatch();
      }
    });
    if (layer.id === 'exit-button') btn.addEventListener('click', () => goToMenu());
    if (layer.id === 'music-button') btn.addEventListener('click', () => togglePickMusic());
    if (layer.id === 'fullscreen-button') btn.addEventListener('click', () => toggleFullscreen());
    refs.set(layer.id, btn);
    return btn;
  }
  function setButtonAsset(btn, id, state) {
    const states = buttonStates[id];
    if (!states) return;
    const img = btn.querySelector('img');
    if (img) {
      const src = id.startsWith('arrow') ? states.normal : (states[state] || states.normal);
      assignImageSource(img, src, state !== 'normal');
    }
    btn.dataset.state = state;
    syncButtonLabelMotion(id, state);
  }
  function syncButtonLabelMotion(buttonId, state) {
    const label = refs.get(buttonLabelIds[buttonId]);
    if (!label) return;
    label.dataset.buttonState = state;
    const transform = state === 'pressed' ? 'scale(.96)' : state === 'hover' ? 'scale(1.025)' : '';
    if (transform) label.style.setProperty('transform', transform, 'important');
    else label.style.removeProperty('transform');
  }
  function syncButtonLabelStates() {
    for (const id of Object.keys(buttonLabelIds)) {
      const btn = refs.get(id);
      if (btn) syncButtonLabelMotion(id, btn.dataset.state || 'normal');
    }
  }
  function renderFrameAccent(layer, player) {
    const mask = document.createElement('span');
    mask.className = 'apex-pick-frame-mask';
    mask.dataset.player = String(player);
    mask.style.left = `${layer.x}px`;
    mask.style.top = `${layer.y}px`;
    mask.style.width = `${layer.w}px`;
    mask.style.height = `${layer.h}px`;
    mask.style.zIndex = String((layer.z ?? 10) + .5);
    mask.style.opacity = '.86';
    refs.set(`p${player}-frame-mask`, mask);
    return mask;
  }
  function slotLayers() {
    const layers = layout?.layers || [];
    return {
      left: layers.find(layer => layer.id === 'carousel-left-slot'),
      center: layers.find(layer => layer.id === 'carousel-center-slot'),
      right: layers.find(layer => layer.id === 'carousel-right-slot')
    };
  }
  function cardNameStyleFor(slotLayer, centerSlot) {
    const nameLayer = layerById('heroesnameoncard');
    if (!nameLayer || !centerSlot) return null;
    const scale = slotLayer.w / centerSlot.w;
    return {
      left: ((nameLayer.x - centerSlot.x) / centerSlot.w) * 100,
      top: ((nameLayer.y - centerSlot.y) / centerSlot.h) * 100,
      width: (nameLayer.w / centerSlot.w) * 100,
      height: (nameLayer.h / centerSlot.h) * 100,
      fontSize: (nameLayer.fontSize || 30) * scale
    };
  }
  function createCard(champ, slotName, slotLayer) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'apex-pick-card';
    card.dataset.champion = champ.name;
    card.dataset.slot = slotName === 'center' ? 'focus' : `side-${slotName}`;
    card.style.setProperty('--champion-accent', champ.accent);
    card.style.setProperty('--champion-glow', champ.accentGlow);
    layerStyle(card, slotLayer);
    card.setAttribute('aria-label', champ.name);

    const artWrap = document.createElement('span');
    artWrap.className = 'apex-pick-card-art';
    const art = document.createElement('img');
    assignImageSource(art, champ.cardArt, slotName === 'center');
    art.alt = '';
    art.draggable = false;
    artWrap.appendChild(art);

    const base = document.createElement('img');
    base.className = 'apex-pick-card-layer';
    assignImageSource(base, cardFrame.base);
    base.alt = '';
    base.style.zIndex = '2';

    const tint = document.createElement('span');
    tint.className = 'apex-pick-card-tint';
    tint.style.zIndex = '3';

    const gloss = document.createElement('img');
    gloss.className = 'apex-pick-card-layer';
    assignImageSource(gloss, cardFrame.softGloss);
    gloss.alt = '';
    gloss.style.zIndex = '4';

    const bevel = document.createElement('img');
    bevel.className = 'apex-pick-card-layer';
    assignImageSource(bevel, cardFrame.bevel);
    bevel.alt = '';
    bevel.style.zIndex = '5';

    const rim = document.createElement('img');
    rim.className = 'apex-pick-card-layer';
    assignImageSource(rim, cardFrame.rim);
    rim.alt = '';
    rim.style.zIndex = '6';

    const glow = document.createElement('span');
    glow.className = 'apex-pick-card-glow';

    const icon = document.createElement('img');
    icon.className = 'apex-pick-card-icon';
    assignImageSource(icon, champ.icon, slotName === 'center');
    icon.alt = '';
    icon.draggable = false;

    const name = document.createElement('span');
    name.className = 'apex-pick-card-name';
    name.textContent = champ.name;
    name.style.color = champ.accent;
    const nameStyle = cardNameStyleFor(slotLayer, slotLayers().center);
    if (nameStyle) {
      name.style.left = `${nameStyle.left}%`;
      name.style.top = `${nameStyle.top}%`;
      name.style.width = `${nameStyle.width}%`;
      name.style.height = `${nameStyle.height}%`;
      name.style.fontSize = `${nameStyle.fontSize}px`;
    }

    card.append(artWrap, base, tint, gloss, bevel, rim, glow, icon, name);
    card.addEventListener('click', () => {
      confirmChampion(champ);
    });
    return card;
  }
  function renderCards() {
    if (!stage) return;
    stage.querySelectorAll('.apex-pick-card').forEach(card => card.remove());
    const roster = currentRoster();
    if (!roster.length) return;
    const slots = slotLayers();
    const byId = new Map(roster.flatMap(champ => [[champ.id, champ], [champ.name, champ]]));
    const centerIndex = PickRuntimeController.centerIndex;
    const useLayoutSlots = !carouselTouched && !PickRuntimeController.p1ChampionId && !PickRuntimeController.p2ChampionId;
    const previous = useLayoutSlots
      ? byId.get(slots.left?.championId) || roster[(centerIndex - 1 + roster.length) % roster.length]
      : roster[(centerIndex - 1 + roster.length) % roster.length];
    const focused = useLayoutSlots
      ? byId.get(slots.center?.championId) || roster[centerIndex % roster.length]
      : roster[centerIndex % roster.length];
    const next = useLayoutSlots
      ? byId.get(slots.right?.championId) || roster[(centerIndex + 1) % roster.length]
      : roster[(centerIndex + 1) % roster.length];
    const leftCard = createCard(previous, 'left', slots.left);
    const rightCard = createCard(next, 'right', slots.right);
    const centerCard = createCard(focused, 'center', slots.center);
    stage.appendChild(leftCard);
    stage.appendChild(rightCard);
    stage.appendChild(centerCard);
    applyCarouselMotion({ leftCard, centerCard, rightCard, slots });
  }
  function transformFromSlot(from, to) {
    const sx = from.w / to.w;
    const sy = from.h / to.h;
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  }
  function primeCardMotion(card, fromSlot, toSlot, startOpacity = null) {
    card.style.transition = 'none';
    card.style.transform = transformFromSlot(fromSlot, toSlot);
    if (startOpacity !== null) card.style.opacity = String(startOpacity);
    card.getBoundingClientRect();
    requestAnimationFrame(() => {
      card.style.transition = '';
      card.style.transform = '';
      card.style.opacity = '';
    });
  }
  function applyCarouselMotion({ leftCard, centerCard, rightCard, slots }) {
    const direction = PickRuntimeController.animationDirection;
    if (!PickRuntimeController.isAnimating || !direction) return;
    if (direction > 0) {
      primeCardMotion(leftCard, slots.center, slots.left, 1);
      primeCardMotion(centerCard, slots.right, slots.center, .42);
      primeCardMotion(rightCard, { ...slots.right, x: slots.right.x + 76 }, slots.right, .08);
    } else {
      primeCardMotion(leftCard, { ...slots.left, x: slots.left.x - 76 }, slots.left, .08);
      primeCardMotion(centerCard, slots.left, slots.center, .42);
      primeCardMotion(rightCard, slots.center, slots.right, 1);
    }
  }
  function renderStaticLayout() {
    const root = pickRoot();
    if (!root || !layout) return;
    root.innerHTML = '';
    refs.clear();
    root.style.setProperty('--p1-accent', '#FF6A2A');
    root.style.setProperty('--p2-accent', '#FF5AAE');
    root.style.setProperty('--center-accent', '#FF5AAE');
    root.style.setProperty('--pick-side-mask', `url("${path('03-side-frame-color-mask.webp')}")`);
    root.style.setProperty('--pick-card-tint-mask', `url("${cardFrame.tint}")`);
    root.style.setProperty('--pick-card-glow-mask', `url("${cardFrame.selectedGlow}")`);
    stage = document.createElement('div');
    stage.className = 'apex-pick-stage';
    root.appendChild(stage);

    const layers = (layout.layers || []).slice().sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
    for (const layer of layers) {
      if (layer.type === 'hero-card') continue;
      if (layer.type === 'image') {
        stage.appendChild(renderImageLayer(layer));
        if (layer.id === 'p1-frame-base') stage.appendChild(renderFrameAccent(layer, 1));
        if (layer.id === 'p2-frame-base') stage.appendChild(renderFrameAccent(layer, 2));
      } else if (layer.type === 'text') {
        stage.appendChild(renderTextLayer(layer));
      }
    }
    syncButtonLabelStates();
    renderCards();
    bindKeyboard();
    updateStageScale();
    syncHiddenMatchSettings();
    syncPickState();
  }
  function togglePickMusic() {
    PickRuntimeController.musicEnabled = !PickRuntimeController.musicEnabled;
    if (PickRuntimeController.musicEnabled) window.apexPlayMenuMusic?.(false);
    else window.apexStopMenuMusic?.(false);
    syncUtilityState();
  }
  function toggleFullscreen() {
    const doc = document;
    if (doc.fullscreenElement) doc.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
    window.setTimeout(() => {
      setLayerText('full screen label', document.fullscreenElement ? 'WINDOW' : 'FULL');
    }, 80);
  }
  function syncUtilityState() {
    const music = refs.get('music-button');
    const musicLabel = refs.get('music label');
    if (music) music.dataset.enabled = PickRuntimeController.musicEnabled ? 'true' : 'false';
    if (musicLabel) {
      musicLabel.style.color = PickRuntimeController.musicEnabled ? '#FF3B30' : '#B8B8B8';
      musicLabel.style.textShadow = PickRuntimeController.musicEnabled ? '0 0 14px rgba(255,59,48,.92), 0 2px 0 #000' : 'none';
      musicLabel.style.opacity = PickRuntimeController.musicEnabled ? '1' : '.72';
    }
    setLayerText('full screen label', document.fullscreenElement ? 'WINDOW' : 'FULL');
  }
  function updateStageScale() {
    if (!stage) return;
    const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
    const left = (window.innerWidth - DESIGN_W * scale) / 2;
    const top = (window.innerHeight - DESIGN_H * scale) / 2;
    stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  }
  function setFocusedIndex(nextIndex) {
    const roster = currentRoster();
    if (!roster.length) return;
    carouselTouched = true;
    if (pickAnimationTimer) {
      window.clearTimeout(pickAnimationTimer);
      pickAnimationTimer = 0;
    }
    const previousIndex = PickRuntimeController.centerIndex;
    PickRuntimeController.isAnimating = true;
    PickRuntimeController.animationDirection = nextIndex >= previousIndex ? 1 : -1;
    PickRuntimeController.centerIndex = (nextIndex + roster.length) % roster.length;
    renderCards();
    syncPickState();
    pickAnimationTimer = window.setTimeout(() => {
      PickRuntimeController.isAnimating = false;
      PickRuntimeController.animationDirection = 0;
      pickAnimationTimer = 0;
      syncPickState();
    }, PICK_CARD_ANIMATION_MS);
  }
  function confirmChampion(champ) {
    if (!champ) return;
    if (pickAnimationTimer) {
      window.clearTimeout(pickAnimationTimer);
      pickAnimationTimer = 0;
    }
    PickRuntimeController.isAnimating = false;
    PickRuntimeController.animationDirection = 0;
    const ft = fighterForChampion(champ);
    if (!ft) return;
    carouselTouched = true;
    PickRuntimeController.centerIndex = currentRoster().findIndex(item => item.name === champ.name);
    if (PickRuntimeController.activePlayer === 1) {
      PickRuntimeController.p1ChampionId = champ.id;
      p1Selection = ft;
      PickRuntimeController.activePlayer = 2;
    } else if (PickRuntimeController.activePlayer === 2) {
      PickRuntimeController.p2ChampionId = champ.id;
      p2Selection = ft;
      PickRuntimeController.activePlayer = 0;
    } else {
      PickRuntimeController.p1ChampionId = champ.id;
      PickRuntimeController.p2ChampionId = null;
      p1Selection = ft;
      p2Selection = null;
      PickRuntimeController.activePlayer = 2;
    }
    renderCards();
    syncPickState();
  }
  function syncPlayerPanel(player, champ) {
    if (!champ) return;
    setLayerImage(`p${player}-standing`, champ.standing);
    const standing = refs.get(`p${player}-standing`);
    if (standing) standing.style.opacity = '1';
    applyStandingFit(player);
    setLayerText(`p${player}-name`, champ.name);
    setLayerText(`p${player}-hp-number`, PickRuntimeController[`p${player}Hp`]);
    const dmgId = player === 1 ? 'p1-dmg%-numbur' : 'p2-dmg%-number';
    setLayerText(dmgId, PickRuntimeController[`p${player}Dmg`]);
    setLayerColor(`p${player}-title`, champ.accent);
    setLayerColor(`p${player}-name`, champ.accent);
    setLayerColor(`p${player}-hp-number`, champ.accent);
    setLayerColor(dmgId, champ.accent);
    pickRoot()?.style.setProperty(`--p${player}-accent`, champ.accent);
  }
  function syncEmptyPlayerPanel(player) {
    const standing = refs.get(`p${player}-standing`);
    if (standing) standing.style.opacity = '0';
    setLayerText(`p${player}-name`, '');
    setLayerText(`p${player}-hp-number`, PickRuntimeController[`p${player}Hp`]);
    const dmgId = player === 1 ? 'p1-dmg%-numbur' : 'p2-dmg%-number';
    setLayerText(dmgId, PickRuntimeController[`p${player}Dmg`]);
    setLayerColor(`p${player}-title`, player === 1 ? '#FF6A2A' : '#FF5AAE');
    setLayerColor(`p${player}-name`, '#F7F7F4');
    setLayerColor(`p${player}-hp-number`, '#FFFFFF');
    setLayerColor(dmgId, '#FFFFFF');
  }
  function syncPickState() {
    const p1Champ = championById(PickRuntimeController.p1ChampionId);
    const p2Champ = championById(PickRuntimeController.p2ChampionId);
    const centerChamp = focusedChampion();
    if (centerChamp) pickRoot()?.style.setProperty('--center-accent', centerChamp.accent);
    if (centerChamp) setLayerText('heroesnameoncard', centerChamp.name);
    if (centerChamp) setLayerColor('heroesnameoncard', centerChamp.accent);
    if (p1Champ) syncPlayerPanel(1, p1Champ);
    else syncEmptyPlayerPanel(1);
    if (p2Champ) syncPlayerPanel(2, p2Champ);
    else syncEmptyPlayerPanel(2);
    syncHiddenMatchSettings();
    setLayerText('title', PickRuntimeController.activePlayer === 1 ? 'SELECT PLAYER 1' : PickRuntimeController.activePlayer === 2 ? 'SELECT PLAYER 2' : 'READY TO FIGHT');
    const start = refs.get('start-button');
    if (start) start.disabled = !(PickRuntimeController.p1ChampionId && PickRuntimeController.p2ChampionId);
    stage?.querySelectorAll('.apex-pick-card').forEach(card => {
      const selected = [p1Champ?.name, p2Champ?.name].includes(card.dataset.champion);
      card.classList.toggle('is-selected', selected);
    });
    syncUtilityState();
    document.getElementById('roster-grid')?.replaceChildren();
  }
  function bindKeyboard() {
    if (bindKeyboard.done) return;
    bindKeyboard.done = true;
    window.addEventListener('resize', updateStageScale);
    document.addEventListener('keydown', event => {
      const screen = document.getElementById('select-screen');
      if (!screen || screen.classList.contains('hidden')) return;
      const target = event.target;
      if (target?.matches?.('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); setFocusedIndex(PickRuntimeController.centerIndex - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); setFocusedIndex(PickRuntimeController.centerIndex + 1); }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        confirmChampion(focusedChampion());
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        goToMenu();
      }
    });
  }
  async function renderPickRuntime() {
    await loadLayout();
    const centerChampionId = (layout.layers || []).find(layer => layer.id === 'carousel-center-slot')?.championId;
    const centerIndex = currentRoster().findIndex(champ => champ.id === centerChampionId || champ.name === String(centerChampionId || '').toUpperCase());
    if (!PickRuntimeController.p1ChampionId && !PickRuntimeController.p2ChampionId && centerIndex >= 0) PickRuntimeController.centerIndex = centerIndex;
    renderStaticLayout();
  }

  let pickChromeWarmup = null;
  const pickChromeWarmImages = [];
  function warmPickChrome() {
    if (pickChromeWarmup) return pickChromeWarmup;
    pickChromeWarmup = loadLayout().then(async () => {
      const layerSources = (layout?.layers || [])
        .filter(layer => layer.type === 'image' && !/^p[12]-standing$/.test(layer.id))
        .map(resolveLayerSrc);
      const sources = [...new Set([
        ...layerSources,
        cardFrame.base,
        cardFrame.softGloss,
        cardFrame.bevel,
        cardFrame.rim,
        cardFrame.tint,
        cardFrame.selectedGlow,
      ])];
      for (const src of sources) {
        await new Promise(resolve => {
          const img = new Image();
          img.decoding = 'async';
          pickChromeWarmImages.push(img);
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            if (img.naturalWidth) warmedPickChromeSources.add(src);
            resolve();
          };
          img.onload = () => {
            if (img.decode) img.decode().catch(() => {}).finally(finish);
            else finish();
          };
          img.onerror = finish;
          img.src = src;
          window.setTimeout(finish, 1200);
        });
      }
    }).catch(error => {
      console.warn('[Apex Pick] Chrome warmup failed.', error);
    });
    return pickChromeWarmup;
  }

  const legacyPopulateRosterJsonPick = populateRoster;
  populateRoster = function() {
    document.getElementById('roster-grid')?.replaceChildren();
    renderPickRuntime();
  };

  const legacySyncSelectedFighterVfxJsonPick = syncSelectedFighterVfx;
  syncSelectedFighterVfx = function(...args) {
    syncPickState();
  };

  const legacySelectFighterJsonPick = selectFighter;
  selectFighter = function(ft, card) {
    const champ = championForFighter(ft);
    if (champ) confirmChampion(champ);
    return ft;
  };

  const legacyGoToSelectJsonPick = goToSelect;
  goToSelect = function(...args) {
    const result = legacyGoToSelectJsonPick.apply(this, args);
    PickRuntimeController.centerIndex = 0;
    PickRuntimeController.p1ChampionId = null;
    PickRuntimeController.p2ChampionId = null;
    PickRuntimeController.activePlayer = 1;
    PickRuntimeController.isAnimating = false;
    PickRuntimeController.p1Hp = '1000';
    PickRuntimeController.p2Hp = '1000';
    PickRuntimeController.p1Dmg = '100';
    PickRuntimeController.p2Dmg = '100';
    p1Selection = null;
    p2Selection = null;
    carouselTouched = false;
    document.getElementById('roster-grid')?.replaceChildren();
    renderPickRuntime();
    return result;
  };

  Object.assign(window.apexReactBridge || {}, { goToSelect, startMatch, goToMenu });
  Object.assign(window, window.apexReactBridge || {});
  // Warm only the small JSON layout during boot. Building the full pick DOM here
  // forces the browser to decode large standing/card images before the screen is used.
  loadLayout().catch(error => console.warn('[Apex Pick] Layout preload failed.', error));
  window.addEventListener('apex:boot-interactive', warmPickChrome, { once:true });
})();
