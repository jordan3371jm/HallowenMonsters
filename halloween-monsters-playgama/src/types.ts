export type MonsterType = 'fuoco' | 'acqua' | 'erba' | 'buio' | 'spettro' | 'tuono' | 'ghiaccio' | 'veleno' | 'osso' | 'ragno' | 'zucca';

export type MonsterRarity = 'comune' | 'non_comune' | 'raro' | 'epico' | 'leggendario' | 'mitico';

export type StatusEffect = 'maledetto' | 'spaventato' | 'sonnambulo' | 'putrefatto' | 'bruciato' | 'paralizzato';

export interface Move {
  id: string;
  name: string;
  type: MonsterType;
  power: number;
  accuracy: number;
  pp: number;
  maxPp: number;
  effect?: StatusEffect;
  effectChance?: number;
  description: string;
}

export interface MonsterStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
}

export interface Evolution {
  id: string;
  name: string;
  emoji: string;
  level: number;
}

export interface Monster {
  id: string;
  name: string;
  type: MonsterType;
  level: number;
  exp: number;
  expToNext: number;
  stats: MonsterStats;
  moves: Move[];
  ability: string;
  abilityDesc: string;
  status: StatusEffect[];
  sleepTurns?: number; // Numero di turni rimanenti prima del risveglio (1-6)
  emoji: string;
  evolvesTo?: string; // Per compatibilità con evoluzioni singole
  evolveLevel?: number; // Per compatibilità con evoluzioni singole
  evolutions?: Evolution[]; // Per evoluzioni multiple
  rarity?: MonsterRarity; // Rarità del mostro (default: comune)
  tier?: number; // Stadio evolutivo 1-3, usato per il gating degli incontri selvatici
  // --- Stato di battaglia (azzerato a ogni lotta) ---
  statusTurns?: Partial<Record<StatusEffect, number>>; // turni rimanenti per ogni stato
  stages?: { attack: number; defense: number; speed: number }; // modificatori -4..+4
  survivedUsed?: boolean; // abilita' di sopravvivenza al KO gia' usata in questa lotta
  shiny?: boolean; // variante luccicante rara
  isBoss?: boolean; // capopalestra / leggendari: barra PS da boss
  metaApplied?: boolean; // bonus degli strumenti del Meta Negozio già applicati
}

export interface ItemType {
  id: string;
  name: string;
  description: string;
  quantity: number;
  category: 'potion' | 'capture' | 'tool';
  power: number;
  emoji: string;
}

export type WaveType = 'wild' | 'trainer' | 'rare_wild' | 'double_wild' | 'elite' | 'gym_leader';

export interface Wave {
  number: number;
  type: WaveType;
  description: string;
  enemies: Monster[];
  catchable: boolean;
}

export type MapNodeType = 'wild' | 'trainer' | 'shop' | 'event' | 'gym_leader' | 'rest';

export interface MapNode {
  id: number;
  type: MapNodeType;
  completed: boolean;
  connections: number[];
}

export type GamePhase = 'title' | 'starter_select' | 'map' | 'battle' | 'catch' | 'victory' | 'game_over' | 'shop' | 'event' | 'meta_shop' | 'daily_objectives' | 'achievements' | 'statistics' | 'settings';

export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'potion' | 'capture' | 'exp' | 'item' | 'cosmetic';
  purchased: boolean;
  emoji: string;
  requires?: string;
  maxLevel?: number;
  currentLevel?: number;
}

export interface DailyObjective {
  id: string;
  description: string;
  target: number;
  current: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
  trackId?: string;
}

export interface GameAchievement {
  id: string;
  name: string;
  description: string;
  reward: number;
  unlocked: boolean;
  claimed: boolean;
}

export interface PersistentData {
  cursedCoins: number;
  totalRuns: number;
  bestWave: number;
  totalMedals: number;
  upgrades: MetaUpgrade[];
  lastLoginDate: string;
  loginStreak: number;
  dailyObjectives: DailyObjective[];
  dailyObjectivesDate: string;
  weeklyObjectives: DailyObjective[];
  weeklyObjectivesWeek: string;
  monthlyObjectives: DailyObjective[];
  monthlyObjectivesMonth: string;
  achievements: GameAchievement[];
  totalMonstersDefeated: number;
  totalMonstersCaught: number;
  totalGymLeadersDefeated: number;
  // Statistiche dettagliate
  totalBattles: number;
  totalWins: number;
  totalLosses: number;
  bestRunWave: number;
  mostCatchesInRun: number;
  totalPlayTime: number;
  longestWinStreak: number;
  currentWinStreak: number;
  totalDamageDealt: number;
  totalDamageTaken: number;
  totalHealing: number;
  favoriteMonster: string;
  monsterUsage: Record<string, number>;
  // Pubblicità premiate -> monete
  adCoinsDate: string;
  adCoinsWatched: number;
}

export interface GameState {
  phase: GamePhase;
  team: Monster[];
  items: ItemType[];
  candies: number;
  cursedCoins: number;
  medals: string[];
  currentWave: number;
  map: MapNode[];
  currentNode: number;
  battleEnemies: Monster[];
  activeEnemyIndex: number;
  battleCatchable: boolean;
  battleLog: string[];
  selectedMonsterIndex: number;
  isPlayerTurn: boolean;
  battleOver: boolean;
  battleWon: boolean;
  healsUsed: number;
  revivesUsed?: number; // resurrezioni con pubblicità usate nella run (max 1)
  showAdModal: boolean;
  adType: 'heal' | 'revive' | 'coins' | null;
  adsToWatch: number;
  adsWatched: number;
  persistentData: PersistentData;
}
