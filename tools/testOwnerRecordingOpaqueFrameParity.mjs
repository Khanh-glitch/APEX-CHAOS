// Browser pixel parity: removing the redundant full-canvas background
// repaint before a full-size opaque video draw changes ZERO output pixels.
// Runs without external dependencies; use CHROME_PATH pointing to Chromium.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const chrome=process.env.CHROME_PATH||'/usr/bin/google-chrome';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-record-visual-'));
const file=path.join(dir,'recording-parity.html');
const html=`<!doctype html><html><body><script>
const W=1080,H=1920;
const source=document.createElement('canvas');source.width=432;source.height=768;
const sc=source.getContext('2d',{alpha:false});
const g=sc.createLinearGradient(0,0,432,768);g.addColorStop(0,'#051722');g.addColorStop(.5,'#de713c');g.addColorStop(1,'#3dbcf8');
sc.fillStyle=g;sc.fillRect(0,0,432,768);
for(let i=0;i<140;i++){sc.fillStyle=i%2?'#f7e4bf':'#153e7b';sc.fillRect((i*47)%432,(i*53)%768,2+i%23,1+i%17);}
const make=()=>{let cv=document.createElement('canvas');cv.width=W;cv.height=H;return cv};
const old=make(),cur=make();
const a=old.getContext('2d',{alpha:false}),b=cur.getContext('2d',{alpha:false});
a.fillStyle='#020304';a.fillRect(0,0,W,H);a.drawImage(source,0,0,432,768,0,0,W,H);
b.drawImage(source,0,0,432,768,0,0,W,H);
const oldBytes=a.getImageData(0,0,W,H).data,newBytes=b.getImageData(0,0,W,H).data;
let diff=0;for(let i=0;i<oldBytes.length;i++)if(oldBytes[i]!==newBytes[i])diff++;
document.body.textContent=(diff===0?'APEX_VISUAL_PARITY_PASS ':'APEX_VISUAL_PARITY_FAIL ')+
 JSON.stringify({dimensions:[W,H],pixels:W*H,differentChannels:diff});
</script></body></html>`;
fs.writeFileSync(file,html);
try{
const out=spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--allow-file-access-from-files','--dump-dom','file://'+file],{encoding:'utf8',timeout:30000,maxBuffer:1500000});
if(out.error||out.status!==0||!out.stdout.includes('APEX_VISUAL_PARITY_PASS'))
 throw Error('Browser recording pixel parity failed: '+String(out.error||out.stderr||out.stdout).slice(-1200));
console.log(out.stdout.match(/APEX_VISUAL_PARITY_PASS[^<]*/)?.[0]);
}finally{fs.rmSync(dir,{recursive:true,force:true})}
