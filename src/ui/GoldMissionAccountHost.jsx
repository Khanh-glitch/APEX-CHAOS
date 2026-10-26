import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apexAppUrl } from '../game/appRoot.js';
import { MASTERY_HEROES, applicableAchievements, primaryProgress } from './masteryCatalog.js';
import { translateCopy } from '../game/localeCatalog.js';
import { cosmetics } from '../game/cosmetics/cosmeticAuthority.js';

// Exact owner Gold runs as its own visual document. This bridge is ONLY a
// presentation adapter; no Gold data store can mint AC or unlock skins.
const HERO_META = Object.freeze({
  ROBOT: ['NEWBOT','CƠ KHÍ','#ffc43d','newbot'],
  HUNTER: ['HUNTER','SĂN ĐUỔI','#ff743d','hunter'],
  CRYSTAL: ['CRYSTALA','PHA LÊ','#db89fb','crystala'],
  MAGNET: ['MAGNET','TỪ TRƯỜNG','#eb6a34','magnet'],
  ICE: ['FROST','BĂNG GIÁ','#87d5ff','frost'],
  MIRROR: ['MIRROR','PHẢN CHIẾU','#edb8d4','mirror'],
  BOXE: ['BOXE','CẬN CHIẾN','#ef9d48','boxe'],
  SHURI: ['SHURI','THỦ PHÁP','#ffb265','shuri'],
});
const RESULT_IDS = Object.freeze({ ROBOT:'NEWBOT', CRYSTAL:'CRYSTALA', ICE:'FROST' });
const ICONS = Object.freeze({ offense:'blade', precision:'target', weapon:'blade',survival:'shield',tactics:'target',chaos:'flame',signature:'star' });
// Verified against the production Gold Product Bridge's HERO_UI_ART manifest.
// These are ORIGINAL approved fighter visuals, never /gold/assets/placeholders.
const APPROVED_PORTRAITS = Object.freeze({
  ROBOT:'/assets/gold-ui/heroes/newbot/pick_selected_large.webp',
  HUNTER:'/assets/gold-ui/heroes/hunter/pick_selected_large.webp',
  CRYSTAL:'/assets/gold-ui/heroes/crystala/pick_selected_large.webp',
  MAGNET:'/assets/gold-ui/heroes/magnet/pick_selected_large.webp',
  ICE:'/assets/gold-ui/heroes/frost/pick_selected_large.webp',
  MIRROR:'/assets/gold-ui/heroes/mirror/pick_roster_cover.webp',
  BOXE:'/assets/dictionary/heroes/boxe/standing.png',
  SHURI:'/assets/dictionary/heroes/shuri/standing.webp',
});
function safeSnapshot(displayHero) {
  const meta=window.APEX_ARSENAL_META;
  const player=window.APEX_PLAYER_ACCOUNT;
  const surface=window.APEX_PRODUCT_SURFACE;
  const profile=player?.profile?.() || null;
  const state=meta?.getState?.() || null;
  const mastery=meta?.getMastery?.() || {earned:{},best:{},recent:[]};
  const owned=new Set(state?.ownedFighters || []);
  const roster=surface?.roster?.playableIds || [];
  const progress=state?.progression || {};
  const catalog=meta?.progressionCatalog?.() || [];
  const lang=window.APEX_I18N?.getLanguage?.() === 'vie' ? 'vie' : 'eng';
  const fighters=roster.map((id)=>{
    const [defaultName,element,color,art]=HERO_META[id] || [id,'FIGHTER','#ffc43d','newbot'];
    const elementEnglish={CƠ_KHÍ:'MECHANICAL',HUNTER:'HUNT',CRYSTAL:'CRYSTAL',MAGNET:'MAGNETISM',ICE:'ICE',MIRROR:'REFLECTION',BOXE:'MELEE',SHURI:'TECHNIQUE'}[id] || ({'CƠ KHÍ':'MECHANICAL','SĂN ĐUỔI':'HUNT','PHA LÊ':'CRYSTAL','TỪ TRƯỜNG':'MAGNETISM','BĂNG GIÁ':'ICE','PHẢN CHIẾU':'REFLECTION','CẬN CHIẾN':'MELEE','THỦ PHÁP':'TECHNIQUE'}[element] || element);
    const resultId=RESULT_IDS[id] || id;
    const earned=mastery.earned?.[resultId] || {};
    const applicable=MASTERY_HEROES.some(h=>h.engineId===id)?applicableAchievements(resultId):[];
    const count=applicable.filter(a=>Object.hasOwn(earned,a.id)).length;
    const skins=[];
    if(id==='ROBOT' && meta?.skinProgress?.('hero','ROBOT','ecobot')?.entitled)skins.push('ECOBOT — RECYCLE CORE V17');
    // The live Gold Fighter Pick roster owns the hero's approved portraits.
    // Do not use prototype fighters or a made-up SHURI placeholder.
    const ownerArt=window.APEX_GOLD_ROSTER?.[String(id).toLowerCase()] || null;
    const src=ownerArt?.art || ownerArt?.portrait || APPROVED_PORTRAITS[id] ||
      '/gold/assets/gold/favicon-apex-chaos.png';
    // The itch-only copy rewrites Gold classic-script art paths to ../assets/
    // because those scripts run under the Gold base. This React bridge runs
    // under the entry directory instead; normalize those approved app assets
    // BEFORE apexAppUrl or /html/apex/ would incorrectly escape to /html/assets/.
    const appArt=String(src).replace(/^(?:\\.\\.\\/)+(assets|gold)\\//, '/$1/');
    const img=/^(https?:|data:|blob:)/i.test(appArt)?appArt:apexAppUrl(appArt);
    return {id,name:meta?.displayNameFor?.(id)||defaultName,element:lang==='vie'?element:elementEnglish,
      epithet: owned.has(id)?(lang==='vie'?'ĐÃ SỞ HỮU':'OWNED'):(lang==='vie'?'CHƯA SỞ HỮU':'NOT OWNED'),color,
      img,
      pos:'50% 50%',owned:owned.has(id),resultId,
      rank:count,xp:count,xpNext:applicable.length,matches:0,wins:0,skins};
  });
  const claimed=Array.isArray(progress.claimedIds)?progress.claimedIds:[];
  const missions=catalog.map((d,i)=>({id:d.id,title:lang==='vie'?d.vie:d.eng,
    flavor:`${lang==='vie'?'HỢP ĐỒNG':'CONTRACT'} ${String(i+1).padStart(2,'0')}`,
    hint:lang==='vie'?d.vie:d.eng,
    mode:/local/i.test(d.stat||'')?'LOCAL':'BOT',
    metric:d.stat,target:d.target,reward:d.ac,
    glyph:/win/i.test(d.stat||'')?'blade':/local/i.test(d.stat||'')?'swords':'robot'}));
  const achievements=MASTERY_HEROES.flatMap((h)=>{
    const earned=mastery.earned?.[h.resultId] || {};
    const best=mastery.best?.[h.resultId] || {};
    return applicableAchievements(h.resultId).map((a)=>{
      const done=Object.hasOwn(earned,a.id);
      const stat=primaryProgress(a,best[a.id],done);
      const threshold=Number(stat.target)||1;
      const current=Number.isFinite(Number(stat.current))?Math.max(0,Number(stat.current)):0;
      return {id:`${h.resultId}:${a.id}`,name:`${translateCopy(a.name,lang)} · ${h.name}`,
        desc:a.rule?.[lang] || (lang==='vie' ? a.rule?.vie : 'Complete this combat feat to earn the medal.') || '',tier:a.rarity,glyph:ICONS[a.category] || 'star',
        earned:done,p:done?threshold:current,t:threshold};
    });
  });
  let avatar=displayHero.current;
  if(!roster.includes(avatar)||!owned.has(avatar))avatar=roster.find(id=>owned.has(id)) || roster[0] || 'ROBOT';
  displayHero.current=avatar;
  let persisted=true;
  try {const key='apexGoldSaveProbe';localStorage.setItem(key,'1');localStorage.removeItem(key);}catch{persisted=false;}
  return {
    state:{name:profile?.displayName||'GUEST',avatar,ac:state?.credits ?? 0,
      botPlayed:Number(progress.botMatches)||0,botWon:Number(progress.botWins)||0,
      localPlayed:Number(progress.localMatches)||0,claimed,lucky:state?.totalSpins||0,
      playerId:String(profile?.profileId||'—'),savedAt:Number(profile?.createdAt)||0,
      ...Object.fromEntries(catalog.map(d=>[d.stat, Number(progress[d.stat])||0]))},
    fighters,missions,achievements,persisted,language:lang,
  };
}
export default function GoldMissionAccountHost() {
  const [view,setView]=useState(null); // 'account' or 'mission' / 'mastery'
  const invoker=useRef(null);
  const frame=useRef(null);
  const displayHero=useRef('ROBOT');
  const open=useCallback((screen,element)=>{
    invoker.current=element || document.activeElement;
    setView(screen);
  },[]);
  const close=useCallback(()=>{
    setView(null);
    requestAnimationFrame(()=>{if(invoker.current?.isConnected)invoker.current.focus?.({preventScroll:true});invoker.current=null;});
  },[]);
  const refresh=useCallback(()=>{
    try {frame.current?.contentWindow?.postMessage({type:'APEX_GOLD_UPDATE'},location.origin);}catch{}
  },[]);
  // Keyboard can still be focused on the invoking game nav after opening the
  // Gold iframe. Escape must close from BOTH focus contexts (Gold handles
  // iframe-focused Escape itself), never leave a trapped overlay.
  useEffect(()=>{
    if(view===null)return;
    const onEscape=e=>{
      if(e.key!=='Escape')return;
      e.preventDefault();e.stopPropagation();close();
    };
    window.addEventListener('keydown',onEscape,true);
    return()=>window.removeEventListener('keydown',onEscape,true);
  },[view,close]);
  useEffect(()=>{
    const api=Object.freeze({
      snapshot:()=>safeSnapshot(displayHero),
      claim:(ids)=>{
        const meta=window.APEX_ARSENAL_META;
        let amount=0;
        for(const id of new Set(Array.isArray(ids) ? ids : [])){
          const contract=meta?.progressionCatalog?.().find(d=>d.id===id);
          const real=meta?.getState?.();
          if(!contract || real?.progression?.claimedIds?.includes(id) ||
             (Number(real?.progression?.[contract.stat])||0)<contract.target)continue;
          const response=meta?.claimProgressReward?.(id);
          if(response?.ok)amount+=contract.ac;
        }
        refresh();return amount;
      },
      setDisplayName:(name)=>{window.APEX_PLAYER_ACCOUNT?.setDisplayName?.(String(name||'').trim().slice(0,24));refresh();},
      setAvatar:(id)=>{
        const state=window.APEX_ARSENAL_META?.getState?.();
        if(state?.ownedFighters?.includes(id)){displayHero.current=id;refresh();}
      },
      close,
    });
    // Deliberately not an authorization seam; only real game authorities can
    // process claim or mutate a profile. Do not expose cloud role methods.
    window.__APEX_GOLD_BRIDGE__=api;
    window.APEX_ACCOUNT_CENTER=Object.freeze({open:()=>open('account',null),close,isOpen:()=>view!==null});
    window.APEX_PROGRESSION_CENTER=Object.freeze({open:(tab)=>open(tab==='achievement'||tab==='mastery'?'mastery':'mission',null),close,isOpen:()=>view!==null});
    const onAccount=e=>{const t=e.target?.closest?.('#apexAccountOpen');if(t){e.preventDefault();e.stopPropagation();open('account',t);}};
    const onMissions=e=>{const t=e.target?.closest?.('#apexMissionsOpen');if(t){e.preventDefault();e.stopPropagation();open('mission',t);}};
    const onOpenAccount=()=>open('account',null);
    const onOpenProgress=e=>open(e?.detail?.tab==='achievement'||e?.detail?.tab==='mastery'?'mastery':'mission',null);
    document.addEventListener('click',onAccount,true);document.addEventListener('click',onMissions,true);
    window.addEventListener('apex:open-account',onOpenAccount);
    window.addEventListener('apex:progress-open',onOpenProgress);
    const events=['apex:credits','apex:account','apex:mastery-unlocked','apex:skin-unlocked','apex:language-changed'];
    events.forEach(event=>window.addEventListener(event,refresh));
    const stopCosmetics=cosmetics.subscribe(refresh);
    return()=>{
      document.removeEventListener('click',onAccount,true);document.removeEventListener('click',onMissions,true);
      window.removeEventListener('apex:open-account',onOpenAccount);
      window.removeEventListener('apex:progress-open',onOpenProgress);
      events.forEach(event=>window.removeEventListener(event,refresh));stopCosmetics();
      if(window.__APEX_GOLD_BRIDGE__===api)delete window.__APEX_GOLD_BRIDGE__;
      delete window.APEX_ACCOUNT_CENTER;delete window.APEX_PROGRESSION_CENTER;
    };
  },[open,close,view,refresh]);
  if(view===null)return null;
  const href=apexAppUrl(`/gold/mission-account.html?screen=${view==='account'?'account':'missions'}&tab=${view==='mastery'?'mastery':'ops'}`);
  return <div className="apex-gold-direct-host" role="dialog" aria-modal="true" aria-label="Gold Missions Account"
    style={{position:'fixed',inset:0,zIndex:2147480900,background:'#07050a'}}>
    <iframe key={view} ref={frame} title="APEX CHAOS GOLD — MISSIONS / ACCOUNT" src={href}
      style={{width:'100%',height:'100%',border:0}} onLoad={refresh}/>
  </div>;
}
