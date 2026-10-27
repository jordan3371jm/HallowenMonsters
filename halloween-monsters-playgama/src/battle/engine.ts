// ============================================================
// MOTORE DI BATTAGLIA (puro, senza React)
// Risolve un intero turno e restituisce la sequenza di eventi da
// riprodurre (testo, animazioni, suoni) con lo stato dopo ogni evento.
// Regole ispirate ai giochi Pokémon:
//  - tabella dei tipi con superefficace / poco efficace / nessun effetto
//  - STAB, brutti colpi, variazione casuale del danno
//  - un solo stato "maggiore" alla volta, stati con durata limitata,
//    immunità di tipo, probabilità secondarie basse
//  - modificatori di statistica (-4..+4) per le mosse di stato
// ============================================================
import type { ItemType, Monster, MonsterType, Move, StatusEffect } from '../types';
import type { Language } from '../i18n';
import { tItem, tMonster, tMove } from '../i18n';
import { allMoves, getMoveEffectiveness, starters, wildMonsters, rareMonsters, legendaryMonsters, mythicalMonsters, gymLeaderMonsters } from '../data/monsters';
import {
  tAbilityName, getAbilityDamageMultiplier, getAbilityDefenseMultiplier, getDodgeChance, getLifesteal,
  getCounter, getAttackerAccuracyMod, getOnHitStatus, getTurnRegen, getModifiedEffectChance, isStatusImmune,
  getAbilityDef,
} from '../abilities';
import { bt } from './battleText';

export type Weather = 'normale' | 'luna_piena' | 'nebbia' | 'notte_halloween';
export type BattleKind = 'wild' | 'trainer' | 'gym_leader';
export type Side = 'player' | 'enemy';
type Stat = 'attack' | 'defense' | 'speed';

export const MAJOR_STATUS: StatusEffect[] = ['bruciato', 'putrefatto', 'paralizzato', 'sonnambulo'];
export const VOLATILE_STATUS: StatusEffect[] = ['spaventato', 'maledetto'];

/** Tipi immuni a uno stato (es. i mostri Fuoco non si scottano). */
export const STATUS_TYPE_IMMUNITY: Record<StatusEffect, MonsterType[]> = {
  bruciato: ['fuoco'],
  putrefatto: ['veleno', 'osso'],
  paralizzato: ['tuono'],
  sonnambulo: ['spettro'],
  spaventato: ['buio'],
  maledetto: ['zucca'],
};

const STATUS_DURATION: Record<StatusEffect, () => number> = {
  bruciato: () => 4,
  putrefatto: () => 4,
  paralizzato: () => 3,
  sonnambulo: () => 1 + Math.floor(Math.random() * 3),
  spaventato: () => 3,
  maledetto: () => 3,
};

/** Mosse di stato senza danno: modificatori e cure. */
export const STAT_MOVES: Record<string, { self?: Partial<Record<Stat, number>>; target?: Partial<Record<Stat, number>>; healPct?: number }> = {
  riflesso: { self: { defense: 1 } },
  scudo_osso: { self: { defense: 2 } },
  barriera_acqua: { self: { defense: 2 } },
  muro_di_fuoco: { self: { defense: 1, attack: 1 } },
  meditazione: { self: { attack: 1 } },
  danza_guerra: { self: { attack: 1, speed: 1 } },
  terrore: { target: { attack: -1 } },
  ruggito: { target: { attack: -1 } },
  fotosintesi: { healPct: 0.4 },
};

const CRIT_CHANCE = 0.0625;
const LEARN_LEVELS = new Set([7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 45, 50]);

export interface BattleState {
  team: Monster[];
  enemies: Monster[];
  active: number;
  enemyActive: number;
  weather: Weather;
  catchable: boolean;
  kind: BattleKind;
  items: ItemType[];
  undeath: boolean; // Pozione della Non-Morte attiva in questa lotta
  runAttempts: number;
  participants: number[]; // indici dei mostri scesi in campo (ricevono EXP piena)
}

export interface BattleConfig {
  lang: Language;
  lifestealBonus: number; // Zanna di Vampiro
  captureBonus: number; // Incantatore di Mostri (% per livello)
  expMult: number; // Crescita Rapida
  benchShare: number; // Condivisione EXP (0..1)
  autoNet: boolean; // Rete del Becchino (potenziamento)
}

export interface Snapshot {
  team: Monster[];
  enemies: Monster[];
  active: number;
  enemyActive: number;
}

export type BattleEvent =
  | { type: 'msg'; text: string; snap: Snapshot }
  | { type: 'move'; side: Side; moveType: MonsterType; power: number; moveId: string; text: string; snap: Snapshot }
  | { type: 'hit'; side: Side; amount: number; effectiveness: number; crit: boolean; snap: Snapshot }
  | { type: 'miss'; side: Side; text: string; snap: Snapshot }
  | { type: 'status'; side: Side; status: StatusEffect; text: string; snap: Snapshot }
  | { type: 'tick'; side: Side; status: StatusEffect; amount: number; text: string; snap: Snapshot }
  | { type: 'stat'; side: Side; up: boolean; text: string; snap: Snapshot }
  | { type: 'heal'; side: Side; amount: number; text: string; snap: Snapshot }
  | { type: 'faint'; side: Side; text: string; snap: Snapshot }
  | { type: 'switch'; side: Side; text: string; snap: Snapshot }
  | { type: 'capture'; shakes: number; success: boolean; itemId: string; text: string; snap: Snapshot }
  | { type: 'levelup'; teamIndex: number; text: string; snap: Snapshot }
  | { type: 'evolve'; teamIndex: number; text: string; snap: Snapshot };

export type PlayerAction =
  | { kind: 'move'; index: number }
  | { kind: 'switch'; index: number }
  | { kind: 'item'; itemId: string; targetIndex?: number; moveIndex?: number }
  | { kind: 'capture'; itemId: string }
  | { kind: 'run' };

export type Outcome = 'continue' | 'victory' | 'defeat' | 'need_switch' | 'escaped';

export interface TurnStats {
  defeated: number;
  caught: string[];
  damageDealt: number;
  damageTaken: number;
  healing: number;
  movesUsed: number;
  crits: number;
  superEffective: number;
  statusInflicted: number;
  itemsUsed: number;
  evolutions: number;
}

export interface TurnResult {
  state: BattleState;
  events: BattleEvent[];
  outcome: Outcome;
  stats: TurnStats;
  pendingMoves: { teamIndex: number; move: Move }[];
  consumedTurn: boolean; // false se l'azione non era valida (nessun turno speso)
}

// ------------------------------------------------------------
// Helper generali
// ------------------------------------------------------------

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

function stagesOf(m: Monster) {
  if (!m.stages) m.stages = { attack: 0, defense: 0, speed: 0 };
  return m.stages;
}

export function hasStatus(m: Monster, s: StatusEffect): boolean {
  return m.status.includes(s);
}

export function majorStatusOf(m: Monster): StatusEffect | undefined {
  return m.status.find(s => MAJOR_STATUS.includes(s));
}

export function effectiveSpeed(m: Monster): number {
  let speed = m.stats.speed * stageMult(stagesOf(m).speed);
  if (hasStatus(m, 'paralizzato')) speed *= 0.5;
  if (hasStatus(m, 'spaventato')) speed *= 0.75;
  return speed;
}

/** Prepara un mostro per una nuova lotta: azzera modificatori e stati volatili. */
export function prepareForBattle(m: Monster): Monster {
  m.stages = { attack: 0, defense: 0, speed: 0 };
  m.survivedUsed = false;
  m.status = (m.status || []).filter(s => MAJOR_STATUS.includes(s));
  // Un solo stato maggiore: tiene il primo
  if (m.status.length > 1) m.status = [m.status[0]];
  m.statusTurns = m.statusTurns || {};
  for (const s of m.status) {
    if (!m.statusTurns[s]) m.statusTurns[s] = s === 'sonnambulo' ? (m.sleepTurns || 2) : STATUS_DURATION[s]();
  }
  m.sleepTurns = undefined;
  delete (m as any)._faintHandled;
  return m;
}

/** Pulisce lo stato di battaglia a fine lotta (gli stati maggiori restano con i turni residui). */
export function cleanupAfterBattle(m: Monster): Monster {
  delete (m as any)._faintHandled;
  m.stages = undefined;
  m.survivedUsed = undefined;
  m.status = (m.status || []).filter(s => MAJOR_STATUS.includes(s));
  if (m.statusTurns) {
    for (const key of Object.keys(m.statusTurns) as StatusEffect[]) {
      if (!m.status.includes(key)) delete m.statusTurns[key];
    }
  }
  return m;
}

export function canReceiveStatus(m: Monster, s: StatusEffect): 'ok' | 'type' | 'ability' | 'has' {
  if (STATUS_TYPE_IMMUNITY[s].includes(m.type)) return 'type';
  if (isStatusImmune(m.ability, s)) return 'ability';
  if (MAJOR_STATUS.includes(s) && majorStatusOf(m)) return 'has';
  if (m.status.includes(s)) return 'has';
  return 'ok';
}

export function calcDamage(
  attacker: Monster,
  defender: Monster,
  move: Move,
  weather: Weather,
  forceCrit?: boolean,
  noRandom?: boolean,
): { damage: number; effectiveness: number; crit: boolean } {
  const effectiveness = getMoveEffectiveness(move.type, defender.type);
  if (move.power <= 0 || effectiveness === 0) return { damage: 0, effectiveness, crit: false };
  const crit = forceCrit ?? Math.random() < CRIT_CHANCE;
  const atkStage = stagesOf(attacker).attack;
  const defStage = stagesOf(defender).defense;
  // Il brutto colpo ignora i cali di attacco e gli aumenti di difesa
  const atk = attacker.stats.attack * stageMult(crit ? Math.max(0, atkStage) : atkStage);
  const def = Math.max(1, defender.stats.defense * stageMult(crit ? Math.min(0, defStage) : defStage));
  const levelMod = (2 * attacker.level) / 5 + 2;
  let damage = (levelMod * move.power * (atk / def)) / 50 + 2;
  if (attacker.type === move.type) damage *= 1.5;
  damage *= effectiveness;
  if (crit) damage *= 1.5;
  damage *= noRandom ? 0.925 : 0.85 + Math.random() * 0.15;
  if (hasStatus(attacker, 'maledetto')) damage *= 0.8;
  if (hasStatus(attacker, 'bruciato')) damage *= 0.85;
  if (weather === 'luna_piena' && move.type === 'spettro') damage *= 1.2;
  if (weather === 'notte_halloween' && (move.type === 'buio' || move.type === 'spettro')) damage *= 1.2;
  damage *= getAbilityDamageMultiplier(attacker.ability, move.type, weather);
  damage *= getAbilityDefenseMultiplier(defender.ability, move.type, defender.stats.hp / Math.max(1, defender.stats.maxHp));
  return { damage: Math.max(1, Math.floor(damage)), effectiveness, crit };
}

/** Probabilità di cattura (0..1) mostrata anche nell'interfaccia. */
export function captureChance(target: Monster, itemId: string, captureBonus: number): number {
  if (itemId === 'sfera_re_zucche') return 1;
  const hpRatio = target.stats.hp / Math.max(1, target.stats.maxHp);
  if (itemId === 'rete_becchino' && hpRatio <= 0.2) return 1;
  const itemMult: Record<string, number> = {
    caramella_stregata: 1, zucca_vuota: 1.5, bara_antica: 2, rete_becchino: 2, amuleto_maledetto: 3,
  };
  const rarityMult: Record<string, number> = {
    comune: 1, non_comune: 0.85, raro: 0.6, epico: 0.45, leggendario: 0.22, mitico: 0.12,
  };
  const hpFactor = (3 - 2 * hpRatio) / 3;
  const major = majorStatusOf(target);
  const statusMult = major === 'sonnambulo' ? 2 : major ? 1.5 : 1;
  const levelFactor = Math.max(0.55, 1 - target.level / 120);
  const chance = 0.42 * (itemMult[itemId] ?? 1) * hpFactor * statusMult * (rarityMult[target.rarity || 'comune'] ?? 1) * levelFactor
    + captureBonus / 100;
  return Math.max(0.03, Math.min(0.98, chance));
}

// ------------------------------------------------------------
// Crescita (usata sia dal motore sia fuori dalla lotta)
// ------------------------------------------------------------

/** Alza un mostro fino al livello indicato (statistiche come un normale level up, senza mosse nuove). */
export function raiseToLevel(m: Monster, level: number): void {
  while (m.level < level) {
    m.level++;
    m.stats.maxHp += 3;
    m.stats.hp += 3;
    m.stats.attack += 2;
    m.stats.defense += 1;
    m.stats.speed += 1;
  }
  m.exp = 0;
  m.expToNext = expForLevel(m.level);
}

/** EXP necessaria per passare dal livello indicato al successivo. */
export function expForLevel(level: number): number {
  return 8 * level + 20;
}

const allTemplates = (): Monster[] => [...starters, ...wildMonsters, ...rareMonsters, ...legendaryMonsters, ...mythicalMonsters, ...gymLeaderMonsters];

function pickLearnableMove(mon: Monster): Move | null {
  const known = new Set(mon.moves.map(m => m.id));
  const strongAllowed = mon.rarity === 'leggendario' || mon.rarity === 'mitico';
  const pool = allMoves.filter(m => !known.has(m.id) && (strongAllowed || m.power < 100));
  const sameType = pool.filter(m => m.type === mon.type);
  const coverage = pool.filter(m => m.type !== mon.type && m.power > 0);
  const source = Math.random() < 0.6 && sameType.length ? sameType : coverage.length ? coverage : sameType;
  if (!source.length) return null;
  // Preferisce mosse non più deboli della media attuale
  const avg = mon.moves.reduce((sum, m) => sum + m.power, 0) / Math.max(1, mon.moves.length);
  const better = source.filter(m => m.power === 0 || m.power >= avg - 5);
  const list = better.length ? better : source;
  return clone(list[Math.floor(Math.random() * list.length)]);
}

export interface GrowthResult {
  messages: { text: string; kind: 'levelup' | 'evolve' | 'learn' }[];
  pending: Move[];
  evolved: boolean;
}

/** Aggiunge EXP a un mostro gestendo livelli, mosse ed evoluzioni. */
export function addExperience(mon: Monster, exp: number, lang: Language): GrowthResult {
  const result: GrowthResult = { messages: [], pending: [], evolved: false };
  if (mon.stats.hp <= 0 || exp <= 0) return result;
  mon.exp += exp;
  let guard = 0;
  while (mon.exp >= mon.expToNext && guard++ < 50) {
    const previousLevel = mon.level;
    mon.exp -= mon.expToNext;
    mon.level++;
    mon.expToNext = expForLevel(mon.level);
    mon.stats.maxHp += 3;
    mon.stats.hp += 3;
    mon.stats.attack += 2;
    mon.stats.defense += 1;
    mon.stats.speed += 1;
    result.messages.push({ text: bt('levelup', lang, { m: tMonster(mon.id, lang), n: mon.level }), kind: 'levelup' });

    if (LEARN_LEVELS.has(mon.level)) {
      const move = pickLearnableMove(mon);
      if (move) {
        if (mon.moves.length < 4) {
          mon.moves.push(move);
          result.messages.push({ text: bt('learn', lang, { m: tMonster(mon.id, lang), move: tMove(move.id, lang) }), kind: 'learn' });
        } else {
          result.pending.push(move);
          result.messages.push({ text: bt('wants_learn', lang, { m: tMonster(mon.id, lang), move: tMove(move.id, lang) }), kind: 'learn' });
        }
      }
    }

    const evolution = mon.evolutions?.find(e => previousLevel < e.level && mon.level >= e.level);
    if (evolution) {
      const oldName = tMonster(mon.id, lang);
      result.messages.push({ text: bt('evolve', lang, { m: oldName }), kind: 'evolve' });
      mon.id = evolution.id;
      mon.name = evolution.name;
      mon.emoji = evolution.emoji;
      const template = allTemplates().find(t => t.id === evolution.id);
      if (template) {
        mon.type = template.type;
        mon.ability = template.ability;
        mon.abilityDesc = template.abilityDesc;
        mon.rarity = template.rarity;
        mon.tier = template.tier;
        mon.evolutions = template.evolutions;
      }
      mon.stats.maxHp += 15;
      mon.stats.hp += 15;
      mon.stats.attack += 8;
      mon.stats.defense += 5;
      mon.stats.speed += 4;
      result.evolved = true;
      result.messages.push({ text: bt('evolved', lang, { m: tMonster(mon.id, lang) }), kind: 'evolve' });
      const move = pickLearnableMove({ ...mon, moves: mon.moves.filter(Boolean) });
      if (move && move.type === mon.type) {
        if (mon.moves.length < 4) {
          mon.moves.push(move);
          result.messages.push({ text: bt('learn', lang, { m: tMonster(mon.id, lang), move: tMove(move.id, lang) }), kind: 'learn' });
        } else {
          result.pending.push(move);
          result.messages.push({ text: bt('wants_learn', lang, { m: tMonster(mon.id, lang), move: tMove(move.id, lang) }), kind: 'learn' });
        }
      }
    }
  }
  return result;
}

// ------------------------------------------------------------
// IA nemica
// ------------------------------------------------------------

export function chooseEnemyMove(enemy: Monster, target: Monster, kind: BattleKind, weather: Weather): number {
  if (!enemy.moves.length) return -1;
  const scores = enemy.moves.map(move => {
    const statMove = STAT_MOVES[move.id];
    if (move.power > 0) {
      const { damage, effectiveness } = calcDamage(enemy, target, move, weather, false, true);
      if (effectiveness === 0) return 0;
      let score = damage * (move.accuracy / 100);
      if (damage >= target.stats.hp) score *= 1.6; // colpo di grazia
      return score;
    }
    if (move.effect) {
      const can = canReceiveStatus(target, move.effect);
      return can === 'ok' ? Math.max(4, target.stats.maxHp * 0.12) * (move.accuracy / 100) : 0;
    }
    if (statMove?.healPct) {
      return enemy.stats.hp < enemy.stats.maxHp * 0.5 ? enemy.stats.maxHp * 0.3 : 0;
    }
    if (statMove?.self) {
      const st = stagesOf(enemy);
      const useful = Object.entries(statMove.self).some(([k, v]) => (st as any)[k] < 2 && (v || 0) > 0);
      return useful && enemy.stats.hp > enemy.stats.maxHp * 0.5 ? target.stats.maxHp * 0.1 : 0;
    }
    if (statMove?.target) {
      return stagesOf(target).attack > -2 ? target.stats.maxHp * 0.08 : 0;
    }
    return 1;
  });
  const total = scores.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(Math.random() * enemy.moves.length);
  const smart = kind === 'gym_leader' ? 0.85 : kind === 'trainer' ? 0.7 : 0.45;
  if (Math.random() < smart) {
    let best = 0;
    scores.forEach((s, i) => { if (s > scores[best]) best = i; });
    return best;
  }
  let roll = Math.random() * total;
  for (let i = 0; i < scores.length; i++) {
    roll -= scores[i];
    if (roll <= 0) return i;
  }
  return scores.length - 1;
}

// ------------------------------------------------------------
// Risoluzione del turno
// ------------------------------------------------------------

export function resolveTurn(input: BattleState, action: PlayerAction, cfg: BattleConfig): TurnResult {
  const S = clone(input);
  const lang = cfg.lang;
  const events: BattleEvent[] = [];
  const stats: TurnStats = {
    defeated: 0, caught: [], damageDealt: 0, damageTaken: 0, healing: 0, movesUsed: 0,
    crits: 0, superEffective: 0, statusInflicted: 0, itemsUsed: 0, evolutions: 0,
  };
  const pendingMoves: { teamIndex: number; move: Move }[] = [];
  let outcome: Outcome = 'continue';
  let consumedTurn = true;

  const snap = (): Snapshot => ({ team: clone(S.team), enemies: clone(S.enemies), active: S.active, enemyActive: S.enemyActive });
  const msg = (text: string) => events.push({ type: 'msg', text, snap: snap() });
  const P = () => S.team[S.active];
  const E = () => S.enemies[S.enemyActive];
  const mon = (side: Side) => (side === 'player' ? P() : E());
  const other = (side: Side): Side => (side === 'player' ? 'enemy' : 'player');
  const name = (m: Monster) => tMonster(m.id, lang);
  const findItem = (id: string) => S.items.find(i => i.id === id);

  const finishResult = (): TurnResult => {
    // Vittoria "pirrica": se anche l'ultimo mostro del giocatore è a terra, la run finisce
    if (outcome === 'victory' && S.team.every(m => m.stats.hp <= 0)) {
      outcome = 'defeat';
      msg(bt('defeat', lang));
    } else if (outcome === 'victory' && P() && P().stats.hp <= 0) {
      // Il mostro attivo è esausto: alla prossima lotta entra il primo disponibile
      S.active = S.team.findIndex(m => m.stats.hp > 0);
    }
    if (outcome === 'victory' || outcome === 'defeat' || outcome === 'escaped') {
      S.team.forEach(cleanupAfterBattle);
    }
    return { state: S, events, outcome, stats, pendingMoves, consumedTurn };
  };

  const applyStatus = (side: Side, status: StatusEffect, silentFail: boolean): boolean => {
    const target = mon(side);
    if (!target || target.stats.hp <= 0) return false;
    const can = canReceiveStatus(target, status);
    if (can !== 'ok') {
      if (!silentFail) {
        if (can === 'ability') msg(bt('immune_ability', lang, { m: name(target), ability: tAbilityName(target.ability, lang) }));
        else if (can === 'type') msg(bt('immune_status', lang, { m: name(target) }));
        else msg(bt('failed', lang));
      }
      return false;
    }
    target.status.push(status);
    target.statusTurns = target.statusTurns || {};
    target.statusTurns[status] = STATUS_DURATION[status]();
    if (side === 'enemy') stats.statusInflicted++;
    events.push({ type: 'status', side, status, text: bt(`apply.${status}`, lang, { m: name(target) }), snap: snap() });
    return true;
  };

  const removeStatus = (m: Monster, s: StatusEffect) => {
    m.status = m.status.filter(x => x !== s);
    if (m.statusTurns) delete m.statusTurns[s];
  };

  const changeStage = (side: Side, stat: Stat, delta: number) => {
    const m = mon(side);
    const st = stagesOf(m);
    const statName = bt(`statname.${stat}`, lang);
    if (delta > 0 && st[stat] >= 4) { msg(bt('stat.max', lang, { m: name(m), stat: statName })); return; }
    if (delta < 0 && st[stat] <= -4) { msg(bt('stat.min', lang, { m: name(m), stat: statName })); return; }
    st[stat] = Math.max(-4, Math.min(4, st[stat] + delta));
    const key = delta > 0 ? (delta >= 2 ? 'stat.up2' : 'stat.up1') : (delta <= -2 ? 'stat.down2' : 'stat.down1');
    events.push({ type: 'stat', side, up: delta > 0, text: bt(key, lang, { m: name(m), stat: statName }), snap: snap() });
  };

  const healSide = (side: Side, amount: number, key = 'heal', extra: Record<string, string> = {}) => {
    const m = mon(side);
    const real = Math.min(amount, m.stats.maxHp - m.stats.hp);
    if (real <= 0) return 0;
    m.stats.hp += real;
    if (side === 'player') stats.healing += real;
    events.push({ type: 'heal', side, amount: real, text: bt(key, lang, { m: name(m), n: real, ...extra }), snap: snap() });
    return real;
  };

  // Danno con gestione sopravvivenza (abilità / Pozione della Non-Morte)
  const dealDamage = (side: Side, amount: number): number => {
    const m = mon(side);
    const before = m.stats.hp;
    m.stats.hp = Math.max(0, m.stats.hp - amount);
    if (m.stats.hp <= 0) {
      const ability = getAbilityDef(m.ability);
      let saved: number | null = null;
      if (!m.survivedUsed && ability?.surviveOneHitKO && before >= m.stats.maxHp * 0.5) saved = Math.max(1, Math.floor(m.stats.maxHp * 0.2));
      else if (!m.survivedUsed && ability?.surviveChance && Math.random() * 100 < ability.surviveChance) saved = 1;
      if (saved !== null) {
        m.stats.hp = saved;
        m.survivedUsed = true;
        msg(bt('endure', lang, { m: name(m), ability: tAbilityName(m.ability, lang) }));
      } else if (side === 'player' && S.undeath) {
        m.stats.hp = Math.max(1, Math.floor(m.stats.maxHp * 0.25));
        S.undeath = false;
        msg(bt('endure_item', lang, { m: name(m), item: tItem('pozione_non_morte', lang) }));
      }
    }
    const dealt = before - m.stats.hp;
    if (side === 'enemy') stats.damageDealt += dealt; else stats.damageTaken += dealt;
    return dealt;
  };

  // ----- Esecuzione di una mossa -----
  const executeMove = (side: Side, moveIndex: number) => {
    const user = mon(side);
    const foeSide = other(side);
    const foe = mon(foeSide);
    if (!user || user.stats.hp <= 0 || !foe || foe.stats.hp <= 0) return;

    // Stati che impediscono di agire
    if (hasStatus(user, 'sonnambulo')) {
      const turns = (user.statusTurns?.sonnambulo ?? 1) - 1;
      if (turns <= 0) {
        removeStatus(user, 'sonnambulo');
        events.push({ type: 'status', side, status: 'sonnambulo', text: bt('wake', lang, { m: name(user) }), snap: snap() });
      } else {
        user.statusTurns = { ...(user.statusTurns || {}), sonnambulo: turns };
        events.push({ type: 'status', side, status: 'sonnambulo', text: bt('skip.sonnambulo', lang, { m: name(user) }), snap: snap() });
        return;
      }
    }
    if (hasStatus(user, 'paralizzato') && Math.random() < 0.25) {
      events.push({ type: 'status', side, status: 'paralizzato', text: bt('skip.paralizzato', lang, { m: name(user) }), snap: snap() });
      return;
    }

    let move: Move;
    let struggle = false;
    if (moveIndex < 0 || !user.moves[moveIndex]) {
      struggle = true;
      move = { id: 'struggle', name: 'struggle', type: user.type, power: 35, accuracy: 100, pp: 1, maxPp: 1, description: '' };
      msg(bt('struggle', lang, { m: name(user) }));
    } else {
      move = user.moves[moveIndex];
      if (side === 'player') {
        move.pp = Math.max(0, move.pp - 1);
        stats.movesUsed++;
      }
    }

    if (!struggle) {
      events.push({
        type: 'move', side, moveType: move.type, power: move.power, moveId: move.id,
        text: bt('uses', lang, { m: name(user), move: tMove(move.id, lang) }), snap: snap(),
      });
    }

    const statMove = STAT_MOVES[move.id];
    const selfTargeted = move.power === 0 && !move.effect && (statMove?.self || statMove?.healPct);

    // Precisione
    if (!selfTargeted) {
      let accuracy = move.accuracy + getAttackerAccuracyMod(foe.ability);
      if (S.weather === 'nebbia') accuracy -= 10;
      if (Math.random() * 100 >= accuracy) {
        events.push({ type: 'miss', side, text: S.weather === 'nebbia' ? bt('fog_miss', lang, { m: name(user) }) : bt('miss', lang, { m: name(user) }), snap: snap() });
        return;
      }
      const dodge = getDodgeChance(foe.ability);
      if (move.power > 0 && dodge > 0 && Math.random() * 100 < dodge) {
        events.push({ type: 'miss', side, text: bt('dodge', lang, { m: name(foe), ability: tAbilityName(foe.ability, lang) }), snap: snap() });
        return;
      }
    }

    // Mosse di stato
    if (move.power === 0) {
      if (move.effect) {
        const eff = getMoveEffectiveness(move.type, foe.type);
        if (eff === 0) { msg(bt('noeffect', lang, { m: name(foe) })); return; }
        applyStatus(foeSide, move.effect, false);
        return;
      }
      if (statMove?.healPct) {
        if (healSide(side, Math.floor(user.stats.maxHp * statMove.healPct)) <= 0) msg(bt('failed', lang));
        return;
      }
      if (statMove?.self) {
        for (const [stat, delta] of Object.entries(statMove.self)) changeStage(side, stat as Stat, delta || 0);
        return;
      }
      if (statMove?.target) {
        for (const [stat, delta] of Object.entries(statMove.target)) changeStage(foeSide, stat as Stat, delta || 0);
        return;
      }
      msg(bt('failed', lang));
      return;
    }

    // Mosse offensive
    const { damage, effectiveness, crit } = calcDamage(user, foe, move, S.weather);
    if (effectiveness === 0) {
      events.push({ type: 'hit', side: foeSide, amount: 0, effectiveness: 0, crit: false, snap: snap() });
      msg(bt('noeffect', lang, { m: name(foe) }));
      return;
    }
    const dealt = dealDamage(foeSide, damage);
    events.push({ type: 'hit', side: foeSide, amount: dealt, effectiveness, crit, snap: snap() });
    if (crit) { msg(bt('crit', lang)); if (side === 'player') stats.crits++; }
    if (effectiveness > 1) { msg(bt('super', lang)); if (side === 'player') stats.superEffective++; }
    else if (effectiveness < 1) msg(bt('notvery', lang));

    // Contraccolpo del Dimenarsi
    if (struggle) {
      const recoil = Math.max(1, Math.floor(user.stats.maxHp / 4));
      dealDamage(side, recoil);
    }

    // Rubavita (abilità + Zanna di Vampiro per il giocatore)
    const lifesteal = getLifesteal(user.ability) + (side === 'player' ? cfg.lifestealBonus : 0);
    if (lifesteal > 0 && dealt > 0 && user.stats.hp > 0) {
      const amount = Math.max(1, Math.floor(dealt * lifesteal));
      healSide(side, amount, 'drain');
    }

    if (foe.stats.hp > 0) {
      // Effetto secondario della mossa
      if (move.effect) {
        const chance = getModifiedEffectChance(user.ability, move.effect, move.effectChance || 0);
        if (Math.random() * 100 < chance) applyStatus(foeSide, move.effect, true);
      }
      // Stato da abilità al contatto
      const onHit = getOnHitStatus(user.ability);
      if (onHit && Math.random() * 100 < onHit.chance) applyStatus(foeSide, onHit.status, true);
      // Contrattacco del difensore
      const counter = getCounter(foe.ability);
      if (counter > 0 && user.stats.hp > 0) {
        const counterDamage = Math.max(1, Math.floor(foe.stats.attack * counter));
        msg(bt('counter', lang, { m: name(foe), ability: tAbilityName(foe.ability, lang) }));
        const d = dealDamage(side, counterDamage);
        events.push({ type: 'hit', side, amount: d, effectiveness: 1, crit: false, snap: snap() });
      }
    }
  };

  // ----- Gestione dei KO -----
  // Ritorna true se la lotta si interrompe (vittoria, sconfitta o cambio forzato)
  const handleFaints = (): boolean => {
    let stop = false;
    const enemy = E();
    if (enemy && enemy.stats.hp <= 0 && !(enemy as any)._faintHandled) {
      (enemy as any)._faintHandled = true;
      enemy.status = [];
      events.push({ type: 'faint', side: 'enemy', text: bt('fainted', lang, { m: name(enemy) }), snap: snap() });
      stats.defeated++;
      grantExp(enemy);
      const next = S.enemies.findIndex(e => e.stats.hp > 0);
      if (next === -1) {
        outcome = 'victory';
        msg(bt('victory', lang));
        return true;
      }
      S.enemyActive = next;
      prepareForBattle(E());
      events.push({ type: 'switch', side: 'enemy', text: bt('enemy_enters', lang, { m: name(E()) }), snap: snap() });
      stop = true;
    }
    const player = P();
    if (player && player.stats.hp <= 0 && !(player as any)._faintHandled) {
      (player as any)._faintHandled = true;
      player.status = [];
      player.statusTurns = {};
      events.push({ type: 'faint', side: 'player', text: bt('fainted', lang, { m: name(player) }), snap: snap() });
      if (S.team.every(m => m.stats.hp <= 0)) {
        outcome = 'defeat';
        msg(bt('defeat', lang));
        return true;
      }
      outcome = 'need_switch';
      msg(bt('choose_next', lang));
      stop = true;
    }
    return stop;
  };

  const grantExp = (enemy: Monster) => {
    const kindMult = S.kind === 'gym_leader' ? 1.6 : S.kind === 'trainer' ? 1.3 : 1;
    const gain = Math.max(1, Math.floor((enemy.level * 5 + 10) * kindMult * cfg.expMult));
    S.team.forEach((m, index) => {
      if (m.stats.hp <= 0) return;
      // Chi è sceso in campo riceve EXP piena, la panchina in base agli Esp. Condividi
      const amount = S.participants.includes(index) ? gain : Math.floor(gain * cfg.benchShare);
      if (amount <= 0) return;
      if (S.participants.includes(index)) msg(bt('exp', lang, { m: name(m), n: amount }));
      const growth = addExperience(m, amount, lang);
      growth.messages.forEach(g => {
        if (g.kind === 'evolve') events.push({ type: 'evolve', teamIndex: index, text: g.text, snap: snap() });
        else if (g.kind === 'levelup') events.push({ type: 'levelup', teamIndex: index, text: g.text, snap: snap() });
        else msg(g.text);
      });
      if (growth.evolved) stats.evolutions++;
      growth.pending.forEach(move => pendingMoves.push({ teamIndex: index, move }));
    });
  };

  // ----- Fine turno: stati e rigenerazione -----
  const endOfTurn = () => {
    for (const side of ['player', 'enemy'] as Side[]) {
      const m = mon(side);
      if (!m || m.stats.hp <= 0) continue;
      for (const s of ['bruciato', 'putrefatto'] as StatusEffect[]) {
        if (!hasStatus(m, s) || m.stats.hp <= 0) continue;
        const pct = s === 'bruciato' ? 0.06 : 0.08;
        const amount = Math.max(1, Math.floor(m.stats.maxHp * pct));
        const dealt = dealDamage(side, amount);
        events.push({ type: 'tick', side, status: s, amount: dealt, text: bt(`tick.${s}`, lang, { m: name(m) }), snap: snap() });
      }
      if (m.stats.hp > 0) {
        const regen = getTurnRegen(m.ability, m.stats.hp, m.stats.maxHp);
        if (regen > 0) healSide(side, regen, 'regen', { ability: tAbilityName(m.ability, lang) });
      }
      // Durata degli stati (il sonno si consuma quando il mostro prova ad agire)
      for (const s of [...m.status]) {
        if (s === 'sonnambulo') continue;
        const left = (m.statusTurns?.[s] ?? 1) - 1;
        if (left <= 0) {
          removeStatus(m, s);
          if (m.stats.hp > 0) events.push({ type: 'status', side, status: s, text: bt(`end.${s}`, lang, { m: name(m) }), snap: snap() });
        } else {
          m.statusTurns = { ...(m.statusTurns || {}), [s]: left };
        }
      }
    }
  };

  const enemyAction = () => {
    const enemy = E();
    const player = P();
    if (!enemy || !player || enemy.stats.hp <= 0 || player.stats.hp <= 0) return;
    executeMove('enemy', chooseEnemyMove(enemy, player, S.kind, S.weather));
  };

  const tryAutoNet = (): boolean => {
    const enemy = E();
    if (!cfg.autoNet || !S.catchable || S.team.length >= 6 || !enemy || enemy.stats.hp <= 0) return false;
    if (enemy.stats.hp / enemy.stats.maxHp > 0.1 || enemy.isBoss) return false;
    events.push({ type: 'capture', shakes: 3, success: true, itemId: 'rete_becchino', text: bt('net_auto', lang, { m: name(enemy) }), snap: snap() });
    completeCapture();
    return true;
  };

  const completeCapture = () => {
    const enemy = E();
    const captured = clone(enemy);
    captured.status = [];
    captured.statusTurns = {};
    captured.stats.hp = Math.max(1, captured.stats.hp);
    cleanupAfterBattle(captured);
    delete (captured as any)._faintHandled;
    captured.isBoss = undefined;
    // Il nuovo arrivato si allinea alla squadra (max livello - 2) per essere subito utile
    const catchUp = Math.max(...S.team.map(m => m.level)) - 2;
    raiseToLevel(captured, catchUp);
    S.team.push(captured);
    stats.caught.push(captured.id);
    S.enemies.splice(S.enemyActive, 1);
    msg(bt('caught', lang, { m: name(captured) }));
    grantExp(captured);
    const next = S.enemies.findIndex(e => e.stats.hp > 0);
    if (next === -1) {
      S.enemyActive = 0;
      outcome = 'victory';
      return;
    }
    S.enemyActive = next;
    prepareForBattle(E());
    events.push({ type: 'switch', side: 'enemy', text: bt('enemy_enters', lang, { m: name(E()) }), snap: snap() });
  };

  // ============================================================
  // Azioni del giocatore
  // ============================================================
  if (action.kind === 'switch') {
    const target = S.team[action.index];
    if (!target || target.stats.hp <= 0 || action.index === S.active) {
      consumedTurn = false;
      return finishResult();
    }
    const forced = P().stats.hp <= 0;
    if (!forced) {
      // Gli stati volatili e i modificatori si perdono rientrando
      const leaving = P();
      leaving.stages = { attack: 0, defense: 0, speed: 0 };
      leaving.status.filter(s => VOLATILE_STATUS.includes(s)).forEach(s => removeStatus(leaving, s));
      msg(bt('come_back', lang, { m: name(leaving) }));
    }
    S.active = action.index;
    if (!S.participants.includes(S.active)) S.participants.push(S.active);
    prepareForBattle(P());
    delete (P() as any)._faintHandled;
    events.push({ type: 'switch', side: 'player', text: bt('go', lang, { m: name(P()) }), snap: snap() });
    if (forced) return finishResult(); // dopo un KO il nemico non attacca di nuovo
    enemyAction();
    if (!handleFaints()) endOfTurn();
    handleFaints();
    return finishResult();
  }

  if (action.kind === 'run') {
    if (S.kind !== 'wild') {
      msg(bt('run_trainer', lang));
      consumedTurn = false;
      return finishResult();
    }
    S.runAttempts++;
    const chance = Math.min(95, Math.max(25, 50 + (effectiveSpeed(P()) - effectiveSpeed(E())) * 3 + (S.runAttempts - 1) * 15));
    if (Math.random() * 100 < chance) {
      msg(bt('run_ok', lang));
      outcome = 'escaped';
      return finishResult();
    }
    msg(bt('run_fail', lang));
    enemyAction();
    if (!handleFaints()) endOfTurn();
    handleFaints();
    return finishResult();
  }

  if (action.kind === 'capture') {
    const enemy = E();
    const item = findItem(action.itemId);
    if (!S.catchable) { msg(bt('cant_capture', lang)); consumedTurn = false; return finishResult(); }
    if (S.team.length >= 6) { msg(bt('team_full', lang)); consumedTurn = false; return finishResult(); }
    if (!item || item.quantity <= 0 || !enemy || enemy.stats.hp <= 0) { consumedTurn = false; return finishResult(); }
    item.quantity--;
    stats.itemsUsed++;
    msg(bt('throw', lang, { item: tItem(item.id, lang) }));
    const chance = captureChance(enemy, item.id, cfg.captureBonus);
    const success = Math.random() < chance;
    // Numero di scosse: più è vicino al successo, più scosse
    const shakes = success ? 3 : Math.min(2, Math.floor(Math.random() * 3 * Math.min(1, chance * 1.6)));
    events.push({
      type: 'capture', shakes, success, itemId: item.id,
      text: success ? bt('caught', lang, { m: name(enemy) }) : bt('broke_free', lang, { m: name(enemy) }),
      snap: snap(),
    });
    if (success) {
      events.pop();
      events.push({ type: 'capture', shakes, success, itemId: item.id, text: '', snap: snap() });
      completeCapture();
      return finishResult();
    }
    enemyAction();
    if (!handleFaints()) endOfTurn();
    handleFaints();
    return finishResult();
  }

  if (action.kind === 'item') {
    const item = findItem(action.itemId);
    if (!item || item.quantity <= 0) { consumedTurn = false; return finishResult(); }
    const targetIndex = action.targetIndex ?? S.active;
    const target = S.team[targetIndex];
    const itemName = tItem(item.id, lang);
    let used = false;
    const healTarget = (amount: number) => {
      const real = Math.min(amount, target.stats.maxHp - target.stats.hp);
      if (real <= 0) return false;
      target.stats.hp += real;
      stats.healing += real;
      events.push({ type: 'heal', side: targetIndex === S.active ? 'player' : 'player', amount: real, text: bt('heal', lang, { m: name(target), n: real }), snap: snap() });
      return true;
    };
    const cure = () => {
      if (!target.status.length) return false;
      target.status = [];
      target.statusTurns = {};
      msg(bt('cured', lang, { m: name(target) }));
      return true;
    };

    switch (item.id) {
      case 'pozione_sangue':
      case 'super_pozione':
      case 'iper_pozione':
        if (target && target.stats.hp > 0) { msg(bt('item_used', lang, { item: itemName })); used = healTarget(item.power); if (!used) events.pop(); }
        break;
      case 'elisir_spettrale':
        if (target && target.stats.hp > 0) { msg(bt('item_used', lang, { item: itemName })); used = cure(); if (!used) events.pop(); }
        break;
      case 'candela_protettiva':
        if (target && target.stats.hp > 0) {
          msg(bt('item_used', lang, { item: itemName }));
          const a = cure();
          const b = healTarget(item.power);
          used = a || b;
          if (!used) events.pop();
        }
        break;
      case 'frammento_luna': {
        let total = 0;
        S.team.forEach(m => {
          if (m.stats.hp <= 0) return;
          const real = Math.min(item.power, m.stats.maxHp - m.stats.hp);
          m.stats.hp += real;
          total += real;
        });
        if (total > 0) {
          stats.healing += total;
          msg(bt('item_used', lang, { item: itemName }));
          events.push({ type: 'heal', side: 'player', amount: total, text: bt('team_healed', lang, { n: item.power }), snap: snap() });
          used = true;
        }
        break;
      }
      case 'nettare_zucca':
        if (target && target.stats.hp > 0) {
          target.stats.maxHp += item.power;
          target.stats.hp += item.power;
          msg(bt('item_used', lang, { item: itemName }));
          events.push({ type: 'heal', side: 'player', amount: item.power, text: bt('maxhp_up', lang, { m: name(target), n: item.power }), snap: snap() });
          used = true;
        }
        break;
      case 'pozione_non_morte':
        if (!S.undeath) {
          S.undeath = true;
          msg(bt('item_used', lang, { item: itemName }));
          msg(bt('protected_item', lang, { m: name(P()), item: itemName }));
          used = true;
        }
        break;
      case 'lacrime_banshee': {
        const fainted = action.targetIndex !== undefined && S.team[action.targetIndex]?.stats.hp <= 0
          ? action.targetIndex
          : S.team.map((m, i) => ({ m, i })).filter(x => x.m.stats.hp <= 0).sort((a, b) => b.m.level - a.m.level)[0]?.i;
        if (fainted !== undefined) {
          const m = S.team[fainted];
          m.stats.hp = Math.max(1, Math.floor(m.stats.maxHp / 2));
          m.status = [];
          m.statusTurns = {};
          delete (m as any)._faintHandled;
          msg(bt('item_used', lang, { item: itemName }));
          events.push({ type: 'heal', side: 'player', amount: m.stats.hp, text: bt('revived', lang, { m: name(m), n: m.stats.hp }), snap: snap() });
          used = true;
        }
        break;
      }
      case 'cristallo_pp': {
        const mv = target?.moves[action.moveIndex ?? -1];
        if (mv && mv.pp < mv.maxPp) {
          mv.pp = Math.min(mv.maxPp, mv.pp + item.power);
          msg(bt('item_used', lang, { item: itemName }));
          msg(bt('pp_restored', lang, { move: tMove(mv.id, lang) }));
          used = true;
        }
        break;
      }
      case 'cristallo_pp_totale':
        if (target && target.moves.some(m => m.pp < m.maxPp)) {
          target.moves.forEach(m => { m.pp = m.maxPp; });
          msg(bt('item_used', lang, { item: itemName }));
          msg(bt('all_pp_restored', lang, { m: name(target) }));
          used = true;
        }
        break;
      default:
        break;
    }

    if (!used) {
      msg(bt('failed', lang));
      consumedTurn = false;
      return finishResult();
    }
    item.quantity--;
    stats.itemsUsed++;
    enemyAction();
    if (!handleFaints()) endOfTurn();
    handleFaints();
    return finishResult();
  }

  // ----- Attacco -----
  const player = P();
  const enemy = E();
  if (!player || player.stats.hp <= 0 || !enemy || enemy.stats.hp <= 0) {
    consumedTurn = false;
    return finishResult();
  }
  let moveIndex = action.index;
  const usable = player.moves.some(m => m.pp > 0);
  if (usable) {
    if (!player.moves[moveIndex] || player.moves[moveIndex].pp <= 0) {
      msg(bt('no_pp', lang));
      consumedTurn = false;
      return finishResult();
    }
  } else {
    moveIndex = -1; // Dimenarsi
  }

  const enemyMoveIndex = chooseEnemyMove(enemy, player, S.kind, S.weather);
  const pSpeed = effectiveSpeed(player);
  const eSpeed = effectiveSpeed(enemy);
  const playerFirst = pSpeed > eSpeed || (pSpeed === eSpeed && Math.random() < 0.5);
  const enemyRef = enemy;

  const order: Side[] = playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];
  for (const side of order) {
    if (side === 'player') {
      executeMove('player', moveIndex);
      // Rete del Becchino: cattura automatica, il turno termina qui
      if (tryAutoNet()) return finishResult();
    } else {
      // Il nemico agisce solo se è ancora lo stesso mostro in campo
      if (E() !== enemyRef && S.enemies[S.enemyActive] !== enemyRef) continue;
      const e = E();
      const p = P();
      if (e && p && e.stats.hp > 0 && p.stats.hp > 0) executeMove('enemy', enemyMoveIndex >= e.moves.length ? 0 : enemyMoveIndex);
    }
    if (handleFaints()) return finishResult();
  }
  endOfTurn();
  handleFaints();
  return finishResult();
}

/** Stato iniziale della lotta. */
export function createBattleState(params: {
  team: Monster[]; enemies: Monster[]; active: number; weather: Weather; catchable: boolean; kind: BattleKind; items: ItemType[];
}): BattleState {
  const team = clone(params.team).map(prepareForBattle);
  const enemies = clone(params.enemies).map(prepareForBattle);
  return {
    team, enemies, active: params.active, enemyActive: 0, weather: params.weather,
    catchable: params.catchable, kind: params.kind, items: clone(params.items), undeath: false, runAttempts: 0,
    participants: [params.active],
  };
}

/** Riassunto testuale degli effetti di una mossa (per l'interfaccia). */
export function moveEffectSummary(move: Move): { selfStat?: Partial<Record<Stat, number>>; targetStat?: Partial<Record<Stat, number>>; healPct?: number } {
  const s = STAT_MOVES[move.id];
  return { selfStat: s?.self, targetStat: s?.target, healPct: s?.healPct };
}
