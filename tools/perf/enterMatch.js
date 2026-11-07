// Enters a production match through the Gold bridge exactly the way the shell
// does (host is-open -> mountBattleHud -> onHandoff -> onBattleLive).
export async function enterMatch(page, { p1, p2, mode = 'local1v1' }) {
  await page.evaluate(() => {
    const host = document.getElementById('battleHudHost');
    if (host) { host.classList.add('is-open'); host.setAttribute('aria-hidden', 'false'); }
    document.body.classList.add('battle-hud-open');
  });
  return await page.evaluate(async (cfg) => {
    const G = window.APEX_GOLD;
    const html = await (await fetch(new URL('battle-hud.html', document.baseURI).href, { cache: 'no-cache' })).text();
    await new Promise((resolve) => G.mountBattleHud(html, resolve));
    G.onHandoff({ mode: cfg.mode === 'bot' ? 'BOT' : 'LOCAL', p1: cfg.p1, p2: cfg.p2, p1Hero: cfg.p1, p2Hero: cfg.p2, botHeroId: cfg.p2, shell: 'battle' });
    const live = await G.onBattleLive({ mode: cfg.mode, p1: cfg.p1, p2: cfg.p2 });
    return { live, fighters: (window.fighters || []).map((f) => f.name) };
  }, { p1, p2, mode });
}

export async function exitMatch(page) {
  await page.evaluate(() => {
    try { window.APEX_GOLD?.exitBattle?.(); } catch (_) {}
    try { window.APEX_GOLD?.unmountBattleHud?.(); } catch (_) {}
    document.body.classList.remove('battle-hud-open', 'battle-transition-active');
    const host = document.getElementById('battleHudHost');
    if (host) { host.classList.remove('is-open', 'is-preloading', 'is-transitioning', 'is-reveal'); host.setAttribute('aria-hidden', 'true'); }
  });
}
