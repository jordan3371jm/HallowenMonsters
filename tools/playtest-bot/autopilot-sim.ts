import { resolveTurn, createBattleState, cleanupAfterBattle, expForLevel } from '../../halloween-monsters-playgama/src/battle/engine';
import { buildEncounter } from '../../halloween-monsters-playgama/src/battle/encounters';
import { starters } from '../../halloween-monsters-playgama/src/data/monsters';
import { defaultItems, shopPrices } from '../../halloween-monsters-playgama/src/data/items';
import { chooseBattleAction, chooseForcedSwitch, chooseMoveIndex, chooseMoveToForget, chooseNode, chooseStarter, planShop, chooseLeadIndex } from '../../halloween-monsters-playgama/src/autopilot';
const clone = (v: any) => JSON.parse(JSON.stringify(v));
const cfg = { lang: 'en' as const, lifestealBonus: 0, captureBonus: 0, expMult: 1, benchShare: 0.15, autoNet: false };
function genMap(wave: number) {
  const types: any[] = [];
  for (let i = 0; i < 10; i++) types.push(i === 9 ? 'gym_leader' : wave === 1 && i <= 2 ? (i === 2 ? 'trainer' : 'wild') : (i === 3 || i === 7) ? 'shop' : i === 5 ? 'event' : i === 8 ? 'rest' : Math.random() < Math.min(0.6, 0.2 + wave * 0.01) ? 'trainer' : 'wild');
  return types.map((type, i) => { const c: number[] = []; if (i < 9) { c.push(i + 1); if (i + 2 < 10 && !(wave === 1 && i < 2) && Math.random() < Math.min(0.7, 0.3 + wave * 0.02)) c.push(i + 2); } return { id: i, type, completed: false, connections: c }; });
}
let stuck = 0, invalid = 0, captures = 0, itemsUsed = 0, switches = 0;
function runOnce() {
  const pick = [...starters].sort(() => Math.random() - 0.5).slice(0, 3);
  const st = clone(pick[chooseStarter(pick)]); st.exp = 0; st.expToNext = expForLevel(st.level);
  let team = [st]; let items = clone(defaultItems); let candies = 50;
  for (let wave = 1; wave <= 40; wave++) {
    const map = genMap(wave); let cur = -1;
    while (true) {
      const li = chooseLeadIndex(team); if (li > 0) { const [m] = team.splice(li, 1); team.unshift(m); }
      const node = chooseNode(map as any, cur, team, candies); if (node < 0) break;
      cur = node; const type = map[node].type;
      if (type === 'shop') { map[node].completed = true; for (const id of planShop(items, candies, wave, team.length, () => 5)) { items.find((i: any) => i.id === id).quantity++; candies -= shopPrices.find(p => p.id === id)!.cost; } continue; }
      if (type === 'event') { map[node].completed = true; candies += 20; continue; }
      if (type === 'rest') { map[node].completed = true; team.forEach((m: any) => { m.stats.hp = m.stats.hp > 0 ? Math.min(m.stats.maxHp, m.stats.hp + Math.ceil(m.stats.maxHp * .5)) : Math.max(1, Math.floor(m.stats.maxHp * .25)); m.status = []; m.statusTurns = {}; m.moves.forEach((mv: any) => mv.pp = Math.min(mv.maxPp, mv.pp + 5)); }); continue; }
      const enc = buildEncounter(type, wave, node);
      let s = createBattleState({ team, enemies: enc.enemies, active: Math.max(0, team.findIndex((m: any) => m.stats.hp > 0)), weather: 'normale', catchable: enc.catchable, kind: enc.kind, items });
      const mem = { switchesLeft: 2 }; let out = 'continue', guard = 0;
      while (guard++ < 300) {
        const a = chooseBattleAction(s, cfg, mem);
        if (a.kind === 'item') itemsUsed++; if (a.kind === 'switch') switches++;
        let r = resolveTurn(s, a, cfg);
        if (!r.consumedTurn) { invalid++; r = resolveTurn(s, { kind: 'move', index: chooseMoveIndex(s) }, cfg); }
        captures += r.stats.caught.length;
        s = r.state; out = r.outcome;
        r.pendingMoves.forEach(pm => { const m = s.team[pm.teamIndex]; const f = chooseMoveToForget(m, pm.move); if (f !== null) m.moves[f] = clone(pm.move); });
        while (out === 'need_switch') { const r2 = resolveTurn(s, { kind: 'switch', index: chooseForcedSwitch(s) }, cfg); s = r2.state; out = r2.outcome; }
        if (out === 'victory' || out === 'defeat' || out === 'escaped') break;
      }
      if (guard >= 300) stuck++;
      team = s.team.map((m: any) => cleanupAfterBattle(m)); items = s.items;
      if (out === 'defeat') return { wave, size: team.length, lvl: Math.max(...team.map((m: any) => m.level)) };
      map[node].completed = true;
      candies += type === 'gym_leader' ? 100 + wave * 6 : (type === 'trainer' ? 30 : 20) + wave * 3;
      team.forEach((m: any) => { if (m.stats.hp > 0) m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + Math.ceil(m.stats.maxHp * 0.1)); });
    }
  }
  return { wave: 41, size: team.length, lvl: Math.max(...team.map((m: any) => m.level)) };
}
const N = Number(process.env.N || 200);
const res = Array.from({ length: N }, runOnce);
const w = res.map(r => r.wave).sort((a, b) => a - b);
console.log('AUTOPILOT median wave', w[N >> 1], 'p25', w[N >> 2], 'p75', w[(3 * N) >> 2], 'avg team', (res.reduce((a, r) => a + r.size, 0) / N).toFixed(1), 'avg lvl', (res.reduce((a, r) => a + r.lvl, 0) / N).toFixed(1));
console.log('stuck', stuck, 'invalid', invalid, 'captures/run', (captures / N).toFixed(1), 'items/run', (itemsUsed / N).toFixed(1), 'switches/run', (switches / N).toFixed(1));
