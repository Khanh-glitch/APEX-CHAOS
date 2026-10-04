// Extracted verbatim from apexEngine.js; keep classic-script execution order.
(function externalFightTelemetryPatch(){
    const panel = document.getElementById('combat-inspector');
    if (!panel) return;
    const byId = id => document.getElementById(id);
    const fmt = (v, d=1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : '0.0';
    const pct = (v, max=1) => clamp((Number(v)||0) / Math.max(.001, Number(max)||1) * 100, 0, 100);
    const clean = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const teamOfHud = f => f ? (f.teamId ?? f.id) : null;
    const projectileCount = (type, owner) => projectiles.filter(p => p && p.type === type && (!owner || p.owner === owner) && (p.life === undefined || p.life > 0)).length;
    const projectileStarts = (prefix, owner) => projectiles.filter(p => p && String(p.type||'').startsWith(prefix) && (!owner || p.owner === owner) && (p.life === undefined || p.life > 0));
    const activeProjectile = (type, owner) => projectiles.find(p => p && p.type === type && (!owner || p.owner === owner) && (p.life === undefined || p.life > 0));
    const statusTime = (f, name) => f?.statuses?.[name]?.timer > 0 ? f.statuses[name].timer : 0;
    const enemyOf = f => fighters.find(q => q && q.hp > 0 && teamOfHud(q) !== teamOfHud(f)) || fighters.find(q => q && q !== f) || null;

    function bar(label, value, max, text, extra=false){
        return {kind:'bar', label, value:Number(value)||0, max:Number(max)||1, text: text ?? `${fmt(value,1)}/${fmt(max,1)}`, extra};
    }
    function txt(label, value, extra=false){ return {kind:'text', label, value: String(value ?? ''), extra}; }

    function rageMetric(f){
        if (f?.type?.noRage) return txt('RAGE', 'NO RAGE KIT');
        if (f?.isRage) return bar('RAGE', 100, 100, 'ACTIVE');
        const progress = pct(f.maxHp - f.hp, f.maxHp * .5);
        return bar('RAGE BUILD', progress, 100, `${fmt(progress,0)}%`);
    }

    function shortDataFallback(f){
        const d = f.data || {};
        const keys = Object.keys(d).filter(k => typeof d[k] === 'number').slice(0,3);
        return keys.map(k => txt(k.toUpperCase(), fmt(d[k],1), true));
    }

    function fighterMetrics(f, e){
        if (!f) return [];
        const d = f.data || {};
        const rows = [];
        switch(f.name){
            case 'RUBBER': {
                rows.push(d.active ? bar('SUPER TIME', d.timer||0, 5, `${fmt(d.timer||0,1)}s`) : bar('SUPER CD', Math.max(0,d.cd||0), 5.8, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(bar('KINETIC K', d.kinetic||0, 9, `${d.kinetic||0}/9`));
                rows.push(bar('SUPER HITS', d.superHits||0, 4, `${d.superHits||0}/4`));
                rows.push(txt('LEARNED', d.subSkill ? `${d.subSkill.name} CD ${fmt(d.subData?.cd||0,1)}s` : `TIER ${d.afterTier||0}`, true));
                break;
            }
            case 'ICE': {
                const lane = activeProjectile('ice_lane', f);
                const field = activeProjectile('ice_age_field', f);
                rows.push(lane ? bar('FROST LANE', lane.life||0, lane.maxLife||6.8, `${fmt(lane.life||0,1)}s`) : bar('LANE CD', Math.max(0,d.cd||0), 7.6, `${fmt(Math.max(0,d.cd||0),1)}s`));
                if (d.iceAgeWindup) rows.push(bar('ICE AGE WINDUP', 1, 1, 'CASTING'));
                else if (field) rows.push(bar('ICE AGE FIELD', field.life||0, field.maxLife||1, `${fmt(field.life||0,1)}s`));
                else rows.push(bar('ICE AGE CD', f.isRage ? Math.max(0,d.iceAgeCd||0) : 0, 6.1, f.isRage ? `${fmt(Math.max(0,d.iceAgeCd||0),1)}s` : 'RAGE ONLY', true));
                rows.push(bar('ICE AGE CASTS', d.iceAgeCasts||0, 3, `${d.iceAgeCasts||0}`));
                rows.push(bar('ENEMY FREEZE', statusTime(e,'freeze'), 1.8, `${fmt(statusTime(e,'freeze'),1)}s`, true));
                break;
            }
            case 'VAMPIRE':
                rows.push(d.latchTimer>0 ? bar('FANG LOCK', d.latchTimer, 5, `${fmt(d.latchTimer,1)}s`) : bar('BITE CD', Math.max(0,d.latchCd||d.biteCd||0), 2.1, `${fmt(Math.max(0,d.latchCd||d.biteCd||0),1)}s`));
                rows.push(bar('BLOOD LINK', d.bloodLinkLevel||0, 6, `${d.bloodLinkLevel||0}`));
                rows.push(bar('DRAIN TICK', d.latchTick||0, .5, `${fmt(d.latchTick||0,1)}s`, true));
                break;
            case 'STRING':
                { const live = projectileCount('string_wall_thread', f); const cut = d.stringThreadCount || 0; const body = (e && e.data && e.data.stringBodyThreads) || 0; const next = cut <= 0 ? 'NONE' : cut <= 2 ? 'STRINGSHOT' : cut <= 4 ? 'OVERHEAT' : 'GOD THREADS'; const bonus = cut > 5 ? 'BONUS LOCKED' : cut === 5 && body >= 5 ? 'BIRD READY' : cut > 0 && body >= cut ? 'BONUS READY' : 'BONUS WAIT';
                rows.push(bar('WALL THREADS', live, Math.max(1, live), `${live} / SPD +${live*5}%`, true));
                rows.push(bar('BODY THREADS', body, Math.max(1, body), `${body} / ENEMY -${body*5}%`, true));
                rows.push(bar('CUT CYCLE', Math.max(0,d.stringCycleTimer||0), 5, `${fmt(Math.max(0,d.stringCycleTimer||0),1)}s / CUT ${cut}`));
                }
                break;
            case 'GALAXY':
                if ((d.galaxyPressureWindow || 0) > 0) rows.push(bar('PRESSURE', d.galaxyPressureWindow, 3, `${fmt(d.galaxyPressureWindow,1)}s`));
                else if (d.galaxyPressureArmed) rows.push(bar('ARMED', 1, 1, 'READY'));
                else rows.push(bar('ARMED CD', Math.max(0,d.galaxyPressureCd||0), 15, `${fmt(Math.max(0,d.galaxyPressureCd||0),1)}s`));
                rows.push(bar('WALL HITS', d.galaxyWallHits||0, 9, `${d.galaxyWallHits||0}/9`));
                rows.push(bar('DMG REDUCE', Math.round((d.galaxyRageReduction||0)*100), 100, `${Math.round((d.galaxyRageReduction||0)*100)}%`));
                break;
            case 'VOLCANO':
                rows.push(bar('METEOR CD', Math.max(0,d.cd||0), 11.5, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(bar('METEORS', projectileCount('meteor', f), 9, `${projectileCount('meteor', f)}/9`));
                break;
            case 'MAGNET':
                rows.push(d.fieldTimer>0 ? bar('FIELD TIME', d.fieldTimer, 3.1, `${fmt(d.fieldTimer,1)}s`) : bar('FIELD CD', Math.max(0,d.cd||0), 6.6, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(bar('FIELD OBJECTS', projectileCount('magnet_field', f), 1, `${projectileCount('magnet_field', f)}`, true));
                break;
            case 'FLASH':
                rows.push(d.zigTimer>0 ? bar('ZIGZAG TIME', d.zigTimer, 2, `${fmt(d.zigTimer,1)}s`) : d.ragePrep>0 ? bar('DRAWING', d.ragePrep, 1, `${fmt(d.ragePrep,1)}s`) : d.dashTimer>0 ? bar('DASH', d.dashTimer, .4, `${fmt(d.dashTimer,1)}s`) : bar('DASH CD', Math.max(0,d.cd||d.rageCd||0), 6.5, `${fmt(Math.max(0,d.cd||d.rageCd||0),1)}s`));
                rows.push(bar('ZIG HITS', d.zigHitCount||0, 2, `${d.zigHitCount||0}/2`));
                rows.push(txt('ZIG STEP', d.zigzag ? `${d.zigIndex||0}/${d.zigzag.length}` : 'IDLE', true));
                break;
            case 'ELECTRIC':
                rows.push(bar('WALL CHARGE', d.wallHits||0, 12, `${d.wallHits||0}`));
                rows.push(bar('NODES', (d.wallNodes||[]).length, 18, `${(d.wallNodes||[]).length}/18`));
                rows.push(txt('DISCHARGE', (d.wallHits||0)>0 ? 'ON CONTACT' : 'NEEDS WALL', true));
                break;
            case 'ORBIT': {
                const sats = d.sats || [];
                rows.push(bar('SATELLITES', sats.length, 6, `${sats.length}/6`));
                rows.push(bar('SPAWN CD', Math.max(0,d.cd||0), 6.2, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(txt('ELEMENTS', sats.slice(0,4).map(s => s.kind || s.type || 'sat').join(' Ă‚Â· ') || 'none', true));
                break;
            }
            case 'TOXIC': {
                const poison = e?.statuses?.poison;
                const exposure = poison?.exposure || 0;
                rows.push(bar('POISON LV', poisonLevelFromExposure(exposure), 5, `${poisonLevelFromExposure(exposure)}/5`));
                rows.push(bar('POISON TIME', poison?.timer || 0, 8, `${fmt(poison?.timer||0,1)}s`));
                rows.push(d.toxicCharge ? bar('CHARGE HEAL', d.toxicCharge.timer||0, 3, `${fmt(d.toxicCharge.amount||0,1)} dmg`) : bar('SPIT CD', Math.max(0,d.spitCd||0), 2.8, `${fmt(Math.max(0,d.spitCd||0),1)}s`, true));
                rows.push(bar('SELF POISON', d.selfPoisonTimer||0, 2.3, `${fmt(d.selfPoisonTimer||0,1)}s`, true));
                break;
            }
            case 'MIRROR':
                rows.push(bar('GATE CD', Math.max(0,d.cd||0), 10, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(bar('SWAP CD', Math.max(0,d.gateSwapCd||0), 1.25, `${fmt(Math.max(0,d.gateSwapCd||0),1)}s`));
                rows.push(txt('STOLEN', d.stolenType ? `${d.stolenType.name} Ä‚â€”${d.stolenPower||1}` : 'NONE'));
                break;
            case 'BLACK_HOLE':
                rows.push(bar('WELL', activeProjectile('gravity_well', f)?.life || 0, activeProjectile('gravity_well', f)?.maxLife || 1, activeProjectile('gravity_well', f) ? `${fmt(activeProjectile('gravity_well', f).life,1)}s` : 'none'));
                rows.push(txt('RAGE REFLECT', f.isRage ? 'ABSORB Ă¢â€ â€™ 2X' : 'LOCKED', true));
                break;
            case 'SAW':
                rows.push(d.spin>0 ? bar('SPIN TIME', d.spin, 4.1, `${fmt(d.spin,1)}s`) : bar('SPIN CD', Math.max(0,d.cd||0), 4.8, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(bar('ENEMY BLEED', statusTime(e,'bleed'), 4.8, `${fmt(statusTime(e,'bleed'),1)}s`));
                break;
            case 'BLADE':
                rows.push(bar('WAVES LIVE', projectileCount('blade_wave', f), f.isRage ? 4 : 2, `${projectileCount('blade_wave', f)}`));
                rows.push(bar('WEAK TIMER', statusTime(e,'weak'), 5, `${fmt(statusTime(e,'weak'),1)}s`));
                rows.push(txt('RAGE WAVES', f.isRage ? 'DOUBLE ARC' : 'SINGLE ARC', true));
                break;
            case 'NOVA':
                rows.push(bar('CHARGE', d.chargeTime||0, 8, `${fmt(d.chargeTime||0,1)}s`));
                rows.push(txt('CURRENT DMG', typeof novaDamage === 'function' ? fmt(novaDamage(d.chargeTime||0),1) : 'n/a'));
                rows.push(txt('PEAK AUTO', (d.chargeTime||0)>=7.2 ? 'IMMINENT' : 'BUILDING', true));
                break;
            case 'HUNTER':
                rows.push(d.hunt>0 ? bar('HUNT MODE', d.hunt, 4, `${fmt(d.hunt,1)}s`) : bar('HUNT CD', Math.max(0,d.cd||0), 7, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(bar('WEAK TIMER', statusTime(e,'weak'), 5, `${fmt(statusTime(e,'weak'),1)}s`));
                break;
            case 'CRYSTAL':
                rows.push(bar('WALL CD', Math.max(0,d.cd||0), 2.4, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(bar('CRYSTAL WALLS', projectileCount('crystal_wall', f), 6, `${projectileCount('crystal_wall', f)}`));
                break;
            case 'VIRUS':
                rows.push(bar('SPAWN CD', Math.max(0,d.spawnCd||0), 4, `${fmt(Math.max(0,d.spawnCd||0),1)}s`));
                rows.push(bar('MINIONS', projectileCount('virus_minion', f), 24, `${projectileCount('virus_minion', f)}`));
                rows.push(bar('PARASITES', (e?.virusParasites||[]).filter(v=>v.source===f).length, 8, `${(e?.virusParasites||[]).filter(v=>v.source===f).length}`));
                break;
            case 'DRUM':
                rows.push(bar('WALL BEATS', (d.wallBeatTimes||[]).filter(t=>matchClock-t<=5).length, 3, `${(d.wallBeatTimes||[]).filter(t=>matchClock-t<=5).length}/3`));
                rows.push(d.rageSolo>0 ? bar('DRUM SOLO', d.rageSolo, 5, `${fmt(d.rageSolo,1)}s`) : bar('WAVE CD', Math.max(0,d.wallWaveCd||0), .12, `${fmt(Math.max(0,d.wallWaveCd||0),2)}s`, true));
                rows.push(bar('BEATS LEFT', d.rageBeatsLeft||0, 5, `${d.rageBeatsLeft||0}`, true));
                break;
            case 'CARD':
                rows.push(bar('HAND', (d.hand||[]).length, 3, `${(d.hand||[]).length}/3`));
                rows.push(d.phase==='show' ? bar('REVEAL', d.showTimer||0, 1, `${fmt(d.showTimer||0,1)}s`) : bar('DRAW CD', Math.max(0,d.drawCd||0), 1, `${fmt(Math.max(0,d.drawCd||0),1)}s`));
                rows.push(txt('LAST DMG', d.lastDmg ? String(d.lastDmg) : 'none'));
                rows.push(txt('DECK', `${(d.deck||[]).length} cards`, true));
                break;
            case 'MATH': {
                const spell = projectiles.find(p => p.type==='math_formula' && p.owner===f);
                rows.push(bar('EXPRESSION CD', Math.max(0,d.cd||0), 5, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(d.graphPhase==='typing' ? bar('GRAPH TYPING', d.graphTimer||0, f.isRage?1.15:2.15, `${fmt(d.graphTimer||0,1)}s`) : bar('GRAPH CD', Math.max(0,d.graphCd||0), 7.5, `${fmt(Math.max(0,d.graphCd||0),1)}s`));
                rows.push(txt('FORMULA', spell ? `${spell.formula} = ${spell.value}` : 'none'));
                rows.push(bar('GRAPH LIVE', projectileCount('math_v2_graph', f), 1, `${projectileCount('math_v2_graph', f)}`, true));
                rows.push(txt('COMBO', statusTime(e,'mathGraphContact')>0 ? 'GRAPH TOUCH: Ä‚â€”2 WINDOW' : statusTime(e,'mathFormulaContact')>0 ? 'FORMULA TOUCH: Ä‚â€”2 WINDOW' : 'needs simultaneous hit', true));
                break;
            }
            case 'MUSICIAN':
                rows.push(bar('BEAT', d.beat||0, 4, `${d.beat||0}/4`));
                rows.push(bar('NEXT BEAT', Math.max(0,d.beatTimer||0), f.isRage?.48:.68, `${fmt(Math.max(0,d.beatTimer||0),1)}s`));
                rows.push(txt('NEXT CHORD', d.chordName || 'READY'));
                rows.push(bar('CHORD PULSE', d.chordPulse||0, .85, `${fmt(d.chordPulse||0,1)}s`, true));
                break;
            case 'MASTER_CHEF':
                rows.push(bar('INGREDIENTS', (d.slots||[]).length, 5, `${(d.slots||[]).length}/5`));
                rows.push(d.cooking ? bar('TEMPERATURE', d.temp||0, 500, `${fmt(d.temp||0,0)}Ă‚Â°C`) : bar('NEXT ING', d.addTimer||0, 1, `${fmt(d.addTimer||0,1)}s`));
                rows.push(txt('SLOTS', (d.slots||[]).join(' Ă‚Â· ') || 'empty'));
                rows.push(txt('DISH', d.currentDish || 'selecting'));
                rows.push(bar('RAGE FRY CD', Math.max(0,d.fryCd||0), 8.5, `${fmt(Math.max(0,d.fryCd||0),1)}s`, true));
                break;
            case 'MASK': {
                const masks = ['HĂ¡Â»Ë†','NĂ¡Â»Ëœ','Ä‚ÂI','Ă¡Â»Â'];
                rows.push(txt('CURRENT MASK', masks[d.maskIndex||0] || 'HĂ¡Â»Ë†'));
                rows.push(bar('TOUCH CD', Math.max(0,d.touchCd||0), .48, `${fmt(Math.max(0,d.touchCd||0),2)}s`));
                rows.push(txt('RAGE ECHO', f.isRage ? (d.echoMask!=null ? masks[d.echoMask] : 'ARMING') : 'LOCKED'));
                rows.push(bar('SORROW GUARD', d.sorrowGuard||0, 2.4, `${fmt(d.sorrowGuard||0,1)}s`, true));
                break;
            }
            case 'ARCADE':
                rows.push(bar('MACHINE CD', Math.max(0,d.machineCd||0), f.isRage?3.7:5, `${fmt(Math.max(0,d.machineCd||0),1)}s`));
                rows.push(txt('LAST SPIN', d.lastSpin || '---'));
                rows.push(bar('MACHINES', projectileCount('arcade_machine', f), 3, `${projectileCount('arcade_machine', f)}`));
                rows.push(bar('BUNNY REVIVE', d.reviveTokens||0, 3, `${d.reviveTokens||0}/3`, true));
                break;
            case 'NINJA':
                rows.push(bar('SHURIKEN', Math.max(0,d.shurikenCd||0), 1, `${fmt(Math.max(0,d.shurikenCd||0),1)}s`));
                rows.push(bar('KUNAI CD', Math.max(0,d.kunaiCd||0), f.isRage?5.2:8, `${fmt(Math.max(0,d.kunaiCd||0),1)}s`));
                rows.push(bar('KUNAI LIVE', projectileCount('ninja_kunai', f), 2, `${projectileCount('ninja_kunai', f)}`));
                rows.push(txt('TELEPORTS', d.teleports||0, true));
                break;
            case 'SHOTGUN': {
                const sg = d.shotgun || {};
                const heat = clamp(sg.heatPct || 0, 0, 100);
                const doublePct = f.hp > f.maxHp * .5 ? 0 : clamp(20 + ((50 - (f.hp / Math.max(1, f.maxHp)) * 100) / 50) * 40, 20, 60);
                rows.push(bar('SHELLS', sg.shells || 0, sg.maxShells || 6, `${sg.shells || 0}/${sg.maxShells || 6}`));
                rows.push(bar('HEAT', heat, 100, `${fmt(heat,0)}%`));
                rows.push(bar('DOUBLE SHOT', doublePct, 100, `${fmt(doublePct,0)}%`, true));
                if (sg.coolingUntil > matchClock) rows.push(bar('COOLING', sg.coolingUntil - matchClock, 10, `${fmt(sg.coolingUntil - matchClock,1)}s`, true));
                break;
            }
            case 'ENGINEER': {
                const ed = d.engineer || {};
                const structures = ed.structures || [];
                const building = structures.find(s => s && s.state === 'building' && s.hp > 0 && !s.dead);
                const merging = Object.values(ed.mergeIds || {})[0];
                const plan = (ed.plan || 'none').replace(/_/g, ' ').toUpperCase();
                const scrap = ed.scrap || 0;
                rows.push(bar('SCRAP', scrap, Math.max(5, scrap), `${scrap}`));
                rows.push(txt('BUILD PLAN', plan));
                rows.push(txt('STATUS', building ? `BUILD ${Math.round((building.progress || 0) * 100)}%` : merging ? `MERGE ${fmt(Math.max(0, merging.timer || 0),1)}s` : scrap < 3 ? `RESTOCK ${fmt(Math.max(0, 10 - (ed.lowScrapTimer || 0)),1)}s` : `${structures.filter(s => s && s.state === 'online' && !s.dead).length} ONLINE`, true));
                break;
            }
            case 'MATH_V2':
                rows.push(d.phase==='typing' ? bar('TYPING', d.timer||0, 3, `${fmt(d.timer||0,1)}s`) : bar('GRAPH CD', Math.max(0,d.cd||0), 5, `${fmt(Math.max(0,d.cd||0),1)}s`));
                rows.push(txt('FUNCTION', d.option?.label || activeProjectile('math_v2_grid', f)?.formula || 'none'));
                rows.push(bar('GRAPH LIVE', projectileCount('math_v2_graph', f), 1, `${projectileCount('math_v2_graph', f)}`, true));
                break;
            case 'SNIPER':
                rows.push(d.aim>0 ? bar('AIM', d.aim, d.aimMax||3, `${fmt(d.aim,1)}s`) : bar('RELOAD/CD', Math.max(0,d.reload||d.cd||0), 8, `${fmt(Math.max(0,d.reload||d.cd||0),1)}s`));
                rows.push(txt('STATE', d.hiddenReload ? 'HIDDEN RELOAD' : d.aim>0 ? 'VULNERABLE AIM' : 'MOVING'));
                break;
            case 'SLIME': {
                const kids = projectileCount('slime_child', f);
                const bodies = fighters.filter(q => q && q.name==='SLIME' && teamOfHud(q)===teamOfHud(f) && q.hp>0).length;
                rows.push(bar('SLIME KIDS', kids, 10, `${kids}/10`));
                rows.push(bar('BODIES', bodies, 6, `${bodies}`));
                rows.push(bar('GEL ARMOR', d.gelArmorTimer||0, 5, `${fmt(d.gelArmorTimer||0,1)}s`, true));
                break;
            }
            case 'TIME':
                rows.push(bar('CLOCK HIT', Math.max(0,d.clockCd ?? d.clockTick ?? 0), 4, `${fmt(Math.max(0,d.clockCd ?? d.clockTick ?? 0),1)}s`));
                rows.push(d.mark ? bar('REWIND MARK', d.mark.timer||0, 3, `${fmt(d.mark.timer||0,1)}s`) : bar('MARK CD', Math.max(0,d.markCd||0), 9, `${fmt(Math.max(0,d.markCd||0),1)}s`));
                rows.push(txt('DEATH REWIND', d.deathRewindUsed ? 'USED' : f.isRage ? 'READY' : 'LOCKED', true));
                break;
            case 'WOLF':
                rows.push(bar('SCENT CD', Math.max(0,d.scentCd||0), 7, `${fmt(Math.max(0,d.scentCd||0),1)}s`));
                rows.push(bar('BITE CD', Math.max(0,d.biteCd||0), 2, `${fmt(Math.max(0,d.biteCd||0),1)}s`));
                rows.push(bar('TARGET SCENT', statusTime(e,'scent'), 5, `${fmt(statusTime(e,'scent'),1)}s`));
                break;
            case 'WITCH':
                rows.push(bar('RAY CD', Math.max(0,d.rayCd||0), 2, `${fmt(Math.max(0,d.rayCd||0),1)}s`));
                rows.push(bar('CURSE CD', Math.max(0,d.curseCd||0), 7, `${fmt(Math.max(0,d.curseCd||0),1)}s`));
                rows.push(txt('CURSES', Object.keys(e?.statuses||{}).filter(k=>/curse|slow|weak|silence|paint/.test(k)).slice(0,3).join(' Ă‚Â· ') || 'none', true));
                break;
            case 'PIRATE':
                rows.push(bar('ANCHOR CD', Math.max(0,d.anchorCd||0), 7, `${fmt(Math.max(0,d.anchorCd||0),1)}s`));
                rows.push(bar('LOOT CD', Math.max(0,d.lootCd||0), 3, `${fmt(Math.max(0,d.lootCd||0),1)}s`));
                rows.push(txt('LOOT LIVE', projectileCount('pirate_loot', f), true));
                break;
            case 'PAINTER': {
                const colors=['RED','BLUE','YELLOW'];
                rows.push(bar('BLOB CD', Math.max(0,d.blobCd||0), 5, `${fmt(Math.max(0,d.blobCd||0),1)}s`));
                rows.push(bar('PAINT TIME', d.paintTimer||0, 2, `${fmt(d.paintTimer||0,1)}s`));
                rows.push(txt('COLOR', colors[d.colorIndex||0] || 'INK'));
                break;
            }
            case 'MONK':
            case 'KUNGFU':
                rows.push(txt('COMBO', d.comboStep ?? d.step ?? d.phase ?? 'ready'));
                rows.push(bar('TRAUMA', statusTime(e,'trauma'), 6, `${fmt(statusTime(e,'trauma'),1)}s`, true));
                rows.push(...shortDataFallback(f));
                break;
            case 'SUPERSTAR':
                rows.push(bar('FANS', projectileCount('superfan', f), 12, `${projectileCount('superfan', f)}`));
                rows.push(bar('INVINCIBLE', statusTime(f,'immune'), 3, `${fmt(statusTime(f,'immune'),1)}s`));
                rows.push(...shortDataFallback(f));
                break;
            case 'PUPPET':
                rows.push(bar('EFFIGIES', projectileCount('puppet_effigy', f), 12, `${projectileCount('puppet_effigy', f)}`));
                rows.push(bar('MONSTERS', projectileCount('straw_monster', f), 4, `${projectileCount('straw_monster', f)}`));
                rows.push(...shortDataFallback(f));
                break;
            default:
                rows.push(...shortDataFallback(f));
        }
        if (rows.length < 3) rows.push(rageMetric(f));
        if (rows.length < 3) rows.push(txt('SKILL PULSES', f.skillsUsed || 0, true));
        return rows.slice(0, 3);
    }

    function rowHTML(row){
        if (!row) return '';
        const cls = row.extra ? 'ci-row extra' : 'ci-row';
        if (row.kind === 'text') {
            return `<div class="${cls}"><div class="ci-textonly"><b>${clean(row.label)}:</b> ${clean(row.value)}</div></div>`;
        }
        const width = pct(row.value, row.max).toFixed(0);
        return `<div class="${cls}"><div class="ci-label"><span>${clean(row.label)}</span><b>${clean(row.text)}</b></div><div class="ci-track"><div class="ci-fill" style="width:${width}%"></div></div></div>`;
    }

    function renderCard(slot, f, e){
        const title = byId(`ci-p${slot}-title`), mode = byId(`ci-p${slot}-mode`), rows = byId(`ci-p${slot}-rows`);
        if (!title || !mode || !rows || !f) return;
        title.textContent = `${slot === 1 ? 'P1' : 'P2'} Ă‚Â· ${f.name}`;
        title.style.color = f.color || '#f3efe3';
        mode.textContent = f.isRage ? 'RAGE' : (f.hp <= 25 ? 'DANGER' : 'TRACKING');
        rows.innerHTML = fighterMetrics(f,e).map(rowHTML).join('');
    }

    let combatInspectorLastPaint = 0;
    window.updateCombatInspector = function(force = false){
        if (!panel) return;
        const active = (gameState === 'PLAYING' || gameState === 'COUNTDOWN') && fighters && fighters[0] && fighters[1];
        panel.classList.toggle('active', !!active);
        panel.setAttribute('aria-hidden', active ? 'false' : 'true');
        if (!active) return;
        const now = performance.now();
        if (!force && now - combatInspectorLastPaint < 96) return;
        combatInspectorLastPaint = now;
        renderCard(1, fighters[0], enemyOf(fighters[0]));
        renderCard(2, fighters[1], enemyOf(fighters[1]));
    };

    const oldUpdateHUDExternalTelemetry = updateHUD;
    updateHUD = function(){
        if (typeof oldUpdateHUDExternalTelemetry === 'function') oldUpdateHUDExternalTelemetry();
        updateCombatInspector();
    };
    const oldGoMenuTelemetry = goToMenu, oldGoSelectTelemetry = goToSelect;
    goToMenu = function(){ oldGoMenuTelemetry(); updateCombatInspector(true); };
    goToSelect = function(){ oldGoSelectTelemetry(); updateCombatInspector(true); };
    window.goToMenu = goToMenu;
    window.goToSelect = goToSelect;
    window.apexExternalTelemetryPatch = 'ready';
})();
