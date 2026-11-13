/**
 * Offline, deterministic 60-fps APEX CHAOS marketing capture.
 * Frames are taken from the actual R5 browser game, never recreated artwork.
 * Browser render throughput does not affect output frame pacing.
 * Captures a genuine 9:16 viewport; visual/sfx remain game assets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('./probe/node_modules/puppeteer-core');
const out = path.resolve('reports/promo-offline-r5');
const frameDir = path.join(out,'frames');
fs.mkdirSync(frameDir,{recursive:true});
const FPS=60, TOTAL=420;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
    '--autoplay-policy=no-user-gesture-required','--hide-scrollbars'],
  defaultViewport:{width:432,height:768,deviceScaleFactor:2.5,isMobile:false,hasTouch:true},
});
const errors=[], casts=[];
const page=await browser.newPage();
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::ERR_'))errors.push('[console] '+m.text());});
try {
  await page.goto(process.env.APEX_APP_URL||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>typeof window.__apexEnsureDeferredRuntimes==='function',{timeout:120000});
  await page.evaluate(async()=>{
    await window.__apexEnsureDeferredRuntimes('arsenalProduct');
    window.__APEX_TEST_MODE=true;
  });
  const setup=await page.evaluate(()=>{
    const G=window;
    if(G.APEX_ARSENAL?.state?.active)G.exitArsenalBattleMode();
    G.startArsenalBattleMode('CRYSTAL','FROST',{testFixture:true});
    if(typeof reqId!=='undefined'&&reqId){cancelAnimationFrame(reqId);reqId=0;}
    if(G.APEX_HERO_REWORK?.setAiEnabled)G.APEX_HERO_REWORK.setAiEnabled(false);
    const c=G.fighters[0],f=G.fighters[1];
    for(const fighter of G.fighters){
      fighter.baseSpeed=0;
      fighter.maxHp=Math.max(fighter.maxHp||0,30000);
      fighter.hp=Math.max(fighter.hp||0,30000);
    }
    c.x=310;c.y=500;c.setDir(1,0);
    f.x=640;f.y=500;f.setDir(-1,0);
    if(G.APEX_ARSENAL?.state){G.APEX_ARSENAL.state.labMode=true;
      G.APEX_ARSENAL.state.slots=[];G.APEX_ARSENAL.state.spawnHeld=true;
      G.APEX_ARSENAL.state.spawnTimer=1e6;}
    const hidden = ['menu-screen','loading-screen'];
    for(const id of hidden){const el=document.getElementById(id);if(el){el.style.display='none';el.style.opacity='0';}}
    G.__PROMO={casts:[],sawPrison:false,step(frame){
      // Every frame advances exactly 1/60 s of *production* gameplay.
      const cast=(fighter,slot)=> {
        const r=G.APEX_HERO_REWORK.pressAbility(fighter,slot);
        this.casts.push({frame,side:fighter===c?'CRYSTAL':'FROST',slot,ok:!!r?.ok,reason:r?.reason||null});
      };
      if(frame===28)cast(c,'A2');           // K: Awakening
      if(frame===46)cast(c,'A1');           // J: real HEXA
      if(frame===205)cast(f,'A1');          // Opponent uses real ability
      if(frame===260)cast(f,'A2');
      // Mild authored positioning for camera readability; abilities use real engine.
      G.APEX_ARSENAL.step(1/60);
      if(G.APEX_COMBAT_HUD?.sync)G.APEX_COMBAT_HUD.sync();
      G.draw();
      const st=G.APEX_CRYSTAL.stateOf(G.APEX_HERO_REWORK.byCombatant(c));
      if((st?.rig?.constructs||[]).some(x=>x.kind==='prison'))this.sawPrison=true;
    },inspect(){
      const ct=G.APEX_HERO_REWORK.byCombatant(c);
      const state=G.APEX_CRYSTAL.stateOf(ct);
      return {casts:this.casts,prisonConstructed:this.sawPrison || (state?.rig?.constructs||[]).some(x=>x.kind==='prison'),
        active:!!G.APEX_ARSENAL?.state?.active,
        canvas:{width:document.querySelector('#game-canvas')?.width,height:document.querySelector('#game-canvas')?.height},
        viewport:{width:innerWidth,height:innerHeight,devicePixelRatio:devicePixelRatio},
        figureIds:G.fighters.map(x=>x.heroId||x.id)};
    }};
    G.__PROMO.step(-1);
    return G.__PROMO.inspect();
  });
  console.log('[PROMO] setup',JSON.stringify(setup));
  const inspect=await page.evaluate(()=>window.__PROMO.inspect());
  if(!inspect.active)throw new Error('Gameplay did not enter battle mode');
  for(let i=0;i<TOTAL;i++){
    await page.evaluate(frame=>window.__PROMO.step(frame),i);
    const dst=path.join(frameDir,String(i).padStart(5,'0')+'.jpg');
    await page.screenshot({path:dst,type:'jpeg',quality:94,captureBeyondViewport:false});
    if(i%60===0)console.log('[PROMO] captured',i,'/',TOTAL);
  }
  const result=await page.evaluate(()=>window.__PROMO.inspect());
  fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify({source:'R5 owner baseline 485a75637e985415',fps:FPS,
    frames:TOTAL,duration:TOTAL/FPS,capture:'actual game; deterministic fixed 1/60-step per output frame',
    resolution:'1080x1920',result,errors},null,2));
  if(!result.casts.some(x=>x.side==='CRYSTAL'&&x.slot==='A2'&&x.ok))throw new Error('Awakening not cast');
  if(!result.casts.some(x=>x.side==='CRYSTAL'&&x.slot==='A1'&&x.ok))throw new Error('HEXA not cast');
  if(!result.prisonConstructed)throw new Error('HEXA Prison missing');
  if(errors.length)throw new Error('Browser errors: '+errors.slice(0,5).join(' | '));
  const ffmpeg=require('@ffmpeg-installer/ffmpeg').path;
  const silent=path.join(out,'APEX-CHAOS-CRYSTALA-HEXA-60FPS-RAW.mp4');
  execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-framerate',String(FPS),
    '-i',path.join(frameDir,'%05d.jpg'),'-c:v','libx264','-preset','medium','-crf','17',
    '-pix_fmt','yuv420p','-movflags','+faststart',silent],{stdio:'inherit',timeout:480000});
  // Optional promotional audio is sourced from the shipped game's own theme.
  // It is *not* represented as direct gameplay SFX / microphone audio.
  const theme=path.resolve('dist/assets/audio/forward_drive_theme.ogg');
  if(fs.existsSync(theme)){
    execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',silent,
      '-stream_loop','-1','-i',theme,'-filter_complex','[1:a]volume=0.22,afade=t=in:st=0:d=0.35,afade=t=out:st=6.35:d=0.65[a]',
      '-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','192k',
      '-t','7','-movflags','+faststart',path.join(out,'APEX-CHAOS-CRYSTALA-HEXA-60FPS-PROMO.mp4')],
      {stdio:'inherit',timeout:180000});
  }
  fs.rmSync(frameDir,{recursive:true,force:true});
  console.log('[PROMO] SUCCESS',JSON.stringify({casts:result.casts,prison:result.prisonConstructed,output:fs.readdirSync(out)}));
}finally{await browser.close();}
