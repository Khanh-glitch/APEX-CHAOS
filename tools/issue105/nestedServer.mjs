// Issue #105 — shared nested itch-candidate server (same isolation law as the
// #103 nested gate): the wrapper page lives at "/", the packed Gold build lives
// under "/html/apex/", and ANY root-relative escape (/assets, /gold, /game ...)
// answers HTTP 404 and is recorded. Nothing is deployed or published.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ITCH_DIR = path.join(ROOT, 'dist-itch-html5');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

const WRAPPER = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Nested /html/apex/ candidate harness (#105)</title>
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#07090d}iframe{border:0;width:100vw;height:100vh;display:block}</style>
</head><body><iframe id="itch-game-drop" src="/html/apex/index.html" allow="autoplay; fullscreen" allowfullscreen></iframe></body></html>`;

// Opens a wrapper with a SIZED iframe (for embed gates). `frameStyle` is CSS.
export function wrapperWith(src, frameStyle = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>html,body{margin:0;padding:0;background:#07090d;overflow:hidden}iframe{border:0;display:block;${frameStyle}}</style></head>
<body><iframe id="embed" src="${src}" allow="autoplay; fullscreen" allowfullscreen></iframe></body></html>`;
}

export async function startNestedServer({ extraRoutes = {} } = {}) {
  const serverErrors = [];
  const requests = [];
  const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(urlObj.pathname);
    if (extraRoutes[pathname]) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(extraRoutes[pathname]); return; }
    if (pathname === '/' || pathname === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(WRAPPER); return; }
    if (pathname === '/favicon.ico') { const fav = path.join(ITCH_DIR, 'favicon.ico'); if (fs.existsSync(fav)) { res.writeHead(200, { 'Content-Type': 'image/x-icon' }); res.end(fs.readFileSync(fav)); return; } }
    if (!pathname.startsWith('/html/apex/')) {
      serverErrors.push(`404 ESCAPED_ROOT_PATH ${pathname}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(`Escaped nested root: ${pathname}`); return;
    }
    let sub = pathname.slice('/html/apex/'.length);
    if (sub === '' || sub.endsWith('/')) sub += 'index.html';
    const target = path.resolve(ITCH_DIR, sub);
    if (!target.startsWith(ITCH_DIR + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      serverErrors.push(`404 MISSING_NESTED_ASSET ${pathname}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(`Not found: ${pathname}`); return;
    }
    requests.push(pathname);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(target).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    serverErrors,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
