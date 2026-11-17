// Adapt the shipping Gold door through its presentation seams. Its source art
// and readiness/commit ordering remain intact; gameplay never uses this clock.
export function applyTransitionPresentation(engine, win = window) {
  const graphics = () => win.APEX_GRAPHICS?.getSnapshot?.();
  const resize = engine.resize.bind(engine);
  const capResolution = () => {
    const quality = graphics()?.effective || 'balanced';
    const pixels = { low: 450000, balanced: 800000, high: 1400000, ultra: 3200000 }[quality];
    const ratio = Math.min(win.devicePixelRatio || 1, quality === 'ultra' ? 1.5 : 1,
      Math.sqrt(pixels / Math.max(1, engine.W * engine.H)));
    const width = Math.max(1, Math.round(engine.W * ratio));
    const height = Math.max(1, Math.round(engine.H * ratio));
    if (engine.canvas.width !== width || engine.canvas.height !== height) {
      engine.dpr = ratio; engine.canvas.width = width; engine.canvas.height = height; engine.dirty = true;
    }
  };
  engine.resize = () => { resize(); capResolution(); };
  const phase = engine.advancePhase.bind(engine);
  let previous = 0, previousState = '';
  engine.advancePhase = (dt, state) => {
    const elapsed = previousState === state ? engine.now - previous : dt;
    previous = engine.now; previousState = state;
    // The donor clamps physics-like dt to 50ms. On a starved UI that turned a
    // short transition into tens of seconds. Only the animation phase catches
    // up; particles retain the donor's bounded simulation timestep.
    phase(Math.min(0.5, Math.max(dt, elapsed)) * (graphics()?.reducedMotion ? 4 : 1), state);
  };
  const render = engine.render.bind(engine);
  engine.render = () => {
    if (win.document.hidden || engine.state === 'IDLE' || engine.state === 'DONE') return;
    const state = graphics();
    if (state?.reducedMotion) {
      engine.ctx.setTransform(1,0,0,1,0,0);
      engine.ctx.clearRect(0,0,engine.canvas.width,engine.canvas.height);
      engine.ctx.fillStyle = '#080d13';
      engine.ctx.fillRect(0,0,engine.canvas.width,engine.canvas.height);
      return;
    }
    engine.fxQuality = Math.min(engine.fxQuality, state?.profile.density ?? 1);
    render();
  };
  win.addEventListener('apex:graphics-changed', capResolution);
  const destroy = engine.destroy.bind(engine);
  engine.destroy = () => { win.removeEventListener('apex:graphics-changed', capResolution); destroy(); };
  capResolution();
  return engine;
}
