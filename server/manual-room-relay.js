import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANUAL_ROOM_ROUTE = '/__manual-lab-room';

function encodeWsText(text) {
  const payload = Buffer.from(text);
  if (payload.length < 126) return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  if (payload.length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(payload.length), 2);
  return Buffer.concat([header, payload]);
}

function decodeWsFrames(buffer, onText) {
  let offset = 0;
  while (buffer.length - offset >= 2) {
    const b0 = buffer[offset];
    const opcode = b0 & 0x0f;
    const b1 = buffer[offset + 1];
    const masked = (b1 & 0x80) !== 0;
    let length = b1 & 0x7f;
    let header = 2;
    if (length === 126) {
      if (buffer.length - offset < 4) break;
      length = buffer.readUInt16BE(offset + 2);
      header = 4;
    } else if (length === 127) {
      if (buffer.length - offset < 10) break;
      const big = buffer.readBigUInt64BE(offset + 2);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('WebSocket frame too large.');
      length = Number(big);
      header = 10;
    }
    const maskBytes = masked ? 4 : 0;
    const frameEnd = offset + header + maskBytes + length;
    if (buffer.length < frameEnd) break;
    if (opcode === 0x8) return { close:true, rest:Buffer.alloc(0) };
    if (opcode === 0x1) {
      const payloadStart = offset + header + maskBytes;
      const payload = Buffer.from(buffer.subarray(payloadStart, payloadStart + length));
      if (masked) {
        const mask = buffer.subarray(offset + header, offset + header + 4);
        for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
      }
      onText(payload.toString('utf8'));
    }
    offset = frameEnd;
  }
  return { close:false, rest:buffer.subarray(offset) };
}

function websocketAcceptKey(key) {
  return crypto.createHash('sha1')
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');
}

export function createManualRoomRelay() {
  const rooms = new Map();
  let nextClientId = 1;

  const makeRoomCode = () => {
    for (let tries = 0; tries < 1000; tries += 1) {
      const code = crypto.randomBytes(3).toString('base64url').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase();
      if (code.length === 4 && !rooms.has(code)) return code;
    }
    return String(Date.now()).slice(-4);
  };
  const send = (client, payload) => {
    if (!client || client.socket.destroyed) return;
    client.socket.write(encodeWsText(JSON.stringify(payload)));
  };
  const peers = client => client.room && rooms.get(client.room) ? [...rooms.get(client.room)].filter(peer => peer !== client) : [];
  const relay = (client, payload) => {
    for (const peer of peers(client)) send(peer, payload);
  };
  const leave = (client) => {
    if (!client.room || !rooms.has(client.room)) return;
    const set = rooms.get(client.room);
    set.delete(client);
    relay(client, { type:'peer-left', room:client.room });
    if (set.size === 0) rooms.delete(client.room);
    client.room = null;
  };
  const joinRoom = (client, code, role) => {
    const room = rooms.get(code);
    if (!room) return send(client, { type:'error', reason:'ROOM NOT FOUND' });
    if (room.size >= 2 && !room.has(client)) return send(client, { type:'error', reason:'ROOM FULL' });
    leave(client);
    room.add(client);
    client.room = code;
    client.role = role;
    send(client, { type:'joined', room:code, role, peers:room.size });
    relay(client, { type:'peer-joined', room:code, peers:room.size });
    return null;
  };

  function handleUpgrade(req, socket) {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    if (requestUrl.pathname !== MANUAL_ROOM_ROUTE) return false;
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return true;
    }
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${websocketAcceptKey(key)}`,
      '',
      '',
    ].join('\r\n'));

    const client = { id:nextClientId++, socket, room:null, role:null };
    let pending = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      try {
        const decoded = decodeWsFrames(pending, (text) => {
          const message = JSON.parse(text);
          if (message.type === 'create') {
            const code = makeRoomCode();
            rooms.set(code, new Set());
            joinRoom(client, code, 'host');
            send(client, { type:'created', room:code, role:'host' });
          } else if (message.type === 'join') {
            const code = String(message.room || '').trim().toUpperCase();
            joinRoom(client, code, 'guest');
          } else if (['room-start', 'input', 'snapshot', 'chat', 'leave'].includes(message.type)) {
            if (message.type === 'leave') leave(client);
            else relay(client, { ...message, from:client.role, room:client.room });
          }
        });
        pending = decoded.rest;
        if (decoded.close) socket.end();
      } catch (error) {
        send(client, { type:'error', reason:error instanceof Error ? error.message : String(error) });
      }
    });
    socket.on('close', () => leave(client));
    socket.on('error', () => leave(client));
    return true;
  }

  return {
    route:MANUAL_ROOM_ROUTE,
    roomCount:() => rooms.size,
    handleUpgrade
  };
}

export function attachManualRoomRelay(httpServer) {
  const relay = createManualRoomRelay();
  httpServer.on('upgrade', (req, socket) => {
    relay.handleUpgrade(req, socket);
  });
  return relay;
}

export function manualLabRoomRelay() {
  let relay = null;
  return {
    name:'apex-manual-lab-room-relay',
    configureServer(server) {
      if (server.httpServer) relay = attachManualRoomRelay(server.httpServer);
    },
    api:() => relay
  };
}

export function createManualRoomRelayServer() {
  const relay = createManualRoomRelay();
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok:true, route:relay.route, rooms:relay.roomCount() }));
      return;
    }
    res.statusCode = 404;
    res.end('Not Found');
  });
  server.on('upgrade', (req, socket) => {
    if (!relay.handleUpgrade(req, socket)) socket.destroy();
  });
  return { server, relay };
}

const thisFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entryFile && path.resolve(thisFile) === entryFile) {
  const port = Number(process.env.PORT || process.env.MANUAL_ROOM_PORT || 8787);
  const host = process.env.HOST || process.env.MANUAL_ROOM_HOST || '0.0.0.0';
  const { server } = createManualRoomRelayServer();
  server.listen(port, host, () => {
    console.log(`[manual-room-relay] listening on ws://${host}:${port}${MANUAL_ROOM_ROUTE}`);
  });
}
