// Dati permanenti del giocatore e bonus del Meta Negozio applicati a una partita:
// valori iniziali, migrazione dei salvataggi vecchi, oggetti e capienze, meteo.
// Tutte funzioni pure, senza React (prima stavano in App.tsx).
import type { Monster, ItemType, PersistentData, MetaUpgrade } from './types';
import { defaultUpgrades } from './metaShop';
import { initializeAchievements, migrateObjectives } from './rewards';
import { defaultItems } from './data/items';
import { saveAll } from './playgama';

export type Weather = 'normale' | 'luna_piena' | 'nebbia' | 'notte_halloween';

export function getRandomWeather(): Weather {
  const roll = Math.random();
  if (roll < 0.15) return 'luna_piena';
  if (roll < 0.25) return 'nebbia';
  if (roll < 0.35) return 'notte_halloween';
  return 'normale';
}

export const weatherInfo: Record<Weather, { nameKey: string; emoji: string; descKey: string }> = {
  normale: { nameKey: '', emoji: '🌙', descKey: '' },
  luna_piena: { nameKey: 'weather.luna_piena', emoji: '🌕', descKey: 'weather.spettro_boost' },
  nebbia: { nameKey: 'weather.nebbia', emoji: '🌫️', descKey: 'weather.precision_down' },
  notte_halloween: { nameKey: 'weather.notte_halloween', emoji: '🎃', descKey: 'weather.buio_spettro_boost' },
};

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function getUpgradeLevel(upgrades: MetaUpgrade[], upgradeId: string): number {
  const upgrade = upgrades.find(item => item.id === upgradeId);
  return Math.max(0, upgrade?.currentLevel || (upgrade?.purchased ? 1 : 0));
}

export function hasUpgrade(upgrades: MetaUpgrade[], upgradeId: string): boolean {
  return getUpgradeLevel(upgrades, upgradeId) > 0;
}

export function applyMetaBonusesToMonster(monster: Monster, upgrades: MetaUpgrade[]): Monster {
  const result = deepClone(monster);
  if (result.metaApplied) return result;
  result.metaApplied = true;
  if (hasUpgrade(upgrades, 'held_item_bone')) result.stats.attack = Math.floor(result.stats.attack * 1.1);
  if (hasUpgrade(upgrades, 'held_item_mist')) result.stats.defense = Math.floor(result.stats.defense * 1.1);
  if (hasUpgrade(upgrades, 'held_item_feather')) result.stats.speed = Math.floor(result.stats.speed * 1.1);
  if (hasUpgrade(upgrades, 'held_item_heart')) {
    const oldMaxHp = result.stats.maxHp;
    result.stats.maxHp = Math.floor(oldMaxHp * 1.1);
    result.stats.hp = Math.min(result.stats.maxHp, Math.floor(result.stats.hp * result.stats.maxHp / oldMaxHp));
  }
  if (hasUpgrade(upgrades, 'held_item_eye')) {
    result.moves = result.moves.map(move => ({ ...move, accuracy: Math.min(100, Math.round(move.accuracy * 1.1)) }));
  }
  return result;
}

// Funzione per applicare gli upgrade del Meta Shop agli item iniziali
export function applyUpgradesToItems(upgrades: MetaUpgrade[]): ItemType[] {
  const items = deepClone(defaultItems);
  
  upgrades.forEach(upgrade => {
    const level = getUpgradeLevel(upgrades, upgrade.id);
    if (level === 0) return;
    
    switch (upgrade.id) {
      case 'extra_potion': {
        const item = items.find(i => i.id === 'pozione_sangue');
        if (item) item.quantity += level;
        break;
      }
      case 'super_potion_extra': {
        const item = items.find(i => i.id === 'super_pozione');
        if (item) item.quantity += level;
        break;
      }
      case 'total_potion_extra': {
        const item = items.find(i => i.id === 'pozione_totale');
        if (item) item.quantity += level;
        break;
      }
      case 'elisir_extra': {
        const item = items.find(i => i.id === 'elisir_spettrale');
        if (item) item.quantity += level;
        break;
      }
      case 'candy_stock': {
        const item = items.find(i => i.id === 'caramella_stregata');
        if (item) item.quantity += level;
        break;
      }
      case 'pumpkin_stock': {
        const item = items.find(i => i.id === 'zucca_vuota');
        if (item) item.quantity += level;
        break;
      }
      case 'coffin_stock': {
        const item = items.find(i => i.id === 'bara_antica');
        if (item) item.quantity += level;
        break;
      }
    }
  });
  
  return items;
}

export function getItemStackCapacity(itemId: string, upgrades: MetaUpgrade[]): number {
  const defaultItem = defaultItems.find(item => item.id === itemId);
  const startingStockUpgrade: Record<string, string> = {
    pozione_sangue: 'extra_potion',
    super_pozione: 'super_potion_extra',
    elisir_spettrale: 'elisir_extra',
    pozione_totale: 'total_potion_extra',
  };
  // Base: 5 pezzi per ogni cura (più le scorte iniziali e la Borsa del Guaritore)
  return Math.max(5, defaultItem?.quantity || 0)
    + getUpgradeLevel(upgrades, 'potion_bag')
    + getUpgradeLevel(upgrades, startingStockUpgrade[itemId] || '');
}

export function getDefaultPersistentData(): PersistentData {
  return {
    cursedCoins: 0,
    totalRuns: 0,
    bestWave: 0,
    totalMedals: 0,
    upgrades: deepClone(defaultUpgrades),
    lastLoginDate: '',
    loginStreak: 0,
    dailyObjectives: [],
    dailyObjectivesDate: '',
    weeklyObjectives: [],
    weeklyObjectivesWeek: '',
    monthlyObjectives: [],
    monthlyObjectivesMonth: '',
    achievements: [],
    totalMonstersDefeated: 0,
    totalMonstersCaught: 0,
    totalGymLeadersDefeated: 0,
    // Statistiche dettagliate
    totalBattles: 0,
    totalWins: 0,
    totalLosses: 0,
    bestRunWave: 0,
    mostCatchesInRun: 0,
    totalPlayTime: 0,
    longestWinStreak: 0,
    currentWinStreak: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    totalHealing: 0,
    favoriteMonster: '',
    monsterUsage: {},
    adCoinsDate: '',
    adCoinsWatched: 0,
  };
}

export function migratePersistentData(data: any): PersistentData {
  data = data && typeof data === 'object' ? data : {};
  const migratedObjectives = migrateObjectives(Array.isArray(data.dailyObjectives) ? data.dailyObjectives : []);
  const migratedWeeklyObjectives = migrateObjectives(Array.isArray(data.weeklyObjectives) ? data.weeklyObjectives : []);
  const migratedMonthlyObjectives = migrateObjectives(Array.isArray(data.monthlyObjectives) ? data.monthlyObjectives : []);
  
  // Migra achievement per aggiungere il campo claimed
  const savedAchievements = Array.isArray(data.achievements) ? data.achievements : [];
  const migratedAchievements = initializeAchievements().map(defaultAchievement => {
    const savedAchievement = savedAchievements.find((ach: any) => ach.id === defaultAchievement.id);
    if (!savedAchievement) return defaultAchievement;
    return {
      ...defaultAchievement,
      ...savedAchievement,
      // I vecchi risultati sbloccati non devono poter pagare una seconda volta.
      claimed: savedAchievement.claimed !== undefined
        ? savedAchievement.claimed
        : Boolean(savedAchievement.unlocked),
    };
  });
  
  // Migra upgrade per aggiornare i prezzi con i nuovi valori e rimuovere upgrade obsoleti
  const savedUpgrades = Array.isArray(data.upgrades) ? data.upgrades : [];
  const migratedUpgrades = defaultUpgrades.map(defaultUpgrade => {
    // Trova l'upgrade corrispondente nei dati salvati
    const savedUpgrade = savedUpgrades.find((u: any) => u.id === defaultUpgrade.id);
    if (savedUpgrade) {
      // Mantieni lo stato di acquisto ma aggiorna il prezzo e i dettagli
      return {
        ...defaultUpgrade,
        purchased: savedUpgrade.purchased || false,
        currentLevel: savedUpgrade.currentLevel || 0,
      };
    }
    // Se non esiste nei dati salvati, usa il default
    return { ...defaultUpgrade };
  });
  
  return {
    cursedCoins: data.cursedCoins || 0,
    totalRuns: data.totalRuns || 0,
    bestWave: data.bestWave || 0,
    totalMedals: data.totalMedals || 0,
    upgrades: migratedUpgrades,
    lastLoginDate: data.lastLoginDate || '',
    loginStreak: data.loginStreak || 0,
    dailyObjectives: migratedObjectives,
    dailyObjectivesDate: data.dailyObjectivesDate || '',
    weeklyObjectives: migratedWeeklyObjectives,
    weeklyObjectivesWeek: data.weeklyObjectivesWeek || '',
    monthlyObjectives: migratedMonthlyObjectives,
    monthlyObjectivesMonth: data.monthlyObjectivesMonth || '',
    achievements: migratedAchievements,
    totalMonstersDefeated: data.totalMonstersDefeated || 0,
    totalMonstersCaught: data.totalMonstersCaught || 0,
    totalGymLeadersDefeated: data.totalGymLeadersDefeated || 0,
    // Statistiche dettagliate
    totalBattles: data.totalBattles || 0,
    totalWins: data.totalWins || 0,
    totalLosses: data.totalLosses || 0,
    bestRunWave: data.bestRunWave || data.bestWave || 0,
    gamesCompleted: data.gamesCompleted || 0,
    ownedProducts: Array.isArray(data.ownedProducts) ? data.ownedProducts : [],
    mostCatchesInRun: data.mostCatchesInRun || 0,
    totalPlayTime: data.totalPlayTime || 0,
    longestWinStreak: data.longestWinStreak || 0,
    currentWinStreak: data.currentWinStreak || 0,
    totalDamageDealt: data.totalDamageDealt || 0,
    totalDamageTaken: data.totalDamageTaken || 0,
    totalHealing: data.totalHealing || 0,
    favoriteMonster: data.favoriteMonster || '',
    monsterUsage: data.monsterUsage || {},
    adCoinsDate: data.adCoinsDate || '',
    adCoinsWatched: data.adCoinsWatched || 0,
  };
}

// Ricompensa pubblicita' -> Monete Maledette
export const AD_COINS_REWARD = 50;
export const FINAL_REWARD = 500;

// Negozio con soldi veri: i prezzi arrivano dal catalogo di Playgama
export const STORE_PRODUCTS: { id: string; emoji: string; coins: number; permanent: boolean }[] = [
  { id: 'coins_small', emoji: '🪙', coins: 1500, permanent: false },
  { id: 'coins_medium', emoji: '💰', coins: 3500, permanent: false },
  { id: 'coins_large', emoji: '👑', coins: 20000, permanent: false },
  { id: 'starter_pack', emoji: '🎁', coins: 1000, permanent: true },
  { id: 'double_coins', emoji: '✨', coins: 0, permanent: true },
];
export const AD_COINS_DAILY_LIMIT = 10;

export function getAdCoinsLeft(data: PersistentData): number {
  const today = new Date().toDateString();
  const watched = data.adCoinsDate === today ? data.adCoinsWatched : 0;
  return Math.max(0, AD_COINS_DAILY_LIMIT - watched);
}

export async function savePersistentData(data: PersistentData) {
  try {
    await saveAll({ halloween_monsters_persistent: data });
  } catch (e) {
    console.error('Failed to save persistent data:', e);
  }
}
