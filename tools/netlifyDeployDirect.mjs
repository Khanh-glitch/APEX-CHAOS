import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [,, siteId, dirArg] = process.argv;
const token = process.env.NETLIFY_AUTH_TOKEN;
if (!siteId || !dirArg || !token) {
  console.error('Usage: NETLIFY_AUTH_TOKEN=... node tools/netlifyDeployDirect.mjs <siteId> <distDir>');
  process.exit(2);
}

const root = path.resolve(dirArg);
const api = 'https://api.netlify.com/api/v1';
const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json'
};

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function deployPath(file) {
  return '/' + path.relative(root, file).replace(/\\/g, '/');
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html':'text/html; charset=utf-8',
    '.js':'text/javascript; charset=utf-8',
    '.css':'text/css; charset=utf-8',
    '.json':'application/json; charset=utf-8',
    '.jpg':'image/jpeg',
    '.jpeg':'image/jpeg',
    '.webp':'image/webp',
    '.ico':'image/x-icon',
    '.svg':'image/svg+xml',
    '.mp3':'audio/mpeg',
    '.wav':'audio/wav',
    '.webm':'video/webm',
    '.mp4':'video/mp4'
  }[ext] || 'application/octet-stream';
}

function encodeDeployPath(rel) {
  return rel.split('/').map(part => encodeURIComponent(part)).join('/');
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${options.method || 'GET'} ${url} -> ${res.status} ${res.statusText}\n${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

const files = await walk(root);
const manifest = {};
const byDeployPath = new Map();
for (const file of files) {
  const buf = await readFile(file);
  const sha = createHash('sha1').update(buf).digest('hex');
  const rel = deployPath(file);
  manifest[rel] = sha;
  byDeployPath.set(rel, { file, sha, size: (await stat(file)).size });
}

const deploy = await request(`${api}/sites/${siteId}/deploys`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ files: manifest, draft: false })
});

const required = deploy.required || deploy.required_files || [];
for (const rel of required) {
  const item = byDeployPath.get(rel);
  if (!item) continue;
  const buf = await readFile(item.file);
  await request(`${api}/deploys/${deploy.id}/files${encodeDeployPath(rel)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType(item.file)
    },
    body: buf
  });
  console.log(`uploaded ${rel} (${item.size} bytes)`);
}

let finalDeploy = deploy;
for (let i = 0; i < 30; i += 1) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  finalDeploy = await request(`${api}/deploys/${deploy.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (['ready','error'].includes(finalDeploy.state)) break;
}

console.log(JSON.stringify({
  id: finalDeploy.id,
  state: finalDeploy.state,
  url: finalDeploy.ssl_url || finalDeploy.url,
  deploy_url: finalDeploy.deploy_ssl_url || finalDeploy.deploy_url
}, null, 2));
