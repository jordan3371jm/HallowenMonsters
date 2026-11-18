// Crescita delle statistiche per specie.
// In media ogni livello dà +3 PS, +2 attacco, +1 difesa e +1 velocità, ma ogni
// specie distribuisce la crescita secondo le sue statistiche di base: un mostro
// corazzato cresce di più in difesa, uno veloce in velocità. I rari, i
// leggendari e i mitici crescono un po' di più. La crescita è deterministica:
// lo stesso mostro allo stesso livello ha sempre le stesse statistiche.
import type { Monster } from '../types';
import {
  starters, wildMonsters, rareMonsters, legendaryMonsters, mythicalMonsters, gymLeaderMonsters,
} from '../data/monsters';

export type GrowthStat = 'maxHp' | 'attack' | 'defense' | 'speed';
export type Growth = Record<GrowthStat, number>;

const STATS: GrowthStat[] = ['maxHp', 'attack', 'defense', 'speed'];
/** Crescita media per livello (quella di prima, uguale per tutti). */
export const BASE_GROWTH: Growth = { maxHp: 3, attack: 2, defense: 1, speed: 1 };
/** Profilo di riferimento: un mostro comune "equilibrato" al livello 5. */
const REFERENCE: Growth = { maxHp: 43, attack: 14, defense: 11.5, speed: 12 };
/** Quanto accentuare le differenze tra specie (1 = proporzionale alle statistiche di base). */
const SPREAD = 1.6;
const RARITY_BONUS: Record<string, number> = {
  comune: 1, non_comune: 1, raro: 1.04, epico: 1.08, leggendario: 1.15, mitico: 1.15,
};

let templates: Map<string, Monster> | null = null;
function templateOf(id: string): Monster | undefined {
  if (!templates) {
    templates = new Map();
    [...starters, ...wildMonsters, ...rareMonsters, ...legendaryMonsters, ...mythicalMonsters, ...gymLeaderMonsters]
      .forEach(m => { if (!templates!.has(m.id)) templates!.set(m.id, m); });
  }
  return templates.get(id);
}

const cache = new Map<string, Growth>();

/** Crescita per livello della specie (valori frazionari). */
export function growthOf(id: string): Growth {
  const hit = cache.get(id);
  if (hit) return hit;
  const t = templateOf(id);
  if (!t) { cache.set(id, BASE_GROWTH); return BASE_GROWTH; }
  // Proporzioni della specie rispetto al riferimento, con media 1
  const ratios = STATS.map(k => t.stats[k] / REFERENCE[k]);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const bonus = RARITY_BONUS[t.rarity || 'comune'] ?? 1;
  const g = {} as Growth;
  STATS.forEach((k, i) => {
    const shape = Math.max(0.45, Math.min(1.9, 1 + SPREAD * (ratios[i] / mean - 1)));
    g[k] = BASE_GROWTH[k] * shape * bonus;
  });
  cache.set(id, g);
  return g;
}

/** Aumento totale delle statistiche passando dal livello `from` al livello `to` (negativo se si scende). */
export function growthBetween(id: string, from: number, to: number): Growth {
  const g = growthOf(id);
  const out = {} as Growth;
  STATS.forEach(k => { out[k] = Math.floor(g[k] * to) - Math.floor(g[k] * from); });
  return out;
}

/** Applica a un mostro l'aumento di un singolo livello (da level-1 a level). */
export function applyLevelUp(m: Monster): void {
  const d = growthBetween(m.id, m.level - 1, m.level);
  m.stats.maxHp += d.maxHp;
  m.stats.hp += d.maxHp;
  m.stats.attack += d.attack;
  m.stats.defense += d.defense;
  m.stats.speed += d.speed;
}
