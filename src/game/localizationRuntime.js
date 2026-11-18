import {translateCopy} from './localeCatalog.js';
import {apexAppUrl} from './appRoot.js';

const KEY='apex-chaos.ui-language.v1';
const ATTRS=['aria-label','title','placeholder','alt'];
const IGNORED='script,style,noscript,code,pre,textarea,svg title[data-id], [data-apex-no-localize]';
// Pure whitespace / digits / timers / damage counters (e.g. "0:48", "+120", "850", "2.4s", "—")
// never need dictionary/regex lookup or DOM ancestor .closest() traversal during 60 FPS combat.
const NON_WORD_FAST_RE=/^[\s0-9.,:%+\-–—/×·•()[\]|!?#*°~_=$€₫]*$/;
const roots=new WeakMap();
const canvasCopyCache=new Map();
// Inject only into authored Gold documents. The native Result Gold is already
// designed in Vietnamese and must retain its own layout/fonts without overrides.
const VIET_FONT_URL=apexAppUrl('/gold/fonts/apex-oswald-vietnamese.ttf');
const FRAME_FONT_CSS = `@font-face{font-family:'ApexVietCondensed';src:url('${VIET_FONT_URL}') format('truetype');font-style:normal;font-weight:200 700;font-display:swap}html[data-apex-language='vie']{--fd:'ApexVietCondensed','Segoe UI',sans-serif;--fui:'ApexVietCondensed','Segoe UI',sans-serif;--fnum:'ApexVietCondensed','Segoe UI',sans-serif}`;
let language='eng';
let busy=false;
let pickerEl=null;

function readLanguage(){
  try {return localStorage.getItem(KEY)==='vie'?'vie':'eng';}catch{return 'eng';}
}
function saveLanguage(next){
  try {localStorage.setItem(KEY,next);}catch{}
}
function eligible(node){
  const host=node.nodeType===3?node.parentElement:node;
  if(!host || !host.closest)return false;
  return !host.closest(IGNORED);
}
function localizeText(node,rec){
  const raw=node.nodeValue;
  if(!raw)return;
  const seen=rec.text.get(node);
  if(seen&&seen.last===raw&&seen.language===language)return;
  if(!seen&&(language==='eng'||NON_WORD_FAST_RE.test(raw)))return;
  if(seen&&language==='eng'&&raw!==seen.last)return;
  if(!seen||raw!==seen.last){
    if(NON_WORD_FAST_RE.test(raw)){
      if(seen)rec.text.delete(node);
      return;
    }
  }
  if(!eligible(node))return;
  // The game may rewrite translated UI content. Retain the original English
  // source while displaying Vietnamese; never treat our translation as source.
  const source=seen && (raw===seen.last || raw===seen.original)?seen.original:raw;
  const next=language==='eng'?source:translateCopy(source,language);
  rec.text.set(node,{original:source,last:next,language});
  if(next!==raw)node.nodeValue=next;
}
function localizeAttrs(el,rec){
  let checkedEligible=false;
  for(const attr of ATTRS){
    if(!el.hasAttribute?.(attr))continue;
    const current=el.getAttribute(attr);
    if(!current)continue;
    let state=rec.attrs.get(el);
    const prev=state?.get(attr);
    if(prev&&prev.last===current&&prev.language===language)continue;
    if(!prev&&(language==='eng'||NON_WORD_FAST_RE.test(current)))continue;
    if(!checkedEligible){if(!eligible(el))return;checkedEligible=true;}
    if(!state){state=new Map();rec.attrs.set(el,state);}
    const source=prev && (current===prev.last||current===prev.original)?prev.original:current;
    const next=language==='eng'?source:translateCopy(source,language);
    state.set(attr,{original:source,last:next,language});
    if(next!==current)el.setAttribute(attr,next);
  }
}
function walk(node,rec){
  if(!node || !eligible(node) && node.nodeType!==9 && node.nodeType!==11)return;
  if(node.nodeType===3){localizeText(node,rec);return;}
  if(node.nodeType===1)localizeAttrs(node,rec);
  for(let child=node.firstChild;child;child=child.nextSibling){
    if(child.nodeType===1 || child.nodeType===3)walk(child,rec);
  }
}
function setDocLanguage(doc){
  if(!doc?.documentElement)return;
  doc.documentElement.lang=language==='vie'?'vi':'en';
  doc.documentElement.dataset.apexLanguage=language;
  if(doc!==document){
    const path=doc.defaultView?.location?.pathname||'';
    let embeddedId='';
    try{embeddedId=doc.defaultView?.frameElement?.id||'';}catch(_){}
    const goldDoc=path.includes('/gold/') || embeddedId==='battleHudFrame' || embeddedId==='luckyDonorFrame';
    let css=doc.getElementById('apex-locale-frame-font');
    if(!goldDoc){
      // Do not apply a generic fallback to Result Gold, Quest-owned layouts,
      // or unrelated authored documents.
      css?.remove();
    }else{
      if(!css&&doc.head){css=doc.createElement('style');css.id='apex-locale-frame-font';doc.head.appendChild(css);}
      if(css&&css.textContent!==FRAME_FONT_CSS)css.textContent=FRAME_FONT_CSS;
    }
  }
}

function canvasCopy(source){
  if(typeof source!=='string'||!source||language!=='vie'||NON_WORD_FAST_RE.test(source))return source;
  const cached=canvasCopyCache.get(source);
  if(cached!==undefined)return cached;
  let out=translateCopy(source,'vie');
  if(out===source){
    const swarm=source.match(/^SWARM\s*\/\s*(.+)$/);
    if(swarm)out='BẦY PHẾ LIỆU / '+swarm[1];
    else{
      const lock=source.match(/^LOCK (.+?)(\s+·\s+.+)$/);
      if(lock)out='KHÓA '+lock[1]+lock[2];
      else{
        const fail=source.match(/^A1 FAILED:\s*(.+)$/);
        if(fail)out='KỸ NĂNG 1 THẤT BẠI: '+fail[1];
        else{
          const milestone=source.match(/^BURST M(\d+)$/);
          if(milestone)out='BÙNG NỔ M'+milestone[1];
        }
      }
    }
  }
  if(canvasCopyCache.size>=256)canvasCopyCache.clear();
  canvasCopyCache.set(source,out);
  return out;
}
// Local presentation decorator. It is installed on the ONE actual game
// canvas's existing 2D context, never the global Canvas prototype, offscreen
// canvases, Gold transitions, Lucky Draw, story snapshots or weapon canvases.
// No combat source, renderer ordering, physics or weapon IDs are modified.
function installCanvasLocale(doc){
  const canvas=doc.getElementById?.('game-canvas');
  if(!canvas||canvas.__apexCanvasLocaleInstalled)return;
  let ctx;
  try{ctx=canvas.getContext('2d');}catch{return;}
  if(!ctx)return;
  for(const method of ['fillText','strokeText']){
    const original=ctx[method];
    if(typeof original!=='function')continue;
    Object.defineProperty(ctx,method,{configurable:true,writable:true,value:function(...args){
      if(language!=='vie'||typeof args[0]!=='string')return original.apply(this,args);
      const out=canvasCopy(args[0]);
      if(out===args[0])return original.apply(this,args);
      args[0]=out;
      const oldFont=this.font;
      // Some Gold display faces omit Vietnamese accents. Change the glyph
      // face only for this localized draw call; restore the exact old font.
      const vietnameseFont=typeof oldFont==='string'
        ?oldFont.replace(/([0-9]+(?:[.][0-9]+)?(?:px|pt)).*$/, '$1 "ApexVietCondensed", sans-serif'):oldFont;
      if(vietnameseFont!==oldFont)this.font=vietnameseFont;
      try{return original.apply(this,args);}
      finally{if(this.font!==oldFont)this.font=oldFont;}
    }});
  }
  Object.defineProperty(canvas,'__apexCanvasLocaleInstalled',{value:true,configurable:true});
}

function installDocument(doc){
  if(!doc?.documentElement)return;
  if(roots.has(doc))return;
  const rec={text:new WeakMap(),attrs:new WeakMap(),observer:null};
  roots.set(doc,rec);
  setDocLanguage(doc);
  busy=true;
  try{walk(doc.body,rec);}finally{busy=false;}
  const observer=new MutationObserver((records)=>{
    if(busy)return;
    busy=true;
    try{
      // Single batched observer, not one observer per element.
      for(const change of records){
        if(change.type==='characterData')localizeText(change.target,rec);
        else if(change.type==='attributes')localizeAttrs(change.target,rec);
        else if(change.type==='childList')for(const n of change.addedNodes)walk(n,rec);
      }
      // Frame discovery belongs to node insertions only. Combat counters
      // update text every frame; scanning the entire document on each tick
      // would add unnecessary work to the 60 FPS path.
      if(doc===document && records.some(change=>change.type==='childList'&&change.addedNodes.length))installCanvasLocale(doc);
      for(const change of records){
        if(change.type!=='childList')continue;
        for(const node of change.addedNodes){
          if(node.nodeType!==1)continue;
          if(node.matches?.('iframe'))wireFrame(node);
          for(const frame of node.querySelectorAll?.('iframe')||[])wireFrame(frame);
        }
      }
    }finally{busy=false;}
  });
  observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  rec.observer=observer;
  attachFrames(doc);
  if(doc===document)installCanvasLocale(doc);
}
function wireFrame(frame){
  // The mobile Gold fidelity iframe boots a FULL second game application.
  // Its own localization instance owns its DOM and game canvas. Double
  // observing that document from the outer shell would race two languages.
  if(frame.id==='gold-document')return;
  try{if(frame.contentWindow?.APEX_I18N)return;}catch{}
  if(!frame.__apexLocaleWired){
    frame.__apexLocaleWired=true;
    frame.addEventListener('load',()=>{
      try{installDocument(frame.contentDocument);}catch{}
    });
  }
  try{installDocument(frame.contentDocument);}catch{}
}
function attachFrames(doc){
  for(const frame of doc.querySelectorAll('iframe'))wireFrame(frame);
}
function updateAll(){
  busy=true;
  try{
    const visit=(doc)=>{
      const rec=roots.get(doc);
      if(rec){
        setDocLanguage(doc);
        walk(doc.body,rec);
      }
      for(const frame of doc.querySelectorAll('iframe')){
        try{if(frame.contentDocument)visit(frame.contentDocument);}catch{}
      }
    };
    visit(document);
  }finally{busy=false;}
}
function setLanguage(next){
  if(next!=='vie' && next!=='eng')return;
  language=next;
  saveLanguage(language);
  syncPicker();
  document.documentElement.dataset.apexLanguage=language;
  updateAll();
  window.dispatchEvent(new window.CustomEvent('apex:language-changed',{detail:{language}}));
}
function readSettingsSnap(){
  try{
    const s=window.APEX_SETTINGS?.get?.();
    if(s)return s;
  }catch(_){}
  return {gfxMode:'auto',gfxEffective:'ultra',musicMuted:false,sfxMuted:false,reducedMotion:false,language};
}
function syncPicker(){
  if(!pickerEl)return;
  const vie=language==='vie';
  const snap=readSettingsSnap();
  const setText=(sel,val)=>{const el=pickerEl.querySelector(sel);if(el&&el.textContent!==val)el.textContent=val;};
  setText('.apex-utility-edition',vie?'CÀI ĐẶT':'SETTINGS');
  setText('.apex-language-caption',vie?'NGÔN NGỮ':'LANGUAGE');
  const effLabel={ultra:vie?'CAO':'HIGH',balanced:vie?'CÂN':'BAL',off:vie?'THẤP':'LOW'}[snap.gfxEffective]||'HIGH';
  setText('[data-apex-cap="gfx"]',snap.gfxMode==='auto'
    ? (vie?`ĐỒ HỌA · TỰ ĐỘNG (${effLabel})`:`GRAPHICS · AUTO (${effLabel})`)
    : (vie?'CHẤT LƯỢNG ĐỒ HỌA':'GRAPHICS QUALITY'));
  setText('[data-apex-cap="audio"]',vie?'ÂM THANH':'AUDIO');
  setText('[data-apex-cap="motion"]',vie?'HIỆU ỨNG CHUYỂN ĐỘNG':'INTERFACE MOTION');
  setText('.apex-utility-help-label',vie?'TRỢ GIÚP & TÂN THỦ':'GUIDE & TUTORIAL');

  for(const btn of pickerEl.querySelectorAll('[data-apex-language-option]')){
    const active=btn.dataset.apexLanguageOption===language;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
  }
  const gfxLabels={
    auto:'AUTO',
    ultra:vie?'CAO':'HIGH',
    balanced:vie?'CÂN':'BAL',
    off:vie?'THẤP':'LOW',
  };
  for(const btn of pickerEl.querySelectorAll('[data-apex-gfx-option]')){
    const mode=btn.dataset.apexGfxOption;
    const active=mode===snap.gfxMode;
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
    if(gfxLabels[mode]&&btn.textContent!==gfxLabels[mode])btn.textContent=gfxLabels[mode];
  }
  const musicBtn=pickerEl.querySelector('[data-apex-audio-toggle="music"]');
  if(musicBtn){
    const on=!snap.musicMuted;
    musicBtn.classList.toggle('is-active',on);
    musicBtn.setAttribute('aria-pressed',on?'true':'false');
    const lbl=musicBtn.querySelector('span');
    const st=musicBtn.querySelector('b');
    if(lbl)lbl.textContent=vie?'NHẠC (M)':'MUSIC (M)';
    if(st)st.textContent=on?(vie?'BẬT':'ON'):(vie?'TẮT':'OFF');
  }
  const sfxBtn=pickerEl.querySelector('[data-apex-audio-toggle="sfx"]');
  if(sfxBtn){
    const on=!snap.sfxMuted;
    sfxBtn.classList.toggle('is-active',on);
    sfxBtn.setAttribute('aria-pressed',on?'true':'false');
    const lbl=sfxBtn.querySelector('span');
    const st=sfxBtn.querySelector('b');
    if(lbl)lbl.textContent='SFX';
    if(st)st.textContent=on?(vie?'BẬT':'ON'):(vie?'TẮT':'OFF');
  }
  for(const btn of pickerEl.querySelectorAll('[data-apex-motion-option]')){
    const reducedOpt=btn.dataset.apexMotionOption==='reduced';
    const active=reducedOpt===Boolean(snap.reducedMotion);
    btn.classList.toggle('is-active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
    btn.textContent=reducedOpt?(vie?'GIẢM RUNG':'REDUCED'):(vie?'ĐẦY ĐỦ':'FULL');
  }
  const guideBtn=pickerEl.querySelector('#apex-guide-open');
  if(guideBtn){
    guideBtn.textContent=vie?'MỞ HƯỚNG DẪN CHƠI':'OPEN PLAY GUIDE';
  }
}
function mountPicker(){
  if(pickerEl?.isConnected && document.getElementById('apex-utility-toggle')?.isConnected)return;
  const stage=document.querySelector('#gold-shell-host #stage');
  const profile=stage?.querySelector('.profile');
  if(!stage)return;
  // Unified Gold Tactical command drawer: Language, Graphics Quality,
  // Music/SFX audio toggles, Motion comfort, and Play Guide in one clean sheet.
  const picker=document.createElement('div');
  picker.id='apex-language-picker';
  picker.dataset.apexNoLocalize='';
  picker.setAttribute('role','dialog');
  picker.setAttribute('aria-modal','false');
  picker.setAttribute('aria-label','System Settings / Cài đặt hệ thống');
  picker.hidden=true;
  picker.innerHTML='<div class="apex-utility-head">'
    +'<span class="apex-utility-kicker">APEX // SYSTEM</span>'
    +'<span class="apex-utility-edition">SETTINGS</span>'
    +'<button type="button" class="apex-utility-close" data-apex-utility-close aria-label="Close / Đóng">✕</button>'
    +'</div>'
    +'<div class="apex-utility-section"><span class="apex-language-caption">LANGUAGE</span>'
    +'<span class="apex-language-options">'
    +'<button type="button" id="apex-language-eng" data-apex-language-option="eng" aria-pressed="false">ENG</button>'
    +'<button type="button" id="apex-language-vie" data-apex-language-option="vie" aria-pressed="false">VIE</button>'
    +'</span></div>'
    +'<div class="apex-utility-section"><span class="apex-utility-caption" data-apex-cap="gfx">GRAPHICS QUALITY</span>'
    +'<span class="apex-utility-grid cols-4">'
    +'<button type="button" data-apex-gfx-option="auto" aria-pressed="true">AUTO</button>'
    +'<button type="button" data-apex-gfx-option="ultra" aria-pressed="false">HIGH</button>'
    +'<button type="button" data-apex-gfx-option="balanced" aria-pressed="false">BAL</button>'
    +'<button type="button" data-apex-gfx-option="off" aria-pressed="false">LOW</button>'
    +'</span></div>'
    +'<div class="apex-utility-section"><span class="apex-utility-caption" data-apex-cap="audio">AUDIO</span>'
    +'<span class="apex-utility-grid cols-2">'
    +'<button type="button" class="apex-utility-pill" data-apex-audio-toggle="music" aria-pressed="true"><span>MUSIC (M)</span><b>ON</b></button>'
    +'<button type="button" class="apex-utility-pill" data-apex-audio-toggle="sfx" aria-pressed="true"><span>SFX</span><b>ON</b></button>'
    +'</span></div>'
    +'<div class="apex-utility-section"><span class="apex-utility-caption" data-apex-cap="motion">INTERFACE MOTION</span>'
    +'<span class="apex-utility-grid cols-2">'
    +'<button type="button" data-apex-motion-option="full" aria-pressed="true">FULL</button>'
    +'<button type="button" data-apex-motion-option="reduced" aria-pressed="false">REDUCED</button>'
    +'</span></div>'
    +'<div class="apex-utility-help-label">GUIDE & TUTORIAL</div>';
  stage.appendChild(picker);
  pickerEl=picker;
  const toggle=document.createElement('button');
  toggle.type='button';
  toggle.id='apex-utility-toggle';
  toggle.dataset.apexNoLocalize='';
  toggle.setAttribute('aria-label','System settings / Cài đặt hệ thống');
  toggle.setAttribute('aria-controls',picker.id);
  toggle.setAttribute('aria-expanded','false');
  toggle.setAttribute('aria-haspopup','dialog');
  toggle.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round">'
    +'<path d="M4 7h16M4 12h16M4 17h16"/>'
    +'<circle cx="9" cy="7" r="2" fill="#101015"/>'
    +'<circle cx="16" cy="12" r="2" fill="#101015"/>'
    +'<circle cx="11" cy="17" r="2" fill="#101015"/>'
    +'</svg>';
  (profile||stage).appendChild(toggle);
  const playUi=(key)=>{try{window.apexUiSfx?.play?.(key);}catch(_){}};
  const collapse=(restoreFocus=false)=>{
    if(picker.hidden)return;
    picker.hidden=true;
    picker.classList.remove('is-expanded');
    toggle.setAttribute('aria-expanded','false');
    if(restoreFocus)toggle.focus({preventScroll:true});
  };
  const expand=()=>{
    syncPicker();
    picker.hidden=false;
    picker.classList.add('is-expanded');
    toggle.setAttribute('aria-expanded','true');
    playUi('ui.button.press');
  };
  toggle.addEventListener('click',()=>{
    if(picker.hidden)expand();
    else {playUi('ui.back.cancel');collapse(false);}
  });
  picker.addEventListener('click',(event)=>{
    if(event.target?.closest?.('[data-apex-utility-close]')){
      playUi('ui.back.cancel');collapse(true);return;
    }
    const langBtn=event.target?.closest?.('[data-apex-language-option]');
    if(langBtn){
      setLanguage(langBtn.dataset.apexLanguageOption);
      playUi('ui.option.confirm');
      syncPicker();
      return;
    }
    const gfxBtn=event.target?.closest?.('[data-apex-gfx-option]');
    if(gfxBtn){
      window.APEX_SETTINGS?.setGfxMode?.(gfxBtn.dataset.apexGfxOption);
      playUi('ui.option.confirm');
      syncPicker();
      return;
    }
    const audBtn=event.target?.closest?.('[data-apex-audio-toggle]');
    if(audBtn){
      const kind=audBtn.dataset.apexAudioToggle;
      if(kind==='music')window.APEX_SETTINGS?.toggleMusic?.();
      else window.APEX_SETTINGS?.toggleSfx?.();
      if(kind==='music'||!window.APEX_SETTINGS?.get?.()?.sfxMuted)playUi('ui.option.confirm');
      syncPicker();
      return;
    }
    const motBtn=event.target?.closest?.('[data-apex-motion-option]');
    if(motBtn){
      window.APEX_SETTINGS?.setReducedMotion?.(motBtn.dataset.apexMotionOption==='reduced');
      playUi('ui.option.confirm');
      syncPicker();
      return;
    }
    if(event.target?.closest?.('#apex-guide-open')){collapse(false);}
  });
  // Auto-collapse drawer when leaving Home for Mode/Fighter/Battle/Draw
  const stageObs=new MutationObserver(()=>{
    if(!picker.hidden&&(stage.classList.contains('screen-mode')||stage.classList.contains('screen-fighter')||stage.classList.contains('screen-battle')||stage.classList.contains('screen-draw'))){
      collapse(false);
    }
  });
  stageObs.observe(stage,{attributes:true,attributeFilter:['class']});
  document.addEventListener('pointerdown',(event)=>{
    if(!picker.hidden&&!picker.contains(event.target)&&!toggle.contains(event.target))collapse(false);
  },true);
  document.addEventListener('keydown',(event)=>{
    if(event.key==='Escape'&&!picker.hidden){
      event.preventDefault();event.stopImmediatePropagation();
      playUi('ui.back.cancel');collapse(true);
    }
  },true);
  syncPicker();
  try{window.dispatchEvent(new CustomEvent('apex:utility-mounted'));}catch(_){}
}
export function installLocalization(){
  language=readLanguage();
  window.APEX_I18N=Object.freeze({getLanguage:()=>language,setLanguage,translate:(v)=>translateCopy(v,language)});
  document.documentElement.dataset.apexLanguage=language;
  installDocument(document);
  mountPicker();
  // Watch the Gold shell host until #stage mounts; disconnect once mounted so
  // live combat DOM updates never trigger drawer discovery callbacks.
  const bindHostObserver=()=>{
    if(pickerEl?.isConnected)return null;
    const host=document.getElementById('gold-shell-host')||document.body;
    const obs=new MutationObserver(()=>{
      if(!pickerEl?.isConnected)mountPicker();
      if(pickerEl?.isConnected&&host===document.getElementById('gold-shell-host'))obs.disconnect();
    });
    obs.observe(host,{childList:true,subtree:host===document.body});
    return obs;
  };
  bindHostObserver();
  document.addEventListener('apex:localization-refresh',updateAll);
  window.addEventListener('apex:settings-changed',syncPicker);
  window.addEventListener('storage',(event)=>{
    if(event.key!==KEY)return;
    const incoming=event.newValue==='vie'?'vie':'eng';
    if(incoming!==language)setLanguage(incoming);
  });
  setLanguage(language);
}
