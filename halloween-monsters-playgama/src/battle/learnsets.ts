// Mosse imparabili per specie.
// Ogni famiglia evolutiva impara le mosse del proprio tipo più quelle di un
// tipo secondario scelto a tema (es. Tizzonetto → Tuono, Fanghiglia → Veleno),
// così ogni mostro ha un'identità: uno spettro non impara più mosse di
// qualunque tipo. Le mosse da 100+ di potenza restano ai leggendari e ai mitici.
import type { Monster, Move, MonsterType } from '../types';
import {
  allMoves, starters, wildMonsters, rareMonsters, legendaryMonsters, mythicalMonsters, gymLeaderMonsters,
} from '../data/monsters';

/** Tipo secondario della famiglia, indicato con la forma base. */
const FAMILY_COVERAGE: Record<string, MonsterType> = {
  // Starter (il tipo secondario è quello della loro terza mossa)
  lumizucca: 'osso', tizzonetto: 'tuono', gocciascura: 'ghiaccio', spinarbo: 'osso',
  nottolino: 'fuoco', fantesmina: 'ragno', ossetto: 'buio',
  // Selvatici
  tessitelo: 'veleno', rospofango: 'acqua', scintillio: 'ghiaccio', freddolino: 'acqua',
  streghetta: 'veleno', sfortunino: 'spettro', candelino: 'spettro', fanghiglia: 'veleno',
  fungospetto: 'veleno', lapidino: 'spettro', spaventalo: 'erba', filospettro: 'spettro',
  boccettina: 'fuoco', lenzuolino: 'buio', corvaglia: 'spettro', bulonetto: 'osso',
  pinguombroso: 'acqua', diablotto: 'buio', pescescuro: 'buio', mandragolina: 'spettro',
  manoscura: 'buio', zeccarina: 'buio', vespirla: 'ragno',
  // Rari
  gargoyleme: 'buio', basilombra: 'buio', chimeracco: 'tuono', lichiarore: 'ghiaccio',
  minotombro: 'fuoco', krakentuscolo: 'buio', grifospettrale: 'spettro', dullaghan: 'spettro',
  // Leggendari e mitici
  samhainrex: 'fuoco', nocturnalis: 'spettro', ectoplasmax: 'veleno', abissaleviatano: 'ghiaccio',
  mascherarca: 'buio', ombriel: 'spettro', zuccheterna: 'erba', velanima: 'spettro',
  // Capipalestra
  becchino_eterno: 'spettro', strega_caldera: 'fuoco', conte_mezzanotte: 'spettro', zuccomperatore: 'fuoco',
};

const STRONG = 100;

let familyOf: Map<string, string> | null = null;
function rootOf(id: string): string {
  if (!familyOf) {
    familyOf = new Map();
    const all = [...starters, ...wildMonsters, ...rareMonsters, ...legendaryMonsters, ...mythicalMonsters, ...gymLeaderMonsters];
    const parent = new Map<string, string>();
    all.forEach(m => (m.evolutions || []).forEach(e => parent.set(e.id, m.id)));
    all.forEach(m => {
      let r = m.id;
      let guard = 0;
      while (parent.has(r) && guard++ < 5) r = parent.get(r)!;
      familyOf!.set(m.id, r);
    });
  }
  return familyOf.get(id) || id;
}

/** Tipo secondario della specie (undefined se non ne ha). */
export function coverageType(id: string): MonsterType | undefined {
  return FAMILY_COVERAGE[rootOf(id)];
}

/** Tutte le mosse che la specie può imparare salendo di livello. */
export function learnsetOf(mon: Pick<Monster, 'id' | 'type' | 'rarity'>): Move[] {
  const strongAllowed = mon.rarity === 'leggendario' || mon.rarity === 'mitico';
  const second = coverageType(mon.id);
  return allMoves.filter(m => {
    if (m.power >= STRONG && !(strongAllowed && m.type === mon.type)) return false;
    if (m.type === mon.type) return true;
    // Del tipo secondario solo mosse d'attacco
    return m.type === second && m.power > 0;
  });
}
