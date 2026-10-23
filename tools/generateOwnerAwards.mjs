#!/usr/bin/env node
/**
 * Reproducible owner-award catalogue generator.
 *
 * Canonical source: result-gold/src/data/ownerDecisions.json.
 * Runtime output:  public/game/results/ownerAwards.generated.js.
 *
 * The generated browser file intentionally contains only the fields consumed
 * by the sealed match-result authority. Display copy remains in the canonical
 * JSON and is joined by the React mastery catalogue, so there is one owner
 * catalogue—not a second hand-maintained award authority.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const sourcePath = resolve(root, 'result-gold/src/data/ownerDecisions.json');
const outputPath = resolve(root, 'public/game/results/ownerAwards.generated.js');

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
if (!Array.isArray(source.items)) throw new Error('ownerDecisions.items must be an array');

const catalogue = source.items
  .filter((item) => item.decision === 'keep')
  .slice()
  .sort((a, b) => a.slot - b.slot)
  .map((item) => ({
    id: item.id,
    heroId: item.heroId ?? null,
    params: (item.params || []).map((param) => ({
      key: param.key,
      value: param.value,
      compare: param.compare,
    })),
  }));

if (catalogue.length !== 47) {
  throw new Error(`Expected 47 owner-approved awards, got ${catalogue.length}`);
}
const ids = catalogue.map((item) => item.id);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate award id in owner catalogue');

const body = `/* Generated from owner decision JSON. One award source for Gold & engine. */\n(function(r){'use strict';if(r.APEX_RESULT_OWNER_CATALOG)return;\nr.APEX_RESULT_OWNER_CATALOG=Object.freeze(${JSON.stringify(catalogue)});\nr.apexResultOwnerCatalog='ready';})(typeof window!=='undefined'?window:globalThis);\n`;
writeFileSync(outputPath, body);
console.log(`generated ${catalogue.length} awards -> ${outputPath}`);
