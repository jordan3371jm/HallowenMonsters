import { MetaUpgrade } from './types';

export const defaultUpgrades: MetaUpgrade[] = [
  // A. Cure e Pozioni
  {
    id: 'extra_potion',
    name: 'Extra Starting Potion',
    description: 'Start each run with +1 Pumpkin Blood Potion',
    cost: 80,
    category: 'potion',
    purchased: false,
    emoji: '🧪',
    maxLevel: 5,
    currentLevel: 0,
  },
  {
    id: 'super_potion_extra',
    name: 'Extra Super Potion',
    description: 'Start each run with +1 Super Blood Potion',
    cost: 180,
    category: 'potion',
    purchased: false,
    emoji: '🧪',
    maxLevel: 3,
    currentLevel: 0,
  },
  {
    id: 'elisir_extra',
    name: 'Extra Spectral Elixir',
    description: 'Start each run with +1 Spectral Elixir',
    cost: 180,
    category: 'potion',
    purchased: false,
    emoji: '⚗️',
    maxLevel: 2,
    currentLevel: 0,
  },

  {
    id: 'checkpoint_heal',
    name: 'Free Gym Heal',
    description: 'Fully heal team after each Gym Leader',
    cost: 600,
    category: 'potion',
    purchased: false,
    emoji: '💚',
  },
  {
    id: 'night_regen',
    name: 'Night Regeneration',
    description: 'After each wave, each monster recovers 1% HP',
    cost: 60,
    category: 'potion',
    purchased: false,
    emoji: '🌙',
    maxLevel: 10,
    currentLevel: 0,
  },
  {
    id: 'infinite_elixir',
    name: 'Infinite Elixir',
    description: '1 potion regenerates every 5 waves, heals 100 HP',
    cost: 900,
    category: 'potion',
    purchased: false,
    emoji: '♾️',
  },
  {
    id: 'potion_bag',
    name: 'Healer\'s Bag',
    description: 'Max potion capacity +1 per run',
    cost: 90,
    category: 'potion',
    purchased: false,
    emoji: '🎒',
    maxLevel: 10,
    currentLevel: 0,
  },


  // B. Oggetti di Cattura
  {
    id: 'candy_stock',
    name: 'Cursed Candy Stock',
    description: 'Start with +1 Cursed Candy',
    cost: 60,
    category: 'capture',
    purchased: false,
    emoji: '🍬',
    maxLevel: 10,
    currentLevel: 0,
  },
  {
    id: 'pumpkin_stock',
    name: 'Empty Pumpkin Stock',
    description: 'Start with +1 Empty Pumpkin',
    cost: 160,
    category: 'capture',
    purchased: false,
    emoji: '🎃',
    maxLevel: 5,
    currentLevel: 0,
  },
  {
    id: 'coffin_stock',
    name: 'Ancient Coffin Stock',
    description: 'Start with +1 Ancient Coffin',
    cost: 260,
    category: 'capture',
    purchased: false,
    emoji: '⚰️',
    maxLevel: 5,
    currentLevel: 0,
  },
  {
    id: 'monster_charmer',
    name: 'Monster Charmer',
    description: '+1% global capture rate',
    cost: 100,
    category: 'capture',
    purchased: false,
    emoji: '✨',
    maxLevel: 10,
    currentLevel: 0,
  },
  {
    id: 'gravedigger_net',
    name: 'Gravedigger Net',
    description: 'Auto-capture monsters below 10% HP',
    cost: 900,
    category: 'capture',
    purchased: false,
    emoji: '🕸️',
  },

  // C. Condivisione e Crescita
  {
    id: 'exp_share_base',
    name: 'Basic EXP Share',
    description: 'All team monsters get 25% EXP even if not in field',
    cost: 400,
    category: 'exp',
    purchased: false,
    emoji: '📈',
  },
  {
    id: 'exp_share_total',
    name: 'Total EXP Share',
    description: 'All team monsters get 50% EXP even if not in field',
    cost: 900,
    category: 'exp',
    purchased: false,
    emoji: '📊',
    requires: 'exp_share_base',
  },
  {
    id: 'exp_share_perfect',
    name: 'Perfect EXP Share',
    description: 'All team monsters get 100% EXP even if not in field',
    cost: 2400,
    category: 'exp',
    purchased: false,
    emoji: '🏆',
    requires: 'exp_share_total',
  },
  {
    id: 'fast_growth',
    name: 'Fast Growth',
    description: '+1% EXP gained in all runs',
    cost: 60,
    category: 'exp',
    purchased: false,
    emoji: '⚡',
    maxLevel: 10,
    currentLevel: 0,
  },
  {
    id: 'bench_training',
    name: 'Graveyard Gym',
    description: 'All team monsters gain +1% extra EXP',
    cost: 100,
    category: 'exp',
    purchased: false,
    emoji: '💪',
    maxLevel: 10,
    currentLevel: 0,
  },

  // D. Oggetti e Strumenti

  {
    id: 'held_item_bone',
    name: 'Sacred Bones',
    description: '+10% attack when held',
    cost: 650,
    category: 'item',
    purchased: false,
    emoji: '🦴',
  },
  {
    id: 'held_item_mist',
    name: 'Mist Amulet',
    description: '+10% defense when held',
    cost: 650,
    category: 'item',
    purchased: false,
    emoji: '🌫️',
  },
  {
    id: 'held_item_feather',
    name: 'Raven Feather',
    description: '+10% speed when held',
    cost: 650,
    category: 'item',
    purchased: false,
    emoji: '🪶',
  },
  {
    id: 'held_item_heart',
    name: 'Pumpkin Heart',
    description: '+10% max HP when held',
    cost: 650,
    category: 'item',
    purchased: false,
    emoji: '❤️',
  },
  {
    id: 'held_item_eye',
    name: 'Spider Eye',
    description: '+10% accuracy when held',
    cost: 650,
    category: 'item',
    purchased: false,
    emoji: '👁️',
  },
  {
    id: 'held_item_fang',
    name: 'Vampire Fang',
    description: 'Recover +10% HP when dealing damage',
    cost: 650,
    category: 'item',
    purchased: false,
    emoji: '🦷',
  },
  {
    id: 'candy_level_up',
    name: 'Sweet Treat',
    description: 'Start each run with a treat that raises monster level by 1',
    cost: 350,
    category: 'item',
    purchased: false,
    emoji: '🍭',
    maxLevel: 5,
    currentLevel: 0,
  },
  {
    id: 'gravedigger_amulet',
    name: 'Gravedigger Amulet',
    description: 'Once per run, revive a monster at half HP',
    cost: 700,
    category: 'item',
    purchased: false,
    emoji: '🔮',
  },
];

export function getUpgradeById(id: string, upgrades: MetaUpgrade[]): MetaUpgrade | undefined {
  return upgrades.find(u => u.id === id);
}

export function getUpgradeCost(upgrade: MetaUpgrade): number {
  if (!upgrade.maxLevel || upgrade.currentLevel === undefined) {
    return upgrade.cost;
  }
  // Ogni livello costa il 25% più del precedente, con curva sostenibile.
  return Math.floor(upgrade.cost * Math.pow(1.25, upgrade.currentLevel));
}

export function canPurchaseUpgrade(upgrade: MetaUpgrade, upgrades: MetaUpgrade[], coins: number): boolean {
  const cost = getUpgradeCost(upgrade);
  
  // Se ha maxLevel, controlla se può essere potenziato ulteriormente
  if (upgrade.maxLevel) {
    const currentLevel = upgrade.currentLevel ?? 0;
    if (currentLevel >= upgrade.maxLevel) return false;
    if (coins < cost) return false;
    if (upgrade.requires) {
      const required = getUpgradeById(upgrade.requires, upgrades);
      if (!required || !required.purchased) return false;
    }
    return true;
  }
  
  // Altrimenti è un acquisto singolo
  if (upgrade.purchased) return false;
  if (coins < cost) return false;
  if (upgrade.requires) {
    const required = getUpgradeById(upgrade.requires, upgrades);
    if (!required || !required.purchased) return false;
  }
  return true;
}

export function calculateCursedCoinsReward(waveType: string, waveNumber: number, noKOs: boolean, fastVictory: boolean, firstGymVictory: boolean): number {
  let base = 0;
  let bonus = 0;

  switch (waveType) {
    case 'wild':
      base = 5;
      break;
    case 'trainer':
      if (waveNumber <= 4) {
        base = 15;
        if (noKOs) bonus = 5;
      } else if (waveNumber <= 7) {
        base = 25;
        if (fastVictory) bonus = 10;
      } else {
        base = 30;
      }
      break;
    case 'elite':
      base = 40;
      break;
    case 'gym_leader':
      base = 100;
      if (firstGymVictory) bonus = 50;
      break;
    case 'rare_wild':
    case 'double_wild':
      base = 10;
      break;
    default:
      base = 0;
  }

  return base + bonus;
}
