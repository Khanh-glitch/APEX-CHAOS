import { optimizeGoldHudRuntime } from './optimizeGoldHudRuntime.mjs';
// Build the same-document Gold component from the exact embedded donor.
// CSS is parsed at build time; browsers receive ordinary scoped selectors.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('vite/package.json'))('postcss');
export function compileGoldBattleShell(shell,hudHtml=null){
  const hudFile='public/gold/battle-hud.html';
  const payload=shell.match(/<script\b[^>]*id=["']battleHudPayload["'][^>]*>([\s\S]*?)<\/script>/i);
  const rawHtml=hudHtml!=null
    ?hudHtml
    :(fs.existsSync(hudFile)?fs.readFileSync(hudFile,'utf8'):(payload?Buffer.from(payload[1].trim(),'base64').toString('utf8'):''));
  if(!rawHtml)throw Error('Gold battle donor HTML missing');
  const html=optimizeGoldHudRuntime(rawHtml);
  if(hudHtml==null&&fs.existsSync(hudFile)&&fs.readFileSync(hudFile,'utf8')!==html){
    fs.writeFileSync(hudFile,html,'utf8');
  }
  // Strip duplicate ~212 KB base64 payload; shell.html now fetches/caches /gold/battle-hud.html directly.
  if(payload){
    shell=shell.replace(/\n?<script\b[^>]*id=["']battleHudPayload["'][^>]*>[\s\S]*?<\/script>\s*/i,'\n');
  }
  const css=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]).join('\n');
  if(!css)throw Error('Gold battle donor CSS missing');
  const root=postcss.parse(css);
  root.walkRules(rule=>{
    for(let p=rule.parent;p;p=p.parent){
      if(p.type==='atrule'&&/keyframes$/i.test(p.name))return;
    }
    rule.selector=postcss.list.comma(rule.selector).map(s=>{
      const mapped=s.replace(/:root\b/g,':where(#battleHudHost)')
        .replace(/(^|[\s>+~,(])(?:html|body)(?=$|[\s.#:[>+~),])/g,
          (_,prefix)=>prefix+':where(#battleHudHost)');
      return mapped.includes(':where(#battleHudHost)')?mapped:':where(#battleHudHost) '+mapped;
    }).join(',');
  });
  const hash=crypto.createHash('sha256').update(css).digest('hex');
  const style='<style id="apex-battle-component-css" data-source-sha256="'+hash+'">\n'
    +root.toString()+'\n#battleHudHost{--apex-battle-component:1}\n'
    +'#battleHudHost [data-apex-live-arena]{position:absolute!important;left:50%!important;top:50%!important;inset:auto;transform:translate(-50%,-50%)!important;max-width:none!important;max-height:none!important;display:block!important}\n</style>';
  shell=shell.replace(/<style\b[^>]*id="apex-battle-component-css"[^>]*>[\s\S]*?<\/style>\s*/gi,'');
  if(!shell.includes('</head>'))throw Error('Gold shell head missing');
  return shell.replace('</head>',style+'\n</head>');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const file='public/gold/shell.html';
  const hudFile='public/gold/battle-hud.html';
  fs.writeFileSync(file,compileGoldBattleShell(fs.readFileSync(file,'utf8')));
  const manifestFile='public/gold/manifest.json';
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const bytes=fs.readFileSync(file);
  manifest.files['shell.html']={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  if(fs.existsSync(hudFile)){
    const hudBytes=fs.readFileSync(hudFile);
    manifest.files['battle-hud.html']={bytes:hudBytes.length,sha256:crypto.createHash('sha256').update(hudBytes).digest('hex')};
  }
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  console.log('Gold Battle CSS component compiled from canonical battle-hud.html');
}
