/* =============================================================================
 * APEX CHAOS: TOTAL EVOLUTION — Command Deck, Tactical HUD, Kinetic Typography,
 * Cinematic Finisher, Series Cards, Highlights & War Room
 * ========================================================================== */
(function (g) {
  'use strict';
  if (g.APEX_EVOLUTION_HUD) return;

  const LAB_WEAPONS = [['STORMBREAKER', '⚡ STORM'], ['M249_SAW', 'M249'], ['SZECSEI_FUCHS', 'FUCHS'], ['AK_47', 'AK-47'], ['JACKHAMMER', 'JACKHMR'], ['DESERT_DEAGLE', 'DEAGLE'], ['BATTLE_AXE', 'AXE'], ['SABRE', 'SABRE'], ['GRENADE', 'GRENADE']];
  const HERO_LABEL = { ROBOT: 'NEWBOT', CRYSTAL: 'CRYSTALA', ICE: 'FROST', BLACK_HOLE: 'BLACK HOLE', TIME: 'CHRONO' };
  const label = (id) => HERO_LABEL[id] || String(id || '').replace('_', ' ');

  function profileKey() { try { let k = localStorage.getItem('apexEvolution.profileKey'); if (!k) { k = 'cmd-' + Math.random().toString(36).slice(2, 10); localStorage.setItem('apexEvolution.profileKey', k); } return k; } catch (_) { return 'local-vanguard'; } }

  const CSS = `
  :root{--evo-ti:#11151c;--evo-ti2:#1c222c;--evo-gold:#ffb340;--evo-cyan:#5ce1ff;--evo-line:rgba(255,255,255,.12);--evo-font:'Oswald','Montserrat',sans-serif;--evo-mono:'JetBrains Mono',ui-monospace,monospace}
  .evo-plate{background:linear-gradient(170deg,rgba(32,38,48,.96),rgba(12,15,21,.97));border:1px solid var(--evo-line);box-shadow:0 10px 30px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.07);clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}
  #apex-evo-command-deck{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:9400;display:none;flex-direction:column;gap:5px;max-width:min(96vw,1040px);padding:8px 14px 8px;font-family:var(--evo-font);color:#f1f5f9;user-select:none;border-top:2px solid var(--evo-gold)}
  #apex-evo-command-deck.is-visible{display:flex}
  .evo-deck-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center}
  .evo-deck-label{font-size:10px;letter-spacing:.16em;color:#8b95a7;font-weight:700;min-width:48px}
  .evo-pill{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(24,30,40,.85);color:#cbd5e1;font-family:var(--evo-font);font-size:11px;font-weight:600;letter-spacing:.08em;padding:3px 9px;cursor:pointer;transition:all .14s;text-transform:uppercase;clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px)}
  .evo-pill:hover{border-color:rgba(255,179,64,.7);color:#fff;transform:translateY(-1px)}
  .evo-pill.is-active{background:linear-gradient(180deg,#ffb340,#e07000);border-color:#ffd166;color:#090c10;font-weight:700;box-shadow:0 0 12px rgba(255,148,31,.45)}
  .evo-deck-desc{font-family:var(--evo-mono);font-size:10px;color:#9aa6b8;letter-spacing:.04em;text-align:center;max-width:900px}
  .evo-deck-desc b{color:var(--evo-gold)}
  #apex-evo-battle-overlay{position:fixed;inset:0;pointer-events:none;z-index:9100;display:none;font-family:var(--evo-font)}
  #apex-evo-battle-overlay.is-live{display:block}
  /* arena event banner */
  #evo-banner{position:absolute;top:50px;left:50%;transform:translate(-50%,-16px);opacity:0;min-width:300px;max-width:min(92vw,560px);padding:6px 16px 7px;color:#eef2f7;transition:transform .22s cubic-bezier(.2,.9,.3,1.2),opacity .22s;border-top:2px solid var(--b-col,#ff941f)}
  #evo-banner.is-on{opacity:1;transform:translate(-50%,0)}
  #evo-banner .b-title{font-size:15px;font-weight:800;letter-spacing:.14em;color:var(--b-col,#ff941f);display:flex;align-items:center;gap:10px;justify-content:space-between}
  #evo-banner .b-kind{font-family:var(--evo-mono);font-size:9px;letter-spacing:.2em;padding:1px 6px;border:1px solid var(--b-col);color:var(--b-col)}
  #evo-banner.k-warn .b-kind{animation:evoBlink .5s infinite alternate}
  #evo-banner .b-sub{font-family:var(--evo-mono);font-size:10px;letter-spacing:.08em;color:#b8c2d1;margin-top:2px}
  #evo-banner .b-bar{height:3px;background:rgba(255,255,255,.1);margin-top:5px;overflow:hidden}
  #evo-banner .b-fill{height:100%;background:var(--b-col);width:100%;transition:width .1s linear}
  @keyframes evoBlink{from{opacity:.4}to{opacity:1}}
  /* kinetic typography */
  .evo-kin{position:absolute;transform:translate(-50%,-50%) scale(.6) rotate(var(--tilt,0deg));padding:4px 12px 5px;font-size:calc(17px*var(--sc,1));font-weight:900;letter-spacing:.1em;color:var(--k-col,#ffd166);text-shadow:0 2px 0 #000,0 0 14px var(--k-col);white-space:nowrap;animation:evoKin 1s cubic-bezier(.17,.89,.32,1.28) forwards;border-left:3px solid var(--k-col)}
  @keyframes evoKin{0%{opacity:0;transform:translate(-50%,-50%) scale(.5) rotate(var(--tilt))}14%{opacity:1;transform:translate(-50%,-56%) scale(1.12) rotate(var(--tilt))}28%{transform:translate(-50%,-58%) scale(1) rotate(var(--tilt))}75%{opacity:1;transform:translate(-50%,-70%) scale(1) rotate(var(--tilt))}100%{opacity:0;transform:translate(-50%,-84%) scale(.96) rotate(var(--tilt))}}
  /* bottom-center dock */
  #evo-dock{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:flex-end;gap:10px;pointer-events:auto}
  .evo-side{display:flex;flex-direction:column;gap:5px;align-items:center}
  .evo-abil-row{display:flex;gap:8px}
  .evo-abil{position:relative;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#232a36,#0b0e14 70%);border:2px solid rgba(255,255,255,.16);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#e5e9f0;font-family:var(--evo-font);transition:transform .1s;box-shadow:0 6px 18px rgba(0,0,0,.6)}
  .evo-abil:active{transform:scale(.94)}
  .evo-abil svg{position:absolute;inset:-2px;width:calc(100% + 4px);height:calc(100% + 4px);transform:rotate(-90deg)}
  .evo-abil circle{fill:none;stroke-width:4}
  .evo-abil .ring-bg{stroke:rgba(255,255,255,.08)}
  .evo-abil .ring-fg{stroke:var(--a-col,#5ce1ff);stroke-linecap:round;transition:stroke-dashoffset .08s linear}
  .evo-abil .a-key{font-family:var(--evo-mono);font-size:9px;letter-spacing:.14em;color:#8b95a7}
  .evo-abil .a-name{font-size:11px;font-weight:800;letter-spacing:.08em;margin-top:1px}
  .evo-abil .a-val{font-family:var(--evo-mono);font-size:10px;color:var(--a-col,#5ce1ff)}
  .evo-abil.is-ready{border-color:var(--a-col);box-shadow:0 0 18px color-mix(in srgb,var(--a-col) 55%,transparent),0 6px 18px rgba(0,0,0,.6)}
  .evo-abil.is-ult.is-ready{animation:evoUltPulse .9s infinite alternate}
  @keyframes evoUltPulse{from{box-shadow:0 0 10px rgba(255,179,64,.4)}to{box-shadow:0 0 30px rgba(255,209,102,.9)}}
  .evo-status{display:flex;align-items:center;gap:8px;padding:3px 10px;font-family:var(--evo-mono);font-size:10px;letter-spacing:.1em;color:#b8c2d1}
  .evo-status .rank{font-family:var(--evo-font);font-weight:900;font-size:13px;color:var(--r-col,#38bdf8);letter-spacing:.08em}
  .evo-sync{width:120px;height:4px;background:rgba(255,255,255,.1);overflow:hidden}
  .evo-sync i{display:block;height:100%;width:25%;background:linear-gradient(90deg,#ff941f,#ffd166)}
  .evo-hint{font-family:var(--evo-mono);font-size:9px;letter-spacing:.12em;color:#8b95a7;padding:2px 8px;transition:opacity .6s}
  .evo-hint.is-gone{opacity:0}
  #evo-series{position:absolute;top:50px;right:50%;transform:translateX(calc(50% + 330px));display:none;gap:6px;align-items:center;padding:4px 10px;font-family:var(--evo-mono);font-size:10px;letter-spacing:.14em;color:#e5e9f0}
  #evo-series.is-on{display:flex}
  #evo-series i{width:10px;height:10px;border:1px solid rgba(255,255,255,.3);transform:rotate(45deg);display:inline-block}
  #evo-series i.w1{background:#ff941f;border-color:#ffd166}#evo-series i.w2{background:#4cc9f0;border-color:#9ff}
  /* cinematic */
  #evo-lb-top,#evo-lb-bot{position:absolute;left:0;right:0;height:0;background:#04060a;transition:height .28s cubic-bezier(.2,.8,.2,1)}
  #evo-lb-top{top:0}#evo-lb-bot{bottom:0}
  #apex-evo-battle-overlay.is-lb #evo-lb-top,#apex-evo-battle-overlay.is-lb #evo-lb-bot{height:7vh}
  #evo-tint{position:absolute;inset:0;opacity:0;transition:opacity .3s;mix-blend-mode:multiply}
  #evo-tint.eclipse{background:radial-gradient(circle at 50% 50%,rgba(60,90,20,.1),rgba(5,8,2,.75));opacity:1}
  #evo-tint.frost{background:radial-gradient(circle,rgba(140,220,255,.15),rgba(10,30,50,.55));opacity:1}
  #evo-tint.void{background:radial-gradient(circle,rgba(120,40,200,.15),rgba(8,2,16,.7));opacity:1}
  #evo-tint.chrono{background:radial-gradient(circle,rgba(80,200,255,.12),rgba(6,16,26,.55));opacity:1}
  #evo-impact{position:absolute;inset:0;opacity:0;background:#fff;pointer-events:none}
  #evo-impact.is-hit{animation:evoImpact .14s steps(2) 1}
  @keyframes evoImpact{0%{opacity:1;background:#fff}50%{opacity:1;background:#000;filter:invert(1)}100%{opacity:0}}
  /* ultimate banner */
  #evo-ultban{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%) skewX(-8deg) scaleX(.2);opacity:0;padding:10px 34px;text-align:center;border-top:2px solid var(--u-col);border-bottom:2px solid var(--u-col);transition:transform .25s cubic-bezier(.2,.9,.3,1.2),opacity .25s}
  #evo-ultban.is-on{opacity:1;transform:translate(-50%,-50%) skewX(-8deg) scaleX(1)}
  #evo-ultban .u-hero{font-family:var(--evo-mono);font-size:11px;letter-spacing:.3em;color:#b8c2d1}
  #evo-ultban .u-name{font-size:34px;font-weight:900;letter-spacing:.12em;color:var(--u-col);text-shadow:0 0 24px var(--u-col),0 3px 0 #000;line-height:1.05}
  #evo-ultban .u-hint{font-family:var(--evo-mono);font-size:10px;letter-spacing:.1em;color:#ffd166;margin-top:4px}
  /* KO */
  #evo-ko{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:14px}
  #evo-ko.is-on{display:flex}
  .evo-ko-plate{padding:18px 56px;text-align:center;transform:scale(.4);opacity:0;animation:evoKoIn .45s cubic-bezier(.17,.89,.32,1.3) .12s forwards;border-top:3px solid var(--evo-gold);border-bottom:3px solid var(--evo-gold)}
  @keyframes evoKoIn{to{transform:scale(1);opacity:1}}
  .evo-ko-plate .k-eyebrow{font-family:var(--evo-mono);font-size:11px;letter-spacing:.4em;color:#b8c2d1}
  .evo-ko-plate .k-title{font-size:86px;font-weight:900;letter-spacing:.08em;line-height:.95;background:linear-gradient(180deg,#fff 20%,#ffd166 55%,#ff8a1f);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 0 #000) drop-shadow(0 0 26px rgba(255,160,40,.6))}
  .evo-ko-plate .k-winner{font-size:22px;font-weight:800;letter-spacing:.26em;color:#fff;margin-top:4px}
  .evo-ko-plate .k-finish{font-family:var(--evo-mono);font-size:11px;letter-spacing:.18em;color:var(--evo-gold);margin-top:6px}
  .evo-hl{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:860px;opacity:0;animation:evoFade .4s .6s forwards}
  @keyframes evoFade{to{opacity:1}}
  .evo-hl span{padding:4px 10px;font-family:var(--evo-mono);font-size:10px;letter-spacing:.08em;color:#e5e9f0;border-left:2px solid var(--evo-gold)}
  /* round card */
  #evo-round{position:absolute;inset:0;display:none;align-items:center;justify-content:center}
  #evo-round.is-on{display:flex}
  .evo-round-plate{padding:16px 44px;text-align:center;transform:translateY(20px);opacity:0;animation:evoRoundIn .4s cubic-bezier(.2,.9,.3,1.2) forwards;border-left:4px solid var(--rc,#ff941f)}
  @keyframes evoRoundIn{to{transform:none;opacity:1}}
  .evo-round-plate .r-eyebrow{font-family:var(--evo-mono);font-size:11px;letter-spacing:.3em;color:#b8c2d1}
  .evo-round-plate .r-title{font-size:44px;font-weight:900;letter-spacing:.1em;color:var(--rc,#ff941f);text-shadow:0 4px 0 #000}
  .evo-round-plate .r-score{font-family:var(--evo-mono);font-size:14px;letter-spacing:.3em;color:#fff;margin-top:4px}
  .evo-round-plate .r-next{font-family:var(--evo-mono);font-size:10px;letter-spacing:.16em;color:#ffd166;margin-top:8px}
  #apex-evo-lab-bar{position:absolute;bottom:108px;left:50%;transform:translateX(-50%);display:none;gap:5px;flex-wrap:wrap;justify-content:center;padding:6px 10px;pointer-events:auto}
  #apex-evo-lab-bar.is-active{display:flex}
  #apex-evo-touch-pad{position:absolute;left:18px;bottom:120px;width:104px;height:104px;border-radius:50%;background:radial-gradient(circle,rgba(255,148,31,.16),rgba(10,14,20,.78));border:1.5px solid rgba(255,148,31,.45);display:none;pointer-events:auto;touch-action:none}
  #apex-evo-touch-pad.is-shown{display:block}
  #apex-evo-touch-knob{position:absolute;left:50%;top:50%;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;background:linear-gradient(180deg,#ffae34,#e07000);box-shadow:0 0 12px rgba(255,148,31,.65)}
  /* war room */
  #apex-evo-warroom-modal{position:fixed;inset:0;z-index:9800;background:rgba(4,6,10,.84);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:18px;font-family:var(--evo-font);color:#f1f5f9}
  #apex-evo-warroom-modal.is-open{display:flex}
  .evo-wr-panel{width:min(1000px,96vw);max-height:88vh;overflow-y:auto;padding:20px 24px;border-top:3px solid var(--evo-gold)}
  .evo-wr-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--evo-line);padding-bottom:12px;margin-bottom:14px}
  .evo-wr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
  .evo-wr-card{background:rgba(20,26,36,.78);border:1px solid rgba(255,255,255,.09);padding:12px 14px}
  .evo-wr-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;gap:10px}
  .evo-wr-row small{font-family:var(--evo-mono)}
  @media (max-width:900px){#apex-evo-command-deck{top:48px;padding:5px 8px}.evo-deck-desc{display:none}#evo-banner{top:44px;min-width:240px}.evo-abil{width:62px;height:62px}.evo-hint{display:none}#evo-dock{bottom:10px}.evo-ko-plate .k-title{font-size:56px}#evo-series{transform:translateX(50%);right:12px}}
  @media (pointer:coarse){#evo-dock{bottom:18px;right:16px;left:auto;transform:none}}
  `;

  let deckEl, overlayEl, warRoomEl, cachedOverview = null, banner = null, hintsUsed = { thrust: false, aegis: false, od: false }, hintStart = 0, kinCount = 0;

  function injectStyles() { if (document.getElementById('apex-evolution-ui-styles')) return; const st = document.createElement('style'); st.id = 'apex-evolution-ui-styles'; st.textContent = CSS; document.head.appendChild(st); }

  // ── offline-capable telemetry ──────────────────────────────────────────────
  function localHistory() { try { return JSON.parse(localStorage.getItem('apexEvolution.localHistory') || '{"matches":[],"fighters":{}}'); } catch (_) { return { matches: [], fighters: {} }; } }
  function saveLocalHistory(h) { try { localStorage.setItem('apexEvolution.localHistory', JSON.stringify(h)); } catch (_) {} }
  function mergeLocalIntoOverview(data) {
    const h = localHistory();
    if (!data) data = { ok: false, offline: true, profile: null, fighters: [], matches: [] };
    if (!data.matches?.length && h.matches.length) data.matches = h.matches.slice().reverse();
    if (!data.fighters?.length && Object.keys(h.fighters).length) data.fighters = Object.values(h.fighters);
    if (!data.profile) { const wins = h.matches.filter(m => m.winnerSide === 'p1').length; data.profile = { callsign: (() => { try { return localStorage.getItem('apexEvolution.callsign') || 'BASIN VANGUARD'; } catch (_) { return 'BASIN VANGUARD'; } })(), eloRating: 1200 + wins * 22 - (h.matches.length - wins) * 12, winsTotal: wins, matchesTotal: h.matches.length, winStreak: 0, bestStreak: 0, offline: true }; }
    return data;
  }
  function fetchOverview() {
    return fetch(`/api/evolution/overview?profileKey=${encodeURIComponent(profileKey())}`).then(r => r.json()).then(d => { cachedOverview = mergeLocalIntoOverview(d); return cachedOverview; }).catch(() => { cachedOverview = mergeLocalIntoOverview(null); return cachedOverview; });
  }

  // ── DOM ───────────────────────────────────────────────────────────────────
  function ensureUiDom() {
    injectStyles();
    if (!deckEl) { deckEl = document.createElement('section'); deckEl.id = 'apex-evo-command-deck'; deckEl.className = 'evo-plate'; deckEl.setAttribute('aria-label', 'Free Battle Evolution Command Deck'); document.body.appendChild(deckEl); renderCommandDeck(); }
    if (!overlayEl) {
      overlayEl = document.createElement('div'); overlayEl.id = 'apex-evo-battle-overlay';
      overlayEl.innerHTML = `
        <div id="evo-lb-top"></div><div id="evo-lb-bot"></div><div id="evo-tint"></div><div id="evo-impact"></div>
        <div id="evo-banner" class="evo-plate"><div class="b-title"><span id="evo-b-title">ARENA</span><span class="b-kind" id="evo-b-kind">EVENT</span></div><div class="b-sub" id="evo-b-sub"></div><div class="b-bar"><div class="b-fill" id="evo-b-fill"></div></div></div>
        <div id="evo-series" class="evo-plate"><span>BO3</span><span id="evo-series-pips"></span><span id="evo-series-round">R1</span></div>
        <div id="evo-kin-layer"></div>
        <div id="evo-ultban" class="evo-plate"><div class="u-hero" id="evo-u-hero"></div><div class="u-name" id="evo-u-name"></div><div class="u-hint" id="evo-u-hint"></div></div>
        <div id="apex-evo-touch-pad"><div id="apex-evo-touch-knob"></div></div>
        <div id="evo-dock">
          <div class="evo-side" id="evo-side-p2" style="display:none">
            <div class="evo-abil-row">
              <button type="button" class="evo-abil" id="evo-aegis-p2" style="--a-col:#5ce1ff"><svg viewBox="0 0 80 80"><circle class="ring-bg" cx="40" cy="40" r="37"/><circle class="ring-fg" cx="40" cy="40" r="37" id="evo-aegis-ring-p2" stroke-dasharray="232" stroke-dashoffset="0"/></svg><span class="a-key">ENTER</span><span class="a-name">AEGIS</span><span class="a-val" id="evo-aegis-val-p2">READY</span></button>
              <button type="button" class="evo-abil is-ult" id="evo-od-p2" style="--a-col:#4cc9f0"><svg viewBox="0 0 80 80"><circle class="ring-bg" cx="40" cy="40" r="37"/><circle class="ring-fg" cx="40" cy="40" r="37" id="evo-od-ring-p2" stroke-dasharray="232" stroke-dashoffset="232"/></svg><span class="a-key">/</span><span class="a-name">ULT</span><span class="a-val" id="evo-od-val-p2">25%</span></button>
            </div>
            <div class="evo-status evo-plate"><span class="rank" id="evo-rank-p2">D</span><div class="evo-sync"><i id="evo-sync-p2"></i></div></div>
          </div>
          <div class="evo-side" id="evo-side-p1">
            <div class="evo-abil-row">
              <button type="button" class="evo-abil" id="evo-aegis-p1" style="--a-col:#5ce1ff"><svg viewBox="0 0 80 80"><circle class="ring-bg" cx="40" cy="40" r="37"/><circle class="ring-fg" cx="40" cy="40" r="37" id="evo-aegis-ring-p1" stroke-dasharray="232" stroke-dashoffset="0"/></svg><span class="a-key">SPACE</span><span class="a-name">AEGIS</span><span class="a-val" id="evo-aegis-val-p1">READY</span></button>
              <button type="button" class="evo-abil is-ult" id="evo-od-p1" style="--a-col:#ffb340"><svg viewBox="0 0 80 80"><circle class="ring-bg" cx="40" cy="40" r="37"/><circle class="ring-fg" cx="40" cy="40" r="37" id="evo-od-ring-p1" stroke-dasharray="232" stroke-dashoffset="232"/></svg><span class="a-key">Q</span><span class="a-name" id="evo-od-name-p1">ULT</span><span class="a-val" id="evo-od-val-p1">25%</span></button>
            </div>
            <div class="evo-status evo-plate"><span class="rank" id="evo-rank-p1">D · DORMANT</span><div class="evo-sync"><i id="evo-sync-p1"></i></div><span id="evo-parries-p1">⚡0</span></div>
            <div class="evo-hint evo-plate" id="evo-hint">WASD · THRUST &nbsp;│&nbsp; SPACE · AEGIS &nbsp;│&nbsp; Q · OVERDRIVE</div>
          </div>
        </div>
        <div id="apex-evo-lab-bar" class="evo-plate"><span class="evo-deck-label">LAB:</span>${LAB_WEAPONS.map(([w, l]) => `<button type="button" class="evo-pill" data-lab-spawn="${w}">${l}</button>`).join('')}<button type="button" class="evo-pill is-active" id="evo-lab-fullsync">MAX SYNC</button></div>
        <div id="evo-round"><div class="evo-round-plate evo-plate" id="evo-round-plate"></div></div>
        <div id="evo-ko"><div class="evo-ko-plate evo-plate" id="evo-ko-plate"></div><div class="evo-hl" id="evo-hl"></div></div>`;
      document.body.appendChild(overlayEl);
      banner = { el: document.getElementById('evo-banner'), until: 0, dur: 1 };
      const C = () => g.APEX_EVOLUTION_COMBAT;
      document.getElementById('evo-aegis-p1').onclick = () => { hintsUsed.aegis = true; C()?.triggerAegis?.(0); };
      document.getElementById('evo-od-p1').onclick = () => { hintsUsed.od = true; C()?.triggerOverdrive?.(0); };
      document.getElementById('evo-aegis-p2').onclick = () => C()?.triggerAegis?.(1);
      document.getElementById('evo-od-p2').onclick = () => C()?.triggerOverdrive?.(1);
      overlayEl.querySelectorAll('[data-lab-spawn]').forEach(btn => { btn.onclick = () => { const w = btn.getAttribute('data-lab-spawn'), s = g.GAME_SIZE || 1000, p1 = g.fighters?.[0]; const x = p1 ? Math.max(120, Math.min(s - 120, p1.x + (Math.random() - .5) * 180)) : s / 2, y = p1 ? Math.max(120, Math.min(s - 120, p1.y + (Math.random() - .5) * 180)) : s / 2; C()?.spawnFloorWeaponDirect?.(w, x, y, false); }; });
      document.getElementById('evo-lab-fullsync').onclick = () => { const st = C()?.getState?.(); if (st) { st.sides[0].sync = 100; st.sides[0].aegisCd = 0; } };
      const pad = document.getElementById('apex-evo-touch-pad'), knob = document.getElementById('apex-evo-touch-knob'); let ptr = null;
      const upd = (cx, cy) => { const r = pad.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2, maxR = r.width * .38; let dx = cx - mx, dy = cy - my; const d = Math.hypot(dx, dy); if (d > maxR) { dx = dx / d * maxR; dy = dy / d * maxR; } knob.style.transform = `translate(${dx}px,${dy}px)`; hintsUsed.thrust = true; C()?.setTouchVector?.(true, dx / maxR, dy / maxR); };
      pad.addEventListener('pointerdown', e => { ptr = e.pointerId; pad.setPointerCapture?.(e.pointerId); upd(e.clientX, e.clientY); });
      pad.addEventListener('pointermove', e => { if (e.pointerId === ptr) upd(e.clientX, e.clientY); });
      const rel = e => { if (e.pointerId === ptr) { ptr = null; knob.style.transform = ''; C()?.setTouchVector?.(false, 0, 0); } };
      pad.addEventListener('pointerup', rel); pad.addEventListener('pointercancel', rel);
      window.addEventListener('keydown', e => { if (!C()?.evoActive?.()) return; if (/^Key[WASD]$|^Arrow/.test(e.code)) hintsUsed.thrust = true; if (e.code === 'Space' || e.code === 'KeyL') hintsUsed.aegis = true; if (e.code === 'KeyQ' || e.code === 'ShiftLeft') hintsUsed.od = true; });
    }
    if (!warRoomEl) {
      warRoomEl = document.createElement('div'); warRoomEl.id = 'apex-evo-warroom-modal';
      warRoomEl.innerHTML = `<div class="evo-wr-panel evo-plate"><div class="evo-wr-head"><div><div style="font-size:11px;letter-spacing:.15em;color:#ff941f;font-family:var(--evo-mono)">APEX CHAOS · TOTAL EVOLUTION</div><div style="font-size:24px;font-weight:800;letter-spacing:.06em">SCRAP BASIN WAR ROOM</div></div><button type="button" class="evo-pill" id="evo-close-warroom" style="padding:6px 14px;font-size:13px">CLOSE [ESC]</button></div><div id="evo-wr-body"></div></div>`;
      document.body.appendChild(warRoomEl);
      document.getElementById('evo-close-warroom').onclick = () => warRoomEl.classList.remove('is-open');
      warRoomEl.addEventListener('click', e => { if (e.target === warRoomEl) warRoomEl.classList.remove('is-open'); });
      window.addEventListener('keydown', e => { if (e.code === 'Escape') warRoomEl.classList.remove('is-open'); });
    }
  }

  // ── command deck ──────────────────────────────────────────────────────────
  function renderCommandDeck() {
    if (!deckEl) return;
    const arenas = g.APEX_EVOLUTION_ARENAS, combat = g.APEX_EVOLUTION_COMBAT, shader = g.APEX_EVOLUTION_SHADER;
    if (!arenas || !combat) return;
    const curArena = arenas.getSelectedId(), curRule = combat.getRuleset(), curAi = combat.getAiTier(), curSh = shader ? shader.getQuality() : 'ultra';
    const elo = cachedOverview?.profile?.eloRating || 1200;
    const arenaDef = curArena === 'random' ? null : arenas.catalog().find(a => a.id === curArena);
    const RULES = { standard: 'Standard duel · 1000 HP · Mythic pod every 24s.', mythic_mayhem: 'Mythic Mayhem · +60% Sync gain · pods every 11s · ordnance chaos.', championship_bo3: 'Championship BO3 · first to two rounds · series card between rounds.', tactical_lab: 'Tactical Lab · infinite Sync · spawn any ordnance · practice parries & ultimates.' };
    const AIS = { recruit: 'Reckless rookie: chases, rarely parries, fires ult instantly.', veteran: 'Spacing, weapon priority, reactive parries.', grandmaster: 'Feints, baits your Aegis, saves ult to punish.', nemesis: 'Predicts trajectories, escapes ult zones, counter-ults.' };
    deckEl.innerHTML = `
      <div class="evo-deck-row"><span class="evo-deck-label">ARENA</span>${arenas.catalog().map(a => `<button type="button" class="evo-pill ${curArena === a.id ? 'is-active' : ''}" data-evo-arena="${a.id}">${a.shortName}</button>`).join('')}<button type="button" class="evo-pill ${curArena === 'random' ? 'is-active' : ''}" data-evo-arena="random">RANDOM</button></div>
      <div class="evo-deck-row"><span class="evo-deck-label">MODE</span>${[['standard', 'STANDARD'], ['mythic_mayhem', 'MYTHIC MAYHEM'], ['championship_bo3', 'CHAMPIONSHIP BO3'], ['tactical_lab', 'TACTICAL LAB']].map(([id, l]) => `<button type="button" class="evo-pill ${curRule === id ? 'is-active' : ''}" data-evo-rule="${id}">${l}</button>`).join('')}
        <span class="evo-deck-label" style="margin-left:8px">AI</span>${Object.entries(combat.aiProfiles).map(([id, p]) => `<button type="button" class="evo-pill ${curAi === id ? 'is-active' : ''}" data-evo-ai="${id}">${p.label}</button>`).join('')}
        <button type="button" class="evo-pill ${curSh !== 'off' ? 'is-active' : ''}" id="evo-shader-btn" style="margin-left:8px">FX ${curSh.toUpperCase()}</button><button type="button" class="evo-pill" id="evo-open-warroom" style="border-color:#4cc9f0;color:#72efdd">WAR ROOM · ${elo}</button></div>
      <div class="evo-deck-desc">${arenaDef ? `<b>${arenaDef.name}</b> — ${arenaDef.desc}` : '<b>RANDOM</b> — one of five living arenas is drawn at match start.'} &nbsp;·&nbsp; ${RULES[curRule]} &nbsp;·&nbsp; <b>${combat.aiProfiles[curAi].label}</b>: ${AIS[curAi]}</div>`;
    deckEl.querySelectorAll('[data-evo-arena]').forEach(b => b.onclick = () => { arenas.setSelectedId(b.getAttribute('data-evo-arena')); renderCommandDeck(); });
    deckEl.querySelectorAll('[data-evo-rule]').forEach(b => b.onclick = () => { combat.setRuleset(b.getAttribute('data-evo-rule')); renderCommandDeck(); });
    deckEl.querySelectorAll('[data-evo-ai]').forEach(b => b.onclick = () => { combat.setAiTier(b.getAttribute('data-evo-ai')); renderCommandDeck(); });
    document.getElementById('evo-shader-btn').onclick = () => { shader?.cycleQuality?.(); renderCommandDeck(); };
    document.getElementById('evo-open-warroom').onclick = openWarRoom;
  }

  // ── banners / typography / cinematic ──────────────────────────────────────
  function arenaBanner(o) {
    ensureUiDom(); const el = banner.el;
    el.style.setProperty('--b-col', o.color || '#ff941f');
    el.className = 'evo-plate is-on k-' + (o.kind || 'active');
    document.getElementById('evo-b-title').textContent = o.title || '';
    document.getElementById('evo-b-sub').textContent = o.sub || '';
    document.getElementById('evo-b-kind').textContent = o.kind === 'warn' ? 'INCOMING' : o.kind === 'intro' ? 'ARENA' : 'ACTIVE';
    banner.dur = Math.max(0.5, o.seconds || 2); banner.until = performance.now() + banner.dur * 1000;
  }
  function worldToScreen(wx, wy) {
    const cv = document.getElementById('game-canvas'); if (!cv) return null;
    const r = cv.getBoundingClientRect(), s = g.GAME_SIZE || 1000;
    return { x: r.left + (wx / s) * r.width, y: r.top + (wy / s) * r.height };
  }
  function kinetic(wx, wy, text, color, scale) {
    ensureUiDom(); if (kinCount >= 4) return;
    const p = worldToScreen(wx, wy); if (!p) return;
    const layer = document.getElementById('evo-kin-layer'); const el = document.createElement('div');
    el.className = 'evo-kin evo-plate'; el.textContent = text; el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    el.style.setProperty('--k-col', color || '#ffd166'); el.style.setProperty('--sc', String(scale || 1)); el.style.setProperty('--tilt', (Math.random() * 8 - 4).toFixed(1) + 'deg');
    layer.appendChild(el); kinCount++; setTimeout(() => { el.remove(); kinCount--; }, 1000);
  }
  let lbUntil = 0, tintUntil = 0;
  function cinematic(o) {
    ensureUiDom(); g.APEX_EVOLUTION_COMBAT?.cinematic?.(o);
    if (o.letterbox) { overlayEl.classList.add('is-lb'); lbUntil = performance.now() + ((o.hold || 0.4) + 1.6) * 1000; }
    if (o.tint) { const t = document.getElementById('evo-tint'); t.className = o.tint; tintUntil = performance.now() + 3200; }
  }
  function ultimateBanner(sideIdx, heroId, meta) {
    ensureUiDom(); const el = document.getElementById('evo-ultban');
    el.style.setProperty('--u-col', meta.color); document.getElementById('evo-u-hero').textContent = `${sideIdx === 0 ? 'P1' : 'P2'} · ${label(heroId)} · OVERDRIVE`;
    document.getElementById('evo-u-name').textContent = meta.name; document.getElementById('evo-u-hint').textContent = (sideIdx === 1 ? 'COUNTER: ' : '') + (meta.hint || '');
    el.classList.add('is-on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('is-on'), 1700);
    cinematic({ letterbox: 1, hold: 0.5 });
  }
  function koSequence(ko, evo, series) {
    ensureUiDom();
    const imp = document.getElementById('evo-impact'); imp.classList.remove('is-hit'); void imp.offsetWidth; imp.classList.add('is-hit');
    overlayEl.classList.add('is-lb'); lbUntil = performance.now() + 2600;
    const f = g.fighters?.[ko.winnerIdx]; const hero = g.APEX_EVOLUTION_COMBAT?.heroIdOf?.(f) || f?.name || 'FIGHTER';
    const meta = g.APEX_EVOLUTION_COMBAT?.heroUltMeta?.(hero); const st = evo.sides[ko.winnerIdx];
    const finish = /Overdrive|Jet|Meteor|Supernova|Eclipse|Zero|Refraction|Heat/.test(ko.label) ? `ULTIMATE FINISH · ${meta?.name || ''}` : st.parryCount >= 3 ? 'FLAWLESS GUARD · ' + st.parryCount + ' PERFECT PARRIES' : st.maxRankIdx >= 5 ? 'APEX CHAOS RANK FINISH' : ko.label && ko.label !== 'Apex Overdrive' ? `DECISIVE · ${String(ko.label).toUpperCase()}` : 'DECISIVE FINISH';
    document.getElementById('evo-ko-plate').innerHTML = `<div class="k-eyebrow">${series && g.APEX_EVOLUTION_COMBAT?.getRuleset?.() === 'championship_bo3' ? `ROUND ${series.round} · ` : ''}SCRAP BASIN</div><div class="k-title">APEX K.O.</div><div class="k-winner">${ko.winnerIdx === 0 ? 'P1' : 'P2'} · ${label(hero)} WINS</div><div class="k-finish">${finish}</div>`;
    const hl = document.getElementById('evo-hl'); const items = (evo.highlights || []).slice(-5);
    hl.innerHTML = items.map(h => `<span>${h.icon || '•'} ${h.text}</span>`).join('') + `<span>⏱ ${evo.time.toFixed(1)}S</span><span>✦ BIGGEST HIT ${Math.round(Math.max(evo.sides[0].biggestHit, evo.sides[1].biggestHit))}</span>`;
    const box = document.getElementById('evo-ko'); box.classList.add('is-on'); clearTimeout(box._t); box._t = setTimeout(() => box.classList.remove('is-on'), 2500);
  }
  function roundResult(r) {
    ensureUiDom(); const box = document.getElementById('evo-round'), pl = document.getElementById('evo-round-plate');
    const col = r.winnerIdx === 0 ? '#ff941f' : '#4cc9f0'; pl.style.setProperty('--rc', col);
    pl.innerHTML = `<div class="r-eyebrow">CHAMPIONSHIP · ROUND ${r.round}</div><div class="r-title">${r.final ? 'SERIES CHAMPION' : 'ROUND WON'}</div><div class="r-score">P1 ${r.p1Wins} — ${r.p2Wins} P2</div><div class="r-next">${r.final ? (r.winnerIdx === 0 ? 'P1' : 'P2') + ' TAKES THE SERIES' : 'NEXT ROUND IN 2.6S · ARENA RESET'}</div>`;
    box.classList.add('is-on'); clearTimeout(box._t); box._t = setTimeout(() => box.classList.remove('is-on'), r.final ? 2400 : 2500);
  }
  function onMatchStart(evo, series) { hintStart = performance.now(); const h = document.getElementById('evo-hint'); if (h) h.classList.remove('is-gone'); const ko = document.getElementById('evo-ko'); ko?.classList.remove('is-on'); overlayEl?.classList.remove('is-lb'); const t = document.getElementById('evo-tint'); if (t) t.className = ''; }

  // ── frame sync ────────────────────────────────────────────────────────────
  function isScreenVisible(id) { const el = document.getElementById(id); if (!el || el.getAttribute('aria-hidden') === 'true') return false; const st = g.getComputedStyle(el); return st.display !== 'none' && st.visibility !== 'hidden' && parseFloat(st.opacity || '1') > 0.1; }
  function ringOffset(id, frac) { const el = document.getElementById(id); if (el) el.style.strokeDashoffset = String(232 * (1 - Math.max(0, Math.min(1, frac)))); }
  function syncHudFrame() {
    ensureUiDom();
    const combat = g.APEX_EVOLUTION_COMBAT, now = performance.now();
    const live = !!combat?.evoActive?.() && !g.APEX_ARSENAL?.state?.over;
    const onPick = !live && (isScreenVisible('modeSelectScreen') || isScreenVisible('fighterSelectScreen'));
    deckEl.classList.toggle('is-visible', onPick);
    overlayEl.classList.toggle('is-live', live || (!!combat?.evoActive?.() && !!g.APEX_ARSENAL?.state?.over));
    if (banner.el.classList.contains('is-on')) { const rem = banner.until - now; if (rem <= 0) banner.el.classList.remove('is-on'); else document.getElementById('evo-b-fill').style.width = `${(rem / (banner.dur * 1000)) * 100}%`; }
    if (lbUntil && now > lbUntil) { overlayEl.classList.remove('is-lb'); lbUntil = 0; }
    if (tintUntil && now > tintUntil) { document.getElementById('evo-tint').className = ''; tintUntil = 0; }
    if (!live) return;
    const evo = combat.getState(); if (!evo) return;
    const isLocal = g.__apexArsenalBattleProfile === 'LOCAL';
    document.getElementById('evo-side-p2').style.display = isLocal ? 'flex' : 'none';
    document.getElementById('apex-evo-lab-bar').classList.toggle('is-active', combat.getRuleset() === 'tactical_lab');
    const coarse = g.matchMedia?.('(pointer: coarse)')?.matches || (g.navigator?.maxTouchPoints > 0 && !g.matchMedia?.('(pointer: fine)')?.matches);
    document.getElementById('apex-evo-touch-pad').classList.toggle('is-shown', !!coarse);
    const series = combat.getSeries?.(); const se = document.getElementById('evo-series');
    if (combat.getRuleset() === 'championship_bo3' && series) { se.classList.add('is-on'); document.getElementById('evo-series-pips').innerHTML = `<i class="${series.p1Wins > 0 ? 'w1' : ''}"></i><i class="${series.p1Wins > 1 ? 'w1' : ''}"></i>&nbsp;<i class="${series.p2Wins > 1 ? 'w2' : ''}"></i><i class="${series.p2Wins > 0 ? 'w2' : ''}"></i>`; document.getElementById('evo-series-round').textContent = 'R' + series.round; } else se.classList.remove('is-on');
    const hint = document.getElementById('evo-hint'); if (hint && ((hintsUsed.thrust && hintsUsed.aegis && hintsUsed.od) || now - hintStart > 14000)) hint.classList.add('is-gone');
    for (let idx = 0; idx < (isLocal ? 2 : 1); idx++) {
      const p = idx === 0 ? 'p1' : 'p2', st = evo.sides[idx], f = g.fighters?.[idx];
      const aeg = document.getElementById(`evo-aegis-${p}`), aegV = document.getElementById(`evo-aegis-val-${p}`);
      const ready = st.aegisCd <= 0.02; aeg.classList.toggle('is-ready', ready); aegV.textContent = st.aegisWindow > 0 ? 'ACTIVE' : ready ? 'READY' : st.aegisCd.toFixed(1) + 'S';
      ringOffset(`evo-aegis-ring-${p}`, ready ? 1 : 1 - st.aegisCd / 4.6);
      const od = document.getElementById(`evo-od-${p}`), odV = document.getElementById(`evo-od-val-${p}`);
      const odReady = st.sync >= 100 && st.overdriveLeft <= 0; od.classList.toggle('is-ready', odReady);
      odV.textContent = st.overdriveLeft > 0 ? st.overdriveLeft.toFixed(1) + 'S' : odReady ? 'UNLEASH' : Math.floor(st.sync) + '%';
      ringOffset(`evo-od-ring-${p}`, st.overdriveLeft > 0 ? st.overdriveLeft / 4.6 : st.sync / 100);
      if (f) { const meta = combat.heroUltMeta(combat.heroIdOf(f)); od.style.setProperty('--a-col', meta.color); const nm = document.getElementById(`evo-od-name-${p}`); if (nm) nm.textContent = odReady ? '★ ULT' : 'ULT'; }
      const rk = combat.currentRank(idx), rkEl = document.getElementById(`evo-rank-${p}`); if (rkEl) { rkEl.style.setProperty('--r-col', rk.col); rkEl.textContent = idx === 0 ? `${rk.grade} · ${rk.label}` : rk.grade; }
      const sy = document.getElementById(`evo-sync-${p}`); if (sy) sy.style.width = `${st.sync}%`;
      const pr = document.getElementById(`evo-parries-${p}`); if (pr) pr.textContent = `⚡${st.parryCount} ↯${st.ricochets}`;
    }
  }

  // ── war room ──────────────────────────────────────────────────────────────
  function openWarRoom() { ensureUiDom(); warRoomEl.classList.add('is-open'); renderWarRoomContent(cachedOverview); fetchOverview().then(renderWarRoomContent); }
  function renderWarRoomContent(data) {
    const body = document.getElementById('evo-wr-body'); if (!body) return;
    if (!data) { body.innerHTML = '<div style="padding:24px;color:#94a3b8">LOADING SCRAP BASIN TELEMETRY...</div>'; return; }
    const prof = data.profile || {}, fighters = data.fighters || [], matches = data.matches || [];
    body.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px;padding:10px 14px;background:rgba(255,148,31,.08);border:1px solid rgba(255,148,31,.3)">
      <div><div style="font-size:11px;color:#ff9f1c;letter-spacing:.12em;font-family:var(--evo-mono)">COMMANDER CALLSIGN · ${data.offline || prof.offline ? 'LOCAL VAULT (OFFLINE)' : 'POSTGRESQL SYNCED'}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:4px"><input id="evo-callsign-input" value="${prof.callsign || 'BASIN VANGUARD'}" maxlength="24" style="background:#0b0e15;border:1px solid rgba(255,255,255,.22);color:#fff;padding:4px 8px;font-family:var(--evo-font);font-size:15px;letter-spacing:.08em;text-transform:uppercase"/><button type="button" id="evo-callsign-save" class="evo-pill is-active">SAVE</button></div></div>
      <div style="display:flex;gap:20px"><div><div style="font-size:10px;color:#94a3b8">APEX RATING</div><div style="font-size:22px;font-weight:800;color:#ffd166">${prof.eloRating ?? 1200} ELO</div></div><div><div style="font-size:10px;color:#94a3b8">STREAK</div><div style="font-size:22px;font-weight:800;color:#72efdd">${prof.winStreak ?? 0} <span style="font-size:12px;color:#94a3b8">(BEST ${prof.bestStreak ?? 0})</span></div></div><div><div style="font-size:10px;color:#94a3b8">RECORD</div><div style="font-size:22px;font-weight:800">${prof.winsTotal ?? 0}W / ${Math.max(0, (prof.matchesTotal ?? 0) - (prof.winsTotal ?? 0))}L</div></div></div></div>
      <div class="evo-wr-grid"><div class="evo-wr-card"><div style="font-size:12px;letter-spacing:.12em;color:#ff9f1c;margin-bottom:8px;font-weight:700">FIGHTER TELEMETRY</div>${fighters.map(f => { const wr = f.matchesPlayed > 0 ? Math.round(f.wins / f.matchesPlayed * 100) : 50; return `<div class="evo-wr-row"><span><strong>${label(f.heroId)}</strong> <small style="color:#94a3b8">· ${f.matchesPlayed}M</small></span><span><b style="color:#ffd166">${wr}%</b> <small style="color:#72efdd">⚡${f.perfectParries} ★${f.overdrivesCast}</small></span></div>`; }).join('') || '<div style="color:#94a3b8;font-size:12px">Play a match to record telemetry.</div>'}</div>
      <div class="evo-wr-card"><div style="font-size:12px;letter-spacing:.12em;color:#4cc9f0;margin-bottom:8px;font-weight:700">RECENT CHRONICLE</div>${matches.slice(0, 10).map(m => `<div class="evo-wr-row"><span><strong>${label(m.p1Hero)}</strong> vs <strong style="color:#cbd5e1">${label(m.p2Hero)}</strong> <small style="color:#94a3b8">[${String(m.arenaId || '').replace('_', ' ')} · ${String(m.ruleset || '').replace('_', ' ')}]</small></span><span>${m.winnerSide === 'p1' ? '<b style="color:#a3e635">P1</b>' : '<b style="color:#fb7185">P2</b>'} <small style="color:#ffd166">· ${m.maxComboRank} · ⚡${m.p1Parries} · ${m.topWeapon}</small></span></div>`).join('') || '<div style="color:#94a3b8;font-size:12px">No matches yet.</div>'}</div></div>`;
    document.getElementById('evo-callsign-save').onclick = () => { const v = document.getElementById('evo-callsign-input').value; try { localStorage.setItem('apexEvolution.callsign', v.toUpperCase()); } catch (_) {} fetch('/api/evolution/overview', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileKey: profileKey(), callsign: v }) }).catch(() => {}).then(() => fetchOverview().then(renderWarRoomContent)); };
  }

  function reportCompletedMatch(evo, series) {
    try {
      const f1 = g.fighters?.[0], f2 = g.fighters?.[1]; if (!f1 || !f2) return;
      const C = g.APEX_EVOLUTION_COMBAT;
      const p1Hero = C.heroIdOf(f1), p2Hero = C.heroIdOf(f2);
      const aq = g.APEX_ARSENAL?.state; const winnerSide = aq?.winnerSide === 'P2' ? 'p2' : aq?.winnerSide === 'P1' ? 'p1' : (f1.hp > f2.hp ? 'p1' : 'p2');
      const ranks = ['D', 'C', 'B', 'A', 'S', 'APEX']; let topWeapon = 'UNARMED', topWeaponDamage = 0;
      if (aq?.weaponDamageById) for (const [w, d] of Object.entries(aq.weaponDamageById)) if (Number(d) > topWeaponDamage) { topWeaponDamage = Math.round(Number(d)); topWeapon = w; }
      const payload = { profileKey: profileKey(), mode: g.__apexArsenalBattleProfile === 'LOCAL' ? 'local' : 'bot', ruleset: C.getRuleset(), arenaId: g.APEX_EVOLUTION_ARENAS?.getActiveArena?.()?.id || 'scrap_foundry', aiTier: C.getAiTier(), p1Hero, p2Hero, winnerSide, durationSec: Math.max(1, Math.round(evo.time)), p1Damage: Math.round(evo.sides[0].damageDealt), p2Damage: Math.round(evo.sides[1].damageDealt), p1Parries: evo.sides[0].parryCount, p2Parries: evo.sides[1].parryCount, p1Overdrives: evo.sides[0].overdriveCount, p2Overdrives: evo.sides[1].overdriveCount, maxComboRank: ranks[evo.sides[0].maxRankIdx] || 'D', topWeapon, topWeaponDamage };
      const h = localHistory(); h.matches.push(payload); if (h.matches.length > 40) h.matches.shift();
      for (const [hero, won, dmg, par, od] of [[p1Hero, winnerSide === 'p1', payload.p1Damage, payload.p1Parries, payload.p1Overdrives], [p2Hero, winnerSide === 'p2', payload.p2Damage, payload.p2Parries, payload.p2Overdrives]]) { const r = h.fighters[hero] || (h.fighters[hero] = { heroId: hero, matchesPlayed: 0, wins: 0, totalDamage: 0, perfectParries: 0, overdrivesCast: 0 }); r.matchesPlayed++; if (won) r.wins++; r.totalDamage += dmg; r.perfectParries += par; r.overdrivesCast += od; }
      saveLocalHistory(h);
      fetch('/api/evolution/match', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {}).then(() => fetchOverview().then(renderCommandDeck));
    } catch (_) {}
  }

  if (typeof window !== 'undefined') { fetchOverview().then(() => deckEl && renderCommandDeck()); setInterval(syncHudFrame, 90); }
  g.APEX_EVOLUTION_HUD = { openWarRoom, reportCompletedMatch, refreshDeck: renderCommandDeck, arenaBanner, kinetic, cinematic, ultimateBanner, koSequence, roundResult, onMatchStart };
  g.apexEvolutionHudAndDeck = 'ready';
})(window);
