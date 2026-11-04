import { resolveTurn, createBattleState, calcDamage, captureChance, BattleState } from '../../halloween-monsters-playgama/src/battle/engine';
import { buildEncounter } from '../../halloween-monsters-playgama/src/battle/encounters';
import { starters } from '../../halloween-monsters-playgama/src/data/monsters';
import { defaultItems } from '../../halloween-monsters-playgama/src/data/items';

const clone = (v: any) => JSON.parse(JSON.stringify(v));
const cfg = { lang: 'en' as const, lifestealBonus: 0, captureBonus: 0, expMult: 1, benchShare: 0, autoNet: false };
const SHARE = Number(process.env.SHARE || 0); cfg.benchShare = SHARE;
(globalThis as any).__HM_SLOPE = process.env.SLOPE; (globalThis as any).__HM_ATK = process.env.ATK;

function bestMove(s: BattleState) {
  const p = s.team[s.active], e = s.enemies[s.enemyActive];
  let best = -1, bv = -1;
  p.moves.forEach((m, i) => { if (m.pp <= 0) return; const v = m.power > 0 ? calcDamage(p, e, m, s.weather, false, true).damage * m.accuracy / 100 : 1; if (v > bv) { bv = v; best = i; } });
  return best < 0 ? 0 : best;
}
function runOnce() {
  let team = [clone(starters[Math.floor(Math.random() * starters.length)])]; team[0].expToNext = 60;
  let items = clone(defaultItems);
  let candies = 50;
  let statusTurnsSum = 0, turnsTotal = 0, statusedTurns = 0;
  for (let wave = 1; wave <= 40; wave++) {
    for (let node = 0; node < 10; node++) {
      const type = node === 9 ? 'gym_leader' : node === 8 ? 'rest' : (node === 3 || node === 7) ? 'shop' : node === 5 ? 'event' : (Math.random() < Math.min(0.6, 0.2 + wave * 0.01) ? 'trainer' : 'wild');
      if (type === 'shop') { while (candies >= 20) { const p = items.find((i: any) => i.id === 'pozione_sangue'); p.quantity++; candies -= 20; } continue; }
      if (type === 'event') { candies += 20; continue; }
      if (type === 'rest') { team.forEach((m: any) => { if (m.stats.hp > 0) m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + Math.ceil(m.stats.maxHp*0.5)); else m.stats.hp = Math.ceil(m.stats.maxHp*0.25); m.status=[]; }); continue; }
      const enc = buildEncounter(type as any, wave, node);
      let active = team.findIndex((m: any) => m.stats.hp > 0);
      let s = createBattleState({ team, enemies: enc.enemies, active, weather: 'normale', catchable: enc.catchable, kind: enc.kind, items });
      let guard = 0, out = 'continue';
      while (guard++ < 200) {
        const p = s.team[s.active];
        turnsTotal++; if (p.status.length) statusedTurns++;
        let action: any = { kind: 'move', index: bestMove(s) };
        const pot = s.items.find((i: any) => (i.id === 'pozione_sangue' || i.id === 'super_pozione') && i.quantity > 0);
        const e = s.enemies[s.enemyActive];
        if (p.stats.hp < p.stats.maxHp * 0.35 && pot) action = { kind: 'item', itemId: pot.id };
        else if (s.catchable && s.team.length < 4 && e.stats.hp < e.stats.maxHp * 0.7 && s.items.find((i: any) => i.id === 'caramella_stregata' && i.quantity > 0)) action = { kind: 'capture', itemId: 'caramella_stregata' };
        const r = resolveTurn(s, action, cfg);
        s = r.state; out = r.outcome;
        r.pendingMoves.forEach(pm => { const m = s.team[pm.teamIndex]; let w = 0; m.moves.forEach((mv: any, i: number) => { if (mv.power < m.moves[w].power) w = i; }); if (pm.move.power > m.moves[w].power) m.moves[w] = pm.move; });
        if (out === 'need_switch') { const idx = s.team.findIndex((m: any) => m.stats.hp > 0); const r2 = resolveTurn(s, { kind: 'switch', index: idx }, cfg); s = r2.state; out = r2.outcome; }
        if (out === 'victory' || out === 'defeat' || out === 'escaped') break;
      }
      team = s.team; items = s.items;
      if (process.env.TRACE) console.log(wave, node, type, enc.enemies.map((e: any) => e.id+':L'+e.level).join(','), '=>', out, team.map((m: any) => m.id+':L'+m.level+':'+m.stats.hp+'/'+m.stats.maxHp).join(' '), 'pots', items.filter((i:any)=>i.category==='potion').map((i:any)=>i.quantity).join('/'));
      if (out === 'defeat') return { wave, node, level: Math.max(...team.map((m: any) => m.level)), size: team.length, statusPct: statusedTurns / turnsTotal };
      candies += 20 + wave * 5; team.forEach((m: any) => { if (m.stats.hp > 0) m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + Math.ceil(m.stats.maxHp * Number(process.env.REST || 0.1))); });
      if (type === 'gym_leader') team.forEach((m: any) => { if (m.stats.hp > 0) m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + Math.floor(m.stats.maxHp * 0.3)); });
    }
  }
  return { wave: 41, node: 0, level: Math.max(...team.map((m: any) => m.level)), size: team.length, statusPct: statusedTurns / turnsTotal };
}
const N = Number(process.env.N || 300);
const res = Array.from({ length: N }, runOnce);
const waves = res.map(r => r.wave).sort((a, b) => a - b);
const hist: Record<number, number> = {}; waves.forEach(w => hist[w] = (hist[w] || 0) + 1);
console.log('median wave', waves[Math.floor(N / 2)], 'p25', waves[Math.floor(N / 4)], 'p75', waves[Math.floor(3 * N / 4)]);
console.log('hist', JSON.stringify(hist));
console.log('avg lvl at death', (res.reduce((a, r) => a + r.level, 0) / N).toFixed(1), 'avg team', (res.reduce((a, r) => a + r.size, 0) / N).toFixed(1), 'status turn %', (100 * res.reduce((a, r) => a + r.statusPct, 0) / N).toFixed(1));
console.log('died at gym node', res.filter(r => r.node === 9).length / N);
