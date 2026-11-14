// Build the same-document Gold component from the exact embedded donor.
// CSS is parsed at build time; browsers receive ordinary scoped selectors.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require=createRequire(import.meta.url);
const postcss=createRequire(require.resolve('vite/package.json'))('postcss');
export function compileGoldBattleShell(shell){
  const payload=shell.match(/<script\b[^>]*id=["']battleHudPayload["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!payload)throw Error('Gold battle donor payload missing');
  const html=Buffer.from(payload[1].trim(),'base64').toString('utf8');
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
  fs.writeFileSync(file,compileGoldBattleShell(fs.readFileSync(file,'utf8')));
  const manifestFile='public/gold/manifest.json';
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const bytes=fs.readFileSync(file);
  manifest.files['shell.html']={bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  console.log('Gold Battle CSS component compiled from embedded donor');
}
