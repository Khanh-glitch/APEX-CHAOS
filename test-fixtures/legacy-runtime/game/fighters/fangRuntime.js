// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function APEX_FANG_CHAMPION(){
  if (window.__apexFangChampion) return;
  window.__apexFangChampion = true;

  const ROOT='/assets/fang_v1/';
  const C=Object.freeze({
    color:'#d9d1be', normalFps:24, bloodFps:24*(200/175), scale:.16,
    bodyForwardOffset:Math.PI/2, radius:49, normalFrames:13, huntFrames:22, howlFrames:48,
    normalMult:.6, huntMult:1.225, bloodMult:1.4, huntCooldown:5, stackLife:10,
    pounceDamage:9, collisionDamage:4.5, reboundDamage:18, cloneHp:200, cloneLife:10,
    pounceBeyond:200, pounceSpeed:(window.APEX_KATANA?.constants?.oneSwordDistance||400)/(window.APEX_KATANA?.constants?.dashDuration||.105)*.5,
    huntDepth:400, huntFarWidth:200, normalDepth:200, normalFarWidth:200,
    mainStun:.5, reboundStun:1, cloneFollow:760, trueRatio:.05, maxAfterimages:34, huntMistParticles:22000,
    maxParticles:1600, maxTrailSamples:260
  });
  const clips={normal:[],hunt:[],howl:[]};
  for(const [name,count] of [['normal',13],['hunt',22],['howl',48]]) for(let i=1;i<=count;i++){
    const img=new Image();img.decoding='async';img.src=`${ROOT}frames/${name}/frame_${String(i).padStart(3,'0')}.webp`;clips[name].push(img);
  }
  const imageNames=['selectionVisual','selectionButton','howlRing','biteMark','moonIcon','sunIcon','speckBlood','speckMoon','speckSun','huntMistBack','huntMistMid','huntMistFront','trailMist'];
  const images=Object.fromEntries(imageNames.map(k=>{const img=new Image();img.decoding='async';const mist=/^(huntMist|trailMist)/.test(k)?'?v=fog-v4':'';img.src=ROOT+k+'.webp'+mist;return [k,img];}));
  const audioFiles={
    collisionBite:ROOT+'audio/collisionBite.mp3', huntingPounce:ROOT+'audio/huntingPounce.mp3',
    postCollisionRoar:ROOT+'audio/postCollisionRoar.mp3', huntRunStep:ROOT+'audio/huntRunStep.mp3',
    sniff:ROOT+'audio/sniff.mp3', huntStart:ROOT+'audio/huntStart.mp3', wallRebound:ROOT+'audio/wallRebound.mp3',
    howl:ROOT+'audio/howl.mp3', heavyImpact:ROOT+'audio/heavyImpact.mp3'
  };
  const sounds={},soundPools={};
  const state={afterimages:[],marks:[],rings:[],particles:[],seed:0x46a91d2b,lastHeavyBlock:null,huntMist:null};
  for(const [key,src] of Object.entries(audioFiles)){const a=registerBattleMediaElement(new Audio(src));a.preload='auto';sounds[key]=a;soundPools[key]=[a];}
  function play(key,volume=.65){
    const base=sounds[key];if(!base)return;const pool=soundPools[key];let a=pool.find(x=>x.paused||x.ended);
    if(!a&&pool.length<8){a=registerBattleMediaElement(base.cloneNode(true));a.preload='auto';pool.push(a);}if(!a)return;
    try{a.currentTime=0;}catch{}a.volume=volume;const p=a.play();if(p?.catch)p.catch(()=>{});
  }
  function seeded(){state.seed=(Math.imul(state.seed,1664525)+1013904223)>>>0;return state.seed/4294967296;}
  function alive(f){return !!f&&f.hp>0;}
  function enemyOf(f){return (fighters||[]).find(q=>q&&q!==f&&q.hp>0)||null;}
  function fangData(f){f.data||={};if(!f.data.fang)initFang(f);return f.data.fang;}
  function initFang(f){
    f.radius=f.baseRadius=C.radius;f.maxHp=f.hp=1000;
    const roster=FighterTypes.filter(x=>x&&x.name!=='FANG').map(x=>x.speed||450);
    const average=roster.reduce((a,b)=>a+b,0)/Math.max(1,roster.length);
    f.baseSpeed=average*C.normalMult;
    f.data.fang={state:'NORMAL_LOOP',clip:'normal',frame:1,frameElapsed:0,lastEntered:1,visualDir:{...f.dir},huntReadyAt:5,
      huntPending:false,huntActive:false,blood:false,action:null,stacks:[],stackVisualCount:0,clones:[],cloneSerial:0,
      trail:[],trailDistance:0,trailCursor:0,overlapLatch:false,pendingHowl:false,pendingPostStack:0,
      iconMoon:{x:f.x,y:f.y,vx:0,vy:0},iconSun:{x:f.x,y:f.y,vx:0,vy:0},actionActualDamage:0,howlStunTarget:null,
      silhouette:0,interceptFx:[],afterimageClock:0,normalSpeed:average};
  }
  function angleLerpDir(current,target,dt){
    let a=Math.atan2(current.y,current.x),b=Math.atan2(target.y,target.x),delta=((b-a+Math.PI*3)%TAU)-Math.PI;
    a+=delta*clamp(dt/.13,0,1);return{x:Math.cos(a),y:Math.sin(a)};
  }
  function setState(d,name,clip,frame){d.state=name;d.clip=clip;d.frame=frame;d.frameElapsed=0;d.lastEntered=frame;}
  function enterFrame(f,d,frame){
    d.frame=frame;d.lastEntered=frame;
    if((d.state==='HUNT_LOOP'||d.state==='BLOOD_CHASE_LOOP')&&(frame===9||frame===16))play('huntRunStep',.48);
    if(d.state==='HOWL_48'&&frame===17){play('howl',.74);d.howlStopped=true;state.rings.push({x:f.x+d.visualDir.x*C.radius*.72,y:f.y+d.visualDir.y*C.radius*.72,life:.78,maxLife:.78,age:0});emitSpecks('moon',f.x,f.y,24,150);emitSpecks('sun',f.x,f.y,24,150);}
  }
  function stepFrames(f,d,dt,fps,next){
    d.frameElapsed+=dt;const frameTime=1/Math.max(.001,fps);let guard=0;
    while(d.frameElapsed+1e-9>=frameTime&&guard++<96){d.frameElapsed-=frameTime;const n=next(d.frame);if(n==null)break;enterFrame(f,d,n);}
  }
  function startHuntTransition(f,d){d.huntPending=false;d.huntActive=false;d.blood=false;setState(d,'HUNT_TRANSITION','hunt',2);play('huntStart',.64);}
  function completeHowl(f,d){
    if(!alive(f)||gameState!=='PLAYING')return;
    for(const c of d.clones)c.dead=true;
    d.clones=[createClone(f,'moon',-1),createClone(f,'sun',1)];d.silhouette=0;d.pendingHowl=false;
    if(d.howlStunTarget?.statuses?.stun){delete d.howlStunTarget.statuses.stun;}d.howlStunTarget=null;
    setState(d,'NORMAL_LOOP','normal',13);d.huntActive=false;d.blood=false;
    if(d.pendingPostStack>0){d.stacks=[{expires:matchClock+C.stackLife}];d.pendingPostStack=0;syncStackVisual(f,d,true);}
  }
  function updateAnimation(f,d,dt){
    if(d.state==='NORMAL_LOOP')stepFrames(f,d,dt,24,frame=>{if(frame===13&&d.huntPending){startHuntTransition(f,d);return null;}return frame===13?1:frame+1;});
    else if(d.state==='HUNT_TRANSITION')stepFrames(f,d,dt,24,frame=>{if(frame===8){d.huntActive=true;setState(d,'HUNT_LOOP','hunt',9);enterFrame(f,d,9);return null;}return frame+1;});
    else if(d.state==='HUNT_LOOP'||d.state==='BLOOD_CHASE_LOOP')stepFrames(f,d,dt,d.blood?C.bloodFps:24,frame=>frame===22?9:frame+1);
    else if(d.state==='HOWL_48')stepFrames(f,d,dt,24,frame=>{if(frame===48){completeHowl(f,d);return null;}return frame+1;});
    else if(d.action){
      const a=d.action;if(a.freezeH20&&d.frame===20)return;
      const fps=Math.max(24,a.animFps||24);
      stepFrames(f,d,dt,fps,frame=>{if(frame===22){if(d.pendingHowl){finishAction(f,d);return null;}return 9;}if(frame===9&&a.recovering&&!d.pendingHowl){finishAction(f,d);return null;}return frame===22?9:frame+1;});
    }
  }
  function createClone(f,kind,side){const d=fangData(f),right={x:-d.visualDir.y,y:d.visualDir.x};return{id:++d.cloneSerial,kind,side,x:f.x+right.x*side*102-d.visualDir.x*58,y:f.y+right.y*side*102-d.visualDir.y*58,hp:C.cloneHp,life:C.cloneLife,frame:1,frameElapsed:0,reserved:false,dead:false,action:null};}
  function liveClones(d){return d.clones.filter(c=>!c.dead&&c.hp>0&&c.life>0);}
  function emitSpecks(kind,x,y,count=12,speed=90,dir=null){
    const img=kind==='blood'?images.speckBlood:kind==='moon'?images.speckMoon:images.speckSun;
    for(let i=0;i<count;i++){if(state.particles.length>=C.maxParticles)state.particles.shift();const base=dir?Math.atan2(dir.y,dir.x):seeded()*TAU;const a=base+(seeded()-.5)*(dir?.spread||TAU);const life=.25+seeded()*.48;state.particles.push({img,x,y,vx:Math.cos(a)*speed*(.35+seeded()),vy:Math.sin(a)*speed*(.35+seeded()),life,maxLife:life,scale:.010+seeded()*.010,rot:seeded()*TAU,spin:(seeded()-.5)*4,kind});}
  }
  function syncStackVisual(f,d,burst=false){
    const count=d.stacks.length;if(count===d.stackVisualCount)return;
    if(count<d.stackVisualCount){if(d.stackVisualCount>=2&&count<2)emitSpecks('sun',d.iconSun.x,d.iconSun.y,18,120);if(d.stackVisualCount>=1&&count<1)emitSpecks('moon',d.iconMoon.x,d.iconMoon.y,18,120);}
    else if(burst||count>d.stackVisualCount){if(count>=1&&d.stackVisualCount<1)emitSpecks('moon',f.x,f.y,16,110);if(count>=2&&d.stackVisualCount<2)emitSpecks('sun',f.x,f.y,16,110);}
    d.stackVisualCount=count;
  }
  function expireStacks(f,d){
    if(d.action?.reservedStacks)return;
    const before=d.stacks.length;d.stacks=d.stacks.filter(s=>s.expires>matchClock);if(before!==d.stacks.length)syncStackVisual(f,d);
  }
  function actualDamage(owner,target,amount,label){const before=target.hp;target.takeDamage(amount,owner,label,false);return Math.max(0,before-target.hp);}
  function applyTrue(owner,target,amount,label){
    if(!alive(target)||!(amount>0))return 0;const dealt=Math.min(target.hp,amount);target.hp-=dealt;target.damageTaken=(target.damageTaken||0)+dealt;
    owner.damageDone=(owner.damageDone||0)+dealt;owner.hitsLanded=(owner.hitsLanded||0)+1;owner.maxHit=Math.max(owner.maxHit||0,dealt);owner.damageLabels[label+'-true']=(owner.damageLabels[label+'-true']||0)+dealt;
    floatingTexts.push(new FloatingText(target.x,target.y-target.radius-22,dealt.toFixed(1),'#ffffff'));updateHUD();return dealt;
  }
  function triggerThird(f,d,target,dir){
    d.stacks=[];d.stackVisualCount=0;d.pendingHowl=false;d.howlStunTarget=null;d.silhouette=0;
    emitSpecks('moon',f.x,f.y,34,180);emitSpecks('sun',f.x,f.y,34,180);
    const right={x:-dir.y,y:dir.x};
    for(const [kind,side] of [['moon',-1],['sun',1]]){
      const c=createClone(f,kind,side);c.reserved=true;c.consumeAfterCross=true;c.life=.36;c.hp=C.cloneHp;c.x=f.x-right.x*side*82-dir.x*40;c.y=f.y-right.y*side*82-dir.y*40;
      c.action={phase:'cross',t:0,startX:c.x,startY:c.y,targetX:target.x,targetY:target.y,dir:{x:dir.x,y:dir.y}};d.clones.push(c);
    }
  }
  function pounceHit(f,d,target,base,kind,fromRebound=false){
    const a=d.action;if(!a||a.hitKeys.has(kind))return 0;a.hitKeys.add(kind);
    const count=fromRebound?d.stacks.length:a.stackSnapshot;
    const missingBefore=Math.max(0,target.maxHp-target.hp);let dealt=0;
    const clones=kind==='hunting'&&!fromRebound?liveClones(d):kind==='collision'&&!fromRebound?liveClones(d):[];
    const three=kind==='hunting'&&clones.length===2;
    dealt+=actualDamage(f,target,base,`fang-${kind}`);
    if(!fromRebound){
      if(three){for(const c of clones){c.reserved=true;c.action={phase:'cross',t:0,startX:c.x,startY:c.y,targetX:target.x,targetY:target.y,dir:{x:a.dir.x,y:a.dir.y}};dealt+=actualDamage(f,target,base*.5,`fang-three-wolf-${c.kind}`);} }
      else for(const c of clones.slice(0,kind==='collision'?2:1))dealt+=actualDamage(f,target,base*.5,`fang-double-${kind}`);
    }
    const third=count===2;const sharedTrue=three||third;if(sharedTrue)dealt+=applyTrue(f,target,missingBefore*C.trueRatio,'fang-lunar-solar');
    if(third)triggerThird(f,d,target,a.dir);else if(fromRebound&&d.pendingHowl){d.pendingPostStack=Math.min(2,d.pendingPostStack+1);}else{d.stacks.push({expires:matchClock+C.stackLife});syncStackVisual(f,d,true);}
    if(three)for(const c of clones)c.consumeAfterCross=true;
    target.applyStatus('stun',fromRebound?C.reboundStun:C.mainStun,{source:f});
    emitSpecks('blood',target.x,target.y,18,190,{...a.dir,spread:.8});state.marks.push({x:target.x,y:target.y,angle:Math.atan2(a.dir.y,a.dir.x),life:.26,maxLife:.26,targetId:target.id});
    if(kind==='collision')play('collisionBite',.62);
    a.actual=(a.actual||0)+dealt;return dealt;
  }
  function rearEndpoint(target,dir){return{x:target.x+dir.x*(target.radius+C.pounceBeyond),y:target.y+dir.y*(target.radius+C.pounceBeyond)};}
  function intervalsTo20(frame){if(frame<=20)return 20-frame;return (22-frame)+12;}
  function beginPounce(f,target,kind,dir=f.dir){
    const d=fangData(f);if(d.action||!target)return false;dir=norm(dir.x,dir.y);const endpoint=rearEndpoint(target,dir);const distance=Math.hypot(target.x-f.x,target.y-f.y);
    d.visualDir={x:dir.x,y:dir.y};f.setDir(dir.x,dir.y);
    const frame=kind==='collision'?17:d.frame;setState(d,kind==='collision'?'NORMAL_COLLISION_POUNCE':'HUNT_POUNCE','hunt',frame);
    const time=Math.max(.001,(Math.max(0,distance-target.radius-f.radius))/C.pounceSpeed);const intervals=intervalsTo20(frame);
    d.action={kind,dir,start:{x:f.x,y:f.y},endpoint,targetId:target.id,targetSnapshot:{x:target.x,y:target.y,radius:target.radius},hit:false,hitKeys:new Set(),reboundUsed:false,rebounding:false,recovering:false,freezeH20:false,animFps:intervals/24<=time?24:intervals/time,stackSnapshot:d.stacks.length,reservedStacks:d.stacks.slice(),lifesteal:d.stacks.length===1,actual:0,lastX:f.x,lastY:f.y};
    d.huntActive=false;d.blood=false;if(kind==='hunting'){d.huntReadyAt=matchClock+C.huntCooldown;d.huntPending=false;play('huntingPounce',.68);}else play('postCollisionRoar',.62);
    return true;
  }
  function segmentCircle(x1,y1,x2,y2,cx,cy,r){return distToSegment(cx,cy,x1,y1,x2,y2)<=r;}
  function heavyBlockerOnSegment(f,a,nx,ny){
    for(const p of projectiles||[]){if(!p||p.owner===f||!(p.life>0)||!/(rocket|planet|war_machine|soccer|mine_explosion|turret)/i.test(p.type||''))continue;if(segmentCircle(f.x,f.y,nx,ny,p.x,p.y,(p.radius||24)+f.radius*.35))return p;}
    const eng=enemyOf(f);for(const s of eng?.data?.engineer?.structures||[]){if(s.hp>0&&segmentCircle(f.x,f.y,nx,ny,s.x,s.y,(s.radius||s.size||55)+f.radius*.35))return s;}
    return null;
  }
  function wallAt(x,y,r){if(x<r)return'left';if(x>GAME_SIZE-r)return'right';if(y<r)return'top';if(y>GAME_SIZE-r)return'bottom';return null;}
  function startRebound(f,d,target,side){
    const a=d.action;if(a.reboundUsed){a.recovering=true;a.freezeH20=false;return;}a.reboundUsed=true;a.rebounding=true;a.hit=false;
    f.x=clamp(f.x,f.radius,GAME_SIZE-f.radius);f.y=clamp(f.y,f.radius,GAME_SIZE-f.radius);a.dir=norm(target.x-f.x,target.y-f.y);a.endpoint=rearEndpoint(target,a.dir);a.lastX=f.x;a.lastY=f.y;a.freezeH20=false;a.animFps=Math.max(24,intervalsTo20(d.frame)/Math.max(.001,dist(f.x,f.y,target.x,target.y)/C.pounceSpeed));
    d.visualDir={x:a.dir.x,y:a.dir.y};f.setDir(a.dir.x,a.dir.y);
    play('wallRebound',.72);play('huntingPounce',.48);
  }
  function finishAction(f,d){
    const a=d.action;if(!a)return;if(a.lifesteal&&a.actual>0)f.heal(a.actual,false);
    d.action=null;d.overlapLatch=true;
    if(d.pendingHowl){setState(d,'HOWL_48','howl',1);d.silhouette=Math.max(d.silhouette,.35);return;}
    setState(d,'NORMAL_LOOP','normal',1);d.huntActive=false;d.blood=false;
  }
  function updatePounce(f,d,target,dt){
    const a=d.action;if(!a)return;f.data.positionLocked=true;d.visualDir={x:a.dir.x,y:a.dir.y};f.setDir(a.dir.x,a.dir.y);if(a.recovering)return;const ox=f.x,oy=f.y;let remaining=C.pounceSpeed*dt;const ex=a.endpoint.x-f.x,ey=a.endpoint.y-f.y;const len=Math.hypot(ex,ey);const step=Math.min(remaining,len);let nx=f.x+a.dir.x*step,ny=f.y+a.dir.y*step;
    const blocker=heavyBlockerOnSegment(f,a,nx,ny);if(blocker){play('heavyImpact',.7);if(Number.isFinite(blocker.hp))blocker.hp=Math.max(0,blocker.hp-C.pounceDamage);state.lastHeavyBlock={type:blocker.type||'construction',t:matchClock};a.recovering=true;a.freezeH20=false;a.animFps=24;enterFrame(f,d,21);return;}
    f.x=nx;f.y=ny;a.lastX=ox;a.lastY=oy;
    if(state.afterimages.length>=C.maxAfterimages)state.afterimages.shift();d.afterimageClock+=dt;if(d.afterimageClock>=.025){d.afterimageClock=0;state.afterimages.push({x:f.x,y:f.y,dir:{...a.dir},clip:d.clip,frame:d.frame,life:.22,maxLife:.22,kind:'main'});}
    const hitTarget=alive(target)&&!a.hit&&segmentCircle(ox,oy,f.x,f.y,target.x,target.y,target.radius+f.radius*.28);
    if(hitTarget&&d.frame!==20){const intervals=intervalsTo20(d.frame);a.animFps=Math.max(a.animFps||24,intervals/Math.max(.001,dt));let guard=0;while(d.frame!==20&&guard++<32)enterFrame(f,d,d.frame===22?9:d.frame+1);}
    if(hitTarget&&d.frame===20){a.hit=true;a.freezeH20=false;pounceHit(f,d,target,a.rebounding?C.reboundDamage:(a.kind==='collision'?C.collisionDamage:C.pounceDamage),a.rebounding?'rebound':a.kind,a.rebounding);}
    if(d.frame===20&&!a.hit)a.freezeH20=true;
    const side=wallAt(f.x,f.y,f.radius);if(side){if(target)startRebound(f,d,target,side);else{a.recovering=true;a.freezeH20=false;enterFrame(f,d,21);}return;}
    if(len<=step+.001){a.freezeH20=false;a.recovering=true;a.animFps=24;enterFrame(f,d,21);}
  }
  function updateTrail(f,d,target){
    if(!target)return;const last=d.trail[d.trail.length-1];if(!last||dist(last.x,last.y,target.x,target.y)>=10)d.trail.push({x:target.x,y:target.y,t:matchClock});
    let maxLen=clamp(360+((target.maxHp-target.hp)/Math.max(1,target.maxHp))*100*16,360,2000),sum=0,cut=0;
    for(let i=d.trail.length-1;i>0;i--){sum+=dist(d.trail[i].x,d.trail[i].y,d.trail[i-1].x,d.trail[i-1].y);if(sum>maxLen){cut=i;break;}}
    if(cut>0)d.trail.splice(0,cut);if(d.trail.length>C.maxTrailSamples)d.trail.splice(0,d.trail.length-C.maxTrailSamples);
  }
  function inHuntTrapezoid(f,d,target){
    const dir=d.visualDir,right={x:-dir.y,y:dir.x},mouth={x:f.x+dir.x*f.radius*.8,y:f.y+dir.y*f.radius*.8};const rx=target.x-mouth.x,ry=target.y-mouth.y;const forward=rx*dir.x+ry*dir.y,lateral=Math.abs(rx*right.x+ry*right.y);if(forward<-target.radius||forward>C.huntDepth+target.radius)return false;const half=lerp(f.radius*.42,C.huntFarWidth*.5,clamp(forward/C.huntDepth,0,1));return lateral<=half+target.radius;
  }
  function checkBlood(f,d){
    const nose={x:f.x+d.visualDir.x*f.radius*.82,y:f.y+d.visualDir.y*f.radius*.82};let best=-1,bestD=Infinity;
    for(let i=0;i<d.trail.length;i++){const p=d.trail[i],dd=dist(nose.x,nose.y,p.x,p.y);if(dd<52&&dd<bestD){best=i;bestD=dd;}}
    if(best>=0){if(!d.blood){d.blood=true;d.state='BLOOD_CHASE_LOOP';play('sniff',.58);}d.trailCursor=Math.min(d.trail.length-1,best+1);}
    if(d.blood){const p=d.trail[d.trailCursor];if(p){const to=norm(p.x-f.x,p.y-f.y);f.setDir(to.x,to.y);if(dist(f.x,f.y,p.x,p.y)<48)d.trailCursor++;}if(d.trailCursor>=d.trail.length){d.blood=false;d.state='HUNT_LOOP';}}
  }
  function updateIcons(f,d,dt){
    const right={x:-d.visualDir.y,y:d.visualDir.x};for(const [icon,side] of [[d.iconMoon,-1],[d.iconSun,1]]){
      const clone=liveClones(d).find(c=>c.side===side);let tx=f.x+right.x*side*104-d.visualDir.x*12,ty=f.y+right.y*side*104-d.visualDir.y*12;
      if(clone){tx=clone.x+right.x*side*54+d.visualDir.x*34;ty=clone.y+right.y*side*54+d.visualDir.y*34;}
      const dx=tx-icon.x,dy=ty-icon.y;icon.vx=(icon.vx+dx*22*dt)*Math.exp(-8*dt);icon.vy=(icon.vy+dy*22*dt)*Math.exp(-8*dt);icon.x+=icon.vx*dt;icon.y+=icon.vy*dt;
    }
  }
  function updateClones(f,d,dt){
    const right={x:-d.visualDir.y,y:d.visualDir.x};for(const c of d.clones){if(c.dead)continue;if(!c.reserved)c.life-=dt;if(c.life<=0||c.hp<=0){c.dead=true;emitSpecks(c.kind,c.x,c.y,24,130);continue;}
      if(c.action?.phase==='cross'){c.action.t+=dt;const t=clamp(c.action.t/.16,0,1),crossSide=-c.side;const ex=c.action.targetX+c.action.dir.x*(C.pounceBeyond*.72)+right.x*crossSide*100,ey=c.action.targetY+c.action.dir.y*(C.pounceBeyond*.72)+right.y*crossSide*100;c.x=lerp(c.action.startX,ex,t);c.y=lerp(c.action.startY,ey,t);c.frame=20;if(t>=1&&c.consumeAfterCross){c.dead=true;emitSpecks(c.kind,c.x,c.y,30,170,c.action.dir);}}
      else{const tx=f.x+right.x*c.side*104-d.visualDir.x*64,ty=f.y+right.y*c.side*104-d.visualDir.y*64;const dd=dist(c.x,c.y,tx,ty),step=Math.min(dd,C.cloneFollow*dt);if(dd>.01){c.x+=(tx-c.x)/dd*step;c.y+=(ty-c.y)/dd*step;}c.frame=d.clip==='normal'?d.frame:clamp(d.frame,1,22);}
    }d.clones=d.clones.filter(c=>!c.dead);
  }
  function updateVisualState(dt){
    for(const fx of state.afterimages)fx.life-=dt;state.afterimages=state.afterimages.filter(x=>x.life>0);
    for(const fx of state.marks)fx.life-=dt;state.marks=state.marks.filter(x=>x.life>0);
    for(const r of state.rings){r.life-=dt;r.age+=dt;}state.rings=state.rings.filter(x=>x.life>0);
    for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-2.4*dt);p.vy*=Math.exp(-2.4*dt);p.rot+=p.spin*dt;}state.particles=state.particles.filter(x=>x.life>0);
  }
  function updateFang(f,target,dt){
    const d=fangData(f);updateTrail(f,d,target);expireStacks(f,d);updateIcons(f,d,dt);updateClones(f,d,dt);
    if(!d.action&&d.state!=='HOWL_48'&&matchClock>=d.huntReadyAt&&!d.huntActive)d.huntPending=true;
    if(d.action)updatePounce(f,d,target,dt);
    else if(d.state==='HOWL_48'){
      f.data.positionLocked=true;const frame=d.frame;if(frame<=16){f.x+=f.dir.x*d.normalSpeed*.5*dt;f.y+=f.dir.y*d.normalSpeed*.5*dt;}else if(frame>=41){const mult=lerp(.5,1,(frame-41)/7);f.x+=f.dir.x*d.normalSpeed*mult*dt;f.y+=f.dir.y*d.normalSpeed*mult*dt;}
      f.x=clamp(f.x,f.radius,GAME_SIZE-f.radius);f.y=clamp(f.y,f.radius,GAME_SIZE-f.radius);d.silhouette=clamp(d.silhouette+dt*.55,0,1);
    }else if(d.huntActive){checkBlood(f,d);if(target&&inHuntTrapezoid(f,d,target))beginPounce(f,target,'hunting',d.visualDir);}
    updateAnimation(f,d,dt);
    const wanted=d.action?.dir||f.dir;if(Math.hypot(wanted.x,wanted.y)>.01)d.visualDir=angleLerpDir(d.visualDir,wanted,dt);
  }
  function speedModifier(f){const d=fangData(f);if(d.state==='HUNT_TRANSITION')return lerp(1,C.huntMult/C.normalMult,clamp((d.frame-2)/6,0,1));if(d.huntActive)return(d.blood?C.bloodMult:C.huntMult)/C.normalMult;return 1;}
  function bodyImage(d){return clips[d.clip]?.[clamp(d.frame,1,clips[d.clip]?.length||1)-1]||clips.normal[0];}
  function drawBody(ctx,img,alpha=1,filter='',scale=C.scale){if(!img?.complete||!img.naturalWidth)return;ctx.save();ctx.globalAlpha*=alpha;if(filter)ctx.filter=filter;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore();}
  function drawFang(ctx,f){const d=fangData(f),base=Math.atan2(f.dir.y,f.dir.x),face=Math.atan2(d.visualDir.y,d.visualDir.x);ctx.save();ctx.rotate(face-base+C.bodyForwardOffset);if(d.action){ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=.20;ctx.fillStyle='#9b0012';ctx.beginPath();ctx.ellipse(0,18,48,150,0,0,TAU);ctx.fill();ctx.restore();drawBody(ctx,bodyImage(d),1,'drop-shadow(0 0 11px #ff3140) drop-shadow(0 0 18px #6d0010)',C.scale*1.08);}else drawBody(ctx,bodyImage(d),1);ctx.restore();}
  function ribbonPath(ctx,points){
    if(!points||points.length<2)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(let i=1;i<points.length-1;i++){const mx=(points[i].x+points[i+1].x)/2,my=(points[i].y+points[i+1].y)/2;ctx.quadraticCurveTo(points[i].x,points[i].y,mx,my);}
    const last=points[points.length-1];ctx.lineTo(last.x,last.y);
  }
  function fract(n){return n-Math.floor(n);}
  function speckAt(ctx,img,x,y,scale,alpha,rot=0,filter='',tint=''){
    if(!img?.complete)return;ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.globalAlpha*=alpha;if(filter)ctx.filter=filter;ctx.drawImage(img,-img.width*scale/2,-img.height*scale/2,img.width*scale,img.height*scale);
    if(tint){ctx.globalCompositeOperation='source-atop';ctx.fillStyle=tint;ctx.fillRect(-img.width*scale/2,-img.height*scale/2,img.width*scale,img.height*scale);}
    ctx.restore();
  }
  function mistFade(age,life){const x=clamp(age/life,0,1);return Math.sin(Math.PI*x)*Math.pow(1-x,.35);}
  function makeBloodFogTexture(key,w,h,count,shapeFn,opts={}){
    if(typeof document==='undefined')return null;const img=images.speckBlood;if(!img?.complete||!img.naturalWidth)return null;
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;const m=mask.getContext('2d');
    const detail=document.createElement('canvas');detail.width=w;detail.height=h;const q=detail.getContext('2d');
    if(!m||!q)return null;m.clearRect(0,0,w,h);q.clearRect(0,0,w,h);m.globalCompositeOperation=q.globalCompositeOperation='source-over';
    for(let i=0;i<count;i++){
      const r1=fract(Math.sin((i+1)*(opts.a||12.9898)+(opts.b||3.71))*43758.5453),r2=fract(Math.sin((i+1)*(opts.c||78.233)+(opts.d||1.91))*24634.6345),r3=fract(Math.sin((i+1)*(opts.e||37.719)+(opts.g||8.13))*96321.417),r4=fract(Math.sin((i+1)*(opts.h||5.398)+(opts.j||9.17))*16431.371);
      const p=shapeFn(r1,r2,r3,r4,i);if(!p)continue;
      const density=p.density??1,scale=Math.min(C.radius*.095/img.width,p.scale||.0042),alpha=(p.alpha??.1)*density,rot=(p.rot??r2*TAU),dw=img.width*scale,dh=img.height*scale;
      m.save();m.translate(p.x,p.y);m.rotate(rot);m.globalAlpha=Math.min(1,alpha*2.9);m.drawImage(img,-dw/2,-dh/2,dw,dh);m.restore();
      if(i%3===0){q.save();q.translate(p.x,p.y);q.rotate(rot);q.globalAlpha=Math.min(.72,alpha*2.3);q.drawImage(img,-dw/2,-dh/2,dw,dh);q.globalCompositeOperation='source-atop';q.fillStyle=density>.62?'#4a0000':'#cc0000';q.fillRect(-dw/2,-dh/2,dw,dh);q.restore();}
    }
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');if(!c)return null;
    c.clearRect(0,0,w,h);c.globalCompositeOperation='source-over';
    const low=document.createElement('canvas'),lw=Math.max(24,Math.ceil(w/7)),lh=Math.max(18,Math.ceil(h/7));low.width=lw;low.height=lh;const l=low.getContext('2d');
    if(l){l.clearRect(0,0,lw,lh);l.globalAlpha=1;l.drawImage(mask,0,0,lw,lh);l.filter='blur(2.4px)';l.globalAlpha=.95;l.drawImage(low,-1,0);l.globalAlpha=.75;l.drawImage(low,1,-1);l.filter='none';}
    c.filter='blur(9px)';c.globalAlpha=.94;c.drawImage(low,0,0,lw,lh,0,0,w,h);c.globalAlpha=.52;c.drawImage(low,0,0,lw,lh,-10,4,w+20,h-8);c.filter='none';
    const blur=Math.max(3.2,opts.blur||4.4);c.filter=`blur(${blur}px)`;c.globalAlpha=.72;c.drawImage(mask,-2,0);c.globalAlpha=.54;c.drawImage(mask,3,-2);c.globalAlpha=.42;c.drawImage(mask,0,3);c.filter='none';
    c.globalCompositeOperation='source-in';const ramp=c.createLinearGradient(0,0,w,0);ramp.addColorStop(0,'rgba(43,0,0,.95)');ramp.addColorStop(.46,'rgba(74,0,0,.92)');ramp.addColorStop(.78,'rgba(158,0,0,.88)');ramp.addColorStop(1,'rgba(204,0,0,.72)');c.fillStyle=ramp;c.fillRect(0,0,w,h);
    c.globalCompositeOperation='lighter';c.globalAlpha=.88;c.drawImage(detail,0,0);
    return {key,canvas,w,h};
  }
  function getTrailMistTexture(){
    const baked=images.trailMist;if(baked?.complete&&baked.naturalWidth)return{key:'trailMist:baked',canvas:baked,w:baked.naturalWidth,h:baked.naturalHeight};
    const key='trailMist:v2:speckBlood';if(state.trailMist?.key===key)return state.trailMist;const size=176,center=size/2;
    const tex=makeBloodFogTexture(key,size,size,1350,(r1,r2,r3,r4,i)=>{const ang=r1*TAU,rad=Math.pow(r2,.55)*center*.92,x=center+Math.cos(ang)*rad*(.85+.25*r3),y=center+Math.sin(ang)*rad*.66;const edge=rad/(center*.92);return{x,y,scale:lerp(.0017,.0043,r4),alpha:lerp(.055,.17,r3)*(1-edge*.62),density:1-edge,dark:r3*.34,hot:.14+r4*.18,rot:ang};},{blur:1.1,blurAlpha:.20});
    return state.trailMist=tex;
  }
  function drawBloodRibbon(ctx,d,alpha=1){
    const pts=d.trail,tex=getTrailMistTexture();if(!pts||pts.length<2||!tex)return;const life=2.15;
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let i=Math.max(0,pts.length-150);i<pts.length;i+=6){
      const p=pts[i],age=matchClock-(p.t||matchClock);if(age<0||age>life)continue;const x=age/life,fade=mistFade(age,life);
      const r1=fract(Math.sin((i+1)*91.37)*43758.5453),r2=fract(Math.sin((i+1)*27.73)*24634.6345);
      const driftX=(r1-.5)*32*x+Math.sin(matchClock*.8+i)*10*x,driftY=-18*x+Math.cos(matchClock*.65+i*.31)*8*x,scale=lerp(.34,.64,x);
      ctx.save();ctx.translate(p.x+driftX,p.y+driftY);ctx.rotate((r2-.5)*.65+Math.sin(matchClock*.45+i)*.08);ctx.globalAlpha=alpha*fade;ctx.filter='blur(2.8px) brightness(1.65) saturate(1.35)';ctx.drawImage(tex.canvas,-tex.w*scale/2,-tex.h*scale*.82/2,tex.w*scale,tex.h*scale*.82);ctx.filter='brightness(1.9) saturate(1.45)';ctx.globalAlpha=alpha*fade*.48;ctx.drawImage(tex.canvas,-tex.w*scale*.72/2,-tex.h*scale*.58/2,tex.w*scale*.72,tex.h*scale*.58);ctx.restore();
    }
    ctx.restore();
  }
  function getHuntMistTexture(){
    const pad=30,near=C.radius*.72,farHalf=C.huntFarWidth*.52,w=Math.ceil(C.huntDepth+pad*2),h=Math.ceil(farHalf*2+pad*2),key=`${w}x${h}:${C.huntMistParticles}:speckBlood:v3`;
    const baked=[images.huntMistBack,images.huntMistMid,images.huntMistFront];
    if(baked.every(img=>img?.complete&&img.naturalWidth))return{key:'huntMist:baked:23000',layers:baked.map((canvas,i)=>({key:`baked-${i}`,canvas,w:canvas.naturalWidth,h:canvas.naturalHeight})),pad,w:baked[0].naturalWidth,h:baked[0].naturalHeight,particles:23000};
    if(state.huntMist?.key===key)return state.huntMist;
    const counts=[8000,9000,6000],layers=counts.map((count,li)=>makeBloodFogTexture(`${key}:layer${li}`,w,h,count,(r1,r2,r3,r4,i)=>{
      const t=Math.pow(r1,li===0?.62:li===1?.72:.82),wobble=1+Math.sin(t*(6.3+li*2.7)+i*.011)*(.14-li*.025)+Math.sin(t*14.7+i*.019)*.055;
      const half=lerp(near*(li===2?.55:.85),farHalf*(li===0?1.15:li===1?1:.82),t)*wobble,side=(r2-.5)*2*half*(.11+.89*r3),edge=Math.abs(side)/Math.max(1,half);
      return{x:pad+C.huntDepth*t+Math.sin(t*10+i*.007)*8*(li+1),y:h/2+side,scale:lerp(.0024,.0060,r4)*(li===2?1.18:1),alpha:lerp(li===0?.25:li===1?.42:.30,li===0?.075:li===1?.13:.09,t)*(1-edge*.38),density:1-edge,dark:(1-t)*(li===0?.76:.48),hot:t*(li===2?.42:.30),rot:r2*TAU};
    },{blur:li===0?2.2:li===1?1.3:2.8,blurAlpha:li===0?.28:li===1?.20:.16,a:12.9+li*4.7,c:78.2+li*9.1,e:37.7+li*6.3}));
    state.huntMist={key,layers:layers.filter(Boolean),pad,w,h,particles:counts.reduce((a,b)=>a+b,0)};return state.huntMist;
  }
  function drawHuntZone(ctx,f,d){
    if(!d.huntActive&&!d.action)return;const dir=d.action?.dir||d.visualDir,nose={x:f.x+dir.x*f.radius*.62,y:f.y+dir.y*f.radius*.62},mist=getHuntMistTexture();
    if(!mist)return;const pulse=.72+.20*Math.sin(matchClock*2.3)+.08*Math.sin(matchClock*5.1),shift1=Math.sin(matchClock*.9)*18,shift2=Math.cos(matchClock*.7)*11;
    ctx.save();ctx.translate(nose.x,nose.y);ctx.rotate(Math.atan2(dir.y,dir.x));
    for(let i=0;i<(mist.layers?.length||0);i++){
      const layer=mist.layers[i],par=i===0?.35:i===1?.72:1.25,sx=1.03+Math.sin(matchClock*(.55+i*.21))*0.035,sy=(i===0?1.38:i===1?1.18:1.52)+Math.cos(matchClock*(.72+i*.27))*0.07;
      ctx.save();ctx.scale(sx,sy);ctx.globalCompositeOperation=i===2?'lighter':'source-over';ctx.filter=`blur(${i===0?4.5:i===1?2.2:6.5}px)`;ctx.globalAlpha=(d.blood?1:.94)*(i===0?.88:i===1?.92:.46)*(i===1?pulse:1.04-pulse*.18);
      const x=-mist.pad+shift1*par+i*3,y=-mist.h/2+shift2*par-i*4;ctx.drawImage(layer.canvas,x,y);ctx.globalAlpha*=.42;ctx.drawImage(layer.canvas,x-12*par,y+8*Math.sin(matchClock*.8+i));ctx.restore();
    }
    ctx.restore();
  }
  function drawPounceLine(ctx,f,d){
    const a=d.action;if(!a)return;ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';const end=a.endpoint||f,pts=[a.start,{x:f.x,y:f.y},end].filter(Boolean);
    ctx.shadowColor='rgba(255,35,45,.85)';ctx.shadowBlur=16;ctx.strokeStyle=a.rebounding?'rgba(255,228,160,.58)':'rgba(255,34,47,.50)';ctx.lineWidth=a.rebounding?18:15;ribbonPath(ctx,pts);ctx.stroke();
    ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,245,230,.72)';ctx.lineWidth=3;ribbonPath(ctx,pts);ctx.stroke();
    ctx.restore();
  }
  function drawWorldFang(ctx){
    for(const fx of state.afterimages){const img=clips[fx.clip]?.[fx.frame-1],a=fx.life/fx.maxLife;ctx.save();ctx.translate(fx.x,fx.y);ctx.rotate(Math.atan2(fx.dir.y,fx.dir.x)+C.bodyForwardOffset);drawBody(ctx,img,.28*a,'saturate(.55)');ctx.restore();}
    for(const f of fighters||[]){if(f?.name!=='FANG'||!alive(f))continue;const d=fangData(f);
      drawHuntZone(ctx,f,d);if((d.huntActive||d.blood)&&d.trail.length>1)drawBloodRibbon(ctx,d,d.blood?1:.82);
      for(const c of liveClones(d)){ctx.save();ctx.translate(c.x,c.y);ctx.rotate(Math.atan2(d.visualDir.y,d.visualDir.x)+C.bodyForwardOffset);const img=d.clip==='howl'?clips.howl[d.frame-1]:d.clip==='hunt'?clips.hunt[(c.frame||d.frame)-1]:clips.normal[(c.frame||d.frame)-1];drawBody(ctx,img,.68,c.kind==='moon'?'saturate(.72) drop-shadow(0 0 12px #63a8ff)':'saturate(.82) drop-shadow(0 0 12px #ffb248)');ctx.restore();}
      if(d.silhouette>0&&d.pendingHowl){const right={x:-d.visualDir.y,y:d.visualDir.x};for(const side of [-1,1]){ctx.save();ctx.translate(f.x+right.x*side*105,f.y+right.y*side*105);ctx.rotate(Math.atan2(d.visualDir.y,d.visualDir.x)+C.bodyForwardOffset);drawBody(ctx,bodyImage(d),.46*d.silhouette,side<0?'brightness(.72) saturate(.7) drop-shadow(0 0 14px #65adff)':'brightness(.78) saturate(.8) drop-shadow(0 0 14px #ffae48)');ctx.restore();}}
      const bob=Math.sin(matchClock*3.1)*5;if(d.stacks.length>=1)drawIcon(ctx,images.moonIcon,d.iconMoon.x,d.iconMoon.y+bob,'#6cb7ff');if(d.stacks.length>=2)drawIcon(ctx,images.sunIcon,d.iconSun.x,d.iconSun.y-bob,'#ffb84f');
    }
    for(const r of state.rings){const t=r.age/r.maxLife,rad=25+t*250;ctx.save();ctx.globalAlpha=clamp(r.life/r.maxLife,0,1)*.75;ctx.strokeStyle=ctx.createPattern(images.howlRing,'repeat')||'#e9d9c1';ctx.lineWidth=lerp(10,5,t);ctx.beginPath();ctx.arc(r.x,r.y,rad,0,TAU);ctx.stroke();ctx.restore();}
    for(const p of state.particles){const a=p.life/p.maxLife;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.globalAlpha=a*.8;const s=p.scale*(.7+.3*a);if(p.img.complete)ctx.drawImage(p.img,-p.img.width*s/2,-p.img.height*s/2,p.img.width*s,p.img.height*s);ctx.restore();}
  }
  function drawIcon(ctx,img,x,y,color){if(!img?.complete)return;ctx.save();ctx.translate(x,y);ctx.globalAlpha=.92;ctx.filter=`drop-shadow(0 0 9px ${color}) drop-shadow(0 0 14px ${color})`;const s=.066;ctx.drawImage(img,-img.width*s/2,-img.height*s/2,img.width*s,img.height*s);ctx.restore();}
  function drawTopFang(ctx){for(const fx of state.marks){const target=(fighters||[]).find(f=>f.id===fx.targetId),x=target?.x??fx.x,y=target?.y??fx.y,t=1-fx.life/fx.maxLife,a=fx.life/fx.maxLife;ctx.save();ctx.translate(x,y);ctx.rotate(fx.angle+C.bodyForwardOffset);ctx.globalAlpha=Math.sin(Math.min(1,t/.18)*Math.PI*.5)*Math.min(1,a/.4);const img=images.biteMark,s=.07;if(img.complete)ctx.drawImage(img,-img.width*s/2,-img.height*s/2,img.width*s,img.height*s);ctx.restore();}}
  function beginCollision(f,target){const d=fangData(f);if(d.action||d.huntActive||d.overlapLatch)return false;return beginPounce(f,target,'collision',d.visualDir);}
  function interceptDamage(f,amount,source,label,statusDamage){const d=fangData(f);if(statusDamage||!source||source===f||d.clones.every(c=>c.dead||c.reserved))return false;const c=liveClones(d).filter(x=>!x.reserved).sort((a,b)=>dist(a.x,a.y,source.x??f.x,source.y??f.y)-dist(b.x,b.y,source.x??f.x,source.y??f.y))[0];if(!c)return false;c.hp-=amount;d.interceptFx.push({x:c.x,y:c.y,life:.22,kind:c.kind});if(c.hp<=0){c.dead=true;emitSpecks(c.kind,c.x,c.y,28,150);}return true;}
  function clearFang(){state.afterimages.length=state.marks.length=state.rings.length=state.particles.length=0;state.seed=0x46a91d2b;}
  const FangType={id:'fang',name:'FANG',color:C.color,desc:'Lunar-solar blood hunter with wall-rebound pounces and an energy wolf pack',speed:540,startDx:1,startDy:.35,noRage:true,
    init:initFang,update:updateFang,speedModifier,draw:drawFang,onCollide:(f,e)=>beginCollision(f,e)};
  const old=FighterTypes.find(x=>x?.name==='FANG');if(old)Object.assign(old,FangType);else FighterTypes.push(FangType);ASSET_ONLY_FIGHTER_SFX.add('FANG');
  window.FighterTypes=window.apexFighterTypes=FighterTypes;
  const previousGlyphFang=fighterGlyph;fighterGlyph=name=>name==='FANG'?'F':previousGlyphFang(name);
  function appendFangCard(){const grid=document.getElementById('roster-grid'),ft=FighterTypes.find(x=>x.name==='FANG');if(!grid||!ft||grid.querySelector('[data-fighter="FANG"]'))return;const card=document.createElement('div');card.className='fighter-card';card.dataset.fighter='FANG';card.style.color=ft.color;const name=document.createElement('div');name.className='f-name';name.textContent='FANG';const preview=document.createElement('canvas');preview.className='f-preview';preview.width=140;preview.height=96;card.append(name,preview);card.onclick=()=>selectFighter(ft,card);grid.appendChild(card);}
  const hasLegacyFangPicker=typeof populateRoster==='function'&&typeof syncSelectedFighterVfx==='function'&&typeof selectFighter==='function';
  if(hasLegacyFangPicker){const prevPopulateFang=populateRoster;populateRoster=function(...args){const result=prevPopulateFang.apply(this,args);appendFangCard();return result;};
  const prevSyncFang=syncSelectedFighterVfx;syncSelectedFighterVfx=function(...args){const result=prevSyncFang.apply(this,args);for(const [player,ft] of [[1,p1Selection],[2,p2Selection]])if(ft?.name==='FANG'){const img=document.getElementById(`p${player}-fighter-vfx`);if(img){img.src=ROOT+'selectionVisual.webp';img.classList.add('has-fighter');img.closest('.picked-fighter-slot')?.setAttribute('data-fighter','FANG');}}return result;};}
  const prevUpdateFang=update;update=function(dt){const result=prevUpdateFang(dt);if(gameState==='PLAYING')updateVisualState(dt);if(gameState==='SOLO')window.APEX_FANG?.soloAdvance?.(window.__solo375,dt);return result;};
  const prevCollisionsFang=handleCollisions;handleCollisions=function(dt){const a=fighters?.[0],b=fighters?.[1];if(a&&b&&alive(a)&&alive(b)){const gap=dist(a.x,a.y,b.x,b.y),overlap=gap<a.radius+b.radius;for(const [f,e] of [[a,b],[b,a]])if(f.name==='FANG'){const d=fangData(f);if(!overlap)d.overlapLatch=false;if(d.action&&overlap)return;if(overlap&&!f.hasStatus('abilityDisabled')&&beginCollision(f,e))return;if(overlap&&d.huntActive&&beginPounce(f,e,'hunting',d.visualDir))return;}}return prevCollisionsFang(dt);};
  const prevDamageFang=Fighter.prototype.takeDamage;Fighter.prototype.takeDamage=function(amount,source=null,label='',statusDamage=false){if(this.name==='FANG'&&Number.isFinite(amount)&&amount>0&&interceptDamage(this,amount,source,label,statusDamage))return;return prevDamageFang.call(this,amount,source,label,statusDamage);};
  const prevStartFang=startSpecificMatch;startSpecificMatch=function(...args){clearFang();return prevStartFang.apply(this,args);};
  const prevEndFang=endMatch;endMatch=function(...args){const result=prevEndFang.apply(this,args);clearFang();return result;};
  const prevMenuFang=goToMenu;goToMenu=function(...args){clearFang();return prevMenuFang.apply(this,args);};
  const prevDrawProjFang=drawProjectiles;drawProjectiles=function(ctx){const result=prevDrawProjFang(ctx);drawWorldFang(ctx);return result;};
  const prevTopFang=window.__apexTopLayerDraw;window.__apexTopLayerDraw=function(ctx){if(typeof prevTopFang==='function')prevTopFang(ctx);drawTopFang(ctx);};
  function soloEnsure(p){return p.data.fang||=( {clock:0,stacks:0,clones:0,hunt:0} );}
  function soloAttack(st,p){const d=soloEnsure(p),e=p.side===1?st.p2:st.p1;if(!e||e.dead)return;p.dash=.18;p.cd.normal=.7;if(Math.abs(e.x-p.x)<125){e.hp=Math.max(0,e.hp-(d.clones>=2?18:d.clones===1?13.5:9));d.stacks++;if(d.clones>=2)d.clones=0;if(d.stacks>=3){d.stacks=0;d.clones=2;}if(e.hp<=0){e.dead=true;st.winner=p;}play('huntingPounce',.58);}}
  function soloSpecial(st,p){const d=soloEnsure(p);d.hunt=2;p.cd.special=5;play('huntStart',.56);}
  function soloRage(st,p){const d=soloEnsure(p);d.stacks=0;d.clones=2;p.cd.rage=8;play('howl',.62);}
  function soloAdvance(st,dt){for(const p of [st?.p1,st?.p2])if(p?.name==='FANG'){const d=soloEnsure(p);d.clock=(d.clock+dt)%(.5416667);d.hunt=Math.max(0,d.hunt-dt);}}
  function drawSolo(ctx,p){const d=soloEnsure(p),frame=Math.floor(d.clock*24)%13;const img=clips.normal[frame];if(img.complete){const s=.052;ctx.rotate(C.bodyForwardOffset);ctx.drawImage(img,-img.width*s/2,-img.height*s/2,img.width*s,img.height*s);}else drawSketchBlob(ctx,46,C.color,12);}
  window.APEX_FANG={constants:C,clips,images,audioFiles,state,FangType,beginPounce,fangData,soloAttack,soloSpecial,soloRage,soloAdvance,drawSolo,selfTest:()=>({registered:FighterTypes.filter(x=>x.name==='FANG').length,frames:{normal:clips.normal.length,hunt:clips.hunt.length,howl:clips.howl.length},pounceSpeed:C.pounceSpeed,pickButton:images.selectionButton.src,picked:images.selectionVisual.src})};
  Object.assign(window.apexReactBridge||{},{APEX_FANG:window.APEX_FANG,startSpecificMatch,goToMenu});Object.assign(window,{APEX_FANG:window.APEX_FANG,startSpecificMatch,goToMenu});
  if(hasLegacyFangPicker)appendFangCard();
  console.info('[Apex Chaos] FANG V7 integrated',window.APEX_FANG.selfTest());
})();
