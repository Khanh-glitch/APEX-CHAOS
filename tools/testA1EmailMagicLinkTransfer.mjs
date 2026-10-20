import assert from 'node:assert/strict';
import { parseEmailMagicLink } from '../src/game/emailMagicLinkTransfer.js';

const supabaseUrl = 'https://pqnhyucmziucjqbxmtbc.supabase.co';
const appOrigin = 'https://a1-cloud-staging-20261020.apex-chaos.pages.dev';
const token = 'abcdef0123456789abcdef';
const endpoint = supabaseUrl + '/auth/v1/verify';
const opts = { supabaseUrl, appOrigin };
let count = 0;
const valid = (title, raw) => {
  assert.equal(parseEmailMagicLink(raw, opts), new URL(raw).href, title);
  console.log('PASS', title); count++;
};
const invalid = (title, raw) => {
  assert.equal(parseEmailMagicLink(raw, opts), null, title);
  console.log('PASS', title); count++;
};
valid('default Magic Link confirms directly in requesting tab', endpoint+'?type=magiclink&token='+token+'&redirect_to='+encodeURIComponent(appOrigin+'/'));
valid('signup confirmation token allowed in new browser', endpoint+'?type=signup&token='+token+'&redirect_to='+encodeURIComponent(appOrigin+'/'));
valid('token_hash email verification supported', endpoint+'?type=email&token_hash='+token+'&redirect_to='+encodeURIComponent(appOrigin+'/'));
invalid('reject other Supabase project', 'https://evil-project.supabase.co/auth/v1/verify?type=magiclink&token='+token);
invalid('reject deceptive hostname', 'https://pqnhyucmziucjqbxmtbc.supabase.co.evil.test/auth/v1/verify?type=magiclink&token='+token);
invalid('reject insecure scheme', 'http://pqnhyucmziucjqbxmtbc.supabase.co/auth/v1/verify?type=magiclink&token='+token);
invalid('reject arbitrary path', supabaseUrl+'/auth/v1/admin?type=magiclink&token='+token);
invalid('reject malicious redirect', endpoint+'?type=magiclink&token='+token+'&redirect_to=https://apex-chaos.pages.dev/');
invalid('reject other subpaths', endpoint+'?type=magiclink&token='+token+'&redirect_to='+encodeURIComponent(appOrigin+'/admin'));
invalid('reject non-magiclink type', endpoint+'?type=recovery&token='+token);
invalid('reject token-less links', endpoint+'?type=magiclink');
invalid('reject link containing hash tokens', endpoint+'?type=magiclink&token='+token+'#access_token=not-accepted');
invalid('reject JS execution', 'javascript:alert(1)');
invalid('reject userinfo confusion', 'https://user:pass@pqnhyucmziucjqbxmtbc.supabase.co/auth/v1/verify?type=magiclink&token='+token);
invalid('reject empty input', '');
assert.equal(parseEmailMagicLink('a'.repeat(8200),opts),null);
console.log('A1 MAGIC LINK TAB TRANSFER: PASS ('+(count+1)+' checks)');