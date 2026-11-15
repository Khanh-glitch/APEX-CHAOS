// Preserve shell lifecycle changes when the Gold source is regenerated.
export function applyVisibleShellWork(source) {
  const patches=[
  [
    "/* Battle owns the compositor while live: keep the pick flow state in memory,\n   but remove its entire visual tree from painting/compositing. */\nbody.battle-hud-open [data-apex-shell-stage=\"true\"]{visibility:hidden!important;pointer-events:none!important;content-visibility:hidden!important;contain:strict!important}\n\n#battleTransition{position:fixed;inset:0;z-index:10000;display:none;pointer-events:auto;overflow:hidden;isolation:isolate;--p1:#ff941f;--p2:#8bd8ff;--seam:#f1f5ef;font-family:Inter,system-ui,Arial,sans-serif;color:#f5f3ec}\n#battleTransition.is-active{display:block}\n",
    "/* Battle owns the compositor while live: keep the pick flow state in memory,\n   but remove its entire visual tree from painting/compositing. */\nbody.battle-hud-open [data-apex-shell-stage=\"true\"]{visibility:hidden!important;pointer-events:none!important;content-visibility:hidden!important;contain:strict!important}\nbody.battle-hud-open [data-apex-shell-stage=\"true\"] *,body.battle-hud-open [data-apex-shell-stage=\"true\"] *::before,body.battle-hud-open [data-apex-shell-stage=\"true\"] *::after{animation-play-state:paused!important}\n\n#battleTransition{position:fixed;inset:0;z-index:10000;display:none;pointer-events:auto;overflow:hidden;isolation:isolate;--p1:#ff941f;--p2:#8bd8ff;--seam:#f1f5ef;font-family:Inter,system-ui,Arial,sans-serif;color:#f5f3ec}\n#battleTransition.is-active{display:block}\n"
  ],
  [
    "  }\n\n  let raf=0, runtimePaused=!!window.__APEX_PARENT_RUNTIME_PAUSED;\n  function frame(now){\n    if(runtimePaused){raf=0;return;}\n    const p1=emitters.p1, p2=emitters.p2;\n    for(const em of [p1,p2]){\n      if(!em) continue;\n",
    "  }\n\n  let raf=0, runtimePaused=!!window.__APEX_PARENT_RUNTIME_PAUSED;\n  const sparksVisible=()=>!runtimePaused&&!document.hidden\n    &&stage.classList.contains('screen-fighter')\n    &&!document.body.classList.contains('battle-hud-open');\n  function reconcileSparks(){\n    if(!sparksVisible()){if(raf)cancelAnimationFrame(raf);raf=0;return;}\n    if(!raf){\n      const now=performance.now();\n      Object.values(emitters).forEach(em=>{em.last=now;});\n      raf=requestAnimationFrame(frame);\n    }\n  }\n  const sparkVisibility=new MutationObserver(reconcileSparks);\n  sparkVisibility.observe(stage,{attributes:true,attributeFilter:['class']});\n  sparkVisibility.observe(document.body,{attributes:true,attributeFilter:['class']});\n  document.addEventListener('visibilitychange',reconcileSparks);\n  function frame(now){\n    if(!sparksVisible()){raf=0;return;}\n    const p1=emitters.p1, p2=emitters.p2;\n    for(const em of [p1,p2]){\n      if(!em) continue;\n"
  ],
  [
    "    if(!runtimePaused)return;runtimePaused=false;\n    const now=performance.now();\n    Object.values(emitters).forEach(em=>{em.last=now;em.ro.observe(em.slot);em.resize();});\n    if(!raf)raf=requestAnimationFrame(frame);\n  }\n  addEventListener('apex-parent-runtime-pause',pauseSparkRuntime);\n  addEventListener('apex-parent-runtime-resume',resumeSparkRuntime);\n  if(!runtimePaused)raf=requestAnimationFrame(frame);\n\n  addEventListener('keydown',e=>{\n    if(e.repeat||e.metaKey||e.ctrlKey||e.altKey)return;\n",
    "    if(!runtimePaused)return;runtimePaused=false;\n    const now=performance.now();\n    Object.values(emitters).forEach(em=>{em.last=now;em.ro.observe(em.slot);em.resize();});\n    reconcileSparks();\n  }\n  addEventListener('apex-parent-runtime-pause',pauseSparkRuntime);\n  addEventListener('apex-parent-runtime-resume',resumeSparkRuntime);\n  reconcileSparks();\n\n  addEventListener('keydown',e=>{\n    if(e.repeat||e.metaKey||e.ctrlKey||e.altKey)return;\n"
  ]
];
  for(const [before,after] of patches){
    if(source.includes(after))continue;
    if(source.split(before).length!==2)throw Error('Gold shell visibility source drift');
    source=source.replace(before,after);
  }
  return source;
}
