// Local profiling server for the PRODUCTION Gold build.
// Maps a packaged portable tree under /html/apex/ so the harness exercises the
// same nested path itch.io uses (root-escaped URLs 404 exactly like itch).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
};

export function startServer({ root, port = 0 }) {
  const absRoot = path.resolve(process.env.APEX_PERF_ROOT || root);
  const misses = [];
  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(u.pathname);
    let prefix = '';
    if (pathname.startsWith('/html/apex/')) prefix = '/html/apex/';
    else if (pathname === '/html/apex') { res.writeHead(301, { Location: '/html/apex/' }); res.end(); return; }
    let sub = pathname.slice(prefix.length);
    if (!sub || sub.endsWith('/')) sub += 'index.html';
    const target = path.resolve(absRoot, sub);
    if (!target.startsWith(absRoot + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      misses.push(pathname);
      res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 ' + pathname); return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(target).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, '0.0.0.0', () => {
      const p = server.address().port;
      resolve({ server, misses, port: p, base: `http://127.0.0.1:${p}`, nested: `http://127.0.0.1:${p}/html/apex/` });
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith('goldNestedServer.mjs')) {
  const s = await startServer({ root: process.argv[2] || 'dist-itch-html5', port: Number(process.argv[3] || 8099) });
  console.log('serving', s.nested);
}
