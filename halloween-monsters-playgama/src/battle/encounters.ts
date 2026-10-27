// Generazione degli incontri: livelli e statistiche crescono con la stessa
// curva dei mostri del giocatore, così la difficoltà resta leggibile.
import type { Monster, MapNodeType } from '../types';
import {
  wildMonsters, rareMonsters, legendaryMonsters, mythicalMonsters, gymLeaderMonsters,
} from '../data/monsters';
import { expForLevel, type BattleKind } from './engine';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const SHINY_CHANCE = 1 / 80;

/** Livello di riferimento dei nemici per un nodo della mappa. */
export function targetLevel(wave: number, nodeId: number): number {
  const progress = (wave - 1) * 10 + nodeId;
  return Math.max(2, Math.round(2 + progress * 0.4));
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

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/** Pool di selvatici adatto al livello (stadi evolutivi coerenti). */
function wildPool(level: number): Monster[] {
  const maxTier = level >= 34 ? 3 : level >= 16 ? 2 : 1;
  const minTier = level >= 40 ? 2 : 1;
  const pool = wildMonsters.filter(m => (m.tier ?? 1) <= maxTier && (m.tier ?? 1) >= minTier);
  return pool.length ? pool : wildMonsters;
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

  if (nodeType === 'trainer') {
    const count = wave === 1 ? 1 : Math.min(4, 2 + Math.floor((wave - 2) / 3));
    const pool = wildPool(level + 1);
    const enemies = Array.from({ length: count }, (_, i) =>
      scaleToLevel(pick(pool), level + (i === count - 1 ? 1 : 0)));
    result = { enemies, catchable: false, kind: 'trainer', encounter: 'trainer' };
  } else if (nodeType === 'gym_leader') {
    const leader = gymLeaderMonsters[(wave - 1) % gymLeaderMonsters.length];
    const count = Math.min(5, 2 + Math.floor((wave - 1) / 2));
    const pool = wildPool(level + 1).filter(m => m.type === leader.type);
    const support = pool.length >= 2 ? pool : wildPool(level + 1);
    const enemies = Array.from({ length: count - 1 }, () => scaleToLevel(pick(support), level + 1));
    enemies.push(makeBoss(scaleToLevel(leader, level + 2), wave === 1 ? 1.1 : 1.3));
    result = { enemies, catchable: false, kind: 'gym_leader', encounter: 'gym_leader' };
  } else {
    const roll = Math.random();
    if (progress >= 35 && roll < 0.015) {
      result = { enemies: [makeBoss(scaleToLevel(pick(mythicalMonsters), level + 6), 1.25)], catchable: true, kind: 'wild', encounter: 'mythical' };
    } else if (progress >= 25 && roll < 0.05) {
      result = { enemies: [makeBoss(scaleToLevel(pick(legendaryMonsters), level + 6), 1.25)], catchable: true, kind: 'wild', encounter: 'legendary' };
    } else if (progress >= 10 && roll < 0.15) {
      result = { enemies: [scaleToLevel(pick(rareMonsters), level + 1)], catchable: true, kind: 'wild', encounter: 'rare' };
    } else if (progress >= 12 && roll < 0.32) {
      const pool = wildPool(level);
      result = { enemies: [scaleToLevel(pick(pool), level), scaleToLevel(pick(pool), Math.max(3, level - 1))], catchable: true, kind: 'wild', encounter: 'double' };
    } else {
      const pool = wildPool(level);
      const jitter = Math.floor(Math.random() * 3) - 1;
      result = { enemies: [scaleToLevel(pick(pool), Math.max(2, level + jitter))], catchable: true, kind: 'wild', encounter: 'wild' };
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
    trainer: { hp: 0.9, atk: 0.82 }, gym_leader: { hp: 0.95, atk: 0.88 },
  };
  const early = progress < 15 ? 0.9 : 1;
  const k = tune[result.encounter];
  result.enemies.forEach(m => {
    m.stats.maxHp = Math.max(8, Math.floor(m.stats.maxHp * k.hp));
    m.stats.hp = m.stats.maxHp;
    m.stats.attack = Math.max(3, Math.floor(m.stats.attack * k.atk * early * ATK));
  });

  // Ogni 10 ondate entra in vigore un nuovo livello di difficoltà
  const tier = Math.floor((wave - 1) / 10);
  if (tier > 0) {
    const mult = 1 + tier * 0.05;
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
