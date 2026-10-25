// Owner Gold: real Chromium visual and canonical wallet acceptance.
// Operates on the shipped single-file Gold iframe, not removed React HUD markup.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser, openApp, wait} from './issue105/harness.mjs';

const sizes=[[1440,900],[1024,768],[390,844],[844,390]];
const destination='reports/owner-gold-evidence';
await mkdir(destination,{recursive:true});
const browser=await launchBrowser();
try {
  for(const [width,height] of sizes) {
    const {page,context,errors}=await openApp(browser,{
      width,height,mobile:width<900,
      storage:{'apex.alpha.tutorial.v1':'off'}
    });
    try {
      const before=await page.evaluate(()=>({
        profile:window.APEX_PLAYER_ACCOUNT?.profile?.(),
        state:window.APEX_ARSENAL_META?.getState?.(),
        contract:window.APEX_ARSENAL_META?.progressionCatalog?.(),
      }));
      assert.ok(before.profile?.kind==='guest','Guest-first policy broke');
      assert.equal(before.contract?.length,5,'five canonical contracts expected');
      assert.equal(before.state?.credits,350,'fresh profile wallet must start at 350 AC');
      assert.deepEqual(before.state?.ownedFighters,['ROBOT'],'fresh owned roster must be NEWBOT only');

      await page.click('#apexMissionsOpen');
      await page.waitForSelector('.apex-gold-direct-host iframe',{timeout:30000});
      const iframe=await page.$('.apex-gold-direct-host iframe');
      const frame=await iframe.contentFrame();
      assert.ok(frame,'same-origin Gold iframe not mounted');
      await frame.waitForSelector('ol li',{timeout:25000});
      await frame.waitForFunction(()=>document.body.innerText.includes('MISSIONS'),{timeout:15000});
      const content=await frame.evaluate(()=>({
        title:document.querySelector('h1')?.innerText,
        pathNodes:document.querySelectorAll('ol > li').length,
        missionText:document.body.innerText,
        coinHex:!!document.querySelector('polygon[points="20,1.5 36,10.5 36,29.5 20,38.5 4,29.5 4,10.5"]'),
        overflow:document.documentElement.scrollWidth>innerWidth+3,
      }));
      assert.equal(content.title,'MISSIONS');
      assert.equal(content.pathNodes,5,'Gold original hex mission path lost a node');
      assert.ok(content.coinHex,'original Gold AC hexagon missing');
      assert.ok(!content.missionText.includes('Guest_Raven')&&!content.missionText.includes('1,850'),'demo profile leaked');
      assert.ok(!content.overflow,'Gold Mission horizontal clipping at '+width+'x'+height);
      await page.screenshot({path:`${destination}/${width}x${height}-missions.png`});

      // Real canonical profile via parent, no alternate save/wallet instance.
      const parent=await page.evaluate(()=>window.__APEX_GOLD_BRIDGE__?.snapshot());
      assert.equal(parent?.state?.ac,before.state.credits,'Gold displays another AC wallet');
      assert.equal(parent?.fighters?.filter(x=>x.owned).length,1,'Gold invents owned fighters');
      assert.equal(parent?.missions?.length,5,'Gold mission source is not production catalog');

      await page.evaluate(()=>window.APEX_PROGRESSION_CENTER?.open('mastery'));
      await page.waitForFunction(()=>document.querySelector('.apex-gold-direct-host iframe')?.src.includes('tab=mastery'),{timeout:15000});
      const second=await (await page.$('.apex-gold-direct-host iframe')).contentFrame();
      await second.waitForFunction(()=>document.body.innerText.includes('MASTERY'),{timeout:18000});
      const stats=await second.evaluate(()=>({
        title:document.querySelector('h1')?.innerText,
        text:document.body.innerText,
        medals:document.querySelectorAll('button').length,
      }));
      assert.equal(stats.title,'MISSIONS','Mastery must remain within original Gold Missions scene');
      assert.ok(stats.text.includes('THÀNH TỰU'),'Mastery native Gold medals did not load');
      await page.screenshot({path:`${destination}/${width}x${height}-mastery.png`});

      await page.evaluate(()=>window.APEX_ACCOUNT_CENTER?.open());
      await page.waitForFunction(()=>document.querySelector('.apex-gold-direct-host iframe')?.src.includes('screen=account'),{timeout:15000});
      const account=await (await page.$('.apex-gold-direct-host iframe')).contentFrame();
      await account.waitForFunction(()=>document.querySelector('h1')?.textContent?.includes('ACCOUNT'),{timeout:15000});
      const profile=await account.evaluate(()=>({
        title:document.querySelector('h1')?.innerText,
        text:document.body.innerText,
        imageCount:[...document.images].filter(x=>x.complete&&x.naturalWidth>0).length,
      }));
      assert.equal(profile.title,'ACCOUNT');
      assert.ok(profile.text.includes(before.profile.displayName),'Gold displayed an invented account name');
      assert.ok(profile.imageCount>0,'Gold account lacks decoded fighter art');
      await page.screenshot({path:`${destination}/${width}x${height}-account.png`});
      await page.evaluate(()=>window.APEX_ACCOUNT_CENTER?.close());
      await page.waitForFunction(()=>!document.querySelector('.apex-gold-direct-host'),{timeout:10000});
      assert.deepEqual(errors,[],'browser errors '+width+'x'+height+': '+errors.join(';'));
      console.log('PASS GOLD REAL CHROME',width,height,'5 contracts, wallet 350, native mission path/mastery/account, screenshots');
    }finally{await context.close();}
  }
}finally{await browser.close();}
