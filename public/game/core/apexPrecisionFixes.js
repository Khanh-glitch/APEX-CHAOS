// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function precisionFixPatch(){
  const FT = n => FighterTypes.find(f => f.name === n);
  const EN = f => fighters.find(x => x && f && x.id !== f.id);
  const note = (x,y,t,c)=>floatingTexts.push(new FloatingText(x,y,t,c));
  const isContactLabel = l => /rubber|kinetic|saw|blood-rip|collision|spin|bite|hunt|slash|punch|monk|kungfu/i.test(String(l||''));
  const isFlyingLabel = l => /blade|meteor|burn|card|sniper|math|electric|lightning|toxic|poison|virus|graph|projectile|laser|ray|shot|wave|dart|meteor|blob/i.test(String(l||''));

  // System wrapper: Magnet Shield, Mirror global copied power, Time mark accounting, Superstar fan interception, Slime counters, Puppet effigy no-overflow.
  const baseTakeDamage = Fighter.prototype.takeDamage;
  Fighter.prototype.takeDamage = function(amount, source=null, label='', statusDamage=false){
    if (!amount || amount <= 0 || this.hp <= 0) return;

    // Mirror: any damage produced by a copied skill respects whole/broken mirror power, including DOTs.
    if (source && source.name === 'MIRROR' && source.data && source.data.stolenType && source.data.stolenTimer > 0) {
      const pow = source.data.stolenPower || 1;
      amount *= pow;
      if (pow !== 1) label = (label || 'mirror-copy') + `-mirror-x${pow}`;
    }

    // Magnet Shield: blocks flying damage. Heavy block breaks the field. Contact damage still passes and can break shield.
    if (this.name === 'MAGNET' && this.data && this.data.fieldTimer > 0 && source && source !== this && !statusDamage) {
      const flying = isFlyingLabel(label) && !isContactLabel(label);
      if (flying) {
        note(this.x, this.y-this.radius-95, `MAGNET SHIELD ${amount.toFixed(1)}`, '#ffe44e');
        emitParticles(this.x, this.y, '#ffe44e', 18, 260, 5, .45, 'square');
        if (amount > 20) { this.data.fieldTimer = 0; projectiles.forEach(p => { if(p.type==='magnet_field' && p.owner===this) p.life=0; }); note(this.x, this.y-this.radius-120, 'SHIELD BROKEN', '#ffcc55'); }
        return;
      }
      if (isContactLabel(label) && amount > 20) { this.data.fieldTimer = 0; projectiles.forEach(p => { if(p.type==='magnet_field' && p.owner===this) p.life=0; }); note(this.x, this.y-this.radius-100, 'CONTACT BREAK', '#ffcc55'); }
    }

    // Superstar fans are visible 10 HP bodies that intercept incoming non-status hits before Superstar.
    if (this.name === 'SUPERSTAR' && source && source !== this && !statusDamage) {
      const fan = projectiles.find(p => p.type === 'superfan' && p.owner === this && p.hp > 0 && p.life > 0);
      if (fan) {
        const block = Math.min(fan.hp, amount);
        fan.hp -= block;
        note(fan.x, fan.y-fan.radius-20, `FAN ${block.toFixed(1)}`, '#ffb8ea');
        emitParticles(fan.x, fan.y, '#ff7bd6', 10, 180, 4, .3, 'square');
        if (fan.hp <= 0) { fan.life = 0; spawnShockwave(fan.x, fan.y, '#ff7bd6', 80); }
        return;
      }
    }

    // PUPPET: oldest effigy absorbs exactly one hit; visible leak goes to Puppet, not to the next effigy.
    if (this.name === 'PUPPET' && source && source !== this && !statusDamage) {
      const eff = projectiles.filter(p=>p.type==='puppet_effigy' && p.owner===this && p.hp>0 && p.life>0).sort((a,b)=>(a.order||0)-(b.order||0))[0];
      if (eff) {
        const block = Math.min(eff.hp, amount);
        eff.hp -= block;
        note(eff.x, eff.y-eff.radius-30, `VOODOO ${block.toFixed(1)}`, '#d6c0ff');
        emitParticles(eff.x, eff.y, '#d6c0ff', 14, 220, 5, .35, 'square');
        if (eff.hp <= 0) { eff.life=0; spawnShockwave(eff.x, eff.y, '#8d6b45', 120); }
        const leak = Math.max(0, amount - block) * .9 + block * .38;
        if (leak <= 0) return;
        amount = leak;
        label = (label || 'direct') + '-puppet-effigy-leak';
        note(this.x, this.y-this.radius-92, `LEAK ${leak.toFixed(1)}`, '#d6c0ff');
      }
    }

    // TIME mark: track enemy damage to Time and Time damage to enemy. Enemy gets only 50% refund later.
    if (this.name === 'TIME' && this.data && this.data.mark && source && source !== this) {
      this.data.mark.damageTaken = (this.data.mark.damageTaken || 0) + amount;
    }
    if (source && source.name === 'TIME' && source.data && source.data.mark && this !== source) {
      source.data.mark.damageDealt = (source.data.mark.damageDealt || 0) + amount;
    }

    // SLIME: child spawn counter and shock-split counter. Only true incoming damage, not status ticks.
    if (this.name === 'SLIME' && this.data && source && source !== this && !statusDamage) {
      this.data.childCounter ||= [];
      this.data.childCounter.push({t:matchClock, amount});
      this.data.childCounter = this.data.childCounter.filter(x => matchClock - x.t <= 5);
      const csum = this.data.childCounter.reduce((a,b)=>a+b.amount,0);
      if (csum >= 4 && (this.data.childSpawnCd||0) <= 0) {
        addPrecisionSlimeChild(this, Math.random()*TAU, 8, 2.2);
        this.data.childCounter = [];
        this.data.childSpawnCd = .85;
        note(this.x, this.y-this.radius-86, '+SLIME CHILD', '#caffbb');
      }
      this.data.shockCounter ||= [];
      this.data.shockCounter.push({t:matchClock, amount});
      this.data.shockCounter = this.data.shockCounter.filter(x => matchClock - x.t <= 1);
      const ssum = this.data.shockCounter.reduce((a,b)=>a+b.amount,0);
      if (ssum >= Math.max(8, this.hp * .30) && (this.data.cloneCd||0) <= 0) {
        splitPrecisionSlime(this);
        this.data.shockCounter = [];
        this.data.cloneCd = 1.8;
      }
    }

    // TIME death denial during mark, once.
    if (this.name === 'TIME' && this.data && this.data.mark && !this.data.deathRewindUsed && this.hp - amount <= 0) {
      const m = this.data.mark;
      this.x = m.x; this.y = m.y; this.hp = Math.max(1, m.hp || this.maxHp);
      this.data.deathRewindUsed = true;
      this.data.mark = null;
      this.data.markCd = 9;
      note(this.x, this.y-this.radius-95, 'DEATH DENIED', '#efeaff');
      spawnShockwave(this.x, this.y, '#d6d0ff', 300);
      return;
    }
    return baseTakeDamage.call(this, amount, source, label, statusDamage);
  };

  // VAMPIRE: front semicircle bite, not omnidirectional, not impossible.
  const vamp = FT('VAMPIRE');
  if (vamp) {
    vamp.speed = 520;
    vamp.onCollide = function(f,e){
      if((f.data.latchCd||0)>0 || f.data.latchTimer>0) return false;
      const toEnemy = norm(e.x-f.x, e.y-f.y);
      const fangDir = norm(f.dir.x || toEnemy.x, f.dir.y || toEnemy.y);
      if (dot(toEnemy.x,toEnemy.y,fangDir.x,fangDir.y) < 0) { note(f.x,f.y-f.radius-60,'BITE MISS','#bb2038'); return false; }
      f.data.latchOffset = norm(f.x-e.x, f.y-e.y);
      f.data.latchTimer = 5; f.data.latchTick = 0; f.data.latchCd = 2.1; f.data.latchTargetId = e.id;
      if(f.isRage) f.data.bloodLinkLevel=(f.data.bloodLinkLevel||0)+1;
      note(f.x,f.y-f.radius-76,'FANG LOCK','#e43d57'); playFighterSound(f,'skill'); return true;
    };
  }

  // FLASH: deterministic Rage-only zigzag path. 1s draw, 2s immune traverse.
  const flash = FT('FLASH');
  if (flash) {
    flash.update = function(f,e,dt){
      if (f.isRage) {
        f.applyStatus('immune', .08, {source:f});
        f.data.flashRage ||= {phase:'prep', t:1, cooldown:0, path:null, hitIds:{}};
        const R=f.data.flashRage;
        if (R.phase === 'cool') { R.cooldown-=dt; if(R.cooldown<=0){R.phase='prep';R.t=1;R.path=null;R.hitIds={};} return; }
        if (R.phase === 'prep') {
          f.data.positionLocked = true; R.t -= dt;
          if (!R.path) R.path = buildFlashBouncePath(f);
          if (R.t <= 0) { R.phase='run'; R.t=2; R.startT=2; R.len=pathLength(R.path); R.damage=lerp(8,18,clamp((R.len-900)/2100,0,1)); note(f.x,f.y-f.radius-82,`ZIGZAG ${R.damage.toFixed(0)}`,'#fff06b'); }
          return;
        }
        if (R.phase === 'run') {
          f.data.positionLocked = true; f.data.dashTimer = .12;
          R.t -= dt; const t=clamp(1-R.t/2,0,1); const p=pointAlongPath(R.path,t); f.x=p.x; f.y=p.y;
          if(e && dist(f.x,f.y,e.x,e.y)<f.radius+e.radius+18 && !R.hitIds[e.id]){ R.hitIds[e.id]=true; e.takeDamage(R.damage,f,'flash-rage-zigzag'); spawnShockwave(e.x,e.y,'#fff06b',120); }
          if(R.t<=0){ R.phase='cool'; R.cooldown=.65; f.data.dashTimer=0; }
          return;
        }
      }
      // normal Flash
      f.data.cd = (f.data.cd||2) - abilityDt(f,dt);
      if(f.data.dashTimer>0){ f.data.dashTimer-=dt; f.applyStatus('immune',.08,{source:f}); }
      if(f.data.cd<=0){ f.data.cd=6.5; f.data.dashTimer=.4; f.data.dashHitIds={}; f.setDir(e.x-f.x,e.y-f.y); playFighterSound(f,'skill'); }
    };
    flash.draw = function(ctx,f){ drawSketchBlob(ctx,f.radius,'#e6d946',10); ctx.strokeStyle='#fff06b'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(-25,-45); ctx.lineTo(12,-5); ctx.lineTo(-8,-5); ctx.lineTo(24,45); ctx.stroke(); const R=f.data.flashRage; if(f.isRage && R && R.path){ctx.save();ctx.rotate(-Math.atan2(f.dir.y,f.dir.x));ctx.strokeStyle='rgba(255,240,107,.85)';ctx.lineWidth=5;ctx.setLineDash([18,10]);ctx.beginPath();for(let i=0;i<R.path.length;i++){const p=R.path[i]; i?ctx.lineTo(p.x-f.x,p.y-f.y):ctx.moveTo(p.x-f.x,p.y-f.y);}ctx.stroke();ctx.setLineDash([]);ctx.restore();} };
  }
  function buildFlashBouncePath(f){ let pts=[{x:f.x,y:f.y}], x=f.x,y=f.y, dir=norm(rand(-1,1),rand(-1,1)); const segs=4+Math.floor(rand(0,4)); for(let i=0;i<segs;i++){ let tx=dir.x>0?GAME_SIZE-35:35, ty=dir.y>0?GAME_SIZE-35:35; let ax=(tx-x)/dir.x, ay=(ty-y)/dir.y; let a=Math.min(Math.abs(ax),Math.abs(ay), rand(300,850)); if(!isFinite(a)||a<80)a=rand(300,700); x=clamp(x+dir.x*a,35,GAME_SIZE-35); y=clamp(y+dir.y*a,35,GAME_SIZE-35); pts.push({x,y}); if(x<=40||x>=GAME_SIZE-40)dir.x*=-1; if(y<=40||y>=GAME_SIZE-40)dir.y*=-1; dir=norm(dir.x+rand(-.45,.45),dir.y+rand(-.45,.45)); } return pts; }
  function pathLength(path){let L=0;for(let i=1;i<path.length;i++)L+=dist(path[i-1].x,path[i-1].y,path[i].x,path[i].y);return L;}
  function pointAlongPath(path,t){const L=pathLength(path);let need=L*t;for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=dist(a.x,a.y,b.x,b.y);if(need<=d)return {x:lerp(a.x,b.x,need/d),y:lerp(a.y,b.y,need/d)};need-=d;}return path[path.length-1];}

  // ELECTRIC: exact Rage timed charge, contact counts as charge, no collision-discharge in Rage.
  const electric = FT('ELECTRIC');
  if(electric){ electric.noRage=false; const normalUpdate = electric.update; electric.onRage = f=>{f.data.ragePulse=5;f.data.rageContactCharge=0;note(f.x,f.y-f.radius-98,'TIMED OVERCHARGE','#bde5ff');}; electric.update=function(f,e,dt){ if(f.isRage){ f.data.ragePulse=(f.data.ragePulse||5)-dt; if(f.data.ragePulse<=0&&e){f.data.ragePulse=5; const charge=Math.max(1,(f.data.wallHits||0)+(f.data.rageContactCharge||0)); const raw=0.002*((f.maxHp-f.hp)+10)*Math.pow(2,charge); const dmg=raw<=60?raw:60+(raw-60)*.25; electricDischargeVisual2(f,e,charge); e.takeDamage(dmg,f,'electric-rage-timed'); f.heal(dmg*.5,false); f.data.wallHits=0; f.data.wallNodes=[]; f.data.rageContactCharge=0;} return; } normalUpdate&&normalUpdate(f,e,dt); }; electric.onCollide=function(f,e){ if(f.isRage){f.data.rageContactCharge=(f.data.rageContactCharge||0)+1;note(f.x,f.y-f.radius-70,'CONTACT CHARGE','#bde5ff');return false;} const charge=Math.max(1,f.data.wallHits||0); if(charge>0){const lost=f.maxHp-f.hp; const dmg=0.002*(lost+10)*Math.pow(2,charge); electricDischargeVisual2(f,e,charge); e.takeDamage(dmg,f,'electric-contact'); f.data.wallHits=0; f.data.wallNodes=[];} return false; }; }
  function electricDischargeVisual2(f,e,charge){const nodes=(f.data.wallNodes||[]).slice(-24); if(!nodes.length)nodes.push({x:f.x,y:f.y}); nodes.forEach(n=>projectiles.push({type:'electric_trail',owner:f,x1:n.x,y1:n.y,x2:e.x,y2:e.y,life:.35,maxLife:.35,charge})); spawnShockwave(e.x,e.y,'#75cfff',160+charge*8); playFighterSound(f,'skill');}

  // HUNTER: remove unclear normal crit spikes, add x4 speed when target Weak.
  const hunter=FT('HUNTER');
  if(hunter){ hunter.speedModifier=(f,e)=> e&&e.hasStatus&&e.hasStatus('weak') ? 4 : (f.data.hunt>0?1.8:1); hunter.onCollide=function(f,e){ if(f.data.hitCd>0)return false; f.data.hitCd=.38; if(f.data.hunt>0){e.takeDamage(scaledByMirror(f,12),f,'hunt-mode-weak-strike'); e.applyStatus('weak',5); f.data.hunt=0; f.data.cd=5.8; spawnShockwave(e.x,e.y,'#ff3030',150); note(e.x,e.y-e.radius-88,'HUNT WEAK STRIKE','#ff3030');} else {e.takeDamage(scaledByMirror(f,4),f,'knife');} return true; }; }

  // CARD: Rage Jokers and K = direct x3 card damage.
  const card=FT('CARD');
  if(card){ card.update=function(f,e,dt){ f.data.resolvePulse=Math.max(0,(f.data.resolvePulse||0)-dt); if(f.data.phase==='show'){ f.data.showTimer-=dt; if(f.data.showTimer<=0){ const hand=f.data.hand.slice(); let dmg=f.isRage?cardRageDamageFixed(hand,f,e):cardCaoDamage(hand); if(hand.some(c=>c.rank==='K')){dmg*=3; note(f.x,f.y-f.radius-108,'KING Ä‚â€”3','#ffd0d0');} dmg=scaledByMirror(f,dmg); f.data.lastDmg=dmg; projectiles.push({type:'card_throw',owner:f,enemy:e,x:f.x,y:f.y-f.radius-64,hand,dmg,rawDmg:dmg,hybridNumeric:true,radius:34,life:2.8,maxLife:2.8,hit:false,unblockable:true}); f.data.resolvePulse=.75; f.data.hand=[]; f.data.deck=makeDeckFixed(f); f.data.phase='draw'; f.data.drawCd=1; playFighterSound(f,'skill'); } return; } f.data.drawCd-=abilityDt(f,dt); if(f.data.drawCd<=0){f.data.drawCd=1; if(!f.data.deck||!f.data.deck.length)f.data.deck=makeDeckFixed(f); f.data.hand.push(f.data.deck.pop()); playFighterSound(f,'wall'); if(f.data.hand.length>=3){f.data.phase='show';f.data.showTimer=1; f.data.lastDmg=f.isRage?cardRageDamageFixed(f.data.hand,f,e):cardCaoDamage(f.data.hand);}} }; }
  function makeDeckFixed(owner){const suits=['Ă¢â„¢Â ','Ă¢â„¢Â¥','Ă¢â„¢Â¦','Ă¢â„¢Â£'], ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K']; const deck=[]; for(const s of suits)for(const r of ranks)deck.push({rank:r,suit:s}); if(owner&&owner.isRage)deck.push({rank:'RJ',suit:'Ă¢Ëœâ€¦'},{rank:'BJ',suit:'Ă¢Ëœâ€ '}); for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]];} return deck;}
  function cardRageDamageFixed(hand,owner,enemy){let total=0; for(const c of hand){ if(c.rank==='RJ')total+=Math.ceil((owner.maxHp-owner.hp)*.5); else if(c.rank==='BJ')total+=Math.ceil(enemy.hp*.5); else if(c.rank==='A')total+=1; else if(['10','J','Q','K'].includes(c.rank))total+=10; else total+=parseInt(c.rank)||0;} return Math.min(120,total);}

  // MATH: expression never interrupted, Rage expression visible and correct distribution.
  makeRageMathExpression=function(){const mag=Math.max(1,Math.ceil(100*Math.pow(Math.random(),2.25))); const sign=Math.random()<.5?-1:1; const result=sign*mag; const a=Math.ceil(rand(3,19)),b=Math.ceil(rand(2,12)),c=Math.ceil(rand(1,9)),d=Math.ceil(rand(1,7)); return {formula:`Ă¢Å’Â(( ${a}Ă‚Â² Ă¢Ë†â€™ ${b}Ä‚â€”${c} + Ă¢Ë†Â${d*d}) Ä‚Â· 1)Ă¢Å’â€¹ = ${result}`, result};};
  const math=FT('MATH'); if(math){ math.update=function(f,e,dt){ f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){f.data.cd=5; let formula,result,isRageFormula=false; if(f.isRage){const rage=makeRageMathExpression(); result=rage.result; formula=rage.formula; isRageFormula=true;} else {const X=Math.round(f.x/50),Y=Math.round(f.y/50),A=Math.round(e.x/50),B=Math.max(1,Math.round(e.y/50)); result=Math.round((X-Y)*A/B); if(result===0)result=(Math.random()<.5?-1:1); formula=`(${X}Ă¢Ë†â€™${Y})Ä‚â€”${A}/${B}`;} projectiles.push({type:'math_formula',owner:f,enemy:e,formula,value:result,rage:isRageFormula,life:4.2,maxLife:4.2,phase:'typing',age:0,x:f.x,y:f.y,hit:false,launched:false,vx:0,vy:0,uninterruptible:true}); playFighterSound(f,'skill'); }}; }

  // MATH V2: graph hand-drawn over time.
  const oldSpawnGraph = spawnMathV2Graph;
  spawnMathV2Graph=function(owner,label,fn){ oldSpawnGraph(owner,label,fn); const g=projectiles.filter(p=>p.type==='math_v2_graph'&&p.owner===owner).slice(-1)[0]; if(g){g.drawProgress=0;g.handDraw=true;} };

  // SNIPER: previous 4 nests with hidden immune reload, vulnerable aim, reverse recoil after normal shot.
  const sniper=FT('SNIPER'); if(sniper){ sniper.update=function(f,e,dt){ if(f.isRage){ f.data.positionLocked=true; if((f.data.reload||0)>0){f.data.reload-=dt; f.applyStatus('immune',.08,{source:f}); f.data.hiddenReload=true; if(f.data.reload<=0){const best=f.data.nests.reduce((a,b)=>dist(b.x,b.y,e.x,e.y)>dist(a.x,a.y,e.x,e.y)?b:a,f.data.nests[0]); f.x=best.x; f.y=best.y; f.data.aim=3; f.data.aimMax=3; f.data.hiddenReload=false; note(f.x,f.y-f.radius-70,'AIMING','#ff8b8b');} return;} if(f.data.aim>0){f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(dist(f.x,f.y,e.x,e.y)<300 && (f.data.aimMax-f.data.aim)>.45){f.data.reload=3; f.data.aim=0; note(f.x,f.y-f.radius-70,'RELOCATE','#ff8b8b'); return;} if(f.data.aim<=0){const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); const dmg=30*ratio; projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,dmg),f,'sniper-shot'); f.data.reload=3; playFighterSound(f,'skill');} return;} f.data.reload=(f.data.reload||0)-abilityDt(f,dt); if(f.data.reload<=0){f.data.reload=3;} return;} if(f.data.aim>0){f.data.positionLocked=true; f.data.aim-=dt; f.setDir(e.x-f.x,e.y-f.y); if(f.data.aim<=0){const dir=norm(e.x-f.x,e.y-f.y); const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); const dmg=30*ratio; projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(scaledByMirror(f,dmg),f,'sniper-shot'); f.x=clamp(f.x-dir.x*150,f.radius,GAME_SIZE-f.radius); f.y=clamp(f.y-dir.y*150,f.radius,GAME_SIZE-f.radius); f.data.cd=8; playFighterSound(f,'skill');} return;} f.data.cd-=abilityDt(f,dt); if(f.data.cd<=0){const ratio=clamp(dist(f.x,f.y,e.x,e.y)/Math.hypot(GAME_SIZE,GAME_SIZE),0,1); f.data.aim=Math.max(1.2,0.55+1.35*ratio); f.data.aimMax=f.data.aim; note(f.x,f.y-f.radius-70,'LOCK ON','#ff8b8b');} }; }

  // TIME: mark rewind restores Time HP/pos; enemy only refunded 50% of Time damage.
  const timeFT=FT('TIME'); if(timeFT){ timeFT.update=function(f,e,dt){ f.data.clockCd=(f.data.clockCd||4)-dt; if(f.data.clockCd<=0){f.data.clockCd=4; const num=clockDamageValue(); e.takeDamage(num,f,'clock-hour'); projectiles.push({type:'clock_flash',owner:f,num,life:.9,maxLife:.9}); note(e.x,e.y-e.radius-80,`CLOCK ${num}`,'#efeaff');}
    if(f.data.mark){const m=f.data.mark; m.timer-=dt; if(m.timer<=0){f.x=m.x;f.y=m.y;f.hp=Math.max(f.hp,m.hp); if(m.damageDealt&&e) e.heal(m.damageDealt*.5,false); if(f.isRage&&m.damageTaken>0) spawnTimeRift(f,f.x,f.y,m.damageTaken); f.data.mark=null; f.data.markCd=9; note(f.x,f.y-f.radius-90,'REWIND 50% REFUND','#efeaff');} return;}
    f.data.markCd=(f.data.markCd||2)-abilityDt(f,dt); if(f.data.markCd<=0){f.data.mark={x:f.x,y:f.y,hp:f.hp,timer:3,damageDealt:0,damageTaken:0}; f.data.markCd=99; projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3}); note(f.x,f.y-f.radius-85,'TIME MARK','#efeaff'); playFighterSound(f,'skill');}
  }; }

  // WOLF: visible pounce only inside scent, no sticking after bite.
  const wolf=FT('WOLF'); if(wolf){ wolf.update=function(f,e,dt){ f.data.scentCd=(f.data.scentCd||2)-abilityDt(f,dt); f.data.biteCd=Math.max(0,(f.data.biteCd||0)-dt); f.data.pounceTimer=Math.max(0,(f.data.pounceTimer||0)-dt); if(f.data.scentCd<=0){f.data.scentCd=7; e.applyStatus('scent',5,{source:f}); note(e.x,e.y-e.radius-90,'BLOOD SCENT','#ff3030');}
    const base=160; const rageBonus=f.isRage?Math.max(0,(e.maxHp-e.hp))*5:0; const inScent=e.hasStatus('scent')&&dist(f.x,f.y,e.x,e.y)<base+rageBonus; if(inScent&&f.data.biteCd<=0){const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y); f.data.pounceTimer=.55; f.data.biteCd=2; note(f.x,f.y-f.radius-76,'POUNCE','#ff3030');} if(f.data.pounceTimer>0){const n=norm(e.x-f.x,e.y-f.y); f.setDir(n.x,n.y);} };
    wolf.speedModifier=f=>f.data.pounceTimer>0?2.25:1; wolf.onCollide=function(f,e){ if(f.data.pounceTimer>0){let dmg=11; if(f.isRage){const chance=lerp(.5,1,clamp((50-Math.max(0,f.hp))/50,0,1)); if(Math.random()<chance)e.applyStatus('weak',4);} e.takeDamage(scaledByMirror(f,dmg),f,'wolf-bite'); const n=norm(f.x-e.x,f.y-e.y); f.x=clamp(f.x+n.x*100,f.radius,GAME_SIZE-f.radius); f.y=clamp(f.y+n.y*100,f.radius,GAME_SIZE-f.radius); f.data.pounceTimer=0; spawnShockwave(e.x,e.y,'#ff3030',120); return true;} return false;}; }

  // WITCH: actual throw talisman/potion visuals and icons.
  const witch=FT('WITCH'); if(witch){ const ou=witch.update; witch.update=function(f,e,dt){ const before=f.data.curseCd; ou(f,e,dt); if(before>0 && f.data.curseCd>6.5){projectiles.push({type:'witch_talisman',owner:f,x:f.x,y:f.y,targetId:e.id,life:.8,maxLife:.8});} }; }

  // PIRATE: one rope only, +2 item lifetime, invulnerable during pull and 1s after, stronger visuals.
  const pirate=FT('PIRATE'); if(pirate){ pirate.update=function(f,e,dt){ f.data.invulnAfter=Math.max(0,(f.data.invulnAfter||0)-dt); if(f.data.invulnAfter>0) f.applyStatus('immune',.08,{source:f}); f.data.lootCd-=abilityDt(f,dt); if(f.data.lootCd<=0){f.data.lootCd=3; addPirateLoot(f); const loot=projectiles.filter(p=>p.type==='pirate_loot'&&p.owner===f).slice(-1)[0]; if(loot){loot.life+=2; loot.maxLife+=2;}} f.data.anchorCd-=abilityDt(f,dt); if(f.data.anchorCd<=0&&!projectiles.some(p=>p.type==='pirate_anchor'&&p.owner===f&&p.life>0)){f.data.anchorCd=7; triggerPirateAnchor(f,e);} } }

  // PAINTER: guaranteed homing ink if not blocked, cd 4s.
  const painter=FT('PAINTER'); if(painter){ painter.update=function(f,e,dt){ f.data.colorTimer-=dt; if(f.data.colorTimer<=0){f.data.colorTimer=2;f.data.colorIndex=(f.data.colorIndex+1)%3;} f.data.blobCd-=abilityDt(f,dt); if(e&&f.data.blobCd<=0){f.data.blobCd=3.45; spawnPainterBlob(f,e);} if(f.data.paintTimer>0){f.data.paintTimer-=dt; f.data.paintDrop-=dt; if(f.data.paintDrop<=0){f.data.paintDrop=.17; const kind=['red','blue','yellow'][f.data.colorIndex]; spawnPainterInk(f,f.data.lastPaintX??f.x,f.data.lastPaintY??f.y,kind,f.x,f.y); f.data.lastPaintX=f.x;f.data.lastPaintY=f.y;}}}; }
  spawnPainterBlob=function(owner,enemy){const kinds=['red','blue','yellow']; const kind=kinds[Math.floor(Math.random()*3)]; projectiles.push({type:'paint_blob',owner,enemy,homing:true,kind,x:owner.x,y:owner.y,vx:0,vy:0,radius:25,life:2.1,maxLife:2.1}); note(owner.x,owner.y-owner.radius-85,`INK ${kind.toUpperCase()}`,'#fff4a0');};

  // KUNGFU: clearer combo VFX, max trauma 30, hidden damage detonation after cap.
  const kung=FT('KUNGFU')||FT('MONK'); if(kung){ kung.name='KUNGFU'; kung.onCollide=function(f,e){ if(f.data.hitCd>0)return false; f.data.hitCd=.45; if(f.data.rushTimer>0){ if(f.data.rushHitCd<=0){ if((e.statuses.innerTrauma?.stacks||0)>=30){ e.data.kungfuHidden=(e.data.kungfuHidden||0)+2; note(e.x,e.y-e.radius-105,`HIDDEN ${e.data.kungfuHidden}`,'#ff9b50'); } else addInnerTrauma(e,1); f.data.rushHitCd=.16; projectiles.push({type:'kungfu_qi',owner:f,x:e.x,y:e.y,life:.35,maxLife:.35}); playFighterSound(f,'wall'); } return true; } f.data.combo=(f.data.combo||0)+1; f.data.comboTimer=5; const c=f.data.combo; note(f.x,f.y-f.radius-78,`COMBO ${c}`,'#ffd28a'); if(c===1){e.takeDamage(3,f,'kungfu-punch');projectiles.push({type:'kungfu_qi',owner:f,x:e.x,y:e.y,life:.45,maxLife:.45});} else if(c===2){e.applyStatus('stun',1,{source:f}); e.applyStatus('rapidPunch',1,{source:f,tick:0}); f.data.comboAnim=1; note(e.x,e.y-e.radius-88,'RAPID FISTS','#ffd28a');} else if(c===3){e.takeDamage(10,f,'giant-palm'); const n=norm(e.x-f.x,e.y-f.y); e.applyStatus('push',.7,{x:n.x,y:n.y,strength:1900}); projectiles.push({type:'kungfu_palm',owner:f,x:f.x,y:f.y,vx:n.x*520,vy:n.y*520,life:1.1,maxLife:1.1});} else if(c===4&&f.isRage){e.applyStatus('stun',.8,{source:f}); f.heal(10,false); projectiles.push({type:'kungfu_rage_seal',owner:f,x:e.x,y:e.y,life:1,maxLife:1});} else if((!f.isRage&&c>=4)||(f.isRage&&c>=5)){const RUSH_SECS=f.type?.arsenalShell?2.5:5; /* Arsenal A-CORR-3 ADAPT */ e.applyStatus('stun',RUSH_SECS,{source:f}); f.data.rushTimer=RUSH_SECS; f.data.rushTargetId=e.id; f.data.rushAnchor={x:e.x,y:e.y}; f.data.combo=0; const nd=norm((e.x<500?1000:0)-f.x,(e.y<500?1000:0)-f.y); f.setDir(nd.x,nd.y); note(e.x,e.y-e.radius-100,'TRAUMA RUSH','#ff9b50');} return true;}; }
  const oldAddTrauma = addInnerTrauma;
  addInnerTrauma=function(target,count=1){ target.applyStatus('innerTrauma',Infinity,{source:null}); target.statuses.innerTrauma.stacks=clamp((target.statuses.innerTrauma.stacks||0)+count,0,30); note(target.x,target.y-target.radius-92,`TRAUMA ${target.statuses.innerTrauma.stacks}`,'#ff9b50');};

  // SLIME exact spawn/split helpers.
  const slime=FT('SLIME'); if(slime){ slime.update=function(f,e,dt){ f.data.childSpawnCd=Math.max(0,(f.data.childSpawnCd||0)-dt); f.data.cloneCd=Math.max(0,(f.data.cloneCd||0)-dt); f.data.gelArmorTimer=Math.max(0,(f.data.gelArmorTimer||0)-dt); if(f.data.gelArmorTimer<=0){f.data.gelArmorReduction=0;f.data.gelArmorStacks=0;} }; }
  function addPrecisionSlimeChild(owner, angle, hp=16, damage=4){ projectiles.push({type:'slime_child',owner,angle,radius:24,hp,life:4,maxLife:4,hitCd:{},blockCd:0,damageDone:0,damage}); }
  function splitPrecisionSlime(f){ const hp=Math.max(5,f.hp); const ft=FT('SLIME'); const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===f&&p.hp>0); for(let i=0;i<2;i++){f.teamId=f.teamId||f.id; const c=new Fighter(f.id,clamp(f.x+rand(-90,90),80,920),clamp(f.y+rand(-90,90),80,920),ft); c.teamId=f.teamId; c.hp=hp; c.data.cloneDepth=(f.data.cloneDepth||0)+1; c.dir=norm(rand(-1,1),rand(-1,1)); fighters.push(c); kids.forEach(k=>addPrecisionSlimeChild(c,Math.random()*TAU,Math.max(1,k.hp*.5),Math.max(.5,(k.damage||4)*.5)));} note(f.x,f.y-f.radius-110,'MITOSIS','#caffbb'); spawnShockwave(f.x,f.y,'#7be66f',220); }

  // PUPPET: no limit, every wall touch creates effigy; old overflow already intercepted above.
  const puppet=FT('PUPPET'); if(puppet){ puppet.onWallBounce=function(f,wall){ spawnPuppetEffigyFixed(f,wall); }; }
  function spawnPuppetEffigyFixed(owner,wall){ const pos={x:owner.x,y:owner.y}; if(wall==='left')pos.x=0; if(wall==='right')pos.x=GAME_SIZE; if(wall==='top')pos.y=0; if(wall==='bottom')pos.y=GAME_SIZE; projectiles.push({type:'puppet_effigy',owner,x:pos.x,y:pos.y,radius:75,hp:10,life:Infinity,wall,order:matchClock+Math.random()*0.001}); note(pos.x,pos.y-85,'EFFIGY','#d7b27a'); const list=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===owner&&p.wall===wall&&p.hp>0&&p.life>0); if(list.length>=5){list.slice(0,5).forEach(p=>p.life=0); projectiles.push({type:'straw_monster',owner,x:pos.x,y:pos.y,radius:55,hp:30,life:Infinity,tick:0}); note(pos.x,pos.y-105,'STRAW MONSTER','#d7b27a');} }

  // Projectile runtime precision additions.
  const prevUP = updateProjectiles;
  updateProjectiles=function(dt){
    for(const p of projectiles){ const owner=p.owner, enemy=owner?EN(owner):null;
      if(p.type==='paint_blob'&&p.homing&&enemy){const n=norm(enemy.x-p.x,enemy.y-p.y); p.vx=n.x*900; p.vy=n.y*900;}
      if(p.type==='slime_child'&&p.hp<=0&&p.life>0){ createSlimeMucus(p.x,p.y,owner); p.life=0; }
      if(p.type==='puppet_effigy'&&p.hp<=0)p.life=0;
      if(p.type==='kungfu_qi'||p.type==='kungfu_palm'||p.type==='kungfu_rage_seal'||p.type==='witch_talisman') { /* visual */ }
    }
    prevUP(dt);
    for(const f of fighters){ if(f&&f.data&&f.data.kungfuHidden>0&&!f.data.kungfuBombTimer){f.data.kungfuBombTimer=3;} if(f&&f.data&&f.data.kungfuBombTimer){f.data.kungfuBombTimer-=dt; if(f.data.kungfuBombTimer<=0){const dmg=f.data.kungfuHidden||0; f.data.kungfuHidden=0; f.data.kungfuBombTimer=0; f.takeDamage(dmg,null,'kungfu-hidden-burst'); note(f.x,f.y-f.radius-110,`HIDDEN BURST ${dmg}`,'#ff9b50');}} }
  };
  const prevDP=drawProjectiles;
  drawProjectiles=function(ctx){ prevDP(ctx); for(const p of projectiles){ctx.save(); if(p.type==='kungfu_qi'){ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#ffffff';ctx.lineWidth=8;ctx.beginPath();ctx.arc(p.x,p.y,55*(1-p.life/p.maxLife),0,TAU);ctx.stroke();} if(p.type==='kungfu_palm'){ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle='rgba(255,210,138,.28)';ctx.strokeStyle='#ffd28a';ctx.lineWidth=8;ctx.beginPath();ctx.ellipse(p.x,p.y,250,145,Math.atan2(p.vy,p.vx),0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#ffe0a0';ctx.font='900 42px serif';ctx.textAlign='center';ctx.fillText('Ă¦ÂÅ’',p.x,p.y+16);} if(p.type==='kungfu_rage_seal'){ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#ff9b50';ctx.lineWidth=8;ctx.beginPath();ctx.arc(p.x,p.y,80,0,TAU);ctx.stroke();ctx.fillStyle='#ffdda8';ctx.font='900 34px serif';ctx.textAlign='center';ctx.fillText('Ă¥Â°Â',p.x,p.y+12);} if(p.type==='witch_talisman'){const t=fighters.find(f=>f.id===p.targetId); if(t){ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#e49aff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(t.x,t.y);ctx.stroke();ctx.fillStyle='#f7e8ff';ctx.font='900 22px serif';ctx.textAlign='center';ctx.fillText('Ă§Â¬Â¦',t.x,t.y-t.radius-96);}} ctx.restore(); }};

  // Crystal diamond path correction: any cage diamonds get non-axis irrational angle if too linear.
  const oldCheckCrystal = checkCrystalDiamond;
  checkCrystalDiamond=function(owner){ oldCheckCrystal(owner); projectiles.filter(p=>p.type==='crystal_cage'&&p.owner===owner).forEach(c=>{ if(c.diamond){ const a=-Math.PI/2+Math.PI/7; const sp=Math.hypot(c.diamond.vx||1,c.diamond.vy||1)||owner.baseSpeed*5.8; c.diamond.x=c.x+Math.cos(-Math.PI/2)*(c.radius||220)*.75; c.diamond.y=c.y+Math.sin(-Math.PI/2)*(c.radius||220)*.75; c.diamond.vx=Math.cos(a)*sp; c.diamond.vy=Math.sin(a)*sp; }}); };

  populateRoster();
})();
