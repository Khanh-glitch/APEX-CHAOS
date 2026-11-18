#!/usr/bin/env node
/**
 * Switch the workspace cleanly between isolated UI upgrade variants:
 *   node tools/switchUiVariant.mjs v3        -> Phase 3 Gold Obsidian Director's Cut (recommended canonical UI)
 *   node tools/switchUiVariant.mjs v2        -> Phase 1+2 + AI #2 (upgrade-apex-chaos-uiux (2).zip)
 *   node tools/switchUiVariant.mjs v1        -> Phase 1+2 + AI #1 (upgrade-apex-chaos-uiux (1).zip)
 *   node tools/switchUiVariant.mjs baseline  -> Clean Phase 1+2 baseline (neither AI overlay)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VARIANTS = {
  baseline: null,
  v1: 'v1-premium-fx',
  v2: 'v2-aaa-obsidian',
  v3: 'v3-directors-cut',
};

const choice = (process.argv[2] || '').trim().toLowerCase();
if (!Object.prototype.hasOwnProperty.call(VARIANTS, choice)) {
  console.error('Usage: node tools/switchUiVariant.mjs <v3|v2|v1|baseline>');
  process.exit(1);
}

const VARIANT_ONLY_PATHS = [
  'src/ui/premium',
  'src/ui/ApexIcons.jsx',
  'src/ui/AaaVisualPolishController.jsx',
  'src/ui/aaaPremiumUnified.css',
];

function copyTree(srcDir, destDir) {
  for (const ent of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, ent.name);
    const dst = path.join(destDir, ent.name);
    if (ent.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      copyTree(src, dst);
    } else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
}

// 1. Remove all variant-exclusive files so zero cross-contamination is possible.
for (const rel of VARIANT_ONLY_PATHS) {
  fs.rmSync(path.join(ROOT, rel), { recursive: true, force: true });
}

// 2. Restore clean Phase 1+2 baseline for every shared file.
copyTree(path.join(ROOT, 'ui-variants/baseline'), ROOT);

// 3. Overlay selected variant if not baseline.
const dirName = VARIANTS[choice];
if (dirName) {
  copyTree(path.join(ROOT, 'ui-variants', dirName), ROOT);
  if (choice === 'v1') {
    fs.rmSync(path.join(ROOT, 'src/ui/rewardToast.css'), { force: true });
  }
}

console.log(`[ui-variant] Active workspace switched cleanly to: ${choice}${dirName ? ` (${dirName})` : ''}`);
