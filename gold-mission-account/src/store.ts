import { useCallback, useEffect, useRef, useState } from 'react';
import { MISSIONS, updateCanonicalData, type FighterId, type Mission } from './data';
import type { Language } from './locale';

// The original prototype localStorage demo wallet has been completely removed.
// The host bridge is the *only* route to canonical game data and actions.
export interface GameState {
  name:string;avatar:FighterId;ac:number;botPlayed:number;botWon:number;
  localPlayed:number;claimed:string[];lucky:number;playerId:string;savedAt:number;
}
interface GoldSnapshot {
  state:GameState;
  fighters: import('./data').Fighter[];
  missions: Mission[];
  achievements: import('./data').Achievement[];
  persisted:boolean;
  language?:Language;
}
interface GoldBridge {
  snapshot():GoldSnapshot;
  claim(ids:string[]):number;
  setDisplayName(v:string):void;
  setAvatar(v:string):void;
  close():void;
}
function bridge():GoldBridge | null {
  try { return window.parent !== window ? (window.parent as typeof window & {__APEX_GOLD_BRIDGE__?:GoldBridge}).__APEX_GOLD_BRIDGE__ || null : null; }
  catch {return null;}
}
function read():GoldSnapshot|null {
  try {const value=bridge()?.snapshot() || null; if(value) updateCanonicalData(value); return value;}
  catch {return null;}
}
export type MissionStatus='active'|'ready'|'claimed';
export function missionProgress(s:GameState,m:Mission) {return Math.min(Math.max(0,Number((s as unknown as Record<string,unknown>)[m.metric])||0),m.target);}
export function missionStatus(s:GameState,m:Mission):MissionStatus {
  if(s.claimed.includes(m.id))return 'claimed';
  return missionProgress(s,m)>=m.target?'ready':'active';
}
export function useGame() {
  const initial=useRef(read());
  const [s,setS]=useState<GameState|null>(initial.current?.state || null);
  const [persisted,setPersisted]=useState(initial.current?.persisted || false);
  const [lang,setLang]=useState<Language>(initial.current?.language === "vie" || new URLSearchParams(location.search).get("lang") === "vie" ? "vie" : "eng");
  const refresh=useCallback(()=>{const next=read();if(next){setS(next.state);setPersisted(next.persisted);setLang(next.language === "vie" ? "vie" : "eng");}},[]);
  useEffect(()=>{
    const onMessage=(e:MessageEvent)=>{if(e.source!==window.parent || e.origin!==location.origin)return;
      if(e.data?.type==='APEX_GOLD_UPDATE')refresh();
      if(e.data?.type==='APEX_GOLD_CLOSE')bridge()?.close();
    };
    window.addEventListener('message',onMessage);
    refresh();
    return()=>window.removeEventListener('message',onMessage);
  },[refresh]);
  const patch=useCallback((value:Partial<GameState>|((x:GameState)=>Partial<GameState>))=>{
    if(!s)return;
    const next=typeof value==='function'?value(s):value;
    // Whitelist UI account fields only; AC, statistics and claimed data are read-only.
    if(typeof next.name==='string' && next.name!==s.name)bridge()?.setDisplayName(next.name);
    if(typeof next.avatar==='string' && next.avatar!==s.avatar)bridge()?.setAvatar(next.avatar);
    refresh();
  },[s,refresh]);
  const claim=useCallback((ids:string[])=>{const amount=bridge()?.claim(ids) || 0; refresh();return amount;},[refresh]);
  return {s:s as GameState,ready:!!s,patch,claim,refresh,syncing:false,persisted,lang,
    playBot:()=>{},playLocal:()=>{},reset:()=>{},saveNow:()=>refresh()};
}
export type Game=ReturnType<typeof useGame>;
