// Opt-in, read-only device geometry probe. Never enabled for ordinary players.
// Visit the PREVIEW URL with ?apexViewportAudit=1 to compare a real phone
// against laptop emulation without changing Gold CSS, gameplay or layout.
if (new URLSearchParams(location.search).get('apexViewportAudit') === '1') {
  const short = n => n ? (() => {
    const r=n.getBoundingClientRect(),s=getComputedStyle(n);
    return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),
      h:+r.height.toFixed(1),bottom:+r.bottom.toFixed(1),display:s.display,
      visibility:s.visibility,position:s.position,transform:s.transform,
      fontSize:s.fontSize,top:s.top,overflow:s.overflow,
      pointerEvents:s.pointerEvents};
  })() : null;
  const get = q => document.querySelector(q);
  let open=false, last='';
  const root=document.createElement('section');
  root.id='apex-viewport-audit';
  root.style.cssText='position:fixed!important;z-index:2147483647!important;top:8px;left:8px;max-width:min(92vw,340px);font:11px/1.4 monospace;color:#fff;background:rgba(8,10,15,.95);border:1px solid #ffad40;border-radius:7px;padding:7px;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:anywhere;pointer-events:auto';
  const button=document.createElement('button');
  button.textContent='VIEWPORT AUDIT · OPEN';
  button.style.cssText='display:block;width:100%;background:#ffad40;color:black;border:0;padding:7px;font:700 11px monospace;cursor:pointer';
  const panel=document.createElement('pre');
  panel.style.cssText='display:none;white-space:pre-wrap;max-height:63dvh;overflow:auto;font:10px/1.32 monospace;margin:7px 0';
  const copy=document.createElement('button');
  copy.textContent='COPY REPORT';
  copy.style.cssText='display:none;background:#222;color:white;border:1px solid #aaa;padding:7px;font:11px monospace';
  root.append(button,panel,copy);
  const report=()=>{
    const v=window.visualViewport;
    const stage=get('#stage'),hud=get('#battleHudHost #hud'),pick=get('.fighterSelectScreen');
    const a=get('#stage .actions'),routes=get('#stage .routes');
    const aRect=a?.getBoundingClientRect(),rRect=routes?.getBoundingClientRect();
    const meta=document.head.querySelector('meta[name="viewport"]');
    const dims={
      revision:'device-audit-r79',href:location.href,
      ua:navigator.userAgent,devicePixelRatio:devicePixelRatio,
      screen:{w:screen.width,h:screen.height,availW:screen.availWidth,availH:screen.availHeight},
      window:{innerW:innerWidth,innerH:innerHeight,outerW:outerWidth,outerH:outerHeight},
      root:{clientW:document.documentElement.clientWidth,clientH:document.documentElement.clientHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight},
      visual:v?{w:v.width,h:v.height,offsetTop:v.offsetTop,offsetLeft:v.offsetLeft,scale:v.scale}:null,
      viewportMeta:meta?.content??null,
      media:{portrait:matchMedia('(orientation:portrait)').matches,max360:matchMedia('(max-width:360px)').matches,
        max700height:matchMedia('(max-height:700px)').matches,max980:matchMedia('(max-width:980px)').matches},
      stageClass:stage?.className??null,hudLayout:hud?.dataset.layout??null,
      hudSize:hud?.dataset.size??null,hudMode:hud?.dataset.mode??null,
      rects:{stage:short(stage),actions:short(a),freeBattle:short(get('#freeBattle')),routes:short(routes),
        story:short(get('#stage .story')),storyTitle:short(get('#stage .storyTitle')),
        fighterScreen:short(pick),fighterArena:short(get('.fighterArena')),
        roster:short(get('#fighterRoster')),heroCard:short(get('#fighterRoster .rosterCard')),
        hudStage:short(get('#battleHudHost #stage')),arena:short(get('#battleHudHost #arena')),
        battleCanvas:short(get('#battleHudHost canvas'))},
      actionsRouteGap:aRect&&rRect?+(rRect.top-aRect.bottom).toFixed(1):null,
      homeGuard:window.__apexHomeGeometryGuard?.snapshot?.()??null,
    };
    return dims;
  };
  button.addEventListener('click',()=>{open=!open;panel.style.display=open?'block':'none';copy.style.display=open?'block':'none';
    button.textContent='VIEWPORT AUDIT · '+(open?'CLOSE':'OPEN');if(open)refresh();});
  function refresh(){if(!open)return;let payload=JSON.stringify(report(),null,2);if(payload!==last){panel.textContent=payload;last=payload;}}
  copy.addEventListener('click',async()=>{
    const value=JSON.stringify(report(),null,2);
    try{await navigator.clipboard.writeText(value);copy.textContent='COPIED';}
    catch{panel.textContent=value;panel.focus();copy.textContent='SELECT TEXT ABOVE';}
  });
  const mount=()=>{if(document.body&&!root.isConnected)document.body.appendChild(root);};
  if(document.body)mount();else document.addEventListener('DOMContentLoaded',mount,{once:true});
  window.addEventListener('resize',refresh,{passive:true});
  window.visualViewport?.addEventListener('resize',refresh,{passive:true});
  setInterval(refresh,800);
  window.__apexViewportAudit=report;
}
