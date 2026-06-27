import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { manualLabRoomRelay } from './server/manual-room-relay.js';

const REPLAY_ROUTE = '/__apex-save-replay';
const MAX_REPLAY_BYTES = 512 * 1024 * 1024;

function localReplaySaver() {
  return {
    name: 'apex-local-replay-saver',
    configureServer(server) {
      server.middlewares.use(REPLAY_ROUTE, async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        try {
          const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
          const requestedName = path.basename(requestUrl.searchParams.get('filename') || 'apex-chaos-replay.webm');
          const safeName = requestedName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'apex-chaos-replay.webm';
          const chunks = [];
          let totalBytes = 0;

          for await (const chunk of req) {
            totalBytes += chunk.length;
            if (totalBytes > MAX_REPLAY_BYTES) throw new Error('Replay exceeds the 512 MB local limit.');
            chunks.push(chunk);
          }

          const replayDir = path.resolve(process.cwd(), 'replays');
          await mkdir(replayDir, { recursive: true });
          await writeFile(path.join(replayDir, safeName), Buffer.concat(chunks));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, filename: safeName, bytes: totalBytes }));
        } catch (error) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localReplaySaver(), manualLabRoomRelay()],
});
