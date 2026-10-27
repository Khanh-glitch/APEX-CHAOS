#!/usr/bin/env python3
"""Post-process production dist for itch.io's /html/<id>/ subpath hosting."""
import re,sys,zipfile,collections
rootdirs="assets|game|gold|bot-wave|result-gold"
rootfiles="gold-fidelity-lab\\.html|gold-fidelity-profiles\\.mjs|apexEngine\\.js|asset-manifest\\.json|favicon\\.ico|index\\.html"
lit=re.compile(r'''(?P<q>[\x27\x22\x60])(?P<body>/(?:assets|game|gold|bot-wave|result-gold)/(?:(?!\1)(?:\\.|[^\\]))*|/(?:gold-fidelity-lab\.html|gold-fidelity-profiles\.mjs|apexEngine\.js|asset-manifest\.json|favicon\.ico|index\.html)(?:(?!\1)(?:\\.|[^\\]))*)(?P=q)''')
htmlattr=re.compile(r'(?P<pre>\b(?:src|href|poster|data-src|action)\s*=\s*)(?P<q>[\x27\x22])/(?P<path>(?:assets|game|gold|bot-wave|result-gold)/[^\x27\x22]+|(?:gold-fidelity-lab\.html|gold-fidelity-profiles\.mjs|apexEngine\.js|asset-manifest\.json|favicon\.ico|index\.html)(?:\?[^\x27\x22]*)?)(?P=q)',re.I)
cssurl=re.compile(r'url\(\s*(?P<quote>[\x27\x22]?)/(?P<path>(?:assets|game|gold|bot-wave|result-gold)/[^)\x27\x22]+)',re.I)
static=re.compile(r'(?P<head>\bfrom\s*|\bimport\s*)(?P<q>[\x27\x22])(?P<path>/(?:gold-fidelity-profiles\.mjs|assets/[^\x27\x22]+|game/[^\x27\x22]+))(?P=q)')
scripts=re.compile(r'(<script\b[^>]*>)(.*?)(</script\s*>)',re.I|re.S)
styles=re.compile(r'(<style\b[^>]*>)(.*?)(</style\s*>)',re.I|re.S)
counts=collections.Counter()
def rewrite_js(s,name):
    rel='../'*name.count('/') or './'
    s=static.sub(lambda m:m['head']+m['q']+rel+m['path'][1:]+m['q'],s)
    def repl(m):
        counts['js-root-literal']+=1
        return '(globalThis.__APEX_ITCH_ROOT__+'+m['q']+m['body'][1:]+m['q']+')'
    s=lit.sub(repl,s)
    if name.startswith('assets/index-'):
        s=s.replace('function(e){return"/"+e}','function(e){return globalThis.__APEX_ITCH_ROOT__+e}')
        s=s.replace('location.pathname!=="/"','location.pathname!==globalThis.__APEX_ITCH_ROOT__+"index.html"')
        s=s.replace('history.replaceState({},"","/")','history.replaceState({},"",globalThis.__APEX_ITCH_ROOT__+"index.html")')
        # Keep first-party skin-path validation; strip only the trusted itch
        # package prefix for validation, preserving the scoped URL in return.
        old='function Hc(e){if(typeof e!="string"||!/^\\/(assets|gold\\/assets)\\/[a-zA-Z0-9_./-]+\\.(png|webp|jpg|jpeg|svg|ogg|mp3)$/.test(e)||e.includes(".."))throw new Error("Cosmetic asset must be a declared first-party path");return e}'
        new='function Hc(e){const b=globalThis.__APEX_ITCH_ROOT__||"/",v=typeof e==="string"&&e.startsWith(b)?"/"+e.slice(b.length):e;if(typeof v!="string"||!/^\\/(assets|gold\\/assets)\\/[a-zA-Z0-9_./-]+\\.(png|webp|jpg|jpeg|svg|ogg|mp3)$/.test(v)||v.includes(".."))throw new Error("Cosmetic asset must be a declared first-party path");return e}'
        if s.count(old)!=1:raise ValueError('Cosmetic authority validator changed: '+str(s.count(old)))
        s=s.replace(old,new)
    return s
def rewrite_css(s,name):
    rel='../'*name.count('/') or './'
    return cssurl.sub(lambda m:'url('+m['quote']+rel+m['path'],s)
def rewrite_html(s,name):
    rel='../'*name.count('/') or './'
    base=('<script id="apex-itch-base">if(!globalThis.__APEX_ITCH_ROOT__){'
          'let inherited=null;try{if(parent!==self)inherited=parent.__APEX_ITCH_ROOT__}catch(_){}'
          "globalThis.__APEX_ITCH_ROOT__=inherited||new URL('"+rel+"',location.href).pathname;}</script>")
    head=re.search(r'<head\b[^>]*>',s,re.I)
    if not head:raise ValueError('No head in '+name)
    s=s[:head.end()]+base+s[head.end():]
    s=htmlattr.sub(lambda m:m['pre']+m['q']+rel+m['path']+m['q'],s)
    s=scripts.sub(lambda m:m[1]+(m[2] if 'id="apex-itch-base"' in m[1] else rewrite_js(m[2],name))+m[3],s)
    s=styles.sub(lambda m:m[1]+rewrite_css(m[2],name)+m[3],s)
    if name=='gold-fidelity-lab.html':
        s=s.replace("new URL('/', location.origin)","new URL(globalThis.__APEX_ITCH_ROOT__+'index.html', location.origin)")
    s=s.replace("location.assign('/')","location.assign(globalThis.__APEX_ITCH_ROOT__+'index.html')")
    return s
def package(src,out):
    with zipfile.ZipFile(src) as zin,zipfile.ZipFile(out,'w') as zout:
        names=zin.namelist()
        if 'index.html' not in names:raise ValueError('Missing root index.html')
        for info in zin.infolist():
            data=zin.read(info.filename);n=info.filename
            if n.endswith(('.html','.js','.mjs','.css')):
                s=data.decode('utf-8')
                s=(rewrite_html(s,n) if n.endswith('.html') else
                   rewrite_js(s,n) if n.endswith(('.js','.mjs')) else rewrite_css(s,n))
                data=s.encode('utf-8')
            zout.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=7)
    with zipfile.ZipFile(out) as z:
        if z.testzip():raise ValueError('CRC failure')
        if len(z.namelist())>=1000:raise ValueError('itch >1000 entries')
        html=z.read('index.html').decode()
        if 'src="./assets/index-' not in html or 'href="./assets/index-' not in html:
            raise ValueError('Vite root scripts not relocated')
        mobile=z.read('gold-fidelity-lab.html').decode()
        if "new URL(globalThis.__APEX_ITCH_ROOT__+'index.html', location.origin)" not in mobile:
            raise ValueError('Mobile iframe still escapes itch subpath')
    print('ITHC PACKAGE PASS',out,len(names),dict(counts))
if __name__=='__main__':package(*sys.argv[1:3])
