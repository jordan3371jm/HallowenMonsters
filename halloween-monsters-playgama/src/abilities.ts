// ============================================================
// SISTEMA ABILITÀ DATA-DRIVEN
// Tutte le abilità dei mostri sono definite qui per ID.
// App.tsx non contiene più logica hardcoded per ID mostro:
// usa gli helper di questo file (boost danni, riduzioni, schivate,
// rigenerazione, immunità, contrattacchi, sopravvivenza KO...).
// ============================================================
import type { MonsterType, StatusEffect } from './types';
import type { Language } from './i18n';

type L5 = Record<Language, string>;

// Tipi considerati "fisici" ai fini delle riduzioni danno
export const PHYSICAL_TYPES: MonsterType[] = ['fuoco', 'acqua', 'erba', 'tuono', 'ghiaccio', 'veleno', 'osso', 'ragno'];

export interface AbilityDef {
  names: L5;
  descs: L5;
  // Danno inflitto: bonus per tipo specifico (moltiplicativo, es. 0.10 = +10%)
  typeBoost?: Partial<Record<MonsterType, number>>;
  // Danno inflitto: bonus a tutti i tipi
  allBoost?: number;
  // Danno inflitto: bonus per tipo solo con meteo notte_halloween
  nightBoost?: { type: MonsterType; pct: number };
  // Rubavita: percentuale del danno inflitto recuperata come PS
  lifesteal?: number;
  // Rigenerazione a inizio turno
  regenFlatBelow?: { belowPct: number; flat: number }; // es. 5 PS sotto 30%
  regenPct?: number; // es. 0.03 = 3% maxHp a turno
  // Schivata: probabilità % di evitare l'attacco
  dodge?: number;
  // Riduzione danno subito
  reduction?: number; // sempre
  reductionBelowHalf?: number; // solo se PS < 50%
  reductionPhysical?: number; // solo contro tipi fisici
  // Modificatore precisione per chi attacca questo mostro (difensivo)
  attackerAccuracyMod?: number;
  // Al colpo andato a segno: applica status al bersaglio
  onHitStatus?: { status: StatusEffect; chance: number };
  // Contrattacco: % dell'attacco proprio inflitta a chi colpisce
  counter?: number;
  // Bonus probabilità effetto per uno status specifico
  effectBonus?: { status: StatusEffect; bonus: number };
  // Probabilità effetto minima (se la mossa ha un effetto)
  effectMin?: number;
  // Immunità a status
  immuneAll?: boolean;
  immuneTo?: StatusEffect[];
  // Sopravvivenza KO
  surviveOneHitKO?: boolean; // Sentinella Eterna: se danno >= 80% maxHp, resta al 20%
  surviveChance?: number; // Sette Vite: % chance di restare a 1 PS
}

const def = (
  names: [string, string, string, string, string],
  descs: [string, string, string, string, string],
  fx: Omit<AbilityDef, 'names' | 'descs'>
): AbilityDef => ({
  names: { it: names[0], en: names[1], fr: names[2], es: names[3], tr: names[4] },
  descs: { it: descs[0], en: descs[1], fr: descs[2], es: descs[3], tr: descs[4] },
  ...fx,
});

export const ABILITIES: Record<string, AbilityDef> = {
  scudo_zucca: def(
    ['Scudo di Zucca', 'Pumpkin Shield', 'Bouclier Citrouille', 'Escudo Calabaza', 'Kabak Kalkanı'],
    ['Riduce i danni del 10% quando PS < 50%', 'Reduces damage by 10% when HP < 50%', 'Réduit les dégâts de 10% quand PV < 50%', 'Reduce daño un 10% cuando PS < 50%', 'CP <%50 iken hasarı %10 azaltır'],
    { reductionBelowHalf: 0.10 }
  ),
  succhia_vita: def(
    ['Succhia Vita', 'Life Siphon', 'Siphon Vital', 'Sifón de Vida', 'Yaşam Emici'],
    ['Recupera 5% PS quando infligge danno', 'Recovers 5% HP when dealing damage', 'Récupère 5% PV en infligeant des dégâts', 'Recupera 5% PS al infligir daño', 'Hasar verdiğinde %5 CP iyileşir'],
    { lifesteal: 0.05 }
  ),
  corpo_etereo: def(
    ['Corpo Etereo', 'Ethereal Body', 'Corps Éthéré', 'Cuerpo Etéreo', 'Eterik Beden'],
    ['15% probabilità di schivare gli attacchi', '15% chance to dodge attacks', '15% de chance d\'esquiver les attaques', '15% de probabilidad de esquivar ataques', 'Saldırıları %15 şansla atlatır'],
    { dodge: 15 }
  ),
  fiamma_interiore: def(
    ['Fiamma Interiore', 'Inner Flame', 'Flamme Intérieure', 'Llama Interior', 'İç Alev'],
    ['+10% danno Fuoco', '+10% Fire damage', '+10% dégâts Feu', '+10% daño Fuego', '+%10 Ateş hasarı'],
    { typeBoost: { fuoco: 0.10 } }
  ),
  flusso_vitale: def(
    ['Flusso Vitale', 'Vital Flow', 'Flux Vital', 'Flujo Vital', 'Yaşam Akışı'],
    ['Recupera 5 PS a turno sotto 30% PS', 'Recovers 5 HP per turn below 30%', 'Récupère 5 PV par tour sous 30%', 'Recupera 5 PS por turno bajo 30%', '%30 altında her tur 5 CP iyileşir'],
    { regenFlatBelow: { belowPct: 0.3, flat: 5 } }
  ),
  radici_profonde: def(
    ['Radici Profonde', 'Deep Roots', 'Racines Profondes', 'Raíces Profundas', 'Derin Kökler'],
    ['Immune a Putrefazione', 'Immune to Rot', 'Immunité à la Putréfaction', 'Inmune a Putrefacción', 'Çürümeye bağışık'],
    { immuneTo: ['putrefatto'] }
  ),
  corazza_ossa: def(
    ['Corazza d\'Ossa', 'Bone Armor', 'Armure d\'Os', 'Armadura de Hueso', 'Kemik Zırhı'],
    ['-15% danno fisico subito', '-15% physical damage taken', '-15% dégâts physiques reçus', '-15% daño físico recibido', '-%15 fiziksel hasar alır'],
    { reductionPhysical: 0.15 }
  ),
  armatura_ossea: def(
    ['Armatura Ossea', 'Bone Plating', 'Armure Osseuse', 'Armadura Ósea', 'Kemik Zırh'],
    ['-20% danno fisico subito', '-20% physical damage taken', '-20% dégâts physiques reçus', '-20% daño físico recibido', '-%20 fiziksel hasar alır'],
    { reductionPhysical: 0.20 }
  ),
  incantesimo: def(
    ['Incantesimo', 'Enchantment', 'Enchantement', 'Encantamiento', 'Büyü'],
    ['Almeno 15% probabilità di causare status', 'At least 15% chance to cause status', 'Au moins 15% de chance de causer un statut', 'Al menos 15% de probabilidad de causar estado', 'En az %15 durum etkisi şansı'],
    { effectMin: 15 }
  ),
  fulmine_vivente: def(
    ['Fulmine Vivente', 'Living Lightning', 'Foudre Vivante', 'Relámpago Viviente', 'Yaşayan Yıldırım'],
    ['Contrattacca con scossa quando colpito', 'Counterattacks with shock when hit', 'Contre-attaque avec décharge quand touché', 'Contraataca con descarga al ser golpeado', 'Vurulduğunda şok ile karşı saldırır'],
    { counter: 0.30 }
  ),
  tela_appiccicosa: def(
    ['Tela Appiccicosa', 'Sticky Web', 'Toile Collante', 'Telaraña Pegajosa', 'Yapışkan Ağ'],
    ['30% di spaventare il bersaglio a ogni colpo (-velocità)', '30% chance to frighten the target on hit (-speed)', '30% de chance d\'effrayer la cible à chaque coup (-vitesse)', '30% de asustar al objetivo al golpear (-velocidad)', 'Vuruşta %30 hedefi korkutma şansı (-hız)'],
    { onHitStatus: { status: 'spaventato', chance: 30 } }
  ),
  fuoco_spettrale: def(
    ['Fuoco Spettrale', 'Spectral Fire', 'Feu Spectral', 'Fuego Espectral', 'Hayalet Ateşi'],
    ['+15% probabilità di bruciare', '+15% chance to burn', '+15% de chance de brûler', '+15% probabilidad de quemar', '+%15 yanma şansı'],
    { effectBonus: { status: 'bruciato', bonus: 15 } }
  ),
  aura_gelida: def(
    ['Aura Gelida', 'Icy Aura', 'Aura Glacée', 'Aura Gélida', 'Buzul Aura'],
    ['+15% danno Ghiaccio', '+15% Ice damage', '+15% dégâts Glace', '+15% daño Hielo', '+%15 Buz hasarı'],
    { typeBoost: { ghiaccio: 0.15 } }
  ),
  veleno_potente: def(
    ['Veleno Potente', 'Potent Poison', 'Poison Puissant', 'Veneno Potente', 'Güçlü Zehir'],
    ['+15% probabilità di putrefare', '+15% chance to rot', '+15% de chance de putréfier', '+15% probabilidad de pudrir', '+%15 çürütme şansı'],
    { effectBonus: { status: 'putrefatto', bonus: 15 } }
  ),
  radici_oscure: def(
    ['Radici Oscure', 'Dark Roots', 'Racines Sombres', 'Raíces Oscuras', 'Karanlık Kökler'],
    ['Recupera 3% PS per turno', 'Recovers 3% HP per turn', 'Récupère 3% PV par tour', 'Recupera 3% PS por turno', 'Her tur %3 CP iyileşir'],
    { regenPct: 0.03 }
  ),
  inchiostro_nero: def(
    ['Inchiostro Nero', 'Black Ink', 'Encre Noire', 'Tinta Negra', 'Siyah Mürekkep'],
    ['Riduce la precisione di chi lo attacca del 10%', 'Reduces attacker accuracy by 10%', 'Réduit la précision de l\'attaquant de 10%', 'Reduce la precisión del atacante un 10%', 'Saldırganın isabetini %10 azaltır'],
    { attackerAccuracyMod: -10 }
  ),
  corona_zucca: def(
    ['Corona di Zucca', 'Pumpkin Crown', 'Couronne Citrouille', 'Corona Calabaza', 'Kabak Tacı'],
    ['Attacchi Zucca +20%', 'Pumpkin attacks +20%', 'Attaques Citrouille +20%', 'Ataques Calabaza +20%', 'Kabak saldırıları +%20'],
    { typeBoost: { zucca: 0.20 } }
  ),
  necromanzia: def(
    ['Necromanzia', 'Necromancy', 'Nécromancie', 'Nigromancia', 'Ölüm Büyüsü'],
    ['+25% danno Spettro', '+25% Ghost damage', '+25% dégâts Spectre', '+25% daño Fantasma', '+%25 Hayalet hasarı'],
    { typeBoost: { spettro: 0.25 } }
  ),
  sentinella_eterna: def(
    ['Sentinella Eterna', 'Eternal Sentinel', 'Sentinelle Éternelle', 'Centinela Eterno', 'Ebedi Nöbetçi'],
    ['Sopravvive a un colpo fatale restando al 20% PS', 'Survives a fatal blow at 20% HP', 'Survit à un coup fatal à 20% PV', 'Sobrevive un golpe fatal al 20% PS', 'Ölümcül darbeye %20 CP ile dayanır'],
    { surviveOneHitKO: true }
  ),
  pozione_mortale: def(
    ['Pozione Mortale', 'Deadly Potion', 'Potion Mortelle', 'Poción Mortal', 'Ölümcül İksir'],
    ['Ogni attacco ha 15% di putrefare il bersaglio', 'Every attack has 15% chance to rot', 'Chaque attaque a 15% de chance de putréfier', 'Cada ataque tiene 15% de pudrir', 'Her saldırının %15 çürütme şansı var'],
    { onHitStatus: { status: 'putrefatto', chance: 15 } }
  ),
  signore_notte: def(
    ['Signore della Notte', 'Lord of Night', 'Seigneur de la Nuit', 'Señor de la Noche', 'Gece Lordu'],
    ['Attacchi Buio +30% nella Notte di Halloween', 'Dark attacks +30% on Halloween Night', 'Attaques Ténèbres +30% la Nuit d\'Halloween', 'Ataques Oscuros +30% en Noche de Halloween', 'Cadılar Bayramı Gecesinde karanlık saldırılar +%30'],
    { nightBoost: { type: 'buio', pct: 0.30 } }
  ),
  corona_maledetta: def(
    ['Corona Maledetta', 'Cursed Crown', 'Couronne Maudite', 'Corona Maldita', 'Lanetli Taç'],
    ['Tutti i tipi +15%, immune agli status', 'All types +15%, immune to status', 'Tous types +15%, immunisé aux statuts', 'Todos los tipos +15%, inmune a estados', 'Tüm tipler +%15, durumlara bağışık'],
    { allBoost: 0.15, immuneAll: true }
  ),
  pelle_spessa: def(
    ['Pelle Spessa', 'Thick Skin', 'Peau Épaisse', 'Piel Gruesa', 'Kalın Deri'],
    ['-10% danno subito', '-10% damage taken', '-10% dégâts reçus', '-10% daño recibido', '-%10 hasar alır'],
    { reduction: 0.10 }
  ),
  ancestrale: def(
    ['Ancestrale', 'Ancestral', 'Ancestral', 'Ancestral', 'Kadim'],
    ['+15% danno di tutti i tipi', '+15% damage of all types', '+15% dégâts de tous types', '+15% daño de todos los tipos', 'Tüm tiplere +%15 hasar'],
    { allBoost: 0.15 }
  ),
  cuore_notturno: def(
    ['Cuore Notturno', 'Night Heart', 'Cœur Nocturne', 'Corazón Nocturno', 'Gece Kalbi'],
    ['+20% danno Buio', '+20% Dark damage', '+20% dégâts Ténèbres', '+20% daño Oscuro', '+%20 Karanlık hasarı'],
    { typeBoost: { buio: 0.20 } }
  ),
  cuore_tuono: def(
    ['Cuore di Tuono', 'Thunder Heart', 'Cœur de Tonnerre', 'Corazón Trueno', 'Yıldırım Kalbi'],
    ['+20% danno Tuono', '+20% Thunder damage', '+20% dégâts Tonnerre', '+20% daño Trueno', '+%20 Yıldırım hasarı'],
    { typeBoost: { tuono: 0.20 } }
  ),
  marea_oscura: def(
    ['Marea Oscura', 'Dark Tide', 'Marée Sombre', 'Marea Oscura', 'Karanlık Dalga'],
    ['+25% danno Acqua', '+25% Water damage', '+25% dégâts Eau', '+25% daño Agua', '+%25 Su hasarı'],
    { typeBoost: { acqua: 0.25 } }
  ),
  fiamme_infernali: def(
    ['Fiamme Infernali', 'Hellfire', 'Flammes Infernales', 'Llamas Infernales', 'Cehennem Alevleri'],
    ['+25% danno Fuoco', '+25% Fire damage', '+25% dégâts Feu', '+25% daño Fuego', '+%25 Ateş hasarı'],
    { typeBoost: { fuoco: 0.25 } }
  ),
  istinto_aracnide: def(
    ['Istinto Aracnide', 'Arachnid Instinct', 'Instinct Arachnéen', 'Instinto Arácnido', 'Örümcek İçgüdüsü'],
    ['+20% danno Ragno', '+20% Spider damage', '+20% dégâts Araignée', '+20% daño Araña', '+%20 Örümcek hasarı'],
    { typeBoost: { ragno: 0.20 } }
  ),
  sette_vite: def(
    ['Sette Vite', 'Seven Lives', 'Sept Vies', 'Siete Vidas', 'Yedi Can'],
    ['10% probabilità di sopravvivere a un KO con 1 PS', '10% chance to survive a KO with 1 HP', '10% de chance de survivre à un KO avec 1 PV', '10% de sobrevivir un KO con 1 PS', 'Bir KO\'ya %10 şansla 1 CP ile dayanır'],
    { surviveChance: 10 }
  ),
  leggendario_zucca: def(
    ['Re di Samhain', 'Samhain King', 'Roi de Samhain', 'Rey de Samhain', 'Samhain Kralı'],
    ['+50% danno Zucca', '+50% Pumpkin damage', '+50% dégâts Citrouille', '+50% daño Calabaza', '+%50 Kabak hasarı'],
    { typeBoost: { zucca: 0.50 } }
  ),
  leggendario_spettro: def(
    ['Ectoplasma Supremo', 'Supreme Ectoplasm', 'Ectoplasme Suprême', 'Ectoplasma Supremo', 'Yüce Ektoplazma'],
    ['+50% danno Spettro', '+50% Ghost damage', '+50% dégâts Spectre', '+50% daño Fantasma', '+%50 Hayalet hasarı'],
    { typeBoost: { spettro: 0.50 } }
  ),
  leggendario_buio: def(
    ['Oscurità Assoluta', 'Absolute Darkness', 'Obscurité Absolue', 'Oscuridad Absoluta', 'Mutlak Karanlık'],
    ['+50% danno Buio', '+50% Dark damage', '+50% dégâts Ténèbres', '+50% daño Oscuro', '+%50 Karanlık hasarı'],
    { typeBoost: { buio: 0.50 } }
  ),
  leggendario_acqua: def(
    ['Abisso Infinito', 'Infinite Abyss', 'Abîme Infini', 'Abismo Infinito', 'Sonsuz Uçurum'],
    ['+50% danno Acqua', '+50% Water damage', '+50% dégâts Eau', '+50% daño Agua', '+%50 Su hasarı'],
    { typeBoost: { acqua: 0.50 } }
  ),
};

export const getAbilityDef = (abilityId: string): AbilityDef | undefined => ABILITIES[abilityId];

export const tAbilityName = (abilityId: string, lang: Language): string =>
  ABILITIES[abilityId]?.names[lang] || ABILITIES[abilityId]?.names.en || abilityId.replace(/_/g, ' ');

export const tAbilityDesc = (abilityId: string, lang: Language): string =>
  ABILITIES[abilityId]?.descs[lang] || ABILITIES[abilityId]?.descs.en || '';

// ---- Helper di battaglia ----

// Moltiplicatore danno per abilità dell'attaccante
export const getAbilityDamageMultiplier = (abilityId: string, moveType: MonsterType, weather: string | null): number => {
  const a = ABILITIES[abilityId];
  if (!a) return 1;
  let mult = 1;
  if (a.typeBoost?.[moveType]) mult += a.typeBoost[moveType]!;
  if (a.allBoost) mult += a.allBoost;
  if (a.nightBoost && a.nightBoost.type === moveType && weather === 'notte_halloween') mult += a.nightBoost.pct;
  return mult;
};

// Moltiplicatore danno subito per abilità del difensore
export const getAbilityDefenseMultiplier = (abilityId: string, moveType: MonsterType, hpPct: number): number => {
  const a = ABILITIES[abilityId];
  if (!a) return 1;
  let mult = 1;
  if (a.reduction) mult -= a.reduction;
  if (a.reductionBelowHalf && hpPct < 0.5) mult -= a.reductionBelowHalf;
  if (a.reductionPhysical && PHYSICAL_TYPES.includes(moveType)) mult -= a.reductionPhysical;
  return Math.max(0.1, mult);
};

export const getDodgeChance = (abilityId: string): number => ABILITIES[abilityId]?.dodge ?? 0;
export const getLifesteal = (abilityId: string): number => ABILITIES[abilityId]?.lifesteal ?? 0;
export const getCounter = (abilityId: string): number => ABILITIES[abilityId]?.counter ?? 0;
export const getAttackerAccuracyMod = (abilityId: string): number => ABILITIES[abilityId]?.attackerAccuracyMod ?? 0;
export const getOnHitStatus = (abilityId: string) => ABILITIES[abilityId]?.onHitStatus ?? null;

// Rigenerazione a inizio turno: ritorna PS recuperati
export const getTurnRegen = (abilityId: string, hp: number, maxHp: number): number => {
  const a = ABILITIES[abilityId];
  if (!a || hp <= 0 || hp >= maxHp) return 0;
  let heal = 0;
  if (a.regenFlatBelow && hp < maxHp * a.regenFlatBelow.belowPct) heal += a.regenFlatBelow.flat;
  if (a.regenPct) heal += Math.floor(maxHp * a.regenPct);
  return heal;
};

// Probabilità effetto modificata dall'abilità
export const getModifiedEffectChance = (abilityId: string, effect: StatusEffect | undefined, baseChance: number): number => {
  const a = ABILITIES[abilityId];
  if (!a || !effect) return baseChance;
  let chance = baseChance;
  if (a.effectBonus && a.effectBonus.status === effect) chance = Math.min(100, chance + a.effectBonus.bonus);
  if (a.effectMin) chance = Math.max(chance, a.effectMin);
  return chance;
};

// Immunità a uno status
export const isStatusImmune = (abilityId: string, effect: StatusEffect): boolean => {
  const a = ABILITIES[abilityId];
  if (!a) return false;
  if (a.immuneAll) return true;
  return a.immuneTo?.includes(effect) ?? false;
};

// Sopravvivenza KO: ritorna i PS a cui restare, o null se il KO avviene
export const trySurviveKO = (abilityId: string, maxHp: number, damage: number): number | null => {
  const a = ABILITIES[abilityId];
  if (!a) return null;
  if (a.surviveOneHitKO && damage >= maxHp * 0.8) return Math.floor(maxHp * 0.2);
  if (a.surviveChance && Math.random() * 100 < a.surviveChance) return 1;
  return null;
};
