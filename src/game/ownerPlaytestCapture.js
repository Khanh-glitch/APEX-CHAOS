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
      const ok = await window.apexLaunchProductSurface?.('bot');
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

function stopRecording(reason) {
  const item = session;
  if (!item) return;
  session = null;
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
  const game = window.APEX_ARSENAL?.state;
  const hud = document.getElementById('battleHudHost');
  if (!game?.active || game.battleMode !== 'BOT' || game.over || !hud?.classList.contains('is-open')) {
    notice('Shift + Ctrl + F7 chỉ ghi khi đang trong BOT Battle Gold HUD.',true); return;
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
        // Preserve every displayed HUD pixel (contain, never stretch/crop).
        const scale = Math.min(W/video.videoWidth,H/video.videoHeight);
        const w = video.videoWidth*scale,h = video.videoHeight*scale;
        ctx.drawImage(video,(W-w)/2,(H-h)/2,w,h);
      }
      item.frame = requestAnimationFrame(paint);
    };
    paint(performance.now());
    rec.start(1000);
    document.getElementById('apex-owner-notice')?.remove();
    document.title = '● REC BOT · APEX CHAOS';
    track.addEventListener('ended',() => {
      if (session === item) stopRecording('sharing-ended');
    },{once:true});
    if (Math.abs(video.videoWidth/video.videoHeight - W/H) > 0.045)
      console.warn('[owner-capture] Tab is not 9:16: letterbox preserves actual HUD. Resize the captured game tab to portrait for a full-frame TikTok result.');
  } catch (error) {
    if (display && !session) display.getTracks().forEach(t=>t.stop());
    notice('Không bắt đầu ghi: '+String(error?.message||error),true);
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
    isRecordingResultHold:() => !!session?.tailTimer
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
