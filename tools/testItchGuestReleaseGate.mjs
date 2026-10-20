// ITCH Guest-first acceptance law — no Auth UI or live Auth session,
// real reward stays single-wallet, no reset of stored local progress.
// This static contract complements the real runtime economy/browser gates.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const policy=read('src/game/releasePolicy.js');
const main=read('src/main.jsx');
const cloud=read('src/game/cloudAccount.js');
const account=read('src/ui/AccountCenter.jsx');
const economy=read('public/game/arsenal/arsenalMetaRuntime.js');
const product=read('src/game/productSurface.js');
let count=0;
const check=(name,cond)=>{assert.ok(cond,name);console.log('PASS',name);count++;};
check('Guest-only release flag is versioned and true',/export const GUEST_ONLY_RELEASE = true;/.test(policy));
check('main still installs genuine local player authority',main.includes('installPlayerAccountAuthority(window)'));
check('Cloud Auth startup skipped under release flag',main.includes('if (!GUEST_ONLY_RELEASE) void initCloudAccount()'));
check('Supabase adapter fails closed even with stale env keys',cloud.includes('!GUEST_ONLY_RELEASE && !!SUPABASE_URL && !!SUPABASE_ANON_KEY'));
check('Account Center Guest release branch has no sign-in actions',account.includes('{GUEST_ONLY_RELEASE ? (') && account.includes('CHƠI NGAY, KHÔNG CẦN ĐĂNG NHẬP'));
check('Account Center preserves display-name editor',account.includes('account.setDisplayName(nameDraft)'));
check('Account Center shows local-only save limitation',account.includes('Đừng xóa dữ liệu trang web'));
check('fresh local AC remains 350 (no surprise refills)',economy.includes('const START_CREDITS = 350;'));
check('BOT wins pay exactly 200 real local AC',economy.includes('BOT_WIN: 200, BOT_LOSS: 25, LOCAL_COMPLETE: 50'));
check('Product graph matches 200/25/50 wallet reward law',product.includes('matchRewards: Object.freeze({ botWin: 200, botLoss: 25, localComplete: 50 })'));
check('Fighter Shop remains locked in public navigation',product.includes("surface('fighter-shop', 'Fighter Shop', LOCKED,"));
check('Claim history still protects against duplicate rewards',economy.includes('state.claimedMatchIds.includes(claimKey)') && economy.includes('current.productResultAwarded'));
check('Shop / Lucky draw costs unchanged',economy.includes('const SHOP_COST = 1000;') && economy.includes('const DRAW_COST = 350;'));
console.log('ITCH GUEST FIRST CONTRACT PASS ('+count+' checks)');
