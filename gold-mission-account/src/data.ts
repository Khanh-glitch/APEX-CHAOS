// INTERNAL DATA ADAPTER ONLY. Gold UI primitives, layout, motion, and art remain
// their original source. No prototype fake fighter or achievement survives.
import arena from './assets/arena.jpg';
export {arena};
export type FighterId = string;
export type Tier = 'common' | 'rare' | 'epic' | 'legendary';
export type Metric = string;
export interface Fighter {
  id: FighterId; name: string; epithet: string; element: string;
  color: string; img: string; pos: string; rank: number; xp: number;
  xpNext: number; matches: number; wins: number; skins: string[];
  owned: boolean; resultId?: string;
}
export interface Mission {
  id:string; title:string; flavor:string;hint:string;mode:'BOT'|'LOCAL';
  metric:Metric;target:number;reward:number;glyph:string;
}
export interface Achievement {
  id:string; name:string;desc:string;tier:Tier;glyph:string;p:number;t:number;
  earned:boolean; skin?:{fighter:FighterId;name:string};
}
export const FIGHTERS: Fighter[] = [];
export const MISSIONS: Mission[] = [];
export const ACHIEVEMENTS: Achievement[] = [];
export const MILESTONE_RANKS: number[] = [];
export const SKIN_FILTERS: string[] = [];
export const TIERS: {id:Tier;label:string;color:string}[] = [
  {id:'common',label:'Thường',color:'#bcc7cd'},
  {id:'rare',label:'Hiếm',color:'#48c2eb'},
  {id:'epic',label:'Sử thi',color:'#da6afd'},
  {id:'legendary',label:'Huyền thoại',color:'#ffc43d'},
];
export const fighterById=(id:FighterId): Fighter => FIGHTERS.find(f=>f.id===id) || FIGHTERS[0];
export const isDone=(a:Achievement) => a.earned === true;
export function updateCanonicalData(payload:{fighters:Fighter[];missions:Mission[];achievements:Achievement[]}) {
  FIGHTERS.splice(0,FIGHTERS.length,...(payload.fighters || []));
  MISSIONS.splice(0,MISSIONS.length,...(payload.missions || []));
  ACHIEVEMENTS.splice(0,ACHIEVEMENTS.length,...(payload.achievements || []));
}
