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
      assert.ok(before.state?.ownedFighters?.includes('ROBOT'),'starter must own NEWBOT');

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
      assert.equal(await frame.evaluate(()=>document.querySelectorAll('nav').length),0,'Gold must not include Account/Missions toggle navigation');
      assert.equal(await frame.evaluate(()=>document.querySelectorAll('header img[alt="APEX CHAOS"]').length),1,'Home wordmark missing');
      const fitHeading = async (goldFrame) => goldFrame.evaluate(async () => {
        await document.fonts.ready;
        const title = document.querySelector('main h1');
        const brand = document.querySelector('header img[alt="APEX CHAOS"]');
        const tr = title?.getBoundingClientRect();
        const br = brand?.getBoundingClientRect();
        const viewport = document.documentElement.clientWidth;
        return {
          viewport,
          title: title?.textContent?.trim(),
          titleBounds: tr && {left:tr.left,right:tr.right,top:tr.top,bottom:tr.bottom},
          logoBounds: br && {left:br.left,right:br.right,top:br.top,bottom:br.bottom},
          brandLoaded: !!brand?.complete && brand.naturalWidth>0,
          overflow: document.documentElement.scrollWidth>viewport+2,
        };
      });
      const enMissionFit = await fitHeading(frame);
      assert.ok(enMissionFit.brandLoaded,'Home wordmark failed to load');
      assert.ok(enMissionFit.logoBounds.left >= -2 && enMissionFit.logoBounds.right <= width+2,'Home wordmark horizontal crop');
      assert.ok(enMissionFit.titleBounds.left >= -2 && enMissionFit.titleBounds.right <= width+2,'English mission heading crop');
      assert.ok(!enMissionFit.overflow,'English mission overflow');
      await page.evaluate(()=>window.APEX_I18N?.setLanguage?.('vie'));
      await frame.waitForFunction(()=>document.querySelector('main h1')?.textContent?.includes('NHIỆM VỤ'),{timeout:10000});
      const viMissionFit = await fitHeading(frame);
      assert.ok(viMissionFit.titleBounds.left >= -2 && viMissionFit.titleBounds.right <= width+2,'Vietnamese mission heading crop');
      assert.ok(!viMissionFit.overflow,'Vietnamese mission overflow');
      await page.evaluate(()=>window.APEX_I18N?.setLanguage?.('eng'));
      await frame.waitForFunction(()=>document.querySelector('main h1')?.textContent?.includes('MISSIONS'),{timeout:10000});
      assert.equal(await frame.locator('nav').count(),0,'Gold must not include Account/Missions toggle navigation');
      assert.equal(await frame.locator('header img[alt="APEX CHAOS"]').count(),1,'Home wordmark missing');
      assert.equal(content.pathNodes,5,'Gold original hex mission path lost a node');
      assert.ok(content.coinHex,'original Gold AC hexagon missing');
      assert.ok(!content.missionText.includes('Guest_Raven')&&!content.missionText.includes('1,850'),'demo profile leaked');
      await page.screenshot({path:`${destination}/${width}x${height}-missions.png`});
      if(content.overflow) {
        const offenders=await frame.evaluate(()=>({
          innerWidth,scrollWidth:document.documentElement.scrollWidth,
          bodyWidth:document.body.scrollWidth,
          offenders:[...document.querySelectorAll('body *')].map(el=>{
            const r=el.getBoundingClientRect();
            return {tag:el.tagName,className:typeof el.className==='string'?el.className.slice(0,120):'',text:el.innerText?.slice(0,38),left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width)};
          }).filter(r=>r.right>innerWidth+3 || r.left < -3).slice(0,35)
        }));
        console.error('GOLD MISSION OVERFLOW',JSON.stringify(offenders));
      }
      assert.ok(!content.overflow,'Gold Mission horizontal clipping at '+width+'x'+height);

      // Real canonical profile via parent, no alternate save/wallet instance.
      const parent=await page.evaluate(()=>window.__APEX_GOLD_BRIDGE__?.snapshot());
      const windowValidPlayable=parent?.fighters?.map(x=>x.id)||[];
      assert.equal(parent?.state?.ac,before.state.credits,'Gold displays another AC wallet');
      assert.equal(parent?.fighters?.filter(x=>x.owned).length, before.state.ownedFighters.filter(id=>windowValidPlayable.includes(id)).length,'Gold invents owned fighters');
      assert.equal(parent?.missions?.length,5,'Gold mission source is not production catalog');

      await page.evaluate(()=>window.APEX_PROGRESSION_CENTER?.open('mastery'));
      await page.waitForFunction(()=>document.querySelector('.apex-gold-direct-host iframe')?.src.includes('tab=mastery'),{timeout:15000});
      await page.waitForFunction(()=>{
        const f=document.querySelector('.apex-gold-direct-host iframe');
        try {return f?.contentDocument?.readyState==='complete' &&
          f.contentWindow.location.search.includes('tab=mastery');}catch{return false;}
      },{timeout:18000});
      const second=await (await page.$('.apex-gold-direct-host iframe')).contentFrame();
      const goldMasteryDiagnostic=await second.evaluate(()=>({
        href:location.href,body:document.body.innerText.slice(0,1200),
        h1:document.querySelector('h1')?.textContent,
        tabs:[...document.querySelectorAll('[role=tab]')].map(x=>({text:x.textContent,selected:x.getAttribute('aria-selected')})),
      }));
      console.log('GOLD MASTERY INITIAL',JSON.stringify(goldMasteryDiagnostic));
      await second.waitForFunction(()=>
        document.querySelector('[role=tab][aria-selected=true]')?.textContent?.includes('MASTERY'),
        {timeout:18000});
      const stats=await second.evaluate(()=>({
        title:document.querySelector('h1')?.innerText,
        text:document.body.innerText,
        medals:document.querySelectorAll('button').length,
      }));
      assert.equal(stats.title,'MISSIONS','Mastery must remain within original Gold Missions scene');
      assert.ok(stats.text.includes('ACHIEVEMENTS'),'Mastery native Gold medals did not load in English');
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
      const enAccountFit = await fitHeading(account);
      assert.ok(enAccountFit.titleBounds.left >= -2 && enAccountFit.titleBounds.right <= width+2,'English account heading crop');
      await page.evaluate(()=>window.APEX_I18N?.setLanguage?.('vie'));
      await account.waitForFunction(()=>document.querySelector('main h1')?.textContent?.includes('TÀI KHOẢN'),{timeout:10000});
      const viAccountFit = await fitHeading(account);
      assert.ok(viAccountFit.titleBounds.left >= -2 && viAccountFit.titleBounds.right <= width+2,'Vietnamese account heading crop');
      assert.ok(!viAccountFit.overflow,'Vietnamese account overflow');
      await page.evaluate(()=>window.APEX_I18N?.setLanguage?.('eng'));
      await page.evaluate(()=>window.APEX_I18N?.setLanguage?.('vie'));
      await account.waitForFunction(()=>document.documentElement.lang==='vi',{timeout:10000});
      const vieProfile=await account.evaluate(()=>({title:document.querySelector('h1')?.innerText,text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth+3}));
      assert.equal(vieProfile.title,'TÀI KHOẢN','Vietnamese account title not localized');
      assert.ok(vieProfile.text.includes('TÀI KHOẢN KHÁCH'),'Vietnamese guest account note not localized');
      assert.ok(!vieProfile.overflow,'Vietnamese account horizontal overflow');
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
