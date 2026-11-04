// Autopilota: un'IA che gioca al posto del giocatore per farmare monete.
// Qui ci sono solo decisioni "pure" (nessuno stato React): la schermata di
// battaglia e App.tsx chiamano queste funzioni e poi premono i pulsanti veri.
//
// Regola fissa: l'autopilota non guarda MAI pubblicità e non fa acquisti
// con soldi veri. Usa solo quello che un giocatore otterrebbe giocando.
import type { ItemType, MapNode, MapNodeType, MetaUpgrade, Monster, Move, PersistentData } from './types';
import type { Language } from './i18n';
import {
  calcDamage, canReceiveStatus, captureChance, effectiveSpeed, majorStatusOf, moveEffectSummary,
  type BattleConfig, type BattleState, type PlayerAction,
} from './battle/engine';
import { canPurchaseUpgrade, getUpgradeCost } from './metaShop';
import { shopPrices } from './data/items';

const MAX_TEAM = 6;

// ------------------------------------------------------------
// Calcoli di base
// ------------------------------------------------------------

const hpRatio = (m: Monster) => (m.stats.maxHp > 0 ? Math.max(0, m.stats.hp) / m.stats.maxHp : 0);
const alive = (m: Monster) => m.stats.hp > 0;
const qty = (items: ItemType[], id: string) => items.find(i => i.id === id)?.quantity || 0;

/** Danno atteso (senza casualità) di una mossa, pesato per la precisione. */
function expectedDamage(attacker: Monster, defender: Monster, move: Move, weather: BattleState['weather']): number {
  if (move.power <= 0 || move.pp <= 0) return 0;
  return calcDamage(attacker, defender, move, weather, false, true).damage * (move.accuracy / 100);
}

/** Danno massimo per turno che un mostro può infliggere a un altro (mosse con PP). */
function bestDamage(attacker: Monster, defender: Monster, weather: BattleState['weather']): number {
  let best = 0;
  attacker.moves.forEach(mv => { best = Math.max(best, expectedDamage(attacker, defender, mv, weather)); });
  // Senza PP il mostro usa Scontro: danno piccolo ma non nullo
  return best || Math.max(1, attacker.level / 2);
}

/**
 * Quanto conviene mettere in campo `m` contro `e`: turni per andare KO
 * meno turni per mandare KO il nemico. Più alto è, meglio è.
 */
function matchupScore(m: Monster, e: Monster, weather: BattleState['weather']): number {
  if (!alive(m)) return -999;
  const out = bestDamage(m, e, weather);
  const inc = bestDamage(e, m, weather);
  const turnsToKill = e.stats.hp / Math.max(1, out);
  const turnsToDie = m.stats.hp / Math.max(1, inc);
  const speedBonus = effectiveSpeed(m) >= effectiveSpeed(e) ? 0.5 : 0;
  return Math.min(6, turnsToDie) - Math.min(6, turnsToKill) + speedBonus;
}

/** Valore di una mossa per decidere quale tenere quando se ne impara una nuova. */
function moveValue(m: Monster, move: Move): number {
  if (move.power > 0) return move.power * (move.accuracy / 100) * (move.type === m.type ? 1.5 : 1) + (move.effect ? 5 : 0);
  const s = moveEffectSummary(move);
  if (s.healPct) return 45;
  return 25;
}

// ------------------------------------------------------------
// Battaglia
// ------------------------------------------------------------

export interface AutoBattleMemory {
  switchesLeft: number; // cambi volontari ancora concessi in questa lotta (evita il ping-pong)
}

const POTIONS = ['pozione_sangue', 'super_pozione', 'iper_pozione'];
const CAPTURE_ORDER = ['caramella_stregata', 'zucca_vuota', 'bara_antica', 'rete_becchino', 'amuleto_maledetto', 'sfera_re_zucche'];

function isValuable(e: Monster): boolean {
  return Boolean(e.shiny || e.isBoss || e.rarity === 'epico' || e.rarity === 'leggendario' || e.rarity === 'mitico');
}

/** Pozione più adatta: la più piccola che copre quasi tutti i PS mancanti. */
function pickPotion(items: ItemType[], m: Monster): string | null {
  const missing = m.stats.maxHp - m.stats.hp;
  const owned = POTIONS
    .map(id => items.find(i => i.id === id))
    .filter((i): i is ItemType => Boolean(i && i.quantity > 0))
    .sort((a, b) => a.power - b.power);
  if (!owned.length) return null;
  const enough = owned.find(i => i.power >= missing * 0.7);
  return (enough || owned[owned.length - 1]).id;
}

/** Strumento di cattura da lanciare (o null se non conviene ancora). */
function pickCaptureItem(state: BattleState, cfg: BattleConfig, desperate: boolean): string | null {
  const e = state.enemies[state.enemyActive];
  const valuable = isValuable(e);
  const owned = CAPTURE_ORDER.filter(id => qty(state.items, id) > 0 && (id !== 'sfera_re_zucche' || valuable));
  if (!owned.length) return null;
  const withChance = owned.map(id => ({ id, chance: captureChance(e, id, cfg.captureBonus) }));
  const ratio = hpRatio(e);
  // Il più economico che abbia già buone probabilità
  const good = withChance.find(c => c.chance >= 0.5);
  if (good) return good.id;
  const best = withChance.reduce((a, b) => (b.chance > a.chance ? b : a));
  if (ratio <= 0.35 && best.chance >= 0.2) return best.id;
  if (desperate && best.chance >= 0.12) return best.id;
  return null;
}

/** Mossa migliore. Con `spare` evita di mandare KO il nemico (per catturarlo). */
export function chooseMoveIndex(state: BattleState, spare = false): number {
  const p = state.team[state.active];
  const e = state.enemies[state.enemyActive];
  if (!p || !e) return 0;
  const pRatio = hpRatio(p);
  const eRatio = hpRatio(e);
  const threat = bestDamage(e, p, state.weather) / Math.max(1, p.stats.hp);
  let best = -1;
  let bestScore = -Infinity;
  p.moves.forEach((mv, i) => {
    if (mv.pp <= 0) return;
    let score: number;
    if (mv.power > 0) {
      const dmg = expectedDamage(p, e, mv, state.weather);
      if (dmg <= 0) { score = -1; }
      else if (spare) {
        // Danno massimo possibile (con un piccolo margine per la casualità e i brutti colpi)
        const maxHit = calcDamage(p, e, mv, state.weather, false, true).damage * 1.25;
        score = maxHit < e.stats.hp ? dmg : -dmg / 1000;
      } else {
        score = dmg;
        if (dmg >= e.stats.hp) score = 10000 + mv.accuracy; // colpo di grazia: il più preciso
        if (mv.effect && mv.effectChance && canReceiveStatus(e, mv.effect) === 'ok' && !majorStatusOf(e)) score += e.stats.maxHp * 0.03 * (mv.effectChance / 100);
      }
    } else {
      const s = moveEffectSummary(mv);
      if (s.healPct) score = pRatio < 0.45 ? p.stats.maxHp * s.healPct * 0.9 : -1;
      else if (mv.effect) score = !majorStatusOf(e) && canReceiveStatus(e, mv.effect) === 'ok' && eRatio > 0.5 && threat < 0.35 ? e.stats.maxHp * 0.12 * (mv.accuracy / 100) : -1;
      else if (s.selfStat) {
        const st = p.stages || { attack: 0, defense: 0, speed: 0 };
        const useful = Object.entries(s.selfStat).some(([k, v]) => (st as any)[k] < 2 && (v || 0) > 0);
        score = useful && pRatio > 0.7 && threat < 0.25 && eRatio > 0.6 ? e.stats.maxHp * 0.1 : -1;
      } else if (s.targetStat) score = threat > 0.3 && eRatio > 0.6 ? e.stats.maxHp * 0.06 : -1;
      else score = -1;
    }
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best < 0 ? 0 : best;
}

/** Azione del turno decisa dall'autopilota. */
export function chooseBattleAction(state: BattleState, cfg: BattleConfig, mem: AutoBattleMemory): PlayerAction {
  const p = state.team[state.active];
  const e = state.enemies[state.enemyActive];
  if (!p || !e) return { kind: 'move', index: 0 };
  const items = state.items;
  const pRatio = hpRatio(p);
  const incoming = bestDamage(e, p, state.weather);
  const outgoing = bestDamage(p, e, state.weather);
  const faster = effectiveSpeed(p) >= effectiveSpeed(e);
  const canKoNow = outgoing >= e.stats.hp;
  const threat = incoming / Math.max(1, p.stats.hp);
  const healingLeft = POTIONS.reduce((n, id) => n + qty(items, id), 0);

  // 1) Capopalestra: Pozione della Non-Morte all'inizio della lotta
  if (state.kind === 'gym_leader' && !state.undeath && qty(items, 'pozione_non_morte') > 0) {
    return { kind: 'item', itemId: 'pozione_non_morte' };
  }

  // 2) Cura quando i PS sono bassi (se non può chiudere subito la lotta)
  const inDanger = pRatio < 0.35 || (pRatio < 0.6 && incoming >= p.stats.hp);
  if (inDanger && !(canKoNow && faster)) {
    const hurtAllies = state.team.filter(m => alive(m) && m.stats.maxHp - m.stats.hp >= 30).length;
    if (hurtAllies >= 2 && qty(items, 'frammento_luna') > 0) return { kind: 'item', itemId: 'frammento_luna' };
    const potion = pickPotion(items, p);
    if (potion && incoming < p.stats.maxHp * 0.9) return { kind: 'item', itemId: potion, targetIndex: state.active };
    if (majorStatusOf(p) && qty(items, 'candela_protettiva') > 0) return { kind: 'item', itemId: 'candela_protettiva', targetIndex: state.active };
  }

  // 3) Stati che bloccano (sonno, paralisi, putrefazione): Elisir
  const major = majorStatusOf(p);
  if (major && major !== 'bruciato' && pRatio > 0.3 && !(canKoNow && faster)) {
    if (qty(items, 'elisir_spettrale') > 0) return { kind: 'item', itemId: 'elisir_spettrale', targetIndex: state.active };
    if (qty(items, 'candela_protettiva') > 0) return { kind: 'item', itemId: 'candela_protettiva', targetIndex: state.active };
  }

  // 4) Cambio: se il mostro in campo perde nettamente e c'è un compagno migliore
  if (mem.switchesLeft > 0 && state.team.length > 1) {
    const current = matchupScore(p, e, state.weather);
    let bestIdx = -1;
    let bestScore = current;
    state.team.forEach((m, i) => {
      if (i === state.active || !alive(m) || hpRatio(m) < 0.5) return;
      // Entrando subisce un colpo: lo si considera nel punteggio
      const s = matchupScore(m, e, state.weather) - bestDamage(e, m, state.weather) / Math.max(1, bestDamage(m, e, state.weather)) * 0.3;
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    });
    if (bestIdx >= 0 && current < -1.5 && bestScore > current + 2.5) {
      mem.switchesLeft--;
      return { kind: 'switch', index: bestIdx };
    }
  }

  // 5) Cattura dei selvatici (squadra non piena)
  const capturing = state.catchable && state.team.length < MAX_TEAM && CAPTURE_ORDER.some(id => qty(items, id) > 0);
  if (capturing) {
    const desperate = pRatio < 0.3 && healingLeft === 0;
    const item = pickCaptureItem(state, cfg, desperate);
    if (item) return { kind: 'capture', itemId: item };
  }

  // 6) Resurrezione dei compagni (lotte contro allenatori e capipalestra)
  const fainted = state.team.map((m, i) => ({ m, i })).filter(x => !alive(x.m)).sort((a, b) => b.m.level - a.m.level);
  if (fainted.length && state.kind !== 'wild' && qty(items, 'lacrime_banshee') > 0 && pRatio > 0.5 && threat < 0.35) {
    return { kind: 'item', itemId: 'lacrime_banshee', targetIndex: fainted[0].i };
  }

  // 7) PP finiti sulle mosse d'attacco
  const attackMoves = p.moves.map((m, i) => ({ m, i })).filter(x => x.m.power > 0);
  if (attackMoves.length && attackMoves.every(x => x.m.pp <= 0)) {
    if (qty(items, 'cristallo_pp_totale') > 0) return { kind: 'item', itemId: 'cristallo_pp_totale', targetIndex: state.active };
    if (qty(items, 'cristallo_pp') > 0) {
      const strongest = attackMoves.reduce((a, b) => (b.m.power > a.m.power ? b : a));
      return { kind: 'item', itemId: 'cristallo_pp', targetIndex: state.active, moveIndex: strongest.i };
    }
  }

  // 8) Potenziamenti permanenti quando il nemico è innocuo
  if (threat < 0.12 && !canKoNow) {
    const strongest = state.team.map((m, i) => ({ m, i })).filter(x => alive(x.m)).sort((a, b) => b.m.level - a.m.level)[0];
    if (strongest && qty(items, 'caramella_rara') > 0) return { kind: 'item', itemId: 'caramella_rara', targetIndex: strongest.i };
    if (qty(items, 'nettare_zucca') > 0) return { kind: 'item', itemId: 'nettare_zucca', targetIndex: state.active };
  }

  // 9) Attacco (risparmiando il selvatico se lo vuole catturare)
  const spare = capturing && hpRatio(e) > 0.35;
  return { kind: 'move', index: chooseMoveIndex(state, spare) };
}

/** Mostro da mandare in campo dopo un KO. */
export function chooseForcedSwitch(state: BattleState): number {
  const e = state.enemies[state.enemyActive];
  let best = -1;
  let bestScore = -Infinity;
  state.team.forEach((m, i) => {
    if (!alive(m) || i === state.active) return;
    const s = e ? matchupScore(m, e, state.weather) : m.level;
    if (s > bestScore) { bestScore = s; best = i; }
  });
  return best < 0 ? Math.max(0, state.team.findIndex(alive)) : best;
}

/** Quale mossa dimenticare per impararne una nuova (null = non impararla). */
export function chooseMoveToForget(m: Monster, move: Move): number | null {
  if (!m) return null;
  if (m.moves.length < 4) return null;
  const newValue = moveValue(m, move);
  let worst = 0;
  m.moves.forEach((mv, i) => { if (moveValue(m, mv) < moveValue(m, m.moves[worst])) worst = i; });
  return newValue > moveValue(m, m.moves[worst]) ? worst : null;
}

// ------------------------------------------------------------
// Fuori dalla lotta
// ------------------------------------------------------------

export function chooseStarter(starters: Monster[]): number {
  let best = 0;
  let bestScore = -Infinity;
  starters.forEach((m, i) => {
    const s = m.stats.maxHp + m.stats.attack * 1.5 + m.stats.defense + m.stats.speed * 0.8;
    if (s > bestScore) { bestScore = s; best = i; }
  });
  return best;
}

/** Prossimo nodo della mappa (o -1 se nessuno è raggiungibile). */
export function chooseNode(map: MapNode[], currentNode: number, team: Monster[], candies: number): number {
  if (!map.length) return -1;
  if (currentNode < 0) return 0;
  const here = map[currentNode];
  if (here && !here.completed) return currentNode; // ritenta (es. dopo una resurrezione)
  const options = (here?.connections || []).filter(id => map[id] && !map[id].completed);
  if (!options.length) return -1;
  const living = team.filter(alive);
  const avgHp = living.length ? living.reduce((a, m) => a + hpRatio(m), 0) / team.length : 0;
  const score = (type: MapNodeType): number => {
    switch (type) {
      case 'rest': return 20 + (1 - avgHp) * 120;
      case 'shop': return candies >= 60 ? 45 : 15;
      case 'event': return 30;
      case 'wild': return (team.length < MAX_TEAM ? 55 : 30) + (avgHp > 0.5 ? 10 : -20);
      case 'trainer': return avgHp > 0.6 ? 50 : 10; // più monete, ma più rischio
      case 'gym_leader': return 0;
    }
  };
  return options.reduce((a, b) => (score(map[b].type) > score(map[a].type) ? b : a));
}

/** Indice del mostro da mettere in testa alla squadra prima della lotta (o -1). */
export function chooseLeadIndex(team: Monster[]): number {
  const first = team.findIndex(alive);
  if (first < 0) return -1;
  const value = (m: Monster) => (alive(m) ? m.level * (0.35 + hpRatio(m)) : -1);
  let best = first;
  team.forEach((m, i) => { if (value(m) > value(team[best]) * 1.15) best = i; });
  return best === first ? -1 : best;
}

/** Lista degli acquisti nel negozio della mappa (in dolcetti). */
export function planShop(items: ItemType[], candies: number, wave: number, teamSize: number, capOf: (id: string) => number): string[] {
  const owned: Record<string, number> = {};
  items.forEach(i => { owned[i.id] = i.quantity; });
  const cost = (id: string) => shopPrices.find(p => p.id === id)?.cost ?? Infinity;
  const cat = (id: string) => items.find(i => i.id === id)?.category;
  const plan: string[] = [];
  let money = candies;
  const canBuy = (id: string) => money >= cost(id) && (cat(id) !== 'potion' || (owned[id] || 0) < capOf(id));
  const buy = (id: string) => { plan.push(id); owned[id] = (owned[id] || 0) + 1; money -= cost(id); };
  const n = (id: string) => owned[id] || 0;

  for (let guard = 0; guard < 40; guard++) {
    const potions = n('pozione_sangue') + n('super_pozione') + n('iper_pozione');
    const wantedPotions = 3 + Math.min(4, Math.floor(wave / 4));
    const balls = n('caramella_stregata') + n('zucca_vuota') + n('bara_antica');
    if (potions < 2) {
      // Prima di tutto almeno due cure
      const id = wave >= 15 && canBuy('iper_pozione') ? 'iper_pozione' : wave >= 6 && canBuy('super_pozione') ? 'super_pozione' : 'pozione_sangue';
      if (canBuy(id)) { buy(id); continue; }
    }
    if (teamSize < MAX_TEAM && balls < 3) {
      const id = wave >= 10 && canBuy('bara_antica') ? 'bara_antica' : wave >= 5 && canBuy('zucca_vuota') ? 'zucca_vuota' : 'caramella_stregata';
      if (canBuy(id)) { buy(id); continue; }
    }
    if (potions < wantedPotions) {
      const id = wave >= 15 && canBuy('iper_pozione') ? 'iper_pozione' : wave >= 6 && canBuy('super_pozione') ? 'super_pozione' : 'pozione_sangue';
      if (canBuy(id)) { buy(id); continue; }
    }
    if (n('elisir_spettrale') < 1 && canBuy('elisir_spettrale')) { buy('elisir_spettrale'); continue; }
    if (n('lacrime_banshee') < 1 && money >= 280 && canBuy('lacrime_banshee')) { buy('lacrime_banshee'); continue; }
    if (wave >= 10 && n('cristallo_pp_totale') < 1 && money >= 120 && canBuy('cristallo_pp_totale')) { buy('cristallo_pp_totale'); continue; }
    if (wave >= 8 && n('pozione_non_morte') < 1 && money >= 220 && canBuy('pozione_non_morte')) { buy('pozione_non_morte'); continue; }
    if (money >= 350 && canBuy('caramella_rara')) { buy('caramella_rara'); continue; }
    break;
  }
  return plan;
}

// ------------------------------------------------------------
// Meta Negozio (tra una partita e l'altra)
// ------------------------------------------------------------

/** Ordine in cui l'autopilota compra i potenziamenti permanenti. */
export const META_PRIORITY = [
  'coin_magnet', 'extra_potion', 'potion_bag', 'candy_stock', 'night_regen', 'exp_share_base', 'sweet_tooth',
  'monster_charmer', 'super_potion_extra', 'checkpoint_heal', 'exp_share_total', 'held_item_bone', 'held_item_heart',
  'fast_growth', 'pumpkin_stock', 'candy_level_up', 'gravedigger_amulet', 'infinite_elixir', 'bench_training',
  'held_item_mist', 'held_item_fang', 'held_item_feather', 'held_item_eye', 'elisir_extra', 'coffin_stock',
  'gravedigger_net', 'exp_share_perfect',
];

/** Compra i potenziamenti in ordine di priorità finché bastano le monete. */
export function applyAutoUpgrades(data: PersistentData): { data: PersistentData; spent: number; bought: string[] } {
  let upgrades: MetaUpgrade[] = data.upgrades;
  let coins = data.cursedCoins;
  const bought: string[] = [];
  const order = [...META_PRIORITY, ...upgrades.map(u => u.id).filter(id => !META_PRIORITY.includes(id))];
  for (let guard = 0; guard < 200; guard++) {
    const next = order
      .map(id => upgrades.find(u => u.id === id))
      .find(u => u && u.category !== 'cosmetic' && canPurchaseUpgrade(u, upgrades, coins));
    if (!next) break;
    const cost = getUpgradeCost(next);
    coins -= cost;
    bought.push(next.id);
    upgrades = upgrades.map(u => u.id === next.id
      ? { ...u, currentLevel: u.maxLevel ? (u.currentLevel || 0) + 1 : u.currentLevel, purchased: true }
      : u);
  }
  return { data: { ...data, upgrades, cursedCoins: coins }, spent: data.cursedCoins - coins, bought };
}

// ------------------------------------------------------------
// Testi dell'interfaccia dell'autopilota
// ------------------------------------------------------------

const TEXT: Record<Language, Record<string, string>> = {
  en: {
    name: 'Autopilot', stop: 'Stop', starting: 'Starting in {n}…', runs: 'Runs', coins: 'Coins',
    playing: 'Playing for you', stopped: 'Autopilot stopped',
    started: 'Autopilot on: it will play for you', upgrades: 'Autopilot bought {n} upgrades',
  },
  it: {
    name: 'Autopilota', stop: 'Ferma', starting: 'Parte tra {n}…', runs: 'Partite', coins: 'Monete',
    playing: 'Gioca al posto tuo', stopped: 'Autopilota fermato',
    started: 'Autopilota attivo: gioca al posto tuo', upgrades: "L'autopilota ha comprato {n} potenziamenti",
  },
  fr: {
    name: 'Pilote auto', stop: 'Arrêter', starting: 'Départ dans {n}…', runs: 'Parties', coins: 'Pièces',
    playing: 'Joue à ta place', stopped: 'Pilote auto arrêté',
    started: 'Pilote auto activé : il joue à ta place', upgrades: 'Le pilote auto a acheté {n} améliorations',
  },
  es: {
    name: 'Piloto automático', stop: 'Parar', starting: 'Empieza en {n}…', runs: 'Partidas', coins: 'Monedas',
    playing: 'Juega por ti', stopped: 'Piloto automático detenido',
    started: 'Piloto automático activo: juega por ti', upgrades: 'El piloto automático compró {n} mejoras',
  },
  tr: {
    name: 'Otopilot', stop: 'Durdur', starting: '{n} sn sonra başlıyor…', runs: 'Oyunlar', coins: 'Paralar',
    playing: 'Senin yerine oynuyor', stopped: 'Otopilot durduruldu',
    started: 'Otopilot açık: senin yerine oynuyor', upgrades: 'Otopilot {n} geliştirme satın aldı',
  },
};

export function apText(key: string, lang: Language, vars?: Record<string, string | number>): string {
  let s = (TEXT[lang] || TEXT.en)[key] ?? TEXT.en[key] ?? key;
  if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, String(v)); });
  return s;
}
