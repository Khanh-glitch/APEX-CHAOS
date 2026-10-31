// Owner-only playtest convenience, not authentication: the embedded passcode
// is readable in the client bundle. Never authorize cloud/admin or wallet writes.
let unlocked = false;
let session = null;
let starting = false;
const TAIL_MS = 10000;
const W = 1080, H = 1920;

function notice(message, error = false) {
  if (session) { console.info('[owner-capture]', message); return; }
  let box = document.getElementById('apex-owner-notice');
  if (!box) {
    box = document.createElement('div');
    box.id = 'apex-owner-notice';
    box.setAttribute('role', 'status');
    document.body.append(box);
  }
  box.style.cssText = 'position:fixed;z-index:2147483646;bottom:24px;left:50%;transform:translateX(-50%);max-width:min(90vw,540px);padding:12px 18px;border-radius:8px;pointer-events:none;color:#ffe8c0;background:#0b1019f5;border:1px solid '+(error?'#f06660':'#e9b35b')+';font:600 13px/1.5 system-ui;text-align:center;box-shadow:0 10px 32px #000a';
  box.textContent = message;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => box.remove(), 4200);
}

function setUnlocked(on) {
  if (on && window.APEX_ARSENAL?.state?.active) {
    notice('Thoát trận trước khi mở owner playtest.', true);
    return false;
  }
  unlocked = on === true;
  const selector = window.APEX_ARSENAL_OWNER_TEST;
  if (selector) {
    selector.active = unlocked;
    selector.selectedWeaponId = null;
  }
  window.dispatchEvent(new CustomEvent('apex:owner-playtest-changed', { detail: { active: unlocked } }));
  return true;
}

function passwordPanel() {
  if (document.getElementById('apex-owner-password-panel')) return;
  const shade = document.createElement('div');
  shade.id = 'apex-owner-password-panel';
  shade.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:16px;background:#02050bd9;backdrop-filter:blur(9px)';
  const form = document.createElement('form');
  form.setAttribute('role','dialog'); form.setAttribute('aria-modal','true');
  form.setAttribute('aria-label','Owner playtest password');
  form.style.cssText = 'width:min(420px,100%);padding:25px;background:linear-gradient(145deg,#211813,#0a111b);color:#f6e4d1;border:1px solid #ebb057;border-radius:12px;box-shadow:0 25px 75px #000;font:600 13px/1.5 system-ui';
  const title = document.createElement('h2');
  title.textContent = 'APEX CHAOS · OWNER PLAYTEST';
  title.style.cssText = 'margin:0 0 12px;color:#ffca76;font:900 18px/1.3 system-ui';
  const info = document.createElement('p');
  info.textContent = 'Nhập mật khẩu để mở Fighter Pick với mọi tướng đã hoàn thiện gameplay.';
  info.style.cssText = 'margin:0 0 15px;color:#dbd0c5';
  const field = document.createElement('input');
  field.type = 'password'; field.required = true; field.autocomplete = 'off';
  field.inputMode = 'numeric'; field.maxLength = 32;
  field.setAttribute('aria-label','Mật khẩu owner');
  field.style.cssText = 'width:100%;height:48px;margin:0 0 8px;padding:0 13px;border:1px solid #826342;border-radius:6px;background:#0a101a;color:white;font:700 18px system-ui';
  const error = document.createElement('div');
  error.setAttribute('role','alert');
  error.style.cssText = 'min-height:24px;color:#ff837b';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.textContent = 'HỦY';
  const submit = document.createElement('button');
  submit.type = 'submit'; submit.textContent = 'VÀO PICK TƯỚNG';
  [cancel,submit].forEach(button => {
    button.style.cssText = 'cursor:pointer;border:1px solid #b49363;border-radius:6px;padding:10px 12px;background:#28211d;color:#ffe0ac;font:800 12px system-ui';
  });
  submit.style.background = '#874e1e';
  actions.append(cancel,submit);
  form.append(title,info,field,error,actions);
  shade.append(form); document.body.append(shade);
  const close = () => shade.remove();
  cancel.addEventListener('click',close);
  shade.addEventListener('click',event => { if (event.target === shade) close(); });
  shade.addEventListener('keydown',event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
  });
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (field.value !== '500509') {
      error.textContent = 'Mật khẩu không chính xác.';
      field.value = ''; field.focus(); return;
    }
    if (!setUnlocked(true)) { close(); return; }
    close();
    try {
      const ok = await window.apexLaunchProductSurface?.('bot-battle');
      if (ok !== true) {
        setUnlocked(false);
        notice('Chưa mở được Fighter Pick. Hãy đợi Home sẵn sàng rồi thử lại.',true);
      } else notice('OWNER PLAYTEST ON · Tất cả tướng có gameplay đều chọn được.');
    } catch (err) {
      setUnlocked(false);
      notice('Không thể mở BOT Fighter Pick: '+String(err?.message||err),true);
    }
  });
  field.focus();
}

// The itch.io host is a cross-origin parent document. Its iframe does not
// delegate display-capture, so the embedded game cannot prompt for permission.
// Do NOT suggest changing a browser setting or retrying in the same iframe.
function displayCapturePolicyDenied() {
  try {
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (typeof policy?.allowsFeature === 'function')
      return policy.allowsFeature('display-capture') === false;
  } catch (_) { /* policies differ between browsers */ }
  return false;
}

function isDisplayCapturePolicyError(error) {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('display-capture') &&
    (msg.includes('permissions policy') || msg.includes('permission policy')
      || msg.includes('disallowed by'));
}

// F7 never records a desktop/tab layout. The sole supported capture host is a
// same-origin TOP-LEVEL portrait studio whose *real game iframe* has a phone
// viewport. This is a new game session, not a second unsynchronized renderer.
function portraitStudio() {
  try {
    const frame=window.frameElement;
    const parent=window.parent;
    if(!frame||frame.id!=='apex-portrait-stage'||parent===window||
       parent.top!==parent) return null;
    const studio=parent.APEX_PORTRAIT_STUDIO;
    return studio?.version==='tiktok-portrait-v1' ? studio : null;
  }catch(_){return null;}
}
function studioEntryURL() {
  return new URL('portrait-studio.html',window.location.href).href;
}
function studioRecordStatus(recording) {
  if(!portraitStudio()) return;
  try{window.parent.postMessage({type:'apex:portrait-record-status',recording},window.location.origin);}
  catch(_){}
}
// Crop the live captured browser tab to EXACTLY the phone iframe surface.
// Browser screen/window chrome, desktop layout and studio sidebar are excluded.
export function portraitFrameCrop(sourceWidth,sourceHeight,geometry) {
  const {left,top,width,height,viewportWidth,viewportHeight}=geometry||{};
  if(![sourceWidth,sourceHeight,left,top,width,height,viewportWidth,viewportHeight]
      .every(x=>Number.isFinite(x)&&x>0) || sourceWidth<2 || sourceHeight<2)
    throw new Error('Khung 9:16 chưa sẵn sàng.');
  const sx=left*sourceWidth/viewportWidth;
  const sy=top*sourceHeight/viewportHeight;
  const sw=width*sourceWidth/viewportWidth;
  const sh=height*sourceHeight/viewportHeight;
  if(sx<-1||sy<-1||sx+sw>sourceWidth+1||sy+sh>sourceHeight+1)
    throw new Error('Khung phone đang nằm ngoài vùng tab. Hãy mở rộng cửa sổ trình duyệt.');
  if(Math.abs(width/height-W/H)>0.008)
    throw new Error('Khung game chưa đúng tỷ lệ 9:16.');
  return {sx:Math.max(0,sx),sy:Math.max(0,sy),sw:Math.min(sw,sourceWidth-Math.max(0,sx)),
    sh:Math.min(sh,sourceHeight-Math.max(0,sy))};
}

function standaloneRecordingPanel() {
  if (document.getElementById('apex-owner-standalone-recording')) return;
  document.getElementById('apex-owner-notice')?.remove();
  const shade = document.createElement('div');
  shade.id = 'apex-owner-standalone-recording';
  shade.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:#02050bed;backdrop-filter:blur(8px);color:#ffedd7;font-family:system-ui,sans-serif';
  const panel = document.createElement('div');
  panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
  panel.setAttribute('aria-label','Mở TikTok Portrait Studio 9:16');
  panel.style.cssText = 'width:min(490px,100%);padding:24px;border:1px solid #edb15f;background:#10151ff7;border-radius:12px;box-shadow:0 25px 90px #000c;line-height:1.6';
  const title = document.createElement('h2');
  title.textContent = 'APEX CHAOS · RECORDING MODE';
  title.style.cssText = 'margin:0 0 12px;color:#ffbe60;font-size:19px';
  const message = document.createElement('p');
  message.textContent = 'Để video có đúng HUD phone 9:16 trên laptop, hãy chơi trong Portrait Studio. Studio chạy game thật ở viewport 432 × 768 và chỉ quay khu vực này thành 1080 × 1920, không quay desktop. Đây là phiên chơi mới, nên cần vào lại BOT Battle.';
  message.style.cssText = 'margin:0 0 16px;font-size:14px;color:#f2dfc5';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:center';
  const open = document.createElement('a');
  open.id='apex-owner-record-standalone-link';
  open.textContent='MỞ PORTRAIT STUDIO 9:16';
  // The browser controls user-initiated navigation and popup restrictions.
  // No automatic screen-sharing request or cross-origin permission bypass.
  open.href=studioEntryURL();
  open.target='_blank'; open.rel='noopener noreferrer';
  open.style.cssText='display:inline-flex;align-items:center;min-height:42px;padding:10px 16px;background:#d58a31;color:#15100a;text-decoration:none;font-weight:900;border-radius:6px;font-size:13px';
  const cancel=document.createElement('button');
  cancel.type='button'; cancel.textContent='ĐÓNG';
  cancel.style.cssText='min-height:42px;padding:10px 16px;background:#252a34;color:#f2dfc5;border:1px solid #5b5862;border-radius:6px;cursor:pointer;font-weight:700';
  const copy=document.createElement('button');
  copy.type='button';copy.textContent='SAO CHÉP LINK';
  copy.style.cssText='min-height:42px;padding:10px 12px;background:#252a34;color:#f2dfc5;border:1px solid #5b5862;border-radius:6px;cursor:pointer;font-weight:700';
  actions.append(open,copy,cancel);
  const urlField=document.createElement('input');
  urlField.id='apex-owner-record-direct-url';
  urlField.type='text';urlField.readOnly=true;urlField.value=studioEntryURL();
  urlField.setAttribute('aria-label','Đường dẫn trực tiếp của game');
  urlField.style.cssText='margin-top:12px;box-sizing:border-box;width:100%;padding:9px;background:#080b12;color:#d7dbe3;border:1px solid #585a62;border-radius:5px;font:12px/1.5 ui-monospace,monospace';
  copy.addEventListener('click',async()=>{
    urlField.focus();urlField.select();
    try {
      if(!navigator.clipboard?.writeText)throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(urlField.value);
      copy.textContent='ĐÃ SAO CHÉP';
    }catch(_){copy.textContent='LINK ĐÃ CHỌN · CTRL+C';}
  });
  const note=document.createElement('p');
  note.textContent='Nếu itch chặn mở tab mới, sao chép URL studio và dán vào thanh địa chỉ tab mới. Vào game trong khung 9:16 rồi bấm F7 (hoặc nút REC) và chọn This Tab. Không thể quay đồng thời trận desktop đang chơi thành một bản phone riêng mà không đồng bộ hai phiên game.';
  note.style.cssText='font-size:12px;color:#b7b8c0;margin:12px 0 0';
  panel.append(title,message,actions,urlField,note);
  shade.append(panel); document.body.append(shade);
  const close=()=>shade.remove();
  cancel.addEventListener('click',close);
  shade.addEventListener('click',event=>{if(event.target===shade)close();});
  shade.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
  open.focus();
}

function stopRecording(reason) {
  const item = session;
  if (!item) return;
  session = null;
  studioRecordStatus(false);
  clearTimeout(item.tailTimer);
  cancelAnimationFrame(item.frame);
  item.recorder.onstop = () => {
    const type = item.recorder.mimeType || 'video/webm';
    const ext = type.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(item.chunks,{type});
    if (blob.size) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'APEX-CHAOS-BOT-1080x1920-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+ext;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url),60000);
      notice('Đã lưu video BOT dọc 1080 × 1920 ('+ext.toUpperCase()+').');
    } else notice('Không ghi được khung hình video.',true);
    console.info('[owner-capture] stopped:',reason);
  };
  try { if (item.recorder.state !== 'inactive') item.recorder.stop(); } catch (_) {}
  item.output.getTracks().forEach(t => t.stop());
  item.display.getTracks().forEach(t => t.stop());
  item.video.pause(); item.video.srcObject = null;
  document.title = item.title;
}

async function startRecording() {
  if (starting || session) return;
  const studio=portraitStudio();
  if(!studio){ standaloneRecordingPanel(); return; }
  const game = window.APEX_ARSENAL?.state;
  const hud = document.getElementById('battleHudHost');
  if (!game?.active || game.battleMode !== 'BOT' || game.over || !hud?.classList.contains('is-open')) {
    notice('Shift + Ctrl + F7 chỉ ghi khi đang trong BOT Battle Gold HUD.',true); return;
  }
  if (displayCapturePolicyDenied()) {
    notice('Trình duyệt chặn quyền quay tab trong Portrait Studio. Hãy mở URL studio trực tiếp ở tab mới.',true); return;
  }
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') {
    notice('Cần Chrome/Edge có hỗ trợ ghi tab trên HTTPS.',true); return;
  }
  starting = true;
  let display = null;
  try {
    // The browser must show its real permission picker. Choose THIS TAB and
    // enable tab audio if wanted; no screen content is read before permission.
    display = await navigator.mediaDevices.getDisplayMedia({
      video:{displaySurface:'browser',frameRate:30},audio:true,
      preferCurrentTab:true,selfBrowserSurface:'include'
    });
    if (!window.APEX_ARSENAL?.state?.active || window.APEX_ARSENAL.state.over)
      throw new Error('Trận kết thúc trước khi bộ ghi bắt đầu.');
    const track = display.getVideoTracks()[0];
    if (!track) throw new Error('Không có video track.');
    const surface = track.getSettings?.().displaySurface;
    if (surface && surface !== 'browser')
      throw new Error('Hãy chọn tab APEX CHAOS, không chọn màn hình/cửa sổ.');
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true;
    video.srcObject = new MediaStream([track]);
    await video.play();
    if (!video.videoWidth || !video.videoHeight) throw new Error('Tab chưa cung cấp video frame.');
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d',{alpha:false});
    if (!ctx || !canvas.captureStream) throw new Error('Canvas capture không khả dụng.');
    const output = canvas.captureStream(30);
    display.getAudioTracks().forEach(audio => output.addTrack(audio));
    const mime = ['video/mp4;codecs=avc1.42E01E','video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus','video/webm']
      .find(type => MediaRecorder.isTypeSupported(type));
    const rec = new MediaRecorder(output,mime?{mimeType:mime,videoBitsPerSecond:8000000}:{videoBitsPerSecond:8000000});
    const item = {display,output,video,recorder:rec,chunks:[],frame:0,tailTimer:0,title:document.title};
    rec.ondataavailable = e => { if (e.data?.size) item.chunks.push(e.data); };
    rec.onerror = () => { stopRecording('media-error'); notice('MediaRecorder báo lỗi.',true); };
    session = item;
    let last = -Infinity;
    const paint = now => {
      if (session !== item) return;
      if (now - last >= 1000 / 30) {
        last = now;
        ctx.fillStyle = '#020304'; ctx.fillRect(0,0,W,H);
        // The source video is the browser TAB. The CROP is precisely the
        // responsive phone viewport's current rectangle within that tab.
        const rect=studio.getCropRect();
        const crop=portraitFrameCrop(video.videoWidth,video.videoHeight,rect);
        ctx.drawImage(video,crop.sx,crop.sy,crop.sw,crop.sh,0,0,W,H);
      }
      item.frame = requestAnimationFrame(paint);
    };
    paint(performance.now());
    rec.start(1000);
    studioRecordStatus(true);
    document.getElementById('apex-owner-notice')?.remove();
    document.title = '● REC BOT · APEX CHAOS';
    track.addEventListener('ended',() => {
      if (session === item) stopRecording('sharing-ended');
    },{once:true});
    console.info('[owner-capture] Phone viewport crop active: 432×768 → 1080×1920. Desktop and sidebar excluded.');
  } catch (error) {
    if (display && !session) display.getTracks().forEach(t=>t.stop());
    if (isDisplayCapturePolicyError(error)) notice('Quyền display-capture bị chặn. Mở Portrait Studio ở tab riêng (không chạy trong itch iframe).',true);
    else notice('Không bắt đầu ghi: '+String(error?.message||error),true);
  } finally { starting = false; }
}

function onResultReady() {
  const item = session;
  if (!item || item.tailTimer) return;
  item.tailTimer = setTimeout(() => {
    if (session !== item) return;
    stopRecording('10-second-result-tail');
    window.dispatchEvent(new Event('apex:owner-result-recorded'));
  },TAIL_MS);
}

export function installOwnerPlaytestCapture(scope = window) {
  if (scope.APEX_OWNER_TOOLS?.version === 'owner-playtest-capture-v1') return scope.APEX_OWNER_TOOLS;
  const api = Object.freeze({
    version:'owner-playtest-capture-v1',
    isPlaytestActive:() => unlocked,
    isRecording:() => !!session,
    isRecordingResultHold:() => !!session?.tailTimer,
    isCaptureBlockedByPolicy:displayCapturePolicyDenied,
    isPortraitStudio:()=>!!portraitStudio(),
    toggleStudioRecording:()=>{
      if(!portraitStudio())return false;
      if(session)stopRecording('manual-studio-button');
      else void startRecording();
      return true;
    }
  });
  Object.defineProperty(scope,'APEX_OWNER_TOOLS',{value:api,writable:false,configurable:false,enumerable:true});
  scope.addEventListener('keydown',event => {
    if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.repeat) return;
    if (event.code !== 'F8' && event.code !== 'F7') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.code === 'F8') {
      if (unlocked) { if (setUnlocked(false)) notice('OWNER PLAYTEST OFF'); }
      else passwordPanel();
    } else if (session) stopRecording('manual-F7');
    else void startRecording();
  },true);
  scope.addEventListener('apex:gold-result-ready',onResultReady);
  scope.addEventListener('apex:gold-battle-exited',() => {
    if (session && !session.tailTimer) stopRecording('battle-exit');
  });
  return api;
}
