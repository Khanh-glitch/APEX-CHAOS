import {translateCopy} from './localeCatalog.js';

const KEY='apex-chaos.ui-language.v1';
const ATTRS=['aria-label','title','placeholder','alt'];
const IGNORED='script,style,noscript,code,pre,textarea,svg title[data-id], [data-apex-no-localize]';
const roots=new WeakMap();
// Inject only into authored Gold documents. The native Result Gold is already
// designed in Vietnamese and must retain its own layout/fonts without overrides.
const FRAME_FONT_CSS = `@font-face{font-family:'ApexVietCondensed';src:url('/gold/fonts/apex-oswald-vietnamese.ttf') format('truetype');font-style:normal;font-weight:200 700;font-display:swap}html[data-apex-language='vie']{--fd:'ApexVietCondensed','Segoe UI',sans-serif;--fui:'ApexVietCondensed','Segoe UI',sans-serif;--fnum:'ApexVietCondensed','Segoe UI',sans-serif}`;
let language='eng';
let busy=false;
let select=null;

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
  if(!eligible(node))return;
  const seen=rec.text.get(node);
  const raw=node.nodeValue;
  // The game may rewrite translated UI content. Retain the original English
  // source while displaying Vietnamese; never treat our translation as source.
  const source=seen && (raw===seen.last || raw===seen.original)?seen.original:raw;
  const next=translateCopy(source,language);
  rec.text.set(node,{original:source,last:next});
  if(next!==raw)node.nodeValue=next;
}
function localizeAttrs(el,rec){
  if(!eligible(el))return;
  for(const attr of ATTRS){
    if(!el.hasAttribute?.(attr))continue;
    const current=el.getAttribute(attr);
    let state=rec.attrs.get(el);
    if(!state){state=new Map();rec.attrs.set(el,state);}
    const prev=state.get(attr);
    const source=prev && (current===prev.last||current===prev.original)?prev.original:current;
    const next=translateCopy(source,language);
    state.set(attr,{original:source,last:next});
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
    const embeddedId=doc.defaultView?.frameElement?.id||'';
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
  if(typeof source!=='string')return source;
  const direct=translateCopy(source,language);
  if(direct!==source)return direct;
  if(language!=='vie')return source;
  const swarm=source.match(/^SWARM\s*\/\s*(.+)$/);
  if(swarm)return 'BẦY PHẾ LIỆU / '+swarm[1];
  const lock=source.match(/^LOCK (.+?)(\s+·\s+.+)$/);
  if(lock)return 'KHÓA '+lock[1]+lock[2];
  const fail=source.match(/^A1 FAILED:\s*(.+)$/);
  if(fail)return 'KỸ NĂNG 1 THẤT BẠI: '+fail[1];
  const milestone=source.match(/^BURST M(\d+)$/);
  if(milestone)return 'BÙNG NỔ M'+milestone[1];
  return source;
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
  if(select)select.value=language;
  document.documentElement.dataset.apexLanguage=language;
  updateAll();
  window.dispatchEvent(new window.CustomEvent('apex:language-changed',{detail:{language}}));
}
function mountPicker(){
  if(select?.isConnected)return;
  const stage=document.querySelector('#gold-shell-host #stage');
  const profile=stage?.querySelector('.profile');
  if(!profile)return;
  const picker=document.createElement('div');
  picker.id='apex-language-picker';
  picker.dataset.apexNoLocalize='';
  picker.setAttribute('role','group');
  picker.setAttribute('aria-label','Language / Ngôn ngữ');
  picker.innerHTML='<span class="apex-language-caption">LANG</span><select id="apex-language-select" aria-label="Language / Ngôn ngữ"><option value="eng">ENG</option><option value="vie">VIE</option></select>';
  profile.appendChild(picker);
  select=picker.querySelector('select');
  select.value=language;
  select.addEventListener('change',()=>setLanguage(select.value));
}
export function installLocalization(){
  language=readLanguage();
  window.APEX_I18N=Object.freeze({getLanguage:()=>language,setLanguage,translate:(v)=>translateCopy(v,language)});
  document.documentElement.dataset.apexLanguage=language;
  installDocument(document);
  mountPicker();
  // Gold is mounted asynchronously. A single observer discovers it,
  // including subsequent Lucky Draw / Battle HUD same-origin iframes.
  const guard=new MutationObserver(()=>{if(!select?.isConnected)mountPicker();});
  guard.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('apex:localization-refresh',updateAll);
  window.addEventListener('storage',(event)=>{
    if(event.key!==KEY)return;
    const incoming=event.newValue==='vie'?'vie':'eng';
    if(incoming!==language)setLanguage(incoming);
  });
  setLanguage(language);
}
