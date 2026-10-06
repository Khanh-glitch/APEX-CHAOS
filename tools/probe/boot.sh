#!/usr/bin/env bash
# Headless-probe bootstrap: chromium + AWS-lambda libs live in /tmp (never in git).
set -e
cd "$(dirname "$0")"
[ -d node_modules/puppeteer-core ] || npm i --silent puppeteer-core@23 @sparticuz/chromium@131 >/dev/null 2>&1
if [ ! -x /tmp/chromium ] || [ ! -f /tmp/libGLESv2.so ] || [ ! -d /tmp/al2023/lib ]; then
  node -e "
const fs=require('fs'),zlib=require('zlib'),p=process.cwd()+'/node_modules/@sparticuz/chromium/bin/';
const br=(f)=>zlib.brotliDecompressSync(fs.readFileSync(p+f));
fs.writeFileSync('/tmp/chromium',br('chromium.br')); fs.chmodSync('/tmp/chromium',0o755);
for (const [f,o] of [['swiftshader.tar.br','/tmp/sw.tar'],['fonts.tar.br','/tmp/fonts.tar'],['al2023.tar.br','/tmp/al2023.tar']]) fs.writeFileSync(o,br(f));
"
  tar -xf /tmp/sw.tar -C /tmp; tar -xf /tmp/fonts.tar -C /tmp; mkdir -p /tmp/al2023 && tar -xf /tmp/al2023.tar -C /tmp/al2023
fi
exec env LD_LIBRARY_PATH=/tmp/al2023/lib node "$@"
