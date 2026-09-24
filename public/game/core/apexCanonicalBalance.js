// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function FINAL_CANONICAL_IDENTITY_BALANCE_MERGE(){
  try {
  window.apexInsideFinalPatch = true;
  const FT = name => FighterTypes.find(f => f.name === name);
  const fmt = n => Number.isFinite(n) ? n.toFixed(1) : '0.0';
  const topSource = f => {
    const rows = Object.entries(f?.damageLabels || {}).sort((a,b)=>b[1]-a[1]);
    return rows[0] ? `${rows[0][0]} ${fmt(rows[0][1])}` : 'none';
  };

  // Canonical roster normalization: the original mechanics remain, but public names are final.
  const monk = FT('MONK');
  if (monk) monk.name = 'KUNGFU';
  const wind = FT('WIND');
  if (wind) wind.name = 'PUPPET';
  if (SOUND_ID.MONK && !SOUND_ID.KUNGFU) SOUND_ID.KUNGFU = SOUND_ID.MONK;
  if (SOUND_ID.WIND && !SOUND_ID.PUPPET) SOUND_ID.PUPPET = { base:265, wave:'triangle', bend:.7, noise:.04 };
  const glyphOld = fighterGlyph;
  fighterGlyph = function(name){
    if(name === 'KUNGFU') return 'Ă¥Â°ÂĂ¦Â­Â¦';
    if(name === 'PUPPET') return 'PUP';
    return glyphOld(name);
  };
  const menuCopy = document.querySelector('#menu-screen p');
  if (menuCopy) menuCopy.textContent = '32 Fighters. Canonical Identity + Balance Merge. Arena 1000x1000.';

  // Public, non-hidden numeric tuning learned from the balanced project. These are speed/cooldown/lifetime nudges only;
  // damage remains tagged by the original skill source names.
  const tuningNotes = {
    TOXIC:'poison tempo softened; charge/heal remains visible',
    BLACK_HOLE:'gravity output normalized after stale-well cleanup',
    PAINTER:'guard cannot create near-immortality',
    SLIME:'body cap is visible and defensive layers are finite',
    PUPPET:'effigy FIFO and final card preserved',
    KUNGFU:'showcase buff kept through combo timing, not anonymous damage',
    PIRATE:'anchor/loot fantasy preserved with longer loot lifetime'
  };
  window.APEX_CANONICAL_MERGE_NOTES = tuningNotes;

  const CANONICAL_NUMERIC_TUNING = {
    RUBBER:{out:.95,taken:1.08,cd:.96,speed:1.00},
    ICE:{out:1.06,taken:.98,cd:1.04},
    SLIME:{out:.94,taken:1.14,cd:.96,speed:.98},
    PUPPET:{out:.92,taken:1.15,cd:.94,speed:.98},
    SUPERSTAR:{out:.86,taken:1.14,cd:.88},
    HUNTER:{out:1.08,taken:.96,cd:1.06,speed:1.03},
    KUNGFU:{out:1.15,taken:.90,cd:1.15,speed:1.06},
    PIRATE:{out:1.15,taken:.85,cd:1.15,speed:1.06},
    MAGNET:{out:1.15,taken:.92,cd:1.12,speed:1.03},
    TIME:{out:1.08,taken:.96,cd:1.06},
    MIRROR:{out:1.06,taken:.98,cd:1.04},
    CRYSTAL:{out:1.06,taken:.98,cd:1.04},
    BLADE:{out:.90,taken:1.10,cd:.94},
    PAINTER:{out:1.08,taken:.96,cd:1.06,speed:1.03},
    WITCH:{out:1.15,taken:.88,cd:1.12,speed:1.05},
    VAMPIRE:{out:1.06,taken:.97,cd:1.04,speed:1.02},
    NOVA:{out:1.15,taken:.92,cd:1.12},
    ELECTRIC:{out:1.08,taken:.96,cd:1.06},
    FLASH:{out:1.06,taken:.98,cd:1.04},
    SAW:{out:1.06,taken:.98,cd:1.04},
    DRUM:{out:1.06,taken:.98,cd:1.04},
    WOLF:{out:1.08,taken:.96,cd:1.06},
    CARD:{out:.92,taken:1.08,cd:.94},
    BLACK_HOLE:{out:1.04,taken:1.00,cd:1.02},
    MATH:{out:.96,taken:1.05,cd:.98},
    STRING:{out:1.06,taken:.98,cd:1.04},
    VOLCANO:{out:1.06,taken:.98,cd:1.04},
    SNIPER:{out:1.08,taken:.96,cd:1.06},
    ORBIT:{out:1.06,taken:.98,cd:1.04},
    VIRUS:{out:1.06,taken:.98,cd:1.04},
    MATH_V2:{out:1.00,taken:1.02,cd:1.00},
    TOXIC:{out:.92,taken:1.08,cd:.94}
  };
  window.APEX_VISIBLE_BALANCE_TUNING = CANONICAL_NUMERIC_TUNING;
  for (const ft of FighterTypes) {
    const t = CANONICAL_NUMERIC_TUNING[ft.name];
    if (t && t.speed && !ft.__speedTuned) { ft.speed = Math.max(260, ft.speed * t.speed); ft.__speedTuned = true; }
  }
  const abilityDtCanonical = abilityDt;
  abilityDt = function(f, dt){
    const t = CANONICAL_NUMERIC_TUNING[f?.name];
    return abilityDtCanonical(f, dt) * (t?.cd || 1);
  };
  const takeDamageCanonicalBalance = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
    let tuned = amount;
    const st = CANONICAL_NUMERIC_TUNING[source?.name];
    const tt = CANONICAL_NUMERIC_TUNING[this?.name];
    if (source && source !== this && st?.out) tuned *= st.out;
    if (source && source !== this && tt?.taken) tuned *= tt.taken;
    return takeDamageCanonicalBalance.call(this, tuned, source, label, statusDamage);
  };

  // Enforce visible Rage text only while active, and add readable per-fighter counters required for spectators.
  const oldDrawFighterFinal = Fighter.prototype.draw;
  Fighter.prototype.draw = function(ctx){
    oldDrawFighterFinal.call(this, ctx);
    if (window.apexNoArenaTelemetryText !== false) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 12px monospace';
    const y0 = -this.radius - 42;
    const lines = [];
    if (this.isRage) lines.push(['RAGE ACTIVE', '#ffe66d']);
    const bt = CANONICAL_NUMERIC_TUNING[this.name];
    if (bt && (Math.abs((bt.out||1)-1)>.01 || Math.abs((bt.taken||1)-1)>.01 || Math.abs((bt.cd||1)-1)>.01)) lines.push([`Fine Tune O${(bt.out||1).toFixed(2)} D${(bt.taken||1).toFixed(2)} C${(bt.cd||1).toFixed(2)}`, '#d0c6ad']);
    if (this.name === 'ELECTRIC') lines.push([`CHARGE ${this.data.wallHits||0}${this.isRage?`+${this.data.rageContactCharge||0}`:''}`, '#bde5ff']);
    if (this.name === 'TOXIC' && this.data.toxicCharge) lines.push([`TOXIC CHARGE ${fmt(this.data.toxicCharge.amount||0)}`, '#caff58']);
    if (this.name === 'BLACK_HOLE') {
      const well = projectiles.find(p=>p.type==='gravity_well'&&p.owner===this&&p.life>0);
      if (well) lines.push([`ABSORB ${fmt(well.absorbedDamage||0)}`, '#b48cff']);
    }
    if (this.name === 'PUPPET') lines.push([`PUPPETS ${projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===this&&p.hp>0&&p.life>0).length}`, '#d7b27a']);
    if (this.name === 'SLIME') {
      const bodies = fighters.filter(f=>f&&f.name==='SLIME'&&(f.teamId??f.id)===(this.teamId??this.id)&&f.hp>0).length;
      const kids = projectiles.filter(p=>p.type==='slime_child'&&p.owner===this&&p.hp>0&&p.life>0).length;
      lines.push([`BODY ${bodies} CHILD ${kids}`, '#caffbb']);
    }
    if (this.name === 'SUPERSTAR') lines.push([`FANS ${projectiles.filter(p=>p.type==='superfan'&&p.owner===this&&p.hp>0&&p.life>0).length}`, '#ff9ee2']);
    if (this.name === 'VAMPIRE' && (this.data.bloodLinkLevel||0)>0) lines.push([`BLOOD LINK ${this.data.bloodLinkLevel}`, '#ff4a62']);
    if (this.name === 'MATH' && this.data?.expr) lines.push([String(this.data.expr).slice(0,22), '#f4efe3']);
    if (this.name === 'SNIPER') lines.push([this.data.hiddenReload?'HIDDEN RELOAD':(this.data.aim>0?`AIM ${fmt(this.data.aim)}`:'NEST READY'), '#d7dde5']);
    if (this.name === 'TIME' && this.data.mark) lines.push([`MARK ${fmt(this.data.mark.timer)}`, '#d6d0ff']);
    if (this.name === 'KUNGFU') { const kEnemy = fighters.find(q => q && q !== this && q.hp > 0 && ((q.teamId ?? q.id) !== (this.teamId ?? this.id))) || fighters.find(q => q && q !== this); lines.push([`COMBO ${this.data.combo||0} TRAUMA ${kEnemy?.statuses?.innerTrauma?.stacks||0}`, '#ffd28a']); }
    for(let i=0;i<Math.min(3,lines.length);i++){
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(-82, y0 - i*18 - 14, 164, 16);
      ctx.fillStyle = lines[i][1];
      ctx.fillText(lines[i][0], 0, y0 - i*18);
    }
    ctx.restore();
  };

  // Tournament result enrichment and award summary. Bracket reveal logic stays canonical: future opponents remain hidden until advanced.
  const oldCompleteTournamentMatchFinal = completeTournamentMatch;
  completeTournamentMatch = function(winner, loser){
    const match = tournamentFindMatch(activeTournamentMatchId);
    if(!match) return oldCompleteTournamentMatchFinal(winner, loser);
    const duration = Math.max(.1, matchClock || ((performance.now()-matchStartTime)/1000));
    const all = fighters.filter(Boolean);
    const biggestOwner = all.slice().sort((a,b)=>(b.maxHit||0)-(a.maxHit||0))[0] || winner;
    const result = {
      duration,
      winnerHp:winner.hp, loserHp:loser.hp,
      winnerDamage:winner.damageDone||0, loserDamage:loser.damageDone||0,
      winnerStandard:winner.standardDamageDone||0, loserStandard:loser.standardDamageDone||0,
      winnerNormal:winner.normalDamageDone||0, loserNormal:loser.normalDamageDone||0,
      winnerTopStandard:sortedBreakdown(winner.standardDamageLabels||{}),
      loserTopStandard:sortedBreakdown(loser.standardDamageLabels||{}),
      winnerHybridRaw:Object.values(winner.hybridRawLog||{}).reduce((a,b)=>a+b,0),
      loserHybridRaw:Object.values(loser.hybridRawLog||{}).reduce((a,b)=>a+b,0),
      winnerTaken:winner.damageTaken||0, loserTaken:loser.damageTaken||0,
      winnerHealing:winner.healingDone||0, loserHealing:loser.healingDone||0,
      biggest:Math.max(winner.maxHit||0, loser.maxHit||0),
      biggestOwner:biggestOwner.name,
      label:sortedBreakdown(winner.damageLabels||{}),
      winnerTopSource:topSource(winner),
      loserTopSource:topSource(loser),
      control:(winner.dotDamage||0)+(winner.skillsUsed||0)*2,
      summons:projectiles.filter(p=>p.owner===winner&&(p.type||'').match(/slime|puppet|straw|virus|superfan/)).length,
      comeback:Math.max(0, 100-(winner.rageStartHp||winner.hp||100)),
      stylish:(winner.skillsUsed||0)+(winner.maxHit||0)/10+(winner.isRage?10:0)
    };
    tournamentSetWinner(match, winner.name, loser.name, false, tournamentState, result);
    activeTournamentMatchId = null;
  };
  buildTournamentSummary = function(){
    const st=tournamentState; if(!st) return '';
    const log=st.log||[];
    const pick=(fn,empty='-')=>log.length?log.slice().sort(fn)[0]:null;
    const champion=st.champion;
    const dmg=pick((a,b)=>(b.result.winnerDamage||0)-(a.result.winnerDamage||0));
    const hit=pick((a,b)=>(b.result.biggest||0)-(a.result.biggest||0));
    const fast=pick((a,b)=>(a.result.duration||999)-(b.result.duration||999));
    const clutch=pick((a,b)=>(a.result.winnerHp||999)-(b.result.winnerHp||999));
    const heal=pick((a,b)=>(b.result.winnerHealing||0)-(a.result.winnerHealing||0));
    const ctrl=pick((a,b)=>(b.result.control||0)-(a.result.control||0));
    const sum=pick((a,b)=>(b.result.summons||0)-(a.result.summons||0));
    const comeback=pick((a,b)=>(b.result.comeback||0)-(a.result.comeback||0));
    const style=pick((a,b)=>(b.result.stylish||0)-(a.result.stylish||0));
    const survival=pick((a,b)=>(b.result.duration||0)-(a.result.duration||0));
    const std=pick((a,b)=>(b.result.winnerStandard||0)-(a.result.winnerStandard||0));
    const hybrid=pick((a,b)=>(b.result.winnerHybridRaw||0)-(a.result.winnerHybridRaw||0));
    const awards=[
      ['Champion', champion||'-'],
      ['Damage Lord', dmg?`${dmg.winner} ${fmt(dmg.result.winnerDamage)} / ${dmg.result.winnerTopSource}`:'-'],
      ['Standard Damage Lord', std?`${std.winner} ${fmt(std.result.winnerStandard)} / ${std.result.winnerTopStandard||'-'}`:'-'],
      ['Best True-Number Kill', std?`${std.winner} ${fmt(std.result.winnerStandard)} bypass`:'-'],
      ['Best Hybrid Hit', hybrid?`${hybrid.winner} raw ${fmt(hybrid.result.winnerHybridRaw)}`:'-'],
      ['Number Master', hybrid?`${hybrid.winner} STD ${fmt(hybrid.result.winnerStandard)} NORM ${fmt(hybrid.result.winnerNormal)}`:'-'],
      ['Biggest Hit', hit?`${hit.result.biggestOwner||hit.winner} ${fmt(hit.result.biggest)}`:'-'],
      ['Fastest Kill', fast?`${fast.winner} ${fmt(fast.result.duration)}s`:'-'],
      ['Clutch King', clutch?`${clutch.winner} ${fmt(clutch.result.winnerHp)} HP`:'-'],
      ['Healer', heal?`${heal.winner} ${fmt(heal.result.winnerHealing)}`:'-'],
      ['Most Control', ctrl?`${ctrl.winner} ${fmt(ctrl.result.control)}`:'-'],
      ['Most Summons', sum?`${sum.winner} ${sum.result.summons||0}`:'-'],
      ['Most Comeback', comeback?`${comeback.winner} ${fmt(comeback.result.comeback)}`:'-'],
      ['Most Stylish Win', style?`${style.winner} ${fmt(style.result.stylish)}`:'-'],
      ['Longest Survival', survival?`${survival.winner} ${fmt(survival.result.duration)}s`:'-']
    ];
    const cards=awards.map(a=>`<div class="summary-card"><span>${a[0]}</span><b>${a[1]}</b></div>`).join('');
    const banner=champion?`<div class="champion-banner"><h2 style="color:${tournamentFighterStyle(champion)}">${champion} CHAMPION</h2><div>Full 32-fighter canonical bracket complete. Damage/heal sources are preserved in match stats.</div></div>`:'';
    return `${banner}<div class="tournament-summary">${cards}</div>`;
  };

  // Browser QA/stress runner: runs deterministic accelerated matches in-place and reports object caps/runtime errors.
  const qa = { runtimeErrors:0, maxProjectiles:0, maxFighters:0, samples:[] };
  window.addEventListener('error', e => { qa.runtimeErrors++; qa.lastError = e.message; });
  const oldUpdateFinal = update;
  update = function(dt){
    oldUpdateFinal(dt);
    qa.maxProjectiles = Math.max(qa.maxProjectiles, projectiles.length);
    qa.maxFighters = Math.max(qa.maxFighters, fighters.length);
  };
  function runQaMatch(aName,bName,seconds=210){
    const a=fighterTypeByName(aName), b=fighterTypeByName(bName);
    if(!a||!b) return {matchup:`${aName} vs ${bName}`, error:'missing fighter'};
    startSpecificMatch(a,b,{countdown:false,tournament:false});
    let frames=0, maxObj=0;
    while(gameState==='PLAYING' && matchClock<seconds && frames<seconds*30){
      update(1/30);
      maxObj=Math.max(maxObj, projectiles.length+particles.length+fighters.length);
      frames++;
    }
    const alive=fighters.filter(f=>f&&f.hp>0).sort((x,y)=>y.hp-x.hp);
    const winner=alive[0]?.name || 'NONE';
    const res={
      matchup:`${aName} vs ${bName}`,
      winner,
      duration:Number(matchClock.toFixed(2)),
      ko:gameState==='END'||fighters.some(f=>f.hp<=0),
      timeout:matchClock>=seconds,
      maxObjects:maxObj,
      runtimeErrors:qa.runtimeErrors,
      damage:fighters.map(f=>({name:f.name,dealt:fmt(f.damageDone||0),normal:fmt(f.normalDamageDone||0),standard:fmt(f.standardDamageDone||0),taken:fmt(f.damageTaken||0),stdTaken:fmt(f.standardDamageTaken||0),heal:fmt(f.healingDone||0),big:fmt(f.maxHit||0),source:topSource(f),standardSource:sortedBreakdown(f.standardDamageLabels||{})}))
    };
    qa.samples.push(res);
    return res;
  }
  window.apexFinalQA = {
    smoke(){
      const pairs=[['FLASH','TOXIC'],['VAMPIRE','BLADE'],['SLIME','SNIPER'],['PUPPET','ELECTRIC'],['MIRROR','BLACK_HOLE'],['KUNGFU','PIRATE']];
      return pairs.map(p=>runQaMatch(p[0],p[1],210));
    },
    stress(){
      const names=['SLIME','PUPPET','FLASH','SNIPER','MAGNET','VAMPIRE','PAINTER','KUNGFU'];
      const out=[];
      for(let i=0;i<names.length;i++) for(let j=i+1;j<names.length;j++) out.push(runQaMatch(names[i],names[j],240));
      return out;
    },
    roundRobin(limitSeconds=180){
      const names=FighterTypes.map(f=>f.name);
      const table={};
      for(const n of names) table[n]={w:0,l:0,t:0,dur:0};
      for(let i=0;i<names.length;i++) for(let j=0;j<names.length;j++) if(i!==j){
        const r=runQaMatch(names[i],names[j],limitSeconds);
        table[names[i]].dur+=r.duration;
        if(r.winner===names[i]) table[names[i]].w++; else if(r.winner===names[j]) table[names[i]].l++; else table[names[i]].t++;
      }
      return {table, maxProjectiles:qa.maxProjectiles, maxFighters:qa.maxFighters, runtimeErrors:qa.runtimeErrors, samples:qa.samples};
    },
    state:qa
  };

  // Mechanics-first rebalance pass: keep only light public fine tuning; put power back into readable skills.
  const mechFT = name => FighterTypes.find(f => f.name === name);
  const mechNote = (x,y,t,c)=>floatingTexts.push(new FloatingText(x,y,t,c));

  const mechVamp = mechFT('VAMPIRE');
  if (mechVamp) {
    mechVamp.speed = Math.max(mechVamp.speed || 500, 525);
    mechVamp.update = function(f,e,dt){
      if(f.data.latchTimer>0){
        f.data.positionLocked=true;
        f.data.latchTimer-=dt;
        const off=f.data.latchOffset||norm(f.x-e.x,f.y-e.y);
        const gap=e.radius+f.radius+2;
        f.x=clamp(e.x+off.x*gap,f.radius,GAME_SIZE-f.radius);
        f.y=clamp(e.y+off.y*gap,f.radius,GAME_SIZE-f.radius);
        f.setDir(e.x-f.x,e.y-f.y);
        e.applyStatus('slow',0.18,{mult:.38,source:f});
        f.data.latchTick=(f.data.latchTick||0)+dt;
        while(f.data.latchTick>=.5){
          f.data.latchTick-=.5;
          const d=scaledByMirror(f,3);
          e.takeDamage(d,f,'fang-blood-drain');
          f.heal(d,true);
          mechNote(e.x,e.y-e.radius-82,`DRAIN ${d.toFixed(1)}`,'#ff4a62');
        }
        if(f.data.latchTimer<=0) f.data.latchCd=1.75;
      } else {
        f.data.latchCd=Math.max(0,(f.data.latchCd||0)-abilityDt(f,dt));
      }
      if(f.isRage && (f.data.bloodLinkLevel||0)>0){
        f.data.linkTick=(f.data.linkTick||0)+dt;
        while(f.data.linkTick>=.5){
          f.data.linkTick-=.5;
          const d=.8*f.data.bloodLinkLevel;
          e.takeDamage(d,f,'permanent-blood-link',true);
          f.heal(d,true);
          if(f.data.bloodLinkLevel>=4) e.applyStatus('slow',1.5,{mult:.82,source:f});
        }
      }
    };
    mechVamp.onCollide = function(f,e){
      if((f.data.latchCd||0)>0 || f.data.latchTimer>0) return false;
      const toEnemy=norm(e.x-f.x,e.y-f.y);
      const fangDir=norm(f.dir.x||toEnemy.x,f.dir.y||toEnemy.y);
      const front=dot(toEnemy.x,toEnemy.y,fangDir.x,fangDir.y);
      if(front<-.05){mechNote(f.x,f.y-f.radius-62,'BITE MISS','#bb2038'); return false;}
      f.data.latchOffset=norm(f.x-e.x,f.y-e.y);
      f.data.latchTimer=f.type?.arsenalShell?2.5:5.0; /* Arsenal A-CORR-3 ADAPT: 2.5s latch */
      f.data.latchTick=0;
      f.data.latchCd=2.0;
      if(f.isRage){f.data.bloodLinkLevel=(f.data.bloodLinkLevel||0)+1; mechNote(e.x,e.y-e.radius-84,`BLOOD LINK ${f.data.bloodLinkLevel}`,'#ff3040');}
      mechNote(f.x,f.y-f.radius-76,'FANG LOCK','#e43d57');
      playFighterSound(f,'skill');
      return true;
    };
  }

  const mechElectric = mechFT('ELECTRIC');
  if (mechElectric) {
    mechElectric.noRage=false;
    mechElectric.onRage = f => { f.data.ragePulse=5; f.data.rageContactCharge=0; mechNote(f.x,f.y-f.radius-98,'TIMED OVERCHARGE 5s','#bde5ff'); };
    mechElectric.update = function(f,e,dt){
      if(f.isRage){
        f.data.ragePulse=(f.data.ragePulse||5)-dt;
        if(f.data.ragePulse<=0 && e){
          f.data.ragePulse=5;
          const charge=clamp(Math.max(1,(f.data.wallHits||0)+(f.data.rageContactCharge||0)),1,10);
          const raw=.0025*((f.maxHp-f.hp)+12)*Math.pow(2,charge);
          const dmg=raw<=60?raw:60+(raw-60)*.22;
          const nodes=(f.data.wallNodes||[]).slice(-24); if(!nodes.length) nodes.push({x:f.x,y:f.y});
          nodes.forEach(n=>projectiles.push({type:'electric_trail',owner:f,x1:n.x,y1:n.y,x2:e.x,y2:e.y,life:.4,maxLife:.4,charge}));
          spawnShockwave(e.x,e.y,'#75cfff',180+charge*10);
          e.takeDamage(dmg,f,'electric-rage-5s-discharge');
          f.heal(dmg*.5,false);
          mechNote(e.x,e.y-e.radius-102,`CH ${charge} DMG ${dmg.toFixed(1)} HEAL ${(dmg*.5).toFixed(1)}`,'#bde5ff');
          f.data.wallHits=0; f.data.wallNodes=[]; f.data.rageContactCharge=0;
          playFighterSound(f,'skill');
        }
        return;
      }
      f.data.wallHits=f.data.wallHits||0;
      f.data.wallNodes=f.data.wallNodes||[];
    };
    mechElectric.onWallBounce = function(f,wall){
      f.data.wallHits=clamp((f.data.wallHits||0)+1,0,10);
      const pnt={x:f.x,y:f.y}; if(wall==='left')pnt.x=0; if(wall==='right')pnt.x=GAME_SIZE; if(wall==='top')pnt.y=0; if(wall==='bottom')pnt.y=GAME_SIZE;
      f.data.wallNodes.push(pnt);
      projectiles.push({type:'electric_node',owner:f,x:pnt.x,y:pnt.y,radius:18,life:3.2,maxLife:3.2,visualOnly:true});
      mechNote(pnt.x,pnt.y-28,`CHARGE ${f.data.wallHits}`,'#bde5ff');
    };
    mechElectric.onCollide = function(f,e){
      if(f.isRage){ f.data.rageContactCharge=clamp((f.data.rageContactCharge||0)+1,0,10); mechNote(e.x,e.y-e.radius-76,'CONTACT +1 CHARGE','#bde5ff'); return false; }
      const charge=clamp(f.data.wallHits||0,0,10);
      if(charge<=0) return false;
      const raw=.0025*((f.maxHp-f.hp)+12)*Math.pow(2,charge);
      const dmg=raw<=60?raw:60+(raw-60)*.22;
      (f.data.wallNodes||[]).slice(-24).forEach(n=>projectiles.push({type:'electric_trail',owner:f,x1:n.x,y1:n.y,x2:e.x,y2:e.y,life:.35,maxLife:.35,charge}));
      e.takeDamage(dmg,f,'electric-charge-discharge');
      mechNote(e.x,e.y-e.radius-84,`DISCHARGE ${charge} CH`,'#bde5ff');
      f.data.wallHits=0; f.data.wallNodes=[];
      playFighterSound(f,'skill');
      return false;
    };
  }

  const mechKung = mechFT('KUNGFU');
  if (mechKung) {
    mechKung.onCollide=function(f,e){
      if((f.data.hitCd||0)>0) return false;
      f.data.hitCd=.42;
      if(f.data.rushTimer>0){
        if((f.data.rushHitCd||0)<=0){
          if((e.statuses.innerTrauma?.stacks||0)>=30){ e.data.kungfuHidden=(e.data.kungfuHidden||0)+3; mechNote(e.x,e.y-e.radius-105,`QI STORED ${e.data.kungfuHidden}`,'#ff9b50'); }
          else addInnerTrauma(e,2);
          e.takeDamage(3.5,f,'trauma-rush-hit');
          f.data.rushHitCd=.15; projectiles.push({type:'kungfu_qi',owner:f,x:e.x,y:e.y,life:.35,maxLife:.35}); playFighterSound(f,'wall');
        }
        return true;
      }
      f.data.combo=((f.data.combo||0)%5)+1; f.data.comboTimer=5;
      const c=f.data.combo; mechNote(f.x,f.y-f.radius-78,`COMBO ${c}`,'#ffd28a');
      if(c===1){ e.takeDamage(10,f,'kungfu-qi-punch'); projectiles.push({type:'kungfu_qi',owner:f,x:e.x,y:e.y,life:.45,maxLife:.45}); playFighterSound(f,'skill'); }
      else if(c===2){ e.applyStatus('rapidPunch',2.0,{source:f,tick:0}); mechNote(e.x,e.y-e.radius-88,'RAPID FISTS','#ffd28a'); }
      else if(c===3){ e.takeDamage(24,f,'giant-palm'); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.8,{x:n.x,y:n.y,strength:2100}); projectiles.push({type:'kungfu_palm',owner:f,x:f.x,y:f.y,vx:n.x*520,vy:n.y*520,life:1.1,maxLife:1.1}); }
      else if(c===4){ e.takeDamage(9,f,'trauma-rush-start'); e.applyStatus('stun',.55,{source:f}); f.data.rushTimer=f.type?.arsenalShell?2.5:4.2; /* Arsenal A-CORR-3 ADAPT: 2.5s pin */ f.data.rushHitCd=0; mechNote(e.x,e.y-e.radius-100,'TRAUMA RUSH','#ff9b50'); }
      else if(c===5 && f.isRage){ e.applyStatus('stun',.8,{source:f}); projectiles.push({type:'kungfu_rage_seal',owner:f,x:e.x,y:e.y,life:1,maxLife:1}); e.takeDamage(22,f,'dim-mak-qi-seal'); }
      return true;
    };
  }

  const mechSlime = mechFT('SLIME');
  if (mechSlime) {
    mechSlime.update=function(f,e,dt){
      f.data.childSpawnCd=Math.max(0,(f.data.childSpawnCd||0)-dt);
      f.data.cloneCd=Math.max(0,(f.data.cloneCd||0)-dt);
      f.data.slimeDmgWindow=(f.data.slimeDmgWindow||[]).filter(x=>matchClock-x.t<=5);
      const sum=f.data.slimeDmgWindow.reduce((s,x)=>s+x.amount,0);
      const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===f&&p.hp>0&&p.life>0).length;
      if(sum>=4 && f.data.childSpawnCd<=0 && kids<8){ projectiles.push({type:'slime_child',owner:f,angle:Math.random()*TAU,radius:24,hp:8,life:5.5,maxLife:5.5,hitCd:{},blockCd:0,damageDone:0,damage:2.2,spawnTime:matchClock}); f.data.slimeDmgWindow=[]; f.data.childSpawnCd=.9; mechNote(f.x,f.y-f.radius-82,'+SLIME CHILD','#caffbb'); }
    };
  }

  const mechPuppet = mechFT('PUPPET');
  if (mechPuppet) {
    mechPuppet.onWallBounce=function(f,wall){
      f.data.wallHitStamp ||= {};
      if(matchClock-(f.data.wallHitStamp[wall]||-99)<.22) return;
      f.data.wallHitStamp[wall]=matchClock;
      const pos={x:f.x,y:f.y}; if(wall==='left')pos.x=0; if(wall==='right')pos.x=GAME_SIZE; if(wall==='top')pos.y=0; if(wall==='bottom')pos.y=GAME_SIZE;
      projectiles.push({type:'puppet_effigy',owner:f,x:pos.x,y:pos.y,radius:75,hp:7,life:28,maxLife:28,wall,order:matchClock+Math.random()*0.0001});
      mechNote(pos.x,pos.y-85,'EFFIGY 7HP','#d7b27a');
      const list=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===f&&p.wall===wall&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0));
      if(list.length>=5){ list.slice(0,5).forEach(p=>p.life=0); projectiles.push({type:'straw_monster',owner:f,x:pos.x,y:pos.y,radius:55,hp:20,life:18,maxLife:18,tick:0}); mechNote(pos.x,pos.y-105,'STRAW MONSTER 20HP','#d7b27a'); }
    };
  }

  const mechTime = mechFT('TIME');
  if (mechTime) {
    mechTime.update=function(f,e,dt){
      f.data.clockCd=(f.data.clockCd||4)-abilityDt(f,dt);
      if(f.data.clockCd<=0 && e){
        f.data.clockCd=4.0;
        const num=clockDamageValue();
        const dmg=num+2;
        if (window.apexDealHybridNumericDamage) window.apexDealHybridNumericDamage(e,f,dmg,'clock-hour-strike');
        else e.takeDamage(dmg,f,'clock-hour-strike');
        projectiles.push({type:'clock_flash',owner:f,num,life:.9,maxLife:.9});
        mechNote(e.x,e.y-e.radius-80,`CLOCK ${num}+2`,'#efeaff');
      }
      if(f.data.mark){
        const m=f.data.mark;
        m.timer-=dt;
        if(m.timer<=0){
          f.x=m.x; f.y=m.y; f.hp=Math.max(f.hp,m.hp);
          if(m.damageDealt&&e) e.heal(m.damageDealt*.5,false);
          if(f.isRage&&m.damageTaken>0) spawnTimeRift(f,f.x,f.y,m.damageTaken);
          f.data.mark=null; f.data.markCd=7.5;
          mechNote(f.x,f.y-f.radius-90,'REWIND 50% REFUND','#efeaff');
        }
        return;
      }
      f.data.markCd=(f.data.markCd||2.5)-abilityDt(f,dt);
      if(f.data.markCd<=0){
        f.data.mark={x:f.x,y:f.y,hp:f.hp,timer:3,damageDealt:0,damageTaken:0};
        f.data.markCd=99;
        projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3});
        mechNote(f.x,f.y-f.radius-85,'TIME MARK','#efeaff');
        playFighterSound(f,'skill');
      }
    };
  }

  // HYBRID STANDARD DAMAGE: only MATH, CARD, and TIME numeric hits use this helper.
  // The standard part bypasses defensive routing; the normal part still uses takeDamage.
  const normalDamageCounterBase = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
    const beforeTaken = this.damageTaken || 0;
    const beforeSourceDone = source && source !== this ? (source.damageDone || 0) : 0;
    const beforeHp = this.hp;
    const result = normalDamageCounterBase.call(this, amount, source, label, statusDamage);
    const dealt = Math.max(0, beforeHp - this.hp);
    const normalDelta = Math.max(0, (this.damageTaken || 0) - beforeTaken);
    if (normalDelta > 0) this.normalDamageTaken = (this.normalDamageTaken || 0) + normalDelta;
    if (source && source !== this) {
      const sourceDelta = Math.max(0, (source.damageDone || 0) - beforeSourceDone);
      if (sourceDelta > 0) {
        source.normalDamageDone = (source.normalDamageDone || 0) + sourceDelta;
        source.normalDamageLabels ||= {};
        source.normalDamageLabels[label || 'direct'] = (source.normalDamageLabels[label || 'direct'] || 0) + sourceDelta;
      }
    }
    return result;
  };
  Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number'){
    if (this.hp <= 0 || amount <= 0) return 0;
    amount = Math.max(0, Number.isFinite(amount) ? amount : 0);
    if (amount <= 0) return 0;
    const before = this.hp;
    const bypassed = standardBypassHint(this);
    this.hp = Math.max(0, this.hp - amount);
    const dealt = Math.max(0, before - this.hp);
    if (dealt <= 0) return 0;
    this.damageTaken = (this.damageTaken || 0) + dealt;
    this.standardDamageTaken = (this.standardDamageTaken || 0) + dealt;
    if (bypassed) this.standardBypassedDefenseTaken = (this.standardBypassedDefenseTaken || 0) + dealt;
    if (source && source !== this) {
      source.damageDone = (source.damageDone || 0) + dealt;
      source.standardDamageDone = (source.standardDamageDone || 0) + dealt;
      source.standardDamageLabels ||= {};
      source.standardDamageLabels[label] = (source.standardDamageLabels[label] || 0) + dealt;
      source.hitsLanded = (source.hitsLanded || 0) + 1;
      source.maxHit = Math.max(source.maxHit || 0, dealt);
      if (bypassed) source.standardBypassCount = (source.standardBypassCount || 0) + 1;
    }
    floatingTexts.push(new FloatingText(this.x, this.y - this.radius - 34, `-${dealt.toFixed(dealt >= 10 ? 0 : 1)}`, '#ffffff'));
    emitParticles(this.x, this.y, '#ffffff', Math.min(24, 8 + Math.ceil(dealt)), 260, 4, .4, 'square');
    maybeTriggerStandardRageAndDeath(this);
    updateHUD();
    return dealt;
  };
  function standardBypassHint(target){
    if (!target) return false;
    if (target.name === 'MAGNET' && target.data?.fieldTimer > 0) return true;
    if (target.name === 'PUPPET' && projectiles.some(p=>p.type==='puppet_effigy'&&p.owner===target&&p.hp>0&&p.life>0)) return true;
    if (target.name === 'SLIME' && projectiles.some(p=>p.type==='slime_child'&&p.owner===target&&p.hp>0&&p.life>0)) return true;
    if (target.name === 'SUPERSTAR' && projectiles.some(p=>p.type==='superfan'&&p.owner===target&&p.hp>0&&p.life>0)) return true;
    if (target.name === 'BLACK_HOLE' && target.isRage && activeGravityWellFor(target)) return true;
    return target.hasStatus?.('immune') || target.hasStatus?.('painterGuard') || target.name === 'DRUM' && target.data?.rageSolo > 0;
  }
  function maybeTriggerStandardRageAndDeath(target){
    if (shouldTriggerRage(target)) {
      target.isRage = true;
      target.rageStartHp = target.hp;
      playFighterSound(target, 'skill');
      emitParticles(target.x, target.y, target.color, 60, 540, 7, 1.2, 'square');
      spawnShockwave(target.x, target.y, target.color, 190);
      if (target.type.onRage) target.type.onRage(target);
    }
    if (target.hp <= 0 && target.name === 'PUPPET' && target.data && !target.data.finalCardActive) {
      target.hp = 1;
      target.data.finalCardActive = true;
      target.data.cardTimer = 5;
      spawnPuppetFinalCard(target);
      floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 100, 'FINAL CARD', '#f1d8a8'));
      return;
    }
    if (target.hp <= 0 && !target.killSoundPlayed) {
      target.killSoundPlayed = true;
      playFighterSound(target, 'death');
      triggerSlowMoFinish();
    }
  }
  function dealHybridNumericDamage(target, source, rawDamage, label){
    if (!target || !source || rawDamage <= 0) return {standard:0, normal:0, normalFinal:0};
    const raw = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
    const standardPart = Math.min(raw, 30);
    const normalPart = Math.max(0, raw - 30);
    source.hybridRawLog ||= {};
    source.hybridRawLog[label] = (source.hybridRawLog[label] || 0) + raw;
    const standardFinal = standardPart > 0 ? target.takeStandardDamage(standardPart, source, `${label}-standard`) : 0;
    let normalFinal = 0;
    if (normalPart > 0 && target.hp > 0) {
      const hpBefore = target.hp;
      target.takeDamage(normalPart, source, `${label}-normal`, false);
      normalFinal = Math.max(0, hpBefore - target.hp);
      if (normalFinal > 0) floatingTexts.push(new FloatingText(target.x + 18, target.y - target.radius - 72, `-${normalFinal.toFixed(normalFinal >= 10 ? 0 : 1)}`, '#ff5950'));
    }
    source.hybridHits ||= [];
    source.hybridHits.push({label, raw, standard:standardFinal, normalRaw:normalPart, normalFinal});
    return {standard:standardFinal, normal:normalPart, normalFinal};
  }
  window.apexDealHybridNumericDamage = dealHybridNumericDamage;

  const hybridPostMatchBase = buildPostMatchStats;
  buildPostMatchStats = function(winner, loser){
    const base = hybridPostMatchBase(winner, loser);
    const rows = fighters.map(f=>{
      const std = f.standardDamageDone || 0;
      const stdTaken = f.standardDamageTaken || 0;
      const norm = f.normalDamageDone || 0;
      const topStd = sortedBreakdown(f.standardDamageLabels || {}) || 'No standard source';
      const bypass = f.standardBypassCount || 0;
      return `<div class="summary-card"><span>${f.name} HYBRID</span><b>STD ${std.toFixed(1)} / NORM ${norm.toFixed(1)}</b><small>Taken STD ${stdTaken.toFixed(1)} Ă‚Â· ${topStd} Ă‚Â· bypass ${bypass}</small></div>`;
    }).join('');
    return `${base}<div class="tournament-summary">${rows}</div>`;
  };

  // NEXT MECHANICS-FIRST BALANCE PASS:
  // Local skill timing/reliability changes only. No extreme hidden whole-fighter tuning.
  (function nextMechanicsFirstPass(){
    const FT = name => FighterTypes.find(f => f.name === name);
    const note2 = (x,y,t,c)=>floatingTexts.push(new FloatingText(x,y,t,c));
    const clampNum = v => Number.isFinite(v) ? v : 0;

    const volcano = FT('VOLCANO');
    if (volcano) {
      volcano.update = function(f,e,dt){
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
            f.data.cd = 10.9;
          playFighterSound(f,'skill');
          triggerFlash(255,80,0,0.15);
          let delay = 0.25;
          for (let i=0;i<9;i++) {
            delay += rand(0.14,0.44);
            const predictedX = e ? clamp(e.x + e.dir.x * e.baseSpeed * 0.48 + rand(-115,115), 100, 900) : rand(100,900);
            const predictedY = e ? clamp(e.y + e.dir.y * e.baseSpeed * 0.48 + rand(-115,115), 100, 900) : rand(100,900);
            projectiles.push({type:'meteor',owner:f,x:i<5?predictedX:rand(100,900),y:i<5?predictedY:rand(100,900),radius:92,delay,life:delay+0.25,hit:false,volcanoAmp:3});
          }
        }
      };
    }

    const card = FT('CARD');
    if (card) {
      const makeDeckLocal = owner => {
        const suits=['Ă¢â„¢Â ','Ă¢â„¢Â¥','Ă¢â„¢Â¦','Ă¢â„¢Â£'], ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
        const deck=[];
        for(const s of suits) for(const r of ranks) deck.push({rank:r,suit:s});
        if(owner&&owner.isRage) deck.push({rank:'RJ',suit:'Ă¢Ëœâ€¦'},{rank:'BJ',suit:'Ă¢Ëœâ€ '});
        for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]];}
        return deck;
      };
      const rageDamageLocal = (hand,owner,enemy) => {
        let total=0;
        for(const c of hand){
          if(c.rank==='RJ') total += Math.ceil((owner.maxHp-owner.hp)*.5);
          else if(c.rank==='BJ') total += Math.ceil(enemy.hp*.5);
          else if(c.rank==='A') total += 1;
          else if(['10','J','Q','K'].includes(c.rank)) total += 10;
          else total += parseInt(c.rank)||0;
        }
        return Math.min(120,total);
      };
      card.update = function(f,e,dt){
        f.data.resolvePulse = Math.max(0,(f.data.resolvePulse||0)-dt);
        if (f.data.phase === 'show') {
          f.data.showTimer -= dt;
          if (f.data.showTimer <= 0) {
            const hand = f.data.hand.slice();
            let dmg = f.isRage ? rageDamageLocal(hand,f,e) : cardCaoDamage(hand);
            if (hand.some(c=>c.rank==='K')) { dmg *= 3; note2(f.x,f.y-f.radius-108,'KING x3','#ffd0d0'); }
            dmg = scaledByMirror(f,dmg);
            f.data.lastDmg = dmg;
            projectiles.push({type:'card_throw',owner:f,enemy:e,x:f.x,y:f.y-f.radius-64,hand,dmg,rawDmg:dmg,hybridNumeric:true,radius:34,life:2.8,maxLife:2.8,hit:false,unblockable:true});
            f.data.resolvePulse = .75;
            f.data.hand = [];
            f.data.deck = makeDeckLocal(f);
            f.data.phase = 'draw';
            f.data.drawCd = 1.1;
            playFighterSound(f,'skill');
          }
          return;
        }
        f.data.drawCd -= abilityDt(f,dt);
        if (f.data.drawCd <= 0) {
          f.data.drawCd = 1.1;
          if (!f.data.deck || !f.data.deck.length) f.data.deck = makeDeckLocal(f);
          f.data.hand.push(f.data.deck.pop());
          playFighterSound(f,'wall');
          if (f.data.hand.length >= 3) {
            f.data.phase = 'show';
            f.data.showTimer = 1.04;
            f.data.lastDmg = f.isRage ? rageDamageLocal(f.data.hand,f,e) : cardCaoDamage(f.data.hand);
          }
        }
      };
    }

    const sniper = FT('SNIPER');
    if (sniper) {
      const shotRaw = (f,e) => 27 * clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
      sniper.update = function(f,e,dt){
        if (!e) return;
        if (f.isRage) {
          f.data.positionLocked = true;
          if ((f.data.reload || 0) > 0) {
            f.data.reload -= dt;
            f.data.hiddenReload = true;
            f.applyStatus('immune', .10, {source:f});
            if (f.data.reload <= 0) {
              const best = f.data.nests.reduce((a,b)=>dist(b.x,b.y,e.x,e.y)>dist(a.x,a.y,e.x,e.y)?b:a,f.data.nests[0]);
              f.x = best.x; f.y = best.y;
              f.data.aim = 3.15; f.data.aimMax = 3.15; f.data.hiddenReload = false;
              note2(f.x, f.y-f.radius-70, 'AIMING', '#ff8b8b');
            }
            return;
          }
          if (f.data.aim > 0) {
            f.data.hiddenReload = false;
            f.data.aim -= dt;
            f.setDir(e.x-f.x, e.y-f.y);
            if (dist(f.x,f.y,e.x,e.y) < 300 && (f.data.aimMax - f.data.aim) > .45) {
              f.data.aim = 0; f.data.reload = 3.15;
              note2(f.x, f.y-f.radius-70, 'RELOAD RELOCATE', '#ff8b8b');
              return;
            }
            if (f.data.aim <= 0) {
              projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
              e.takeDamage(scaledByMirror(f, shotRaw(f,e)), f, 'sniper-shot');
              f.data.reload = 3.15;
              playFighterSound(f,'skill');
            }
            return;
          }
          f.data.reload = 3.15;
          return;
        }
        f.data.hiddenReload = false;
        if (f.data.aim > 0) {
          f.data.positionLocked = true;
          f.data.aim -= dt;
          f.setDir(e.x-f.x,e.y-f.y);
          if (f.data.aim <= 0) {
            const dir = norm(e.x-f.x,e.y-f.y);
            projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
            e.takeDamage(scaledByMirror(f, shotRaw(f,e)), f, 'sniper-shot');
            f.x = clamp(f.x-dir.x*150, f.radius, GAME_SIZE-f.radius);
            f.y = clamp(f.y-dir.y*150, f.radius, GAME_SIZE-f.radius);
            f.data.cd = 8.4;
            playFighterSound(f,'skill');
          }
          return;
        }
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
          const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
          f.data.aim = Math.max(1.25, 0.65 + 1.45*ratio);
          f.data.aimMax = f.data.aim;
          note2(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b');
        }
      };
    }

    const ice = FT('ICE');
    if (ice) {
      ice.update = function(f,e,dt){
        if (!f.data.laneActive) f.data.cd -= abilityDt(f,dt);
        if (!f.data.laneActive && f.data.cd <= 0) {
          const a = Math.atan2(e.y-f.y,e.x-f.x);
          const far = pointOnRayToEdge(f.x,f.y,Math.cos(a),Math.sin(a));
          projectiles.push({type:'ice_lane',owner:f,x1:f.x,y1:f.y,x2:far.x,y2:far.y,halfWidth:212,life:6.8,maxLife:6.8,enemyInside:0,dmgTick:0});
          f.data.laneActive = true;
          playFighterSound(f,'skill');
        }
      };
    }

    const math = FT('MATH');
    if (math) {
      math.update = function(f,e,dt){
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
          f.data.cd = f.isRage ? 4.65 : 4.85;
          let formula,result,isRageFormula=false;
          if (f.isRage) { const rage=makeRageMathExpression(); result=rage.result; formula=rage.formula; isRageFormula=true; }
          else {
            const X=Math.round(f.x/50),Y=Math.round(f.y/50),A=Math.round(e.x/50),B=Math.max(1,Math.round(e.y/50));
            result=Math.round((X-Y)*A/B);
            if(result===0) result=(Math.random()<.5?-1:1);
            formula=`(${X}-${Y})x${A}/${B}`;
          }
          projectiles.push({type:'math_formula',owner:f,enemy:e,formula,value:result,rage:isRageFormula,life:4.2,maxLife:4.2,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0,uninterruptible:true});
          playFighterSound(f,'skill');
        }
      };
    }

    const witch = FT('WITCH');
    if (witch) {
      witch.update = function(f,e,dt){
        f.data.rayCd -= abilityDt(f,dt);
        if (f.data.rayCd <= 0) {
          f.data.rayCd = 1.95;
          const end = {x:e.x,y:e.y};
          projectiles.push({type:'witch_ray',owner:f,x1:f.x,y1:f.y,x2:end.x,y2:end.y,life:.18,maxLife:.18});
          if (distToSegment(e.x,e.y,f.x,f.y,end.x,end.y)<=e.radius+18) e.takeDamage(scaledByMirror(f,4.2),f,'magic-ray');
          playFighterSound(f,'skill');
        }
        f.data.curseCd -= abilityDt(f,dt);
        if (f.data.curseCd <= 0) {
          f.data.curseCd = 6.85;
          rollWitchCurse(f,e);
          projectiles.push({type:'witch_talisman',owner:f,x:f.x,y:f.y,targetId:e.id,life:.8,maxLife:.8});
          if (f.isRage) rollWitchCurse(f,e);
        }
      };
    }

    const mirror = FT('MIRROR');
    if (mirror) {
      mirror.update = function(f,e,dt){
        f.data.gateSwapCd = Math.max(0,(f.data.gateSwapCd||0)-dt);
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
          f.data.cd = 8.8;
          createMirrorGate(f);
        }
      };
    }

    const flash = FT('FLASH');
    if (flash) {
      flash.update = function(f,e,dt){
        if (f.isRage) {
          f.data.flashRage ||= {phase:'prep', t:1, cooldown:0, path:null, hitIds:{}};
          const R = f.data.flashRage;
          if (R.phase === 'cool') { R.cooldown -= dt; if (R.cooldown <= 0) { R.phase='prep'; R.t=1; R.path=null; R.hitIds={}; } return; }
          if (R.phase === 'prep') {
            f.data.positionLocked = true;
            R.t -= dt;
            if (!R.path) R.path = buildFlashPathLocal(f);
            if (R.t <= 0) { R.phase='run'; R.t=2; R.startT=2; R.len=pathLenLocal(R.path); R.damage=lerp(8,18,clamp((R.len-900)/2100,0,1)); note2(f.x,f.y-f.radius-82,`ZIGZAG ${R.damage.toFixed(0)}`,'#fff06b'); }
            return;
          }
          if (R.phase === 'run') {
            f.data.positionLocked = true;
            f.applyStatus('immune', .08, {source:f});
            f.data.dashTimer = .12;
            R.t -= dt;
            const prev = {x:f.x,y:f.y};
            const p = pointPathLocal(R.path, clamp(1-R.t/2,0,1));
            f.x = p.x; f.y = p.y;
            if (e && distToSegment(e.x,e.y,prev.x,prev.y,f.x,f.y) < f.radius + e.radius + 24 && (R.hitIds[e.id]||0) < 2) {
              R.hitIds[e.id] = (R.hitIds[e.id]||0) + 1;
              e.takeDamage(R.damage*.65,f,'flash-rage-zigzag');
              spawnShockwave(e.x,e.y,'#fff06b',120);
            }
            if (R.t <= 0) { R.phase='cool'; R.cooldown=.55; f.data.dashTimer=0; }
            return;
          }
        }
        f.data.cd = (f.data.cd||2) - abilityDt(f,dt);
        if (f.data.dashTimer > 0) { f.data.dashTimer -= dt; f.applyStatus('immune',.08,{source:f}); }
        if (f.data.cd <= 0) { f.data.cd=6.35; f.data.dashTimer=.42; f.data.dashHitIds={}; f.setDir(e.x-f.x,e.y-f.y); playFighterSound(f,'skill'); }
      };
      flash.onCollide = function(f,e){
        if (f.data.flashRage?.phase === 'run') return false;
        if (f.data.dashTimer > 0) {
          if (!f.data.dashHitIds) f.data.dashHitIds = {};
          if (f.data.dashHitIds[e.id]) return false;
          f.data.dashHitIds[e.id] = true;
          e.takeDamage(scaledByMirror(f,6.2),f,'flash-dash');
          return true;
        }
        return false;
      };
    }
    function buildFlashPathLocal(f){
      let pts=[{x:f.x,y:f.y}], x=f.x, y=f.y, dir=norm(rand(-1,1),rand(-1,1));
      const segs=5+Math.floor(rand(0,4));
      for(let i=0;i<segs;i++){
        let tx=dir.x>0?GAME_SIZE-35:35, ty=dir.y>0?GAME_SIZE-35:35;
        let ax=(tx-x)/(dir.x||.001), ay=(ty-y)/(dir.y||.001);
        let a=Math.min(Math.abs(ax),Math.abs(ay),rand(340,820));
        if(!isFinite(a)||a<80)a=rand(300,700);
        x=clamp(x+dir.x*a,35,GAME_SIZE-35); y=clamp(y+dir.y*a,35,GAME_SIZE-35);
        pts.push({x,y});
        if(x<=40||x>=GAME_SIZE-40)dir.x*=-1;
        if(y<=40||y>=GAME_SIZE-40)dir.y*=-1;
        dir=norm(dir.x+rand(-.38,.38),dir.y+rand(-.38,.38));
      }
      return pts;
    }
    function pathLenLocal(path){let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1].x,path[i-1].y,path[i].x,path[i].y);return L;}
    function pointPathLocal(path,t){const L=pathLenLocal(path);let need=L*t;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=dist(a.x,a.y,b.x,b.y);if(need<=d)return {x:lerp(a.x,b.x,need/d),y:lerp(a.y,b.y,need/d)};need-=d;}return path[path.length-1];}

    const wolf = FT('WOLF');
    if (wolf) {
      wolf.update = function(f,e,dt){
        f.data.scentCd = (f.data.scentCd||2) - abilityDt(f,dt);
        f.data.biteCd = Math.max(0,(f.data.biteCd||0)-dt);
        f.data.pounceTimer = Math.max(0,(f.data.pounceTimer||0)-dt);
          if (f.data.scentCd <= 0) { f.data.scentCd = 6.7; e.applyStatus('scent',5.0,{source:f}); note2(e.x,e.y-e.radius-90,'BLOOD SCENT','#ff3030'); }
        const base = 162;
        const rageBonus = f.isRage ? Math.max(0,(e.maxHp-e.hp))*5 : 0;
        const inScent = e.hasStatus('scent') && dist(f.x,f.y,e.x,e.y) < base + rageBonus;
        if (inScent && f.data.biteCd <= 0) { const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); f.data.pounceTimer=.58; f.data.biteCd=2.0; note2(f.x,f.y-f.radius-76,'POUNCE','#ff3030'); }
        if (f.data.pounceTimer > 0) { const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); }
      };
      wolf.speedModifier = f => f.data.pounceTimer>0 ? 2.28 : 1;
      wolf.onCollide = function(f,e){
        if (f.data.pounceTimer > 0) {
          if (f.isRage) { const chance=lerp(.5,1,clamp((50-Math.max(0,f.hp))/50,0,1)); if(Math.random()<chance)e.applyStatus('weak',4); }
          e.takeDamage(scaledByMirror(f,11.4),f,'wolf-bite');
          const n=norm(f.x-e.x,f.y-e.y);
          f.x=clamp(f.x+n.x*112,f.radius,GAME_SIZE-f.radius);
          f.y=clamp(f.y+n.y*112,f.radius,GAME_SIZE-f.radius);
          f.data.pounceTimer=0;
          spawnShockwave(e.x,e.y,'#ff3030',120);
          return true;
        }
        return false;
      };
    }

    const crystal = FT('CRYSTAL');
    if (crystal) {
      crystal.update = function(f,e,dt){
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) {
          f.data.cd = 2.15;
          const a=Math.atan2(e.y-f.y,e.x-f.x)+Math.PI/2;
          const len=198;
          const cx=(f.x+e.x)/2, cy=(f.y+e.y)/2;
          projectiles.push({type:'crystal_wall',owner:f,x1:cx-Math.cos(a)*len,y1:cy-Math.sin(a)*len,x2:cx+Math.cos(a)*len,y2:cy+Math.sin(a)*len,life:f.isRage?Infinity:5.2,maxLife:f.isRage?Infinity:5.2,hitIds:{},touchCd:{},permanent:f.isRage});
          playFighterSound(f,'skill');
          checkCrystalDiamond(f);
        }
      };
    }
  })();

  (function productionQualityPatch(){
    window.apexProductionPatchLoaded = 'starting';
    const FT = name => FighterTypes.find(t => t.name === name);
    const say = (x,y,text,color) => floatingTexts.push(new FloatingText(x,y,text,color));
    const rotate = (v,ang) => ({x:v.x*Math.cos(ang)-v.y*Math.sin(ang), y:v.x*Math.sin(ang)+v.y*Math.cos(ang)});
    const liveEnemyOf = f => fighters.find(q => q && q !== f && q.hp > 0 && !sameTeam(f,q));
    const hardSummonTypes = new Set(['superfan','slime_child','virus_minion','straw_monster','puppet_card','witch_talisman','paint_blob','pirate_anchor','card_throw','ice_dart','toxic_shot','sniper_laser']);

    const vamp = FT('VAMPIRE');
    if (vamp) {
      vamp.onCollide = function(f,e){
        if ((f.data.latchTimer||0) > 0) return true;
        const move = norm(f.dx || f.startDx || 1, f.dy || f.startDy || 0);
        const toEnemy = norm(e.x - f.x, e.y - f.y);
        const dot = move.x * toEnemy.x + move.y * toEnemy.y;
        const fangTip = { x:f.x + move.x * (f.radius * .74), y:f.y + move.y * (f.radius * .74) };
        const fangContact = dist(fangTip.x, fangTip.y, e.x, e.y) <= e.radius + f.radius * .62 + 18;
        const actualOverlap = dist(f.x,f.y,e.x,e.y) <= f.radius + e.radius + 8;
        if (dot < -0.02 || !fangContact || !actualOverlap) {
          if (Math.random() < .22) say(f.x, f.y-f.radius-78, 'FANG MISS', '#7c2130');
          return false;
        }
        f.data.latchTimer = .75;
        f.data.latchTarget = e.id;
        f.data.latchTick = 0;
        f.data.bloodLinkLevel = (f.data.bloodLinkLevel || 0) + 1;
        e.applyStatus('slow', .85, {factor:.58, source:f});
        e.takeDamage(scaledByMirror(f, 3), f, 'vampire-fang-drain');
        f.heal(3.0 + (f.data.bloodLinkLevel||0) * .08, true);
        projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:.9,maxLife:.9});
        emitParticles(fangTip.x, fangTip.y, '#d80f2c', 22, 260, 5, .42, 'spark');
        say(fangTip.x, fangTip.y-40, 'BITE', '#ff3658');
        playFighterSound(f,'skill');
        return true;
      };
      vamp.update = function(f,e,dt){
        f.data.latchTimer = Math.max(0,(f.data.latchTimer||0)-dt);
        if (f.data.latchTimer > 0 && e && e.hp > 0) {
          f.data.latchTick = (f.data.latchTick||0) + dt;
          f.setDir(e.x-f.x,e.y-f.y);
          if (f.data.latchTick >= .42) {
            f.data.latchTick = 0;
            e.takeDamage(scaledByMirror(f, 3), f, 'vampire-latch-drain');
            f.heal(2.0 + (f.data.bloodLinkLevel||0)*.05, true);
            projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:.5,maxLife:.5});
          }
        }
      };
    }

    const priorStandard = Fighter.prototype.takeStandardDamage;
    Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number'){
      const dealt = priorStandard.call(this, amount, source, label);
      if (dealt > 0) {
        const last = floatingTexts[floatingTexts.length-1];
        if (last && String(last.text || '').startsWith('STANDARD')) {
          last.text = `-${dealt.toFixed(dealt >= 10 ? 0 : 1)}`;
          last.color = '#ffffff';
        }
      }
      return dealt || 0;
    };
    window.apexDealHybridNumericDamage = function(target, source, rawDamage, label){
      if (!target || !source || rawDamage <= 0) return {standard:0, normal:0, normalFinal:0};
      const raw = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
      const standardPart = Math.min(raw, 30);
      const normalPart = Math.max(0, raw - 30);
      source.hybridRawLog ||= {};
      source.hybridRawLog[label] = (source.hybridRawLog[label] || 0) + raw;
      const standardFinal = standardPart > 0 ? target.takeStandardDamage(standardPart, source, `${label}-standard`) : 0;
      let normalFinal = 0;
      if (normalPart > 0 && target.hp > 0) {
        const hpBefore = target.hp;
        target.takeDamage(normalPart, source, `${label}-normal`, false);
        normalFinal = Math.max(0, hpBefore - target.hp);
        if (normalFinal > 0) floatingTexts.push(new FloatingText(target.x+18, target.y-target.radius-70, `-${normalFinal.toFixed(normalFinal>=10?0:1)}`, '#ff5950'));
      }
      source.hybridHits ||= [];
      source.hybridHits.push({label, raw, standard:standardFinal, normalRaw:normalPart, normalFinal});
      return {standard:standardFinal, normal:normalPart, normalFinal};
    };

    const prevTakeDamage = Fighter.prototype.takeDamage;
    Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
      if (this.name === 'PUPPET' && source && source !== this && !statusDamage && amount > 0) {
        const effigies = projectiles
          .filter(p => p.type === 'puppet_effigy' && p.owner === this && p.hp > 0 && p.life > 0)
          .sort((a,b)=>(a.order||0)-(b.order||0));
        if (effigies.length) {
          const effigy = effigies[0];
          const block = Math.min(effigy.hp, amount);
          effigy.hp -= block;
          projectiles.push({type:'puppet_transfer_link',owner:this,x1:this.x,y1:this.y,x2:effigy.x,y2:effigy.y,life:.42,maxLife:.42});
          say(this.x, this.y-this.radius-88, `-${Math.max(0, amount-block).toFixed(1)}`, '#d8ffbf');
          say(effigy.x, effigy.y-effigy.radius-38, `-${block.toFixed(1)}`, '#77ff9e');
          emitParticles(effigy.x,effigy.y,'#77ff9e',16,210,4,.35,'spark');
          if (effigy.hp <= 0) { effigy.life = 0; spawnShockwave(effigy.x, effigy.y, '#79ff9e', 110); }
          const puppetPart = Math.max(0, amount - block) * .9 + block * .38;
          if (puppetPart <= 0) return 0;
          return prevTakeDamage.call(this, puppetPart, source, `${label||'direct'}-puppet-transfer`, true);
        }
      }
      return prevTakeDamage.call(this, amount, source, label, statusDamage);
    };

    const prevUpdateProjectiles = updateProjectiles;
    updateProjectiles = function(dt){
      for (const mf of fighters) {
        if (!mf || mf.name !== 'MAGNET' || !(mf.data && mf.data.fieldTimer > 0)) continue;
        const shell = mf.radius + 248;
        for (const p of projectiles) {
          if (!p || p.owner === mf || !p.type || !hardSummonTypes.has(p.type) || p.x === undefined || p.y === undefined || p.life <= 0) continue;
          if (sameTeam(mf, p.owner)) continue;
          const r = p.radius || 12;
          if (dist(mf.x,mf.y,p.x,p.y) <= shell + r) {
            const n = norm(p.x-mf.x,p.y-mf.y);
            p.x = mf.x + n.x * (shell + r + 10);
            p.y = mf.y + n.y * (shell + r + 10);
            p.vx = (p.vx||0) + n.x * 260;
            p.vy = (p.vy||0) + n.y * 260;
            p.stun = Math.max(p.stun||0, .35);
            if (p.hp !== undefined) p.hp -= 2.5; else p.life = Math.min(p.life, .08);
            if (p.hp !== undefined && p.hp <= 0) p.life = 0;
            mf.blockedDamage = (mf.blockedDamage || 0) + 4;
            say(mf.x, mf.y-mf.radius-92, 'MAGNET BLOCK', '#ffe44e');
            emitParticles(p.x,p.y,'#ffe44e',14,260,4,.35,'square');
          }
        }
      }
      prevUpdateProjectiles(dt);
      for (const cage of projectiles) {
        if (!cage || cage.type !== 'crystal_cage' || cage.life <= 0) continue;
        const ang = Math.atan2((cage.diamondY||cage.y)-cage.y, (cage.diamondX||cage.x)-cage.x);
        const sector = Math.floor(((ang + Math.PI*2 + Math.PI/6) % TAU) / (TAU/6));
        cage.edgeHistory ||= [];
        if (cage.edgeHistory[cage.edgeHistory.length-1] !== sector) cage.edgeHistory.push(sector);
        if (cage.edgeHistory.length > 8) cage.edgeHistory.shift();
        if (cage.edgeHistory.length >= 6 && new Set(cage.edgeHistory).size <= 2) {
          const v = rotate(norm(cage.vx||1,cage.vy||.37), (11 + Math.random()*12) * Math.PI/180);
          const sp = Math.max(700, Math.hypot(cage.vx||0,cage.vy||0));
          cage.vx = v.x * sp; cage.vy = v.y * sp; cage.edgeHistory = [];
          say(cage.x, cage.y-cage.cageRadius-26, 'CHAOS REFRACT', '#c7ffff');
        }
      }
    };

    const prevSpawnGraph = spawnMathV2Graph;
    spawnMathV2Graph = function(owner, formula, kindOrFn){
      prevSpawnGraph(owner, formula, kindOrFn);
      const graph = [...projectiles].reverse().find(p => p.type === 'math_v2_graph' && p.owner === owner);
      if (graph) {
        graph.drawProgress = 0;
        graph.energy = graph.energy ?? 7;
        graph.life = Math.min(graph.life || 4.5, 4.0);
        graph.maxLife = graph.life;
        graph.hitCd = graph.hitCd || {};
      }
    };
    const math2 = FT('MATH_V2');
    if (math2) {
      math2.update = function(f,e,dt){
        const hasGraph = projectiles.some(p => p.type === 'math_v2_graph' && p.owner === f && p.life > 0);
        if (f.data.phase === 'typing') {
          f.data.typeTime = (f.data.typeTime || 0) + dt;
          const typeDur = f.isRage ? 1.05 : 1.85;
          const pauseDur = 1.0;
          f.data.typeProgress = clamp(f.data.typeTime / typeDur, 0, 1);
          if (f.data.typeTime >= typeDur + pauseDur) {
            spawnMathV2Graph(f, f.data.option.label, f.data.option.fn);
            f.data.phase = 'idle'; f.data.cd = f.isRage ? .75 : 6.3; f.data.typeTime = 0;
          }
          return;
        }
        if (!hasGraph) {
          f.data.cd -= abilityDt(f,dt);
          if (f.data.cd <= 0) {
            f.data.option = makeMathV2Function();
            f.data.phase = 'typing'; f.data.typeTime = 0; f.data.typeProgress = 0;
            projectiles.push({type:'math_v2_grid',owner:f,x:500,y:500,life:3.1,maxLife:3.1,formula:f.data.option.label});
            playFighterSound(f,'skill');
          }
        }
      };
      math2.draw = function(ctx,f){
        drawPolygon(ctx,[[-60,-55],[58,-48],[66,48],[-55,60]],'#cceeff','#173544',5);
        ctx.fillStyle='#173544'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('Oxy',0,-8); ctx.fillText('f(x)',0,22);
        if (f.data.phase === 'typing' && f.data.option) {
          const pct = clamp(f.data.typeProgress||0,0,1);
          const txt = f.data.option.label.slice(0, Math.max(1, Math.floor(f.data.option.label.length * pct)));
          ctx.fillStyle='#eaffff'; ctx.strokeStyle='#0b1620'; ctx.lineWidth=4; ctx.font='900 16px monospace'; ctx.textAlign='center';
          ctx.strokeText(txt,0,-f.radius-18); ctx.fillText(txt,0,-f.radius-18);
          if (pct >= 1) { ctx.fillStyle='#9ad7ff'; ctx.font='900 12px monospace'; ctx.fillText('ORIGIN READY',0,-f.radius-38); }
        }
      };
    }

    const sniper = FT('SNIPER');
    if (sniper) {
      function farNest(f,e){ return f.data.nests.reduce((best,n)=>dist(n.x,n.y,e.x,e.y)>dist(best.x,best.y,e.x,e.y)?n:best, f.data.nests[0]); }
      function relocate(f,e,resetAim){
        const n = farNest(f,e); f.x=n.x; f.y=n.y;
        if (resetAim) { f.data.aim=3; f.data.aimMax=3; }
        say(f.x,f.y-f.radius-78,'RELOCATE','#ff8b8b');
        emitParticles(f.x,f.y,'#ff8b8b',18,300,5,.35,'spark');
      }
      sniper.update = function(f,e,dt){
        if (f.isRage) {
          f.data.positionLocked = true;
          if (e && dist(f.x,f.y,e.x,e.y) < 300) relocate(f,e,(f.data.aim||0)>0);
          if ((f.data.reload||0) > 0) {
            f.data.reload -= dt; f.data.hiddenReload = true; f.applyStatus('immune',.08,{source:f});
            if (f.data.reload <= 0) { f.data.hiddenReload=false; relocate(f,e,true); }
            return;
          }
          if ((f.data.aim||0) > 0) {
            f.data.hiddenReload = false; f.data.aim -= dt; f.setDir(e.x-f.x,e.y-f.y);
            if (f.data.aim <= 0) {
              const ratio = clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
              projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
              e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot');
              f.data.reload=3; f.data.aim=0; playFighterSound(f,'skill');
            }
            return;
          }
          f.data.reload = 3;
          return;
        }
        if ((f.data.aim||0) > 0) {
          f.data.positionLocked = true; f.data.aim -= dt; f.setDir(e.x-f.x,e.y-f.y);
          if (f.data.aim <= 0) {
            const dir = norm(e.x-f.x,e.y-f.y), ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1);
            projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45});
            e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot');
            f.setDir(-dir.x,-dir.y); f.data.recoilMove = 1.4; f.data.cd=7.8; playFighterSound(f,'skill');
          }
          return;
        }
        f.data.recoilMove = Math.max(0,(f.data.recoilMove||0)-dt);
        f.data.cd -= abilityDt(f,dt);
        if (f.data.cd <= 0) { const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,.55+1.35*ratio); f.data.aimMax=f.data.aim; say(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b'); }
      };
      sniper.speedModifier = f => (f.data.recoilMove||0)>0 ? 1.35 : 1;
      const oldSniperDraw = sniper.draw;
      sniper.draw = function(ctx,f){
        oldSniperDraw(ctx,f);
        ctx.save(); ctx.textAlign='center'; ctx.font='900 14px monospace'; ctx.fillStyle='#ffb0b0';
        if ((f.data.aim||0)>0) ctx.fillText(`AIM ${Math.max(0,f.data.aim).toFixed(1)}s`,0,-f.radius-40);
        else if ((f.data.reload||0)>0 || f.data.hiddenReload) ctx.fillText(`RELOAD ${Math.max(0,f.data.reload||0).toFixed(1)}s`,0,-f.radius-40);
        ctx.restore();
      };
    }

    const prevDrawProjectiles = drawProjectiles;
    drawProjectiles = function(ctx){
      prevDrawProjectiles(ctx);
      for (const p of projectiles) {
        ctx.save();
        if (p.type === 'puppet_transfer_link') {
          ctx.globalAlpha = Math.max(0,p.life/p.maxLife);
          ctx.strokeStyle='rgba(112,255,152,.95)'; ctx.lineWidth=3; ctx.setLineDash([8,8]);
          ctx.beginPath(); ctx.moveTo(p.x1,p.y1);
          const mx=(p.x1+p.x2)/2 + Math.sin(matchClock*20)*18, my=(p.y1+p.y2)/2 - 25;
          ctx.quadraticCurveTo(mx,my,p.x2,p.y2); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle='#d9ffd5'; ctx.font='900 18px serif'; ctx.textAlign='center'; ctx.fillText('Ă§Â¬Â¦',mx,my);
        }
        if (p.type === 'superfan') {
          const a = clamp(p.life/(p.maxLife||1),0,1);
          ctx.globalAlpha = .9*a; ctx.translate(p.x,p.y);
          ctx.fillStyle='#ff7bd6'; ctx.strokeStyle='#2a0821'; ctx.lineWidth=3;
          drawPolygon(ctx,[[0,-15],[13,-5],[10,13],[-10,13],[-13,-5]],'#ff7bd6','#2a0821',3);
          ctx.fillStyle='#fff'; ctx.font='900 11px sans-serif'; ctx.textAlign='center'; ctx.fillText('HP'+Math.ceil(p.hp||0),0,4);
        }
        if (p.type === 'pirate_pull_ring') {
          ctx.globalAlpha = clamp(p.life/p.maxLife,0,1); ctx.strokeStyle='#e6c27a'; ctx.lineWidth=4;
          ctx.beginPath(); ctx.arc(p.x,p.y,(1-p.life/p.maxLife)*44+8,0,TAU); ctx.stroke();
        }
        if (p.type === 'pirate_loot_fx') {
          ctx.globalAlpha = clamp(p.life/p.maxLife,0,1); ctx.textAlign='center'; ctx.font='900 42px serif';
          ctx.fillStyle=p.kind==='treasure'?'#ffd447':p.kind==='cannon'?'#ddd':'#b88755';
          ctx.fillText(p.kind==='boat'?'SHIP':p.kind==='cannon'?'CANNON':'GOLD',p.x,p.y);
        }
        ctx.restore();
      }
    };

    // SOLO 1V1 LOCAL removed for the TikTok telemetry build.
    window.goToSoloSelect = function(){ goToMenu(); };
    window.startSoloMode = function(){};

    window.apexProductionPatchLoaded = 'ready';
  })();

  (function localPostPatchBalance(){
    const FT = name => FighterTypes.find(t => t.name === name);
    const note = (x,y,t,c) => floatingTexts.push(new FloatingText(x,y,t,c));
    const oldNovaDamageFn = novaDamage;
    novaDamage = function(t){ return oldNovaDamageFn(t) * .86; };

    const blade = FT('BLADE');
    if (blade) {
      blade.onWallBounce = function(f){
        const a=Math.atan2(GAME_SIZE/2-f.y,GAME_SIZE/2-f.x);
        const spread=f.isRage?[-.17,.17]:[0];
        for(const off of spread){
          const aa=a+off;
          projectiles.push({type:'blade_wave',owner:f,x:f.x,y:f.y,vx:Math.cos(aa)*1080,vy:Math.sin(aa)*1080,halfWidth:260,length:380,life:2.25,maxLife:2.25,dmg:scaledByMirror(f,3.05),bounces:f.isRage?2:0,hit:false});
        }
        playFighterSound(f,'skill');
      };
    }

    const wolf = FT('WOLF');
    if (wolf) {
      wolf.update = function(f,e,dt){
        f.data.scentCd = (f.data.scentCd||2) - abilityDt(f,dt);
        f.data.biteCd = Math.max(0,(f.data.biteCd||0)-dt);
        f.data.pounceTimer = Math.max(0,(f.data.pounceTimer||0)-dt);
        if (f.data.scentCd <= 0) { f.data.scentCd = 7.4; e.applyStatus('scent',4.7,{source:f}); note(e.x,e.y-e.radius-90,'BLOOD SCENT','#ff3030'); }
        const base = 150, rageBonus = f.isRage ? Math.max(0,(e.maxHp-e.hp))*4.25 : 0;
        if (e.hasStatus('scent') && dist(f.x,f.y,e.x,e.y) < base + rageBonus && f.data.biteCd <= 0) {
          const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); f.data.pounceTimer=.48; f.data.biteCd=2.55; note(f.x,f.y-f.radius-76,'POUNCE','#ff3030');
        }
        if (f.data.pounceTimer > 0) { const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); }
      };
      wolf.speedModifier = f => f.data.pounceTimer>0 ? 2.08 : 1;
      wolf.onCollide = function(f,e){
        if (f.data.pounceTimer > 0) {
          if (f.isRage) { const chance=lerp(.45,.9,clamp((50-Math.max(0,f.hp))/50,0,1)); if(Math.random()<chance)e.applyStatus('weak',3.4); }
          e.takeDamage(scaledByMirror(f,9.2),f,'wolf-bite');
          const n=norm(f.x-e.x,f.y-e.y);
          f.x=clamp(f.x+n.x*112,f.radius,GAME_SIZE-f.radius);
          f.y=clamp(f.y+n.y*112,f.radius,GAME_SIZE-f.radius);
          f.data.pounceTimer=0; spawnShockwave(e.x,e.y,'#ff3030',112); return true;
        }
        return false;
      };
    }

    const witch = FT('WITCH');
    if (witch) {
      witch.update = function(f,e,dt){
        f.data.rayCd -= abilityDt(f,dt);
        if (f.data.rayCd <= 0) {
          f.data.rayCd = 2.55;
          projectiles.push({type:'witch_ray',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.18,maxLife:.18});
          if(distToSegment(e.x,e.y,f.x,f.y,e.x,e.y)<=e.radius+18) e.takeDamage(scaledByMirror(f,3.2),f,'magic-ray');
          playFighterSound(f,'skill');
        }
        f.data.curseCd -= abilityDt(f,dt);
        if (f.data.curseCd <= 0) {
          f.data.curseCd = 8.2;
          rollWitchCurse(f,e);
          projectiles.push({type:'witch_talisman',owner:f,x:f.x,y:f.y,targetId:e.id,life:.8,maxLife:.8});
          if (f.isRage && Math.random() < .55) rollWitchCurse(f,e);
        }
      };
    }

    const time = FT('TIME');
    if (time) {
      time.update = function(f,e,dt){
        f.data.clockCd = (f.data.clockCd||4) - abilityDt(f,dt);
        if (f.data.clockCd <= 0) {
          f.data.clockCd = 4.8;
          const raw = Math.max(2, Math.round(clockDamageValue() * .82));
          if (window.apexDealHybridNumericDamage) window.apexDealHybridNumericDamage(e,f,raw,'clock-hour-strike');
          else e.takeDamage(raw,f,'clock-hour-strike');
          projectiles.push({type:'clock_flash',owner:f,num:raw,life:.9,maxLife:.9});
          note(e.x,e.y-e.radius-80,`CLOCK ${raw}`,'#efeaff');
        }
        if(f.data.markCd===undefined)f.data.markCd=7;
        f.data.markCd-=abilityDt(f,dt);
        if(f.data.markCd<=0&&!f.data.mark){f.data.markCd=10; f.data.mark={timer:3,hp:f.hp,x:f.x,y:f.y,enemyHp:e.hp}; projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3}); note(f.x,f.y-f.radius-76,'TIME MARK','#efeaff');}
      };
    }

    const card = FT('CARD');
    if (card) {
      const prevCardUpdate = card.update;
      card.update = function(f,e,dt){
        prevCardUpdate(f,e,dt);
        if (f.data && f.data.phase === 'draw') f.data.drawCd = Math.min(f.data.drawCd, .95);
      };
    }

    const puppetFine = FT('PUPPET');
    const prevDamageForPuppetBuff = Fighter.prototype.takeDamage;
    Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
      if (this.name === 'PUPPET' && source && source !== this && !statusDamage && amount > 0) {
        const effigy = projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===this&&p.hp>0&&p.life>0).sort((a,b)=>(a.order||0)-(b.order||0))[0];
        if (effigy) {
          const block=Math.min(effigy.hp, amount);
          effigy.hp -= block;
          projectiles.push({type:'puppet_transfer_link',owner:this,x1:this.x,y1:this.y,x2:effigy.x,y2:effigy.y,life:.42,maxLife:.42});
          note(this.x,this.y-this.radius-88,`-${Math.max(0,amount-block).toFixed(1)}`,'#d8ffbf');
          note(effigy.x,effigy.y-effigy.radius-38,`-${block.toFixed(1)}`,'#77ff9e');
          if (effigy.hp <= 0) { effigy.life = 0; spawnShockwave(effigy.x, effigy.y, '#79ff9e', 110); }
          const puppetPart=Math.max(0, amount-block)*.82 + block*.22;
          if (puppetPart > 0) return prevDamageForPuppetBuff.call(this, puppetPart, source, `${label||'direct'}-puppet-soft-transfer`, true);
          return 0;
        }
      }
      return prevDamageForPuppetBuff.call(this, amount, source, label, statusDamage);
    };

    const prevUP2 = updateProjectiles;
    updateProjectiles = function(dt){
      for (const p of projectiles) {
        if (p.type === 'pirate_anchor' && p.triggered) p.finalDmg = Math.min(p.finalDmg || 0, p.boat ? 25 : 20);
        if (p.type === 'paint_blob') { p.radius = Math.min(p.radius||25, 22); p.life = Math.min(p.life, 1.75); }
      }
      prevUP2(dt);
    };

    if (CANONICAL_NUMERIC_TUNING.MAGNET) Object.assign(CANONICAL_NUMERIC_TUNING.MAGNET,{out:1.08,taken:.98,cd:1.08});
    if (CANONICAL_NUMERIC_TUNING.PAINTER) Object.assign(CANONICAL_NUMERIC_TUNING.PAINTER,{out:1.00,taken:1.00,cd:1.02});
    if (CANONICAL_NUMERIC_TUNING.PIRATE) Object.assign(CANONICAL_NUMERIC_TUNING.PIRATE,{out:1.08,taken:.92,cd:1.08});
    if (CANONICAL_NUMERIC_TUNING.NOVA) Object.assign(CANONICAL_NUMERIC_TUNING.NOVA,{out:1.05,taken:.98,cd:1.05});
    window.apexLocalPostPatchBalance = 'ready';
  })();

  (function correctiveProductionPatch2(){
    const FT = name => FighterTypes.find(t => t.name === name);
    const DEBUG_VAMPIRE_BITE = false;
    window.DEBUG_VAMPIRE_BITE = DEBUG_VAMPIRE_BITE;
    const note = (x,y,text,color) => floatingTexts.push(new FloatingText(x,y,text,color));
    function resetCanvasState(ctx){
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.filter = 'none';
      ctx.setLineDash([]);
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'miter';
    }

    const vampire = FT('VAMPIRE');
    if (vampire) {
      vampire.onCollide = function(f,e){
        if ((f.data.latchTimer||0) > 0) return true;
        const last = f.data.lastMoveDir || f.dir || {x:f.startDx||1,y:f.startDy||0};
        const forward = norm(last.x || f.startDx || 1, last.y || f.startDy || 0);
        const toEnemy = norm(e.x - f.x, e.y - f.y);
        const centerDot = forward.x * toEnemy.x + forward.y * toEnemy.y;
        const fangX = f.x + forward.x * f.radius * .92;
        const fangY = f.y + forward.y * f.radius * .92;
        const bodyGapFromFang = dist(fangX, fangY, e.x, e.y) - e.radius;
        const overlap = dist(f.x,f.y,e.x,e.y) <= f.radius + e.radius + 12;
        const nearest = { x:e.x - forward.x * e.radius, y:e.y - forward.y * e.radius };
        const nearestGap = dist(fangX, fangY, nearest.x, nearest.y);
        f.data.debugFang = {x:fangX,y:fangY,ok:false};
        if (!overlap || centerDot <= .15 || bodyGapFromFang > 48 || nearestGap > e.radius + 82) {
          if (Math.random() < .12) note(fangX, fangY-34, 'FANG MISS', '#7c2130');
          return false;
        }
        f.data.debugFang.ok = true;
        f.data.latchTimer = .95;
        f.data.latchTarget = e.id;
        f.data.latchTick = 0;
        f.data.bloodLinkLevel = (f.data.bloodLinkLevel || 0) + 1;
        e.applyStatus('slow', .9, {factor:.58, source:f});
        e.takeDamage(scaledByMirror(f, 3), f, 'vampire-fang-drain');
        f.heal(3 + (f.data.bloodLinkLevel||0)*.08, true);
        projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:.95,maxLife:.95});
        emitParticles(fangX, fangY, '#d80f2c', 26, 300, 5, .45, 'spark');
        note(fangX, fangY-40, 'FANG LOCK', '#ff3658');
        playFighterSound(f,'skill');
        return true;
      };
      vampire.update = function(f,e,dt){
        if ((f.data.latchTimer||0) <= 0 && f.dir) f.data.lastMoveDir = {x:f.dir.x, y:f.dir.y};
        f.data.latchTimer = Math.max(0,(f.data.latchTimer||0)-dt);
        if (f.data.latchTimer > 0 && e && e.hp > 0) {
          f.data.latchTick = (f.data.latchTick||0) + dt;
          f.setDir(e.x-f.x,e.y-f.y);
          if (f.data.latchTick >= .5) {
            f.data.latchTick -= .5;
            e.takeDamage(scaledByMirror(f,3), f, 'vampire-latch-drain');
            f.heal(2 + (f.data.bloodLinkLevel||0)*.05, true);
            projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:.55,maxLife:.55});
          }
        }
      };
      const oldVampDraw = vampire.draw;
      vampire.draw = function(ctx,f){
        oldVampDraw(ctx,f);
        if (DEBUG_VAMPIRE_BITE && f.data.debugFang) {
          ctx.save(); resetCanvasState(ctx);
          const d = norm(f.dx || f.dir?.x || 1, f.dy || f.dir?.y || 0);
          ctx.translate(-f.x,-f.y);
          ctx.strokeStyle = f.data.debugFang.ok ? '#ff3658' : '#765';
          ctx.fillStyle = f.data.debugFang.ok ? '#ff3658' : '#765';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.data.debugFang.x, f.data.debugFang.y, 28, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(f.data.debugFang.x, f.data.debugFang.y); ctx.lineTo(f.data.debugFang.x+d.x*80, f.data.debugFang.y+d.y*80); ctx.stroke();
          ctx.restore();
        }
      };
    }

    const oldStd2 = Fighter.prototype.takeStandardDamage;
    Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number'){
      const before = floatingTexts.length;
      const dealt = oldStd2.call(this, amount, source, label) || 0;
      for (let i=before;i<floatingTexts.length;i++) {
        const t = floatingTexts[i];
        if (String(t.text||'').includes('STANDARD')) { t.text = `-${dealt.toFixed(dealt>=10?0:1)}`; t.color = '#fff'; }
      }
      return dealt;
    };
    window.apexDealHybridNumericDamage = function(target, source, rawDamage, label){
      if (!target || !source || rawDamage <= 0) return {standard:0, normal:0, normalFinal:0};
      const raw = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
      const standardPart = Math.min(raw, 30), normalPart = Math.max(0, raw-30);
      source.hybridRawLog ||= {}; source.hybridRawLog[label] = (source.hybridRawLog[label]||0) + raw;
      const standardFinal = standardPart > 0 ? target.takeStandardDamage(standardPart, source, `${label}-standard`) : 0;
      let normalFinal = 0;
      if (normalPart > 0 && target.hp > 0) {
        const hp = target.hp;
        target.takeDamage(normalPart, source, `${label}-normal`, false);
        normalFinal = Math.max(0, hp-target.hp);
        if (normalFinal > 0) floatingTexts.push(new FloatingText(target.x+20,target.y-target.radius-76,`-${normalFinal.toFixed(normalFinal>=10?0:1)}`,'#ff5950'));
      }
      source.hybridHits ||= []; source.hybridHits.push({label, raw, standard:standardFinal, normalRaw:normalPart, normalFinal});
      return {standard:standardFinal, normal:normalPart, normalFinal};
    };

    const math2 = FT('MATH_V2');
    if (math2) {
      math2.update = function(f,e,dt){
        const hasGraph = projectiles.some(p=>p.type==='math_v2_graph'&&p.owner===f&&p.life>0);
        if (f.data.phase === 'typing') {
          f.data.typeTime = (f.data.typeTime||0) + dt;
          const typeDur = f.isRage ? 1.15 : 1.9;
          f.data.typeProgress = clamp(f.data.typeTime/typeDur,0,1);
          if (f.data.typeTime >= typeDur + 1.0) {
            spawnMathV2Graph(f, f.data.option.label, f.data.option.fn);
            const g = [...projectiles].reverse().find(p=>p.type==='math_v2_graph'&&p.owner===f);
            if (g) { g.drawProgress=0; g.energy=5; g.life=Math.min(g.life,3.6); g.maxLife=g.life; g.hitCd={}; }
            f.data.phase='idle'; f.data.cd=f.isRage ? 1.0 : 6.8; f.data.typeTime=0;
          }
          return;
        }
        if (!hasGraph) {
          f.data.cd -= abilityDt(f,dt);
          if (f.data.cd <= 0) {
            f.data.option = makeMathV2Function();
            f.data.phase = 'typing'; f.data.typeTime = 0; f.data.typeProgress = 0;
            projectiles.push({type:'math_v2_grid',owner:f,x:500,y:500,life:3.2,maxLife:3.2,formula:f.data.option.label});
            playFighterSound(f,'skill');
          }
        }
      };
    }

    const sniper = FT('SNIPER');
    if (sniper) {
      function farNest(f,e){ return f.data.nests.reduce((best,n)=>dist(n.x,n.y,e.x,e.y)>dist(best.x,best.y,e.x,e.y)?n:best,f.data.nests[0]); }
      function relocate(f,e,resetAim){ const n=farNest(f,e); f.x=n.x; f.y=n.y; if(resetAim){f.data.aim=3;f.data.aimMax=3;} note(f.x,f.y-f.radius-78,'RELOCATE','#ff8b8b'); }
      sniper.update = function(f,e,dt){
        if (f.isRage) {
          f.data.positionLocked = true;
          const close = e && dist(f.x,f.y,e.x,e.y) < 300;
          if (close) relocate(f,e,(f.data.aim||0)>0);
          if ((f.data.reload||0)>0) { f.data.reload-=dt; f.data.hiddenReload=true; f.applyStatus('immune',.08,{source:f}); if(f.data.reload<=0){f.data.hiddenReload=false; relocate(f,e,true);} return; }
          if ((f.data.aim||0)>0) { f.data.hiddenReload=false; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot'); f.data.reload=3; f.data.aim=0; playFighterSound(f,'skill'); } return; }
          f.data.reload=3; return;
        }
        if ((f.data.aim||0)>0) { f.data.positionLocked=true; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const dir=norm(e.x-f.x,e.y-f.y), ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot'); f.setDir(-dir.x,-dir.y); f.data.recoilMove=1.8; f.data.cd=7.8; playFighterSound(f,'skill'); } return; }
        f.data.recoilMove=Math.max(0,(f.data.recoilMove||0)-dt); f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,.55+1.35*ratio); f.data.aimMax=f.data.aim; note(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b'); }
      };
      sniper.speedModifier = f => (f.data.recoilMove||0)>0 ? 1.45 : 1;
    }

    // SOLO 1V1 LOCAL removed for the TikTok telemetry build.
    window.goToSoloSelect = function(){ goToMenu(); };
    window.startSoloMode = function(){};

    window.apexCorrectivePatch2 = 'ready';
  })();

  (function correctiveProductionPatch3(){
    const FT = name => FighterTypes.find(t => t.name === name);
    const note = (x,y,text,color) => floatingTexts.push(new FloatingText(x,y,text,color));
    function resetCtx(c){
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.shadowColor = 'transparent';
      c.shadowOffsetX = 0; c.shadowOffsetY = 0; c.filter = 'none'; c.setLineDash([]); c.lineCap = 'butt'; c.lineJoin = 'miter';
    }

    const drawBeforeKungfuFix = Fighter.prototype.draw;
    Fighter.prototype.draw = function(c){
      c.save();
      try { drawBeforeKungfuFix.call(this, c); }
      finally { c.restore(); resetCtx(c); }
    };

    const oldHybridStd3 = Fighter.prototype.takeStandardDamage;
    Fighter.prototype.takeStandardDamage = function(amount, source=null, label='standard-number'){
      const before = floatingTexts.length;
      const dealt = oldHybridStd3.call(this, amount, source, label) || 0;
      for (let i=before;i<floatingTexts.length;i++) {
        const t = floatingTexts[i];
        if (String(t.text||'').includes('STANDARD')) { t.text = `-${dealt.toFixed(dealt>=10?0:1)}`; t.color = '#fff'; }
      }
      return dealt;
    };
    window.apexDealHybridNumericDamage = function(target, source, rawDamage, label){
      if (!target || !source || rawDamage <= 0) return {standard:0, normal:0, normalFinal:0};
      const raw = Math.max(0, Number.isFinite(rawDamage) ? rawDamage : 0);
      const standardPart = Math.min(raw, 30), normalPart = Math.max(0, raw - 30);
      source.hybridRawLog ||= {}; source.hybridRawLog[label] = (source.hybridRawLog[label] || 0) + raw;
      const standardFinal = standardPart > 0 ? target.takeStandardDamage(standardPart, source, `${label}-standard`) : 0;
      let normalFinal = 0;
      if (normalPart > 0 && target.hp > 0) {
        const hp = target.hp, beforeTexts = floatingTexts.length;
        target.takeDamage(normalPart, source, `${label}-normal`, false);
        normalFinal = Math.max(0, hp - target.hp);
        for (let i=floatingTexts.length-1;i>=beforeTexts;i--) {
          if (/^-/.test(String(floatingTexts[i].text||''))) floatingTexts.splice(i,1);
        }
        if (normalFinal > 0) floatingTexts.push(new FloatingText(target.x+20, target.y-target.radius-72, `-${normalFinal.toFixed(normalFinal>=10?0:1)}`, '#ff5950'));
      }
      source.hybridHits ||= []; source.hybridHits.push({label, raw, standard:standardFinal, normalRaw:normalPart, normalFinal});
      return {standard:standardFinal, normal:normalPart, normalFinal};
    };

    const vampire = FT('VAMPIRE');
    if (vampire) {
      vampire.onCollide = function(f,e){
        if ((f.data.latchTimer||0)>0) return true;
        const forward = norm((f.data.lastMoveDir||f.dir||{x:1,y:0}).x, (f.data.lastMoveDir||f.dir||{x:1,y:0}).y);
        const toEnemy = norm(e.x-f.x,e.y-f.y);
        const front = forward.x*toEnemy.x + forward.y*toEnemy.y;
        const fang = {x:f.x+forward.x*f.radius*.92, y:f.y+forward.y*f.radius*.92};
        const gap = dist(fang.x, fang.y, e.x, e.y) - e.radius;
        if (front <= .15 || gap > 52 || dist(f.x,f.y,e.x,e.y) > f.radius+e.radius+12) return false;
        f.data.latchTimer = f.type?.arsenalShell ? 2.5 : 5.0; /* Arsenal A-CORR-3 ADAPT */
        f.data.latchTick = 0;
        f.data.latchTarget = e.id;
        f.data.bloodLinkLevel = (f.data.bloodLinkLevel||0) + 1;
        f.data.latchForward = forward;
        f.setDir(e.x-f.x,e.y-f.y);
        e.applyStatus('slow', .25, {mult:.3, source:f});
        projectiles.push({type:'blood_link',owner:f,targetId:e.id,life:5,maxLife:5});
        note(fang.x,fang.y-40,'FANG LOCK 5s','#ff3658');
        playFighterSound(f,'skill');
        return true;
      };
      vampire.update = function(f,e,dt){
        if ((f.data.latchTimer||0) <= 0 && f.dir) f.data.lastMoveDir = {x:f.dir.x,y:f.dir.y};
        if (f.data.latchTimer > 0 && e && e.hp > 0) {
          f.data.positionLocked = true;
          f.data.latchTimer = Math.max(0, f.data.latchTimer - dt);
          const forward = norm(e.x-f.x,e.y-f.y);
          const gap = e.radius + f.radius*.92 - 6;
          f.x = clamp(e.x - forward.x*gap, f.radius, GAME_SIZE-f.radius);
          f.y = clamp(e.y - forward.y*gap, f.radius, GAME_SIZE-f.radius);
          f.setDir(forward.x, forward.y);
          e.applyStatus('slow', .12, {mult:.3, source:f});
          f.data.latchTick += dt;
          while (f.data.latchTick >= .5) {
            f.data.latchTick -= .5;
            e.takeDamage(scaledByMirror(f,1.5), f, 'vampire-latch-drain');
            f.heal(1.5, true);
          }
          if (f.data.latchTimer <= 0) f.data.latchCd = 1.4;
        } else {
          f.data.latchCd = Math.max(0,(f.data.latchCd||0)-abilityDt(f,dt));
        }
        if(f.isRage && f.data.bloodLinkLevel>0){
          f.data.linkTick=(f.data.linkTick||0)+dt;
          while(f.data.linkTick>=.5){ f.data.linkTick-=.5; const d=.25*f.data.bloodLinkLevel; e.takeDamage(d,f,'permanent-blood-link',true); f.heal(d,true); }
        }
      };
      vampire.draw = function(c,f){
        const latched = f.data.latchTimer > 0;
        if (latched) c.scale(.88,.88);
        drawSketchBlob(c,f.radius,'#4a0710',14);
        c.fillStyle='#fff7ee';
        c.beginPath(); c.moveTo(42,-26); c.lineTo(116,-10); c.lineTo(46,4); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(42,26); c.lineTo(116,10); c.lineTo(46,-4); c.closePath(); c.fill();
        c.strokeStyle='#180205'; c.lineWidth=3;
        c.beginPath(); c.moveTo(42,-26); c.lineTo(116,-10); c.moveTo(42,26); c.lineTo(116,10); c.stroke();
        if (latched) {
          c.fillStyle='#ffb2a8'; c.font='900 14px monospace'; c.textAlign='center';
          c.fillText(`DRAIN ${f.data.latchTimer.toFixed(1)}s`,0,-f.radius-20);
        }
        if ((f.data.bloodLinkLevel||0)>0) {
          c.fillStyle='#ff6b78'; c.font='900 12px monospace'; c.textAlign='center';
          c.fillText(`BLOOD LINK ${f.data.bloodLinkLevel}`,0,f.radius+25);
        }
      };
    }
    const oldHandleCollisions3 = handleCollisions;
    handleCollisions = function(dt){
      const a=fighters[0], b=fighters[1];
      const aNinjaProtected = a && a.name==='NINJA' && a.data && (a.data.ninjaImmuneUntil||0)>matchClock;
      const bNinjaProtected = b && b.name==='NINJA' && b.data && (b.data.ninjaImmuneUntil||0)>matchClock;
      if (aNinjaProtected || bNinjaProtected) return;
      if (a&&b&&((a.name==='VAMPIRE'&&a.data?.latchTimer>0&&a.data?.latchTarget===b.id)||(b.name==='VAMPIRE'&&b.data?.latchTimer>0&&b.data?.latchTarget===a.id))) return;
      return oldHandleCollisions3(dt);
    };

    const oldSpawnGraph3 = spawnMathV2Graph;
    spawnMathV2Graph = function(owner, formula, kindOrFn){
      oldSpawnGraph3(owner, formula, kindOrFn);
      const g=[...projectiles].reverse().find(p=>p.type==='math_v2_graph'&&p.owner===owner);
      if (g) {
        g.drawProgress=0; g.energy=5; g.life=Math.min(g.life||3.6,3.8); g.maxLife=g.life;
        projectiles.push({type:'math_v2_grid',owner,x:500,y:500,life:g.life,maxLife:g.life,formula:g.formula||formula,followGraph:g});
      }
    };
    const oldDrawProjectiles3 = drawProjectiles;
    drawProjectiles = function(c){
      c.save(); resetCtx(c);
      try { oldDrawProjectiles3(c); }
      finally { c.restore(); resetCtx(c); }
    };

    const sniper = FT('SNIPER');
    if (sniper) {
      function farNest(f,e){ return f.data.nests.reduce((best,n)=>dist(n.x,n.y,e.x,e.y)>dist(best.x,best.y,e.x,e.y)?n:best,f.data.nests[0]); }
      function canRelocate(f){ f.data.relocWindow=(f.data.relocWindow||[]).filter(t=>matchClock-t<=6); return f.data.relocWindow.length<4; }
      function doRelocate(f,e,bonusAim){
        if (!canRelocate(f)) return false;
        f.data.relocWindow.push(matchClock);
        const n=farNest(f,e); f.x=n.x; f.y=n.y;
        if (bonusAim) { f.data.aim=Math.min(3, (f.data.aim||0)+1); f.data.aimMax=Math.max(f.data.aimMax||3, f.data.aim); }
        note(f.x,f.y-f.radius-78, bonusAim?'AIM +1s':'RELOCATE','#ff8b8b');
        return true;
      }
      sniper.update = function(f,e,dt){
        if (f.isRage) {
          f.data.positionLocked = true;
          const close = e && dist(f.x,f.y,e.x,e.y)<300;
          if (close && (f.data.aim||0)>0) doRelocate(f,e,true);
          if (close && (f.data.reload||0)>0) doRelocate(f,e,false);
          if ((f.data.reload||0)>0) { f.data.reload-=dt; f.data.hiddenReload=true; f.applyStatus('immune',.08,{source:f}); if(f.data.reload<=0){f.data.hiddenReload=false; const n=farNest(f,e); f.x=n.x; f.y=n.y; f.data.aim=3; f.data.aimMax=3;} return; }
          if ((f.data.aim||0)>0) { f.data.hiddenReload=false; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45,knockback:true}); e.takeDamage(scaledByMirror(f,30*ratio),f,'rage-sniper-shot'); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.22,{x:n.x,y:n.y,strength:900}); f.data.reload=3; f.data.aim=0; playFighterSound(f,'skill'); } return; }
          f.data.reload=3; return;
        }
        if ((f.data.aim||0)>0) { f.data.positionLocked=true; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){ const dir=norm(e.x-f.x,e.y-f.y), ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,30*ratio),f,'sniper-shot'); f.setDir(-dir.x,-dir.y); f.data.recoilMove=1.8; f.data.cd=7.8; playFighterSound(f,'skill'); } return; }
        f.data.recoilMove=Math.max(0,(f.data.recoilMove||0)-dt); f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){ const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,.55+1.35*ratio); f.data.aimMax=f.data.aim; }
      };
    }

    // SOLO 1V1 LOCAL removed for the TikTok telemetry build.
    window.goToSoloSelect = function(){ goToMenu(); };
    window.startSoloMode = function(){};

    window.apexCorrectivePatch3='ready';
  })();

  (function correctiveProductionPatch4(){
    const FT = name => FighterTypes.find(f => f.name === name);
    function hardReset(c){
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.shadowBlur = 0;
      c.shadowColor = 'transparent';
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;
      c.filter = 'none';
      c.lineCap = 'butt';
      c.lineJoin = 'miter';
      c.setLineDash([]);
    }

    const kung = FT('KUNGFU') || FT('MONK');
    if (kung) {
      const kungDraw4 = kung.draw;
      kung.draw = function(c, f){
        c.save(); hardReset(c);
        try { kungDraw4 ? kungDraw4(c, f) : drawSketchBlob(c, f.radius, '#3b2417', 14); }
        finally { c.restore(); hardReset(c); }
      };
    }
    // KUNGFU root fix: no opponent/fighter redraw layer. The real issue was a scoped helper ReferenceError in Fighter.draw, fixed in the counter text above.
    const drawBeforeKungfuVisibility = draw;
    draw = function(){ return drawBeforeKungfuVisibility(); };

    const vampire = FT('VAMPIRE');
    if (vampire && vampire.update) {
      const vampireUpdate4 = vampire.update;
      vampire.update = function(f, e, dt){
        const wasLatched = (f.data.latchTimer || 0) > 0;
        vampireUpdate4.call(this, f, e, dt);
        if (wasLatched && (f.data.latchTimer || 0) <= 0) {
          f.data.latchCd = Math.max(f.data.latchCd || 0, 3);
          floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 86, 'BITE CD 3s', '#ffb2a8'));
        }
      };
      const vampireDraw4 = vampire.draw;
      vampire.draw = function(c, f){
        c.save(); hardReset(c);
        try { if (vampireDraw4) vampireDraw4(c, f); }
        finally { c.restore(); hardReset(c); }
        if ((f.data.latchCd || 0) > 0 && (f.data.latchTimer || 0) <= 0) {
          c.save();
          c.fillStyle = '#ffb2a8';
          c.font = '900 12px monospace';
          c.textAlign = 'center';
          c.fillText(`BITE CD ${f.data.latchCd.toFixed(1)}`, 0, -f.radius - 20);
          c.restore();
        }
      };
    }

    const sniper = FT('SNIPER');
    if (sniper) {
      function enemyOfSniper(f){ return fighters.find(q => q && q !== f && q.hp > 0); }
      function farthestNest(f, e){
        if (!f.data.nests || !f.data.nests.length) f.data.nests = [{x:95,y:95},{x:905,y:95},{x:95,y:905},{x:905,y:905}];
        return f.data.nests.reduce((best, n) => dist(n.x,n.y,e.x,e.y) > dist(best.x,best.y,e.x,e.y) ? n : best, f.data.nests[0]);
      }
      const priorSniperRage4 = sniper.onRage;
      sniper.onRage = function(f){
        if (priorSniperRage4) priorSniperRage4(f);
        const e = enemyOfSniper(f);
        if (!e) return;
        const n = farthestNest(f, e);
        f.x = n.x;
        f.y = n.y;
        f.data.reload = 0;
        f.data.hiddenReload = false;
        f.data.aim = 3;
        f.data.aimMax = 3;
        f.data.relocWindow = [matchClock];
        f.data.positionLocked = true;
        f.setDir(e.x - f.x, e.y - f.y);
        floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 86, 'RAGE NEST', '#ff8b8b'));
      };
    }
    window.apexCorrectivePatch4 = 'ready';
  })();

  (function correctiveProductionPatch5(){
    const FT = name => FighterTypes.find(f => f.name === name);
    window.DEBUG_VAMPIRE_BITE = false;
    window.apexDrawErrors = window.apexDrawErrors || [];
    window.__sniperReticleDrawCount = 0;

    function resetCanvasForPatch5(c){
      if (!c) return;
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.shadowBlur = 0;
      c.shadowColor = 'transparent';
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;
      c.filter = 'none';
      c.lineCap = 'butt';
      c.lineJoin = 'miter';
      c.textAlign = 'start';
      c.textBaseline = 'alphabetic';
      c.setLineDash([]);
    }
    window.withCanvasState = function(c, fn){
      c.save();
      try { return fn(); }
      catch (err) {
        window.apexDrawErrors.push({message: err && err.message, stack: err && err.stack, t: Date.now()});
      } finally {
        c.restore();
        resetCanvasForPatch5(c);
      }
    };
    const withCanvasState = window.withCanvasState;

    function livingEnemyOf(f){
      return fighters.find(q => q && q !== f && q.hp > 0) || null;
    }
    function targetFor(f, id){
      return fighters.find(q => q && q.hp > 0 && q.id === id) || livingEnemyOf(f);
    }
    function vampireForward(f){
      const d = f.dir && (Math.abs(f.dir.x) + Math.abs(f.dir.y) > 0.01) ? f.dir : (f.data.lastMoveDir || {x:1,y:0});
      const n = norm(d.x, d.y);
      if (Math.abs(n.x) + Math.abs(n.y) > 0.01) f.data.lastMoveDir = {x:n.x, y:n.y};
      return n;
    }
    window.isVampireFrontBite = function(f, e){
      if (!f || !e) return false;
      const forward = vampireForward(f);
      const dx = e.x - f.x, dy = e.y - f.y;
      const centerDist = Math.max(0.001, Math.hypot(dx, dy));
      const overlap = centerDist <= f.radius + e.radius + 8;
      const dotFront = (forward.x * dx + forward.y * dy) / centerDist;
      const fangX = f.x + forward.x * f.radius * 0.92;
      const fangY = f.y + forward.y * f.radius * 0.92;
      const fangBodyGap = Math.max(0, Math.hypot(e.x - fangX, e.y - fangY) - e.radius);
      const ok = overlap && dotFront > 0.15 && fangBodyGap < 28;
      f.data.debugFang = {x:fangX, y:fangY, ok, dot:dotFront, gap:fangBodyGap};
      return ok;
    };

    const vampire = FT('VAMPIRE');
    if (vampire) {
      vampire.update = function(f, e, dt){
        if ((f.data.latchTimer || 0) <= 0 && f.dir) {
          const d = norm(f.dir.x, f.dir.y);
          if (Math.abs(d.x) + Math.abs(d.y) > 0.01) f.data.lastMoveDir = {x:d.x, y:d.y};
        }
        if ((f.data.latchTimer || 0) > 0) {
          const target = targetFor(f, f.data.latchTarget);
          if (!target) { f.data.latchTimer = 0; f.data.biteCd = f.data.latchCd = 3; return; }
          f.data.positionLocked = true;
          f.data.latchTimer = Math.max(0, f.data.latchTimer - dt);
          const away = norm(f.x - target.x, f.y - target.y);
          const gap = Math.max(4, target.radius + f.radius * 0.24);
          f.x = clamp(target.x + away.x * gap, f.radius, GAME_SIZE - f.radius);
          f.y = clamp(target.y + away.y * gap, f.radius, GAME_SIZE - f.radius);
          f.setDir(target.x - f.x, target.y - f.y);
          f.data.lastMoveDir = {x:f.dir.x, y:f.dir.y};
          target.applyStatus('slow', 0.18, {mult:.3, source:f});
          f.data.latchPulse = (f.data.latchPulse || 0) + dt;
          while (f.data.latchPulse >= .5) {
            f.data.latchPulse -= .5;
            const d = scaledByMirror(f, 1.5);
            target.takeDamage(d, f, 'vampire-latch-drain');
            f.heal(d, true);
            floatingTexts.push(new FloatingText(target.x, target.y - target.radius - 74, `DRAIN ${d.toFixed(1)}`, '#ff4a62'));
          }
          if (f.data.latchTimer <= 0) {
            f.data.biteCd = 3;
            f.data.latchCd = 3;
            floatingTexts.push(new FloatingText(f.x, f.y - f.radius - 86, 'BITE CD 3s', '#ffb2a8'));
          }
        } else {
          f.data.biteCd = Math.max(0, (f.data.biteCd || f.data.latchCd || 0) - abilityDt(f, dt));
          f.data.latchCd = f.data.biteCd;
        }
        const linkTarget = targetFor(f, f.data.bloodLinkTargetId);
        if (f.isRage && (f.data.bloodLinkLevel || 0) > 0 && linkTarget) {
          f.data.bloodLinkTargetId = linkTarget.id;
          f.data.linkTick = (f.data.linkTick || 0) + dt;
          while (f.data.linkTick >= .5) {
            f.data.linkTick -= .5;
            const d = scaledByMirror(f, 0.25 * f.data.bloodLinkLevel);
            linkTarget.takeDamage(d, f, 'permanent-blood-link', true);
            f.heal(d, true);
          }
        }
      };
      vampire.onCollide = function(f, e){
        if ((f.data.latchTimer || 0) > 0) return true;
        f.data.biteCd = Math.max(f.data.biteCd || 0, f.data.latchCd || 0);
        f.data.latchCd = f.data.biteCd;
        if (f.data.biteCd > 0) return false;
        if (!window.isVampireFrontBite(f, e)) return false;
        f.data.latchTimer = f.type?.arsenalShell ? 2.5 : 5; /* Arsenal A-CORR-3 ADAPT */
        f.data.latchPulse = 0;
        f.data.latchTarget = e.id;
        f.data.latchTargetId = e.id;
        f.data.biteCd = 0;
        f.data.latchCd = 0;
        const away = norm(f.x - e.x, f.y - e.y);
        f.data.latchOffset = {x:away.x, y:away.y};
        floatingTexts.push(new FloatingText(e.x, e.y - e.radius - 82, 'FANG LOCK', '#ff4a62'));
        if (f.isRage) {
          f.data.bloodLinkLevel = (f.data.bloodLinkLevel || 0) + 1;
          f.data.bloodLinkTargetId = e.id;
          floatingTexts.push(new FloatingText(e.x, e.y - e.radius - 108, `BLOOD LINK ${f.data.bloodLinkLevel}`, '#ff2038'));
        }
        playFighterSound(f, 'skill');
        return true;
      };
      vampire.draw = function(c, f){
        const latched = (f.data.latchTimer || 0) > 0;
        drawSketchBlob(c, f.radius, '#4a0710', 14);
        c.fillStyle = '#fff7ee';
        c.beginPath(); c.moveTo(42,-26); c.lineTo(116,-10); c.lineTo(46,4); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(42,26); c.lineTo(116,10); c.lineTo(46,-4); c.closePath(); c.fill();
        c.strokeStyle = '#180205'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(42,-26); c.lineTo(116,-10); c.moveTo(42,26); c.lineTo(116,10); c.stroke();
        if (latched) {
          c.strokeStyle = 'rgba(255,42,62,.55)';
          c.lineWidth = 4;
          c.beginPath();
          c.arc(58, 0, 24 + 6 * Math.sin(Date.now()/90), -.8, .8);
          c.stroke();
          c.fillStyle = '#ffb2a8'; c.font = '900 14px monospace'; c.textAlign = 'center';
          c.fillText(`DRAIN ${f.data.latchTimer.toFixed(1)}s`, 0, -f.radius - 20);
        } else if ((f.data.biteCd || 0) > 0) {
          c.fillStyle = '#ffb2a8'; c.font = '900 12px monospace'; c.textAlign = 'center';
          c.fillText(`BITE CD ${f.data.biteCd.toFixed(1)}`, 0, -f.radius - 20);
        }
        if ((f.data.bloodLinkLevel || 0) > 0) {
          c.fillStyle = '#ff6b78'; c.font = '900 12px monospace'; c.textAlign = 'center';
          c.fillText(`BLOOD LINK ${f.data.bloodLinkLevel}`, 0, f.radius + 25);
        }
      };
    }

    function drawVampireBloodLinks(c){
      for (const f of fighters) {
        if (!f || f.name !== 'VAMPIRE' || !f.isRage || !(f.data.bloodLinkLevel > 0)) continue;
        const t = targetFor(f, f.data.bloodLinkTargetId);
        if (!t) continue;
        withCanvasState(c, () => {
          const level = f.data.bloodLinkLevel || 1;
          const pulse = .62 + .24 * Math.sin(Date.now()/115);
          c.globalAlpha = pulse;
          c.strokeStyle = '#ff2038';
          c.lineWidth = Math.min(12, 3 + level * 1.5);
          c.lineCap = 'round';
          c.beginPath();
          const mx = (f.x + t.x) / 2 + Math.sin(Date.now()/240) * 32;
          const my = (f.y + t.y) / 2 - 42;
          c.moveTo(f.x, f.y);
          c.quadraticCurveTo(mx, my, t.x, t.y);
          c.stroke();
          c.globalAlpha = 1;
          c.fillStyle = '#ff2038';
          c.font = '900 13px monospace';
          c.textAlign = 'center';
          c.fillText(`BLOOD LINK ${level}`, mx, my - 10);
        });
      }
    }

    const kung = FT('KUNGFU') || FT('MONK');
    if (kung) {
      const kungDraw5 = kung.draw;
      kung.draw = function(c, f){ withCanvasState(c, () => kungDraw5 ? kungDraw5(c, f) : drawSketchBlob(c, f.radius, '#3b2417', 14)); };
    }
    function drawImportantNonKungfuProjectiles(c){
      const important = /painter|ice_lane|ice_dart|blade_wave|red_slash|toxic|card_throw|math_formula|math_v2|sniper_laser|witch|pirate|superfan|slime_child|virus_minion|web_line|meteor|fire_pit/;
      for (const p of projectiles) {
        if (!p || !important.test(String(p.type || '')) || (p.owner && p.owner.name === 'KUNGFU')) continue;
        withCanvasState(c, () => {
          const a = clamp((p.life || 1) / (p.maxLife || p.life || 1), 0, 1);
          c.globalAlpha = Math.max(.45, a);
          if (p.type === 'painter_stroke') { c.strokeStyle = p.color || '#ffd447'; c.lineWidth = Math.max(18, (p.width||55)); c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
          else if (p.type === 'ice_lane') { c.strokeStyle = '#eaffff'; c.lineWidth = Math.max(8, (p.halfWidth||18)); c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
          else if (p.type === 'blade_wave') { c.translate(p.x,p.y); c.rotate(Math.atan2(p.vy||0,p.vx||1)); c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.beginPath(); c.arc(-p.length*.3,0,(p.halfWidth||55)*.75,-.7,.7); c.stroke(); }
          else if (p.type === 'toxic_trail' || p.type === 'toxic_puddle') { c.fillStyle = 'rgba(141,255,38,.42)'; c.beginPath(); c.arc(p.x,p.y,p.radius||30,0,TAU); c.fill(); }
          else if (p.type === 'card_throw') { c.fillStyle = '#ffe8a0'; c.strokeStyle = '#130a04'; c.lineWidth = 4; c.fillRect(p.x-32,p.y-44,64,88); c.strokeRect(p.x-32,p.y-44,64,88); c.fillStyle = '#130a04'; c.font = '900 18px serif'; c.textAlign = 'center'; c.fillText('CARD',p.x,p.y+5); }
          else if (p.type === 'sniper_laser') { c.strokeStyle = '#ff3030'; c.lineWidth = 3; c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
        });
      }
    }

    function nearestLivingEnemy(f){
      let best = null, bd = Infinity;
      for (const q of fighters) if (q && q !== f && q.hp > 0) {
        const d = dist(f.x,f.y,q.x,q.y);
        if (d < bd) { bd = d; best = q; }
      }
      return best;
    }
    window.drawSniperAimOverlay = function(c){
      for (const s of fighters) {
        if (!s || s.name !== 'SNIPER' || s.hp <= 0 || !(s.data.aim > 0)) continue;
        const target = targetFor(s, s.data.targetId) || nearestLivingEnemy(s);
        if (!target) continue;
        window.__sniperReticleDrawCount++;
        withCanvasState(c, () => {
          const pulse = .65 + .25 * Math.sin(Date.now()/95);
          c.globalAlpha = pulse;
          c.strokeStyle = '#ff3030';
          c.lineWidth = 2;
          c.beginPath(); c.moveTo(s.x,s.y); c.lineTo(target.x,target.y); c.stroke();
          c.translate(target.x, target.y);
          c.rotate(Date.now()/900);
          c.globalAlpha = .92;
          c.strokeStyle = '#ff3030';
          c.fillStyle = '#ff3030';
          c.lineWidth = 4;
          for (const r of [target.radius + 14, target.radius + 28, target.radius + 42]) {
            c.beginPath(); c.arc(0,0,r,0,TAU); c.stroke();
          }
          const outer = target.radius + 52, inner = target.radius + 28;
          for (let i=0;i<4;i++) {
            const a = i * Math.PI / 2;
            c.beginPath();
            c.moveTo(Math.cos(a)*inner, Math.sin(a)*inner);
            c.lineTo(Math.cos(a)*outer, Math.sin(a)*outer);
            c.stroke();
          }
          c.beginPath(); c.arc(0,0,5,0,TAU); c.fill();
        });
      }
    };

    const drawProjectilesBeforePatch5 = drawProjectiles;
    drawProjectiles = function(c){
      withCanvasState(c, () => {
        try { drawProjectilesBeforePatch5(c); }
        catch (err) { window.apexDrawErrors.push({message: err && err.message, stack: err && err.stack, phase:'drawProjectiles', t:Date.now()}); }
      });
      // KUNGFU root fix: do not redraw opponent projectiles; original drawProjectiles now remains authoritative.
    };

    const drawBeforePatch5 = draw;
    draw = function(){
      drawBeforePatch5();
      if (gameState !== 'PLAYING') return;
      ctx.save();
      resetCanvasForPatch5(ctx);
      ctx.translate(GAME_SIZE/2 + rand(-cameraShake,cameraShake), GAME_SIZE/2 + rand(-cameraShake,cameraShake));
      ctx.scale(cameraZoom, cameraZoom);
      ctx.translate(-GAME_SIZE/2, -GAME_SIZE/2);
      drawVampireBloodLinks(ctx);
      window.drawSniperAimOverlay(ctx);
      ctx.restore();
      resetCanvasForPatch5(ctx);
    };

    window.testVampireBiteGeometry = function(){
      const f = {x:100,y:100,radius:50,dir:{x:1,y:0},data:{}};
      const enemy = (x,y,r=50)=>({x,y,radius:r});
      const cases = {
        front: window.isVampireFrontBite(f, enemy(185,100)),
        headFirst: window.isVampireFrontBite(f, enemy(178,104)),
        rear: window.isVampireFrontBite(f, enemy(15,100)),
        sideUp: window.isVampireFrontBite(f, enemy(100,185)),
        sideDown: window.isVampireFrontBite(f, enemy(100,15)),
        diagonalFront: window.isVampireFrontBite(f, enemy(168,132))
      };
      return {pass: cases.front && cases.headFirst && !cases.rear && !cases.sideUp && !cases.sideDown && cases.diagonalFront, cases};
    };
    window.testVampireCooldownAndBloodLink = function(){
      const type = FT('VAMPIRE');
      const f = new Fighter(1,100,100,type), e = new Fighter(2,185,100,FT('BLADE'));
      fighters = [f, e];
      f.dir = {x:1,y:0}; f.data.lastMoveDir = {x:1,y:0}; f.data.biteCd = 0; f.data.latchCd = 0; f.isRage = false;
      const normalBite = type.onCollide(f,e);
      const normalLevel = f.data.bloodLinkLevel || 0;
      type.update(f,e,1);
      const cdDuringLatch = f.data.biteCd || 0;
      type.update(f,e,4.1);
      const cdAfterRelease = f.data.biteCd || 0;
      const blockedDuringCd = type.onCollide(f,e) === false;
      f.data.latchTimer = 0; f.data.biteCd = 0; f.data.latchCd = 0; f.isRage = true;
      const rageBite = type.onCollide(f,e);
      const rageLevel = f.data.bloodLinkLevel || 0;
      return {
        pass: !!normalBite && normalLevel === 0 && cdDuringLatch === 0 && cdAfterRelease > 2.9 && blockedDuringCd && !!rageBite && rageLevel === 1 && f.data.bloodLinkTargetId === e.id,
        normalBite, normalLevel, cdDuringLatch, cdAfterRelease, blockedDuringCd, rageBite, rageLevel
      };
    };
    window.testKungfuVisualIntegrity = function(){
      const before = window.apexDrawErrors.length;
      const k = new Fighter(1,300,500,FT('KUNGFU'));
      const p = new Fighter(2,700,500,FT('PAINTER'));
      fighters = [k,p];
      gameState = 'PLAYING';
      projectiles.push({type:'kungfu_palm',owner:k,x:450,y:500,vx:1,vy:0,life:1,maxLife:1});
      projectiles.push({type:'painter_stroke',owner:p,x1:620,y1:450,x2:820,y2:560,width:75,color:'#ffd447',life:2,maxLife:2});
      for (let i=0;i<3;i++) draw();
      const painterStillThere = projectiles.some(q => q.type === 'painter_stroke');
      return {pass: window.apexDrawErrors.length === before && painterStillThere && ctx.globalAlpha === 1 && ctx.globalCompositeOperation === 'source-over', drawErrors: window.apexDrawErrors.length - before, painterStillThere};
    };
    window.testSniperReticle = function(){
      const s = new Fighter(1,100,100,FT('SNIPER'));
      const e = new Fighter(2,500,500,FT('BLADE'));
      fighters = [s,e]; gameState = 'PLAYING'; s.data.aim = 2; s.data.aimMax = 3; s.data.targetId = e.id;
      window.__sniperReticleDrawCount = 0;
      draw();
      const drew = window.__sniperReticleDrawCount > 0;
      s.data.aim = 0; window.__sniperReticleDrawCount = 0; draw();
      return {pass: drew && window.__sniperReticleDrawCount === 0, drew, countAfterNoAim: window.__sniperReticleDrawCount};
    };
    window.apexCorrectivePatch5 = 'ready';
  })();

  (function correctiveProductionPatch6(){
    const FT = name => FighterTypes.find(f => f.name === name);
    window.__kungfuSkillDrawCount = 0;
    window.__opponentSkillRedrawCount = 0;

    function resetCtx6(c){
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.shadowBlur = 0; c.shadowColor = 'transparent'; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
      c.filter = 'none'; c.lineCap = 'butt'; c.lineJoin = 'miter'; c.textAlign = 'start'; c.textBaseline = 'alphabetic'; c.setLineDash([]);
    }
    function safeDraw6(c, fn){
      c.save();
      try { fn(); }
      catch(err){ (window.apexDrawErrors ||= []).push({phase:'patch6', message:err && err.message, stack:err && err.stack, t:Date.now()}); }
      finally { c.restore(); resetCtx6(c); }
    }

    function vampForward6(f, normal){
      const d = f.data?.lastMoveDir || (normal && {x:normal.x, y:normal.y}) || f.dir || {x:1,y:0};
      const n = norm(d.x, d.y);
      if (Math.abs(n.x) + Math.abs(n.y) > .01) f.data.lastMoveDir = {x:n.x,y:n.y};
      return n;
    }
    window.isVampireFrontBite = function(f, e, collisionNormal){
      if (!f || !e) return false;
      const forward = vampForward6(f, collisionNormal);
      const dx = e.x - f.x, dy = e.y - f.y;
      const d = Math.max(.001, Math.hypot(dx,dy));
      const frontDot = (forward.x*dx + forward.y*dy) / d;
      const actualContact = d <= f.radius + e.radius + 18;
      const fangX = f.x + forward.x * f.radius * .92;
      const fangY = f.y + forward.y * f.radius * .92;
      const fangGap = Math.max(0, Math.hypot(e.x-fangX, e.y-fangY) - e.radius);
      const frontHemisphere = frontDot > 0.12;
      const broadNose = fangGap < 48 || (frontDot > .35 && actualContact);
      const ok = actualContact && frontHemisphere && broadNose;
      f.data.debugFang = {x:fangX,y:fangY,ok,dot:frontDot,gap:fangGap};
      return ok;
    };

    const vampire = FT('VAMPIRE');
    if (vampire) {
      vampire.onCollide = function(f,e,dt,normal){
        if ((f.data.latchTimer||0) > 0) return true;
        f.data.biteCd = Math.max(f.data.biteCd||0, f.data.latchCd||0);
        f.data.latchCd = f.data.biteCd;
        if (f.data.biteCd > 0) return false;
        const biteNormal = normal ? {x:normal.x, y:normal.y} : null;
        if (!window.isVampireFrontBite(f,e,biteNormal)) return false;
        f.data.latchTimer = f.type?.arsenalShell ? 2.5 : 5; /* Arsenal A-CORR-3 ADAPT */
        f.data.latchPulse = 0;
        f.data.latchTarget = e.id;
        f.data.latchTargetId = e.id;
        f.data.biteCd = 0;
        f.data.latchCd = 0;
        const away = norm(f.x-e.x, f.y-e.y);
        f.data.latchOffset = {x:away.x,y:away.y};
        floatingTexts.push(new FloatingText(e.x,e.y-e.radius-82,'FANG LOCK','#ff4a62'));
        if (f.isRage) {
          f.data.bloodLinkLevel = (f.data.bloodLinkLevel||0) + 1;
          f.data.bloodLinkTargetId = e.id;
          floatingTexts.push(new FloatingText(e.x,e.y-e.radius-108,`BLOOD LINK ${f.data.bloodLinkLevel}`,'#ff2038'));
        }
        playFighterSound(f,'skill');
        return true;
      };
    }

    function drawKungfuSkillLayer6(c){
      for (const p of projectiles) {
        if (!p || !p.type || !String(p.type).startsWith('kungfu_')) continue;
        safeDraw6(c, () => {
          const a = clamp((p.life||1)/(p.maxLife||p.life||1),0,1);
          if (p.type === 'kungfu_palm') {
            window.__kungfuSkillDrawCount++;
            c.globalAlpha = .18 + .20*a;
            c.fillStyle = 'rgba(255,210,138,.25)';
            c.strokeStyle = 'rgba(255,210,138,.72)';
            c.lineWidth = 6;
            c.translate(p.x,p.y);
            c.rotate(Math.atan2(p.vy||0,p.vx||1));
            c.beginPath(); c.ellipse(0,0,235,132,0,0,TAU); c.fill(); c.stroke();
            c.globalAlpha = .75*a;
            c.fillStyle = '#ffe0a0'; c.font = '900 40px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText('Ă¦ÂÅ’',0,0);
          } else if (p.type === 'kungfu_qi') {
            window.__kungfuSkillDrawCount++;
            c.globalAlpha = .85*a;
            c.strokeStyle = '#ffffff';
            c.lineWidth = 5;
            c.beginPath(); c.arc(p.x,p.y,16 + (1-a)*56,0,TAU); c.stroke();
            c.strokeStyle = '#ffd28a'; c.lineWidth = 2; c.beginPath(); c.arc(p.x,p.y,8 + (1-a)*32,0,TAU); c.stroke();
          } else if (p.type === 'kungfu_rage_seal') {
            window.__kungfuSkillDrawCount++;
            c.globalAlpha = .9*a;
            c.strokeStyle = '#ff9b50'; c.lineWidth = 7;
            c.beginPath(); c.arc(p.x,p.y,74,0,TAU); c.stroke();
            c.fillStyle = '#ffdda8'; c.font = '900 34px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Ă¥Â°Â',p.x,p.y);
          }
        });
      }
    }
    function drawOpponentSkillLayer6(c){
      if (!fighters.some(f => f && f.hp > 0 && f.name === 'KUNGFU')) return;
      for (const p of projectiles) {
        if (!p || (p.owner && p.owner.name === 'KUNGFU')) continue;
        const type = String(p.type||'');
        if (!/(painter|ice_lane|ice_dart|blade_wave|red_slash|toxic|card_throw|math_formula|math_v2|sniper_laser|witch|pirate|superfan|slime_child|virus_minion|web_line|meteor|fire_pit)/.test(type)) continue;
        safeDraw6(c, () => {
          const a = clamp((p.life||1)/(p.maxLife||p.life||1),0,1);
          c.globalAlpha = Math.max(.62,a);
          window.__opponentSkillRedrawCount++;
          if (type === 'painter_stroke') { c.strokeStyle=p.color||'#ffd447'; c.lineWidth=Math.max(26,p.width||60); c.lineCap='round'; c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
          else if (type === 'ice_lane') { c.strokeStyle='#eaffff'; c.lineWidth=Math.max(12,(p.halfWidth||18)*1.15); c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
          else if (type === 'blade_wave') { c.translate(p.x,p.y); c.rotate(Math.atan2(p.vy||0,p.vx||1)); c.strokeStyle='#f4fbff'; c.lineWidth=9; c.beginPath(); c.arc(-(p.length||120)*.3,0,(p.halfWidth||55)*.78,-.72,.72); c.stroke(); }
          else if (type === 'red_slash') { c.translate(p.x,p.y); c.rotate(p.angle||0); c.strokeStyle='#ff2020'; c.lineWidth=14; c.beginPath(); c.moveTo(-95,-75); c.lineTo(95,75); c.stroke(); }
          else if (type === 'toxic_trail' || type === 'toxic_puddle') { c.fillStyle='rgba(141,255,38,.50)'; c.beginPath(); c.arc(p.x,p.y,p.radius||30,0,TAU); c.fill(); }
          else if (type === 'card_throw') { c.fillStyle='#ffe8a0'; c.strokeStyle='#130a04'; c.lineWidth=4; c.fillRect(p.x-34,p.y-46,68,92); c.strokeRect(p.x-34,p.y-46,68,92); c.fillStyle='#130a04'; c.font='900 18px serif'; c.textAlign='center'; c.fillText('CARD',p.x,p.y+6); }
          else if (type === 'sniper_laser') { c.strokeStyle='#ff3030'; c.lineWidth=3; c.beginPath(); c.moveTo(p.x1,p.y1); c.lineTo(p.x2,p.y2); c.stroke(); }
        });
      }
    }

    // KUNGFU root fix: no post-draw skill/opponent redraw layer. KUNGFU visual projectiles are drawn once in core drawProjectiles.
    const drawBeforePatch6 = draw;
    draw = function(){ return drawBeforePatch6(); };

    window.testVampireBiteGeometry = function(){
      const f={x:100,y:100,radius:50,dir:{x:-1,y:0},data:{lastMoveDir:{x:1,y:0}}};
      const enemy=(x,y,r=50)=>({x,y,radius:r});
      const cases={
        front:window.isVampireFrontBite(f,enemy(185,100),{x:1,y:0}),
        headFirst:window.isVampireFrontBite(f,enemy(178,104),{x:1,y:0}),
        rear:window.isVampireFrontBite(f,enemy(15,100),{x:-1,y:0}),
        sideUp:window.isVampireFrontBite(f,enemy(100,185),{x:0,y:1}),
        sideDown:window.isVampireFrontBite(f,enemy(100,15),{x:0,y:-1}),
        diagonalFront:window.isVampireFrontBite(f,enemy(168,132),{x:.9,y:.42})
      };
      return {pass:cases.front&&cases.headFirst&&!cases.rear&&!cases.sideUp&&!cases.sideDown&&cases.diagonalFront,cases};
    };
    window.testKungfuVisualIntegrity = function(){
      const before=(window.apexDrawErrors||[]).length;
      window.__kungfuCoreProjectileDrawCount=0; window.__opponentSkillRedrawCount=0;
      const k=new Fighter(1,300,500,FT('KUNGFU')), p=new Fighter(2,700,500,FT('PAINTER'));
      fighters=[k,p]; gameState='PLAYING';
      projectiles.push({type:'kungfu_palm',owner:k,x:450,y:500,vx:1,vy:0,life:1,maxLife:1});
      projectiles.push({type:'kungfu_qi',owner:k,x:520,y:500,life:.6,maxLife:.6});
      projectiles.push({type:'painter_stroke',owner:p,x1:620,y1:450,x2:820,y2:560,width:75,color:'#ffd447',life:2,maxLife:2});
      draw();
      return {pass:(window.apexDrawErrors||[]).length===before && window.__kungfuCoreProjectileDrawCount>0 && window.__opponentSkillRedrawCount===0, drawErrors:(window.apexDrawErrors||[]).length-before, kungfuCoreDraws:window.__kungfuCoreProjectileDrawCount, opponentRedraws:window.__opponentSkillRedrawCount};
    };
    window.apexCorrectivePatch6 = 'ready';
    window.apexKungfuRootFix = 'enemyOf2-scope-fixed-core-projectile-draw-no-redraw';
  })();

  (function sniperSpriteVisualPatch(){
    const sniper = FighterTypes.find(f => f && f.name === 'SNIPER');
    if (!sniper) return;
    const fallbackDraw = sniper.draw;
    const aimSprite = new Image();
    aimSprite.src = '/sniper_cloak_sprite.webp';
    const moveSprite = new Image();
    moveSprite.src = '/sniper_cloak_move_sprite.webp';
    sniper.draw = function(c, f){
      const crouch = f.isRage && (f.data.aim || 0) <= 0;
      const isAiming = (f.data.aim || 0) > 0;
      const sprite = isAiming ? aimSprite : moveSprite;
      c.save();
      if (sprite.complete && sprite.naturalWidth > 0) {
        if (crouch) {
          c.translate(0, 18);
          c.scale(.9, .62);
          c.globalAlpha = .78;
        }
        const w = f.radius * (isAiming ? 4.55 : 3.5);
        const h = w * (sprite.naturalHeight / sprite.naturalWidth);
        c.shadowColor = 'rgba(0,0,0,.55)';
        c.shadowBlur = 12;
        c.drawImage(sprite, isAiming ? -f.radius * 1.9 : -f.radius * 1.85, -h * .5, w, h);
        c.shadowBlur = 0;
      } else if (fallbackDraw) {
        fallbackDraw(c, f);
      }
      c.restore();

      if (isAiming) {
        const t = 1 - f.data.aim / Math.max(.1, f.data.aimMax || 1);
        c.strokeStyle = 'rgba(255,90,90,.9)';
        c.lineWidth = 5;
        c.beginPath();
        c.arc(0, 0, f.radius + 22 + 18 * t, 0, TAU);
        c.stroke();
        c.fillStyle = '#ffb0b0';
        c.font = '900 14px monospace';
        c.textAlign = 'center';
        c.fillText('AIM ' + Math.round(t * 100) + '%', 0, -f.radius - 22);
        c.fillText('AIM ' + Math.max(0, f.data.aim).toFixed(1) + 's', 0, -f.radius - 40);
      } else if ((f.data.reload || 0) > 0 || f.data.hiddenReload) {
        c.fillStyle = '#ffb0b0';
        c.font = '900 14px monospace';
        c.textAlign = 'center';
        c.fillText('RELOAD ' + Math.max(0, f.data.reload || 0).toFixed(1) + 's', 0, -f.radius - 40);
      } else if (crouch) {
        c.fillStyle = '#b8bcc2';
        c.font = '900 13px monospace';
        c.textAlign = 'center';
        c.fillText('HIDDEN', 0, -f.radius - 18);
      }
    };
    window.apexSniperSpriteVisualPatch = {
      aim: '/sniper_cloak_sprite.webp',
      move: '/sniper_cloak_move_sprite.webp'
    };
  })();

  console.info('[Apex Final] canonical identity + balance merge loaded', FighterTypes.map(f=>f.name));
  } catch (err) {
    window.apexFinalBootError = { message: err && err.message, stack: err && err.stack };
    console.error('[Apex Final] boot patch failed', err);
  }
})();
