// Approved owner GOLD content packs. Runtime cosmetic-only; no gameplay providers.
import {cosmetics} from './cosmeticAuthority.js';
import {rocketGoldAssets,drawRocketGoldWeapon,drawRocketGoldProjectile,drawRocketGoldBlast} from './rocketVuaHeGold.js';
import {prepareEcoGold,drawEcoGoldActor} from './ecoNewbotV17Gold.js';

cosmetics.register({
 kind:'weapon',baseId:'RPG_7',id:'vua-he',label:'VUA HỀ — THE LAST LAUGH',
 detail:'Owner Gold / native RPG-7 · V7 smoke and original complete face frame',
 preview:'/assets/skins/rocket-vua-he/launcher.png',assets:rocketGoldAssets,
 suppressBaseBlast:true,blastSeconds:1.38,
 render:{weapon:drawRocketGoldWeapon,projectile:drawRocketGoldProjectile,blast:drawRocketGoldBlast}
});
cosmetics.register({
 kind:'hero',baseId:'ROBOT',id:'ecobot',label:'ECOBOT — RECYCLE CORE V17',
 detail:'Owner Gold · forest-jade mechanical layers · native NEWBOT springs',
 assets:[],prepare:prepareEcoGold,
 render:{actor:drawEcoGoldActor}
});
