// BOT WAVE mobile orientation authority. Android may allow native landscape
// lock after fullscreen; browsers that deny it get a visually rotated, fully
// interactive game viewport instead. No "rotate your phone" message.
export function createBotWaveMobileImmersive() {
 const mobile=matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints>0;
 if(!mobile)return {request(){},release(){}};
 let ownedFullscreen=false,requestedLock=false;
 const style=document.createElement('style');
 style.id='apex-botwave-immersive-style';
 style.textContent=`
 @media (orientation:portrait) and (pointer:coarse){
  #apex-wave-host{
   inset:auto!important;left:100vw!important;top:0!important;
   width:100dvh!important;height:100dvw!important;
   transform-origin:top left!important;transform:rotate(90deg)!important;
  }
 }
 `;
 document.head.append(style);
 const lock=()=>{
  if(!document.fullscreenElement || !screen.orientation?.lock)return;
  try{Promise.resolve(screen.orientation.lock('landscape')).then(()=>{requestedLock=true}).catch(()=>{});}catch(_){}
 };
 document.addEventListener('fullscreenchange',lock);
 const request=()=>{
  if(document.fullscreenElement){lock();return;}
  const fn=document.documentElement.requestFullscreen;
  if(!fn)return;
  try{
   const pending=fn.call(document.documentElement,{navigationUI:'hide'});
   ownedFullscreen=true;
   Promise.resolve(pending).then(lock).catch(()=>{ownedFullscreen=false;});
  }catch(_){ownedFullscreen=false;}
 };
 const release=()=>{
  document.removeEventListener('fullscreenchange',lock);
  style.remove();
  if(requestedLock)try{screen.orientation?.unlock?.()}catch(_){}
  if(ownedFullscreen && document.fullscreenElement)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
 };
 return {request,release};
}
