import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createCanvas, loadImage, GlobalFonts, Path2D } from '@napi-rs/canvas';
import sharp from 'sharp';

const BASE = '/tmp/baseline-c8f5ebe';
const OUT_DIR = '/home/user/APEX-CHAOS/evidence/combat-hud-takeover-20261023';
const AB_DIR = path.join(OUT_DIR, 'ab');
fs.mkdirSync(AB_DIR, { recursive: true });

// Canonical APEX Gold fonts + crisp fallback UI fonts
GlobalFonts.registerFromPath(`${BASE}/public/gold/fonts/apex-oswald-vietnamese.ttf`, 'ApexOswald');
GlobalFonts.registerFromPath(`${BASE}/public/gold/fonts/oswald-latin-700-normal.woff2`, 'OswaldBold');
GlobalFonts.registerFromPath(`${BASE}/public/gold/fonts/oswald-latin-500-normal.woff2`, 'OswaldMed');
GlobalFonts.registerFromPath(`${BASE}/public/gold/fonts/jetbrains-mono-latin-600-normal.woff2`, 'JetBrainsMono');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'DejaVuSansBold');
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'DejaVuSans');

const TOKENS = {
  ink: '#050607',
  bone: '#ece6d6',
  bone2: '#c9c3b4',
  mute: '#8b929a',
  line: '#283038',
  p1Edge: '#ff941f',     // Exact engine APEX_SIDE_EDGE P1 orange
  p2Edge: '#3aa7ff',     // Exact engine APEX_SIDE_EDGE P2 blue
  readyLime: '#b2ff3a',  // Canonical Gold P1 castable ready accent
  activeCyan: '#56e0ff', // Active buff / shield energy accent
  coachGold: '#f3be62',  // Warm Gold non-blocking coach accent
};

async function loadAssetAsCanvasImage(filePath) {
  const pngBuf = await sharp(filePath).png().toBuffer();
  return loadImage(pngBuf);
}

function createAuditor(viewportName, W, H, protectedZones) {
  const textBoxes = [];
  const containers = [];
  const touchTargets = [];
  const overlayBoxes = [];

  return {
    registerContainer(id, x, y, w, h) {
      containers.push({ id, x, y, w, h });
      return { id, x, y, w, h };
    },
    registerOverlay(id, x, y, w, h) {
      overlayBoxes.push({ id, x, y, w, h });
    },
    registerTouchTarget(id, x, y, w, h) {
      touchTargets.push({ id, x, y, w, h });
    },
    drawText(ctx, opts) {
      const {
        id, text, x, y, font, color, align = 'left', baseline = 'alphabetic',
        parent = null, letterSpacingPx = 0, padMargin = 2,
      } = opts;
      ctx.save();
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = baseline;

      const chars = [...String(text)];
      const advs = chars.map((ch) => ctx.measureText(ch).width);
      const totalW = (letterSpacingPx > 0 && chars.length > 1)
        ? advs.reduce((a, b) => a + b, 0) + letterSpacingPx * (chars.length - 1)
        : ctx.measureText(text).width;

      let startX = x;
      if (align === 'right') startX = x - totalW;
      else if (align === 'center') startX = x - totalW / 2;

      const fontPx = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] || '12');
      const m = ctx.measureText(text);
      const asc = m.actualBoundingBoxAscent ?? fontPx * 0.78;
      const desc = m.actualBoundingBoxDescent ?? fontPx * 0.18;
      let topY = y - asc;
      if (baseline === 'middle') topY = y - (asc + desc) / 2;
      else if (baseline === 'top') topY = y;

      if (letterSpacingPx > 0 && chars.length > 1) {
        let cx = startX;
        for (let i = 0; i < chars.length; i++) {
          ctx.fillText(chars[i], cx, y);
          cx += advs[i] + letterSpacingPx;
        }
      } else {
        ctx.fillText(text, startX, y);
      }
      ctx.restore();

      const box = {
        id,
        text,
        x: Math.round(startX * 10) / 10,
        y: Math.round(topY * 10) / 10,
        w: Math.round(totalW * 10) / 10,
        h: Math.round((asc + desc) * 10) / 10,
        fontPx,
        color,
        parentId: parent ? parent.id : null,
        padMargin,
      };
      textBoxes.push({ ...box, parent });
      return box;
    },
    verify() {
      const issues = [];
      for (let i = 0; i < textBoxes.length; i++) {
        for (let j = i + 1; j < textBoxes.length; j++) {
          const a = textBoxes[i], b = textBoxes[j];
          const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
          const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
          if (ix > 0.5 && iy > 0.5) {
            issues.push({ type: 'TEXT_OVERLAP', a: a.id, b: b.id, overlapPx: [ix, iy] });
          }
        }
      }
      for (const t of textBoxes) {
        if (t.x < 0 || t.y < 0 || t.x + t.w > W || t.y + t.h > H) {
          issues.push({ type: 'VIEWPORT_CLIP', id: t.id, text: t.text, box: [t.x, t.y, t.w, t.h], viewport: [W, H] });
        }
        if (t.parent) {
          const p = t.parent;
          const m = t.padMargin;
          if (
            t.x < p.x + m - 0.5 ||
            t.y < p.y + m - 0.5 ||
            t.x + t.w > p.x + p.w - m + 0.5 ||
            t.y + t.h > p.y + p.h - m + 0.5
          ) {
            issues.push({
              type: 'CONTAINER_CLIP_OR_OVERFLOW',
              id: t.id,
              text: t.text,
              textBox: [t.x, t.y, t.x + t.w, t.y + t.h],
              parentBox: [p.x, p.y, p.x + p.w, p.y + p.h],
            });
          }
        }
      }
      for (const ov of overlayBoxes) {
        for (const pz of protectedZones) {
          const ix = Math.max(0, Math.min(ov.x + ov.w, pz.x + pz.w) - Math.max(ov.x, pz.x));
          const iy = Math.max(0, Math.min(ov.y + ov.h, pz.y + pz.h) - Math.max(ov.y, pz.y));
          if (ix > 0 && iy > 0) {
            issues.push({ type: 'PROTECTED_ZONE_OCCLUSION', overlay: ov.id, target: pz.id, overlapPx: [ix, iy] });
          }
        }
      }
      for (const tt of touchTargets) {
        if (tt.w < 44 || tt.h < 32) {
          issues.push({ type: 'UNDERSIZED_TOUCH_TARGET', id: tt.id, size: [tt.w, tt.h] });
        }
      }
      return {
        viewport: viewportName,
        dimensions: [W, H],
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        issueCount: issues.length,
        issues,
        measuredTextCount: textBoxes.length,
        measuredContainers: containers.length,
        touchTargets,
        textBoxes: textBoxes.map(({ parent, ...rest }) => rest),
      };
    },
  };
}

function chamferPath(ctx, x, y, w, h, cut = 11) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.closePath();
}

function topRightBottomLeftCut(ctx, x, y, w, h, cut = 6) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function drawWeaponSilhouette(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 120, h / 36);
  ctx.fillStyle = color;
  ctx.fill(new Path2D('M4 13h58l6-4h22v5h24v5H90v4H78l-4 9h-9l-2-9H47l-5 11h-9l4-11H21l-4 5H6l2-7H4z'));
  ctx.restore();
}

function drawStateBar(ctx, x, y, w, h, state, ratio) {
  ctx.save();
  if (state === 'standby') {
    const segs = 4, gap = 3;
    const sw = (w - gap * (segs - 1)) / segs;
    ctx.fillStyle = '#434b54';
    for (let i = 0; i < segs; i++) ctx.fillRect(x + i * (sw + gap), y, sw, h);
  } else if (state === 'ready') {
    ctx.fillStyle = TOKENS.readyLime;
    ctx.fillRect(x, y, w, h);
  } else if (state === 'active') {
    ctx.fillStyle = '#1f2b33';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = TOKENS.activeCyan;
    ctx.fillRect(x, y, Math.max(6, w * ratio), h);
  } else if (state === 'rivalReady') {
    ctx.fillStyle = '#b9c0c8';
    ctx.fillRect(x, y, w, h);
  } else {
    ctx.fillStyle = '#232a30';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#7c858e';
    ctx.fillRect(x, y, w * ratio, h);
  }
  ctx.restore();
}

function drawKeyCap(ctx, auditor, parent, { id, key, x, y, size, mode }) {
  ctx.save();
  ctx.beginPath();
  const cut = 5;
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + size, y + size - cut);
  ctx.lineTo(x + size - cut, y + size);
  ctx.lineTo(x, y + size);
  ctx.closePath();

  let textColor = '#060708';
  if (mode === 'ready') {
    ctx.fillStyle = TOKENS.readyLime;
    ctx.fill();
  } else if (mode === 'active') {
    ctx.fillStyle = TOKENS.activeCyan;
    ctx.fill();
  } else {
    ctx.fillStyle = '#14191e';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#68717a';
    ctx.stroke();
    textColor = '#aeb6be';
  }
  ctx.restore();

  auditor.drawText(ctx, {
    id,
    text: key,
    x: x + size / 2,
    y: y + size / 2 + 0.5,
    font: `800 ${Math.round(size * 0.6)}px OswaldBold`,
    color: textColor,
    align: 'center',
    baseline: 'middle',
    parent,
    padMargin: 1,
  });
}

function drawSkillCard(ctx, auditor, cfg) {
  const {
    id, x, y, w, h, artImg, key, slotTag, name, subline, state, stateText, barRatio = 1, compact = false,
  } = cfg;
  auditor.registerContainer(id, x, y, w, h);
  if (compact) auditor.registerTouchTarget(id, x, y, w, h);

  const artW = h;
  const infoX = x + artW;
  const infoW = w - artW;
  const cut = compact ? 9 : 12;

  ctx.save();
  chamferPath(ctx, x, y, w, h, cut);
  ctx.clip();

  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  if (state === 'ready') {
    bg.addColorStop(0, '#1a2319');
    bg.addColorStop(0.55, '#12171b');
    bg.addColorStop(1, '#0c0f12');
  } else if (state === 'active') {
    bg.addColorStop(0, '#11252e');
    bg.addColorStop(0.6, '#101a21');
    bg.addColorStop(1, '#0b1014');
  } else {
    bg.addColorStop(0, '#111519');
    bg.addColorStop(1, '#0a0c0f');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.globalAlpha = state === 'standby' ? 0.42 : 1.0;
  ctx.drawImage(artImg, x, y, artW, h);
  if (state === 'standby') {
    ctx.fillStyle = 'rgba(8, 11, 15, 0.42)';
    ctx.fillRect(x, y, artW, h);
  } else if (state === 'active') {
    const glow = ctx.createRadialGradient(x + artW * 0.5, y + h * 0.5, 4, x + artW * 0.5, y + h * 0.5, artW * 0.72);
    glow.addColorStop(0, 'rgba(86, 224, 255, 0.24)');
    glow.addColorStop(1, 'rgba(86, 224, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, artW, h);
  }
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(infoX, y, 1, h);

  ctx.fillStyle = state === 'ready'
    ? TOKENS.readyLime
    : (state === 'active' ? TOKENS.activeCyan : '#434b54');
  ctx.fillRect(x + w - 3.2, y, 3.2, h);

  chamferPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, cut);
  ctx.lineWidth = state === 'ready' ? 1.4 : (state === 'active' ? 1.5 : 1);
  ctx.strokeStyle = state === 'ready'
    ? 'rgba(178, 255, 58, 0.45)'
    : state === 'active'
      ? 'rgba(86, 224, 255, 0.62)'
      : 'rgba(255, 255, 255, 0.08)';
  ctx.stroke();
  ctx.restore();

  const padX = compact ? 11 : 12;
  const infoBox = auditor.registerContainer(`${id}-info`, infoX, y, infoW - 4, h);
  const keySize = compact ? 20 : 22;

  if (compact) {
    const row1Y = y + 13;
    drawKeyCap(ctx, auditor, infoBox, {
      id: `${id}-key`, key, x: infoX + padX, y: row1Y, size: keySize, mode: state,
    });
    auditor.drawText(ctx, {
      id: `${id}-slot`,
      text: slotTag,
      x: infoX + padX + keySize + 8,
      y: row1Y + keySize / 2 + 0.5,
      font: '700 10.5px DejaVuSansBold',
      color: state === 'ready' ? TOKENS.readyLime : (state === 'active' ? TOKENS.activeCyan : TOKENS.mute),
      baseline: 'middle',
      letterSpacingPx: 0.9,
      parent: infoBox,
    });
    auditor.drawText(ctx, {
      id: `${id}-name`,
      text: name,
      x: infoX + padX,
      y: y + 57,
      font: '700 16.5px OswaldBold',
      color: state === 'standby' ? '#9fa6ae' : TOKENS.bone,
      letterSpacingPx: 0.8,
      parent: infoBox,
    });
    const stBox = auditor.drawText(ctx, {
      id: `${id}-state`,
      text: stateText,
      x: infoX + infoW - 11,
      y: y + 81,
      font: '700 11px OswaldBold',
      color: state === 'ready' ? TOKENS.readyLime : (state === 'active' ? TOKENS.activeCyan : '#9aa2ab'),
      align: 'right',
      letterSpacingPx: 0.7,
      parent: infoBox,
    });
    const barX = infoX + padX;
    const barW = Math.max(24, stBox.x - barX - 9);
    drawStateBar(ctx, barX, y + 75, barW, 4.5, state, barRatio);
  } else {
    const row1Y = y + 14;
    drawKeyCap(ctx, auditor, infoBox, {
      id: `${id}-key`, key, x: infoX + padX, y: row1Y, size: keySize, mode: state,
    });
    auditor.drawText(ctx, {
      id: `${id}-slot`,
      text: slotTag,
      x: infoX + padX + keySize + 8,
      y: row1Y + keySize / 2 + 0.5,
      font: '700 10px DejaVuSansBold',
      color: state === 'ready' ? TOKENS.readyLime : (state === 'active' ? TOKENS.activeCyan : TOKENS.mute),
      baseline: 'middle',
      letterSpacingPx: 0.7,
      parent: infoBox,
    });
    auditor.drawText(ctx, {
      id: `${id}-name`,
      text: name,
      x: infoX + padX,
      y: y + 61,
      font: '700 18.5px OswaldBold',
      color: state === 'standby' ? '#9fa6ae' : TOKENS.bone,
      letterSpacingPx: 0.8,
      parent: infoBox,
    });
    auditor.drawText(ctx, {
      id: `${id}-desc`,
      text: subline,
      x: infoX + padX,
      y: y + 83,
      font: '400 11px DejaVuSans',
      color: state === 'standby' ? '#8c949e' : '#c5c0b4',
      parent: infoBox,
    });
    const stBox = auditor.drawText(ctx, {
      id: `${id}-state`,
      text: stateText,
      x: infoX + infoW - 12,
      y: y + 109,
      font: '700 11.5px OswaldBold',
      color: state === 'ready' ? TOKENS.readyLime : (state === 'active' ? TOKENS.activeCyan : '#9aa2ab'),
      align: 'right',
      letterSpacingPx: 0.7,
      parent: infoBox,
    });
    const barX = infoX + padX;
    const barW = Math.max(20, stBox.x - barX - 9);
    drawStateBar(ctx, barX, y + 102.5, barW, 4.5, state, barRatio);
  }
}

function drawRivalCompactSkill(ctx, auditor, { id, x, y, w, h, artImg, name, state, stateText }) {
  auditor.registerContainer(id, x, y, w, h);
  const artW = h;
  const infoW = w - artW;

  ctx.save();
  chamferPath(ctx, x, y, w, h, 8);
  ctx.clip();
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, '#13171c');
  bg.addColorStop(1, '#0b0e11');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);

  ctx.save();
  ctx.globalAlpha = state === 'standby' ? 0.42 : 0.92;
  ctx.drawImage(artImg, x + infoW, y, artW, h);
  if (state === 'standby') {
    ctx.fillStyle = 'rgba(8, 11, 15, 0.45)';
    ctx.fillRect(x + infoW, y, artW, h);
  }
  ctx.restore();

  ctx.fillStyle = state === 'standby' ? '#434b54' : 'rgba(58, 167, 255, 0.55)';
  ctx.fillRect(x, y, 2.5, h);
  chamferPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.stroke();
  ctx.restore();

  const infoBox = auditor.registerContainer(`${id}-info`, x + 4, y, infoW - 6, h);
  auditor.drawText(ctx, {
    id: `${id}-name`,
    text: name,
    x: x + infoW - 10,
    y: y + 26,
    font: '700 14.5px OswaldBold',
    color: state === 'standby' ? '#98a0a8' : TOKENS.bone,
    align: 'right',
    letterSpacingPx: 0.7,
    parent: infoBox,
  });

  const stBox = auditor.drawText(ctx, {
    id: `${id}-state`,
    text: stateText,
    x: x + 12,
    y: y + 47,
    font: '700 10.5px OswaldBold',
    color: state === 'standby' ? '#8c949e' : '#c6cdd4',
    letterSpacingPx: 0.7,
    parent: infoBox,
  });

  const barX = stBox.x + stBox.w + 9;
  const barW = Math.max(20, (x + infoW - 10) - barX);
  drawStateBar(ctx, barX, y + 41.5, barW, 4, state === 'standby' ? 'standby' : 'rivalReady', 1);
}

function drawCoachStrip(ctx, auditor, { id, x, y, w, h, kicker, prompt, skipLabel, touch = false }) {
  auditor.registerContainer(id, x, y, w, h);
  auditor.registerOverlay(id, x, y, w, h);

  ctx.save();
  topRightBottomLeftCut(ctx, x, y, w, h, 8);
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, 'rgba(30, 25, 16, 0.96)');
  grad.addColorStop(1, 'rgba(11, 13, 16, 0.97)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(243, 190, 98, 0.78)';
  ctx.stroke();

  ctx.fillStyle = TOKENS.coachGold;
  ctx.fillRect(x, y + 6, 3, h - 12);
  ctx.restore();

  const skipW = touch ? 54 : 52;
  const skipH = touch ? h - 8 : 30;
  const skipX = x + w - skipW - 6;
  const skipY = y + (h - skipH) / 2;
  if (touch) auditor.registerTouchTarget(`${id}-skip-hit`, skipX - 2, y, skipW + 8, h);
  const skipBox = auditor.registerContainer(`${id}-skip`, skipX, skipY, skipW, skipH);

  ctx.save();
  topRightBottomLeftCut(ctx, skipX, skipY, skipW, skipH, 5);
  ctx.fillStyle = '#191d23';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.stroke();
  ctx.restore();

  auditor.drawText(ctx, {
    id: `${id}-skip-lbl`,
    text: skipLabel,
    x: skipX + skipW / 2,
    y: skipY + skipH / 2 + 0.5,
    font: '700 10.5px OswaldBold',
    color: TOKENS.bone,
    align: 'center',
    baseline: 'middle',
    letterSpacingPx: 0.8,
    parent: skipBox,
    padMargin: 2,
  });

  const copyBox = auditor.registerContainer(`${id}-copy`, x + 8, y, skipX - x - 12, h);
  if (kicker) {
    auditor.drawText(ctx, {
      id: `${id}-kicker`,
      text: kicker,
      x: x + 12,
      y: y + 17,
      font: '700 9.5px DejaVuSansBold',
      color: TOKENS.coachGold,
      letterSpacingPx: 0.9,
      parent: copyBox,
      padMargin: 2,
    });
    auditor.drawText(ctx, {
      id: `${id}-prompt`,
      text: prompt,
      x: x + 12,
      y: y + 39,
      font: '700 13.5px OswaldBold',
      color: '#ffffff',
      letterSpacingPx: 0.5,
      parent: copyBox,
      padMargin: 2,
    });
  } else {
    auditor.drawText(ctx, {
      id: `${id}-prompt`,
      text: prompt,
      x: x + 11,
      y: y + h / 2 + 0.5,
      font: '700 12px OswaldBold',
      color: TOKENS.coachGold,
      baseline: 'middle',
      letterSpacingPx: 0.5,
      parent: copyBox,
      padMargin: 2,
    });
  }
}

async function renderDesktopB(assets) {
  const W = 1440, H = 900;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(assets.deskCleanBase, 0, 0, W, H);

  // Clean duplicated "APEX COMBAT FRAME" noise from top HP header strip (leaving [P1] NEWBOT at 29..117, 916/1000, 00:04, 1000/1000, NEWBOT [P2] at 1318..1410 100% intact!)
  ctx.fillStyle = '#050607';
  ctx.fillRect(123, 6, 126, 21);
  ctx.fillRect(1188, 6, 125, 21);

  const auditor = createAuditor('desktop-1440x900', W, H, [
    { id: 'top-hp-p1-name', x: 25, y: 8, w: 96, h: 48 },
    { id: 'top-hp-center-scores-and-bars', x: 8, y: 27, w: 1424, h: 29 },
    { id: 'top-hp-digits', x: 580, y: 6, w: 280, h: 50 },
    { id: 'top-hp-p2-name', x: 1315, y: 8, w: 98, h: 48 },
    { id: 'arena-p2-fighter', x: 646, y: 375, w: 123, h: 117 },
    { id: 'arena-p1-fighter', x: 859, y: 628, w: 122, h: 117 },
  ]);

  // --- LEFT RAIL: P1 (HUMAN PLAYER) ---
  const p1X = 8, p1W = 290;
  ctx.save();
  const sideBg = ctx.createLinearGradient(0, 64, 304, 892);
  sideBg.addColorStop(0, '#07090b');
  sideBg.addColorStop(0.55, '#090d0a');
  sideBg.addColorStop(1, '#050607');
  ctx.fillStyle = sideBg;
  ctx.fillRect(0, 62, 302, 838);

  ctx.save();
  ctx.translate(16, 250);
  ctx.scale(0.95, 0.95);
  ctx.strokeStyle = 'rgba(178, 255, 58, 0.08)';
  ctx.lineWidth = 2.5;
  ctx.stroke(new Path2D('M30 150L130 40 210 150 130 260Z M130 40V260 M30 150H210'));
  ctx.beginPath(); ctx.arc(130, 150, 49, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  const edgeGrad = ctx.createLinearGradient(0, 96, 0, 860);
  edgeGrad.addColorStop(0, 'rgba(178,255,58,0)');
  edgeGrad.addColorStop(0.2, 'rgba(178,255,58,0.34)');
  edgeGrad.addColorStop(0.8, 'rgba(178,255,58,0.34)');
  edgeGrad.addColorStop(1, 'rgba(178,255,58,0)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(301, 96, 1, 764);
  ctx.restore();

  // P1 Portrait + Identity + Agency Subline
  const porW = 94, porH = 112, porX = p1X, porY = 72;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(porX, porY);
  ctx.lineTo(porX + porW, porY);
  ctx.lineTo(porX + porW, porY + porH - 12);
  ctx.lineTo(porX + porW - 12, porY + porH);
  ctx.lineTo(porX, porY + porH);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#0b0e10';
  ctx.fillRect(porX, porY, porW, porH);
  ctx.drawImage(assets.avatar, porX, porY, porW, porH);
  ctx.fillStyle = TOKENS.p1Edge;
  ctx.fillRect(porX, porY + porH - 3.5, porW, 3.5);
  ctx.restore();

  const idTxtBox = auditor.registerContainer('desk-p1-id-txt', porX + porW + 8, porY, p1W - porW - 8, porH);
  const tagX = porX + porW + 12, tagY = porY + 14, tagW = 68, tagH = 20;
  const tagBox = auditor.registerContainer('desk-p1-you-tag', tagX, tagY, tagW, tagH);
  ctx.fillStyle = TOKENS.p1Edge;
  ctx.fillRect(tagX, tagY, tagW, tagH);
  auditor.drawText(ctx, {
    id: 'desk-p1-you-lbl',
    text: 'P1 · YOU',
    x: tagX + tagW / 2,
    y: tagY + tagH / 2 + 0.5,
    font: '700 11px OswaldBold',
    color: '#080706',
    align: 'center',
    baseline: 'middle',
    letterSpacingPx: 0.7,
    parent: tagBox,
    padMargin: 2,
  });

  auditor.drawText(ctx, {
    id: 'desk-p1-hero-name',
    text: 'NEWBOT',
    x: tagX,
    y: porY + 67,
    font: '700 31px OswaldBold',
    color: TOKENS.bone,
    letterSpacingPx: 1.5,
    parent: idTxtBox,
  });

  auditor.drawText(ctx, {
    id: 'desk-p1-agency-sub',
    text: 'AUTO FIGHT · CAST J / K',
    x: tagX,
    y: porY + 92,
    font: '700 10.5px DejaVuSansBold',
    color: TOKENS.bone2,
    letterSpacingPx: 0.4,
    parent: idTxtBox,
  });

  // Non-blocking Contextual Coach inside #p1Side (never freezes combat, never asks for impossible J!)
  drawCoachStrip(ctx, auditor, {
    id: 'desk-coach-strip',
    x: p1X,
    y: 326,
    w: p1W,
    h: 52,
    kicker: 'FIRST MATCH · LIVE',
    prompt: 'PRESS K — ARMOR SHIELD (-55%)',
    skipLabel: 'SKIP',
    touch: false,
  });

  // P1 Skill J: STANDBY (no gun yet -> quiet dim state, never misleading READY!)
  drawSkillCard(ctx, auditor, {
    id: 'desk-skill-j',
    x: p1X,
    y: 392,
    w: p1W,
    h: 124,
    artImg: assets.skillJ,
    key: 'J',
    slotTag: 'NO FLOOR GUN',
    name: 'WEAPON DASH',
    subline: 'Dash to revealed gun',
    state: 'standby',
    stateText: 'WAIT · GUN',
    barRatio: 1,
    compact: false,
  });

  // P1 Skill K: CASTABLE NOW (vivid, lit, immediately actionable!)
  drawSkillCard(ctx, auditor, {
    id: 'desk-skill-k',
    x: p1X,
    y: 528,
    w: p1W,
    h: 124,
    artImg: assets.skillK,
    key: 'K',
    slotTag: 'READY NOW',
    name: 'VIRTUAL ARMOR',
    subline: '-55% damage · 3.0s',
    state: 'ready',
    stateText: 'PRESS K',
    barRatio: 1,
    compact: false,
  });

  // P1 Weapon Footer
  const wpY = 808, wpH = 82;
  auditor.registerContainer('desk-p1-weapon', p1X, wpY, p1W, wpH);
  ctx.fillStyle = TOKENS.line;
  ctx.fillRect(p1X, wpY, p1W, 1);
  drawWeaponSilhouette(ctx, p1X + 12, wpY + 26, 104, 31, '#7d838a');

  const wpTxtBox = auditor.registerContainer('desk-p1-wp-txt', p1X + 126, wpY + 8, p1W - 132, wpH - 16);
  auditor.drawText(ctx, {
    id: 'desk-p1-wp-mode',
    text: 'YOU · AUTO PICKUP',
    x: p1X + 130,
    y: wpY + 34,
    font: '700 9.5px DejaVuSansBold',
    color: TOKENS.mute,
    letterSpacingPx: 0.4,
    parent: wpTxtBox,
  });
  auditor.drawText(ctx, {
    id: 'desk-p1-wp-name',
    text: 'UNARMED',
    x: p1X + 130,
    y: wpY + 58,
    font: '700 17px OswaldBold',
    color: TOKENS.bone,
    letterSpacingPx: 1.0,
    parent: wpTxtBox,
  });

  // --- RIGHT RAIL: P2 (RIVAL BOT — ENGINE-SYMMETRIC!) ---
  // Cleanly align P2's subtitle ("BOT · AUTONOMOUS") AND P2's WEAPON DASH ("WAIT · GUN") so there is
  // zero contradiction across the screen at t=00:04 when no floor gun exists yet!
  const p2X = 1142, p2W = 290;
  // Clean subtitle under P2 NEWBOT (NEWBOT ends at y=141; APEX COMBAT FRAME was y=149..157)
  ctx.fillStyle = '#050608';
  ctx.fillRect(1146, 146, 184, 34);
  const p2SubBox = auditor.registerContainer('desk-p2-sub', 1148, 146, 180, 32);
  auditor.drawText(ctx, {
    id: 'desk-p2-agency-sub',
    text: 'RIVAL BOT · AUTO AI',
    x: 1324,
    y: 164,
    font: '700 10.5px DejaVuSansBold',
    color: TOKENS.mute,
    align: 'right',
    letterSpacingPx: 0.4,
    parent: p2SubBox,
  });

  // Re-render P2's 2 compact skill cards at exact canonical bounds (y=205..263 and y=273..331, above watermark y=342!)
  ctx.fillStyle = '#050709';
  ctx.fillRect(p2X - 2, 202, p2W + 4, 134);
  drawRivalCompactSkill(ctx, auditor, {
    id: 'desk-p2-skill-j',
    x: p2X,
    y: 205,
    w: p2W,
    h: 58,
    artImg: assets.skillJ,
    name: 'WEAPON DASH',
    state: 'standby',
    stateText: 'WAIT · GUN',
  });
  drawRivalCompactSkill(ctx, auditor, {
    id: 'desk-p2-skill-k',
    x: p2X,
    y: 273,
    w: p2W,
    h: 58,
    artImg: assets.skillK,
    name: 'VIRTUAL ARMOR',
    state: 'rivalReady',
    stateText: 'READY',
  });

  // Clean P2 Weapon Footer
  const p2WpY = 808, p2WpH = 82;
  ctx.fillStyle = '#06080a';
  ctx.fillRect(p2X, p2WpY, p2W, p2WpH);
  ctx.fillStyle = TOKENS.line;
  ctx.fillRect(p2X, p2WpY, p2W, 1);
  ctx.save();
  ctx.translate(p2X + p2W - 12, p2WpY + 26);
  ctx.scale(-1, 1);
  drawWeaponSilhouette(ctx, 0, 0, 104, 31, '#7d838a');
  ctx.restore();
  const p2WpBox = auditor.registerContainer('desk-p2-wp-txt', p2X + 8, p2WpY + 8, p2W - 134, p2WpH - 16);
  auditor.drawText(ctx, {
    id: 'desk-p2-wp-mode',
    text: 'BOT · AUTO PICKUP',
    x: p2X + p2W - 130,
    y: p2WpY + 34,
    font: '700 9.5px DejaVuSansBold',
    color: TOKENS.mute,
    align: 'right',
    letterSpacingPx: 0.4,
    parent: p2WpBox,
  });
  auditor.drawText(ctx, {
    id: 'desk-p2-wp-name',
    text: 'UNARMED',
    x: p2X + p2W - 130,
    y: p2WpY + 58,
    font: '700 17px OswaldBold',
    color: TOKENS.bone,
    align: 'right',
    letterSpacingPx: 1.0,
    parent: p2WpBox,
  });

  // Subtle battlefield spawn telegraph callout above the exact dashed ring at (870, 374)
  const ringCx = 870, ringTopY = 334;
  const pillW = 108, pillH = 22;
  const pillX = ringCx - pillW / 2, pillY = ringTopY - pillH - 8;
  const spawnPill = auditor.registerContainer('desk-spawn-pill', pillX, pillY, pillW, pillH);
  auditor.registerOverlay('desk-spawn-pill', pillX, pillY, pillW, pillH);
  ctx.save();
  topRightBottomLeftCut(ctx, pillX, pillY, pillW, pillH, 5);
  ctx.fillStyle = 'rgba(9, 12, 15, 0.84)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(236, 230, 214, 0.36)';
  ctx.stroke();
  ctx.restore();
  auditor.drawText(ctx, {
    id: 'desk-spawn-lbl',
    text: 'NEXT GUN SPAWN',
    x: ringCx,
    y: pillY + pillH / 2 + 0.5,
    font: '700 10px OswaldBold',
    color: TOKENS.bone2,
    align: 'center',
    baseline: 'middle',
    letterSpacingPx: 0.8,
    parent: spawnPill,
    padMargin: 2,
  });

  const pngBuf = canvas.toBuffer('image/png');
  const audit = auditor.verify();
  assert.equal(audit.status, 'PASS', `Desktop B self-audit failed: ${JSON.stringify(audit.issues, null, 2)}`);
  return { pngBuf, audit };
}

async function renderMobileB(assets) {
  const W = 844, H = 390;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Native 844x390 Chromium capture @ 00:16 (950/1000 vs 940/1000, SNIPER live on floor, K active 0.1S, P2 CD 7.4)
  ctx.drawImage(assets.mobLiveBase, 0, 0, W, H);

  // Restore full toast area (x=636..844, y=184..390) cleanly from native 844x390-eng-bot-battle.png
  // so 100% of the Vietnamese BOT toast (including its left badge tab at x=642..676) is cleanly removed!
  ctx.drawImage(assets.mobCleanP2Ref, 636, 184, W - 636, H - 184, 636, 184, W - 636, H - 184);

  const auditor = createAuditor('mobile-844x390', W, H, [
    { id: 'mob-top-hp-timer-rail', x: 6, y: 6, w: 832, h: 34 },
    { id: 'mob-arena-p1-fighter', x: 541, y: 233, w: 41, h: 45 },
    { id: 'mob-arena-p2-fighter', x: 521, y: 291, w: 48, h: 46 },
    { id: 'mob-p2-skills', x: 682, y: 46, w: 156, h: 138 },
  ]);

  const p1X = 6, p1W = 326;
  ctx.save();
  const sideBg = ctx.createLinearGradient(0, 44, 335, 386);
  sideBg.addColorStop(0, '#07090b');
  sideBg.addColorStop(0.6, '#090d0a');
  sideBg.addColorStop(1, '#050607');
  ctx.fillStyle = sideBg;
  ctx.fillRect(0, 44, 335, 346);
  ctx.restore();

  // P1 Identity + Agency Header
  const porX = p1X, porY = 46, porS = 34;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(porX, porY);
  ctx.lineTo(porX + porS, porY);
  ctx.lineTo(porX + porS, porY + porS - 7);
  ctx.lineTo(porX + porS - 7, porY + porS);
  ctx.lineTo(porX, porY + porS);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(assets.avatar, porX, porY, porS, porS);
  ctx.fillStyle = TOKENS.p1Edge;
  ctx.fillRect(porX, porY + porS - 2.5, porS, 2.5);
  ctx.restore();

  const idRowBox = auditor.registerContainer('mob-p1-id', porX + porS + 6, porY, p1W - porS - 6, 36);
  const p1BadgeX = porX + porS + 8, p1BadgeY = porY + 1, p1BadgeW = 28, p1BadgeH = 14;
  const p1BadgeBox = auditor.registerContainer('mob-p1-badge', p1BadgeX, p1BadgeY, p1BadgeW, p1BadgeH);
  ctx.fillStyle = TOKENS.p1Edge;
  ctx.fillRect(p1BadgeX, p1BadgeY, p1BadgeW, p1BadgeH);
  auditor.drawText(ctx, {
    id: 'mob-p1-tag-txt',
    text: 'P1',
    x: p1BadgeX + p1BadgeW / 2,
    y: p1BadgeY + p1BadgeH / 2 + 0.5,
    font: '700 10px OswaldBold',
    color: '#070707',
    align: 'center',
    baseline: 'middle',
    parent: p1BadgeBox,
    padMargin: 1,
  });

  auditor.drawText(ctx, {
    id: 'mob-p1-hero-name',
    text: 'NEWBOT',
    x: p1BadgeX,
    y: porY + 32,
    font: '700 16px OswaldBold',
    color: TOKENS.bone,
    letterSpacingPx: 0.9,
    parent: idRowBox,
    padMargin: 1,
  });

  const agW = 144, agH = 22, agX = p1X + p1W - agW, agY = porY + 6;
  const agBox = auditor.registerContainer('mob-p1-agency-pill', agX, agY, agW, agH);
  ctx.save();
  topRightBottomLeftCut(ctx, agX, agY, agW, agH, 5);
  ctx.fillStyle = 'rgba(255, 148, 31, 0.13)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 148, 31, 0.65)';
  ctx.stroke();
  ctx.restore();
  auditor.drawText(ctx, {
    id: 'mob-p1-agency-txt',
    text: 'YOU · AUTO FIGHT',
    x: agX + agW / 2,
    y: agY + agH / 2 + 0.5,
    font: '700 10.5px OswaldBold',
    color: '#ffb566',
    align: 'center',
    baseline: 'middle',
    letterSpacingPx: 0.7,
    parent: agBox,
    padMargin: 2,
  });

  // Non-blocking Contextual First-Match Micro-Coach inside #p1Side (326x32px, 0% over arena!)
  drawCoachStrip(ctx, auditor, {
    id: 'mob-coach-strip',
    x: p1X,
    y: 86,
    w: p1W,
    h: 32,
    kicker: null,
    prompt: 'GUN LIVE — TAP J TO DASH',
    skipLabel: 'SKIP',
    touch: true,
  });

  // Skill J: CASTABLE NOW (326x98px touch target)
  drawSkillCard(ctx, auditor, {
    id: 'mob-skill-j',
    x: p1X,
    y: 124,
    w: p1W,
    h: 98,
    artImg: assets.skillJ,
    key: 'J',
    slotTag: 'TARGET: SNIPER',
    name: 'WEAPON DASH',
    subline: '',
    state: 'ready',
    stateText: 'TAP · DASH',
    barRatio: 1,
    compact: true,
  });

  // Skill K: ACTIVE SHIELD FEEDBACK (326x98px touch target)
  drawSkillCard(ctx, auditor, {
    id: 'mob-skill-k',
    x: p1X,
    y: 228,
    w: p1W,
    h: 98,
    artImg: assets.skillK,
    key: 'K',
    slotTag: 'ACTIVE SHIELD',
    name: 'VIRTUAL ARMOR',
    subline: '',
    state: 'active',
    stateText: '-55% DMG · 0.1S',
    barRatio: 0.14,
    compact: true,
  });

  // P1 Weapon Footer (truthful auto-pickup state)
  const wpY = 333, wpH = 51;
  auditor.registerContainer('mob-p1-weapon', p1X, wpY, p1W, wpH);
  ctx.fillStyle = TOKENS.line;
  ctx.fillRect(p1X, wpY, p1W, 1);
  drawWeaponSilhouette(ctx, p1X + 8, wpY + 15, 62, 19, '#7d838a');

  const wpTxtBox = auditor.registerContainer('mob-p1-wp-txt', p1X + 80, wpY + 4, p1W - 88, wpH - 8);
  auditor.drawText(ctx, {
    id: 'mob-p1-wp-name',
    text: 'UNARMED',
    x: p1X + 84,
    y: wpY + 27,
    font: '700 13.5px OswaldBold',
    color: TOKENS.bone,
    letterSpacingPx: 0.8,
    parent: wpTxtBox,
    padMargin: 1,
  });
  auditor.drawText(ctx, {
    id: 'mob-p1-wp-auto',
    text: 'AUTO PICKUP ON CONTACT',
    x: p1X + 84,
    y: wpY + 43,
    font: '700 9.5px DejaVuSansBold',
    color: TOKENS.mute,
    letterSpacingPx: 0.3,
    parent: wpTxtBox,
    padMargin: 1,
  });

  // P2 Bottom Weapon Footer matched cleanly on 844x390
  const p2X = 682, p2W = 156;
  ctx.fillStyle = '#06080a';
  ctx.fillRect(p2X, wpY, p2W, wpH);
  ctx.fillStyle = TOKENS.line;
  ctx.fillRect(p2X, wpY, p2W, 1);
  ctx.save();
  ctx.translate(p2X + p2W - 6, wpY + 16);
  ctx.scale(-1, 1);
  drawWeaponSilhouette(ctx, 0, 0, 56, 17, '#7d838a');
  ctx.restore();
  const p2WpBox = auditor.registerContainer('mob-p2-wp-txt', p2X + 4, wpY + 4, p2W - 70, wpH - 8);
  auditor.drawText(ctx, {
    id: 'mob-p2-wp-name',
    text: 'UNARMED',
    x: p2X + p2W - 68,
    y: wpY + 27,
    font: '700 13px OswaldBold',
    color: TOKENS.bone,
    align: 'right',
    letterSpacingPx: 0.7,
    parent: p2WpBox,
    padMargin: 1,
  });
  auditor.drawText(ctx, {
    id: 'mob-p2-wp-auto',
    text: 'AUTO PICKUP',
    x: p2X + p2W - 68,
    y: wpY + 42,
    font: '700 8.5px DejaVuSansBold',
    color: TOKENS.mute,
    align: 'right',
    letterSpacingPx: 0.3,
    parent: p2WpBox,
    padMargin: 1,
  });

  // Battlefield #arenaFx cues:
  // 1) Active K shield guard arc + concise tag cleanly above P1 fighter (zero overlap with P1 [541..582, 233..278])
  ctx.save();
  const p1Cx = 561.5, p1Cy = 255.5;
  ctx.beginPath();
  ctx.arc(p1Cx, p1Cy, 27, -Math.PI * 0.82, Math.PI * 0.82);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = 'rgba(86, 224, 255, 0.86)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p1Cx, p1Cy, 30.5, Math.PI * 0.22, Math.PI * 1.78);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(86, 224, 255, 0.42)';
  ctx.stroke();

  const shW = 84, shH = 19, shX = Math.round(p1Cx - shW / 2), shY = 206;
  const shBox = auditor.registerContainer('mob-arena-shield-tag', shX, shY, shW, shH);
  auditor.registerOverlay('mob-arena-shield-tag', shX, shY, shW, shH);
  topRightBottomLeftCut(ctx, shX, shY, shW, shH, 4);
  ctx.fillStyle = 'rgba(10, 22, 28, 0.88)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(86, 224, 255, 0.78)';
  ctx.stroke();
  ctx.restore();

  auditor.drawText(ctx, {
    id: 'mob-arena-shield-lbl',
    text: 'ARMOR -55%',
    x: shX + shW / 2,
    y: shY + shH / 2 + 0.5,
    font: '700 10px OswaldBold',
    color: TOKENS.activeCyan,
    align: 'center',
    baseline: 'middle',
    letterSpacingPx: 0.6,
    parent: shBox,
    padMargin: 2,
  });

  // 2) Live [J] calibration brackets framing floor SNIPER (x=470..537, y=323..351) + left floor tag [J] SNIPER
  ctx.save();
  const gx0 = 470, gy0 = 323, gx1 = 537, gy1 = 351;
  const bl = 8;
  ctx.strokeStyle = TOKENS.readyLime;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gx0, gy0 + bl); ctx.lineTo(gx0, gy0); ctx.lineTo(gx0 + bl, gy0);
  ctx.moveTo(gx0, gy1 - bl); ctx.lineTo(gx0, gy1); ctx.lineTo(gx0 + bl, gy1);
  ctx.moveTo(gx1 - bl, gy1); ctx.lineTo(gx1, gy1); ctx.lineTo(gx1, gy1 - bl);
  ctx.stroke();

  const jtW = 80, jtH = 21, jtX = 384, jtY = 326;
  ctx.beginPath();
  ctx.moveTo(jtX + jtW, jtY + jtH / 2);
  ctx.lineTo(gx0 - 2, jtY + jtH / 2);
  ctx.strokeStyle = 'rgba(178, 255, 58, 0.72)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const jtBox = auditor.registerContainer('mob-arena-j-target-tag', jtX, jtY, jtW, jtH);
  auditor.registerOverlay('mob-arena-j-target-tag', jtX, jtY, jtW, jtH);
  topRightBottomLeftCut(ctx, jtX, jtY, jtW, jtH, 4);
  ctx.fillStyle = 'rgba(14, 21, 13, 0.92)';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(178, 255, 58, 0.85)';
  ctx.stroke();
  ctx.restore();

  auditor.drawText(ctx, {
    id: 'mob-arena-j-target-lbl',
    text: '[J] SNIPER',
    x: jtX + jtW / 2,
    y: jtY + jtH / 2 + 0.5,
    font: '700 10.5px OswaldBold',
    color: TOKENS.readyLime,
    align: 'center',
    baseline: 'middle',
    letterSpacingPx: 0.6,
    parent: jtBox,
    padMargin: 2,
  });

  const pngBuf = canvas.toBuffer('image/png');
  const audit = auditor.verify();
  assert.equal(audit.status, 'PASS', `Mobile B self-audit failed: ${JSON.stringify(audit.issues, null, 2)}`);
  return { pngBuf, audit };
}

async function renderStackedComparison(sheetId, title, subA, subB, bufA, bufB, w, h) {
  const pad = 20, headerH = 50, labelH = 30, gap = 20;
  const totalW = w + pad * 2;
  const totalH = headerH + labelH + h + gap + labelH + h + pad;
  const canvas = createCanvas(totalW, totalH);
  const ctx = canvas.getContext('2d');
  const auditor = createAuditor(sheetId, totalW, totalH, []);

  ctx.fillStyle = '#090b0e';
  ctx.fillRect(0, 0, totalW, totalH);

  const hdrBox = auditor.registerContainer(`${sheetId}-hdr`, pad, 6, totalW - pad * 2, headerH - 6);
  auditor.drawText(ctx, {
    id: `${sheetId}-title`,
    text: title,
    x: pad + 2,
    y: 34,
    font: w >= 1200 ? '700 20px OswaldBold' : '700 17px OswaldBold',
    color: '#ece6d6',
    letterSpacingPx: 0.6,
    parent: hdrBox,
    padMargin: 1,
  });

  const imgA = await loadImage(bufA);
  const imgB = await loadImage(bufB);

  const yA = headerH;
  ctx.fillStyle = '#ff6a58';
  ctx.fillRect(pad, yA + 5, 4, 18);
  const lblABox = auditor.registerContainer(`${sheetId}-lblA`, pad + 10, yA, totalW - pad * 2 - 10, labelH);
  auditor.drawText(ctx, {
    id: `${sheetId}-subA`,
    text: subA,
    x: pad + 12,
    y: yA + 19,
    font: w >= 1200 ? '700 13px DejaVuSansBold' : '700 11.5px DejaVuSansBold',
    color: '#ffb4a8',
    parent: lblABox,
    padMargin: 1,
  });
  ctx.strokeStyle = '#2a313a';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad - 0.5, yA + labelH - 0.5, w + 1, h + 1);
  ctx.drawImage(imgA, pad, yA + labelH, w, h);

  const yB = yA + labelH + h + gap;
  ctx.fillStyle = '#b2ff3a';
  ctx.fillRect(pad, yB + 5, 4, 18);
  const lblBBox = auditor.registerContainer(`${sheetId}-lblB`, pad + 10, yB, totalW - pad * 2 - 10, labelH);
  auditor.drawText(ctx, {
    id: `${sheetId}-subB`,
    text: subB,
    x: pad + 12,
    y: yB + 19,
    font: w >= 1200 ? '700 13px DejaVuSansBold' : '700 11.5px DejaVuSansBold',
    color: '#d6ff8f',
    parent: lblBBox,
    padMargin: 1,
  });
  ctx.strokeStyle = 'rgba(178,255,58,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad - 0.5, yB + labelH - 0.5, w + 1, h + 1);
  ctx.drawImage(imgB, pad, yB + labelH, w, h);

  const sheetAudit = auditor.verify();
  assert.equal(sheetAudit.status, 'PASS', `Sheet ${sheetId} audit failed: ${JSON.stringify(sheetAudit.issues, null, 2)}`);
  return { buf: canvas.toBuffer('image/png'), audit: sheetAudit };
}

(async () => {
  const assets = {
    avatar: await loadAssetAsCanvasImage(`${BASE}/public/assets/gold-ui/heroes/newbot/battle_avatar.webp`),
    skillJ: await loadAssetAsCanvasImage(`${BASE}/public/assets/gold-ui/heroes/newbot/skill_a1.webp`),
    skillK: await loadAssetAsCanvasImage(`${BASE}/public/assets/gold-ui/heroes/newbot/skill_a2.webp`),
    deskCoachA: fs.readFileSync(`${BASE}/evidence/first-match-review-20261023/screens/05-battle-coach-skill1-1440x900.png`),
    deskCleanBase: await loadAssetAsCanvasImage(`${BASE}/evidence/first-match-review-20261023/ab/desktop-A-live-1440x900.png`),
    mobLiveRawA: fs.readFileSync(`${BASE}/docs/acceptance/ra2/evidence/tutorial-pickup-hint/after-eng-pickup-844x390.png`),
    mobLiveBase: await loadAssetAsCanvasImage(`${BASE}/docs/acceptance/ra2/evidence/tutorial-pickup-hint/after-eng-pickup-844x390.png`),
    mobCleanP2Ref: await loadAssetAsCanvasImage(`${BASE}/docs/acceptance/ra2/evidence/compatibility/844x390-eng-bot-battle.png`),
  };

  const desk = await renderDesktopB(assets);
  const mob = await renderMobileB(assets);

  fs.writeFileSync(`${AB_DIR}/desktop-A-current-1440x900.png`, assets.deskCoachA);
  fs.writeFileSync(`${AB_DIR}/desktop-B-proposal-1440x900.png`, desk.pngBuf);
  fs.writeFileSync(`${AB_DIR}/mobile-A-current-844x390.png`, assets.mobLiveRawA);
  fs.writeFileSync(`${AB_DIR}/mobile-B-proposal-844x390.png`, mob.pngBuf);

  const deskAB = await renderStackedComparison(
    'desktop-AB-sheet',
    'APEX CHAOS — DESKTOP 1440×900 A/B (00:04 · OPENING CLASH BEFORE FIRST GUN SPAWN)',
    'A — CURRENT: Match freezes on impossible "Press J now" (no gun in arena), blocks K, occludes P2 HP/name, repeats UNARMED',
    'B — PROPOSED: Live arena, clear agency (AUTO FIGHT · CAST J/K), quiet J standby (WAIT · GUN) vs lit K (PRESS K), non-blocking coach',
    assets.deskCoachA,
    desk.pngBuf,
    1440,
    900,
  );
  const mobAB = await renderStackedComparison(
    'mobile-AB-sheet',
    'APEX CHAOS — MOBILE LANDSCAPE 844×390 A/B (00:16 · LIVE GUN + ACTIVE K + COOLDOWN)',
    'A — CURRENT: False "run over a gun" hint, P2 toast leak, J READY unlinked to SNIPER, muted K ACTIVE 0.1S',
    'B — PROPOSED: [J] SNIPER reticle + TAP · DASH, active K (-55% DMG + guard arc) vs 7.4s CD, non-blocking coach',
    assets.mobLiveRawA,
    mob.pngBuf,
    844,
    390,
  );

  fs.writeFileSync(`${AB_DIR}/desktop-AB-1440x900.png`, deskAB.buf);
  fs.writeFileSync(`${AB_DIR}/mobile-AB-844x390.png`, mobAB.buf);

  const fullAudit = {
    generatedAt: new Date().toISOString(),
    baselineCommit: 'c8f5ebeddbebb7e9781b171c019fe0ceb3a07842',
    runtimeCommit: '18bc21b07d73b881dafbb732630ca6bcd1c21214',
    desktop: desk.audit,
    mobile: mob.audit,
    sheets: {
      desktopAB: deskAB.audit,
      mobileAB: mobAB.audit,
    },
  };
  fs.writeFileSync(`${OUT_DIR}/layout-self-audit.json`, JSON.stringify(fullAudit, null, 2));
  console.log('ALL 4 RENDERS + AUDITS PASSED:', {
    desktopIssues: desk.audit.issueCount,
    mobileIssues: mob.audit.issueCount,
    deskSheetIssues: deskAB.audit.issueCount,
    mobSheetIssues: mobAB.audit.issueCount,
  });
})();
