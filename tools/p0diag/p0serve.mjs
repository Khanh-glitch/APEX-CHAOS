// p0serve.mjs — local server that hosts the packaged game and injects the
// diagnosis instrument into it. Nothing in the game tree is modified: the
// injected <script> is added to index.html in the HTTP response only.
//
// Endpoints
//   GET  /                -> package index.html + injected ?p0diag=1 redirect
//   POST /__p0result      -> writes results/p0-diagnosis-<ts>.json
//   GET  /__p0ping        -> liveness for the launcher
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
};

export function startServer({ root, resultsDir, instrument, port = 0 }) {
  const absRoot = path.resolve(root);
  const absResults = path.resolve(resultsDir);
  fs.mkdirSync(absResults, { recursive: true });
  const misses = [];
  const saved = [];

  const server = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://127.0.0.1');

    if (u.pathname === '/__p0ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, root: absRoot, saved }));
      return;
    }

    if (u.pathname === '/__p0result' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => {
        body += c;
        if (body.length > 64 * 1024 * 1024) req.destroy();
      });
      req.on('end', () => {
        try {
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const file = path.join(absResults, `p0-diagnosis-${stamp}.json`);
          // Parse before writing: a malformed report is more useful as an error
          // than as a file that silently fails to open later.
          const parsed = JSON.parse(body);
          fs.writeFileSync(file, JSON.stringify(parsed, null, 2));
          const latest = path.join(absResults, 'p0-diagnosis-latest.json');
          fs.writeFileSync(latest, JSON.stringify(parsed, null, 2));
          saved.push(file);
          console.log('\n[p0serve] RESULT SAVED -> ' + file);
          const s = parsed.summary || {};
          console.log('[p0serve] verdict: ' + s.verdict +
            (s.biggestReducer ? (' | biggest reducer: ' + s.biggestReducer.id +
              ' ' + s.biggestReducer.deltaP95Pct + '%') : ''));
          console.log('[p0serve] You can close the browser window now.\n');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ saved: file }));
        } catch (e) {
          console.error('[p0serve] failed to save result: ' + e.message);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(e.message) }));
        }
      });
      return;
    }

    // The instrument itself is served from memory, before any static-file
    // resolution: it does not live under the game root, so the traversal guard
    // below would 404 it.
    if (u.pathname === '/__p0diag.js') {
      res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' });
      res.end(instrument);
      return;
    }

    let sub = decodeURIComponent(u.pathname);
    if (sub === '/' || sub.endsWith('/')) sub += 'index.html';
    const target = path.resolve(absRoot, sub.replace(/^\/+/, ''));
    if (!target.startsWith(absRoot + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
      misses.push(u.pathname);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 ' + u.pathname);
      return;
    }
    const ext = path.extname(target).toLowerCase();

    // Inject the instrument into the product document only.
    if (ext === '.html' && path.basename(target) === 'index.html') {
      let html = fs.readFileSync(target, 'utf8');
      const tag = '<script src="/__p0diag.js"></script>';
      if (!html.includes('__p0diag.js')) {
        if (html.includes('</head>')) html = html.replace('</head>', '  ' + tag + '\n</head>');
        else html = tag + html;
      }
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      res.end(html);
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    fs.createReadStream(target).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({
        server, misses, saved,
        base: `http://127.0.0.1:${p}`,
        // The query string is what makes the instrument auto-start; the tool
        // itself never runs unless the owner asks for it.
        launch: `http://127.0.0.1:${p}/?p0diag=1`,
      });
    });
  });
}
