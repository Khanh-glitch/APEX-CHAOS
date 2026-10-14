// B05 authored Gold overlay remains semantically SHA/context strict.
// Runtime cache-bust version is a GENERATED transport token, not authored
// DOM semantics. Rebind exactly two shell script context lines IN MEMORY so a
// valid new global revision cannot invalidate an otherwise unchanged patch.
// Every other line remains byte-for-byte; git apply still fails closed on drift.
const scriptNames=['ui/uiSfxAuthority.js','gold/goldProductBridge.js'];
const esc=s=>s.replace(/[.*+?^$\u007b\u007d()|[\]\\]/g,'\\$&');
export function bindB05ShellRevision(patch,generatedShell){
  if(typeof patch!=='string'||typeof generatedShell!=='string')
    throw new Error('B05 context requires text');
  let out=patch;
  const revisions=[];
  for(const script of scriptNames){
    const re=new RegExp('\\/game\\/'+esc(script)+'\\?v=([^"\\s<>]+)','g');
    const generated=[...generatedShell.matchAll(re)];
    const authored=[...out.matchAll(re)];
    if(generated.length!==1 || authored.length!==1)
      throw new Error('B05 revision anchor cardinality drift for '+script+
       ': built='+generated.length+', overlay='+authored.length);
    const revision=generated[0][1];
    revisions.push(revision);
    out=out.replace(re,()=>'/game/'+script+'?v='+revision);
  }
  if(new Set(revisions).size!==1)
    throw new Error('B05 shell scripts disagree on runtime revision');
  // Crucial: do not turn patch application into a fuzzy/reversed merge.
  return out;
}
