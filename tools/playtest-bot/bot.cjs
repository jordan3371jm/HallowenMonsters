// Bot che gioca Halloween Monsters sul sito vero di Playgama.
// Uso: node bot.cjs <profilo> <nome> <runs> <targetWave> <ads:0|1>
const { chromium } = require('playwright');
const fs = require('fs');

const [PROFILE, NAME, RUNS = '1', TARGET = '30', ADS = '0'] = process.argv.slice(2);
const OUT = `${__dirname}/out_${NAME}`;
fs.mkdirSync(OUT, { recursive: true });
const logf = `${OUT}/log.jsonl`;
const log = (o) => { const l = JSON.stringify({ t: new Date().toISOString(), ...o }); fs.appendFileSync(logf, l + '\n'); console.log(l); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const META_PRIORITY = ['coin_magnet', 'extra_potion', 'potion_bag', 'candy_stock', 'night_regen', 'exp_share_base', 'sweet_tooth',
  'monster_charmer', 'super_potion_extra', 'checkpoint_heal', 'exp_share_total', 'held_item_bone', 'held_item_heart', 'fast_growth',
  'pumpkin_stock', 'candy_level_up', 'gravedigger_amulet', 'infinite_elixir', 'bench_training', 'held_item_mist', 'held_item_fang'];

let g = null, page = null, ctx = null;

async function findGame() {
  for (const f of page.frames()) {
    const ok = await f.evaluate(() => !!document.querySelector('#root') && !!window.bridge).catch(() => false);
    if (ok) return f;
  }
  return null;
}

async function openGame() {
  await page.goto('https://playgama.com/game/halloween-monsters', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(6000);
  await page.locator('button:has-text("Play Now")').first().click({ force: true }).catch(() => {});
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    if (i % 5 === 4) await page.mouse.click(1186, 53).catch(() => {}); // "Close" del pre-roll
    g = await findGame();
    if (g) break;
  }
  if (!g) throw new Error('game frame not found');
  log({ ev: 'game_loaded', url: g.url() });
  if (process.env.NEED && !g.url().includes(process.env.NEED)) { log({ ev: 'old_build_retry' }); await sleep(60000); g = null; return openGame(); }
  await sleep(4000);
}

const vis = async (sel) => g.locator(sel).first().isVisible().catch(() => false);
async function click(sel) {
  const l = g.locator(sel); const n = await l.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const e = l.nth(i);
    if (await e.isVisible().catch(() => false) && await e.isEnabled().catch(() => false)) { await e.click({ force: true }).catch(() => {}); return true; }
  }
  return false;
}
const text = () => g.locator('body').innerText().catch(() => '');

async function readState() {
  return g.evaluate(() => {
    const t = document.body.innerText;
    const coins = Number((t.match(/(\d+)\s*\n?\s*Cursed Coins/) || [])[1] || NaN);
    const wave = Number((t.match(/Wave (\d+)/) || [])[1] || NaN);
    return { coins, wave };
  }).catch(() => ({}));
}

async function enableFast() {
  if (!(await click('button:has-text("Settings")'))) return;
  await sleep(800);
  await g.evaluate(() => {
    const rows = [...document.querySelectorAll('button,[role=switch],label')];
    const r = rows.find(e => /Fast battles|Battaglie veloci/i.test(e.closest('div')?.innerText || '') && (e.getAttribute('role') === 'switch' || e.getAttribute('aria-checked') !== null));
    if (r && r.getAttribute('aria-checked') !== 'true') r.click();
  }).catch(() => {});
  await sleep(400);
  await click('button:has-text("Back")');
  await sleep(800);
}

async function metaShop() {
  await toTitle();
  if (!(await click('button:has-text("Meta Shop")'))) return;
  await sleep(1200);
  const bought = [];
  for (let k = 0; k < 40; k++) {
    // Prova gli upgrade in ordine di priorità cliccando la card col nome inglese
    let done = false;
    for (const id of META_PRIORITY) {
      const name = UP_NAMES[id]; if (!name) continue;
      const card = g.locator(`button:has-text("${name}")`).first();
      if (!(await card.isVisible().catch(() => false))) { await card.scrollIntoViewIfNeeded({ timeout: 500 }).catch(() => {}); }
      if (await card.count() && await card.isEnabled({ timeout: 500 }).catch(() => false) && await card.isVisible().catch(() => false)) {
        const before = (await readState()).coins;
        await card.click({ force: true }).catch(() => {});
        await sleep(500);
        if (await click('[role=dialog] button:has-text("Buy"), [role=dialog] button:has-text("Confirm")')) await sleep(400);
        const after = (await readState()).coins;
        if (after < before) { bought.push(id); done = true; break; }
      }
    }
    if (!done) break;
  }
  log({ ev: 'meta_shop', bought, coins: (await readState()).coins });
  await click('button:has-text("Back")');
  await sleep(1000);
}

const UP_NAMES = {
  coin_magnet: 'Cursed Magnet', sweet_tooth: 'Sweet Tooth', extra_potion: 'Extra Starting Potion', potion_bag: "Healer's Bag",
  candy_stock: 'Cursed Candy Stock', night_regen: 'Night Regeneration', exp_share_base: 'Basic EXP Share', monster_charmer: 'Monster Charmer',
  super_potion_extra: 'Extra Super Potion', checkpoint_heal: 'Free Gym Heal', exp_share_total: 'Total EXP Share', held_item_bone: 'Sacred Bones',
  held_item_heart: 'Pumpkin Heart', fast_growth: 'Fast Growth', pumpkin_stock: 'Empty Pumpkin Stock', candy_level_up: 'Sweet Treat',
  gravedigger_amulet: 'Gravedigger Amulet', infinite_elixir: 'Infinite Elixir', bench_training: 'Graveyard Gym', held_item_mist: 'Mist Amulet', held_item_fang: 'Vampire Fang',
};

async function toTitle() {
  for (let k = 0; k < 10; k++) {
    if (/A dark adventure awaits/.test(await text())) return;
    await g.locator('button:has-text("Back")').first().click({ force: true, timeout: 2000 }).catch(() => {});
    await sleep(1500);
  }
}

async function watchCoinAds(n) {
  await toTitle();
  for (let i = 0; i < n; i++) {
    if (!(await click('button:has-text("Free Coins")'))) break;
    await sleep(600);
    const before = (await readState()).coins;
    if (!(await click('[role=dialog] button.from-green-500'))) break;
    let res = 'timeout';
    for (let k = 0; k < 90; k++) {
      await sleep(1000);
      if (!(await vis('[role=dialog]'))) { res = 'closed'; break; }
      if (k > 15 && !(await vis('[role=dialog] button.from-green-500[disabled]'))) { res = 'modal_free'; break; }
    }
    await sleep(1500);
    const after = (await readState()).coins;
    log({ ev: 'coin_ad', i, res, before, after, rewarded: after > before });
    if (await vis('[role=dialog]')) await click('[role=dialog] button:has-text("Cancel")');
    await sleep(65000); // rispetta il ritmo delle pubblicità
  }
}

let interOpenSince = 0, captureTries = 0, teamFull = false, targetLoops = 0;
let catches = 0, potionUses = 0, battles = 0, turns = 0, healAds = 0, lastHealWave = 0;

async function battleStep() {
  if (await click('.bs-primary')) { await sleep(500); return; }
  if (await click('.bs-root button:has-text("Continue")')) { await sleep(800); return; }
  if (await vis('.bs-move-forget')) { await click('.bs-move-forget'); await sleep(400); return; }
  if (await vis('.bs-teamlist') && !(await vis('.bs-panel .bs-back'))) { await click('.bs-teammon:not([disabled]):not(:has-text("Fainted"))'); await sleep(500); return; }
  if (await vis('.bs-teamlist') && /Use on which monster/.test(await text())) {
    targetLoops++;
    if (targetLoops > 2 || !(await click('.bs-teammon:not([disabled]):has-text("In battle")'))) { await click('.bs-panel .bs-back'); await sleep(300); await click('.bs-panel .bs-back'); targetLoops = 0; }
    await sleep(500); return;
  }
  if (await vis('.bs-tabs') && await vis('.bs-panel .bs-back')) { await click('.bs-panel .bs-back'); await sleep(250); return; }
  if (await vis('.bs-moves') && await vis('.bs-panel .bs-back')) { await click('.bs-panel .bs-back'); await sleep(250); return; }
  if (!(await vis('.bs-cmd-fight'))) { await g.locator('.bs-textbox').click({ force: true }).catch(() => {}); await sleep(150); return; }

  const info = await g.evaluate(() => {
    const num = (document.querySelector('.bs-info-player .bs-info-hpnum') || {}).innerText || '';
    const m = num.match(/(\d+)\s*\/\s*(\d+)/);
    const ew = parseFloat((document.querySelector('.bs-info-enemy .bs-hp-fill') || {}).style?.width || '100');
    const chip = (document.querySelector('.bs-kind-chip') || {}).innerText || '';
    return { hp: m ? +m[1] : 1, max: m ? +m[2] : 1, ew, wild: /Wild/i.test(chip), full: /team is full/i.test(document.body.innerText) };
  }).catch(() => ({ hp: 1, max: 1, ew: 100, wild: false }));

  if (info.full) teamFull = true;
  // Cura sotto il 35%
  if (info.hp / info.max < 0.35) {
    await click('.bs-cmd-bag'); await sleep(250);
    await click('.bs-tab >> nth=0'); await sleep(200);
    const used = await click('.bs-items .bs-item:not([disabled]):has-text("HP")');
    if (used) {
      await sleep(400);
      if (await vis('.bs-teamlist')) { if (!(await click('.bs-teammon:not([disabled]):has-text("In battle")'))) await click('.bs-teammon:not([disabled]):not(:has-text("Fainted"))'); }
      potionUses++; await sleep(500); return;
    }
    await click('.bs-panel .bs-back'); await sleep(200);
  }
  // Cattura: selvatico indebolito, squadra non piena
  if (info.wild && info.ew < 55 && !teamFull && captureTries < 3) {
    captureTries++;
    await click('.bs-cmd-bag'); await sleep(250);
    await click('.bs-tab >> nth=1'); await sleep(200);
    const items = g.locator('.bs-items .bs-item:not([disabled])');
    const n = await items.count().catch(() => 0);
    if (n) {
      await items.nth(n - 1).click({ force: true }).catch(() => {});
      for (let k = 0; k < 40; k++) { await sleep(200); await g.locator('.bs-textbox').click({ force: true }).catch(() => {}); if (await vis('.bs-cmd-fight, .bs-primary, .bs-move-forget')) break; }
      const won = await vis('.bs-primary');
      if (won) catches++;
      return;
    }
    await click('.bs-panel .bs-back'); await sleep(200);
  }
  // Attacco: superefficace, poi la mossa più forte
  await click('.bs-cmd-fight'); await sleep(250);
  const idx = await g.evaluate(() => {
    const mv = [...document.querySelectorAll('.bs-move')];
    let best = -1, bv = -1;
    mv.forEach((b, i) => {
      if (b.disabled) return;
      const t = b.innerText; const pow = Number((t.match(/Pow (\d+)/) || [])[1] || 0);
      const eff = b.querySelector('.bs-eff.super') ? 2 : b.querySelector('.bs-eff.weak') ? 0.5 : b.querySelector('.bs-eff.none') ? 0 : 1;
      const v = (pow || 15) * eff;
      if (v > bv) { bv = v; best = i; }
    });
    return best;
  }).catch(() => 0);
  if (idx >= 0) await g.locator('.bs-move').nth(idx).click({ force: true }).catch(() => {}); else await click('.bs-panel .bs-back');
  turns++;
  for (let k = 0; k < 40; k++) { await sleep(150); await g.locator('.bs-textbox').click({ force: true }).catch(() => {}); if (await vis('.bs-cmd-fight, .bs-primary, .bs-move-forget, .bs-teamlist')) break; }
}

async function mapStep(run) {
  const t = await text();
  if (/Halloween Shop/.test(t)) {
    for (let k = 0; k < 6; k++) if (!(await click('button:has-text("Blood Potion"):not([disabled])'))) break; else await sleep(200);
    for (let k = 0; k < 3; k++) if (!(await click('button:has-text("Cursed Candy"):not([disabled])'))) break; else await sleep(200);
    await click('button:has-text("Return to Map"), button:has-text("Back")'); await sleep(700); return;
  }
  if (await click('button:has-text("Continue")')) { await sleep(600); return; }
  if (await vis('[role=dialog]')) { await click('[role=dialog] button:has-text("Cancel")'); await sleep(400); return; }
  // Cura completa con pubblicità ogni tanto (squadra in difficoltà prima del capopalestra)
  if ((ADS === '1' || ADS === '2') && healAds < 2) {
    const cleared = await g.evaluate(() => { const m = document.body.innerText.match(/(\d+)\/10 · nodes cleared/); return m ? +m[1] : -1; }).catch(() => -1);
    const fainted = await g.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^0\/\d+$/.test(e.textContent.trim())).length).catch(() => 0);
    if (((cleared >= 7 && fainted >= 1) || (cleared === 9 && lastHealWave !== (await readState()).wave)) && await vis('button:has-text("Heal Team"):not([disabled])')) {
      healAds++; lastHealWave = (await readState()).wave;
      await click('button:has-text("Heal Team")'); await sleep(700);
      await click('[role=dialog] button.from-green-500');
      let res = 'timeout'; for (let k = 0; k < 90; k++) { await sleep(1000); if (!(await vis('[role=dialog]'))) { res = 'closed'; break; } }
      log({ ev: 'heal_ad', run, res });
      return;
    }
  }
  const nodes = g.locator('button:not([disabled]) span.emoji');
  if (await nodes.count().catch(() => 0)) { await nodes.first().click({ force: true }).catch(() => {}); await sleep(800); return; }
  await sleep(500);
}

async function playRun(run, target, ads) {
  teamFull = false; catches = 0; potionUses = 0; battles = 0; turns = 0; healAds = 0;
  const start = Date.now();
  let resumedRun = false;
  for (let k = 0; k < 15; k++) {
    if (await click('button:has-text("Continue run")')) { resumedRun = true; log({ ev: 'resumed', run }); break; }
    if (await click('button:has-text("Start Game")')) break;
    await click('button:has-text("Back")'); await sleep(1500);
  }
  await sleep(1200);
  if (!resumedRun) {
    const starters = g.locator('button:has(h3)'); const sn = await starters.count();
    await starters.nth(Math.floor(Math.random() * Math.max(1, sn))).click({ force: true }).catch(() => {});
  }
  await sleep(1200);
  let emptyCount = 0;
  let lastWave = 0, revived = false, inBattle = false, stuck = 0, lastT = '';
  let lastShot = 0, lastAdCheck = 0;
  for (let step = 0; step < 200000; step++) {
    // Pubblicità a schermo intero di Playgama (tra le ondate): un giocatore la chiude con "Close"
    if (Date.now() - lastAdCheck > 3000) {
      lastAdCheck = Date.now();
      const st = await g.evaluate(() => { const a = window.bridge?.advertisement; return a?.interstitialState === 'opened' ? 'inter' : a?.rewardedState === 'opened' ? 'rew' : null; }).catch(() => null);
      if (st) {
        if (!interOpenSince) interOpenSince = Date.now();
        if (Date.now() - interOpenSince > (st === 'rew' ? 22000 : 8000)) {
          let closed = false;
          for (const f of page.frames()) { const c = f.getByText('Close', { exact: true }).first(); if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); closed = true; break; } }
          if (!closed) await page.mouse.click(1186, 53).catch(() => {});
          log({ ev: 'ad_close', kind: st, run, how: closed ? 'text' : 'coords' }); interOpenSince = 0;
        }
      } else interOpenSince = 0;
    }
    if (Date.now() - lastShot > 60000) { lastShot = Date.now(); await page.screenshot({ path: `${OUT}/live.png`, timeout: 8000 }).catch(() => {}); fs.writeFileSync(`${OUT}/live.txt`, ((await text()) || '').slice(0, 600)); }
    if (!g || g.isDetached()) { g = await findGame(); if (!g) throw new Error('frame lost'); }
    let t = await text();
    if (!t) {
      emptyCount++;
      if (emptyCount % 10 === 0) { g = await findGame(); await page.screenshot({ path: `${OUT}/empty_${run}_${emptyCount}.png` }).catch(() => {}); }
      if (emptyCount > 120) { log({ ev: 'RELOAD', run }); await openGame(); emptyCount = 0; }
      await sleep(1000); continue;
    }
    emptyCount = 0;
    if (/Halloween is saved/.test(t)) {
      log({ ev: 'GAME_COMPLETED', run, minutes: ((Date.now() - start) / 60000).toFixed(1), catches, potionUses });
      await g.locator('body').screenshot({ path: `${OUT}/final_${run}.png` }).catch(() => {});
      if (target > 30) await click('button:has-text("endless")'); else { await click('button:has-text("End the run")'); await sleep(3000); return { wave: 30, completed: true }; }
    }
    if (/Game Over/.test(t)) {
      const wave = Number((t.match(/ended at wave (\d+)/) || [])[1] || lastWave);
      if ((ads || ADS === '2') && !revived && await vis('button:has-text("Revive")')) {
        revived = true; await click('button:has-text("Revive")'); await sleep(600);
        await click('[role=dialog] button.from-green-500');
        let res = 'timeout'; for (let k = 0; k < 90; k++) { await sleep(1000); if (!(await vis('text=Game Over'))) { res = 'revived'; break; } if (!(await vis('[role=dialog]'))) { res = 'closed'; break; } }
        log({ ev: 'revive_ad', run, wave, res });
        if (res === 'revived') continue;
      }
      await g.locator('body').screenshot({ path: `${OUT}/gameover_${run}.png` }).catch(() => {});
      log({ ev: 'RUN_END', run, wave, minutes: ((Date.now() - start) / 60000).toFixed(1), catches, potionUses, battles, turns });
      await click('button:has-text("New Run")'); await sleep(3000);
      return { wave, completed: false };
    }
    if (/A dark adventure awaits/.test(t) && await vis('button:has-text("Continue run")')) {
      await click('button:has-text("Continue run")'); log({ ev: 'resumed', run }); await sleep(1500); continue;
    }
    if (/A dark adventure awaits/.test(t) && await vis('button:has-text("Start Game")')) {
      await click('button:has-text("Start Game")'); await sleep(1500);
      const st2 = g.locator('button:has(h3)'); if (await st2.count()) await st2.first().click({ force: true }).catch(() => {});
      await sleep(1200); continue;
    }
    const bs = await vis('.bs-root');
    if (bs) { if (!inBattle) { inBattle = true; battles++; captureTries = 0; } await battleStep(); }
    else {
      inBattle = false;
      const st = await readState();
      if (st.wave && st.wave !== lastWave) {
        lastWave = st.wave;
        const coins = await g.evaluate(() => (document.body.innerText.match(/🍬\s*(\d+)/) || [])[1]).catch(() => null);
        const heap = await g.evaluate(() => Math.round((performance.memory?.usedJSHeapSize || 0) / 1e6)).catch(() => -1);
        log({ ev: 'wave', heapMB: heap, run, wave: st.wave, minutes: ((Date.now() - start) / 60000).toFixed(1), candies: coins, catches, potionUses });
        await g.locator('body').screenshot({ path: `${OUT}/r${run}_w${st.wave}.png`, timeout: 8000 }).catch(() => {});
        if (st.wave > target) { log({ ev: 'target_reached', run, wave: st.wave }); return { wave: st.wave, completed: false, stopped: true }; }
      }
      await mapStep(run);
    }
    // anti-blocco
    const snap = t.slice(0, 400);
    stuck = snap === lastT ? stuck + 1 : 0; lastT = snap;
    if (stuck > 300) { log({ ev: 'STUCK', run, wave: lastWave, snippet: snap.slice(0, 200) }); await g.locator('body').screenshot({ path: `${OUT}/stuck_${run}_${Date.now()}.png` }).catch(() => {}); stuck = 0; await g.locator('.bs-textbox').click({ force: true }).catch(() => {}); }
  }
}

(async () => {
  ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1280, height: 800 } });
  page = ctx.pages()[0] || await ctx.newPage();
  ctx.setDefaultTimeout(15000);
  page.on('dialog', d => d.dismiss().catch(() => {}));
  for (let k = 0; k < 3; k++) { try { await openGame(); break; } catch (e) { log({ ev: 'open_retry', msg: String(e.message) }); } }
  g.page().on('console', () => {});
  await enableFast();
  await toTitle();
  log({ ev: 'fast_done' }); await g.locator('body').screenshot({ path: `${OUT}/after_fast.png` }).catch(() => {});
  const results = [];
  for (let run = 1; run <= Number(RUNS); run++) {
    try {
      if (!g || g.isDetached()) await openGame();
      if (ADS === '1' && run === 1) await watchCoinAds(3);
      await metaShop();
      const r = await playRun(run, Number(TARGET), ADS === '1');
      results.push(r);
      log({ ev: 'result', run, ...r, state: await readState() });
    } catch (e) {
      log({ ev: 'ERROR', run, msg: String(e && e.message || e) });
      await page.screenshot({ path: `${OUT}/error_${run}.png` }).catch(() => {});
      g = null;
      // La pagina di Playgama può andare in crash: si riapre (nuovo browser se serve) e si riprende la partita salvata
      try { await openGame(); run--; } catch (err) {
        log({ ev: 'ERROR_REOPEN', msg: String(err.message) });
        try { await ctx.close(); } catch {}
        ctx = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 1280, height: 800 } });
        ctx.setDefaultTimeout(15000);
        page = ctx.pages()[0] || await ctx.newPage();
        try { await openGame(); run--; } catch (e2) { log({ ev: 'ERROR_REOPEN2', msg: String(e2.message) }); }
      }
    }
  }
  log({ ev: 'ALL_DONE', results });
  await ctx.close();
})();
