// Lightweight realtime rooms for MANUAL LAB.
// Uses VITE_MANUAL_ROOM_WS_URL when provided; otherwise falls back to the local Vite relay.
(function APEX_MANUAL_LAB_ONLINE(){
  if (window.__apexManualLabOnline) return;
  window.__apexManualLabOnline = true;

  const ROOM_ROUTE = '/__manual-lab-room';
  const state = window.APEX_MANUAL_LAB_ONLINE = {
    socket:null,
    room:null,
    role:null,
    connected:false,
    peers:0,
    lastError:null,
    lastSnapshotAt:0
  };

  const $ = id => document.getElementById(id);
  const lab = () => window.APEX_MANUAL_LAB;
  const fighterName = ft => ft?.name || null;
  function status(text, kind='') {
    const el = $('manual-room-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('invalid', kind === 'error');
    el.classList.toggle('valid', kind === 'ok');
  }
  function setCode(code) {
    const el = $('manual-room-code');
    if (el) el.textContent = code || '----';
    const input = $('manual-room-input');
    if (input && code) input.value = code;
  }
  function setRole(role) {
    const el = $('manual-room-role');
    if (el) el.textContent = role ? role.toUpperCase() : 'OFFLINE';
  }
  function updatePanel() {
    setCode(state.room);
    setRole(state.role);
    const start = $('manual-room-start');
    if (start) start.disabled = state.role !== 'host';
    const leave = $('manual-room-leave');
    if (leave) leave.disabled = !state.connected;
  }
  function send(payload) {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return false;
    state.socket.send(JSON.stringify(payload));
    return true;
  }
  function roomWebSocketUrl() {
    const configured = String(window.APEX_MANUAL_ROOM_WS_URL || '').trim();
    if (configured) return configured;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}${ROOM_ROUTE}`;
  }
  function connect() {
    if (state.socket && [WebSocket.CONNECTING, WebSocket.OPEN].includes(state.socket.readyState)) return state.socket;
    const url = roomWebSocketUrl();
    const external = String(window.APEX_MANUAL_ROOM_WS_URL || '').trim();
    const socket = state.socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      state.connected = true;
      state.lastError = null;
      status(external ? 'CONNECTED TO ONLINE ROOM RELAY' : 'CONNECTED TO LOCAL ROOM RELAY', 'ok');
      updatePanel();
    });
    socket.addEventListener('close', () => {
      state.connected = false;
      state.peers = 0;
      status('ROOM DISCONNECTED');
      updatePanel();
    });
    socket.addEventListener('error', () => {
      state.lastError = 'ROOM RELAY ERROR';
      status(external ? 'ROOM RELAY ERROR - CHECK VITE_MANUAL_ROOM_WS_URL' : 'ROOM RELAY ERROR - RUN VIA VITE DEV SERVER', 'error');
    });
    socket.addEventListener('message', event => {
      let msg = null;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.type === 'created') {
        state.room = msg.room;
        state.role = 'host';
        state.peers = 1;
        status(`ROOM ${msg.room} CREATED · SEND CODE TO PLAYER 2`, 'ok');
      } else if (msg.type === 'joined') {
        state.room = msg.room;
        state.role = msg.role;
        state.peers = msg.peers || 1;
        status(msg.role === 'guest' ? `JOINED ${msg.room} · WAIT HOST START` : `ROOM ${msg.room} READY`, 'ok');
      } else if (msg.type === 'peer-joined') {
        state.peers = msg.peers || 2;
        status('PLAYER 2 CONNECTED · HOST CAN START', 'ok');
      } else if (msg.type === 'peer-left') {
        state.peers = 1;
        lab()?.applyRemoteInput?.({held:[],pressed:[],moveVector:{x:0,y:0},pointerInside:false});
        status('OTHER PLAYER LEFT');
      } else if (msg.type === 'room-start') {
        const slot = state.role === 'guest' ? 1 : 0;
        lab()?.startNetworkMatch?.(msg.p1, msg.p2, slot, state.room);
        status(`MATCH STARTED · YOU ARE P${slot + 1}`, 'ok');
      } else if (msg.type === 'input') {
        lab()?.applyRemoteInput?.(msg.input);
      } else if (msg.type === 'snapshot') {
        if (state.role === 'guest') lab()?.applyMatchSnapshot?.(msg.snapshot, {protectLocal:true});
      } else if (msg.type === 'error') {
        state.lastError = msg.reason || 'ROOM ERROR';
        status(state.lastError, 'error');
      }
      updatePanel();
    });
    return socket;
  }
  function createRoom() {
    const socket = connect();
    if (socket.readyState === WebSocket.OPEN) send({type:'create'});
    else socket.addEventListener('open', () => send({type:'create'}), {once:true});
  }
  function joinRoom() {
    const code = String($('manual-room-input')?.value || '').trim().toUpperCase();
    if (!code) { status('ENTER ROOM CODE', 'error'); return; }
    const socket = connect();
    const payload = {type:'join', room:code};
    if (socket.readyState === WebSocket.OPEN) send(payload);
    else socket.addEventListener('open', () => send(payload), {once:true});
  }
  function leaveRoom() {
    send({type:'leave'});
    try { state.socket?.close(); } catch {}
    state.room = null;
    state.role = null;
    state.connected = false;
    state.peers = 0;
    updatePanel();
    status('ROOM CLOSED');
  }
  function startRoomMatch() {
    if (state.role !== 'host') { status('GUEST WAITS FOR HOST START', 'error'); return false; }
    if (!window.p1Selection || !window.p2Selection) { status('HOST MUST SELECT BOTH CHAMPIONS', 'error'); return false; }
    const p1 = fighterName(window.p1Selection);
    const p2 = fighterName(window.p2Selection);
    if (!p1 || !p2) { status('INVALID CHAMPION SELECTION', 'error'); return false; }
    send({type:'room-start', p1, p2});
    lab()?.startNetworkMatch?.(p1, p2, 0, state.room);
    status('MATCH STARTED · YOU ARE P1', 'ok');
    return true;
  }

  function hookUi() {
    $('manual-room-create')?.addEventListener('click', createRoom);
    $('manual-room-join')?.addEventListener('click', joinRoom);
    $('manual-room-leave')?.addEventListener('click', leaveRoom);
    $('manual-room-start')?.addEventListener('click', startRoomMatch);
    $('manual-room-copy')?.addEventListener('click', async () => {
      if (!state.room) return;
      try { await navigator.clipboard?.writeText(state.room); status('ROOM CODE COPIED', 'ok'); } catch { status('COPY FAILED'); }
    });
  }

  const previousStartMatch = window.startMatch;
  window.startMatch = function manualOnlineStartMatch() {
    if (state.room && state.role) {
      if (startRoomMatch()) return true;
      if (state.role === 'guest') return false;
    }
    return previousStartMatch?.apply(this, arguments);
  };
  try { startMatch = window.startMatch; } catch (error) {}
  Object.assign(window.apexReactBridge || {}, { startMatch:window.startMatch });

  let lastInputSent = 0;
  window.addEventListener('apex-manual-lab-input-frame', event => {
    if (!state.room || !state.connected) return;
    const now = performance.now();
    if (now - lastInputSent >= 16) {
      lastInputSent = now;
      send({type:'input', input:event.detail});
    }
    if (state.role === 'host' && now - state.lastSnapshotAt >= 100) {
      state.lastSnapshotAt = now;
      send({type:'snapshot', snapshot:lab()?.getMatchSnapshot?.()});
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hookUi, {once:true});
  else hookUi();
})();
