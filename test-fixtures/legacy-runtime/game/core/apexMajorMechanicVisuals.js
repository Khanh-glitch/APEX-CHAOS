// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function majorMechanicVisualPatch(){
    const FT = name => FighterTypes.find(f => f.name === name);
    const getEnemy = f => fighters.find(x => x && f && x.id !== f.id);

    function note(x,y,t,c){ floatingTexts.push(new FloatingText(x,y,t,c)); }
    function getFt(name){ return FT(name); }

    // Utility: store per-fighter UI tags for learned / copied skills.
    function addSkillBadge(f, label, color){ f.data.skillBadge = {label, color: color || f.color, pulse: .8}; }

    // RUBBER: permanent sub-skill must be visible and cast like a real second skill.
    const rubber = FT('RUBBER');
    if (rubber) {
        const oldUpdate = rubber.update;
        const oldDraw = rubber.draw;
        rubber.update = function(f,e,dt){
            oldUpdate(f,e,dt);
            f.data.subData ||= {cd:2.5};
            f.data.subData.cd = Math.max(0,(f.data.subData.cd||0)-abilityDt(f,dt));
            if (f.data.subSkill && f.data.afterTier>=5 && f.data.subData.cd<=0 && e) {
                const sub = f.data.subSkill.name || String(f.data.subSkill);
                castRubberSubSkill(f,e,sub);
                f.data.subData.cd = rubberSubCooldown(sub);
                addSkillBadge(f, `SUB: ${sub}`, '#ffb6d2');
            }
        };
        rubber.draw = function(ctx,f){
            if (oldDraw) oldDraw(ctx,f);
            if (f.data.subSkill) {
                ctx.save(); ctx.rotate(-Math.atan2(f.dir.y,f.dir.x));
                const sub = f.data.subSkill.name || String(f.data.subSkill);
                ctx.fillStyle='rgba(0,0,0,.78)'; ctx.strokeStyle='#ffb6d2'; ctx.lineWidth=4;
                ctx.fillRect(-74,-f.radius-72,148,28); ctx.strokeRect(-74,-f.radius-72,148,28);
                ctx.fillStyle='#ffd5e8'; ctx.font='900 12px monospace'; ctx.textAlign='center';
                ctx.fillText(`${sub} CD:${(f.data.subData?.cd||0).toFixed(1)}`.slice(0,18),0,-f.radius-52);
                ctx.restore();
            }
        };
    }
    function rubberSubCooldown(sub){
        if (['BLADE','FLASH','HUNTER','SAW'].includes(sub)) return 3.2;
        if (['VOLCANO','BLACK_HOLE','CRYSTAL','MATH','MATH_V2','SNIPER'].includes(sub)) return 6.5;
        return 4.6;
    }
    function castRubberSubSkill(f,e,sub){
        const pow=.65; recordSkill(f); playFighterSound(f,'skill');
        note(f.x,f.y-f.radius-92,`RUBBER USES ${sub}`,'#ffb6d2');
        if(sub==='BLADE'){ const n=norm(e.x-f.x,e.y-f.y); projectiles.push({type:'blade_wave',owner:f,x:f.x,y:f.y,vx:n.x*950,vy:n.y*950,life:1.3,maxLife:1.3,damage:2.4,halfWidth:110,bounces:1,hitIds:{},rubberSub:true}); }
        else if(sub==='TOXIC'){ projectiles.push({type:'toxic_puddle',owner:f,x:e.x,y:e.y,radius:66,life:2.5,maxLife:2.5}); }
        else if(sub==='ICE'){ const n=norm(e.x-f.x,e.y-f.y); projectiles.push({type:'ice_lane',owner:f,x1:f.x,y1:f.y,x2:f.x+n.x*1000,y2:f.y+n.y*1000,halfWidth:120,life:3,maxLife:3,hitCd:{},rubberSub:true}); }
        else if(sub==='VOLCANO'){ projectiles.push({type:'meteor',owner:f,x:e.x+rand(-80,80),y:e.y+rand(-80,80),radius:75,delay:.25,life:.6,hit:false,volcanoAmp:1.7,rubberSub:true}); }
        else if(sub==='BLACK_HOLE'){ projectiles.push({type:'gravity_well',owner:f,x:e.x,y:e.y,life:1.8,maxLife:1.8,core:85,radius:170,absorbedDamage:0,rubberSub:true}); }
        else if(sub==='SNIPER'){ const dmg=clamp(dist(f.x,f.y,e.x,e.y)/1000*20,2,20); e.takeDamage(dmg,f,'rubber-sniper'); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.22,maxLife:.22}); }
        else if(sub==='MATH'){ const val=Math.ceil(rand(5,18)); if(Math.random()<.5) e.takeDamage(val,f,'rubber-math'); else f.heal(val,false); projectiles.push({type:'math_formula',owner:f,enemy:e,x:f.x,y:f.y,value:Math.random()<.5?-val:val,life:.65,maxLife:.65,rubberSub:true}); }
        else { e.takeDamage(4*pow,f,'rubber-sub-'+sub.toLowerCase()); spawnShockwave(e.x,e.y,f.color,100); }
    }

    // VAMPIRE: front-half bite check + speed nerf.
    const vamp = FT('VAMPIRE');
    if (vamp) {
        vamp.speed = 500;
        vamp.onCollide = function(f,e){
            if((f.data.latchCd||0)>0 || f.data.latchTimer>0) return false;
            const toEnemy = norm(e.x-f.x, e.y-f.y);
            const faceDot = dot(toEnemy.x,toEnemy.y,f.dir.x,f.dir.y);
            if (faceDot < 0.1) { note(f.x,f.y-f.radius-60,'MISS BITE','#bb2038'); return false; }
            f.data.latchTimer=5; f.data.latchTargetId=e.id; f.data.latchCd=7.2; f.data.latchOffset={x:f.x-e.x,y:f.y-e.y};
            if(f.isRage) f.data.bloodLinkLevel=(f.data.bloodLinkLevel||0)+1;
            playFighterSound(f,'skill'); note(f.x,f.y-f.radius-76,'FANG LOCK','#e43d57'); return true;
        };
    }

    // MAGNET: normal field blocks projectiles only; Rage field performs hard wall slam.
    const magnet = FT('MAGNET');
    if (magnet) {
        magnet.update = function(f,e,dt){
            f.data.cd -= abilityDt(f,dt);
            if(f.data.cd<=0){ f.data.cd=6.6; f.data.fieldTimer=3.1; projectiles.push({type:'magnet_field',owner:f,radius:310,life:3.1,maxLife:3.1,hitCd:{},inside:{},slamCd:0,normalOnly:!f.isRage}); playFighterSound(f,'skill'); }
            if(f.data.fieldTimer>0){ f.data.fieldTimer-=dt; }
        };
    }

    // ELECTRIC Rage comeback: timed discharge and 50% lifesteal.
    const electric = FT('ELECTRIC');
    if (electric) {
        electric.noRage = false;
        electric.onRage = f => { f.data.rageTimer=0; f.data.ragePulse=5; f.data.rageContactCharge=0; note(f.x,f.y-f.radius-100,'OVERCHARGE RAGE','#bde5ff'); };
        const oldUpdate = electric.update;
        const oldCollide = electric.onCollide;
        electric.update = function(f,e,dt){
            if(oldUpdate) oldUpdate(f,e,dt);
            if(f.isRage){
                f.data.rageContactCd=Math.max(0,(f.data.rageContactCd||0)-dt);
                f.data.ragePulse = (f.data.ragePulse||5) - dt;
                if(f.data.ragePulse<=0 && e){
                    f.data.ragePulse=5;
                    const charge=clamp(Math.max(1,(f.data.wallHits||0)+(f.data.rageContactCharge||0)+1),1,8);
                    const lost=f.maxHp-f.hp;
                    const raw=0.002*(lost+10)*Math.pow(2,charge);
                    const dmg = raw<=60?raw:60+(raw-60)*0.25;
                    electricDischargeVisual(f,e,charge);
                    e.takeDamage(dmg,f,'electric-rage-overcharge');
                    f.heal(dmg*.5,false);
                    f.data.wallHits=0; f.data.wallNodes=[]; f.data.rageContactCharge=0;
                    note(f.x,f.y-f.radius-104,`RAGE ZAP +${(dmg*.5).toFixed(1)}`,'#bde5ff');
                }
            }
        };
        electric.onCollide = function(f,e){ if(f.isRage){ if((f.data.rageContactCd||0)<=0){ f.data.rageContactCharge=(f.data.rageContactCharge||0)+1; f.data.rageContactCd=.45; note(e.x,e.y-e.radius-76,`CONTACT CHARGE ${f.data.rageContactCharge}`,'#bde5ff'); } return false; } return oldCollide ? oldCollide(f,e) : false; };
    }
    function electricDischargeVisual(f,e,charge){
        const nodes = (f.data.wallNodes||[]).slice(-18);
        if(!nodes.length) nodes.push({x:f.x,y:f.y});
        nodes.forEach(n => projectiles.push({type:'electric_trail',owner:f,x1:n.x,y1:n.y,x2:e.x,y2:e.y,life:.35,maxLife:.35,charge}));
        spawnShockwave(e.x,e.y,'#75cfff',160+charge*8); playFighterSound(f,'skill');
    }

    // TOXIC: make charge heal obvious and reliable.
    const oldStartToxicCharge = startToxicCharge;
    startToxicCharge = function(source,target){ oldStartToxicCharge(source,target); if(source&&source.data&&source.data.toxicCharge) source.data.toxicCharge.visible=true; };

    // BLACK HOLE Rage: base explosion + x2 absorbed damage.
    function blackHoleExplode(p, enemy){
        if(!p || p.exploded) return; p.exploded=true; const owner=p.owner;
        if(enemy){ const d=dist(enemy.x,enemy.y,p.x,p.y); const base=d<=200?lerp(20,5,clamp(d/200,0,1)):0; const refl=(p.absorbedDamage||0)*2; const dmg=base+refl; if(dmg>0) enemy.takeDamage(dmg,owner,refl>0?'black-hole-rage-explosion':'black-hole-explosion'); }
        spawnShockwave(p.x,p.y,'#201020',280+(p.absorbedDamage||0)*3); triggerFlash(0,0,0,.45);
    }

    // HUNTER: clear crit and +200% chase speed when enemy weak.
    const hunter=FT('HUNTER');
    if(hunter){ hunter.speedModifier = (f,e) => (e && e.hasStatus && e.hasStatus('weak')) ? 3.0 : (f.data.huntTimer>0?1.65:1); }

    // DRUM: solo is 80% damage reduction via takeDamage above, remove total immunity in update if any.
    const drum=FT('DRUM');
    if(drum){ const od=drum.update; drum.update=function(f,e,dt){ od(f,e,dt); if(f.data.rageSolo>0 && f.statuses.immune) f.statuses.immune.timer=0; }; }

    // CARD: add Jokers in Rage deck and ensure values.
    const oldMakeDeck = makeDeck;
    makeDeck = function(){ const deck=oldMakeDeck(); return deck; };
    const oldCardRageDamage = cardRageDamage;
    cardRageDamage = function(hand, owner, enemy){
        let total=0;
        for(const c of hand){ if(c.rank==='RJ') total += Math.ceil((owner.maxHp-owner.hp)*.5); else if(c.rank==='BJ') total += Math.ceil(enemy.hp*.5); else if(c.rank==='A') total+=1; else if(['J','Q','K','10'].includes(c.rank)) total+=10; else total += parseInt(c.rank)||0; }
        return Math.min(99,total);
    };
    const card=FT('CARD');
    if(card){ const oc=card.update; card.update=function(f,e,dt){
        // Inject 2 jokers into deck only while Rage, if not already present.
        f.data.deck ||= makeDeck();
        if(f.isRage && !f.data.jokersInjected){ f.data.deck.push({rank:'RJ',suit:'Ă¢Ëœâ€¦'},{rank:'BJ',suit:'Ă¢Ëœâ€ '}); f.data.jokersInjected=true; note(f.x,f.y-f.radius-90,'JOKERS IN DECK','#fff2a0'); }
        oc(f,e,dt);
    }; }

    // MATH Rage distribution: triangular toward zero, no zero.
    makeRageMathExpression = function(){
        let mag = Math.max(1, Math.ceil(100 * Math.pow(Math.random(), 2.15)));
        const sign = Math.random()<.5?-1:1;
        const result = sign * mag;
        const a = Math.ceil(rand(3,19)), b=Math.ceil(rand(2,12)), c=Math.ceil(rand(1,9));
        return { expr:`Ă¢Å’Â(( ${a}Ă‚Â² Ă¢Ë†â€™ ${b}Ä‚â€”${c} ) Ă‚Â± chaos)Ă¢Å’â€¹ = ${result}`, result };
    };

    // MATH V2 graph hand-draw progress.
    const oldSpawnMathV2Graph = spawnMathV2Graph;
    spawnMathV2Graph = function(owner, expr){ oldSpawnMathV2Graph(owner, expr); const g=projectiles.findLast?projectiles.findLast(p=>p.type==='math_v2_graph'&&p.owner===owner):[...projectiles].reverse().find(p=>p.type==='math_v2_graph'&&p.owner===owner); if(g){g.drawProgress=0;g.handDraw=true;} };

    // SNIPER: reverse recoil after shot; Rage hidden reload immune, vulnerable only while aiming; relocate resets aim.
    const sniper=FT('SNIPER');
    if(sniper){
        sniper.update=function(f,e,dt){
            f.data.cd-=abilityDt(f,dt);
            if(f.data.recoilTimer>0){ f.data.recoilTimer-=dt; f.applyStatus('speed',.1,{mult:1.8}); }
            if(f.isRage){
                f.data.reload=(f.data.reload||0)-dt;
                if(f.data.reload>0){ f.applyStatus('immune',.1,{source:f}); f.data.hiddenReload=true; return; }
                f.data.hiddenReload=false;
                f.data.aim=(f.data.aim||3)-dt;
                f.data.aiming=true;
                if(e && dist(f.x,f.y,e.x,e.y)<300 && f.data.aim>0.2){ relocateSniper(f,e); f.data.reload=3; f.data.aim=3; return; }
                if(f.data.aim<=0){ sniperShoot(f,e,true); f.data.reload=3; f.data.aim=3; }
            } else if(f.data.cd<=0){ f.data.cd=8; sniperShoot(f,e,false); }
        };
        sniper.draw=function(ctx,f){ drawPolygon(ctx,[[-70,-35],[20,-52],[58,-18],[60,32],[-46,54]],'#24282d','#a7adb5',5);ctx.fillStyle='#111';ctx.fillRect(10,-12,82,18);ctx.strokeStyle='#d6d6d6';ctx.lineWidth=4;ctx.strokeRect(12,-14,40,22);ctx.fillStyle='#d7dde5';ctx.font='900 13px monospace';ctx.textAlign='center';ctx.fillText(f.data.hiddenReload?'HIDDEN':'SNIPER',-10,8); };
    }
    function relocateSniper(f,e){ const holes=[[110,110],[890,110],[110,890],[890,890]]; holes.sort((a,b)=>dist(b[0],b[1],e.x,e.y)-dist(a[0],a[1],e.x,e.y)); f.x=holes[0][0]; f.y=holes[0][1]; note(f.x,f.y-f.radius-70,'RELOCATE','#ff5555'); }
    function sniperShoot(f,e,rage){ const d=dist(f.x,f.y,e.x,e.y); const dmg=clamp(d/1300*30,0,30); projectiles.push({type:'sniper_laser',owner:f,x1:f.x,y1:f.y,x2:e.x,y2:e.y,life:.45,maxLife:.45}); e.takeDamage(dmg,f,rage?'rage-sniper-shot':'sniper-shot'); const n=norm(f.x-e.x,f.y-e.y); f.setDir(n.x,n.y); f.data.recoilTimer=.8; playFighterSound(f,'skill'); }

    // SLIME rework counters and clones.
    const slime=FT('SLIME');
    if(slime){
        slime.init=function(f){ f.data.splitCd=0; f.data.childCounter=[]; f.data.shockCounter=[]; f.data.gelArmorTimer=0; f.data.cloneDepth=f.data.cloneDepth||0; };
        slime.update=function(f,e,dt){
            f.data.splitCd=Math.max(0,(f.data.splitCd||0)-dt); f.data.gelArmorTimer=Math.max(0,(f.data.gelArmorTimer||0)-dt); if(f.data.gelArmorTimer<=0)f.data.gelArmorReduction=0;
            f.data.childCounter=(f.data.childCounter||[]).filter(x=>matchClock-x.t<=5); f.data.shockCounter=(f.data.shockCounter||[]).filter(x=>matchClock-x.t<=1);
            const csum=f.data.childCounter.reduce((a,b)=>a+b.amount,0);
            if(csum>=4 && f.data.splitCd<=0){ addSlimeChild(f, Math.random()*TAU, 8, 4); f.data.childCounter=[]; f.data.splitCd=.65; note(f.x,f.y-f.radius-80,'+ SLIME CHILD','#caffbb'); }
            const ssum=f.data.shockCounter.reduce((a,b)=>a+b.amount,0);
            if(ssum>f.hp*.20 && f.data.cloneDepth<3){ splitSlimeClone(f); f.data.shockCounter=[]; }
            if(f.isRage && f.data.gelArmorTimer>0) f.data.gelArmorReduction=Math.max(f.data.gelArmorReduction||0,.3);
        };
    }
    function splitSlimeClone(f){ const hp=Math.max(10,f.hp); f.hp=hp; const ft=FT('SLIME'); for(let i=0;i<2;i++){ f.teamId=f.teamId||f.id; const c=new Fighter(f.id,clamp(f.x+rand(-80,80),80,920),clamp(f.y+rand(-80,80),80,920),ft); c.teamId=f.teamId; c.hp=hp; c.data.cloneDepth=(f.data.cloneDepth||0)+1; c.dir=norm(rand(-1,1),rand(-1,1)); fighters.push(c); const kids=projectiles.filter(p=>p.type==='slime_child'&&p.owner===f&&p.hp>0); kids.forEach(k=>addSlimeChild(c,Math.random()*TAU,Math.max(1,k.hp*.5),Math.max(.5,(k.damage||4)*.5))); } note(f.x,f.y-f.radius-110,'MITOSIS!', '#caffbb'); spawnShockwave(f.x,f.y,'#7be66f',220); }
    function createSlimeMucus(x,y,owner){ projectiles.push({type:'slime_mucus',owner,x,y,radius:75,life:5,maxLife:5}); }

    // TIME buff: opponent only recovers 50% of Time damage during mark, clock flash number.
    const time=FT('TIME');
    if(time){
        time.update=function(f,e,dt){
            f.data.clockCd=(f.data.clockCd||0)-dt; if(f.data.clockCd<=0){ f.data.clockCd=4; const val=clockDamageValue(); e.takeDamage(val,f,'clock-strike'); projectiles.push({type:'clock_flash',owner:f,num:val,life:.9,maxLife:.9}); note(e.x,e.y-e.radius-100,`CLOCK ${val}`,'#d6d0ff'); }
            f.data.markCd-=abilityDt(f,dt); if(!f.data.mark&&f.data.markCd<=0){ f.data.markCd=9; f.data.mark={x:f.x,y:f.y,hp:f.hp,timer:3,dealt:0,received:0}; projectiles.push({type:'time_mark',owner:f,x:f.x,y:f.y,life:3,maxLife:3}); note(f.x,f.y-f.radius-80,'TIME MARK','#d6d0ff'); }
            if(f.data.mark){ const m=f.data.mark; m.timer-=dt; if(m.timer<=0){ f.x=m.x; f.y=m.y; f.hp=Math.max(f.hp,m.hp); if(e&&m.dealt>0) e.heal(m.dealt*.5,false); if(f.isRage&&m.received>0) spawnTimeRift(f,m.received); f.data.mark=null; spawnShockwave(f.x,f.y,'#d6d0ff',200); } }
        };
    }

    // WOLF: normal scent fixed; Rage scales +5 radius per target lost HP. Visible pounce, no sticking.
    const wolf=FT('WOLF');
    if(wolf){
        wolf.update=function(f,e,dt){ f.data.scentCd-=abilityDt(f,dt); f.data.biteCd=Math.max(0,(f.data.biteCd||0)-dt); if(f.data.pounceTimer>0){ f.data.pounceTimer-=dt; f.applyStatus('speed',.1,{mult:2.4}); if(f.data.pounceTimer<=0){f.data.afterBiteBounce=.5;} } if(f.data.scentCd<=0){ f.data.scentCd=7; e.applyStatus('scent',5,{source:f}); note(e.x,e.y-e.radius-82,'SCENT','#ff3030'); } if(e&&e.hasStatus('scent')&&f.data.biteCd<=0){ const rr=wolfScentRadius(f,e); if(dist(f.x,f.y,e.x,e.y)<rr){ f.setDir(e.x-f.x,e.y-f.y); if(f.data.pounceTimer<=0) f.data.pounceTimer=.45; } } };
        wolf.speedModifier=function(f,e){ return f.data.pounceTimer>0?2.3:1; };
        wolf.onCollide=function(f,e){ if(e.hasStatus('scent') && f.data.biteCd<=0 && f.data.pounceTimer>0){ e.takeDamage(10,f,'wolf-bite'); if(f.isRage){ const p=clamp(.5+(50-f.hp)/50*.5,.5,1); if(Math.random()<p) e.applyStatus('weak',4,{source:f}); } f.data.biteCd=2; f.data.pounceTimer=0; const n=norm(f.x-e.x,f.y-e.y); f.setDir(n.x,n.y); f.applyStatus('push',.22,{x:n.x,y:n.y,strength:950}); note(f.x,f.y-f.radius-80,'BITE','#ff3030'); return true; } return false; };
    }
    function wolfScentRadius(f,e){ return f.isRage ? 120 + (e.maxHp-e.hp)*5 : 120; }

    // WITCH clearer curse visuals.
    const oldRollWitchCurse=rollWitchCurse;
    rollWitchCurse=function(source,target){ oldRollWitchCurse(source,target); projectiles.push({type:'witch_talisman',owner:source,targetId:target.id,x:source.x,y:source.y,life:.8,maxLife:.8}); };

    // PIRATE item lifetime +2 and combo visuals.
    const oldAddPirateLoot=addPirateLoot;
    addPirateLoot=function(owner){ oldAddPirateLoot(owner); const p=[...projectiles].reverse().find(q=>q.type==='pirate_loot'&&q.owner===owner); if(p){p.life+=2;p.maxLife+=2;} };

    // PAINTER overhaul: line strokes, 5s equal blob throw, ink effects capped.
    const painter=FT('PAINTER');
    if(painter){
        painter.update=function(f,e,dt){ f.data.colorTimer=(f.data.colorTimer||2)-dt; if(f.data.colorTimer<=0){f.data.colorTimer=2;f.data.colorIndex=(f.data.colorIndex+1)%3;} f.data.blobCd=(f.data.blobCd||1)-abilityDt(f,dt); if(e&&f.data.blobCd<=0){ f.data.blobCd=5; spawnPainterBlob(f,e); } if(f.data.paintTimer>0){ f.data.paintTimer-=dt; f.data.paintDrop-=dt; if(f.data.paintDrop<=0){ f.data.paintDrop=.16; const kind=['red','blue','yellow'][f.data.colorIndex]; spawnPainterInk(f,f.data.lastPaintX??f.x,f.data.lastPaintY??f.y,kind,f.x,f.y); f.data.lastPaintX=f.x; f.data.lastPaintY=f.y; } } };
        painter.onWallBounce=function(f,wall){ f.data.paintTimer=2; f.data.paintDrop=0; f.data.lastPaintX=f.x; f.data.lastPaintY=f.y; note(f.x,f.y-f.radius-70,'BRUSH STROKE','#fff4a0'); };
    }
    spawnPainterBlob=function(owner,enemy){ const kinds=['red','blue','yellow']; const kind=kinds[Math.floor(Math.random()*3)]; const n=norm(enemy.x-owner.x,enemy.y-owner.y); projectiles.push({type:'paint_blob',owner,kind,x:owner.x,y:owner.y,vx:n.x*820,vy:n.y*820,radius:24,life:1.3,maxLife:1.3}); note(owner.x,owner.y-owner.radius-85,`THROW ${kind.toUpperCase()}`,'#fff4a0'); };

    // MONK -> KUNGFU, visual / combo polish, max trauma 30.
    const monk=FT('MONK');
    if(monk){ monk.name='KUNGFU'; monk.desc='Five-step martial combo, trauma and giant palm'; monk.speed=515; monk.draw=function(ctx,f){ drawPolygon(ctx,[[-48,-60],[48,-60],[64,42],[0,68],[-64,42]],'#3b2417','#ffd28a',5); ctx.fillStyle='#ffe0a0';ctx.font='900 23px serif';ctx.textAlign='center';ctx.fillText('Ă¥Â°ÂĂ¦Â­Â¦',0,8); if(f.data.combo>0){ctx.font='900 20px monospace';ctx.fillText('COMBO '+f.data.combo,0,-f.radius-18);} if(f.data.rushTimer>0){ctx.strokeStyle='#ff9b50';ctx.lineWidth=12;ctx.beginPath();ctx.arc(0,0,f.radius+24,0,TAU);ctx.stroke();} }; }
    addInnerTrauma=function(target,count=1){ target.applyStatus('innerTrauma',Infinity,{source:null}); target.statuses.innerTrauma.stacks=clamp((target.statuses.innerTrauma.stacks||0)+count,0,30); note(target.x,target.y-target.radius-92,`TRAUMA ${target.statuses.innerTrauma.stacks}`,'#ff9b50'); };

    // SUPERSTAR: fans are visible 10 HP bodies; no phantom damage.
    triggerSuperstarEvent=function(owner,enemy){ const canMedia=owner.data.mediaStreak<1; const media=canMedia && Math.random()<.35; if(media){owner.data.mediaStreak++; owner.applyStatus('immune',1.5,{source:owner}); owner.data.spotlight=1.5; projectiles.push({type:'spotlight_flash',owner,x:owner.x,y:owner.y,radius:190,life:1.5,maxLife:1.5}); note(owner.x,owner.y-owner.radius-80,'MEDIA SHIELD','#fff2a0');} else {owner.data.mediaStreak=0; for(let i=0;i<2;i++) projectiles.push({type:'superfan',owner,x:owner.x+rand(-35,35),y:owner.y+rand(-35,35),radius:12,hp:10,life:16,maxLife:16,tick:0,dir:norm(rand(-1,1),rand(-1,1))}); note(owner.x,owner.y-owner.radius-80,'+2 FANS','#ff7bd6');} };

    // PUPPET replaces WIND in roster.
    const wind=FT('WIND');
    if(wind){ Object.assign(wind,{name:'PUPPET',color:'#9b6b42',desc:'Effigy damage transfer and final cursed card',speed:465,startDx:1,startDy:-.5,init:f=>{f.data.wallCd=0;f.data.finalCardActive=false;},update:(f,e,dt)=>{},onWallBounce:(f,wall)=>{ if((f.data.wallCd||0)>0)return; f.data.wallCd=.35; spawnPuppetEffigy(f,wall); },draw:(ctx,f)=>{ drawPolygon(ctx,[[-42,-62],[42,-62],[56,42],[0,72],[-56,42]],'#4b2d1c','#d7b27a',5);ctx.strokeStyle='#111';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,-60);ctx.lineTo(0,58);ctx.moveTo(-48,-10);ctx.lineTo(48,-10);ctx.stroke();ctx.fillStyle='#f1d8a8';ctx.font='900 15px serif';ctx.textAlign='center';ctx.fillText('PUPPET',0,12);}}); }
    function spawnPuppetEffigy(owner,wall){ const e={type:'puppet_effigy',owner,x:owner.x,y:owner.y,radius:75,hp:10,life:Infinity,wall,order:matchClock}; projectiles.push(e); note(owner.x,owner.y-owner.radius-75,'EFFIGY','#d7b27a'); checkEffigyMerge(owner,wall); }
    function checkEffigyMerge(owner,wall){ const list=projectiles.filter(p=>p.type==='puppet_effigy'&&p.owner===owner&&p.wall===wall&&p.hp>0); if(list.length>=5){ list.slice(0,5).forEach(p=>p.life=0); projectiles.push({type:'straw_monster',owner,x:owner.x,y:owner.y,radius:55,hp:30,life:Infinity,tick:0}); note(owner.x,owner.y-owner.radius-95,'STRAW MONSTER','#d7b27a'); } }
    function spawnPuppetFinalCard(owner){ projectiles.push({type:'puppet_card',owner,x:owner.x,y:owner.y,vx:rand(-600,600),vy:rand(-600,600),radius:50,w:75,h:20,life:5,maxLife:5,value:1,tick:0,hitCd:0}); }

    // Patch projectile update/draw for new mechanics.
    const __updateProjectiles = updateProjectiles;
    updateProjectiles = function(dt){
        // pre-update special entities
        for(const p of projectiles){
            const owner=p.owner, enemy=owner?getEnemy(owner):null;
            if(p.type==='slime_child' && p.hp<=0 && p.life>0){ createSlimeMucus(p.x,p.y,owner); p.life=0; }
            if(p.type==='slime_mucus' && enemy && dist(enemy.x,enemy.y,p.x,p.y)<enemy.radius+p.radius){ enemy.applyStatus('slow',2,{mult:.1,source:owner}); }
            if(p.type==='puppet_effigy' && p.hp<=0) p.life=0;
            if(p.type==='straw_monster' && enemy){ const n=norm(enemy.x-p.x,enemy.y-p.y); p.x+=n.x*180*dt; p.y+=n.y*180*dt; p.tick=(p.tick||0)+dt; if(dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius && p.tick>=1){p.tick=0; enemy.takeDamage(2,owner,'straw-monster');} }
            if(p.type==='puppet_card' && enemy){ p.tick+=dt; p.hitCd=Math.max(0,p.hitCd-dt); if(p.tick>=1){p.tick=0;p.value=Math.ceil(rand(1,10));} p.x+=p.vx*dt; p.y+=p.vy*dt; if(p.x<20||p.x>980)p.vx*=-1; if(p.y<20||p.y>980)p.vy*=-1; if(dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius && p.hitCd<=0){p.hitCd=.4; enemy.takeDamage(p.value,owner,'puppet-final-card');} if(p.life<=dt && owner && enemy && enemy.hp>0){ owner.hp=0; } }
            if(p.type==='paint_blob' && enemy){ p.x+=p.vx*dt;p.y+=p.vy*dt; if(dist(p.x,p.y,enemy.x,enemy.y)<p.radius+enemy.radius){ if(p.kind==='red'){enemy.takeDamage(11,owner,'red-blob'); enemy.applyStatus('paintRed',3,{source:owner});} else if(p.kind==='blue'){enemy.takeDamage(6.5,owner,'blue-blob'); enemy.data.cd=0; enemy.applyStatus('paintBlue',3,{source:owner}); note(enemy.x,enemy.y-enemy.radius-85,'COOLDOWN RESET','#50a6ff');} else {enemy.takeDamage(7.5,owner,'yellow-blob'); enemy.applyStatus('slow',3,{mult:.66,source:owner}); owner.heal(3,false);} p.life=0; } }
            if(p.type==='math_v2_graph') p.drawProgress=Math.min(1,(p.drawProgress||0)+dt*1.8);
        }
        __updateProjectiles(dt);
    };
    const __drawProjectiles = drawProjectiles;
    drawProjectiles = function(ctx){ __drawProjectiles(ctx); for(const p of projectiles){ ctx.save(); if(p.type==='puppet_effigy'){ctx.globalAlpha=.86;drawPolygon(ctx,[[p.x-45,p.y-60],[p.x+45,p.y-60],[p.x+50,p.y+55],[p.x,p.y+75],[p.x-50,p.y+55]],'#6b4428','#d7b27a',4);ctx.fillStyle='#f1d8a8';ctx.font='900 13px serif';ctx.textAlign='center';ctx.fillText(`HP ${Math.ceil(p.hp)}`,p.x,p.y+5);} if(p.type==='straw_monster'){drawPolygon(ctx,[[p.x-55,p.y-65],[p.x+55,p.y-60],[p.x+60,p.y+55],[p.x,p.y+80],[p.x-60,p.y+55]],'#7d5a2f','#f0cf92',6);ctx.fillStyle='#27180b';ctx.font='900 15px serif';ctx.textAlign='center';ctx.fillText('STRAW',p.x,p.y+4);} if(p.type==='puppet_card'){ctx.translate(p.x,p.y);ctx.rotate(Date.now()/260);ctx.fillStyle='#f1d8a8';ctx.strokeStyle='#3a1b10';ctx.lineWidth=4;ctx.fillRect(-38,-10,76,20);ctx.strokeRect(-38,-10,76,20);ctx.fillStyle='#2b120a';ctx.font='900 16px serif';ctx.textAlign='center';ctx.fillText(String(p.value),0,6);} if(p.type==='slime_mucus'){ctx.globalAlpha=.35*(p.life/p.maxLife);ctx.fillStyle='#9dff8d';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();} if(p.type==='paint_blob'){ctx.globalAlpha=.9;ctx.fillStyle=p.kind==='red'?'#ff4040':p.kind==='blue'?'#50a6ff':'#ffd447';ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();} if(p.type==='clock_flash'){ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle='#efeaff';ctx.font='900 70px monospace';ctx.textAlign='center';const a=-Math.PI/2+p.num*TAU/12;ctx.fillText(String(p.num),500+Math.cos(a)*405,500+Math.sin(a)*405);} if(p.type==='witch_talisman'){const t=fighters.find(f=>f.id===p.targetId); if(t){ctx.globalAlpha=p.life/p.maxLife;ctx.strokeStyle='#e49aff';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(t.x,t.y);ctx.stroke();ctx.fillStyle='#f7e8ff';ctx.font='900 18px serif';ctx.textAlign='center';ctx.fillText('Ă§Â¬Â¦',t.x,t.y-t.radius-88);}} ctx.restore(); } };

    // Enhanced tournament summary MVP awards.
    buildTournamentSummary = function(){ const st=tournamentState;if(!st)return''; const log=st.log||[]; const champion=st.champion; const fastest=log.slice().sort((a,b)=>(a.result.duration||999)-(b.result.duration||999))[0]; const clutch=log.slice().sort((a,b)=>(a.result.winnerHp||99)-(b.result.winnerHp||99))[0]; const dmg=log.slice().sort((a,b)=>(b.result.winnerDamage||0)-(a.result.winnerDamage||0))[0]; const hit=log.slice().sort((a,b)=>(b.result.biggestHit||0)-(a.result.biggestHit||0))[0]; const awards=[['MVP VÄ‚Â´ Ă„ÂĂ¡Â»â€¹ch',champion||'Ă¢â‚¬â€'],['Fastest Kill',fastest?`${fastest.winner} ${fastest.result.duration.toFixed(1)}s`:'Ă¢â‚¬â€'],['Clutch King',clutch?`${clutch.winner} ${clutch.result.winnerHp.toFixed(1)}HP`:'Ă¢â‚¬â€'],['Damage Lord',dmg?`${dmg.winner} ${(dmg.result.winnerDamage||0).toFixed(1)}`:'Ă¢â‚¬â€'],['Biggest Hit',hit?`${hit.winner} ${(hit.result.biggestHit||0).toFixed(1)}`:'Ă¢â‚¬â€'],['Matches',String(st.matchesPlayed||0)]]; const cards=awards.map(a=>`<div class="summary-card"><span>${a[0]}</span><b>${a[1]}</b></div>`).join(''); const banner=champion?`<div class="champion-banner"><h2 style="color:${tournamentFighterStyle(champion)}">Ä‘Å¸Ââ€  ${champion} VÄ‚â€ Ă„ÂĂ¡Â»ÂCH</h2><div>Grand Bracket hoÄ‚Â n tĂ¡ÂºÂ¥t. CÄ‚Â¡c danh hiĂ¡Â»â€¡u MVP Ă„â€˜Ä‚Â£ Ă„â€˜Ă†Â°Ă¡Â»Â£c thĂ¡Â»â€˜ng kÄ‚Âª.</div></div>`:''; return `${banner}<div class="tournament-summary">${cards}</div>`; };

})();
