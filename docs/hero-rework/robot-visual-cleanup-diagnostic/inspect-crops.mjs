import fs from 'node:fs';
import {createCanvas,loadImage} from '@napi-rs/canvas';
const dir='docs/hero-rework/robot-visual-cleanup-diagnostic';
const scale=172/1280*.953;
const zones={
 'left-caliper':[50,60,470,800], 'right-caliper':[810,60,470,800],
 'cheek-chin':[290,810,700,360], 'left-pivot':[60,495,285,280],
 'right-pivot':[935,495,285,280], 'crest-core-slot':[505,270,270,350],
 'eye-socket':[365,640,555,205], 'impact-side':[925,340,325,355]
};
const index=[];
for(const variant of ['', '-FIX'])for(const state of ['idle','lock','impact'])for(const bg of ['black','gray','white']){
 const filename=`dpr1-${state}-${bg}${variant}.png`,im=await loadImage(`${dir}/background-matrix/${filename}`);
 for(const [zone,[x,y,w,h]]of Object.entries(zones)){
  const sx=Math.floor(160+(x-640)*scale),sy=Math.floor(160+(y-600)*scale),sw=Math.ceil(w*scale),sh=Math.ceil(h*scale);
  const c=createCanvas(sw*4,sh*4+24),g=c.getContext('2d');g.fillStyle='#202226';g.fillRect(0,0,c.width,c.height);g.fillStyle='#fff';g.font='12px sans-serif';g.fillText(`${variant ? "FIX" : "BASE"} ${state} / ${bg} / ${zone} 4x`,4,16);g.imageSmoothingEnabled=false;g.drawImage(im,sx,sy,sw,sh,0,24,sw*4,sh*4);
  const out=`${state}-${bg}-${zone}${variant}-4x.png`;fs.writeFileSync(`${dir}/edge-crops/${out}`,c.toBuffer('image/png'));
  index.push({file:out,source:filename,zone,sourcePixels:[sx,sy,sw,sh],magnification:4});
 }
}
fs.writeFileSync(`${dir}/edge-crops/index.json`,JSON.stringify(index,null,2));
// Read alpha-connected islands without changing any pixels.
for(const name of ['prod','html']){
const im=await loadImage(`${dir}/edge-crops/${name}-core.png`),c=createCanvas(im.width,im.height),g=c.getContext('2d');g.drawImage(im,0,0);const {data}=g.getImageData(0,0,im.width,im.height),W=im.width,H=im.height,seen=new Uint8Array(W*H),cs=[];
for(let i=0;i<seen.length;i++){if(seen[i]||data[i*4+3]<=16)continue;const stack=[i];seen[i]=1;let n=0,x0=W,y0=H,x1=0,y1=0;while(stack.length){const p=stack.pop(),x=p%W,y=Math.floor(p/W);n++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,q=yy*W+xx;if(xx<0||xx>=W||yy<0||yy>=H||seen[q]||data[q*4+3]<=16)continue;seen[q]=1;stack.push(q);}}
if(n>10)cs.push({pixels:n,boundsHead:[x0,y0,x1+1,y1+1].map(v=>Math.round(v*1280/820))});}
cs.sort((a,b)=>b.pixels-a.pixels);fs.writeFileSync(`${dir}/edge-crops/${name}-core-islands.json`,JSON.stringify(cs,null,2));console.log(name,cs);
}
