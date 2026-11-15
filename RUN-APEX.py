#!/usr/bin/env python3
"""Restore missing official APEX CHAOS binaries, build and preview the actual game.
Does not alter game logic, create substitute art, or push anything to GitHub.
Requires Python 3.9+, git, Node/npm and an Internet connection for first setup.
"""
from pathlib import Path
import argparse, os, shutil, subprocess, sys, tempfile, time, webbrowser, http.server, socketserver
ROOT = Path(__file__).resolve().parent
ORIGIN = 'https://github.com/Khanh-glitch/APEX-CHAOS.git'
PIN = '9d06036dda72eff6afe7bb1e34bc72652ae9c248'
CRITICAL = (
    'assets/boxe-gold/char-body-new.png',
    'assets/hero-rework/hunter-v10/part-0.png',
    'assets/hero-rework/frost-v1/base.png',
    'gold/assets/gold/home-world-background.png',
)

def call(args, cwd=ROOT):
    print('>>', ' '.join(map(str,args)), flush=True)
    subprocess.run(args, cwd=cwd, check=True)

def missing():
    return [x for x in CRITICAL if not (ROOT/'public'/x).exists()]

def restore():
    print('Missing official production art:', ', '.join(missing()) or 'none')
    if not missing():
        return
    if shutil.which('git') is None:
        raise RuntimeError('git is required to restore original production assets')
    with tempfile.TemporaryDirectory(prefix='apex-upstream-') as d:
        upstream = Path(d)/'repo'
        call(['git','clone','--no-checkout','--depth','1','--filter=blob:none','--sparse',ORIGIN,str(upstream)],cwd=d)
        call(['git','-C',str(upstream),'sparse-checkout','set','public/assets','public/gold'],cwd=d)
        head=subprocess.check_output(['git','-C',str(upstream),'rev-parse','HEAD'],text=True).strip()
        if head != PIN:
            print('Upstream main advanced: restoring assets from exact archive baseline',PIN)
            call(['git','-C',str(upstream),'fetch','--depth','1','origin',PIN],cwd=d)
            call(['git','-C',str(upstream),'checkout','FETCH_HEAD'],cwd=d)
        else:
            call(['git','-C',str(upstream),'checkout','HEAD'],cwd=d)
        # Restore only missing files. Keep all overhauled runtime and UI unchanged.
        src = upstream/'public'
        count = 0
        for root, _, files in os.walk(src):
            for filename in files:
                a = Path(root)/filename
                b = ROOT/'public'/a.relative_to(src)
                if not b.exists():
                    b.parent.mkdir(parents=True,exist_ok=True)
                    shutil.copy2(a,b)
                    count += 1
        print(f'Restored {count} missing original files. No gameplay files overwritten.')
    if missing():
        raise RuntimeError('Missing essential art after clone: '+', '.join(missing()))

def main():
    parser=argparse.ArgumentParser(description='Repair official assets and play the actual APEX CHAOS overhaul')
    parser.add_argument('--check',action='store_true',help='Report missing assets, without network')
    parser.add_argument('--build-only',action='store_true',help='Build dist, without starting preview')
    parser.add_argument('--port',type=int,default=4173)
    args=parser.parse_args()
    print('APEX CHAOS — original source + Beyond gameplay, official asset recovery')
    if args.check:
        print('Missing essential assets:', missing())
        print('Source entry: src/main.tsx (Vite module, not directly openable as file://)')
        return 1 if missing() else 0
    restore()
    if shutil.which('npm') is None:
        raise RuntimeError('Node.js/npm is needed to compile the source to a playable browser build')
    call(['npm','ci','--no-audit','--no-fund'])
    call(['npm','run','build'])
    dist=ROOT/'dist'
    if not (dist/'index.html').exists():
        raise RuntimeError('Build succeeded but dist/index.html was not generated')
    if args.build_only:
        print('Built game:',dist/'index.html')
        return 0
    os.chdir(dist)
    class Handler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Cache-Control','no-cache')
            super().end_headers()
    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
    with Server(('127.0.0.1',args.port),Handler) as server:
        url=f'http://127.0.0.1:{args.port}/'
        print('OPEN GAME:',url,flush=True)
        try: webbrowser.open(url)
        except Exception: pass
        server.serve_forever()
    return 0

if __name__=='__main__':
    try: sys.exit(main())
    except Exception as error:
        print('SETUP FAILED:',error,file=sys.stderr)
        sys.exit(1)
