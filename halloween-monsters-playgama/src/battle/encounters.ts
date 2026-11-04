// Generazione degli incontri: livelli e statistiche crescono con la stessa
// curva dei mostri del giocatore, così la difficoltà resta leggibile.
import type { Monster, MapNodeType } from '../types';
import {
  starters, wildMonsters, rareMonsters, legendaryMonsters, mythicalMonsters, gymLeaderMonsters,
} from '../data/monsters';
import { expForLevel, type BattleKind } from './engine';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Ondata del boss finale: dopo si continua in modalità infinita. */
export const FINAL_WAVE = 30;

export const SHINY_CHANCE = 1 / 80;

/** Livello di riferimento dei nemici per un nodo della mappa. */
export function targetLevel(wave: number, nodeId: number): number {
  const progress = (wave - 1) * 10 + nodeId;
  const slope = Number((globalThis as any).__HM_SLOPE || 0.2);
  // Curva che accelera: +2 livelli per ondata all'inizio, circa +4,5 verso l'ondata 30
  return Math.max(2, Math.round(2 + progress * slope + progress * progress * 0.00042));
}

/** Porta un modello di mostro al livello richiesto con la crescita standard. */
export function scaleToLevel(template: Monster, level: number): Monster {
  const m = clone(template);
  const dl = level - template.level;
  const base = template.stats;
  const floor = (v: number, min: number) => Math.max(min, Math.floor(v));
  m.level = Math.max(1, level);
  m.stats = {
    maxHp: floor(base.maxHp + 3 * dl, Math.ceil(base.maxHp * 0.6)),
    hp: 0,
    attack: floor(base.attack + 2 * dl, Math.ceil(base.attack * 0.6)),
    defense: floor(base.defense + 1 * dl, Math.ceil(base.defense * 0.6)),
    speed: floor(base.speed + 1 * dl, Math.ceil(base.speed * 0.6)),
  };
  m.stats.hp = m.stats.maxHp;
  m.exp = 0;
  m.expToNext = expForLevel(m.level);
  m.status = [];
  m.statusTurns = {};
  m.moves = m.moves.map(move => ({ ...move, pp: move.maxPp }));
  return m;
}

/** Porta il mostro al livello senza mai scendere sotto il suo livello minimo. */
function spawn(m: Monster, level: number): Monster {
  return scaleToLevel(m, Math.max(minLevelOf(m), level));
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

// ------------------------------------------------------------
// Livelli minimi in stile Pokémon: un'evoluzione si incontra solo dal livello
// in cui la sua forma precedente si evolve (es. Aracnoscuro dal 14, Vedovamantis
// dal 32). Le forme base spariscono qualche livello dopo la loro evoluzione.
// ------------------------------------------------------------
const EVOLVES_AT: Record<string, number> = {};
for (const m of [...starters, ...wildMonsters]) {
  for (const e of m.evolutions ?? []) EVOLVES_AT[e.id] = Math.min(EVOLVES_AT[e.id] ?? Infinity, e.level);
}

/** Livello da cui un mostro può comparire. */
export function minLevelOf(m: Monster): number {
  if (EVOLVES_AT[m.id]) return EVOLVES_AT[m.id];
  if (m.rarity === 'leggendario') return LEGENDARY_MIN_LEVEL;
  if (m.rarity === 'mitico') return MYTHICAL_MIN_LEVEL;
  // Rari senza linea evolutiva: dal loro livello di riferimento
  if (rareMonsters.some(r => r.id === m.id)) return m.level;
  return 1;
}

export const LEGENDARY_MIN_LEVEL = 25;
export const MYTHICAL_MIN_LEVEL = 30;
/** Dopo quanti livelli oltre la sua evoluzione una forma base non compare più. */
const BASE_FORM_GRACE = 8;

/** Pool di selvatici adatto al livello: solo stadi già raggiungibili. */
export function wildPool(level: number): Monster[] {
  const pool = wildMonsters.filter(m => {
    if (minLevelOf(m) > level) return false;
    const next = m.evolutions?.[0]?.level;
    return next === undefined || level < next + BASE_FORM_GRACE;
  });
  if (pool.length) return pool;
  const fallback = wildMonsters.filter(m => minLevelOf(m) <= level);
  return fallback.length ? fallback : wildMonsters.filter(m => minLevelOf(m) === 1);
}

function makeShiny(m: Monster): Monster {
  m.shiny = true;
  m.stats.maxHp = Math.floor(m.stats.maxHp * 1.1);
  m.stats.hp = m.stats.maxHp;
  m.stats.attack = Math.floor(m.stats.attack * 1.1);
  m.stats.defense = Math.floor(m.stats.defense * 1.1);
  m.stats.speed = Math.floor(m.stats.speed * 1.1);
  return m;
}

function makeBoss(m: Monster, hpMult: number): Monster {
  m.isBoss = true;
  m.stats.maxHp = Math.floor(m.stats.maxHp * hpMult);
  m.stats.hp = m.stats.maxHp;
  return m;
}

export type EncounterKind = 'wild' | 'double' | 'rare' | 'legendary' | 'mythical' | 'trainer' | 'gym_leader';

export interface Encounter {
  enemies: Monster[];
  catchable: boolean;
  kind: BattleKind;
  encounter: EncounterKind;
}

export function buildEncounter(nodeType: MapNodeType, wave: number, nodeId: number): Encounter {
  const level = targetLevel(wave, nodeId);
  const progress = (wave - 1) * 10 + nodeId;
  let result: Encounter;

  if (nodeType === 'trainer' && wave === 1 && nodeId === 2) {
    // Primo allenatore fisso: due mostri, livello 3 e livello 4
    const pool = wildPool(4);
    result = { enemies: [spawn(pick(pool), 3), spawn(pick(pool), 4)], catchable: false, kind: 'trainer', encounter: 'trainer' };
  } else if (nodeType === 'trainer') {
    const count = wave === 1 ? 1 : Math.min(4, 2 + Math.floor((wave - 2) / 3));
    const pool = wildPool(level + 1);
    const enemies = Array.from({ length: count }, (_, i) =>
      spawn(pick(pool), level + (i === count - 1 ? 1 : 0)));
    result = { enemies, catchable: false, kind: 'trainer', encounter: 'trainer' };
  } else if (nodeType === 'gym_leader' && wave === FINAL_WAVE) {
    // Boss finale: il Re delle Zucche con la sua guardia
    const king = legendaryMonsters.find(m => m.id === 'samhainrex') ?? legendaryMonsters[0];
    const guard = Array.from({ length: 4 }, () => spawn(pick(wildPool(level + 2)), level + 2));
    result = { enemies: [...guard, makeBoss(scaleToLevel(king, level + 4), 1.4)], catchable: false, kind: 'gym_leader', encounter: 'gym_leader' };
  } else if (nodeType === 'gym_leader') {
    const leader = gymLeaderMonsters[(wave - 1) % gymLeaderMonsters.length];
    const count = Math.min(5, 2 + Math.floor((wave - 1) / 2));
    const pool = wildPool(level + 1).filter(m => m.type === leader.type);
    const support = pool.length >= 2 ? pool : wildPool(level + 1);
    const enemies = Array.from({ length: count - 1 }, () => spawn(pick(support), level + 1));
    // Il primo capopalestra è una prova, non un muro
    enemies.push(makeBoss(scaleToLevel(leader, level + (wave === 1 ? 1 : 2)), wave === 1 ? 1 : 1.2));
    result = { enemies, catchable: false, kind: 'gym_leader', encounter: 'gym_leader' };
  } else {
    const roll = Math.random();
    const rares = rareMonsters.filter(m => minLevelOf(m) <= level + 1);
    if (level >= MYTHICAL_MIN_LEVEL && roll < 0.015) {
      result = { enemies: [makeBoss(scaleToLevel(pick(mythicalMonsters), level + 6), 1.25)], catchable: true, kind: 'wild', encounter: 'mythical' };
    } else if (level >= LEGENDARY_MIN_LEVEL && roll < 0.05) {
      result = { enemies: [makeBoss(scaleToLevel(pick(legendaryMonsters), level + 6), 1.25)], catchable: true, kind: 'wild', encounter: 'legendary' };
    } else if (rares.length && roll < 0.12) {
      result = { enemies: [spawn(pick(rares), level + 1)], catchable: true, kind: 'wild', encounter: 'rare' };
    } else if (progress >= 12 && roll < 0.32) {
      const pool = wildPool(level);
      result = { enemies: [spawn(pick(pool), level), spawn(pick(pool), Math.max(3, level - 1))], catchable: true, kind: 'wild', encounter: 'double' };
    } else {
      const pool = wildPool(level);
      const jitter = Math.floor(Math.random() * 3) - 1;
      result = { enemies: [spawn(pick(pool), Math.max(2, level + jitter))], catchable: true, kind: 'wild', encounter: 'wild' };
    }
    result.enemies.forEach(m => {
      if (!m.isBoss && Math.random() < SHINY_CHANCE) makeShiny(m);
    });
  }

  // Calibrazione per tipo di incontro (simulata): i selvatici si battono
  // perdendo ~20% dei PS, gli allenatori ~40%, i capipalestra richiedono la squadra.
  const ATK = Number((globalThis as any).__HM_ATK || 1);
  const tune: Record<string, { hp: number; atk: number }> = {
    wild: { hp: 0.8, atk: 0.66 }, double: { hp: 0.75, atk: 0.62 }, rare: { hp: 0.9, atk: 0.8 },
    legendary: { hp: 1, atk: 0.85 }, mythical: { hp: 1, atk: 0.85 },
    trainer: { hp: 0.88, atk: 0.78 }, gym_leader: { hp: 0.9, atk: 0.82 },
  };
  // Le prime 3 ondate sono facili: nemici con meno attacco e meno PS
  const early = wave <= 3 ? 0.8 : 1;
  const earlyHp = wave <= 3 ? 0.9 : 1;
  const k = tune[result.encounter];
  result.enemies.forEach(m => {
    m.stats.maxHp = Math.max(8, Math.floor(m.stats.maxHp * k.hp * earlyHp));
    m.stats.hp = m.stats.maxHp;
    m.stats.attack = Math.max(3, Math.floor(m.stats.attack * k.atk * early * ATK));
  });

  // La difficoltà sale ondata dopo ondata: +1% alle statistiche per ogni ondata dopo la 3
  const ramp = Math.max(0, wave - 3);
  if (ramp > 0) {
    const mult = 1 + ramp * 0.01;
    result.enemies.forEach(m => {
      m.stats.maxHp = Math.floor(m.stats.maxHp * mult);
      m.stats.hp = m.stats.maxHp;
      m.stats.attack = Math.floor(m.stats.attack * mult);
      m.stats.defense = Math.floor(m.stats.defense * mult);
      m.stats.speed = Math.floor(m.stats.speed * mult);
    });
  }
  return result;
}
