/* =============================================================================
 * APEX CHAOS — ROBOT owner visual correction checkpoint (2026-09-29)
 *
 * Authority: docs/hero-rework/robot-final/reference/ROBOT_VISUAL_AUTHORITY.html
 * Complete HTML now 1282 lines, SHA bd0cc64fbeea94969fbef0b4bc4de690a19e85fafe93cb4a12c9b3accf095f75
 * Final SFX (8 files): lock, no_weapon, dash, activate, armor_hit, end, milestone, upgrade
 *
 * Fixes in this pass:
 * - Single authoritative event per presentation (no duplicate SFX)
 *   LOCK: RobotA1Lock only
 *   NO-WEAPON: CastFailCue -> emits RobotA1NoWeapon (authoritative) once, P2 silent
 *   DASH: RobotA1DashLaunch only (RobotA1Dash alias no SFX)
 *   CONTACT: real equip truth via onEquipOffensive -> RobotA1Contact only, not arriveRadius
 *   A2 ACTIVATE: RobotA2Start only (Activate alias no SFX)
 *   A2 ARMOR HIT: RobotA2Hit only (ArmorHit alias no SFX), RealizedDamageEvent does NOT play armor SFX
 *   A2 END: mechanics onTick authoritative, presentation does NOT have duplicate expiry
 *   PASSIVE: RobotPassiveMilestone once, RobotPassiveUpgrade once, MilestoneRefund alias no SFX
 * - Restored missing visual tail from complete HTML: drawBrackets elastic, drawMeasure, drawTrail with calibration ticks, fade logic
 * - No second AudioContext, bounded voices, session teardown
 * ========================================================================== */

(function (globalScope) {
  'use strict';
  if (globalScope.apexRobotPresentationRuntime === 'ready') return;
  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const mix = (a, b, t) => a + (b - a) * t;
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

  const HS = 172;
  const HSC = HS / 1280;
  const PIV = [{ x: 191, y: 626 }, { x: 1089, y: 626 }];
  const JAW = { x: 414, y: 1094 };
  const LATCH = { x: 640, y: 470 };
  const GUN_DROP = 5;

  const mir = (pts) => pts.map(p => [1280 - p[0], p[1]]);
  const M = {};
  M.calL = [[455,92],[490,140],[478,298],[420,366],[476,316],[498,300],[520,326],[472,488],[374,548],[320,652],[346,742],[430,798],[482,890],[510,992],[456,1034],[432,1114],[372,1100],[322,964],[298,902],[256,896],[166,814],[110,694],[92,556],[144,506],[114,470],[174,360],[276,226],[418,104]];
  M.calR = mir(M.calL);
  M.cheekL = [[330,862],[472,814],[538,892],[484,1022],[362,1002],[302,930]];
  M.cheekR = mir(M.cheekL);
  M.chin = [[518,914],[640,830],[762,914],[736,1042],[640,1130],[544,1042]];
  M.crest = [[596,60],[640,46],[684,60],[736,180],[762,252],[734,372],[686,422],[680,432],[680,528],[600,528],[600,432],[594,422],[546,372],[518,252],[544,180]];
  const SLOT = [[300,-200],[980,-200],[980,300],[777,300],[745,383],[694,448],[680,452],[680,540],[600,540],[600,452],[586,448],[535,383],[503,300],[300,300]];
  const HULL = [[596,330],[684,330],[900,390],[1004,490],[1046,626],[1004,806],[900,946],[762,1044],[640,1104],[518,1044],[380,946],[276,806],[234,626],[276,490],[380,390]];
  const SEAM = [[474,318],[522,328],[472,488],[372,548],[318,652]];

  const LAYERS = {
    chassis: '<path d="M618 83 Q640 65 663 83 L710 184 762 237 801 353 906 326 1011 417 1112 532 1118 739 1043 909 902 1024 774 1015 716 1090 636 1137 556 1090 503 1017 353 1028 235 925 161 755 169 547 270 399 379 325 474 346 516 239 568 184Z" fill="url(#steel)" stroke="#828487" stroke-width="6"/>' +
      '<path d="M244 573 325 364 474 347 505 413 431 536 364 704 330 911 228 787Z M1036 573 955 364 806 347 775 413 849 536 916 704 950 911 1052 787Z" fill="#101214" stroke="#323337" stroke-width="15"/>' +
      '<path d="M333 678 468 595 603 668 600 871 483 955 364 882Z M947 678 812 595 677 668 680 871 797 955 916 882Z" fill="#111316" stroke="#515057" stroke-width="16"/>' +
      '<path d="M493 855 568 888 640 864 712 888 787 855 815 967 716 1068 640 1107 560 1068 462 967Z" fill="url(#steel)" stroke="#101113" stroke-width="15"/>' +
      '<path d="M588 116 691 116 724 375 690 541 640 576 590 541 556 375Z" fill="#1c1d21" stroke="#888583" stroke-width="5"/>',
    eyes: '<path d="M373 653 Q465 686 563 741 L586 808 505 833 Q423 800 379 762Z M907 653 Q815 686 717 741 L694 808 775 833 Q857 800 901 762Z" fill="#0a0908" stroke="#3d3026" stroke-width="16"/>' +
      '<path d="M399 674 555 755 541 801 472 777 417 731Z M881 674 725 755 739 801 808 777 863 731Z" fill="#e27716" opacity=".75" filter="url(#glow)"/>' +
      '<path d="M404 675 Q475 711 558 752 L540 795 Q476 781 419 732Z M876 675 Q805 711 722 752 L740 795 Q804 781 861 732Z" fill="url(#optic)" stroke="#8e4810" stroke-width="8"/>' +
      '<path d="M432 697 518 748 522 773 460 755Z M848 697 762 748 758 773 820 755Z" fill="#fff8cf" opacity=".9"/>' +
      '<path d="M404 677 558 754 543 771 416 711Z M876 677 722 754 737 771 864 711Z" fill="#422415" opacity=".64"/>',
    shell: '<path d="M425 332 503 305 535 383 586 448 640 471 694 448 745 383 777 305 855 332 933 513 854 636 736 716 640 785 544 716 426 636 347 513Z" fill="url(#cer)" stroke="#0b0d0e" stroke-width="22" stroke-linejoin="round"/>' +
      '<path d="M444 352 503 326 546 441 601 487 570 620 460 561 390 506Z" fill="#fffdf5" opacity=".73"/>' +
      '<path d="M836 352 777 326 734 441 679 487 710 620 820 561 890 506Z" fill="#fffdf5" opacity=".44"/>' +
      '<path d="M431 363 463 530 579 671 544 697 405 609 357 514Z M849 363 817 530 701 671 736 697 875 609 923 514Z" fill="#948e88" opacity=".48"/>' +
      '<path d="M415 363 446 563 551 680 M865 363 834 563 729 680" fill="none" stroke="#bbb4a9" stroke-width="5" opacity=".7"/>',
    datum: '<path d="M604 77 Q640 56 675 77 L723 183 748 252 723 367 684 421 640 445 596 421 557 367 532 252 557 183Z" fill="url(#cer)" stroke="#0b0d0e" stroke-width="22" stroke-linejoin="round"/>' +
      '<path d="M604 91 638 83 638 398 591 365 571 264Z" fill="#fffdf7" opacity=".8"/>' +
      '<path d="M644 145 658 145 658 300 644 300Z" fill="#121315" stroke="#776b59" stroke-width="5"/>' +
      '<path d="M622 301 658 301 659 412 621 412Z" fill="url(#brass)" stroke="#141417" stroke-width="11"/>' +
      '<rect x="603" y="415" width="74" height="103" rx="16" fill="url(#steel)" stroke="#0c0d0e" stroke-width="14"/>' +
      '<circle cx="640" cy="468" r="25" fill="#d3c9b8" stroke="#08090a" stroke-width="9"/><path d="M622 486 658 450" stroke="#171716" stroke-width="8"/>' +
      '<path d="M604 505 591 602 587 788 640 847 693 788 689 602 676 505 640 533Z" fill="url(#cer)" stroke="#0b0d0e" stroke-width="22" stroke-linejoin="round"/>' +
      '<path d="M640 537 640 796" stroke="#171819" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="M615 559 665 559 M614 602 666 602 M615 649 665 649" stroke="#323130" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M598 523 589 780 640 836" fill="none" stroke="#fffdf6" stroke-width="7" opacity=".9"/>',
    caliper: '<path d="M442 113 Q472 106 469 150 L457 285 367 361 406 390 471 321 497 307 529 339 462 484 358 535 300 656 328 745 417 803 469 895 491 989 447 1018 370 944 332 888 263 882 176 800 126 686 109 559 165 510 129 475 186 372 281 241Z" fill="url(#steel)" stroke="#0b0c0e" stroke-width="25" stroke-linejoin="round"/>' +
      '<path d="M441 120 289 229 193 331 143 468 182 504 127 554 145 684 209 795 312 888 379 1079 418 1098 414 1016 317 741 337 559 457 320 454 134Z" fill="url(#cer)" stroke="#07090a" stroke-width="19" stroke-linejoin="round"/>' +
      '<path d="M440 139 292 244 213 335 166 463 190 479 266 490 350 231Z" fill="#fffdf7" opacity=".78"/>' +
      '<path d="M350 228 441 140 431 244 337 327 271 487 263 498Z" fill="#aaa197" opacity=".57"/>' +
      '<path d="M271 491 185 512 138 571 162 687 225 771 274 804 314 739 304 570Z" fill="#faf6ec" opacity=".66"/>' +
      '<path d="M210 312 272 325 243 402 214 393Z" fill="#141518" stroke="#898783" stroke-width="6"/>' +
      '<path d="M222 393 265 331" stroke="#565455" stroke-width="7"/>' +
      '<path d="M317 696 335 794 L382 886 L459 967 L468 995 L388 1059 L321 951 L279 806Z" fill="url(#cer)" stroke="#080a0b" stroke-width="17" stroke-linejoin="round"/>' +
      '<path d="M338 754 377 814 391 950 361 916Z" fill="#fffdf4" opacity=".68"/>' +
      '<circle cx="191" cy="626" r="91" fill="#111315" stroke="#a6a2a0" stroke-width="13"/>',
    cheek: '<path d="M336 872 470 824 528 892 478 1012 366 992 312 928Z" fill="url(#cer)" stroke="#080a0b" stroke-width="17" stroke-linejoin="round"/>' +
      '<path d="M352 880 468 840 448 986 372 972Z" fill="#fffdf4" opacity=".6"/>' +
      '<path d="M470 830 524 894 480 1004 452 962 486 892Z" fill="#a39a90" opacity=".55"/>' +
      '<path d="M392 890 416 884 410 962 388 966Z" fill="url(#brass)" stroke="#191919" stroke-width="7"/>',
    chin: '<path d="M530 922 639 843 750 922 723 1033 640 1116 555 1033Z" fill="url(#cer)" stroke="#0b0d0e" stroke-width="22" stroke-linejoin="round"/>' +
      '<path d="M550 929 641 866 641 1072 583 1026Z" fill="#fffdf5" opacity=".66"/>' +
      '<path d="M641 866 735 929 698 1026 641 1072Z" fill="#a9a197" opacity=".43"/>' +
      '<path d="M534 920 640 854 746 920" fill="none" stroke="#fefbf3" stroke-width="8"/>',
    pivot: '<circle cx="191" cy="626" r="72" fill="url(#cer)" stroke="#232323" stroke-width="12"/>' +
      '<circle cx="191" cy="626" r="53" fill="url(#brass)" stroke="#24190d" stroke-width="11"/>' +
      '<path d="M151 667 231 586" stroke="#3e250e" stroke-width="14" stroke-linecap="round"/>' +
      '<circle cx="191" cy="626" r="43" fill="none" stroke="#ffdea0" stroke-width="5" opacity=".6"/>'
  };

  function poly(g, pts) {
    if (!pts || !pts.length) return;
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
  }
  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }
  function createGradients(ctx) {
    const grads = {};
    let g = ctx.createLinearGradient(0, 0, 1280, 1280);
    g.addColorStop(0, '#fffdf8'); g.addColorStop(0.48, '#e9e3d8'); g.addColorStop(0.78, '#c5bdb3'); g.addColorStop(1, '#fff9ed');
    grads.cer = g;
    g = ctx.createLinearGradient(0, 0, 1280, 1280);
    g.addColorStop(0, '#fff4b8'); g.addColorStop(0.25, '#efbc61'); g.addColorStop(0.56, '#a35d12'); g.addColorStop(0.85, '#e5a741'); g.addColorStop(1, '#fff3b0');
    grads.brass = g;
    g = ctx.createLinearGradient(0, 0, 1280, 1280);
    g.addColorStop(0, '#64646a'); g.addColorStop(0.25, '#292a30'); g.addColorStop(0.65, '#111317'); g.addColorStop(1, '#55555c');
    grads.steel = g;
    g = ctx.createLinearGradient(0, 1280, 1280, 0);
    g.addColorStop(0, '#8b3900'); g.addColorStop(0.35, '#ff9f19'); g.addColorStop(0.7, '#ffdd68'); g.addColorStop(1, '#fff2b4');
    grads.optic = g;
    return grads;
  }
  function getFillStyle(str, grads) {
    if (!str) return null;
    str = str.trim();
    if (str === 'none') return null;
    if (str.startsWith('url(#')) {
      const m = str.match(/url\(#([^)]+)\)/);
      if (m) {
        const id = m[1];
        if (grads[id]) return grads[id];
        return null;
      }
    }
    return str;
  }
  function drawSvgSnippet(ctx, grads, snippet) {
    if (!snippet) return;
    let parser;
    try { parser = new DOMParser(); } catch (e) { return; }
    const doc = parser.parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + snippet + '</svg>', 'image/svg+xml');
    const svg = doc.documentElement;
    for (const el of svg.children) {
      const tag = (el.tagName || '').toLowerCase();
      const fillAttr = el.getAttribute('fill');
      const strokeAttr = el.getAttribute('stroke');
      const swAttr = el.getAttribute('stroke-width');
      const opacityAttr = el.getAttribute('opacity');
      const lineJoinAttr = el.getAttribute('stroke-linejoin');
      const lineCapAttr = el.getAttribute('stroke-linecap');
      const filterAttr = el.getAttribute('filter');
      let opacity = 1;
      if (opacityAttr) { const v = parseFloat(opacityAttr); if (isFinite(v)) opacity = v; }
      ctx.save();
      if (opacity < 1) ctx.globalAlpha *= opacity;
      if (filterAttr && filterAttr.includes('glow')) {
        ctx.shadowColor = 'rgba(255,180,80,0.7)';
        ctx.shadowBlur = 18;
      }
      if (tag === 'path') {
        const d = el.getAttribute('d');
        if (!d) { ctx.restore(); continue; }
        let path;
        try { path = new Path2D(d); } catch (e) { ctx.restore(); continue; }
        if (fillAttr && fillAttr !== 'none') {
          const fs = getFillStyle(fillAttr, grads);
          if (fs) { ctx.fillStyle = fs; ctx.fill(path); }
        }
        if (strokeAttr && strokeAttr !== 'none') {
          const ss = getFillStyle(strokeAttr, grads) || strokeAttr;
          ctx.strokeStyle = ss;
          ctx.lineWidth = swAttr ? parseFloat(swAttr) : 1;
          if (lineJoinAttr) ctx.lineJoin = lineJoinAttr;
          if (lineCapAttr) ctx.lineCap = lineCapAttr;
          ctx.stroke(path);
        }
      } else if (tag === 'circle') {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const r = parseFloat(el.getAttribute('r') || '0');
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        if (fillAttr && fillAttr !== 'none') {
          const fs = getFillStyle(fillAttr, grads);
          if (fs) { ctx.fillStyle = fs; ctx.fill(); }
        }
        if (strokeAttr && strokeAttr !== 'none') {
          const ss = getFillStyle(strokeAttr, grads) || strokeAttr;
          ctx.strokeStyle = ss;
          ctx.lineWidth = swAttr ? parseFloat(swAttr) : 1;
          ctx.stroke();
        }
      } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const w = parseFloat(el.getAttribute('width') || '0');
        const h = parseFloat(el.getAttribute('height') || '0');
        const rx = parseFloat(el.getAttribute('rx') || '0');
        if (rx > 0) {
          ctx.beginPath();
          const r = rx;
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
        } else {
          ctx.beginPath(); ctx.rect(x, y, w, h);
        }
        if (fillAttr && fillAttr !== 'none') {
          const fs = getFillStyle(fillAttr, grads);
          if (fs) { ctx.fillStyle = fs; ctx.fill(); }
        }
        if (strokeAttr && strokeAttr !== 'none') {
          const ss = getFillStyle(strokeAttr, grads) || strokeAttr;
          ctx.strokeStyle = ss;
          ctx.lineWidth = swAttr ? parseFloat(swAttr) : 1;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  const SR = 820;
  let SPR = { ready: false };
  let SRC = null;

  function buildVectorSource() {
    const c = mkCanvas(1280, 1280);
    const g = c.getContext('2d');
    const grads = createGradients(g);
    g.clearRect(0, 0, 1280, 1280);
    const order = ['chassis', 'eyes', 'shell', 'datum', 'chin', 'caliper', 'cheek', 'pivot'];
    const mirrored = { caliper: 1, cheek: 1, pivot: 1 };
    for (const k of order) {
      const snippet = LAYERS[k];
      if (!snippet) continue;
      drawSvgSnippet(g, grads, snippet);
      if (mirrored[k]) {
        g.save();
        g.translate(1280, 0);
        g.scale(-1, 1);
        drawSvgSnippet(g, grads, snippet);
        g.restore();
      }
    }
    return c;
  }
  function spriteFromSrc(srcCanvas, incFn, excFns) {
    const c = mkCanvas(SR, SR);
    const g = c.getContext('2d');
    g.scale(SR / 1280, SR / 1280);
    g.drawImage(srcCanvas, 0, 0, 1280, 1280);
    const applyMask = (fn) => {
      if (!fn.padding) { g.beginPath(); fn(g); g.fill(); return; }
      // Coverage only, not an artwork outline: include the source's clipped
      // caliper stroke in BOTH the moving piece and the core subtraction.
      // One composite operation avoids intersecting fill and stroke masks.
      const mask = mkCanvas(SR, SR), m = mask.getContext('2d');
      m.scale(SR / 1280, SR / 1280);
      m.beginPath(); fn(m); m.fill();
      m.lineJoin = 'round'; m.lineWidth = fn.padding * 2; m.stroke();
      g.drawImage(mask, 0, 0, 1280, 1280);
    };
    if (incFn) {
      g.globalCompositeOperation = 'destination-in';
      applyMask(incFn);
    }
    if (excFns) {
      g.globalCompositeOperation = 'destination-out';
      for (const ef of excFns) applyMask(ef);
    }
    return c;
  }
  function buildBackplate() {
    const c = mkCanvas(SR, SR);
    const g = c.getContext('2d');
    g.scale(SR / 1280, SR / 1280);
    const gr = g.createLinearGradient(0, 300, 0, 1100);
    gr.addColorStop(0, '#1d1f23'); gr.addColorStop(1, '#0d0e10');
    g.fillStyle = gr; g.beginPath(); poly(g, HULL); g.fill();
    g.clip(); // Interior hatching must not extend beyond the backplate hull.
    g.strokeStyle = '#2a2d32'; g.lineWidth = 6;
    for (let y = 420; y < 1040; y += 44) { g.beginPath(); g.moveTo(300, y); g.lineTo(980, y); g.stroke(); }
    g.fillStyle = '#0b0c0e'; g.fillRect(604, 280, 72, 300);
    g.strokeStyle = '#8a6a3a'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(612, 290); g.lineTo(612, 570); g.moveTo(668, 290); g.lineTo(668, 570); g.stroke();
    g.fillStyle = '#3a3c41';
    for (let y = 300; y < 570; y += 36) g.fillRect(622, y, 36, 6);
    return c;
  }
  function ensureSprites() {
    if (SPR.ready) return;
    const hasPath2D = typeof Path2D !== 'undefined' || typeof globalScope.Path2D !== 'undefined';
    if (!hasPath2D) { SPR.ready = false; return; }
    try {
      SRC = buildVectorSource();
      const P = (pts) => {
        const fn = (g) => poly(g, pts);
        // Diagnostic pad6 left residual slivers; pad12 covers the existing
        // source stroke (1.6125 world px) without changing SR or source art.
        fn.padding = pts === M.calL || pts === M.calR ? 12 : 0;
        return fn;
      };
      SPR.calL = spriteFromSrc(SRC, P(M.calL), [P(M.cheekL)]);
      SPR.calR = spriteFromSrc(SRC, P(M.calR), [P(M.cheekR)]);
      SPR.cheekL = spriteFromSrc(SRC, P(M.cheekL), null);
      SPR.cheekR = spriteFromSrc(SRC, P(M.cheekR), null);
      SPR.chin = spriteFromSrc(SRC, P(M.chin), null);
      SPR.crest = spriteFromSrc(SRC, P(M.crest), null);
      SPR.core = spriteFromSrc(SRC, null, [P(M.calL), P(M.calR), P(M.cheekL), P(M.cheekR), P(M.chin), P(M.crest)]);
      SPR.disc = [
        spriteFromSrc(SRC, (g) => g.arc(PIV[0].x, PIV[0].y, 57, 0, TAU), null),
        spriteFromSrc(SRC, (g) => g.arc(PIV[1].x, PIV[1].y, 57, 0, TAU), null)
      ];
      SPR.back = buildBackplate();
      SPR.ready = true;
    } catch (e) {
      console.warn('[robot-presentation] sprite build failed', e);
      SPR.ready = false;
    }
  }

  function springCoef(dt, w, z) {
    const eps = 1e-4;
    if (w < eps) return [1, 0, 0, 1];
    if (z > 1 + eps) {
      const za = -w * z, zb = w * Math.sqrt(z * z - 1), z1 = za - zb, z2 = za + zb;
      const e1 = Math.exp(z1 * dt), e2 = Math.exp(z2 * dt), inv = 1 / (2 * zb), a = e1 * inv, b = e2 * inv;
      return [a * z2 - z2 * b + e2, -a + b, (z1 * a - z2 * b + e2) * z2, -z1 * a + z2 * b];
    } else if (z < 1 - eps) {
      const wz = w * z, al = w * Math.sqrt(1 - z * z);
      const e = Math.exp(-wz * dt), c = Math.cos(al * dt), s = Math.sin(al * dt), ia = 1 / al;
      const es = e * s, ec = e * c, ews = e * wz * s * ia;
      return [ec + ews, es * ia, -es * al - wz * ews, ec - ews];
    }
    const e = Math.exp(-w * dt), te = dt * e, twe = te * w;
    return [twe + e, te, -w * twe, -twe + e];
  }
  function peakFactor(z) { if (z >= 1) return 1 / Math.E; const s = Math.sqrt(1 - z * z); return Math.exp(-z * Math.atan2(s, z) / s); }
  class Spr {
    constructor(x, w, z) { this.x = x; this.v = 0; this.g = x; this.w = w; this.z = z; this.w0 = w; this.z0 = z; }
    step(dt) { const p = springCoef(dt, this.w, this.z), o = this.x - this.g, v = this.v; this.x = o * p[0] + v * p[1] + this.g; this.v = o * p[2] + v * p[3]; }
    kick(peak) { this.v += peak * this.w / peakFactor(this.z); }
    set(w, z) { this.w = w; this.z = z; }
    reset() { this.w = this.w0; this.z = this.z0; }
    snapTo(x) { this.x = this.g = x; this.v = 0; }
  }
  const mkSpr = (w, z, x = 0) => new Spr(x, w, z);
  function createRobotSprings() {
    return {
      calTh: [mkSpr(24, .82), mkSpr(24, .82)],
      calDx: [mkSpr(24, .85), mkSpr(24, .85)],
      calDy: [mkSpr(24, .9), mkSpr(24, .9)],
      spin: [mkSpr(30, .62), mkSpr(30, .62)],
      crest: mkSpr(28, .72),
      chin: mkSpr(24, .8),
      cheekX: mkSpr(24, .85),
      cheekY: mkSpr(24, .85),
      lid: mkSpr(38, 1),
      glow: mkSpr(22, .9, 1),
      seam: mkSpr(12, 1),
      coreX: mkSpr(30, .55),
      coreY: mkSpr(30, .6),
      rootX: mkSpr(22, .6),
      rootY: mkSpr(22, .6),
      tilt: mkSpr(20, .55),
      lagX: mkSpr(16, .8),
      lagY: mkSpr(16, .8),
      gunKick: mkSpr(40, .6),
      ped: mkSpr(18, .35)
    };
  }
  const BASE = { calTh: 0, calDx: 0, calDy: 0, spin: 0, crest: 0, chin: 0, cheekX: 0, cheekY: 0, lid: 0, glow: 1, seam: 0 };
  const P_IDLE = {};
  const P_HELD = { calTh: -.05, calDx: 6 };
  const P_A1_FOCUS = { lid: .3, glow: 1.3, spin: Math.PI / 4, crest: -14, calTh: .06 };
  const P_A1_COMMIT = { calTh: .27, calDx: -8, crest: -54, chin: 12, cheekX: -10, lid: .7, glow: 1.75, spin: Math.PI / 2 };
  const P_A1_CONTACT = { calTh: -.09, calDx: 12, crest: -16, chin: -6, lid: .35, glow: 1.4, spin: Math.PI };
  const P_A2_INDEX = { calTh: .04, calDx: 34, crest: 18, lid: .26, spin: Math.PI / 4 };
  const P_A2_LOCK = { calTh: .13, calDx: 88, calDy: 10, crest: 58, chin: -22, cheekX: 24, cheekY: -20, lid: .62, glow: 1.12, spin: Math.PI / 2, seam: .45 };

  const robotStates = new Map();
  function getRobotState(fighter) {
    if (!fighter) return null;
    let st = robotStates.get(fighter.id);
    if (st) return st;
    const R = createRobotSprings();
    st = {
      id: fighter.id,
      R,
      POSE: { ...BASE },
      T: 0,
      trauma: 0,
      lockFlash: 0,
      ticks: [0, 0, 0],
      stress: [],
      pulses: [],
      parts: [],
      flashes: [],
      trail: [],
      trailOn: false,
      brackets: null,
      measure: null,
      tele: { R: 0, L: 0 },
      wallFlash: 0,
      gunFade: 1,
      gunAttachT: -9,
      contactT: -9,
      held: false,
      weaponPresent: true,
      armor: false,
      dash: null,
      extraTh: [0, 0],
      extraSpin: [0, 0],
      idleT: 4.5,
      lastPos: { x: fighter.x, y: fighter.y },
      vxw: 0, vyw: 0, ax: 0, ay: 0,
      mode: 'hold',
      Q: [],
      busyUntil: 0,
      snapUntil: 0,
      snapW: 60,
      snapZ: 0.6,
      looseUntil: 0,
      softUntil: 0,
      strainUntil: 0,
      bodyUntil: 0,
      camK: { x: mkSpr(30, .5, 0), y: mkSpr(30, .5, 0) },
      lastAim: 0,
      lastSfx: {},
      // dedup guards
      _lastLockAt: -9,
      _lastNoWeaponAt: -9,
      _lastDashAt: -9,
      _lastArmorHitAt: -9,
      _lastEndAt: -9,
      _lastMilestoneAt: -9,
      _lastUpgradeAt: -9,
    };
    for (const k in R) {
      const v = R[k];
      if (Array.isArray(v)) v.forEach(s => s.snapTo(k === 'glow' ? 1 : 0));
      else v.snapTo(k === 'glow' ? 1 : 0);
    }
    robotStates.set(fighter.id, st);
    return st;
  }
  function clearRobotStates() { robotStates.clear(); }
  function atState(st, d, fn) { st.Q.push({ t: st.T + d, fn }); }
  function setPoseState(st, p) { st.POSE = { ...BASE, ...p }; }

  const ROBOT_AUDIO_REL = {
    robot_a1_lock: 'hero-rework/robot-final/sfx/robot_a1_lock.mp3',
    robot_a1_no_weapon: 'hero-rework/robot-final/sfx/robot_a1_no_weapon.mp3',
    robot_a1_dash: 'hero-rework/robot-final/sfx/robot_a1_dash.mp3',
    robot_a2_activate: 'hero-rework/robot-final/sfx/robot_a2_activate.mp3',
    robot_a2_armor_hit: 'hero-rework/robot-final/sfx/robot_a2_armor_hit.mp3',
    robot_a2_end: 'hero-rework/robot-final/sfx/robot_a2_end.mp3',
    robot_passive_milestone: 'hero-rework/robot-final/sfx/robot_passive_milestone.mp3',
    robot_passive_upgrade: 'hero-rework/robot-final/sfx/robot_passive_upgrade.mp3',
  };
  const robotAudioBuffers = new Map();
  const robotActiveVoices = new Map();
  const robotLiveSources = new Set();
  const robotPendingTimers = new Set();
  const ROBOT_MAX_VOICES = {
    robot_a1_lock: 2,
    robot_a1_no_weapon: 2,
    robot_a1_dash: 2,
    robot_a2_activate: 1,
    robot_a2_armor_hit: 2,
    robot_a2_end: 1,
    robot_passive_milestone: 2,
    robot_passive_upgrade: 2,
  };
  function audioCtxOf() { return typeof audioCtx !== 'undefined' ? audioCtx : (globalScope.audioCtx || null); }
  const robotAudioLoading = new Map();
  const robotAudioEvidence = Object.fromEntries(Object.entries(ROBOT_AUDIO_REL).map(([event, file]) =>
    [event, { event, requested: 0, decoded: false, sourceStarted: 0, file, errors: [] }]));
  let robotAudioSession = 0;
  function loadRobotAudio() {
    const ctx = audioCtxOf();
    if (!ctx || !ctx.decodeAudioData) return Promise.resolve();
    return Promise.all(Object.entries(ROBOT_AUDIO_REL).map(([key, rel]) => {
      if (robotAudioBuffers.has(rel)) return Promise.resolve();
      if (robotAudioLoading.has(rel)) return robotAudioLoading.get(rel);
      const promise = fetch('/assets/' + rel).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.arrayBuffer();
      }).then(buf => ctx.decodeAudioData(buf)).then(buffer => {
        robotAudioBuffers.set(rel, buffer);
        robotAudioEvidence[key].decoded = true;
      }).catch(error => {
        robotAudioEvidence[key].errors.push(String(error));
      }).finally(() => robotAudioLoading.delete(rel));
      robotAudioLoading.set(rel, promise);
      return promise;
    }));
  }
  function playRobotSfx(key, opts) {
    const rel = ROBOT_AUDIO_REL[key];
    if (!rel) return;
    const evidence = robotAudioEvidence[key];
    evidence.requested++;
    // Retained as semantic-only compatibility telemetry, NEVER playback proof.
    if (globalScope.__robotSfxCounts) globalScope.__robotSfxCounts[key] = (globalScope.__robotSfxCounts[key] || 0) + 1;
    if (globalScope.__apexStatsSilent) return;
    const session = robotAudioSession;
    const requestedAt = Date.now();
    const start = () => {
      if (session !== robotAudioSession || Date.now() - requestedAt > 500) return;
      const ctx = audioCtxOf(), buffer = robotAudioBuffers.get(rel);
      if (!ctx || ctx.state !== 'running' || !buffer) return;
      const active = robotActiveVoices.get(rel) || 0;
      if (active >= (ROBOT_MAX_VOICES[key] || 2)) return;
      let src, gain;
      try {
        src = ctx.createBufferSource(); src.buffer = buffer;
        gain = ctx.createGain();
        gain.gain.setValueAtTime(opts?.vol ?? .7, ctx.currentTime);
        src.connect(gain);
        const master = (typeof battleAudioMaster !== 'undefined' && battleAudioMaster) || ctx.destination;
        gain.connect(master);
        src.onended = () => {
          robotLiveSources.delete(src);
          robotActiveVoices.set(rel, Math.max(0, (robotActiveVoices.get(rel) || 1) - 1));
          src.disconnect(); gain.disconnect();
        };
        src.start();
        evidence.sourceStarted++;
        evidence.contextState = ctx.state;
        robotActiveVoices.set(rel, active + 1);
        robotLiveSources.add(src);
        if (globalScope.apexRegisterBattleAudioSource) globalScope.apexRegisterBattleAudioSource(src);
      } catch (error) {
        evidence.errors.push(String(error));
        try { src?.disconnect(); gain?.disconnect(); } catch (_) {}
      }
    };
    if (typeof ensureBattleAudioReady === 'function') ensureBattleAudioReady();
    const ctx = audioCtxOf();
    if (!ctx) return;
    if (ctx.state === 'running' && robotAudioBuffers.has(rel)) start();
    else Promise.all([loadRobotAudio(), ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()]).then(start).catch(error => evidence.errors.push(String(error)));
  }
  function resetRobotAudioSession() {
    robotAudioSession++;
    for (const id of Array.from(robotPendingTimers)) { robotPendingTimers.delete(id); try { clearTimeout(id); } catch (e) {} }
    for (const src of Array.from(robotLiveSources)) {
      robotLiveSources.delete(src);
      try { src.onended = null; } catch (e) {}
      try { src.stop(); } catch (e) {}
      try { src.disconnect(); } catch (e) {}
    }
    robotActiveVoices.clear();
  }

  function sparksState(st, x, y, dx, dy, n, spd, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (Math.random() - .5) * spread, v = spd * (.45 + Math.random() * .8);
      st.parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: .18 + Math.random() * .2, w: 1.4 + Math.random() * 1.2 });
    }
    if (st.parts.length > 220) st.parts.splice(0, st.parts.length - 220);
  }
  function chipsState(st, x, y, dx, dy, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (Math.random() - .5) * 1.6, v = 120 + Math.random() * 180;
      st.parts.push({ k: 'chip', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, t: 0, life: .45 + Math.random() * .25, r: Math.random() * TAU, vr: (Math.random() - .5) * 20, s: 2 + Math.random() * 2 });
    }
  }
  function dustState(st, x, y, dx, dy, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (Math.random() - .5) * 1.2, v = 60 + Math.random() * 120;
      st.parts.push({ k: 'dust', x: x + (Math.random() - .5) * 20, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .3 - 10, t: 0, life: .5 + Math.random() * .3, s: 6 + Math.random() * 8 });
    }
  }
  function flashState(st, x, y, big) { st.flashes.push({ x, y, t: 0, dur: big ? .12 : .08, r: big ? 26 : 16 }); }
  function pulseState(st, pts, dur, w) { st.pulses.push({ pts, t: 0, dur, w }); }

  function calPointLocal(st, s, hx, hy) {
    const sg = s ? -1 : 1;
    const P = PIV[s];
    const th = sg * st.R.calTh[s].x;
    const c = Math.cos(th), sn = Math.sin(th);
    const px = hx - P.x, py = hy - P.y;
    return {
      x: P.x + sg * st.R.calDx[s].x + st.R.lagX.x + px * c - py * sn,
      y: P.y + st.R.calDy[s].x + st.R.lagY.x + px * sn + py * c
    };
  }
  function headToLocal(st, hx, hy) {
    const ox = (hx - 640) * HSC, oy = (hy - 600) * HSC;
    const c = Math.cos(st.R.tilt.x), s = Math.sin(st.R.tilt.x);
    return {
      x: st.R.rootX.x * HSC + ox * c - oy * s,
      y: st.R.rootY.x * HSC + ox * s + oy * c
    };
  }
  function jawWorldLocal(st) {
    const a = calPointLocal(st, 0, JAW.x, JAW.y);
    const b = calPointLocal(st, 1, 1280 - JAW.x, JAW.y);
    return [headToLocal(st, a.x, a.y), headToLocal(st, b.x, b.y)];
  }
  function heldGunLocal(st) {
    const [a, b] = jawWorldLocal(st);
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const k = st.R.gunKick.x;
    const x = mx - Math.sin(ang) * GUN_DROP + Math.cos(ang) * k;
    const y = my + Math.cos(ang) * GUN_DROP + Math.sin(ang) * k;
    return { x, y, a: ang };
  }
  function getRobotWeaponSocketWorld(fighter) {
    const st = getRobotState(fighter);
    if (!st) return null;
    const local = heldGunLocal(st);
    return { x: fighter.x + local.x, y: fighter.y + local.y, angle: local.a, local };
  }

  function impactLocal(st, s, hx, hy, dir, F, worldPt) {
    const o = 1 - s;
    const tan = { x: -dir.y, y: dir.x };
    const above = hy < PIV[s].y ? 1 : -1;
    flashState(st, worldPt.x, worldPt.y, F > 1.5);
    st.stress.push({ x: hx, y: hy, nx: dir.x, ny: dir.y, t: 0, dur: F > 1.5 ? .2 : .14, armored: st.armor });
    if (st.armor) {
      st.R.calDx[s].kick(34 * F);
      st.R.calTh[s].kick(.07 * F * above);
      st.R.spin[s].kick(.85 * F);
      st.R.rootX.kick(dir.x * 16 * F);
      st.R.rootY.kick(dir.y * 16 * F);
      st.R.crest.kick(14 * F);
      st.R.chin.kick(-6 * F);
      st.R.glow.kick(.3);
      const ps = calPointLocal(st, s, PIV[s].x, PIV[s].y);
      const po = calPointLocal(st, o, PIV[o].x, PIV[o].y);
      pulseState(st, [[hx, hy], [ps.x, ps.y], [LATCH.x, LATCH.y], [po.x, po.y]], F > 1.5 ? .26 : .17, F > 1.5 ? 14 : 10);
      atState(st, F > 1.5 ? .13 : .085, () => {
        st.R.calDx[o].kick(22 * F);
        st.R.spin[o].kick(.6 * F);
        st.R.coreX.kick(-dir.x * 6 * F);
        st.lockFlash = Math.max(st.lockFlash, .5);
      });
      sparksState(st, worldPt.x, worldPt.y, tan.x, tan.y, F > 1.5 ? 8 : 5, 340, .6);
      sparksState(st, worldPt.x, worldPt.y, -tan.x, -tan.y, F > 1.5 ? 8 : 5, 340, .6);
      if (F > 1.5) {
        chipsState(st, worldPt.x, worldPt.y, -dir.x, -dir.y, 4);
        st.strainUntil = st.T + .22;
        st.R.tilt.kick(dir.x * .05);
        atState(st, .24, () => { st.strainUntil = 0; st.snapUntil = st.T + .12; st.snapW = 70; st.snapZ = .6; st.lockFlash = 1; });
      }
    } else {
      st.looseUntil = st.T + .34;
      st.R.rootX.kick(dir.x * 120 * F);
      st.R.rootY.kick(dir.y * 90 * F);
      st.R.calTh[s].kick(-.17 * F);
      st.R.calDx[s].kick(30 * F);
      st.R.calDx[o].kick(-40 * F);
      st.R.calTh[o].kick(.08 * F);
      st.R.coreX.kick(dir.x * 24 * F);
      st.R.crest.kick(-22 * F);
      st.R.tilt.kick(dir.x * .08 * F);
      st.R.glow.kick(-.85);
      st.R.lid.kick(.5);
      sparksState(st, worldPt.x, worldPt.y, -dir.x + tan.x * .6, -dir.y + tan.y * .6, 7, 360, 1.3);
      sparksState(st, worldPt.x, worldPt.y, -dir.x - tan.x * .6, -dir.y - tan.y * .6, 5, 300, 1.3);
      chipsState(st, worldPt.x, worldPt.y, -dir.x, -dir.y, 3);
      atState(st, .34, () => {
        st.looseUntil = 0;
        st.snapUntil = st.T + .12; st.snapW = 68; st.snapZ = .62;
        st.R.spin[0].kick(.9); st.R.spin[1].kick(.9); st.lockFlash = .8;
      });
    }
  }

  function applyParamsState(st) {
    const R = st.R;
    const poseSpr = [...R.calTh, ...R.calDx, ...R.calDy, ...R.spin, R.crest, R.chin, R.cheekX, R.cheekY, R.lid];
    const looseSpr = [...R.calTh, ...R.calDx, R.crest, R.coreX, R.tilt];
    for (const s of poseSpr) s.reset();
    R.coreX.reset(); R.tilt.reset();
    if (st.T < st.softUntil) for (const s of poseSpr) s.set(15, .8);
    if (st.T < st.snapUntil) for (const s of poseSpr) s.set(st.snapW, st.snapZ);
    if (st.T < st.strainUntil) for (const s of [...R.calDx, ...R.calTh]) s.set(17, .42);
    if (st.T < st.looseUntil) for (const s of looseSpr) s.set(14, .3);
    if (st.T >= st.bodyUntil && st.mode === 'hold') { R.rootX.reset(); R.rootY.reset(); }
  }

  function updateRobotState(fighter, dt) {
    const st = getRobotState(fighter);
    if (!st) return;
    st.T += dt;
    for (let i = 0; i < st.Q.length; i++) {
      if (st.Q[i].t <= st.T) { const fn = st.Q[i].fn; st.Q.splice(i, 1); i--; try { fn(); } catch (e) {} }
    }
    applyParamsState(st);

    const px = st.lastPos.x, py = st.lastPos.y;
    const nvx = (fighter.x - px) / dt;
    const nvy = (fighter.y - py) / dt;
    st.ax = mix(st.ax, (nvx - st.vxw) / dt, .2);
    st.ay = mix(st.ay, (nvy - st.vyw) / dt, .2);
    st.vxw = nvx; st.vyw = nvy;
    st.lastPos.x = fighter.x; st.lastPos.y = fighter.y;

    let dashing = false;
    let dashStore = null;
    try {
      const ct = globalScope.APEX_HERO_REWORK && globalScope.APEX_HERO_REWORK.byCombatant ? globalScope.APEX_HERO_REWORK.byCombatant(fighter) : null;
      if (ct && ct.store && ct.store['robot.weapon_dash'] && ct.store['robot.weapon_dash'].dash) {
        dashing = !!ct.store['robot.weapon_dash'].dash.launched;
        dashStore = ct.store['robot.weapon_dash'].dash;
      }
    } catch (e) {}
    if (dashing && dashStore) {
      st.mode = 'dash';
      const heading = dashStore.heading;
      const curH = st.lastDashHeading == null ? heading : st.lastDashHeading;
      st.lastDashHeading = heading;
      const dh = wrapA(heading - curH);
      const turnN = clamp(dh / dt / 4, -1, 1);
      st.extraTh = [turnN * .11, -turnN * .11];
      st.extraSpin = [turnN * .6, -turnN * .6];
    } else {
      st.mode = 'hold';
      st.extraTh[0] = mix(st.extraTh[0], 0, .2);
      st.extraTh[1] = mix(st.extraTh[1], 0, .2);
      st.extraSpin[0] = mix(st.extraSpin[0], 0, .2);
      st.extraSpin[1] = mix(st.extraSpin[1], 0, .2);
    }

    st.R.lagX.g = clamp(-st.ax * .0016 - (dashing ? st.vxw * .009 : 0), -46, 46);
    st.R.lagY.g = clamp(-st.ay * .0016 - (dashing ? st.vyw * .009 : 0), -40, 40);
    st.R.tilt.g = dashing ? clamp(st.extraTh[0] / .11 * .05, -.06, .06) : 0;

    for (let s = 0; s < 2; s++) {
      st.R.calTh[s].g = (st.POSE.calTh || 0) + st.extraTh[s];
      st.R.calDx[s].g = st.POSE.calDx || 0;
      st.R.calDy[s].g = st.POSE.calDy || 0;
      st.R.spin[s].g = (st.POSE.spin || 0) + st.extraSpin[s];
    }
    st.R.crest.g = st.POSE.crest || 0;
    st.R.chin.g = st.POSE.chin || 0;
    st.R.cheekX.g = st.POSE.cheekX || 0;
    st.R.cheekY.g = st.POSE.cheekY || 0;
    st.R.lid.g = st.POSE.lid || 0;
    st.R.glow.g = st.POSE.glow != null ? st.POSE.glow : 1;
    st.R.seam.g = st.POSE.seam || 0;

    for (const k in st.R) {
      const v = st.R[k];
      if (Array.isArray(v)) v.forEach(s => s.step(dt));
      else v.step(dt);
    }
    st.camK.x.step(dt); st.camK.y.step(dt);

    st.lockFlash *= Math.exp(-dt * 12);
    for (let i = 0; i < 3; i++) st.ticks[i] *= Math.exp(-dt * 6);
    st.tele.R *= Math.exp(-dt * 9);
    st.tele.L *= Math.exp(-dt * 9);
    st.wallFlash *= Math.exp(-dt * 7);
    st.gunFade = Math.min(1, st.gunFade + dt * 3.5);

    for (let i = st.parts.length - 1; i >= 0; i--) {
      const q = st.parts[i]; q.t += dt;
      if (q.t >= q.life) { st.parts.splice(i, 1); continue; }
      if (q.k === 'spark') { q.vy += 520 * dt; q.vx *= 1 - 2 * dt; }
      else if (q.k === 'chip' || q.k === 'case') { q.vy += 900 * dt; q.r += q.vr * dt; }
      else if (q.k === 'dust') { q.vx *= 1 - 3 * dt; q.vy *= 1 - 3 * dt; }
      q.x += q.vx * dt; q.y += q.vy * dt;
    }
    for (let i = st.flashes.length - 1; i >= 0; i--) { st.flashes[i].t += dt; if (st.flashes[i].t >= st.flashes[i].dur) st.flashes.splice(i, 1); }
    for (let i = st.pulses.length - 1; i >= 0; i--) { st.pulses[i].t += dt; if (st.pulses[i].t >= st.pulses[i].dur) st.pulses.splice(i, 1); }
    for (let i = st.stress.length - 1; i >= 0; i--) { st.stress[i].t += dt; if (st.stress[i].t >= st.stress[i].dur) st.stress.splice(i, 1); }

    if (st.trailOn && dashing) st.trail.push({ x: fighter.x, y: fighter.y, t: st.T });
    if (st.trail.length > 400) st.trail.shift();
    if (!st.trailOn && st.trail.length) {
      if (st.T - (st.trail[st.trail.length - 1]?.t || 0) > 0.6) st.trail.shift();
    }

    st.idleT -= dt;
    if (st.idleT <= 0) {
      st.idleT = 3.6 + Math.random() * 3.6;
      if (!st.armor && st.mode === 'hold') {
        const r = Math.random();
        if (r < .4) { const d = (Math.random() < .5 ? 1 : -1) * .09; st.R.spin[0].kick(d); st.R.spin[1].kick(d); }
        else if (r < .72) { const b = st.POSE.lid, up = b + .16; st.POSE.lid = up; atState(st, .17, () => { if (st.POSE.lid === up) st.POSE.lid = b; }); }
        else { st.R.calDx[Math.random() < .5 ? 0 : 1].kick(5); }
      }
    }
    // NOTE: A2 expiry is authoritative in mechanics (RobotA2End). Presentation does NOT emit its own end.
  }

  // Golden-master rig: head-local geometry, stress and routing pulses.
  // The sole head→fighter transform is below; particles remain world-owned.
  function renderRobotLocal(ctx, fighter, st) {
    ensureSprites();
    if (!SPR.ready) return;
    const { R, ticks, lockFlash, pulses, stress } = st;
    const pivotNow = side => calPointLocal(st, side, PIV[side].x, PIV[side].y);
    const EYE = [new Path2D('M404 675 Q475 711 558 752 L540 795 Q476 781 419 732 Z'), new Path2D('M876 675 Q805 711 722 752 L740 795 Q804 781 861 732 Z')];
    const SOCK = [new Path2D('M373 653 Q465 686 563 741 L586 808 505 833 Q423 800 379 762 Z'), new Path2D('M907 653 Q815 686 717 741 L694 808 775 833 Q857 800 901 762 Z')];
function partialLine(g, pts, f0, f1) {
  const seg = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
  const a = clamp(f0, 0, 1) * total, b = clamp(f1, 0, 1) * total;
  if (b <= a) return;
  let acc = 0, started = false;
  g.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const s0 = acc, s1 = acc + seg[i - 1];
    const x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1];
    if (s1 >= a && s0 <= b) {
      const ta = clamp((a - s0) / seg[i - 1], 0, 1), tb = clamp((b - s0) / seg[i - 1], 0, 1);
      if (!started) { g.moveTo(mix(x0, x1, ta), mix(y0, y1, ta)); started = true; }
      g.lineTo(mix(x0, x1, tb), mix(y0, y1, tb));
    }
    acc = s1;
  }
  g.stroke();
}
function drawEyes(g) {
  const lid = clamp(R.lid.x, 0, 1), gl = Math.max(0, R.glow.x);
  for (let s = 0; s < 2; s++) {
    const cx = s ? 798 : 482;
    g.save(); g.clip(EYE[s]);
    if (gl > 1.01) {
      g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(cx, 742, 6, cx, 742, 130);
      rg.addColorStop(0, 'rgba(255,240,196,' + clamp((gl - 1) * .95, 0, 1) + ')');
      rg.addColorStop(.55, 'rgba(255,170,60,' + clamp((gl - 1) * .5, 0, 1) + ')');
      rg.addColorStop(1, 'rgba(255,140,40,0)');
      g.fillStyle = rg; g.fillRect(cx - 150, 620, 300, 220);
    } else if (gl < .99) {
      g.fillStyle = 'rgba(18,10,4,' + clamp((1 - gl) * .9, 0, .92) + ')'; g.fillRect(cx - 150, 620, 300, 220);
    }
    g.restore();
    if (lid > .01) {
      const sg = s ? -1 : 1, y = mix(688, 792, lid), x0 = cx - 160, x1 = cx + 160;
      const y0 = y + (x0 - cx) * .5 * sg, y1 = y + (x1 - cx) * .5 * sg;
      g.save(); g.clip(SOCK[s]);
      const lg = g.createLinearGradient(0, 600, 0, y + 40);
      lg.addColorStop(0, '#0c0d0f'); lg.addColorStop(1, '#23262a');
      g.fillStyle = lg;
      g.beginPath(); g.moveTo(x0, 560); g.lineTo(x1, 560); g.lineTo(x1, y1); g.lineTo(x0, y0); g.closePath(); g.fill();
      g.strokeStyle = '#9a968d'; g.lineWidth = 6;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.restore();
    }
  }
}
function drawTicks(g) {
  if (ticks[0] + ticks[1] + ticks[2] < .02) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  [559, 602, 649].forEach((y, i) => {
    if (ticks[i] < .02) return;
    g.strokeStyle = 'rgba(255,196,110,' + ticks[i] + ')'; g.lineWidth = 12;
    g.beginPath(); g.moveTo(606, y); g.lineTo(674, y); g.stroke();
  });
  g.restore();
}
function drawStruts(g) {
  for (let s = 0; s < 2; s++) {
    const a = { x: s ? 852 : 428, y: 700 }, p = pivotNow(s);
    const dx = p.x - a.x, dy = p.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    g.lineCap = 'butt';
    g.strokeStyle = '#1f2226'; g.lineWidth = 34;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x + ux * L * .55, a.y + uy * L * .55); g.stroke();
    g.strokeStyle = '#6e7177'; g.lineWidth = 13;
    g.beginPath(); g.moveTo(a.x + ux * L * .45, a.y + uy * L * .45); g.lineTo(p.x, p.y); g.stroke();
    g.strokeStyle = '#9c7a44'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(a.x + ux * L * .55 - uy * 17, a.y + uy * L * .55 + ux * 17); g.lineTo(a.x + ux * L * .55 + uy * 17, a.y + uy * L * .55 - ux * 17); g.stroke();
  }
}
function renderRig(g) {
  g.drawImage(SPR.back, 0, 0, 1280, 1280);
  drawStruts(g);
  // crest: slides in its slot (extends to sight, seats to brace)
  g.save(); g.beginPath(); poly(g, SLOT); g.clip();
  g.translate(R.coreX.x * .8, R.crest.x + R.coreY.x * .6);
  g.drawImage(SPR.crest, 0, 0, 1280, 1280);
  if (lockFlash > .02) {
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,214,140,' + lockFlash * .85 + ')'; g.fillRect(620, 298, 41, 116);
  }
  g.restore();
  // core (stable anchor)
  g.save(); g.translate(R.coreX.x, R.coreY.x);
  g.drawImage(SPR.core, 0, 0, 1280, 1280);
  drawEyes(g); drawTicks(g);
  g.restore();
  // chin
  g.save(); g.translate(R.lagX.x * .35, R.chin.x + R.calDy[0].x * .3 + R.lagY.x * .5);
  g.drawImage(SPR.chin, 0, 0, 1280, 1280); g.restore();
  // cheeks
  for (let s = 0; s < 2; s++) {
    g.save(); g.translate((s ? -1 : 1) * R.cheekX.x + R.lagX.x * .6, R.cheekY.x + R.lagY.x * .6);
    g.drawImage(s ? SPR.cheekR : SPR.cheekL, 0, 0, 1280, 1280); g.restore();
  }
  // calipers + pivot discs (hierarchy: caliper → disc)
  for (let s = 0; s < 2; s++) {
    const sg = s ? -1 : 1, P = PIV[s];
    g.save();
    g.translate(P.x + sg * R.calDx[s].x + R.lagX.x, P.y + R.calDy[s].x + R.lagY.x);
    g.rotate(sg * R.calTh[s].x);
    g.translate(-P.x, -P.y);
    g.drawImage(s ? SPR.calR : SPR.calL, 0, 0, 1280, 1280);
    const seam = clamp(R.seam.x, 0, 1);
    if (seam > .02) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(255,178,80,' + seam * .85 + ')'; g.lineWidth = 8;
      g.beginPath();
      const pts = s ? mir(SEAM) : SEAM;
      g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
      g.lineWidth = 10; g.beginPath(); g.arc(P.x, P.y, 68, 0, TAU); g.stroke();
      g.restore();
    }
    g.save(); g.translate(P.x, P.y); g.rotate(sg * R.spin[s].x); g.translate(-P.x, -P.y);
    g.drawImage(SPR.disc[s], 0, 0, 1280, 1280);
    g.restore();
    if (lockFlash > .02) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(P.x, P.y, 10, P.x, P.y, 110);
      rg.addColorStop(0, 'rgba(255,226,160,' + lockFlash * .9 + ')'); rg.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = rg; g.fillRect(P.x - 110, P.y - 110, 220, 220);
      g.restore();
    }
    g.restore();
  }
  // force-routing pulses
  if (pulses.length) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const p of pulses) {
      const f = p.t / p.dur, e = 1 - Math.pow(1 - f, 2);
      g.strokeStyle = 'rgba(255,160,60,' + (.35 * (1 - f)) + ')'; g.lineWidth = p.w * 2.2;
      partialLine(g, p.pts, 0, e);
      g.strokeStyle = 'rgba(255,236,196,' + (1 - f * .6) + ')'; g.lineWidth = p.w;
      partialLine(g, p.pts, e - .28, e);
    }
    g.restore();
  }
  // local stress at the real hit point
  for (const m of stress) {
    const f = m.t / m.dur, a = 1 - f;
    g.save(); g.globalCompositeOperation = 'lighter';
    const rg = g.createRadialGradient(m.x, m.y, 2, m.x, m.y, 70);
    rg.addColorStop(0, 'rgba(255,248,226,' + a + ')'); rg.addColorStop(.4, m.armored ? 'rgba(255,176,70,' + a * .7 + ')' : 'rgba(255,220,180,' + a * .5 + ')'); rg.addColorStop(1, 'rgba(255,150,50,0)');
    g.fillStyle = rg; g.fillRect(m.x - 70, m.y - 70, 140, 140);
    g.strokeStyle = 'rgba(255,244,220,' + a + ')'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(m.x - m.ny * 46, m.y + m.nx * 46); g.lineTo(m.x + m.ny * 46, m.y - m.nx * 46); g.stroke();
    g.restore();
  }
}


    ctx.save();
    ctx.translate(R.rootX.x * HSC, R.rootY.x * HSC);
    ctx.rotate(R.tilt.x); // HTML internal tilt only, never fighter heading
    ctx.scale(HSC, HSC);
    ctx.translate(-640, -600);
    renderRig(ctx);
    ctx.restore();
  }

  // Body-only wrapper used by Mirror's wrong-person reflection. It draws the
  // live Robot rig at a caller-supplied world root without entering Fighter.draw,
  // advancing Robot state, or duplicating status/world effects.
  function renderActorImage(ctx, fighter, x, y) {
    if (!ctx || !isRobotFighter(fighter)) return false;
    const st = getRobotState(fighter);
    if (!st) return false;
    ensureSprites();
    if (!SPR.ready) return false;
    ctx.save();
    try {
      if (fighter.hasStatus && fighter.hasStatus('immune')) ctx.globalAlpha *= 0.55;
      ctx.translate(Number.isFinite(x) ? x : fighter.x, Number.isFinite(y) ? y : fighter.y);
      if (fighter.isRage) {
        const glow = fighter.color || '#ffffff';
        try { ctx.filter = `drop-shadow(0 0 5px ${glow}) drop-shadow(0 0 11px ${glow})`; } catch (error) {}
      }
      renderRobotLocal(ctx, fighter, st);
    } finally {
      if (fighter.isRage) { try { ctx.filter = 'none'; } catch (error) {} }
      ctx.restore();
    }
    return true;
  }

  // World-space: brackets, measure, trail with calibration ticks (authority)
  function renderRobotWorld(ctx, fighter, st) {
  for (const f of st.flashes) {
    const a = 1 - f.t / f.dur;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
    const rg = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, f.r);
    rg.addColorStop(0, 'rgba(255,250,232,1)'); rg.addColorStop(.35, 'rgba(255,200,120,.6)'); rg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = rg; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    ctx.restore();
  }
  for (const q2 of st.parts) {
    const a = 1 - q2.t / q2.life;
    if (q2.k === 'spark') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,' + (190 + (a * 60 | 0)) + ',120,' + a + ')'; ctx.lineWidth = q2.w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q2.x - q2.vx * .02, q2.y - q2.vy * .02); ctx.lineTo(q2.x, q2.y); ctx.stroke(); ctx.restore();
    } else if (q2.k === 'chip') {
      ctx.save(); ctx.translate(q2.x, q2.y); ctx.rotate(q2.r); ctx.globalAlpha = a;
      ctx.fillStyle = '#d9d2c3'; ctx.fillRect(-q2.s / 2, -q2.s / 2, q2.s, q2.s * .6); ctx.restore();
    } else if (q2.k === 'case') {
      ctx.save(); ctx.translate(q2.x, q2.y); ctx.rotate(q2.r); ctx.globalAlpha = a;
      ctx.fillStyle = '#d6a052'; ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
    } else if (q2.k === 'dust') {
      ctx.fillStyle = 'rgba(120,118,110,' + a * .28 + ')'; ctx.beginPath(); ctx.arc(q2.x, q2.y, q2.s * (1 + q2.t * 2), 0, TAU); ctx.fill();
    }
  }
    // Brackets — elastic easing from HTML authority, adapted to target pickup
    if (st.brackets) {
      let gap, alpha;
      const t = st.T - st.brackets.t0;
      if (st.brackets.state === 'in') {
        const f = clamp(t / .12, 0, 1), s = 1.7, e = 1 + (s + 1) * Math.pow(f - 1, 3) + s * Math.pow(f - 1, 2);
        gap = mix(88, 62, e); alpha = clamp(t / .05, 0, 1);
      } else {
        const f = clamp((st.T - st.brackets.t1) / .1, 0, 1);
        gap = mix(62, 26, f); alpha = 1 - f;
        if (f >= 1) { st.brackets = null; }
      }
      if (st.brackets && alpha > .01) {
        const target = st.brackets.target || { x: fighter.x + Math.cos(fighter.dir ? Math.atan2(fighter.dir.y, fighter.dir.x) : 0) * 120, y: fighter.y };
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (const sg of [-1, 1]) {
          // For vertical brackets in game, we use gap as horizontal offset from target
          // But to preserve authority look, we draw brackets around target in world space
          // Authority: x = WPN.x + sg*gap, y = WPN.y
          // Adapted: target.x + sg*gap, target.y
          const x = target.x + sg * gap * 0.6;
          const y = target.y;
          const pts = [[x - sg * 12, y - 20], [x, y - 20], [x + sg * 6, y - 12], [x + sg * 6, y + 12], [x, y + 20], [x - sg * 12, y + 20]];
          ctx.strokeStyle = '#08090a'; ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
          ctx.strokeStyle = '#ece6d8'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
          ctx.fillStyle = '#ffb64e';
          ctx.beginPath(); ctx.arc(x - sg * 12, y - 20, 2.6, 0, TAU); ctx.arc(x - sg * 12, y + 20, 2.6, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }

    // Measure — line from robot latch/head to target
    if (st.measure && !st.held) {
      const t = st.T - st.measure.t0;
      if (t > .34) { st.measure = null; }
      else {
        const p = clamp(t / .08, 0, 1), a = t < .16 ? 1 : 1 - (t - .16) / .18;
        const s = { x: fighter.x, y: fighter.y - fighter.radius * 0.8 };
        const e = st.brackets && st.brackets.target ? st.brackets.target : { x: fighter.x + 120, y: fighter.y };
        const ex = mix(s.x, e.x, p), ey = mix(s.y, e.y, p);
        ctx.save();
        ctx.globalAlpha = a * .8;
        ctx.strokeStyle = '#e1a852'; ctx.lineWidth = 1.5;
        if (ctx.setLineDash) ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(ex, ey); ctx.stroke();
        if (ctx.setLineDash) ctx.setLineDash([]);
        const dx = e.x - s.x, dy = e.y - s.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
        ctx.strokeStyle = '#efe7d6'; ctx.lineWidth = 1.5;
        for (const f of [.25, .5, .75]) {
          if (f > p) continue;
          const x = mix(s.x, e.x, f), y = mix(s.y, e.y, f);
          ctx.beginPath(); ctx.moveTo(x - nx * 5, y - ny * 5); ctx.lineTo(x + nx * 5, y + ny * 5); ctx.stroke();
        }
        ctx.restore();
      }
    }

    // Trail with calibration ticks — authority logic
    if (st.trail.length >= 2) {
      const fade = st.trailOn ? (isFinite(st.contactT) && st.T > st.contactT ? clamp(1 - (st.T - st.contactT) / .5, 0, 1) : 1) : 0;
      if (fade <= 0) { if (!st.trailOn) st.trail = []; }
      else {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const n = st.trail.length;
        for (let i = 1; i < n; i++) {
          const a = st.trail[i - 1], b = st.trail[i], k = i / n;
          const w = mix(1, 6, k);
          ctx.strokeStyle = 'rgba(224,160,70,' + (.22 * fade) + ')'; ctx.lineWidth = w * 2.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        for (let i = 1; i < n; i++) {
          const a = st.trail[i - 1], b = st.trail[i], k = i / n;
          ctx.strokeStyle = 'rgba(246,222,176,' + (.85 * fade) + ')'; ctx.lineWidth = mix(.8, 2.6, k);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        let acc = 0, next = 40;
        ctx.strokeStyle = 'rgba(236,230,216,' + (.6 * fade) + ')'; ctx.lineWidth = 1.6;
        for (let i = 1; i < n; i++) {
          const a = st.trail[i - 1], b = st.trail[i], l = Math.hypot(b.x - a.x, b.y - a.y);
          while (l > 0 && acc + l >= next) {
            const f = (next - acc) / l, x = mix(a.x, b.x, f), y = mix(a.y, b.y, f), nx = -(b.y - a.y) / l, ny = (b.x - a.x) / l;
            ctx.beginPath(); ctx.moveTo(x - nx * 6, y - ny * 6); ctx.lineTo(x + nx * 6, y + ny * 6); ctx.stroke();
            next += 40;
          }
          acc += l;
        }
        ctx.restore();
      }
    }
  }

  function isRobotFighter(f) {
    if (!f) return false;
    if (f.type && f.type.__hrHero === 'ROBOT') return true;
    if (f.name === 'ROBOT') return true;
    try {
      const ct = globalScope.APEX_HERO_REWORK && globalScope.APEX_HERO_REWORK.byCombatant ? globalScope.APEX_HERO_REWORK.byCombatant(f) : null;
      if (ct && ct.heroId === 'ROBOT') return true;
    } catch (e) {}
    return false;
  }

  // Single-dispatch bus handler
  function handleBusEvent(e) {
    if (!e) return;
    const type = e.type;
    const payload = e.payload || {};
    const isAlias = payload && payload.alias === true;

    if (type === 'Cast') {
      // Cast is NOT authoritative for presentation SFX — authoritative is RobotA1Lock / RobotA2Start
      // We only use Cast for pose fallback if needed, but do NOT play SFX here to avoid duplicate
      if (payload.hero === 'ROBOT' && payload.slot === 'A1') {
        // No SFX here; lock will be handled by RobotA1Lock
        const fighters = globalScope.fighters || [];
        for (const f of fighters) {
          if (!isRobotFighter(f)) continue;
          const st = getRobotState(f);
          if (!st) continue;
          // Avoid double if lock already handled
          if (st.T - st._lastLockAt < 0.1) continue;
        }
      } else if (payload.hero === 'ROBOT' && payload.slot === 'A2') {
        // No SFX here; activate handled by RobotA2Start
      }
    } else if (type === 'CastFailCue') {
      if (payload.hero === 'ROBOT' && payload.slot === 'A1') {
        const src = payload.source;
        if (src === 'p2-ai') return; // P2 silent
        const fighters = globalScope.fighters || [];
        for (const f of fighters) {
          if (!isRobotFighter(f)) continue;
          if (src && src !== 'p1' && src !== 'gates' && src !== 'p1-presentation-test') {
            if (f !== fighters[0]) continue;
          }
          const st = getRobotState(f);
          if (!st) continue;
          if (st.T - st._lastNoWeaponAt < 0.35) continue;
          // Do NOT play SFX here — emit authoritative NoWeapon event once
          const bus = globalScope.APEX_HERO_REWORK && globalScope.APEX_HERO_REWORK.AIL && globalScope.APEX_HERO_REWORK.AIL.bus;
          if (bus) {
            bus.emit('RobotA1NoWeapon', { hero: 'ROBOT', fighterId: f.id });
            bus.emit('RobotA1NoTarget', { hero: 'ROBOT', fighterId: f.id, source: src, alias: true });
          }
        }
      }
    } else if (type === 'RealizedDamageEvent') {
      const fighters = globalScope.fighters || [];
      const H = globalScope.APEX_HERO_REWORK;
      const extra = H && H.extraLivingBodies ? H.extraLivingBodies() : [];
      const all = fighters.concat(extra);
      for (const f of all) {
        if (!f || f.id !== payload.victim) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        if (st.armor) {
          // Armor hit SFX is authoritative via RobotA2Hit only — do NOT play here
          continue;
        }
        const amount = payload.amount || 0;
        const F = amount > 80 ? 2 : 1;
        let dir = { x: 1, y: 0 };
        try {
          if (payload.creditedTo) {
            const enemy = fighters.find(ff => ff.id !== f.id);
            if (enemy) {
              const dx = f.x - enemy.x, dy = f.y - enemy.y;
              const mag = Math.hypot(dx, dy) || 1;
              dir = { x: dx / mag, y: dy / mag };
            }
          }
        } catch (e) {}
        const hitHx = 640 - dir.x * 406;
        const hitHy = 600 - dir.y * 200;
        const local = headToLocal(st, hitHx, hitHy);
        const worldPt = { x: f.x + local.x, y: f.y + local.y };
        const s = dir.x > 0 ? 0 : 1;
        impactLocal(st, s, hitHx, hitHy, dir, F, worldPt);
      }
    } else if (type === 'RobotA1Lock') {
      if (isAlias) return; // alias no SFX
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.fighterId && f.id !== payload.fighterId) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        if (st.T - st._lastLockAt < 0.15) continue; // dedup
        st._lastLockAt = st.T;
        playRobotSfx('robot_a1_lock', { vol: 0.75 });
        setPoseState(st, P_A1_FOCUS);
        st.snapUntil = st.T + .1; st.snapW = 46; st.snapZ = .75;
        st.brackets = { t0: st.T, state: 'in' };
        st.measure = { t0: st.T };
        try {
          const ct = globalScope.APEX_HERO_REWORK && globalScope.APEX_HERO_REWORK.byCombatant ? globalScope.APEX_HERO_REWORK.byCombatant(f) : null;
          if (ct && ct.store && ct.store['robot.weapon_dash'] && ct.store['robot.weapon_dash'].dash) {
            const dash = ct.store['robot.weapon_dash'].dash;
            const api = globalScope.APEX_HERO_REWORK && globalScope.APEX_HERO_REWORK.match && globalScope.APEX_HERO_REWORK.match.api;
            const slot = api && api.revealedSlotById ? api.revealedSlotById(dash.targetSlotId) : null;
            if (slot) st.brackets.target = { x: slot.x, y: slot.y };
          } else if (payload.slotId != null) {
            const api = globalScope.APEX_HERO_REWORK && globalScope.APEX_HERO_REWORK.match && globalScope.APEX_HERO_REWORK.match.api;
            const slot = api && api.revealedSlotById ? api.revealedSlotById(payload.slotId) : null;
            if (slot) st.brackets.target = { x: slot.x, y: slot.y };
          }
        } catch (ex) {}
        atState(st, .13, () => {
          setPoseState(st, P_A1_COMMIT);
          st.snapUntil = st.T + .14; st.snapW = 64; st.snapZ = .56;
          st.lockFlash = 1;
        });
      }
    } else if (type === 'RobotA1Acquire') {
      // alias — no SFX
      return;
    } else if (type === 'RobotA1NoWeapon') {
      if (isAlias) {
        // still authoritative? No, RobotA1NoWeapon is authoritative, but check alias flag
        // In our case, we emit without alias, so allow
      }
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.fighterId && f.id !== payload.fighterId) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        if (st.T - st._lastNoWeaponAt < 0.35) continue;
        st._lastNoWeaponAt = st.T;
        st.lastSfx.robot_a1_no_weapon = st.T;
        playRobotSfx('robot_a1_no_weapon', { vol: 0.65 });
        setPoseState(st, { ... (st.held ? P_HELD : P_IDLE), lid: .3, glow: 1.2, spin: Math.PI / 4, crest: -18, calTh: (st.held ? -.05 : 0) + .08 });
        atState(st, .32, () => { setPoseState(st, st.held ? P_HELD : P_IDLE); st.R.glow.kick(-.25); });
      }
    } else if (type === 'RobotA1NoTarget') {
      // alias for telemetry — no SFX (already handled by NoWeapon)
      return;
    } else if (type === 'RobotA1DashLaunch') {
      if (isAlias) return;
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.fighterId && f.id !== payload.fighterId) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        if (st.T - st._lastDashAt < 0.15) continue;
        st._lastDashAt = st.T;
        playRobotSfx('robot_a1_dash', { vol: 0.78 });
        st.trail = [{ x: f.x, y: f.y, t: st.T }];
        st.contactT = Infinity;
        st.trailOn = true;
        st.lastDashHeading = null;
        const cast = st._lastLockAt;
        // Miss/timeout cleanup does not manufacture equip/contact truth.
        atState(st, .55 + .55, () => {
          if (st._lastLockAt !== cast) return;
          st.trailOn = false; st.trail = [];
          if (!Number.isFinite(st.contactT)) {
            setPoseState(st, st.armor ? P_A2_LOCK : st.held ? P_HELD : P_IDLE);
            st.brackets = null;
          }
        });
      }
    } else if (type === 'RobotA1Dash') {
      // alias — no SFX
      return;
    } else if (type === 'RobotA1Contact') {
      if (isAlias) return;
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.fighterId && f.id !== payload.fighterId) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        // Only after real equip truth — held becomes true here
        st.held = true;
        setPoseState(st, P_A1_CONTACT);
        st.snapUntil = st.T + .12; st.snapW = 72; st.snapZ = .5;
        const cast = st._lastLockAt;
        atState(st, .2, () => {
          if (st._lastLockAt === cast && !st.armor) setPoseState(st, { ...P_HELD, spin: Math.PI });
        });
        atState(st, .55, () => {
          if (st._lastLockAt === cast) { st.trailOn = false; st.trail = []; }
        });
        atState(st, 2, () => {
          if (st._lastLockAt !== cast || st.armor || st.POSE.spin !== Math.PI) return;
          st.POSE.spin = 0;
          for (const spring of st.R.spin) { spring.x -= Math.PI; spring.g -= Math.PI; }
        });
        st.gunFade = 0;
        st.gunAttachT = st.T;
        st.contactT = st.T;
        st.R.gunKick.kick(-14);
        st.R.rootX.kick(-18);
        st.lockFlash = 1;
        for (const [i, jaw] of jawWorldLocal(st).entries()) {
          sparksState(st, f.x + jaw.x, f.y + jaw.y, i ? 1 : -1, -.2, 6, 320, .7);
          flashState(st, f.x + jaw.x, f.y + jaw.y, false);
        }
        if (st.brackets) { st.brackets.state = 'out'; st.brackets.t1 = st.T; }
      }
    } else if (type === 'RobotA2Start') {
      if (isAlias) return;
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.fighterId && f.id !== payload.fighterId) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        playRobotSfx('robot_a2_activate', { vol: 0.78 });
        setPoseState(st, { ...P_A2_INDEX, ...(st.held ? { calTh: -.02 } : {}) });
        atState(st, .16, () => {
          st.armor = true;
          setPoseState(st, P_A2_LOCK);
          st.snapUntil = st.T + .16; st.snapW = 66; st.snapZ = .6;
          st.R.seam.snapTo(1);
          st.lockFlash = 1;
          const ps = calPointLocal(st, 0, PIV[0].x, PIV[0].y);
          const po = calPointLocal(st, 1, PIV[1].x, PIV[1].y);
          pulseState(st, [[LATCH.x, LATCH.y], [520, 420], [ps.x, ps.y]], .2, 10);
          pulseState(st, [[LATCH.x, LATCH.y], [760, 420], [po.x, po.y]], .2, 10);
        });
      }
    } else if (type === 'RobotA2Activate') {
      // alias — no SFX
      return;
    } else if (type === 'RobotA2Hit') {
      if (isAlias) return;
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.bodyId && payload.bodyId !== f.id) continue;
        if (payload.fighterId && payload.fighterId !== f.id) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        if (!st.armor) continue;
        // Dedup per actual damage event — use timestamp
        if (st.T - st._lastArmorHitAt < 0.05) continue; // allow rapid automatic hits but not duplicate dispatch from same event
        st._lastArmorHitAt = st.T;
        playRobotSfx('robot_a2_armor_hit', { vol: 0.72 });
        // Visual impact for armor hit
        const amount = payload.amount || 20;
        const F = amount > 80 ? 2 : 1;
        const dir = payload.direction;
        if (!dir || !Number.isFinite(dir.x) || !Number.isFinite(dir.y)) continue;
        // Force travels INTO the victim; the entry side is opposite that vector.
        const s = dir.x > 0 ? 0 : 1;
        const cp = calPointLocal(st, s, s ? 1046 : 234, 470);
        const hx = cp.x, hy = cp.y;
        const local = headToLocal(st, hx, hy);
        const worldPt = { x: f.x + local.x, y: f.y + local.y };
        impactLocal(st, s, hx, hy, dir, F, worldPt);
      }
    } else if (type === 'RobotA2ArmorHit') {
      // alias — no SFX
      return;
    } else if (type === 'RobotA2End') {
      if (isAlias) return;
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.fighterId && f.id !== payload.fighterId) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        if (st.T - st._lastEndAt < 0.2) continue;
        st._lastEndAt = st.T;
        st.armor = false;
        setPoseState(st, st.held ? P_HELD : P_IDLE);
        st.softUntil = st.T + .55;
        playRobotSfx('robot_a2_end', { vol: 0.75 });
        const ps = calPointLocal(st, 0, PIV[0].x, PIV[0].y);
        const po = calPointLocal(st, 1, PIV[1].x, PIV[1].y);
        pulseState(st, [[ps.x, ps.y], [520, 420], [LATCH.x, LATCH.y]], .22, 6);
        pulseState(st, [[po.x, po.y], [760, 420], [LATCH.x, LATCH.y]], .22, 6);
      }
    } else if (type === 'RobotPassiveMilestone') {
      if (isAlias) return;
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.fighterId && f.id !== payload.fighterId) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        if (payload.milestone <= (st._lastMilestoneNumber || 0)) continue;
        st._lastMilestoneNumber = payload.milestone;
        playRobotSfx('robot_passive_milestone', { vol: 0.68 });
        for (let i = 0; i < 3; i++) atState(st, i * .06, () => { st.ticks[i] = 1; });
        atState(st, .2, () => {
          st.R.crest.kick(16); st.lockFlash = .6; st.R.glow.kick(.5);
          const ps = calPointLocal(st, 0, PIV[0].x, PIV[0].y);
          const po = calPointLocal(st, 1, PIV[1].x, PIV[1].y);
          pulseState(st, [[LATCH.x, LATCH.y], [520, 420], [ps.x, ps.y]], .18, 8);
          pulseState(st, [[LATCH.x, LATCH.y], [760, 420], [po.x, po.y]], .18, 8);
        });
        atState(st, .36, () => { st.POSE.spin += Math.PI; st.snapUntil = st.T + .18; st.snapW = 60; st.snapZ = .55; });
      }
    } else if (type === 'RobotPassiveUpgrade') {
      if (isAlias) return;
      const fighters = globalScope.fighters || [];
      for (const f of fighters) {
        if (payload.fighterId && f.id !== payload.fighterId) continue;
        if (!isRobotFighter(f)) continue;
        const st = getRobotState(f);
        if (!st) continue;
        if (!(payload.refund > 0) || payload.milestone <= (st._lastUpgradeNumber || 0)) continue;
        st._lastUpgradeNumber = payload.milestone;
        playRobotSfx('robot_passive_upgrade', { vol: 0.72 });
      }
    } else if (type === 'MilestoneRefund') {
      // alias — no SFX (handled by PassiveUpgrade)
      return;
    }
  }

  function install() {
    ensureSprites();
    loadRobotAudio();
    // Reuse the engine's user-gesture unlock; never construct another context.
    globalScope.addEventListener?.('pointerdown', () => {
      if (typeof ensureBattleAudioReady === 'function') ensureBattleAudioReady();
      loadRobotAudio();
    }, { passive: true });

    const AIL = globalScope.APEX_HERO_REWORK_AIL;
    if (AIL && AIL.bus && !AIL.bus.__robotPresentationHooked) {
      AIL.bus.__robotPresentationHooked = true;
      const origEmit = AIL.bus.emit;
      AIL.bus.emit = function (type, payload) {
        try { handleBusEvent({ type, payload }); } catch (e) { console.warn('[robot-presentation] bus handler error', e); }
        return origEmit.call(this, type, payload);
      };
    }

    const Fighter = globalScope.Fighter;
    if (Fighter && Fighter.prototype && !Fighter.prototype.__robotPresentationWrapped) {
      const prevDraw = Fighter.prototype.draw;
      Fighter.prototype.__robotPresentationWrapped = true;
      Fighter.prototype.draw = function (ctx) {
        if (isRobotFighter(this)) {
          const st = getRobotState(this);
          if (!st) { return prevDraw.call(this, ctx); }
          // AUDIT-E: single authoritative actor render; readability separation
          // reuses the same offscreen pixels. Status rings stay on the main
          // ctx afterwards and never enter the silhouette.
          const P = globalScope.APEX_CHAMBER_PALETTE;
          const renderActor = (tc) => {
            tc.save();
            tc.globalAlpha = this.hasStatus('immune') ? 0.55 : 1;
            tc.translate(this.x, this.y);
            // Fixed HTML-facing world orientation.
            if (this.isRage) {
              const glow = this.color || '#ffffff';
              try { tc.filter = `drop-shadow(0 0 5px ${glow}) drop-shadow(0 0 11px ${glow})`; } catch (e) {}
            }
            try { renderRobotLocal(tc, this, st); } catch (e) { console.warn('[robot-presentation] render failed', e); }
            if (this.isRage) { try { tc.filter = 'none'; } catch (e) {} }
            tc.restore();
          };
          if (P && P.actorRender && P.isActive()) P.actorRender(ctx, this, this.x, this.y, renderActor);
          else renderActor(ctx);
          ctx.save();
          ctx.translate(this.x, this.y);
          if (this.hasStatus('freeze')) {
            if (typeof drawStatusRing === 'function') drawStatusRing(ctx, this.radius + 18, '#a6f4ff', 'FREEZE');
          }
          if (this.hasStatus('stun')) {
            ctx.save();
            // Status art shares the fixed world frame.
            if (typeof drawStunAsset === 'function') drawStunAsset(ctx, this.radius);
            ctx.restore();
          }
          ctx.restore();
          ctx.globalAlpha = 1;
          try { renderRobotWorld(ctx, this, st); } catch (e) { console.warn('[robot-presentation] world render failed', e); }
          return;
        }
        return prevDraw.call(this, ctx);
      };
    }

    const HR = globalScope.APEX_HERO_REWORK;
    if (HR && !HR.__robotFireWrapped) {
      HR.__robotFireWrapped = true;
      const prevOnFire = HR.onFireBullet;
      HR.onFireBullet = function (spec) {
        const res = prevOnFire ? prevOnFire.call(this, spec) : null;
        try {
          const owner = spec && spec.owner;
          if (owner && isRobotFighter(owner)) {
            const st = getRobotState(owner);
            if (st) {
              const k = 1;
              st.R.gunKick.kick(-11 * k);
              st.R.rootX.kick(-22 * k);
              st.R.coreY.kick(7 * k);
              st.R.crest.kick(9 * k);
              st.R.calTh[1].kick(-.035 * k);
              st.R.calTh[0].kick(.022 * k);
              st.R.spin[0].kick(.3 * k);
              st.R.spin[1].kick(.3 * k);
              st.R.glow.kick(.12);
            }
          }
        } catch (e) {}
        return res;
      };
    }

    if (Fighter && Fighter.prototype && Fighter.prototype.resolveWalls && !Fighter.prototype.__robotWallWrapped) {
      const prevResolve = Fighter.prototype.resolveWalls;
      Fighter.prototype.__robotWallWrapped = true;
      Fighter.prototype.resolveWalls = function () {
        const side = prevResolve.call(this);
        if (side && isRobotFighter(this)) {
          const st = getRobotState(this);
          if (st) {
            st.wallFlash = 1;
            const dir = side === 'left' ? { x: 1, y: 0 } : side === 'right' ? { x: -1, y: 0 } : side === 'top' ? { x: 0, y: 1 } : { x: 0, y: -1 };
            const hx = side === 'left' ? 96 : side === 'right' ? 1184 : 640;
            const hy = side === 'top' ? 96 : side === 'bottom' ? 1184 : 600;
            const local = headToLocal(st, hx, hy);
            const worldPt = { x: this.x + local.x, y: this.y + local.y };
            impactLocal(st, side === 'right' ? 1 : 0, hx, hy, dir, 1.25, worldPt);
            dustState(st, worldPt.x, worldPt.y + 40, dir.x, dir.y, 4);
          }
        }
        return side;
      };
    }

    const installAvOverride = () => {
      const av = globalScope.APEX_ARSENAL_AV;
      if (!av || !av.drawEquippedWeapon || av.__robotSocketWrapped) return;
      av.__robotSocketWrapped = true;
      const prevDrawEq = av.drawEquippedWeapon;
      av.drawEquippedWeapon = function (ctx, fighter, holder) {
        if (isRobotFighter(fighter)) {
          try {
            const st = getRobotState(fighter);
            const socket = getRobotWeaponSocketWorld(fighter);
            if (st && socket && holder && holder.weaponId) {
              const aim = (holder.meta && holder.meta.aimAngle != null) ? holder.meta.aimAngle : Math.atan2(fighter.dir.y, fighter.dir.x);
              // heldGunLocal already applies the authored positional recoil once.
              const offX = socket.x;
              const offY = socket.y;
              const meta = av.weaponMeta ? av.weaponMeta(holder.weaponId) : null;
              if (meta && av.drawWeaponSprite) {
                const params = av.weaponDrawParams ? av.weaponDrawParams(holder.weaponId, holder.def?.category || '', fighter.radius) : { drawOffset: 0, targetLongSide: 120, offset: 0 };
                const drawAngle = aim + (params.drawOffset || 0) + (holder.meta && holder.meta.pose && holder.meta.pose.rotKick || 0);
                const ok = av.drawWeaponSprite(ctx, holder.weaponId, offX, offY, {
                  mode: 'equipped',
                  useWorld: params.useWorld,
                  targetLongSide: params.targetLongSide,
                  angle: drawAngle,
                  alpha: 0.98,
                  keepUpright: true,
                });
                if (ok) return true;
              }
            }
          } catch (e) {}
        }
        return prevDrawEq.call(this, ctx, fighter, holder);
      };
    };
    installAvOverride();
    if (globalScope.setInterval) {
      let tries = 0;
      const iv = setInterval(() => {
        tries++; installAvOverride();
        if ((globalScope.APEX_ARSENAL_AV && globalScope.APEX_ARSENAL_AV.__robotSocketWrapped) || tries > 50) clearInterval(iv);
      }, 200);
    }

    const AQ = globalScope.APEX_ARSENAL;
    if (AQ && AQ.step && !AQ.step.__robotPreTickWrapped) {
      const baseStep = AQ.step;
      AQ.step.__robotPreTickWrapped = true;
      const wrapped = function (dt) {
        try {
          const fighters = globalScope.fighters || [];
          for (const f of fighters) if (isRobotFighter(f)) updateRobotState(f, dt);
        } catch (e) {}
        return baseStep(dt);
      };
      wrapped.__hrWrapped = baseStep.__hrWrapped;
      wrapped.__robotPreTickWrapped = true;
      AQ.step = wrapped;
    }
    if (typeof globalScope.update === 'function' && !globalScope.update.__robotPreTickWrapped) {
      const baseUpdate = globalScope.update;
      globalScope.update.__robotPreTickWrapped = true;
      const wrappedU = function (dt) {
        try {
          if (globalScope.gameState === 'ARSENAL') {
            const fighters = globalScope.fighters || [];
            for (const f of fighters) if (isRobotFighter(f)) updateRobotState(f, dt);
          }
        } catch (e) {}
        return baseUpdate(dt);
      };
      wrappedU.__hrWrapped = baseUpdate.__hrWrapped;
      wrappedU.__robotPreTickWrapped = true;
      globalScope.update = wrappedU;
    }

    const HR2 = globalScope.APEX_HERO_REWORK;
    if (HR2 && HR2.installMatch && !HR2.__robotTeardownWrapped) {
      HR2.__robotTeardownWrapped = true;
      const prevInstall = HR2.installMatch;
      HR2.installMatch = function () {
        clearRobotStates();
        resetRobotAudioSession();
        loadRobotAudio();
        return prevInstall.apply(this, arguments);
      };
      const baseExit = globalScope.exitArsenalBattleMode;
      if (baseExit && !baseExit.__robotExitWrapped) {
        const wrappedExit = function () {
          clearRobotStates();
          resetRobotAudioSession();
          return baseExit.apply(this, arguments);
        };
        wrappedExit.__hrWrapped = baseExit.__hrWrapped;
        wrappedExit.__robotExitWrapped = true;
        globalScope.exitArsenalBattleMode = wrappedExit;
      }
    }
  }

  globalScope.APEX_ROBOT_PRESENTATION = {
    ensureSprites,
    getRobotState,
    renderActorImage,
    getRobotWeaponSocketWorld,
    playRobotSfx,
    loadRobotAudio,
    resetRobotAudioSession,
    audioEvidence: () => JSON.parse(JSON.stringify(Object.values(robotAudioEvidence))),
    SPR: () => SPR,
    isRobotFighter,
    version: '1.1.0-owner-visual-checkpoint-20260929'
  };
  globalScope.apexRobotPresentationRuntime = 'ready';

  if (globalScope.Fighter) install();
  else {
    const iv = setInterval(() => {
      if (globalScope.Fighter) { clearInterval(iv); install(); }
    }, 100);
  }
})(typeof window !== 'undefined' ? window : globalThis);
