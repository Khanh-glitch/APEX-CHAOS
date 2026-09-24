// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function apexNewRosterChefMaskArcadeNinjaPatch(){
  try {
    const removedNames = new Set(['MAGNET','MATH_V2','HUNTER','PAINTER','WITCH']);
    // V2 Checkpoint A: stash the canonical bodies the normal roster trims so the
    // Arsenal shell select can reuse their real draw identity (normal play unchanged).
    const removedStore = window.__APEX_REMOVED_FIGHTER_TYPES || (window.__APEX_REMOVED_FIGHTER_TYPES = {});
    for (let i = FighterTypes.length - 1; i >= 0; i--) {
      if (removedNames.has(FighterTypes[i].name)) {
        removedStore[FighterTypes[i].name] = FighterTypes[i];
        FighterTypes.splice(i, 1);
      }
    }
    const FTNew = name => FighterTypes.find(f => f && f.name === name);
    const enemyOfNew = owner => fighters.find(f => f && owner && f.id !== owner.id && f.hp > 0) || fighters.find(f => f && f !== owner && f.hp > 0) || null;
    const sayNew = (x,y,t,c) => floatingTexts.push(new FloatingText(x,y,t,c));
    const pushCustom = p => { p.apexCustom = true; if (p.life === undefined) p.life = Infinity; if (p.customLife === undefined) p.customLife = 3; if (p.maxCustomLife === undefined) p.maxCustomLife = p.customLife; projectiles.push(p); return p; };
    const killCustom = p => { p._dead = true; };
    const customAlpha = p => p.customLife === Infinity ? 1 : clamp((p.customLife || 0) / Math.max(.001, p.maxCustomLife || 1), 0, 1);
    Object.assign(SOUND_ID, {
      MUSICIAN:{base:520,wave:'sine',bend:1.5,noise:.03},
      MASTER_CHEF:{base:170,wave:'triangle',bend:1.25,noise:.09},
      MASK:{base:410,wave:'sawtooth',bend:.78,noise:.04},
      ARCADE:{base:740,wave:'square',bend:1.18,noise:.035},
      NINJA:{base:880,wave:'triangle',bend:1.9,noise:.045}
    });

    const oldGlyph = typeof fighterGlyph === 'function' ? fighterGlyph : (name => 'Ă¢â€”â€ ');
    fighterGlyph = function(name){
      const map = { MUSICIAN:'Ă¢â„¢Â«', MASTER_CHEF:'Ă¢â„¢Â¨', MASK:'Ă¢â€”â€°', ARCADE:'Ă¢â€“Â£', NINJA:'Ă¢Å“Â¦' };
      return map[name] || oldGlyph(name);
    };
    window.fighterGlyph = fighterGlyph;

    // ---------- MUSICIAN ----------
    const MUSIC_NOTES = ['C','D','E','F','G','A','B'];
    const MUSIC_CHORDS = [
      {name:'MAJOR', color:'#ffe889', dmg:4, heal:4, effect:'heal'},
      {name:'MINOR', color:'#9fd4ff', dmg:5, slow:2.4, effect:'slow'},
      {name:'DROP', color:'#ff7acb', dmg:7, stun:.65, effect:'stun'},
      {name:'SOLO', color:'#ffffff', dmg:2, notes:5, effect:'burst'}
    ];
    function musicianFireNote(owner, target, power=1, color='#ffe889'){
      if(!owner || !target) return;
      const n = norm(target.x-owner.x, target.y-owner.y);
      pushCustom({type:'music_note', owner, targetId:target.id, x:owner.x+n.x*70, y:owner.y+n.y*70, vx:n.x*690, vy:n.y*690, radius:15, dmg:1.35*power, color, customLife:3.2, maxCustomLife:3.2, steer:.18});
    }
    function musicianCastChord(owner, target){
      if(!owner || !target) return;
      owner.data.chordIndex = (owner.data.chordIndex || 0) % MUSIC_CHORDS.length;
      const chord = MUSIC_CHORDS[owner.data.chordIndex];
      owner.data.chordName = chord.name;
      owner.data.chordPulse = .85;
      owner.data.chordIndex++;
      const repeats = owner.isRage ? 2 : 1;
      for(let r=0;r<repeats;r++) {
        pushCustom({type:'music_wave', owner, targetId:target.id, x:owner.x, y:owner.y, radius:12, prevRadius:0, maxRadius:owner.isRage?410:330, chord, customLife:1.05+r*.22, maxCustomLife:1.05+r*.22, hitIds:{}, delay:r*.22});
      }
      if(chord.effect==='burst') for(let i=0;i<(owner.isRage?7:5);i++) musicianFireNote(owner, target, owner.isRage?1.35:1, chord.color);
      sayNew(owner.x, owner.y-owner.radius-86, chord.name + ' CHORD', chord.color);
      playFighterSound(owner,'skill');
    }
    const MusicianType = {
      name:'MUSICIAN', color:'#ffd36b', desc:'Tempo beats, note shots, and four-chord stage control', speed:465, startDx:1, startDy:.47,
      init:f=>{ f.data.beatTimer=.35; f.data.beat=0; f.data.chordIndex=0; f.data.chordName='READY'; f.data.chordPulse=0; f.data.noteCd=.4; },
      update:(f,e,dt)=>{
        f.data.chordPulse=Math.max(0,(f.data.chordPulse||0)-dt);
        const beatInterval = f.isRage ? .48 : .68;
        f.data.beatTimer -= abilityDt(f,dt);
        if(f.data.beatTimer<=0){
          f.data.beatTimer += beatInterval;
          f.data.beat = ((f.data.beat||0)+1)%4;
          musicianFireNote(f,e,f.isRage?1.25:1, MUSIC_CHORDS[f.data.chordIndex%MUSIC_CHORDS.length].color);
          if(f.data.beat===0) musicianCastChord(f,e);
        }
      },
      onCollide:(f,e)=>{ if((f.data.bumpCd||0)>matchClock) return; f.data.bumpCd=matchClock+.55; e.takeDamage(f.isRage?3.2:2.2,f,'bass-bump'); e.applyStatus('push',.18,{...norm(e.x-f.x,e.y-f.y),strength:f.isRage?760:560}); sayNew(e.x,e.y-e.radius-54,'BASS BUMP','#ffd36b'); },
      draw:(ctx,f)=>{
        drawPolygon(ctx,[[-48,-56],[28,-64],[68,-12],[32,58],[-52,50],[-70,-6]],'#33210a','#ffd36b',5);
        ctx.strokeStyle='#fff4ba';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-20,-44);ctx.lineTo(78,-82);ctx.stroke();
        ctx.fillStyle='#17100a';ctx.beginPath();ctx.arc(-12,4,28,0,TAU);ctx.fill();ctx.strokeStyle='#ffd36b';ctx.lineWidth=4;ctx.stroke();
        ctx.fillStyle='#fff3bd';ctx.font='900 20px serif';ctx.textAlign='center';ctx.fillText('Ă¢â„¢Â«',-10,12);
        const beat=f.data.beat||0; for(let i=0;i<4;i++){ctx.fillStyle=i===beat?'#ffffff':'rgba(255,255,255,.28)';ctx.beginPath();ctx.arc(-42+i*28,f.radius+20,7,0,TAU);ctx.fill();}
        if(f.data.chordPulse>0){ctx.strokeStyle='rgba(255,232,137,.85)';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,f.radius+26+f.data.chordPulse*28,0,TAU);ctx.stroke();}
        ctx.fillStyle='#fff1ad';ctx.font='900 13px monospace';ctx.fillText(f.data.chordName||'READY',0,-f.radius-18);
      }
    };

    // ---------- MASTER CHEF ----------
    const CHEF_INGREDIENTS = ['EGG','BEEF','CHICKEN','FISH','SHRIMP','RICE','NOODLE','MUSHROOM','TOMATO','CHEESE','POTATO','CARROT','ONION','BROCCOLI','TOFU','MILK','BREAD','PORK','CORN','LETTUCE'];
    const CHEF_DISHES = [
      {name:'STEAK RICE', need:['BEEF','RICE','EGG','ONION','CARROT'], temp:230, dmg:18, heal:8, tag:'stun'},
      {name:'SEAFOOD NOODLE', need:['SHRIMP','FISH','NOODLE','MUSHROOM','BROCCOLI'], temp:210, dmg:15, heal:11, tag:'slow'},
      {name:'CHEESE OMELET', need:['EGG','CHEESE','MILK','BREAD','TOMATO'], temp:160, dmg:10, heal:16, tag:'heal'},
      {name:'PORK HOTPOT', need:['PORK','NOODLE','MUSHROOM','ONION','TOFU'], temp:285, dmg:19, heal:7, tag:'burn'},
      {name:'VEGGIE BOWL', need:['RICE','TOFU','BROCCOLI','CARROT','CORN'], temp:190, dmg:9, heal:18, tag:'guard'},
      {name:'FISH GRATIN', need:['FISH','CHEESE','POTATO','MILK','ONION'], temp:250, dmg:17, heal:12, tag:'burn'},
      {name:'CHICKEN SANDWICH', need:['CHICKEN','BREAD','LETTUCE','TOMATO','CHEESE'], temp:175, dmg:13, heal:14, tag:'speed'},
      {name:'CHAOS STIR FRY', need:[], temp:260, dmg:11, heal:6, tag:'random'}
    ];
    function chefPickIngredient(f){
      const slots = f.data.slots || [];
      const pool = CHEF_INGREDIENTS.filter(x=>!slots.includes(x));
      return (pool.length ? pool : CHEF_INGREDIENTS)[Math.floor(Math.random()*(pool.length?pool.length:CHEF_INGREDIENTS.length))];
    }
    function chefBestDish(slots){
      const cleanSlots = (slots||[]).filter(x=>x !== 'ENEMY');
      let best = CHEF_DISHES[CHEF_DISHES.length-1], bestScore = -999;
      for(const dish of CHEF_DISHES){
        if(!dish.need.length) continue;
        const overlap = dish.need.filter(x=>cleanSlots.includes(x)).length;
        const score = overlap*2 + (overlap===dish.need.length ? 4 : 0) - Math.abs(dish.need.length-cleanSlots.length)*.2;
        if(score > bestScore){ best=dish; bestScore=score; }
      }
      return bestScore >= 3 ? best : CHEF_DISHES[CHEF_DISHES.length-1];
    }
    function chefQuality(temp, target){ return .18 + .82 * Math.pow(clamp(1 - Math.abs(temp-target)/170, 0, 1), 1.28); }
    function chefReset(f){ f.data.slots=[]; f.data.addTimer=0; f.data.cooking=false; f.data.temp=0; f.data.tempTimer=0; f.data.currentDish=null; }
    function chefFinishDish(f,e){
      if(!f || !e || !f.data.cooking) return;
      const dish = chefBestDish(f.data.slots);
      const temp = clamp(f.data.temp || 0,0,500);
      const q = chefQuality(temp, dish.temp);
      const dmg = scaledByMirror(f, dish.dmg * q * (f.isRage?1.12:1));
      const heal = dish.heal * q;
      e.takeDamage(dmg, f, 'chef-'+dish.name.toLowerCase().replace(/\s+/g,'-'));
      f.heal(heal, false);
      if(dish.tag==='stun' && q>.72) e.applyStatus('stun',.65,{source:f});
      if(dish.tag==='slow') e.applyStatus('slow',2.2,{mult:.62});
      if(dish.tag==='burn') e.applyStatus('burn',2.8,{source:f,interval:.7,dmg:.9});
      if(dish.tag==='guard') f.applyStatus('immune',.8,{source:f});
      if(dish.tag==='speed') f.applyStatus('speed',2.2,{mult:1.35});
      sayNew(e.x,e.y-e.radius-86, `${dish.name} ${Math.round(temp)}Ă‚Â°C`, '#ffcf7a');
      emitParticles(e.x,e.y,'#ffb347',44,440,7,.75,'square'); spawnShockwave(e.x,e.y,'#ffb347',165); playFighterSound(f,'skill'); chefReset(f);
    }
    function chefStartRageFry(f,e){
      if(!f || !e || (f.data.fryCd||0)>0) return false;
      const missing = Math.max(1, 5-(f.data.slots||[]).length);
      while((f.data.slots||[]).length<5) f.data.slots.push('ENEMY');
      const lowHpRatio = clamp((50 - f.hp)/50, 0, 1);
      const total = 12 + 26*lowHpRatio + missing*2;
      f.data.fryCd = 8.5;
      f.data.cooking = false; f.data.temp = 500; f.data.currentDish = 'ENEMY FRY';
      pushCustom({type:'chef_fry', owner:f, targetId:e.id, x:f.x, y:f.y, totalDmg:total, tick:0, ticks:8, doneTicks:0, customLife:2.8, maxCustomLife:2.8});
      sayNew(e.x,e.y-e.radius-94, `PAN FRY ${total.toFixed(0)}`, '#ff6030');
      triggerFlash(255,105,30,.18); cameraShake=Math.max(cameraShake,12); playFighterSound(f,'death'); return true;
    }
    const MasterChefType = {
      name:'MASTER_CHEF', color:'#ff9f3d', desc:'Five ingredient slots, temperature cooking, and rage pan-fry execute', speed:430, startDx:1, startDy:-.38,
      init:f=>chefReset(f),
      update:(f,e,dt)=>{
        f.data.fryCd=Math.max(0,(f.data.fryCd||0)-abilityDt(f,dt));
        if(f.data.cooking){
          f.data.tempTimer += dt;
          f.data.temp = clamp((f.data.tempTimer/10)*500,0,500);
          f.data.currentDish = chefBestDish(f.data.slots).name;
          if(f.data.tempTimer>=10.4){ sayNew(f.x,f.y-f.radius-82,'OVERCOOKED','#ff6a30'); f.takeDamage(3.5,null,'chef-overcook',true); chefReset(f); }
        } else {
          f.data.addTimer += abilityDt(f,dt);
          if((f.data.slots||[]).length<5 && f.data.addTimer>=1){ f.data.addTimer-=1; f.data.slots.push(chefPickIngredient(f)); sayNew(f.x,f.y-f.radius-78,f.data.slots[f.data.slots.length-1],'#ffe0a0'); if(f.data.slots.length>=5){ f.data.cooking=true; f.data.temp=0; f.data.tempTimer=0; f.data.currentDish=chefBestDish(f.data.slots).name; } }
        }
      },
      onCollide:(f,e)=>{ if(f.data.cooking) { chefFinishDish(f,e); return; } if(f.isRage && (f.data.slots||[]).length<5 && chefStartRageFry(f,e)) return; },
      draw:(ctx,f)=>{
        drawPolygon(ctx,[[-54,-38],[44,-56],[66,30],[0,68],[-66,32]],'#47240f','#ff9f3d',5);
        ctx.fillStyle='#fff3dc';ctx.strokeStyle='#4a2a11';ctx.lineWidth=5;ctx.beginPath();ctx.ellipse(0,-70,52,26,0,0,TAU);ctx.fill();ctx.stroke();ctx.fillRect(-34,-96,68,34);ctx.strokeRect(-34,-96,68,34);
        ctx.strokeStyle='#22140a';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(32,16,48,25,.15,0,TAU);ctx.stroke();ctx.strokeStyle='#ffcf7a';ctx.lineWidth=4;ctx.stroke();
        const slots=f.data.slots||[]; for(let i=0;i<5;i++){ const x=-52+i*26; ctx.fillStyle=slots[i]==='ENEMY'?'#ff3030':slots[i]?'#ffe0a0':'rgba(255,255,255,.18)'; ctx.fillRect(x,f.radius+12,20,14); ctx.strokeStyle='#2b1608';ctx.lineWidth=2;ctx.strokeRect(x,f.radius+12,20,14); }
        if(f.data.cooking){ const pctt=clamp((f.data.temp||0)/500,0,1); ctx.strokeStyle='#ff5a20';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,f.radius+22,-Math.PI/2,-Math.PI/2+TAU*pctt);ctx.stroke(); ctx.fillStyle='#fff0c2';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.fillText(`${Math.round(f.data.temp||0)}Ă‚Â°C`,0,-f.radius-18); ctx.fillText((f.data.currentDish||'COOK').slice(0,14),0,-f.radius-34); }
        else { ctx.fillStyle='#fff0c2';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.fillText(`${slots.length}/5 ING`,0,-f.radius-18); }
      }
    };

    // ---------- MASK ----------
    const MASKS = [
      {key:'HI', vn:'HĂ¡Â»Ë†', color:'#ffdc6e'},
      {key:'NO', vn:'NĂ¡Â»Ëœ', color:'#ff5656'},
      {key:'AI', vn:'Ä‚ÂI', color:'#ff87c8'},
      {key:'O', vn:'Ă¡Â»Â', color:'#86a7ff'}
    ];
    function maskApply(f,e,index,power=1,echo=false){
      const m = MASKS[index%4];
      if(m.key==='HI'){ const dmg=2.2*power; e.takeDamage(dmg,f,echo?'mask-echo-joy':'mask-joy'); f.heal(5.2*power,false); f.applyStatus('speed',2.2,{mult:1.25+.12*power}); }
      if(m.key==='NO'){ e.takeDamage((f.isRage?13:10)*power,f,echo?'mask-echo-wrath':'mask-wrath'); e.applyStatus('burn',1.8,{source:f,interval:.6,dmg:.55*power}); if(!echo) f.takeDamage(1.2,null,'mask-wrath-tax',true); }
      if(m.key==='AI'){ const dmg=4.2*power; e.takeDamage(dmg,f,echo?'mask-echo-love':'mask-love'); f.heal(dmg*.65,false); e.applyStatus('slow',2.5,{mult:.58}); if(f.isRage && !echo) e.applyStatus('stun',.45,{source:f}); }
      if(m.key==='O'){ e.takeDamage(3.2*power,f,echo?'mask-echo-sorrow':'mask-sorrow'); e.applyStatus('weak',3.4,{source:f}); f.applyStatus('immune',.42*power,{source:f}); f.data.sorrowGuard=2.4; }
      sayNew(e.x,e.y-e.radius-72,(echo?'ECHO ':'MASK ')+m.vn,m.color);
    }
    const MaskType = {
      name:'MASK', color:'#d7d0ff', desc:'Four masks: joy, wrath, love, sorrow. Changes after each contact', speed:480, startDx:1, startDy:.63,
      init:f=>{ f.data.maskIndex=0; f.data.touchCd=0; f.data.echoMask=null; f.data.cycle=0; f.data.sorrowGuard=0; },
      update:(f,e,dt)=>{ f.data.touchCd=Math.max(0,(f.data.touchCd||0)-dt); f.data.sorrowGuard=Math.max(0,(f.data.sorrowGuard||0)-dt); },
      onTakeDamage:(f,amount,src,label)=>{ if((f.data.sorrowGuard||0)>0 && amount>0) f.heal(amount*.22, false); },
      onCollide:(f,e)=>{ if((f.data.touchCd||0)>0) return; f.data.touchCd=.48; const idx=f.data.maskIndex||0; if(f.isRage && f.data.echoMask!==null && f.data.echoMask!==undefined) maskApply(f,e,f.data.echoMask,.35,true); maskApply(f,e,idx,1,false); f.data.echoMask=idx; f.data.maskIndex=(idx+1)%4; f.data.cycle=(f.data.cycle||0)+1; if(f.isRage && f.data.cycle%4===0){ f.heal(6,false); sayNew(f.x,f.y-f.radius-88,'MASK THEATRE','#ffffff'); } },
      draw:(ctx,f)=>{
        const idx=f.data.maskIndex||0, m=MASKS[idx];
        drawPolygon(ctx,[[-54,-62],[54,-62],[70,8],[36,64],[-36,64],[-70,8]],'#151318',m.color,5);
        ctx.fillStyle=m.color;ctx.globalAlpha=.25;ctx.beginPath();ctx.arc(0,0,68,0,TAU);ctx.fill();ctx.globalAlpha=1;
        ctx.strokeStyle='#f7f2ff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(-22,-10,12,0,TAU);ctx.arc(22,-10,12,0,TAU);ctx.stroke();
        ctx.fillStyle='#f7f2ff';ctx.font='900 24px serif';ctx.textAlign='center';ctx.fillText(m.vn,0,28);
        for(let i=0;i<4;i++){ctx.fillStyle=MASKS[i].color;ctx.globalAlpha=i===idx?1:.28;ctx.beginPath();ctx.arc(-45+i*30,f.radius+18,7,0,TAU);ctx.fill();} ctx.globalAlpha=1;
      }
    };

    // ---------- ARCADE ----------
    const ARCADE_SYMBOLS = [
      {key:'HAMMER', icon:'H', color:'#ffd36b'}, {key:'ROCKET', icon:'R', color:'#ff6b4a'}, {key:'BUNNY', icon:'B', color:'#ffffff'},
      {key:'HEART', icon:'Ă¢â„¢Â¥', color:'#ff85c7'}, {key:'SHIELD', icon:'S', color:'#78d7ff'}, {key:'GLITCH', icon:'G', color:'#9cff5b'}, {key:'COIN', icon:'$', color:'#ffe66e'}
    ];
    function arcadeRoll(owner){
      const out=[];
      if(owner.isRage && Math.random()<.22){ const s=ARCADE_SYMBOLS[Math.floor(Math.random()*ARCADE_SYMBOLS.length)]; return [s,s,s]; }
      for(let i=0;i<3;i++) out.push(ARCADE_SYMBOLS[Math.floor(Math.random()*ARCADE_SYMBOLS.length)]);
      return out;
    }
    function arcadeMult(count){ return count>=3?5:count===2?2:1; }
    function arcadeApply(owner,target,symbol,count,machine){
      const mult=arcadeMult(count);
      const ox = machine && Number.isFinite(machine.x) ? machine.x : owner.x;
      const oy = machine && Number.isFinite(machine.y) ? machine.y : owner.y;
      if(symbol.key==='HAMMER') pushCustom({type:'arcade_hammer',owner,targetId:target?.id,x:ox,y:oy,radius:110,dmg:7*mult,delay:.48,customLife:1.0,maxCustomLife:1.0});
      if(symbol.key==='ROCKET' && target){ const n=norm(target.x-ox,target.y-oy); pushCustom({type:'arcade_rocket',owner,targetId:target.id,x:ox,y:oy,vx:n.x*540,vy:n.y*540,radius:20,dmg:5*mult,customLife:4,maxCustomLife:4}); }
      if(symbol.key==='BUNNY'){ owner.data.reviveTokens=clamp((owner.data.reviveTokens||0)+mult,0,3); owner.heal(2*mult,false); pushCustom({type:'arcade_bunny',owner,targetId:target?.id,x:ox+rand(-18,18),y:oy+rand(-18,18),radius:22,dmg:2*mult,heal:2*mult,customLife:5,maxCustomLife:5}); }
      if(symbol.key==='HEART') owner.heal(7*mult,false);
      if(symbol.key==='SHIELD') owner.applyStatus('immune',.55*mult,{source:owner});
      if(symbol.key==='GLITCH' && target){ target.applyStatus('slow',1.3*mult,{mult:.45}); if(mult>=2) target.applyStatus('stun',.35*mult,{source:owner}); target.x=clamp(target.x+rand(-80,80),target.radius,GAME_SIZE-target.radius); target.y=clamp(target.y+rand(-80,80),target.radius,GAME_SIZE-target.radius); }
      if(symbol.key==='COIN' && target){ target.takeDamage(2.2*mult,owner,'arcade-coin-shower'); owner.data.machineCd=Math.max(0,(owner.data.machineCd||0)-.8*mult); }
      sayNew(owner.x,owner.y-owner.radius-88,`${symbol.key} Ä‚â€”${mult}`,symbol.color);
    }
    function arcadeResolveMachine(p){
      if(p.resolved) return; p.resolved=true;
      const owner=p.owner, target=enemyOfNew(owner); if(!owner) return;
      p.result = arcadeRoll(owner); owner.data.lastSpin = p.result.map(s=>s.icon).join(' ');
      const groups={}; for(const s of p.result) groups[s.key]=(groups[s.key]||0)+1;
      for(const [key,count] of Object.entries(groups)){ const sym=ARCADE_SYMBOLS.find(s=>s.key===key); arcadeApply(owner,target,sym,count,p); }
      p.customLife = 1.6; p.maxCustomLife = Math.max(p.maxCustomLife||1,p.customLife); playFighterSound(owner,'skill');
    }
    const ArcadeType = {
      name:'ARCADE', color:'#75f0ff', desc:'Slot machine reels: one symbol is x1, pair x2, triple jackpot x5', speed:440, startDx:1, startDy:-.52,
      init:f=>{ f.data.machineCd=1.2; f.data.lastSpin='---'; f.data.reviveTokens=0; },
      update:(f,e,dt)=>{ f.data.machineCd-=abilityDt(f,dt); const cdMax=f.isRage?3.7:5; if(f.data.machineCd<=0){ const activeMachines=projectiles.filter(p=>p&&p.type==='arcade_machine'&&p.owner===f&&(!p.customLife||p.customLife>0)).length; const maxMachines=f.isRage?2:1; if(activeMachines>=maxMachines){ f.data.machineCd=.45; return; } f.data.machineCd=cdMax; const x=clamp(f.x+rand(-130,130),140,860), y=clamp(f.y+rand(-130,130),155,865); pushCustom({type:'arcade_machine',owner:f,x,y,rollTimer:1.25,result:null,customLife:4,maxCustomLife:4}); sayNew(x,y-65,'SPIN','#75f0ff'); } },
      onTakeDamage:(f,amount,src,label)=>{ if(f.hp<=0 && (f.data.reviveTokens||0)>0){ f.data.reviveTokens--; f.hp=Math.max(f.hp, 16 + 4*(f.isRage?1:0)); sayNew(f.x,f.y-f.radius-98,'BUNNY REVIVE','#ffffff'); spawnShockwave(f.x,f.y,'#ffffff',180); } },
      draw:(ctx,f)=>{
        drawPolygon(ctx,[[-56,-62],[48,-62],[66,48],[-44,64]],'#10212a','#75f0ff',5);
        ctx.fillStyle='#02080c';ctx.fillRect(-38,-38,76,44);ctx.strokeStyle='#bffaff';ctx.lineWidth=4;ctx.strokeRect(-38,-38,76,44);
        const chars=(f.data.lastSpin||'---').split(' '); for(let i=0;i<3;i++){ctx.fillStyle='#eaffff';ctx.font='900 20px monospace';ctx.textAlign='center';ctx.fillText(chars[i]||'-',-24+i*24,-10);}
        ctx.fillStyle='#ff5f7d';ctx.beginPath();ctx.arc(44,34,10,0,TAU);ctx.fill();ctx.strokeStyle='#f0ffff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(50,10);ctx.lineTo(72,-22);ctx.stroke();ctx.beginPath();ctx.arc(76,-28,10,0,TAU);ctx.stroke();
        ctx.fillStyle='#eaffff';ctx.font='900 12px monospace';ctx.fillText(`BUNNY ${f.data.reviveTokens||0}`,0,f.radius+22);
      }
    };

    // ---------- NINJA ----------
    function ninjaThrowShuriken(owner,target){
      if(!owner||!target)return;
      const n=norm(target.x-owner.x,target.y-owner.y);
      const speed=2130;
      const throws=[{x:n.x,y:n.y,double:false}];
      if(owner.isRage){
        const lostRatio=clamp((owner.maxHp-owner.hp)/Math.max(1,owner.maxHp),0,1);
        const chance=lerp(.2,.8,lostRatio);
        if(Math.random()<chance){
          const sign=Math.random()<.5?-1:1;
          const base=Math.atan2(n.y,n.x);
          const angle=base+sign*.58;
          throws.push({x:Math.cos(angle),y:Math.sin(angle),double:true});
          floatingTexts.push(new FloatingText(owner.x,owner.y-owner.radius-76,`DOUBLE ${(chance*100).toFixed(0)}%`,'#f7f7ff'));
        }
      }
      for(const dir of throws){
        pushCustom({type:'ninja_shuriken',owner,targetId:target.id,x:owner.x+dir.x*70,y:owner.y+dir.y*70,vx:dir.x*speed,vy:dir.y*speed,radius:12,dmg:1,customLife:1.75,maxCustomLife:1.75,straight:true,double:dir.double});
      }
      if(window.playNinjaShurikenAudio) window.playNinjaShurikenAudio('throw'); else playFighterSound(owner,'wall');
    }
    function ninjaThrowKunai(owner){ const a=Math.random()*TAU; const back=owner.radius+34; const sx=clamp(owner.x-Math.cos(a)*back,owner.radius,GAME_SIZE-owner.radius); const sy=clamp(owner.y-Math.sin(a)*back,owner.radius,GAME_SIZE-owner.radius); pushCustom({type:'ninja_kunai',owner,x:sx,y:sy,vx:Math.cos(a)*1220,vy:Math.sin(a)*1220,radius:16,triggered:false,bounces:0,customLife:5,maxCustomLife:5,visualBackThrow:true}); if(window.playNinjaKunaiAudio) window.playNinjaKunaiAudio('throw'); else playFighterSound(owner,'skill'); }
    function noteNinjaTeleportCooldown(owner){ if(!owner||!owner.data)return; owner.data.kunaiCd=Math.max(0,(owner.data.kunaiCd||0)-.2); }
    function ninjaFtgBusy(owner){ return !!(owner && projectiles.some(p=>p && p.apexCustom && p.type==='ninja_strike' && p.owner===owner && !p._dead)); }
    function ninjaStrike(owner,target,x,y){ if(!owner||!target)return; if(window.playNinjaTeleportAudio) window.playNinjaTeleportAudio(owner); const gap=owner.radius+target.radius+1; const touch=norm(x-target.x,y-target.y); const tx=target.x+touch.x*gap, ty=target.y+touch.y*gap; owner.x=clamp(tx,owner.radius,GAME_SIZE-owner.radius); owner.y=clamp(ty,owner.radius,GAME_SIZE-owner.radius); owner.data.positionLocked=true; owner.data.ninjaImmuneUntil=Math.max(owner.data.ninjaImmuneUntil||0,matchClock+2.65); for(const key of ['slow','push','burn','poison','freeze','bleed','stun','weak','brittle','scent','abilityDisabled','silenceCurse','hexBurn','rapidPunch','disease','paintRed','paintBlue','paintYellow','innerTrauma','mathGraphContact','mathFormulaContact']) if(owner.statuses) delete owner.statuses[key]; pushCustom({type:'ninja_strike',owner,targetId:target.id,x:owner.x,y:owner.y,hit:false,customLife:.92,maxCustomLife:.92}); target.applyStatus('stun',.95,{source:owner}); target.data.positionLocked=true; noteNinjaTeleportCooldown(owner); window.__apexNinjaStopMotionUntil=Math.max(window.__apexNinjaStopMotionUntil||0,performance.now()+700); timeScale=.24; setTimeout(()=>{ timeScale=1; },700); hitStop=Math.max(hitStop,.05); }
    const NinjaType = {
      name:'NINJA', color:'#79d8ff', desc:'Shuriken every second plus Flying Thunder God kunai teleport strike', speed:555, startDx:1, startDy:.42,
      init:f=>{ f.data.shurikenCd=.4; f.data.kunaiCd=2.2; f.data.teleports=0; f.data.shurikenTeleportReadyAt=0; },
      update:(f,e,dt)=>{ if(f.hardCC&&f.hardCC()){ f.data.shurikenCd=Math.max(.08,f.data.shurikenCd||.08); f.data.kunaiCd=Math.max(.08,f.data.kunaiCd||.08); return; } f.data.shurikenCd-=abilityDt(f,dt); if(f.data.shurikenCd<=0){ f.data.shurikenCd=1; ninjaThrowShuriken(f,e); } f.data.kunaiCd-=abilityDt(f,dt); if(f.data.kunaiCd<=0){ f.data.kunaiCd=f.isRage?5.2:8; ninjaThrowKunai(f); } },
      draw:(ctx,f)=>{
        drawPolygon(ctx,[[-54,-48],[0,-70],[56,-42],[62,40],[0,66],[-62,42]],'#101820','#79d8ff',5);
        ctx.fillStyle='#060b10';ctx.beginPath();ctx.arc(0,-8,42,0,TAU);ctx.fill();ctx.strokeStyle='#79d8ff';ctx.lineWidth=4;ctx.stroke();
        ctx.fillStyle='#dff9ff';ctx.fillRect(-24,-18,48,11);ctx.fillStyle='#101820';ctx.fillRect(-15,-15,10,5);ctx.fillRect(8,-15,10,5);
        ctx.strokeStyle='#79d8ff';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(-20,26);ctx.lineTo(-80,56);ctx.moveTo(24,26);ctx.lineTo(78,58);ctx.stroke();
        ctx.fillStyle='#dff9ff';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.fillText(`KUNAI ${Math.max(0,f.data.kunaiCd||0).toFixed(1)}`,0,f.radius+22);
      }
    };

    // ---------- MATH UPGRADE: expression + graph synergy ----------
    const math = FTNew('MATH');
    if(math){
      math.desc = 'Expression projectile plus Oxy graph wall; simultaneous hits double both damages';
      math.init = f => { f.data.cd=3.2; f.data.graphCd=2.2; f.data.graphPhase='idle'; f.data.graphTimer=0; f.data.graphOption=null; f.data.comboWindow=0; };
      math.update = function(f,e,dt){
        f.data.cd -= abilityDt(f,dt);
        if(f.data.cd<=0){
          f.data.cd = f.isRage ? 4.1 : 5;
          let formula,result,isRageFormula=false;
          if(f.isRage){ const rage = makeRageMathExpression(); result=rage.result; formula=rage.formula; isRageFormula=true; }
          else { const X=Math.round(f.x/50),Y=Math.round(f.y/50),A=Math.round(e.x/50),B=Math.max(1,Math.round(e.y/50)); result=Math.round((X-Y)*A/B); if(result===0) result=(Math.random()<.5?-1:1); formula=`(${X}Ă¢Ë†â€™${Y})Ä‚â€”${A}/${B}`; }
          projectiles.push({type:'math_formula',owner:f,enemy:e,formula,value:result,rage:isRageFormula,life:4.2,maxLife:4.2,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0,uninterruptible:true});
          playFighterSound(f,'skill');
        }
        const hasGraph = projectiles.some(p=>p.type==='math_v2_graph' && p.owner===f && p.life>0);
        if(f.data.graphPhase==='typing'){
          f.data.graphTimer -= dt;
          if(f.data.graphTimer<=.9 && !f.data.graphShown && f.data.graphOption){ f.data.graphShown=true; sayNew(f.x,f.y-f.radius-92,f.data.graphOption.label,'#9ad7ff'); }
          if(f.data.graphTimer<=0 && f.data.graphOption){ spawnMathV2Graph(f,f.data.graphOption.label,f.data.graphOption.fn); const g=[...projectiles].reverse().find(p=>p.type==='math_v2_graph'&&p.owner===f); if(g){g.formula = f.data.graphOption.label; g.mathOwner = true; g.energy = 9;} f.data.graphPhase='idle'; f.data.graphCd=f.isRage?5.2:7.5; }
        } else if(!hasGraph){
          f.data.graphCd -= abilityDt(f,dt);
          if(f.data.graphCd<=0 && typeof makeMathV2Function==='function'){
            f.data.graphOption=makeMathV2Function(); f.data.graphPhase='typing'; f.data.graphTimer=f.isRage?1.15:2.15; f.data.graphShown=false;
            projectiles.push({type:'math_v2_grid',owner:f,x:500,y:500,life:f.data.graphTimer+4.5,maxLife:f.data.graphTimer+4.5,formula:f.data.graphOption.label});
            playFighterSound(f,'skill');
          }
        }
      };
      math.draw = function(ctx,f){
        drawPolygon(ctx,[[-60,-55],[58,-48],[66,48],[-55,60]],'#e4dcc9','#171717',5);
        ctx.fillStyle='#171717';ctx.font='900 22px monospace';ctx.textAlign='center';ctx.fillText('Ă¢Ë†â€˜',-22,-10);ctx.fillText('f(x)',18,20);
        ctx.strokeStyle='#8fcfff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-42,30);ctx.quadraticCurveTo(0,-34,44,30);ctx.stroke();
        if(f.data.graphPhase==='typing' && f.data.graphOption){ ctx.fillStyle='#eaffff';ctx.strokeStyle='#0b1620';ctx.lineWidth=4;ctx.font='900 14px monospace';const total=f.isRage?1.15:2.15;const progress=clamp((total-f.data.graphTimer)/total,0,1);const txt=f.data.graphOption.label.slice(0,Math.max(1,Math.floor(f.data.graphOption.label.length*progress)));ctx.strokeText(txt,0,-f.radius-18);ctx.fillText(txt,0,-f.radius-18); }
      };
    }

    // Damage bridge for MATH simultaneous graph + formula hits.
    if(!Fighter.prototype.__apexMathComboDamagePatch){
      Fighter.prototype.__apexMathComboDamagePatch = true;
      const oldTakeDamageMathCombo = Fighter.prototype.takeDamage;
      Fighter.prototype.takeDamage = function(amount, source, label, silent){
        if(source && source.name === 'MATH' && typeof label === 'string'){
          const isFormula = /math-number|rage-equation|math-formula/.test(label);
          const isGraph = /graph-wall|function-collapse/.test(label);
          if(isFormula){ if(this.hasStatus && this.hasStatus('mathGraphContact')){ amount *= 2; sayNew(this.x,this.y-this.radius-108,'Ä‚â€”2 FORMULA + GRAPH','#eaffff'); } this.applyStatus('mathFormulaContact',.58,{source}); }
          if(isGraph){ if(this.hasStatus && this.hasStatus('mathFormulaContact')){ amount *= 2; sayNew(this.x,this.y-this.radius-94,'Ä‚â€”2 GRAPH + FORMULA','#9ad7ff'); } this.applyStatus('mathGraphContact',.58,{source}); }
        }
        return oldTakeDamageMathCombo.call(this, amount, source, label, silent);
      };
    }

    const additions = [MusicianType, MasterChefType, MaskType, ArcadeType, NinjaType];
    for(const ft of additions){ if(!FTNew(ft.name)) FighterTypes.push(ft); }

    // Keep tournament / challenge pool exactly 32 when replacement is loaded.
    window.apexRosterReplacement = {
      removed:[...removedNames],
      added:additions.map(f=>f.name),
      roster:FighterTypes.map(f=>f.name),
      count:FighterTypes.length
    };

    // ---------- custom projectile update/draw layer ----------
    if(!window.__apexCustomProjectilePatchV2){
      window.__apexCustomProjectilePatchV2 = true;
      const oldUpdateProjectilesCustom = updateProjectiles;
      updateProjectiles = function(dt){
        oldUpdateProjectilesCustom(dt);
        for(let i=projectiles.length-1;i>=0;i--){
          const p=projectiles[i]; if(!p || !p.apexCustom) continue;
          const owner=p.owner, target=(p.targetId!==undefined?fighters.find(f=>f.id===p.targetId):enemyOfNew(owner));
          if(p.customLife !== Infinity) p.customLife -= dt;
          if(p.delay){ p.delay-=dt; if(p.delay>0) { if(p.customLife<=0) p._dead=true; if(p._dead) projectiles.splice(i,1); continue; } }

          if(p.type==='music_note'){
            if(target){ const n=norm(target.x-p.x,target.y-p.y); p.vx=lerp(p.vx,n.x*760,p.steer||.12); p.vy=lerp(p.vy,n.y*760,p.steer||.12); }
            p.x+=p.vx*dt; p.y+=p.vy*dt;
            if(target && dist(p.x,p.y,target.x,target.y)<=target.radius+p.radius){ target.takeDamage(scaledByMirror(owner,p.dmg||1),owner,'music-note'); emitParticles(target.x,target.y,p.color||owner.color,16,240,4,.35,'square'); p._dead=true; }
            if(p.x<-80||p.x>1080||p.y<-80||p.y>1080) p._dead=true;
          }
          if(p.type==='music_wave'){
            p.prevRadius=p.radius||0; const prog=1-clamp(p.customLife/Math.max(.001,p.maxCustomLife||1),0,1); p.radius=lerp(18,p.maxRadius||330,smoothstep(prog));
            if(target && !p.hitIds[target.id]){ const d=dist(target.x,target.y,p.x,p.y); if(d<=p.radius+target.radius && d>=p.prevRadius-target.radius-20){ const chord=p.chord||MUSIC_CHORDS[0]; target.takeDamage(scaledByMirror(owner,chord.dmg||4),owner,'music-'+String(chord.name||'chord').toLowerCase()); if(chord.effect==='heal') owner.heal(chord.heal||4,false); if(chord.effect==='slow') target.applyStatus('slow',chord.slow||2,{mult:.58}); if(chord.effect==='stun') target.applyStatus('stun',chord.stun||.6,{source:owner}); p.hitIds[target.id]=true; spawnShockwave(p.x,p.y,chord.color||owner.color,Math.min(360,p.radius+40)); } }
          }
          if(p.type==='chef_fry'){
            if(target && owner){ const age=(p.maxCustomLife||1)-(p.customLife||0); p.x=owner.x+owner.dir.x*58; p.y=owner.y+owner.dir.y*58; target.x=clamp(p.x+Math.sin(age*16)*22,target.radius,GAME_SIZE-target.radius); target.y=clamp(p.y+Math.cos(age*13)*18,target.radius,GAME_SIZE-target.radius); target.data.positionLocked=true; target.applyStatus('stun',.18,{source:owner}); p.tick=(p.tick||0)+dt; while(p.tick>=.35 && (p.doneTicks||0)<(p.ticks||8)){ p.tick-=.35; p.doneTicks=(p.doneTicks||0)+1; target.takeDamage((p.totalDmg||20)/(p.ticks||8),owner,'chef-rage-pan-fry',true); } }
            if(p.customLife<=0 && owner){ owner.heal((p.totalDmg||20)*.18,false); chefReset(owner); }
          }
          if(p.type==='arcade_machine'){
            p.rollTimer-=dt; if(p.rollTimer<=0 && !p.resolved) arcadeResolveMachine(p);
          }
          if(p.type==='arcade_hammer'){
            if(target){ p.x=target.x; p.y=target.y; if(!p.hit){ p.hit=true; if(dist(target.x,target.y,p.x,p.y)<=target.radius+p.radius) target.takeDamage(scaledByMirror(owner,p.dmg||7),owner,'arcade-hammer'); target.applyStatus('stun',.25,{source:owner}); spawnShockwave(p.x,p.y,'#ffd36b',150); } } p._dead=true;
          }
          if(p.type==='arcade_rocket'){
            if(target){ const n=norm(target.x-p.x,target.y-p.y); p.vx=lerp(p.vx,n.x*690,.16); p.vy=lerp(p.vy,n.y*690,.16); }
            p.x+=p.vx*dt; p.y+=p.vy*dt;
            if(target && dist(p.x,p.y,target.x,target.y)<=target.radius+p.radius+8){ target.takeDamage(scaledByMirror(owner,p.dmg||5),owner,'arcade-rocket'); target.applyStatus('burn',2,{source:owner,interval:.7,dmg:.6}); spawnShockwave(p.x,p.y,'#ff6b4a',130); p._dead=true; }
            if(p.x<-80||p.x>1080||p.y<-80||p.y>1080) p._dead=true;
          }
          if(p.type==='arcade_bunny'){
            if(target){ const n=norm(target.x-p.x,target.y-p.y); p.x+=n.x*270*dt; p.y+=n.y*270*dt; if(dist(p.x,p.y,target.x,target.y)<=target.radius+p.radius){ target.takeDamage(p.dmg||2,owner,'arcade-bunny'); if(owner) owner.heal(p.heal||2,false); p._dead=true; } }
          }
          if(p.type==='ninja_shuriken'){
            p.x+=p.vx*dt; p.y+=p.vy*dt; p.angle=(p.angle||0)+dt*24;
            if(target && dist(p.x,p.y,target.x,target.y)<=target.radius+p.radius){ if(window.playNinjaShurikenAudio) window.playNinjaShurikenAudio('hitBody'); target.takeDamage(p.dmg||1,owner,'ninja-shuriken'); p._dead=true; }
            const shurikenWallHit=!p._dead && (p.x<0||p.x>GAME_SIZE||p.y<0||p.y>GAME_SIZE);
            if(shurikenWallHit && window.playNinjaShurikenAudio) window.playNinjaShurikenAudio('hitWall');
            if(shurikenWallHit && owner && owner.isRage && !ninjaFtgBusy(owner) && matchClock >= (owner.data.shurikenTeleportReadyAt||0)){
              owner.x=clamp(p.x,owner.radius,GAME_SIZE-owner.radius); owner.y=clamp(p.y,owner.radius,GAME_SIZE-owner.radius);
              owner.data.positionLocked=true; owner.data.shurikenCd=0; owner.data.ninjaImmuneUntil=Math.max(owner.data.ninjaImmuneUntil||0,matchClock+.82);
              for(const key of ['slow','push','burn','poison','freeze','bleed','stun','weak','brittle','scent','abilityDisabled','silenceCurse','hexBurn','rapidPunch','disease','paintRed','paintBlue','paintYellow','innerTrauma','mathGraphContact','mathFormulaContact']) if(owner.statuses) delete owner.statuses[key];
              owner.data.teleports=(owner.data.teleports||0)+1; owner.data.shurikenTeleportReadyAt=matchClock+1; noteNinjaTeleportCooldown(owner); p._dead=true;
            }
            if(shurikenWallHit || p.x<-60||p.x>1060||p.y<-60||p.y>1060) p._dead=true;
          }
          if(p.type==='ninja_kunai'){
            p.x+=p.vx*dt; p.y+=p.vy*dt; p.angle=Math.atan2(p.vy,p.vx);
            let kunaiBounced=false;
            if(p.x<p.radius){p.x=p.radius;p.vx=Math.abs(p.vx);p.bounces++;kunaiBounced=true;} if(p.x>GAME_SIZE-p.radius){p.x=GAME_SIZE-p.radius;p.vx=-Math.abs(p.vx);p.bounces++;kunaiBounced=true;} if(p.y<p.radius){p.y=p.radius;p.vy=Math.abs(p.vy);p.bounces++;kunaiBounced=true;} if(p.y>GAME_SIZE-p.radius){p.y=GAME_SIZE-p.radius;p.vy=-Math.abs(p.vy);p.bounces++;kunaiBounced=true;}
            if(kunaiBounced && window.playNinjaKunaiAudio) window.playNinjaKunaiAudio('bounce');
            const kunaiAge=(p.maxCustomLife||5)-(p.customLife||0);
            if(owner && kunaiAge>=2.0 && dist(p.x,p.y,owner.x,owner.y)<=owner.radius+p.radius+18){ if(window.playNinjaKunaiAudio) window.playNinjaKunaiAudio('catch'); owner.data.kunaiCd=0; p.caught=true; p._dead=true; }
            if(!p._dead && target && owner && !p.triggered && dist(p.x,p.y,target.x,target.y)<=target.radius+owner.radius){ p.triggered=true; ninjaStrike(owner,target,p.x,p.y); p._dead=true; if(owner) owner.data.teleports=(owner.data.teleports||0)+1; }
            if(!p._dead && p.customLife<=0 && owner && !p.triggered && (owner.data.kunaiCd||0)>0){ owner.x=clamp(p.x,owner.radius,GAME_SIZE-owner.radius); owner.y=clamp(p.y,owner.radius,GAME_SIZE-owner.radius); owner.data.positionLocked=true; owner.data.ninjaImmuneUntil=Math.max(owner.data.ninjaImmuneUntil||0,matchClock+1.52); for(const key of ['slow','push','burn','poison','freeze','bleed','stun','weak','brittle','scent','abilityDisabled','silenceCurse','hexBurn','rapidPunch','disease','paintRed','paintBlue','paintYellow','innerTrauma','mathGraphContact','mathFormulaContact']) if(owner.statuses) delete owner.statuses[key]; owner.data.kunaiCd=Math.min(owner.data.kunaiCd||5,1.6); owner.data.teleports=(owner.data.teleports||0)+1; noteNinjaTeleportCooldown(owner); }
          }
          if(p.type==='ninja_strike'){
            if(owner){ owner.x=p.x; owner.y=p.y; owner.data.positionLocked=true; }
            if(target){ target.data.positionLocked=true; target.applyStatus('stun',.16,{source:owner}); }
            const age=(p.maxCustomLife||1)-(p.customLife||0);
            if(!p.hit && age>.34 && target){ p.hit=true; target.takeDamage(20,owner,'flying-thunder-rasengan'); target.applyStatus('stun',3,{source:owner}); if(window.fadeNinjaSkillAudio) window.fadeNinjaSkillAudio(owner); }
          }
          if(p.customLife<=0) p._dead=true;
          if(p._dead) projectiles.splice(i,1);
        }
        for(const p of projectiles){ if(p && p.type==='math_v2_graph' && p.owner && p.owner.name==='MATH'){ const enemy=enemyOfNew(p.owner); if(enemy && distToGraphPoints(enemy.x,enemy.y,p.points||[]) <= enemy.radius + (p.thick||18)+6) enemy.applyStatus('mathGraphContact',.18,{source:p.owner}); } }
      };
      window.updateProjectiles = updateProjectiles;

      const oldDrawProjectilesCustom = drawProjectiles;
      drawProjectiles = function(ctx){
        oldDrawProjectilesCustom(ctx);
        for(const p of projectiles){ if(!p || !p.apexCustom) continue; ctx.save(); const a=customAlpha(p); ctx.globalAlpha=clamp(a,.08,1);
          if(p.type==='music_note'){ ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.vy||0,p.vx||1)); ctx.fillStyle=p.color||'#ffe889'; ctx.strokeStyle='#110a02'; ctx.lineWidth=3; ctx.font='900 34px serif'; ctx.textAlign='center'; ctx.fillText('Ă¢â„¢Âª',0,10); ctx.strokeText('Ă¢â„¢Âª',0,10); }
          if(p.type==='music_wave'){ ctx.strokeStyle=p.chord?.color||'#ffe889'; ctx.lineWidth=8; ctx.beginPath(); ctx.arc(p.x,p.y,p.radius||10,0,TAU); ctx.stroke(); }
          if(p.type==='chef_fry'){ ctx.translate(p.x,p.y); ctx.fillStyle='rgba(255,96,48,.38)'; ctx.beginPath(); ctx.ellipse(0,0,95,48,0,0,TAU); ctx.fill(); ctx.strokeStyle='#ffcf7a'; ctx.lineWidth=8; ctx.stroke(); ctx.fillStyle='#ffdf9b'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText('PAN FRY',0,6); }
          if(p.type==='arcade_machine'){ ctx.translate(p.x,p.y); ctx.fillStyle='#10212a'; ctx.strokeStyle='#75f0ff'; ctx.lineWidth=5; ctx.fillRect(-46,-58,92,116); ctx.strokeRect(-46,-58,92,116); const res=p.result || [0,1,2].map(i=>ARCADE_SYMBOLS[Math.floor((Date.now()/120+i)%ARCADE_SYMBOLS.length)]); for(let i=0;i<3;i++){ const sym=res[i]; ctx.fillStyle='#02080c'; ctx.fillRect(-36+i*24,-32,22,32); ctx.fillStyle=sym.color||'#fff'; ctx.font='900 18px monospace'; ctx.textAlign='center'; ctx.fillText(sym.icon,-25+i*24,-10); } ctx.fillStyle='#ff5f7d'; ctx.beginPath();ctx.arc(28,34,8,0,TAU);ctx.fill(); }
          if(p.type==='arcade_hammer'){ ctx.translate(p.x,p.y-90*a); ctx.fillStyle='#ffd36b'; ctx.strokeStyle='#211200'; ctx.lineWidth=5; ctx.fillRect(-44,-24,88,36); ctx.strokeRect(-44,-24,88,36); ctx.fillRect(-8,8,16,68); ctx.strokeRect(-8,8,16,68); }
          if(p.type==='arcade_rocket'){ ctx.translate(p.x,p.y); ctx.rotate(Math.atan2(p.vy||0,p.vx||1)); drawPolygon(ctx,[[-26,-12],[26,0],[-26,12],[-14,0]],'#ff6b4a','#220900',4); ctx.fillStyle='#ffe66e';ctx.beginPath();ctx.arc(-28,0,8,0,TAU);ctx.fill(); }
          if(p.type==='arcade_bunny'){ ctx.translate(p.x,p.y); ctx.fillStyle='#ffffff'; ctx.strokeStyle='#1b1b1b';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,4,p.radius||20,0,TAU);ctx.fill();ctx.stroke();ctx.beginPath();ctx.ellipse(-9,-20,7,18,-.25,0,TAU);ctx.ellipse(9,-20,7,18,.25,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#111';ctx.font='900 14px serif';ctx.textAlign='center';ctx.fillText('B',0,9); }
          if(p.type==='ninja_shuriken'){ if(window.drawNinjaShurikenProjectile && window.apexNinjaVisualReady) window.drawNinjaShurikenProjectile(ctx,p); else { ctx.translate(p.x,p.y); ctx.rotate(p.angle||0); ctx.fillStyle='#dff9ff'; ctx.strokeStyle='#0b1820';ctx.lineWidth=3; for(let i=0;i<4;i++){ctx.rotate(Math.PI/2); drawPolygon(ctx,[[0,0],[22,-6],[12,6]],'#dff9ff','#0b1820',2);} } }
          if(p.type==='ninja_kunai'){ if(window.drawNinjaKunaiProjectile && window.apexNinjaVisualReady) window.drawNinjaKunaiProjectile(ctx,p); else { ctx.translate(p.x,p.y); ctx.rotate(p.angle||0); drawPolygon(ctx,[[-34,-8],[12,-8],[34,0],[12,8],[-34,8],[-24,0]],'#c7f7ff','#09202a',4); ctx.strokeStyle='#79d8ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(-42,0,8,0,TAU);ctx.stroke(); } }
          if(p.type==='ninja_strike'){ if(window.drawNinjaStrikeProjectile && window.apexNinjaVisualReady) window.drawNinjaStrikeProjectile(ctx,p); else { ctx.translate(p.x,p.y); const age=(p.maxCustomLife||1)-(p.customLife||0); ctx.strokeStyle='#79d8ff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,28+age*120,0,TAU);ctx.stroke(); ctx.fillStyle='rgba(80,190,255,.22)';ctx.beginPath();ctx.arc(0,0,34,0,TAU);ctx.fill(); } }
          ctx.restore(); }
      };
      window.drawProjectiles = drawProjectiles;
    }

    console.info('[Apex Chaos] roster replacement loaded', window.apexRosterReplacement);
  } catch(err){
    window.apexRosterReplacementError = {message: err && err.message, stack: err && err.stack};
    console.error('[Apex Chaos] roster replacement failed', err);
  }
})();
