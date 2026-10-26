// Browser-mediated: fullscreen and landscape lock are best-effort, never faked.
// Call request() synchronously from the Home BOT WAVE click's user gesture.
export function createBotWaveMobileImmersive() {
  const mobile = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (!mobile) return {request(){},release(){}};
  let ownedFullscreen = false;
  const hint = document.createElement('div');
  hint.id = 'apex-wave-rotate-hint';
  hint.setAttribute('role','status');
  hint.textContent = 'XOAY NGANG ĐIỆN THOẠI ĐỂ CHƠI BOT WAVE';
  Object.assign(hint.style,{position:'fixed',inset:'0',zIndex:'950',display:'none',
    alignItems:'center',justifyContent:'center',textAlign:'center',padding:'30px',
    font:'800 18px system-ui',color:'#ffe0a2',background:'#090c11ee',pointerEvents:'none'});
  document.body.append(hint);
  const update=()=>{
    hint.style.display=matchMedia('(orientation: portrait)').matches?'flex':'none';
    if(document.fullscreenElement && screen.orientation?.lock){
      Promise.resolve(screen.orientation.lock('landscape')).catch(()=>{});
    }
  };
  document.addEventListener('fullscreenchange',update);
  window.addEventListener('orientationchange',update,{passive:true});
  const request=()=>{
    update();
    if(!document.fullscreenElement && document.documentElement.requestFullscreen){
      try{
        const pending=document.documentElement.requestFullscreen({navigationUI:'hide'});
        ownedFullscreen=true;
        Promise.resolve(pending).then(update).catch(()=>{ownedFullscreen=false;update();});
      }catch(_){ownedFullscreen=false;}
    }
  };
  const release=()=>{
    document.removeEventListener('fullscreenchange',update);
    window.removeEventListener('orientationchange',update);
    hint.remove();
    if(ownedFullscreen && document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
    try{screen.orientation?.unlock?.()}catch(_){}
  };
  return {request,release};
}
