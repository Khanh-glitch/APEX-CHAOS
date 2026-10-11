import {translateCopy} from './localeCatalog.js';

const KEY='apex-chaos.ui-language.v1';
const ATTRS=['aria-label','title','placeholder','alt'];
const IGNORED='script,style,noscript,code,pre,textarea,svg title[data-id], [data-apex-no-localize]';
const roots=new WeakMap();
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
function installDocument(doc){
  if(!doc?.documentElement)return;
  if(roots.has(doc))return;
  const rec={text:new WeakMap(),attrs:new WeakMap(),observer:null};
  roots.set(doc,rec);
  doc.documentElement.lang=language==='vie'?'vi':'en';
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
      attachFrames(doc);
    }finally{busy=false;}
  });
  observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
  rec.observer=observer;
  attachFrames(doc);
}
function attachFrames(doc){
  for(const frame of doc.querySelectorAll('iframe')){
    if(!frame.__apexLocaleWired){
      frame.__apexLocaleWired=true;
      frame.addEventListener('load',()=>{
        try{installDocument(frame.contentDocument);}catch{}
      });
    }
    try{installDocument(frame.contentDocument);}catch{}
  }
}
function updateAll(){
  busy=true;
  try{
    const visit=(doc)=>{
      const rec=roots.get(doc);
      if(rec){
        doc.documentElement.lang=language==='vie'?'vi':'en';
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
  window.dispatchEvent(new CustomEvent('apex:language-changed',{detail:{language}}));
}
function mountPicker(){
  if(select?.isConnected)return;
  const stage=document.querySelector('#gold-shell-host #stage');
  if(!stage)return;
  const picker=document.createElement('div');
  picker.id='apex-language-picker';
  picker.dataset.apexNoLocalize='';
  picker.setAttribute('role','group');
  picker.setAttribute('aria-label','Language / Ngôn ngữ');
  picker.innerHTML='<span class="apex-language-caption">LANG</span><select id="apex-language-select" aria-label="Language / Ngôn ngữ"><option value="eng">ENG</option><option value="vie">VIE</option></select>';
  stage.appendChild(picker);
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
  setLanguage(language);
}
