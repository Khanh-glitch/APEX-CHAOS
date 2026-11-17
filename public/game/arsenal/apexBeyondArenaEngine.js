/* BOOT-FIX -> Overhaul arena ABI. All five stages, hazard simulation, floor
 * graphics and spatial VFX are owned by the UNMODIFIED Total Evolution source.
 * The former four-stage BEYOND arena implementation has been removed.
 * This adapter only connects the source arena to the receiving game's APIs.
 */
(function (g) {
  'use strict';
  if (g.APEX_BEYOND_ARENA) return;
  const original = g.APEX_EVOLUTION_ARENAS;
  if (!original) throw new Error('[EVO TRANSPLANT] Missing original arena engine');
  const TAU = Math.PI * 2;
  const stages = original.catalog();
  const THEMES = Object.freeze(stages.map(a => Object.freeze({
    id: a.id, name: a.name, short: a.shortName,
    accent: a.accent, secondary: a.secondary, events: a.events, desc: a.desc
  })));
  let banner = null, eventsEnabled = true, matchStarted = false, eventCount = 0;
  let lastTickAt = 0;
  const S = () => Number(g.GAME_SIZE) || 1000;
  // Matches the art's inner pipes/guard rail. This is a WORLD-space inset,
  // NOT a CSS margin or a camera transform. Both actors share this authority.
  const WALL_INSET = 76;
  const getWallInset = () => WALL_INSET;
  const playableBounds = f => {
    const r = Math.max(1, Number(f?.radius) || 75);
    return { min: r + WALL_INSET, max: S() - r - WALL_INSET };
  };
  function keepInsidePlayableFloor(f) {
    if (!f || f.hp <= 0 || !Number.isFinite(f.x) || !Number.isFinite(f.y)) return;
    const { min, max } = playableBounds(f);
    if (!(max > min)) return;
    // Hazard impulses and pylon separation run after Fighter.resolveWalls;
    // keep them from depositing a combatant inside the wall for one frame.
    if (f.x < min) { f.x = min + 2; if (f.dir) f.dir.x = Math.max(0.28, Math.abs(f.dir.x || 0)); }
    else if (f.x > max) { f.x = max - 2; if (f.dir) f.dir.x = -Math.max(0.28, Math.abs(f.dir.x || 0)); }
    if (f.y < min) { f.y = min + 2; if (f.dir) f.dir.y = Math.max(0.28, Math.abs(f.dir.y || 0)); }
    else if (f.y > max) { f.y = max - 2; if (f.dir) f.dir.y = -Math.max(0.28, Math.abs(f.dir.y || 0)); }
    if (f.dir) { const m = Math.hypot(f.dir.x || 0, f.dir.y || 0) || 1; f.dir.x /= m; f.dir.y /= m; }
  }
  const active = () => !!g.APEX_BEYOND_COMBAT?.isFreeBattleEligible?.();
  const currentTheme = () => THEMES.find(t => t.id === original.getSelectedId()) || THEMES[0];
  function clearScars() { original.clearScars(); g.APEX_EVOLUTION_VFX?.clear?.(); }
  function resetMatch() {
    if (!active()) { matchStarted = false; return; }
    eventCount = 0;
    banner = null;
    lastTickAt = 0;
    g.APEX_EVOLUTION_VFX?.clear?.();
    g.APEX_EVOLUTION_SHADER?.hide?.();
    original.initMatchArena(S());
    matchStarted = true;
  }
  function setTheme(id) {
    if (!THEMES.some(t => t.id === id) && id !== 'random') return currentTheme();
    const old = original.getSelectedId();
    original.setSelectedId(id);
    if (old !== id && active()) resetMatch(); // live stage switch resets only arena state
    try { g.dispatchEvent(new CustomEvent('apex:evolution-arena-theme', {detail:{id}})); } catch (_) {}
    return currentTheme();
  }
  function cycleTheme() {
    const idx = THEMES.findIndex(t => t.id === original.getSelectedId());
    return setTheme(THEMES[(idx+1)%THEMES.length].id);
  }
  function drawFloor(ctx, size) {
    if (!active()) return;
    if (!matchStarted) resetMatch();
    original.drawArenaFloor(ctx, size || S());
    const camera = ctx.getTransform();
    g.APEX_EVOLUTION_VFX?.drawInCamera?.(ctx, 'under', c => c.setTransform(camera));
  }
  function tick(dt) {
    if (!active()) { matchStarted = false; return; }
    if (!matchStarted) resetMatch();
    const d = Math.min(Math.max(Number(dt) || 0,0),0.05);
    if (eventsEnabled) original.stepArenaMechanics(d);
    else { // No residual active hazards while event switch is OFF.
      const r = original.runtime();
      if (r) { r.t += d; for (const mote of r.motes || []) {
        mote.x += mote.vx*d; mote.y += mote.vy*d;
        if (mote.y < 45) mote.y = S()-50;
      }}
    }
    // The source physics grants temporary speed buffs; the donor's movement
    // consumer is reconnected without importing its unrelated combat system.
    for (const f of g.fighters || []) {
      if (!f || f.hp <= 0 || !(f.__evoSpeedBoost > 0) || !f.dir) continue;
      f.__evoSpeedBoost = Math.max(0, f.__evoSpeedBoost-d);
      const sp = f.baseSpeed || f.speed || 520;
      const {min,max}=playableBounds(f);
      f.x=Math.max(min,Math.min(max,f.x+f.dir.x*sp*0.3*d));
      f.y=Math.max(min,Math.min(max,f.y+f.dir.y*sp*0.3*d));
    }
    // Final safety for arena mechanics that directly write f.x/f.y (rotor
    // gust, pylon/monolith separation), regardless of temporary speed buff.
    for (const f of g.fighters || []) keepInsidePlayableFloor(f);
    g.APEX_EVOLUTION_VFX?.step?.(d);
  }
  function drawForeground(ctx) {
    if (!active()) return;
    const camera = ctx.getTransform();
    g.APEX_EVOLUTION_VFX?.drawInCamera?.(ctx,'over',c => c.setTransform(camera));
  }
  function composite(dt) {
    if (active()) g.APEX_EVOLUTION_SHADER?.stepAndComposite?.(dt);
    else g.APEX_EVOLUTION_SHADER?.hide?.();
  }
  function toColorRgb(color) {
    const c=String(color || '#ffa939').replace('#','');
    if (/^[a-f\d]{6}$/i.test(c)) return [0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255);
    if (/^[a-f\d]{3}$/i.test(c)) return [...c].map(x=>parseInt(x+x,16)/255);
    return [1,0.66,0.22];
  }
  function addLight(x,y,radius,color,intensity,duration) {
    const [r,gc,b] = toColorRgb(color);
    g.APEX_EVOLUTION_SHADER?.pushLight?.(x,y,r,gc,b,radius,Number(intensity)||0.5);
  }
  function bannerEvent() {
    if (!active() || !banner) return null;
    const remaining=(banner.until-performance.now())/1000;
    if (remaining<=0) {banner=null;return null;}
    return {
      type:'EVOLUTION_ARENA', phase:banner.kind === 'warn' ? 'TELEGRAPH':'ACTIVE',
      label:banner.title, sub:banner.sub || '', color:banner.color || '#ffae34', remaining
    };
  }
  const HUD = {
    arenaBanner(o) {
      if (!o) return;
      banner={...o,until:performance.now()+Math.max(0.3,Number(o.seconds)||2)*1000};
      try {g.dispatchEvent(new CustomEvent('apex:evolution-arena-banner',{detail:{...o}}));} catch (_) {}
    }
  };
  // Narrow donor combat seam used BY the original arena, never a second combat
  // simulation. The receiving game's kinetic fighter engine remains authoritative.
  const COMBAT = {
    getState() {
      const st=g.APEX_BEYOND_COMBAT?.getState?.();
      return { sides:(st?.sides||[]).map(s=>({styleScore:(s.combo||0)*15+(s.deflects||0)*8,ricochets:s.wallSlams||0})) };
    },
    onArenaEvent() {eventCount++;},
    addStyleAndSync(idx,styleGain,syncGain) {
      const st=g.APEX_BEYOND_COMBAT?.getState?.()?.sides?.[idx];
      if(st && st.overdriveTimer<=0) st.overdrive=Math.min(100,st.overdrive+(Number(syncGain)||0));
    },
    callout(x,y,label,color,scale) {g.APEX_BEYOND_VFX?.emitCallout?.(x,y,label,color,'#111420',scale||1);},
    onWallBounce(f,idx,nx,ny) {
      if (!f || !f.dir) return;
      f.__evoSpeedBoost=Math.max(f.__evoSpeedBoost||0,0.6);
      g.APEX_EVOLUTION_AUDIO?.playRicochetBoost?.();
      g.APEX_EVOLUTION_VFX?.recipes?.impactSparks?.(
        f.x-nx*(f.radius||75),f.y-ny*(f.radius||75),10,idx===0?'#ffb347':'#5ce1ff',f.y+40
      );
    }
  };
  // Keep the source arena untouched, exposing only documented support callbacks.
  g.APEX_EVOLUTION_HUD=HUD;
  g.APEX_EVOLUTION_COMBAT=COMBAT;
  g.APEX_BEYOND_ARENA=Object.freeze({
    THEMES,currentTheme,setTheme,cycleTheme,resetMatch,clearScars,drawFloor,
    getWallInset,playableBounds,keepInsidePlayableFloor,
    tick,drawForeground,composite,getEvent:bannerEvent,
    setEventsEnabled(v){eventsEnabled=!!v;return eventsEnabled;},
    // Existing *non-arena* BEYOND combat effects forward their impacts into the
    // Evolution floor scars and WebGL light pass, never old BEYOND stage art.
    stampScorch(x,y,size) {original.addScar('scorch',x,y,size||30);},
    stampFracture(x,y,angle=0,power=1) {original.addScar('slash',x,y,Math.max(20,45*power),angle);},
    // BEYOND skid scratches become unexplained straight lines when stamped
    // on the imported high-detail decks; omit only this cosmetic decal.
    stampSkid(x,y,angle=0,size=24) {},
    addLight,
    triggerWallImpact(side,pos,power,color) {
      const r=original.runtime();if(!r)return;
      r.wallPulses.push({side:{left:'L',right:'R',top:'T',bottom:'B'}[side]||side,pos,
        col:color||'#ffae34',life:0.45});
    },
    triggerPowerDip(){},
    drawOverheadAtmosphere(){}, // Evolution floor draws its OWN airborne motes
    getOriginalArena:()=>original,
    getArenaEventCount:()=>eventCount,
  });
  g.apexBeyondArenaEngine='evolution-transplant-ready';
})(window);
