import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const lab=readFileSync(new URL('../public/gold-fidelity-lab.html',import.meta.url),'utf8');
assert.match(index,/<title>APEX CHAOS<\/title>/,'public entry keeps the product brand');
assert.match(index,/<meta name="description"/,'public entry has a search/share description');
assert.match(index,/<meta property="og:title" content="APEX CHAOS"/,'social metadata keeps the product brand');
assert.doesNotMatch(index,/gold-fidelity-lab|location\.(?:replace|assign)|window\.top\s*===\s*window/,
  'mobile and desktop entry must not route through a separate Lab UI');
assert.match(lab,/<title>APEX CHAOS — Gold Viewport Preview<\/title>/,
  'the explicit QA viewport page must not expose Laboratory branding');
assert.match(lab,/public product entry does not redirect here/i,
  'the preview utility is not presented as the product bootstrap');
console.log('MOBILE ENTRY ARCHITECTURE PASS: one native product entry, branded QA-only viewport preview, release metadata present');
