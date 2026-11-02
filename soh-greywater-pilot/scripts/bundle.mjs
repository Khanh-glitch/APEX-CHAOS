// Bundles a TS/TSX entry into ONE self-contained HTML file (JS + CSS inlined) using esbuild.
// usage: node scripts/bundle.mjs <entry> <out.html> [title]
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const [entry, out, title = "Soul of Hero — Map Lab Studio"] = process.argv.slice(2);
const res = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  outdir: "dist-tmp",
  format: "iife",
  target: "es2020",
  minify: process.env.NOMIN ? false : true,
  jsx: "automatic",
  loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
  logLevel: "warning",
});
let js = "", css = "";
for (const f of res.outputFiles) {
  if (f.path.endsWith(".js")) js += f.text;
  if (f.path.endsWith(".css")) css += f.text;
}
js = js.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${css}</style></head>
<body><div id="root"></div><script>${js}</script></body></html>`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log("wrote", out, (html.length / 1024).toFixed(0) + " KB");
