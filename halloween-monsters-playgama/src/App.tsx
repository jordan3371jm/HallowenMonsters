import { useState, useEffect, useRef } from 'react';
import { GameState, Monster, ItemType, MapNode, MapNodeType, StatusEffect, PersistentData, MetaUpgrade } from './types';
import { starters, typeColors } from './data/monsters';
import { Language, t, tMonster, tItem, tItemDesc, tMove, tType } from './i18n';
import { tAbilityName, tAbilityDesc } from './abilities';
import { defaultUpgrades, calculateCursedCoinsReward, canPurchaseUpgrade, getUpgradeCost } from './metaShop';
import MetaShop from './MetaShop';
import {
  advanceObjectives, generateDailyObjectives, generateMonthlyObjectives, generateWeeklyObjectives,
  getDailyPeriodKey, getLoginReward, getMonthlyPeriodKey, getWeeklyPeriodKey, initializeAchievements,
  checkAchievements, migrateObjectives,
} from './rewards';
import { dailyObjectiveTranslations, achievementTranslations } from './rewardTranslations';
import MonsterIcon from './components/MonsterIcons';
import { CoinIcon, ShopIcon, TargetIcon, TrophyIcon, ChartIcon, GearIcon, PlayIcon, FilmIcon } from './components/UIIcons';
import { getMonsterIconPath } from './data/monsterPNGIcons';
import { defaultItems, shopPrices } from './data/items';

import { showToast } from './toast';
import Statistics from './components/Statistics';
import Settings from './components/Settings';
import { ScreenTransition } from './components/BattleAnimations';
import BattleScreen, { type BattleFinish, type BattleRewards } from './battle/BattleScreen';
import { createBattleState, cleanupAfterBattle, expForLevel, type BattleConfig, type BattleState, type TurnStats } from './battle/engine';
import { buildEncounter, type EncounterKind } from './battle/encounters';
import { GameSettings, defaultSettings, normalizeSettings } from './settings';
import { playSfx, setMusic, setAudioSettings, setPlatformAudio, setPlatformPaused, unlockAudio } from './audio';
import { TypeBadge } from './components/TypeIcons';
import { setPerfActive } from './perf';
import {
  initializePlaygama,
  getPlatformLanguage,
  getIsPaused,
  getIsAudioEnabled,
  onPauseChanged,
  onAudioChanged,
  loadAll,
  saveAll,
  saveData,
  sendGameReady,
  sendPlatformMessage,
  trackEvent,
  setLeaderboardScore,
  showInterstitialAd,
  showRewardedAd,
  cancelRewardedAd,
  isRewardedAvailable,
  type RewardedAdResult,
} from './playgama';

type Weather = 'normale' | 'luna_piena' | 'nebbia' | 'notte_halloween';
type ChallengePeriod = 'daily' | 'weekly' | 'monthly';

function getRandomWeather(): Weather {
  const roll = Math.random();
  if (roll < 0.15) return 'luna_piena';
  if (roll < 0.25) return 'nebbia';
  if (roll < 0.35) return 'notte_halloween';
  return 'normale';
}

const weatherInfo: Record<Weather, { nameKey: string; emoji: string; descKey: string }> = {
  normale: { nameKey: '', emoji: '🌙', descKey: '' },
  luna_piena: { nameKey: 'weather.luna_piena', emoji: '🌕', descKey: 'weather.spettro_boost' },
  nebbia: { nameKey: 'weather.nebbia', emoji: '🌫️', descKey: 'weather.precision_down' },
  notte_halloween: { nameKey: 'weather.notte_halloween', emoji: '🎃', descKey: 'weather.buio_spettro_boost' },
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function generateMap(wave: number): MapNode[] {
  const nodes: MapNode[] = [];
  
  // Genera tipi di nodi basati sulla wave
  // Ogni mappa ha il capopalestra all'ultimo nodo
  const types: MapNodeType[] = [];
  for (let i = 0; i < 10; i++) {
    if (i === 9) {
      // Ultimo nodo: sempre gym leader
      types.push('gym_leader');
    } else if (i === 3 || i === 7) {
      // Nodi 3 e 7: sempre shop
      types.push('shop');
    } else if (i === 5) {
      // Nodo 5: sempre evento
      types.push('event');
    } else if (i === 8) {
      // Nodo 8: falò per riposare prima del capopalestra
      types.push('rest');
    } else {
      // Altri nodi: wild o trainer (più trainer con wave alte)
      const trainerChance = Math.min(0.6, 0.2 + wave * 0.01);
      types.push(Math.random() < trainerChance ? 'trainer' : 'wild');
    }
  }
  
  for (let i = 0; i < 10; i++) {
    const connections: number[] = [];
    if (i < 9) {
      connections.push(i + 1);
      // Più connessioni alternative con wave alte per più scelta
      const extraConnectionChance = Math.min(0.7, 0.3 + wave * 0.02);
      if (i + 2 < 10 && Math.random() < extraConnectionChance) {
        connections.push(i + 2);
      }
      // Connessioni saltate per wave molto alte
      if (wave > 20 && i + 3 < 10 && Math.random() < 0.2) {
        connections.push(i + 3);
      }
    }
    nodes.push({
      id: i,
      type: types[i],
      completed: false,
      connections,
    });
  }
  return nodes;
}


function getUpgradeLevel(upgrades: MetaUpgrade[], upgradeId: string): number {
  const upgrade = upgrades.find(item => item.id === upgradeId);
  return Math.max(0, upgrade?.currentLevel || (upgrade?.purchased ? 1 : 0));
}

function hasUpgrade(upgrades: MetaUpgrade[], upgradeId: string): boolean {
  return getUpgradeLevel(upgrades, upgradeId) > 0;
}

function applyMetaBonusesToMonster(monster: Monster, upgrades: MetaUpgrade[]): Monster {
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
function applyUpgradesToItems(upgrades: MetaUpgrade[]): ItemType[] {
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

function getItemStackCapacity(itemId: string, upgrades: MetaUpgrade[]): number {
  const defaultItem = defaultItems.find(item => item.id === itemId);
  const startingStockUpgrade: Record<string, string> = {
    pozione_sangue: 'extra_potion',
    super_pozione: 'super_potion_extra',
    elisir_spettrale: 'elisir_extra',
  };
  // Base: 5 pezzi per ogni cura (più le scorte iniziali e la Borsa del Guaritore)
  return Math.max(5, defaultItem?.quantity || 0)
    + getUpgradeLevel(upgrades, 'potion_bag')
    + getUpgradeLevel(upgrades, startingStockUpgrade[itemId] || '');
}

function getDefaultPersistentData(): PersistentData {
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

function migratePersistentData(data: any): PersistentData {
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
const AD_COINS_REWARD = 50;
const AD_COINS_DAILY_LIMIT = 10;

function getAdCoinsLeft(data: PersistentData): number {
  const today = new Date().toDateString();
  const watched = data.adCoinsDate === today ? data.adCoinsWatched : 0;
  return Math.max(0, AD_COINS_DAILY_LIMIT - watched);
}

async function savePersistentData(data: PersistentData) {
  try {
    await saveAll({ halloween_monsters_persistent: data });
  } catch (e) {
    console.error('Failed to save persistent data:', e);
  }
}

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [persistentData, setPersistentData] = useState<PersistentData>(getDefaultPersistentData());
  // Bug fix: la ricompensa di login e gli obiettivi giornalieri partono solo
  // DOPO il caricamento asincrono dal Playgama storage, altrimenti il dato
  // cloud (con lastLoginDate di ieri) sovrascriveva quello appena aggiornato
  // e la ricompensa veniva accreditata due volte
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>({
    phase: 'title',
    team: [],
    items: deepClone(defaultItems),
    candies: 50,
    cursedCoins: 0,
    medals: [],
    currentWave: 1,
    map: [],
    currentNode: -1,
    battleEnemies: [],
    activeEnemyIndex: 0,
    battleCatchable: false,
    battleLog: [],
    selectedMonsterIndex: 0,
    isPlayerTurn: true,
    battleOver: false,
    battleWon: false,
    healsUsed: 0,
    showAdModal: false,
    adType: null,
    adsToWatch: 0,
    adsWatched: 0,
    persistentData: getDefaultPersistentData(),
  });

  // Salvataggio con debounce: raggruppa piu' modifiche ravvicinate in una sola
  // scrittura (meno lavoro su localStorage e sullo storage di Playgama).
  const pendingSaveRef = useRef<PersistentData | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    if (pendingSaveRef.current) {
      savePersistentData(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
  };
  useEffect(() => {
    if (dataLoaded) {
      pendingSaveRef.current = persistentData;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(flushSave, 800);
    }
    setGameState(prev => ({ ...prev, persistentData }));
  }, [persistentData, dataLoaded]);
  // Salva subito quando la scheda viene nascosta/chiusa (nessuna perdita di progressi)
  useEffect(() => {
    const onHide = () => { if (document.hidden) flushSave(); };
    const onUnload = () => flushSave();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onUnload);
      window.removeEventListener('beforeunload', onUnload);
      flushSave();
    };
  }, []);

  // Ref sempre aggiornato allo stato: evita letture stale nelle callback
  // schedulate con setTimeout (es. executePlayerAttack dopo il turno nemico)
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  // Frequenza interstitial: istante dell'ultima pubblicità mostrata e avvio gioco
  const lastInterstitialRef = useRef(0);
  // Avvio: Bridge, caricamento di tutti i dati in un'unica chiamata Storage,
  // lingua (salvata o della piattaforma), audio/pausa, poi game_ready.
  useEffect(() => {
    const initGame = async () => {
      await initializePlaygama();

      const saved = await loadAll<Record<string, any>>({
        halloween_monsters_persistent: null,
        halloween_monsters_lang: null,
        halloween_monsters_settings: null,
        // chiavi delle versioni precedenti (impostazioni separate)
        battleEffects: null,
        screenShake: null,
        animations: null,
      });

      const supported: Language[] = ['en', 'it', 'fr', 'es', 'tr'];
      const savedLang = saved.halloween_monsters_lang as Language | null;
      setLang(savedLang && supported.includes(savedLang) ? savedLang : getPlatformLanguage());

      const loadedSettings = normalizeSettings(saved.halloween_monsters_settings, {
        battleEffects: saved.battleEffects, screenShake: saved.screenShake, animations: saved.animations,
      });
      setSettings(loadedSettings);
      setAudioSettings({ sfx: loadedSettings.sfx, music: loadedSettings.music });

      // Anche un salvataggio senza run completate può contenere monete,
      // potenziamenti o sfide: non scartarlo in base a totalRuns.
      setPersistentData(migratePersistentData(saved.halloween_monsters_persistent || getDefaultPersistentData()));
      setDataLoaded(true);

      // Audio e pausa della piattaforma (pubblicità, cambio scheda)
      setPlatformAudio(getIsAudioEnabled());
      setPlatformPaused(getIsPaused());
      onAudioChanged(enabled => setPlatformAudio(enabled));
      onPauseChanged(paused => setPlatformPaused(paused));

      // Rimuove la schermata di caricamento e segnala che il gioco è pronto
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      document.getElementById('boot')?.remove();
      sendGameReady();
    };

    initGame().catch(() => {
      setDataLoaded(true);
      document.getElementById('boot')?.remove();
    });
  }, []);

  // Salva le impostazioni e le applica all'audio
  const updateSettings = (next: GameSettings) => {
    setSettings(next);
    setAudioSettings({ sfx: next.sfx, music: next.music });
    saveData('halloween_monsters_settings', next);
    trackEvent('settings_changed', { music: next.music, sfx: next.sfx, effects: next.effects, fast: next.fastBattle });
  };

  const changeLanguage = (next: Language) => {
    setLang(next);
    saveData('halloween_monsters_lang', next);
  };

  // Musica: battaglia durante le lotte, tema notturno altrove
  useEffect(() => {
    if (!dataLoaded) return;
    setMusic(gameState.phase === 'battle' ? 'battle' : 'menu');
    setPerfActive(gameState.phase === 'battle');
  }, [gameState.phase, dataLoaded]);

  // Login giornaliero e inizializzazione obiettivi
  useEffect(() => {
    if (!dataLoaded) return;
    const today = getDailyPeriodKey();
    const thisWeek = getWeeklyPeriodKey();
    const thisMonth = getMonthlyPeriodKey();
    
    // Inizializza achievements se vuoti
    if (persistentData.achievements.length === 0) {
      setPersistentData(prev => ({
        ...prev,
        achievements: initializeAchievements(),
      }));
    }
    
    // Inizializza o rinnova le tre serie di sfide nel rispettivo periodo.
    setPersistentData(prev => ({
      ...prev,
      ...(prev.dailyObjectivesDate !== today
        ? { dailyObjectives: generateDailyObjectives(), dailyObjectivesDate: today }
        : {}),
      ...(prev.weeklyObjectivesWeek !== thisWeek
        ? { weeklyObjectives: generateWeeklyObjectives(), weeklyObjectivesWeek: thisWeek }
        : {}),
      ...(prev.monthlyObjectivesMonth !== thisMonth
        ? { monthlyObjectives: generateMonthlyObjectives(), monthlyObjectivesMonth: thisMonth }
        : {}),
    }));
    
    // Controlla login giornaliero
    if (persistentData.lastLoginDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isConsecutive = persistentData.lastLoginDate === yesterday.toDateString();
      
      const newStreak = isConsecutive ? persistentData.loginStreak + 1 : 1;
      const loginReward = getLoginReward(newStreak);
      
      setPersistentData(prev => ({
        ...prev,
        lastLoginDate: today,
        loginStreak: newStreak,
        cursedCoins: prev.cursedCoins + loginReward,
      }));
      
      // Mostra notifica ricompensa login
      setTimeout(() => {
        showToast(t('alert.login_daily', lang).replace('{streak}', String(newStreak)).replace('{reward}', String(loginReward)));
      }, 500);
    }
  }, [dataLoaded]);

  // Rinnova le sfide se il gioco resta aperto oltre il cambio di giorno,
  // settimana o mese, e quando il giocatore torna alla scheda.
  useEffect(() => {
    if (!dataLoaded) return;
    const refreshPeriods = () => {
      const today = getDailyPeriodKey();
      const thisWeek = getWeeklyPeriodKey();
      const thisMonth = getMonthlyPeriodKey();
      setPersistentData(prev => {
        if (
          prev.dailyObjectivesDate === today &&
          prev.weeklyObjectivesWeek === thisWeek &&
          prev.monthlyObjectivesMonth === thisMonth
        ) return prev;
        return {
          ...prev,
          ...(prev.dailyObjectivesDate !== today
            ? { dailyObjectives: generateDailyObjectives(), dailyObjectivesDate: today }
            : {}),
          ...(prev.weeklyObjectivesWeek !== thisWeek
            ? { weeklyObjectives: generateWeeklyObjectives(), weeklyObjectivesWeek: thisWeek }
            : {}),
          ...(prev.monthlyObjectivesMonth !== thisMonth
            ? { monthlyObjectives: generateMonthlyObjectives(), monthlyObjectivesMonth: thisMonth }
            : {}),
        };
      });
    };
    const onFocus = () => refreshPeriods();
    const timer = setInterval(refreshPeriods, 60_000);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [dataLoaded]);

  // Tracking tempo di gioco
  useEffect(() => {
    // Prima ogni secondo: ogni tick ridisegnava tutta l'app e riscriveva il
    // salvataggio (localStorage + Playgama). Ora accumula a blocchi di 10s e
    // solo mentre la pagina e' visibile.
    const TICK_S = 10;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setPersistentData(prev => ({
        ...prev,
        totalPlayTime: prev.totalPlayTime + TICK_S,
      }));
    }, TICK_S * 1000);
    return () => clearInterval(interval);
  }, []);

  const purchaseUpgrade = (upgradeId: string) => {
    const target = persistentData.upgrades.find(u => u.id === upgradeId);
    if (target && canPurchaseUpgrade(target, persistentData.upgrades, persistentData.cursedCoins)) {
      playSfx('coin');
      trackEvent('upgrade_purchased', { upgrade_id: upgradeId, level: (target.currentLevel || 0) + 1, price: getUpgradeCost(target) });
    } else {
      playSfx('ui_error');
    }
    // Controlla costo, requisiti e livello sullo stato più recente: evita
    // acquisti doppi e saldo negativo se il giocatore clicca rapidamente.
    setPersistentData(prev => {
      const upgrade = prev.upgrades.find(u => u.id === upgradeId);
      if (!upgrade || !canPurchaseUpgrade(upgrade, prev.upgrades, prev.cursedCoins)) return prev;
      const cost = getUpgradeCost(upgrade);
      return {
        ...prev,
        cursedCoins: prev.cursedCoins - cost,
        upgrades: prev.upgrades.map(u => u.id === upgradeId
          ? { ...u, currentLevel: u.maxLevel ? (u.currentLevel || 0) + 1 : u.currentLevel, purchased: true }
          : u),
      };
    });
  };

  const addCursedCoins = (amount: number) => {
    setPersistentData(prev => ({
      ...prev,
      cursedCoins: prev.cursedCoins + amount,
    }));
  };

  const updateChallengeProgress = (trackId: string, amount = 1, mode: 'add' | 'max' = 'add') => {
    const today = getDailyPeriodKey();
    const thisWeek = getWeeklyPeriodKey();
    const thisMonth = getMonthlyPeriodKey();
    setPersistentData(prev => {
      const daily = prev.dailyObjectivesDate === today
        ? prev.dailyObjectives
        : generateDailyObjectives();
      const weekly = prev.weeklyObjectivesWeek === thisWeek
        ? prev.weeklyObjectives
        : generateWeeklyObjectives();
      const monthly = prev.monthlyObjectivesMonth === thisMonth
        ? prev.monthlyObjectives
        : generateMonthlyObjectives();
      return {
        ...prev,
        dailyObjectives: advanceObjectives(daily, trackId, amount, mode),
        dailyObjectivesDate: today,
        weeklyObjectives: advanceObjectives(weekly, trackId, amount, mode),
        weeklyObjectivesWeek: thisWeek,
        monthlyObjectives: advanceObjectives(monthly, trackId, amount, mode),
        monthlyObjectivesMonth: thisMonth,
      };
    });
  };

  // Gli obiettivi di ondata misurano il record raggiunto, non sommano il
  // numero dell'ondata a ogni passaggio.
  const objectiveTrackIds: Record<string, string> = {
    defeat_5_monsters: 'defeat_monster',
    catch_2_monsters: 'catch_monster',
    win_3_battles: 'win_battle',
    use_10_moves: 'use_move',
    reach_wave_5: 'reach_wave',
  };

  const updateDailyObjective = (objectiveId: string, increment = 1) => {
    updateChallengeProgress(
      objectiveTrackIds[objectiveId] || objectiveId,
      increment,
      objectiveId === 'reach_wave_5' ? 'max' : 'add',
    );
  };

  const claimChallengeReward = (period: ChallengePeriod, objectiveId: string) => {
    const periodKey = period === 'daily'
      ? getDailyPeriodKey()
      : period === 'weekly'
        ? getWeeklyPeriodKey()
        : getMonthlyPeriodKey();
    setPersistentData(prev => {
      const objectives = period === 'daily'
        ? prev.dailyObjectives
        : period === 'weekly'
          ? prev.weeklyObjectives
          : prev.monthlyObjectives;
      const savedPeriodKey = period === 'daily'
        ? prev.dailyObjectivesDate
        : period === 'weekly'
          ? prev.weeklyObjectivesWeek
          : prev.monthlyObjectivesMonth;
      const objective = objectives.find(item => item.id === objectiveId);
      if (savedPeriodKey !== periodKey || !objective?.completed || objective.claimed) return prev;
      const updated = objectives.map(item => item.id === objectiveId ? { ...item, claimed: true } : item);
      return {
        ...prev,
        ...(period === 'daily'
          ? { dailyObjectives: updated }
          : period === 'weekly'
            ? { weeklyObjectives: updated }
            : { monthlyObjectives: updated }),
        cursedCoins: prev.cursedCoins + objective.reward,
      };
    });
  };

  const claimDailyObjectiveReward = (objectiveId: string) => {
    claimChallengeReward('daily', objectiveId);
  };

  // Controlla e sblocca achievement
  const checkAndUnlockAchievements = () => {
    setPersistentData(prev => {
      const stats = {
        totalRuns: prev.totalRuns,
        totalWins: prev.totalWins,
        bestWave: prev.bestWave,
        totalMonstersDefeated: prev.totalMonstersDefeated,
        totalMonstersCaught: prev.totalMonstersCaught,
        totalGymLeadersDefeated: prev.totalGymLeadersDefeated,
        longestWinStreak: prev.longestWinStreak,
      };
      
      const { newAchievements, updatedAchievements } = checkAchievements(prev.achievements, stats);
      
      if (newAchievements.length > 0) {
        const names = newAchievements.map(id => achievementTranslations[lang]?.[id]?.name || id).join(', ');
        const reward = updatedAchievements.filter(a => newAchievements.includes(a.id)).reduce((sum, a) => sum + a.reward, 0);
        setTimeout(() => {
          showToast(t('alert.achievement_unlocked', lang).replace('{names}', names).replace('{reward}', String(reward)));
          playSfx('levelup');
          sendPlatformMessage('player_got_achievement');
          trackEvent('achievement_unlocked', { count: newAchievements.length });
        }, 0);
        // Segna come non riscossi
        const achievementsWithClaimed = updatedAchievements.map(ach => {
          if (newAchievements.includes(ach.id)) {
            return { ...ach, claimed: false };
          }
          return ach;
        });
        
        return {
          ...prev,
          achievements: achievementsWithClaimed,
        };
      }
      
      return {
        ...prev,
        achievements: updatedAchievements,
      };
    });
  };

  // Riscuoti ricompensa achievement
  const claimAchievementReward = (achievementId: string) => {
    setPersistentData(prev => {
      const achievement = prev.achievements.find(a => a.id === achievementId);
      if (!achievement?.unlocked || achievement.claimed) return prev;
      return {
        ...prev,
        achievements: prev.achievements.map(ach => ach.id === achievementId ? { ...ach, claimed: true } : ach),
        cursedCoins: prev.cursedCoins + achievement.reward,
      };
    });
  };

  const [challengeTab, setChallengeTab] = useState<ChallengePeriod>('daily');
  // Pozione della Non-Morte e altri effetti di lotta sono gestiti dal motore
  const [amuletReviveUsed, setAmuletReviveUsed] = useState(false);
  const [selectedStarters, setSelectedStarters] = useState<Monster[]>([]);
  const [showTeamOrder, setShowTeamOrder] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Impostazioni (audio, effetti, velocità) salvate su Playgama Storage
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);

  // Lotta in corso e pubblicità
  interface ActiveBattle { key: number; state: BattleState; cfg: BattleConfig; encounter: EncounterKind; nodeType: MapNodeType; rewards: BattleRewards }
  const [activeBattle, setActiveBattle] = useState<ActiveBattle | null>(null);
  const battleKeyRef = useRef(0);
  const runCatchesRef = useRef(0);
  const [adOffer, setAdOffer] = useState<'heal' | 'revive' | 'coins' | null>(null);
  const [adLoading, setAdLoading] = useState(false);
  const [doubleAdWave, setDoubleAdWave] = useState(0);

  // Bug fix: genera le posizioni delle particelle una volta sola per evitare sfarfallio
  const [particles] = useState(() => 
    Array.from({ length: 20 }, () => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 5 + Math.random() * 10,
    }))
  );


  const startNewGame = () => {
    // Seleziona 3 starter casuali dal pool
    const shuffled = [...starters].sort(() => Math.random() - 0.5);
    const randomStarters = shuffled.slice(0, 3);
    setSelectedStarters(randomStarters);
    setGameState(prev => ({ ...prev, phase: 'starter_select' }));
  };

  const selectStarter = (index: number) => {
    if (!selectedStarters[index]) return;
    setAmuletReviveUsed(false);
    const upgrades = persistentData.upgrades;
    const starter = applyMetaBonusesToMonster(deepClone(selectedStarters[index]), upgrades);
    const bonusLevels = getUpgradeLevel(upgrades, 'candy_level_up');
    for (let level = 0; level < bonusLevels; level++) {
      starter.level++;
      starter.stats.maxHp += 3;
      starter.stats.hp += 3;
      starter.stats.attack += 2;
      starter.stats.defense += 1;
      starter.stats.speed += 1;
    }
    starter.exp = 0;
    starter.expToNext = expForLevel(starter.level);
    runCatchesRef.current = 0;
    setDoubleAdWave(0);
    const map = generateMap(1);
    // Traccia l'uso del mostro
    setPersistentData(prev => {
      const newMonsterUsage = { ...prev.monsterUsage };
      newMonsterUsage[starter.id] = (newMonsterUsage[starter.id] || 0) + 1;
      const favoriteMonster = Object.entries(newMonsterUsage)
        .sort(([,a]: [string, number], [,b]: [string, number]) => b - a)[0]?.[0] || '';
      return {
        ...prev,
        mostCatchesInRun: 0, // Reset per la nuova run
        monsterUsage: newMonsterUsage,
        favoriteMonster,
      };
    });
    setGameState(prev => ({
      ...prev,
      phase: 'map',
      team: [starter],
      map,
      currentNode: -1,
      currentWave: 1,
      items: applyUpgradesToItems(prev.persistentData.upgrades),
      candies: 50,
      cursedCoins: 0,
      medals: [],
      healsUsed: 0,
      persistentData: prev.persistentData,
    }));
  };

  const startBattle = (nodeType: MapNodeType, nodeId: number) => {
    const current = gameStateRef.current;
    const wave = current.currentWave;
    const enc = buildEncounter(nodeType, wave, nodeId);
    const newWeather = getRandomWeather();
    const active = Math.max(0, current.team.findIndex(m => m.stats.hp > 0));
    const state = createBattleState({
      team: current.team, enemies: enc.enemies, active, weather: newWeather,
      catchable: enc.catchable, kind: enc.kind, items: current.items,
    });
    const isGym = nodeType === 'gym_leader';
    const coinType = enc.encounter === 'rare' ? 'rare_wild' : enc.encounter === 'double' ? 'double_wild' : nodeType;
    let coins = calculateCursedCoinsReward(coinType, wave, false, false, isGym && current.medals.length === 0);
    if (enc.enemies.some(e => e.shiny)) coins += 25;
    if (enc.encounter === 'legendary' || enc.encounter === 'mythical') coins += 60;
    const candies = isGym ? 100 + wave * 10 : (nodeType === 'trainer' ? 30 : 20) + wave * 5;
    battleKeyRef.current++;
    setActiveBattle({
      key: battleKeyRef.current, state, cfg: buildBattleConfig(current.persistentData.upgrades),
      encounter: enc.encounter, nodeType, rewards: { candies, coins },
    });
    sendPlatformMessage('level_started', wave);
    setGameState(prev => ({ ...prev, phase: 'battle', battleLog: [] }));
  };

  const handleNodeClick = (nodeId: number) => {
    const current = gameStateRef.current;
    const node = current.map[nodeId];
    if (!node || node.completed) return;
    // Il nodo corrente non completato si può ritentare (es. dopo una resurrezione)
    const retry = nodeId === current.currentNode;
    if (!retry && current.currentNode >= 0 && !current.map[current.currentNode].connections.includes(nodeId)) return;
    if (current.currentNode < 0 && nodeId !== 0) return;
    if (current.team.every(m => m.stats.hp <= 0)) return;
    playSfx('ui_open');

    // Negozi, eventi e falò si completano entrando (non si possono ripetere)
    const instant = node.type === 'shop' || node.type === 'event' || node.type === 'rest';
    setGameState(prev => ({
      ...prev,
      currentNode: nodeId,
      map: instant ? prev.map.map(n => (n.id === nodeId ? { ...n, completed: true } : n)) : prev.map,
    }));

    if (node.type === 'shop') {
      setGameState(prev => ({ ...prev, phase: 'shop' }));
    } else if (node.type === 'event') {
      handleRandomEvent();
    } else if (node.type === 'rest') {
      setGameState(prev => ({
        ...prev,
        phase: 'event',
        battleLog: [`🔥 ${t('rest.title', lang)}`, t('rest.desc', lang)],
        team: prev.team.map(m => {
          const mon = deepClone(m);
          if (mon.stats.hp <= 0) mon.stats.hp = Math.max(1, Math.floor(mon.stats.maxHp * 0.25));
          else mon.stats.hp = Math.min(mon.stats.maxHp, mon.stats.hp + Math.ceil(mon.stats.maxHp * 0.5));
          mon.status = [];
          mon.statusTurns = {};
          mon.moves = mon.moves.map(mv => ({ ...mv, pp: Math.min(mv.maxPp, mv.pp + 5) }));
          return mon;
        }),
      }));
      playSfx('heal');
    } else {
      startBattle(node.type, nodeId);
    }
  };

  const handleRandomEvent = () => {
    const events = [
      // Eventi positivi - Ricompense
      { msg: `🎃 ${t('event.found_pumpkin', lang)}`, action: () => setGameState(prev => ({ ...prev, candies: prev.candies + 20 })) },
      { msg: `🧪 ${t('event.found_potion', lang)}`, action: () => setGameState(prev => {
        const items = deepClone(prev.items);
        const pot = items.find(i => i.id === 'pozione_sangue');
        if (pot) pot.quantity += 2;
        return { ...prev, items };
      })},
      { msg: `🍬 ${t('event.found_candies', lang)}`, action: () => setGameState(prev => {
        const items = deepClone(prev.items);
        const candy = items.find(i => i.id === 'caramella_stregata');
        if (candy) candy.quantity += 3;
        return { ...prev, items };
      })},
      { msg: `✨ ${t('event.ghost_heal', lang)}`, action: () => setGameState(prev => ({
        ...prev,
        team: prev.team.map(m => ({ ...m, stats: { ...m.stats, hp: m.stats.maxHp }, status: [], sleepTurns: undefined }))
      }))},
      { msg: `💎 ${t('event.found_crystal', lang)}`, action: () => setGameState(prev => {
        const items = deepClone(prev.items);
        const crystal = items.find(i => i.id === 'cristallo_pp');
        if (crystal) crystal.quantity += 1;
        return { ...prev, items };
      })},
      { msg: `💰 ${t('event.found_coins', lang)}`, action: () => setGameState(prev => ({ ...prev, candies: prev.candies + 35 })) },
      { msg: `⚰️ ${t('event.found_coffin', lang)}`, action: () => setGameState(prev => {
        const items = deepClone(prev.items);
        const coffin = items.find(i => i.id === 'bara_antica');
        if (coffin) coffin.quantity += 1;
        return { ...prev, items };
      })},
      { msg: `🕯️ ${t('event.found_candle', lang)}`, action: () => setGameState(prev => {
        const items = deepClone(prev.items);
        const candle = items.find(i => i.id === 'candela_protettiva');
        if (candle) candle.quantity += 2;
        return { ...prev, items };
      })},
      { msg: `🌙 ${t('event.moon_blessing', lang)}`, action: () => setGameState(prev => ({
        ...prev,
        team: prev.team.map(m => ({ ...m, stats: { ...m.stats, hp: Math.min(m.stats.maxHp, m.stats.hp + 30) } }))
      }))},
      { msg: `🎁 ${t('event.mystery_gift', lang)}`, action: () => setGameState(prev => ({ ...prev, candies: prev.candies + 50 })) },
      // Eventi negativi - Penalità
      { msg: `💀 ${t('event.shadow_attack', lang)}`, action: () => setGameState(prev => ({ ...prev, candies: Math.max(0, prev.candies - 10) })) },
      { msg: `🌑 ${t('event.dark_curse', lang)}`, action: () => setGameState(prev => ({
        ...prev,
        team: prev.team.map(m => ({ 
          ...m, 
          status: m.status.includes('maledetto') ? m.status : [...m.status, 'maledetto'] as StatusEffect[] 
        }))
      }))},
      { msg: `☠️ ${t('event.poison_trap', lang)}`, action: () => setGameState(prev => ({
        ...prev,
        team: prev.team.map(m => ({ ...m, stats: { ...m.stats, hp: Math.max(1, m.stats.hp - 15) } }))
      }))},
      { msg: `👻 ${t('event.ghost_robber', lang)}`, action: () => setGameState(prev => ({ ...prev, candies: Math.max(0, prev.candies - 20) })) },
      { msg: `🕸️ ${t('event.spider_web', lang)}`, action: () => setGameState(prev => ({
        ...prev,
        team: prev.team.map(m => ({ 
          ...m, 
          status: m.status.includes('paralizzato') ? m.status : [...m.status, 'paralizzato'] as StatusEffect[] 
        }))
      }))},
      // Eventi misti - Effetti vari
      { msg: `🔮 ${t('event.mysterious_orb', lang)}`, action: () => setGameState(prev => {
        const items = deepClone(prev.items);
        const elixir = items.find(i => i.id === 'elisir_spettrale');
        if (elixir) elixir.quantity += 1;
        return { ...prev, items, candies: Math.max(0, prev.candies - 10) };
      })},
      { msg: `⚡ ${t('event.energy_surge', lang)}`, action: () => setGameState(prev => ({
        ...prev,
        team: prev.team.map(m => ({ ...m, moves: m.moves.map(mv => ({ ...mv, pp: Math.min(mv.maxPp, mv.pp + 5) })) }))
      }))},
      { msg: `🌟 ${t('event.lucky_star', lang)}`, action: () => setGameState(prev => ({
        ...prev,
        candies: prev.candies + 25,
        team: prev.team.map(m => ({ ...m, stats: { ...m.stats, hp: Math.min(m.stats.maxHp, m.stats.hp + 20) } }))
      }))},
      { msg: `🎭 ${t('event.trick_treat', lang)}`, action: () => setGameState(prev => {
        if (Math.random() > 0.5) {
          return { ...prev, candies: prev.candies + 30 };
        } else {
          return { ...prev, candies: Math.max(0, prev.candies - 15) };
        }
      })},
      { msg: `🦇 ${t('event.bat_swarm', lang)}`, action: () => setGameState(prev => ({
        ...prev,
        team: prev.team.map(m => ({ ...m, stats: { ...m.stats, hp: Math.max(1, m.stats.hp - 10) } }))
      }))},
      { msg: `🕷️ ${t('event.spider_nest', lang)}`, action: () => setGameState(prev => {
        const items = deepClone(prev.items);
        const web = items.find(i => i.id === 'rete_becchino');
        if (web) web.quantity += 1;
        return { ...prev, items };
      })},
      { msg: `💀 ${t('event.ancient_tomb', lang)}`, action: () => setGameState(prev => ({ ...prev, candies: prev.candies + 40 })) },
    ];
    const event = events[Math.floor(Math.random() * events.length)];
    event.action();
    setGameState(prev => ({ ...prev, phase: 'event', battleLog: [event.msg] }));
  };

  // ============================================================
  // BATTAGLIA: collegamento tra il motore (src/battle) e lo stato della run
  // ============================================================
  const buildBattleConfig = (upgrades: MetaUpgrade[]): BattleConfig => {
    const shareRate = hasUpgrade(upgrades, 'exp_share_perfect')
      ? 1
      : hasUpgrade(upgrades, 'exp_share_total')
        ? 0.5
        : hasUpgrade(upgrades, 'exp_share_base')
          ? 0.25
          : 0;
    return {
      lang,
      lifestealBonus: hasUpgrade(upgrades, 'held_item_fang') ? 0.1 : 0,
      captureBonus: getUpgradeLevel(upgrades, 'monster_charmer'),
      expMult: 1 + getUpgradeLevel(upgrades, 'fast_growth') * 0.01,
      benchShare: Math.min(1, shareRate + getUpgradeLevel(upgrades, 'bench_training') * 0.02),
      autoNet: hasUpgrade(upgrades, 'gravedigger_net'),
    };
  };

  // Statistiche e sfide aggiornate a ogni turno
  const onBattleTurn = (stats: TurnStats) => {
    if (stats.movesUsed) updateChallengeProgress('use_move', stats.movesUsed);
    if (stats.defeated) updateChallengeProgress('defeat_monster', stats.defeated);
    if (stats.caught.length) updateChallengeProgress('catch_monster', stats.caught.length);
    if (stats.crits) updateChallengeProgress('land_crit', stats.crits);
    if (stats.superEffective) updateChallengeProgress('super_effective', stats.superEffective);
    if (stats.statusInflicted) updateChallengeProgress('inflict_status', stats.statusInflicted);
    if (stats.itemsUsed) updateChallengeProgress('use_item', stats.itemsUsed);
    if (stats.evolutions) updateChallengeProgress('evolve', stats.evolutions);
    runCatchesRef.current += stats.caught.length;
    const caughtIds = stats.caught;
    setPersistentData(prev => {
      const monsterUsage = { ...prev.monsterUsage };
      caughtIds.forEach(id => { monsterUsage[id] = (monsterUsage[id] || 0) + 1; });
      const favoriteMonster = caughtIds.length
        ? Object.entries(monsterUsage).sort(([, a], [, b]) => b - a)[0]?.[0] || prev.favoriteMonster
        : prev.favoriteMonster;
      return {
        ...prev,
        totalMonstersDefeated: prev.totalMonstersDefeated + stats.defeated,
        totalMonstersCaught: prev.totalMonstersCaught + caughtIds.length,
        mostCatchesInRun: Math.max(prev.mostCatchesInRun || 0, runCatchesRef.current),
        totalDamageDealt: prev.totalDamageDealt + stats.damageDealt,
        totalDamageTaken: prev.totalDamageTaken + stats.damageTaken,
        totalHealing: prev.totalHealing + stats.healing,
        monsterUsage,
        favoriteMonster,
      };
    });
    if (stats.caught.length || stats.defeated) setTimeout(() => checkAndUnlockAchievements(), 300);
  };

  const onBattleFinish = (result: BattleFinish) => {
    const battle = activeBattle;
    if (!battle) return;
    const current = gameStateRef.current;
    const wave = current.currentWave;
    // I mostri catturati ricevono subito i bonus degli strumenti del Meta Negozio
    const upgrades = current.persistentData.upgrades;
    const team = result.state.team.map(m => cleanupAfterBattle(applyMetaBonusesToMonster(m, upgrades)));
    const items = result.state.items;
    setActiveBattle(null);

    if (result.outcome === 'victory') {
      const isGym = battle.nodeType === 'gym_leader';
      const flawless = team.every(m => m.stats.hp > 0);
      // Pausa dopo la vittoria: +10% PS ai mostri in piedi
      team.forEach(m => {
        if (m.stats.hp > 0) m.stats.hp = Math.min(m.stats.maxHp, m.stats.hp + Math.ceil(m.stats.maxHp * 0.1));
      });
      const candies = battle.rewards.candies * (result.doubled ? 2 : 1);
      const coins = battle.rewards.coins + (flawless && battle.nodeType === 'trainer' ? 5 : 0);
      if (coins > 0) addCursedCoins(coins);
      const map = deepClone(current.map);
      if (map[current.currentNode]) map[current.currentNode].completed = true;
      const medals = isGym ? [...current.medals, `medal_${current.medals.length + 1}`] : current.medals;
      updateChallengeProgress('win_battle');
      if (isGym) updateChallengeProgress('defeat_gym');
      if (battle.nodeType === 'trainer') updateChallengeProgress('defeat_trainer');
      if (flawless) updateChallengeProgress('flawless_win');
      setPersistentData(prev => {
        const streak = (prev.currentWinStreak || 0) + 1;
        return {
          ...prev,
          bestWave: Math.max(prev.bestWave, wave),
          bestRunWave: Math.max(prev.bestRunWave || 0, wave),
          totalWins: prev.totalWins + 1,
          totalBattles: prev.totalBattles + 1,
          currentWinStreak: streak,
          longestWinStreak: Math.max(prev.longestWinStreak || 0, streak),
          totalGymLeadersDefeated: prev.totalGymLeadersDefeated + (isGym ? 1 : 0),
        };
      });
      setTimeout(() => checkAndUnlockAchievements(), 400);
      trackEvent('battle_won', { wave, node: battle.nodeType, encounter: battle.encounter, doubled: result.doubled });
      if (isGym) sendPlatformMessage('level_completed', wave);
      returnToMap({ ...current, team, items, map, medals, candies: current.candies + candies, battleWon: true });
      return;
    }

    if (result.outcome === 'escaped') {
      const map = deepClone(current.map);
      if (map[current.currentNode]) map[current.currentNode].completed = true;
      trackEvent('battle_escaped', { wave });
      returnToMap({ ...current, team, items, map, battleWon: false });
      return;
    }

    // Sconfitta
    setPersistentData(prev => ({
      ...prev,
      totalLosses: prev.totalLosses + 1,
      totalBattles: prev.totalBattles + 1,
      currentWinStreak: 0,
      bestWave: Math.max(prev.bestWave, wave),
      bestRunWave: Math.max(prev.bestRunWave || 0, wave),
    }));
    trackEvent('battle_lost', { wave, node: battle.nodeType });
    setGameState(prev => ({ ...prev, team, items, battleWon: false, phase: 'game_over' }));
  };

  // Fine definitiva della run (quando il giocatore lascia la schermata di game over)
  const endRun = () => {
    const current = gameStateRef.current;
    const wave = current.currentWave;
    setPersistentData(prev => ({
      ...prev,
      totalRuns: prev.totalRuns + 1,
      bestWave: Math.max(prev.bestWave, wave),
      bestRunWave: Math.max(prev.bestRunWave || 0, wave),
      mostCatchesInRun: Math.max(prev.mostCatchesInRun || 0, runCatchesRef.current),
    }));
    setTimeout(() => checkAndUnlockAchievements(), 300);
    setLeaderboardScore('best_wave', Math.max(wave, persistentData.bestWave));
    sendPlatformMessage('level_failed', wave);
    trackEvent('run_ended', { wave, medals: current.medals.length, team: current.team.length });
    runCatchesRef.current = 0;
  };

  const moveMonsterUp = (idx: number) => {
    if (idx === 0) return;
    setGameState(prev => {
      const newTeam = [...prev.team];
      const temp = newTeam[idx];
      newTeam[idx] = newTeam[idx - 1];
      newTeam[idx - 1] = temp;
      // Update selectedMonsterIndex if needed
      let newIndex = prev.selectedMonsterIndex;
      if (prev.selectedMonsterIndex === idx) newIndex = idx - 1;
      else if (prev.selectedMonsterIndex === idx - 1) newIndex = idx;
      return { ...prev, team: newTeam, selectedMonsterIndex: newIndex };
    });
  };

  const moveMonsterDown = (idx: number) => {
    if (idx === gameState.team.length - 1) return;
    setGameState(prev => {
      const newTeam = [...prev.team];
      const temp = newTeam[idx];
      newTeam[idx] = newTeam[idx + 1];
      newTeam[idx + 1] = temp;
      // Update selectedMonsterIndex if needed
      let newIndex = prev.selectedMonsterIndex;
      if (prev.selectedMonsterIndex === idx) newIndex = idx + 1;
      else if (prev.selectedMonsterIndex === idx + 1) newIndex = idx;
      return { ...prev, team: newTeam, selectedMonsterIndex: newIndex };
    });
  };

  const returnToMap = (base?: GameState) => {
    const current = base || gameStateRef.current;
    const upgrades = current.persistentData.upgrades;
    const needNewMap = !current.map || current.map.length === 0 || current.currentNode >= current.map.length - 1;
    const nextWave = needNewMap ? current.currentWave + 1 : current.currentWave;
    const completedGym = needNewMap && current.battleWon && current.map[current.currentNode]?.type === 'gym_leader';
    const gymHealUnlocked = hasUpgrade(upgrades, 'checkpoint_heal');
    const waveRegenLevel = getUpgradeLevel(upgrades, 'night_regen');
    const infiniteElixirReady = hasUpgrade(upgrades, 'infinite_elixir') && needNewMap && current.currentWave % 5 === 0;

    if (needNewMap) {
      updateChallengeProgress('reach_wave', nextWave, 'max');
      trackEvent('wave_completed', { wave: current.currentWave });
      // Interstitial a una pausa naturale: fine dell'ondata (cambio mappa)
      const now = Date.now();
      if (now - lastInterstitialRef.current >= 60000) {
        lastInterstitialRef.current = now;
        showInterstitialAd('level_completed');
      }
    }

    const team = current.team.map(monster => {
      const updated = deepClone(monster);
      if (completedGym && gymHealUnlocked) {
        updated.stats.hp = updated.stats.maxHp;
        updated.status = [];
        updated.statusTurns = {};
        updated.moves = updated.moves.map(move => ({ ...move, pp: move.maxPp }));
      } else if (needNewMap && waveRegenLevel > 0 && updated.stats.hp > 0) {
        const regen = Math.max(1, Math.floor(updated.stats.maxHp * waveRegenLevel * 0.01));
        updated.stats.hp = Math.min(updated.stats.maxHp, updated.stats.hp + regen);
      }
      return updated;
    });
    const items = deepClone(current.items);
    if (infiniteElixirReady) {
      // Elisir Infinito: ogni 5 ondate una Iper Pozione gratuita
      const iper = items.find(i => i.id === 'iper_pozione');
      if (iper) iper.quantity += 1;
      showToast(`♾️ ${tItem('iper_pozione', lang)} +1`);
    }

    setGameState({
      ...current,
      team,
      items,
      phase: 'map',
      currentWave: nextWave,
      map: needNewMap ? generateMap(nextWave) : current.map,
      currentNode: needNewMap ? -1 : current.currentNode,
      battleWon: false,
    });
  };

  const buyItem = (itemId: string, cost: number) => {
    setGameState(prev => {
      if (prev.candies < cost) return prev;
      const items = deepClone(prev.items);
      const item = items.find(i => i.id === itemId);
      if (!item) return prev; // Item non trovato, non fare nulla
      if (item.category === 'potion' && item.quantity >= getItemStackCapacity(itemId, persistentData.upgrades)) return prev;
      item.quantity++;
      return { ...prev, items, candies: prev.candies - cost };
    });
  };

  const healTeam = () => {
    if (gameStateRef.current.healsUsed >= 2) {
      showToast(t('map.no_more_heals', lang));
      return;
    }
    setAdOffer('heal');
  };

  // Placement Playgama per tipo di ricompensa (vedi playgama-bridge-config.json)
  const AD_PLACEMENTS: Record<string, string> = {
    heal: 'heal_team',
    revive: 'revive_monster',
    coins: 'cursed_coins',
    double: 'double_reward',
  };

  /**
   * Una sola pubblicità premiata per ricompensa. La ricompensa viene data
   * SOLO se Playgama conferma lo stato `rewarded`; se l'annuncio non parte o
   * viene chiuso, il gioco resta giocabile e non si regala nulla.
   */
  const runRewardedAd = async (kind: keyof typeof AD_PLACEMENTS): Promise<boolean> => {
    if (adLoading) return false;
    setAdLoading(true);
    setPlatformPaused(true);
    let result: RewardedAdResult = 'failed';
    try {
      result = await showRewardedAd(AD_PLACEMENTS[kind]);
    } finally {
      setPlatformPaused(getIsPaused());
      setAdLoading(false);
    }
    trackEvent('rewarded_ad', { placement: AD_PLACEMENTS[kind], result });
    if (result === 'rewarded') return true;
    if (result === 'closed') showToast(t('ad.closed_early', lang));
    else showToast(t('ad.not_available', lang));
    return false;
  };

  const watchAdForCoins = () => {
    if (getAdCoinsLeft(persistentData) <= 0) return;
    setAdOffer('coins');
  };

  const acceptAdOffer = async () => {
    const offer = adOffer;
    if (!offer) return;
    const ok = await runRewardedAd(offer);
    if (!ok) return;
    setAdOffer(null);
    playSfx('coin');
    if (offer === 'coins') {
      const today = new Date().toDateString();
      setPersistentData(prev => ({
        ...prev,
        cursedCoins: prev.cursedCoins + AD_COINS_REWARD,
        adCoinsDate: today,
        adCoinsWatched: (prev.adCoinsDate === today ? prev.adCoinsWatched : 0) + 1,
      }));
      showToast(`🪙 +${AD_COINS_REWARD} ${t('title.cursed_coins', lang)}`);
    } else if (offer === 'heal') {
      setGameState(prev => ({
        ...prev,
        healsUsed: prev.healsUsed + 1,
        team: prev.team.map(m => ({
          ...m,
          stats: { ...m.stats, hp: m.stats.hp > 0 ? m.stats.maxHp : m.stats.hp },
          status: [],
          statusTurns: {},
          sleepTurns: undefined,
          moves: m.moves.map(mv => ({ ...mv, pp: mv.maxPp })),
        })),
      }));
      playSfx('heal');
    } else if (offer === 'revive') {
      reviveStrongest('ad');
    }
  };

  // Resuscita il mostro esausto di livello più alto e torna alla mappa
  const reviveStrongest = (source: 'ad' | 'amulet') => {
    setGameState(prev => {
      const team = deepClone(prev.team);
      const idx = team
        .map((m, i) => ({ m, i }))
        .filter(x => x.m.stats.hp <= 0)
        .sort((a, b) => b.m.level - a.m.level)[0]?.i;
      if (idx === undefined) return prev;
      team[idx].stats.hp = Math.max(1, Math.floor(team[idx].stats.maxHp * 0.5));
      team[idx].status = [];
      team[idx].statusTurns = {};
      showToast(`✨ ${tMonster(team[idx].id, lang)} ${t('battle.revived', lang)} ${team[idx].stats.hp} ${t('battle.hp', lang)}`);
      return {
        ...prev,
        team,
        phase: 'map',
        revivesUsed: source === 'ad' ? (prev.revivesUsed || 0) + 1 : prev.revivesUsed || 0,
      };
    });
    if (source === 'amulet') setAmuletReviveUsed(true);
    playSfx('heal');
  };

  const renderAdModal = () => {
    if (!adOffer) return null;
    const title = adOffer === 'heal' ? `💚 ${t('ad.heal_team', lang)}` : adOffer === 'coins' ? `🪙 ${t('ad.earn_coins', lang)}` : `✨ ${t('ad.revive_monster', lang)}`;
    const text = adOffer === 'heal' ? t('ad.offer_heal', lang) : adOffer === 'coins' ? t('ad.to_coins', lang) : t('ad.offer_revive', lang);
    return (
      <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4" style={{ paddingTop: "max(1rem, var(--safe-t))", paddingBottom: "max(1rem, var(--safe-b))" }} role="dialog" aria-modal="true">
        <div className="relative bg-gradient-to-b from-purple-900 to-[#12061f] rounded-2xl p-6 max-w-md w-full border-2 border-orange-400/70 shadow-2xl shadow-orange-500/30 text-center">
          <button
            onClick={() => { if (adLoading) cancelRewardedAd(); setAdOffer(null); }}
            aria-label={t('ad.cancel', lang)}
            className="absolute top-2 right-2 w-10 h-10 rounded-full bg-black/40 text-white text-lg hover:bg-black/60"
          >✕</button>
          <h3 className="text-2xl font-black text-orange-300 mb-3">{title}</h3>
          <p className="text-purple-100 mb-2">{text}</p>
          {adOffer === 'coins' && <p className="text-yellow-300 text-3xl font-black mb-2">🪙 +{AD_COINS_REWARD}</p>}
          <p className="text-xs text-purple-300/80 mb-5">📺 {t('ad.one_ad', lang)}</p>
          <button
            onClick={acceptAdOffer}
            disabled={adLoading}
            className="w-full px-6 py-4 bg-gradient-to-b from-green-500 to-green-700 text-white text-xl font-black rounded-xl border-2 border-green-300 shadow-lg shadow-green-500/30 active:translate-y-0.5 disabled:opacity-60"
          >
            {adLoading ? `⏳ ${t('ad.loading', lang)}` : `▶️ ${t('ad.watch', lang)}`}
          </button>
          <button
            onClick={() => { if (adLoading) cancelRewardedAd(); setAdOffer(null); }}
            className="w-full mt-3 px-6 py-2 bg-gray-700 text-white rounded-xl hover:bg-gray-600 disabled:opacity-50"
          >
            {t('ad.cancel', lang)}
          </button>
        </div>
      </div>
    );
  };

  const renderTitle = () => (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950 via-black to-orange-950">
        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden">
          {particles.map((particle, i) => (
            <div
              key={i}
              className="absolute animate-float-particle"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`,
              }}
            >
              <div className="w-1 h-1 bg-orange-400/30 rounded-full" />
            </div>
          ))}
        </div>
        
        {/* Glowing orbs */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-orange-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-green-600/10 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl">
        {/* Title Section */}
        <div className="text-center mb-8 animate-fade-in-down">
          {/* Floating Halloween Icons */}
          <div className="relative mb-4">
            <div className="absolute -top-8 -left-12 text-4xl animate-float-slow">👻</div>
            <div className="absolute -top-6 -right-12 text-4xl animate-float-slow" style={{ animationDelay: '1s' }}>🦇</div>
            <div className="absolute -bottom-4 -left-8 text-3xl animate-float-slow" style={{ animationDelay: '2s' }}>🕷️</div>
            <div className="absolute -bottom-6 -right-8 text-3xl animate-float-slow" style={{ animationDelay: '3s' }}>💀</div>

            {/* Hero: artwork originali dei mostri */}
            <div className="flex items-end justify-center gap-1 md:gap-4">
              <img
                src={getMonsterIconPath('gattojella') || ''}
                alt=""
                draggable={false}
                className="w-16 h-16 md:w-24 md:h-24 object-contain animate-float-slow drop-shadow-[0_0_20px_rgba(147,112,219,0.6)]"
                style={{ animationDelay: '1s' }}
              />
              <img
                src={getMonsterIconPath('sovranozucca') || ''}
                alt=""
                draggable={false}
                className="w-36 h-36 md:w-52 md:h-52 object-contain animate-bounce-slow drop-shadow-[0_0_45px_rgba(255,140,0,0.65)]"
              />
              <img
                src={getMonsterIconPath('criofante') || ''}
                alt=""
                draggable={false}
                className="w-16 h-16 md:w-24 md:h-24 object-contain animate-float-slow drop-shadow-[0_0_20px_rgba(135,206,235,0.6)]"
                style={{ animationDelay: '2s' }}
              />
            </div>
          </div>
          
          {/* Title with enhanced glow */}
          <h1 
            className="text-5xl md:text-8xl font-black mb-3 animate-title-glow"
            style={{ 
              textShadow: '0 0 30px #ff8c00, 0 0 60px #ff4500, 0 0 90px #ff6347',
              background: 'linear-gradient(135deg, #ff8c00, #ff4500, #ff6347)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {t('title.halloween', lang)}
          </h1>
          <h2 
            className="text-3xl md:text-6xl font-bold mb-6 animate-title-glow"
            style={{ 
              textShadow: '0 0 20px #9370db, 0 0 40px #8a2be2',
              animationDelay: '0.5s',
            }}
          >
            <span className="text-purple-300">{t('title.monsters', lang)}</span>
          </h2>
          <p className="text-green-400 text-lg md:text-xl mb-8 italic animate-fade-in" style={{ animationDelay: '1s' }}>
            {t('title.subtitle', lang)}
          </p>
        </div>

        {/* Start Button - Enhanced */}
        <button
          onClick={startNewGame}
          className="group relative w-72 md:w-80 px-8 py-5 mb-6 text-2xl md:text-3xl font-black text-white rounded-2xl shadow-2xl transition-all duration-300 hover:scale-110 animate-fade-in-up overflow-hidden"
          style={{ animationDelay: '1.2s' }}
        >
          {/* Button background with gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-red-600 to-orange-700 group-hover:from-orange-500 group-hover:via-red-500 group-hover:to-orange-600 transition-all duration-300" />
          
          {/* Animated border glow */}
          <div className="absolute inset-0 rounded-2xl border-4 border-orange-400 group-hover:border-orange-300 transition-all duration-300" style={{ boxShadow: '0 0 30px rgba(255, 140, 0, 0.6), inset 0 0 20px rgba(255, 140, 0, 0.3)' }} />
          
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          
          <span className="relative z-10 flex items-center justify-center gap-3">
            <PlayIcon size={34} />
            <span>{t('title.start', lang)}</span>
          </span>
        </button>
        
        {/* Menu Buttons Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 w-full max-w-4xl mb-6 animate-fade-in-up" style={{ animationDelay: '1.4s' }}>
          {([
            {
              key: 'meta_shop',
              gradient: 'from-purple-600 to-purple-900 group-hover:from-purple-500 group-hover:to-purple-800',
              border: 'border-purple-400 group-hover:border-purple-300',
              glow: 'rgba(147, 112, 219, 0.5)',
              icon: <ShopIcon size={30} />,
              label: t('title.meta_shop', lang),
              badge: 0,
              onClick: () => setGameState(prev => ({ ...prev, phase: 'meta_shop' })),
            },
            {
              key: 'daily_objectives',
              gradient: 'from-blue-600 to-blue-900 group-hover:from-blue-500 group-hover:to-blue-800',
              border: 'border-blue-400 group-hover:border-blue-300',
              glow: 'rgba(59, 130, 246, 0.5)',
              icon: <TargetIcon size={30} />,
              label: t('title.daily_objectives', lang),
              badge: [
                ...persistentData.dailyObjectives,
                ...persistentData.weeklyObjectives,
                ...persistentData.monthlyObjectives,
              ].filter(obj => obj.completed && !obj.claimed).length,
              onClick: () => {
                setChallengeTab('daily');
                setGameState(prev => ({ ...prev, phase: 'daily_objectives' }));
              },
            },
            {
              key: 'achievements',
              gradient: 'from-yellow-600 to-yellow-900 group-hover:from-yellow-500 group-hover:to-yellow-800',
              border: 'border-yellow-400 group-hover:border-yellow-300',
              glow: 'rgba(234, 179, 8, 0.5)',
              icon: <TrophyIcon size={30} />,
              label: t('title.achievements', lang),
              badge: persistentData.achievements.filter(ach => ach.unlocked && !ach.claimed).length,
              onClick: () => setGameState(prev => ({ ...prev, phase: 'achievements' })),
            },
            {
              key: 'statistics',
              gradient: 'from-cyan-600 to-cyan-900 group-hover:from-cyan-500 group-hover:to-cyan-800',
              border: 'border-cyan-400 group-hover:border-cyan-300',
              glow: 'rgba(6, 182, 212, 0.5)',
              icon: <ChartIcon size={30} />,
              label: t('title.statistics', lang),
              badge: 0,
              onClick: () => setGameState(prev => ({ ...prev, phase: 'statistics' })),
            },
            {
              key: 'settings',
              gradient: 'from-gray-600 to-gray-900 group-hover:from-gray-500 group-hover:to-gray-800',
              border: 'border-gray-400 group-hover:border-gray-300',
              glow: 'rgba(156, 163, 175, 0.5)',
              icon: <GearIcon size={30} />,
              label: t('title.settings', lang),
              badge: 0,
              onClick: () => setGameState(prev => ({ ...prev, phase: 'settings' })),
            },
          ]).map((btn) => (
            <button
              key={btn.key}
              onClick={btn.onClick}
              className="group relative px-3 py-3 min-h-[64px] text-base md:text-lg font-bold text-white rounded-xl shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 overflow-hidden touch-manipulation"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${btn.gradient} transition-all`} />
              <div className={`absolute inset-0 rounded-xl border-2 ${btn.border} transition-all`} style={{ boxShadow: `0 0 20px ${btn.glow}` }} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative z-10 flex flex-col items-center justify-center gap-1.5">
                <span className="flex items-center justify-center w-11 h-11 rounded-full bg-black/30 border border-white/20 shadow-inner">
                  {btn.icon}
                </span>
                <span className="text-xs md:text-sm leading-tight">{btn.label}</span>
              </span>
              {btn.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] px-1 flex items-center justify-center animate-pulse border-2 border-red-300 z-20">
                  {btn.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        
        {/* Stats Card - Enhanced */}
        <div className="relative w-full max-w-md mb-6 animate-fade-in-up" style={{ animationDelay: '1.6s' }}>
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/30 via-orange-600/30 to-purple-600/30 rounded-2xl blur-xl animate-pulse-slow" />
          <div className="relative bg-black/60 backdrop-blur-sm rounded-2xl px-6 py-4 border-2 border-purple-500/50 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CoinIcon size={30} />
                <span className="text-yellow-400 font-black text-2xl">{persistentData.cursedCoins}</span>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-xs">{t('title.cursed_coins', lang)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-purple-900/40 rounded-lg px-3 py-2 border border-purple-600/50">
                <p className="text-gray-400 text-xs">{t('title.total_runs', lang)}</p>
                <p className="text-white font-bold text-lg">{persistentData.totalRuns}</p>
              </div>
              <div className="bg-orange-900/40 rounded-lg px-3 py-2 border border-orange-600/50">
                <p className="text-gray-400 text-xs">{t('title.best_wave', lang)}</p>
                <p className="text-white font-bold text-lg">{persistentData.bestWave}</p>
              </div>
            </div>
            {persistentData.loginStreak > 0 && (
              <div className="mt-2 text-center">
                <p className="text-orange-400 text-sm font-bold">🔥 {t('title.login_streak', lang)}: {persistentData.loginStreak}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pulsante Monete Gratis (pubblicita' premiata) */}
        {(() => {
          const adCoinsLeft = getAdCoinsLeft(persistentData);
          return (
            <button
              onClick={watchAdForCoins}
              disabled={adCoinsLeft <= 0}
              className="group relative w-full max-w-md mb-6 px-6 py-4 rounded-2xl font-black text-white shadow-2xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden animate-fade-in-up"
              style={{ animationDelay: '1.7s' }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 group-hover:from-yellow-500 group-hover:via-amber-400 group-hover:to-yellow-500 transition-all duration-300" />
              <div className="absolute inset-0 rounded-2xl border-2 border-yellow-300 group-hover:border-yellow-200 transition-all" style={{ boxShadow: '0 0 25px rgba(234, 179, 8, 0.5)' }} />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="relative z-10 flex items-center justify-center gap-3">
                <FilmIcon size={32} />
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-base md:text-lg flex items-center gap-1.5">{t('title.free_coins', lang)} · <CoinIcon size={20} /> +{AD_COINS_REWARD}</span>
                  <span className="text-xs font-bold text-yellow-100/90">
                    {adCoinsLeft > 0 ? `${adCoinsLeft}/${AD_COINS_DAILY_LIMIT} ${t('ad.coins_left', lang)}` : t('ad.coins_limit', lang)}
                  </span>
                </span>
              </span>
            </button>
          );
        })()}
        
        {/* Description and Warning */}
        <div className="text-center max-w-lg mb-6 animate-fade-in" style={{ animationDelay: '1.8s' }}>
          <p className="text-purple-300 text-sm md:text-base mb-2">{t('title.description', lang)}</p>
          <p className="text-red-400 text-xs md:text-sm italic">{t('title.warning', lang)}</p>
        </div>
        
        {/* Halloween Icons Row */}
        <div className="flex gap-4 md:gap-6 text-3xl md:text-4xl animate-fade-in" style={{ animationDelay: '2s' }}>
          <span className="animate-float-slow">💀</span>
          <span className="animate-float-slow" style={{ animationDelay: '0.5s' }}>🧛</span>
          <span className="animate-float-slow" style={{ animationDelay: '1s' }}>👻</span>
          <span className="animate-float-slow" style={{ animationDelay: '1.5s' }}>🕷️</span>
          <span className="animate-float-slow" style={{ animationDelay: '2s' }}>🦇</span>
          <span className="animate-float-slow" style={{ animationDelay: '2.5s' }}>⚰️</span>
        </div>
      </div>
    </div>
  );

  const renderStarterSelect = () => {
    // Barre statistiche normalizzate rispetto al migliore dei 3 starter mostrati
    const maxStat = {
      hp: Math.max(...selectedStarters.map(m => m.stats.maxHp), 1),
      atk: Math.max(...selectedStarters.map(m => m.stats.attack), 1),
      def: Math.max(...selectedStarters.map(m => m.stats.defense), 1),
      spd: Math.max(...selectedStarters.map(m => m.stats.speed), 1),
    };
    const statBars = (m: Monster) => ([
      { label: t('starter.hp', lang), value: m.stats.maxHp, max: maxStat.hp, color: '#4ade80' },
      { label: t('starter.atk', lang), value: m.stats.attack, max: maxStat.atk, color: '#f87171' },
      { label: t('starter.def', lang), value: m.stats.defense, max: maxStat.def, color: '#60a5fa' },
      { label: t('starter.spd', lang), value: m.stats.speed, max: maxStat.spd, color: '#facc15' },
    ]);
    // Bonus run attivi dai potenziamenti del Meta Negozio
    const activeBonuses = persistentData.upgrades.filter(u => u.purchased || (u.currentLevel || 0) > 0);

    return (
      <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden bg-gradient-to-b from-purple-950 via-gray-900 to-black p-4">
        {/* Particelle fluttuanti */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((particle, i) => (
            <div
              key={i}
              className="absolute animate-float-particle"
              style={{ left: `${particle.left}%`, top: `${particle.top}%`, animationDelay: `${particle.delay}s`, animationDuration: `${particle.duration}s` }}
            >
              <div className="w-1 h-1 bg-purple-400/30 rounded-full" />
            </div>
          ))}
        </div>
        <div className="absolute top-10 left-10 w-32 h-32 bg-purple-600/15 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-orange-600/15 rounded-full blur-3xl animate-pulse-slow pointer-events-none" style={{ animationDelay: '2s' }} />

        <div className="relative z-10 flex flex-col items-center w-full max-w-5xl">
          <h2 className="text-2xl md:text-4xl font-black text-orange-400 mb-2 text-center px-4 animate-fade-in-down" style={{ textShadow: '0 0 20px rgba(255,140,0,0.5)' }}>
            {t('starter.title', lang)}
          </h2>
          <p className="text-purple-300 mb-4 md:mb-6 text-center px-4 text-sm md:text-base animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {t('starter.description', lang)}
          </p>

          {activeBonuses.length > 0 && (
            <div className="mb-4 md:mb-6 px-4 py-2 bg-purple-900/40 border border-purple-600/60 rounded-full text-xs md:text-sm text-purple-200 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              ✨ {activeBonuses.length} {t('starter.run_bonuses', lang)}: {activeBonuses.map(u => u.emoji).join(' ')}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 w-full px-2">
            {selectedStarters.map((monster, idx) => (
              <button
                key={monster.id}
                onClick={() => selectStarter(idx)}
                className="p-4 md:p-6 rounded-2xl border-2 transition-all duration-300 hover:scale-105 group animate-fade-in-up"
                style={{
                  borderColor: typeColors[monster.type],
                  background: `linear-gradient(160deg, ${typeColors[monster.type]}33, #1a0a2e 70%)`,
                  boxShadow: `0 0 25px ${typeColors[monster.type]}55`,
                  animationDelay: `${0.35 + idx * 0.15}s`,
                }}
              >
                <div className="mb-2 flex justify-center transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1">
                  <MonsterIcon monsterId={monster.id} emoji={monster.emoji} size="xl" />
                </div>
                <h3 className="text-lg md:text-xl font-black text-white mb-2">{tMonster(monster.id, lang)}</h3>
                <div className="mb-3 flex justify-center"><TypeBadge type={monster.type} label={tType(monster.type, lang)} /></div>
                <div className="space-y-1.5 mt-2">
                  {statBars(monster).map(s => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-left font-bold" style={{ color: s.color }}>{s.label}</span>
                      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(12, (s.value / s.max) * 100)}%`, background: s.color }} />
                      </div>
                      <span className="w-7 text-right text-gray-300 font-bold">{s.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs text-yellow-300 bg-yellow-900/20 rounded-lg p-2 border border-yellow-700/40">
                  <p className="font-bold">✨ {tAbilityName(monster.ability, lang)}</p>
                  <p className="text-gray-400">{tAbilityDesc(monster.ability, lang)}</p>
                </div>
                <div className="mt-2 text-xs text-purple-300">
                  {monster.moves?.map(m => (
                    <p key={m.id} className="flex items-center justify-between gap-2 py-0.5">
                      <span>• {tMove(m.id, lang)}</span>
                      <TypeBadge type={m.type} label={tType(m.type, lang)} small />
                    </p>
                  )) || []}
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={startNewGame}
            className="mt-5 md:mt-7 px-6 py-3 bg-purple-800/70 hover:bg-purple-700 text-purple-100 font-bold rounded-xl border-2 border-purple-500 transition-all hover:scale-105 animate-fade-in-up"
            style={{ animationDelay: '0.8s' }}
          >
            {t('starter.reroll', lang)}
          </button>
        </div>
      </div>
    );
  };

  const renderMap = () => {
    const completedCount = gameState.map.filter(n => n.completed).length;
    const totalNodes = gameState.map.length || 10;

    // Stile dei tipi di nodo: colore, gradiente e icona
    const nodeStyle: Record<MapNodeType, { emoji: string; ring: string; bg: string; text: string; glow: string }> = {
      wild:       { emoji: '👻', ring: 'border-violet-400',  bg: 'from-violet-600 to-purple-900',  text: 'text-violet-300', glow: 'rgba(167,139,250,0.55)' },
      trainer:    { emoji: '🧙', ring: 'border-sky-400',     bg: 'from-sky-600 to-blue-900',       text: 'text-sky-300',    glow: 'rgba(56,189,248,0.55)' },
      shop:       { emoji: '🏪', ring: 'border-emerald-400', bg: 'from-emerald-600 to-green-900',  text: 'text-emerald-300',glow: 'rgba(52,211,153,0.55)' },
      event:      { emoji: '❓', ring: 'border-fuchsia-400', bg: 'from-fuchsia-600 to-purple-900', text: 'text-fuchsia-300',glow: 'rgba(232,121,249,0.55)' },
      gym_leader: { emoji: '⚔️', ring: 'border-amber-400',   bg: 'from-orange-600 to-red-900',     text: 'text-amber-300',  glow: 'rgba(251,146,60,0.7)' },
      rest:       { emoji: '🔥', ring: 'border-rose-400',    bg: 'from-rose-600 to-orange-900',    text: 'text-rose-300',   glow: 'rgba(251,113,133,0.6)' },
    };

    const hpColor = (hp: number, maxHp: number) => {
      const r = maxHp > 0 ? hp / maxHp : 0;
      return r > 0.5 ? '#22c55e' : r > 0.2 ? '#eab308' : '#ef4444';
    };

    const renderNode = (node: MapNode, rowIdx: number) => {
      const idx = gameState.map.indexOf(node);
      const st = nodeStyle[node.type];
      const canAccess = gameState.currentNode < 0 ? idx === 0 : ((idx === gameState.currentNode && !node.completed) || gameState.map[gameState.currentNode]?.connections?.includes(idx) || false);
      const isAccessible = canAccess && !node.completed;
      const isCurrent = idx === gameState.currentNode;
      const isGym = node.type === 'gym_leader';

      return (
        <button
          key={node.id}
          onClick={() => isAccessible && handleNodeClick(idx)}
          disabled={!isAccessible}
          className={`relative flex flex-col items-center gap-1 group ${isAccessible ? 'cursor-pointer' : 'cursor-default'}`}
          style={{ animationDelay: `${0.05 * idx + 0.15 * rowIdx}s` }}
        >
          {/* Medaglione del nodo */}
          <span
            className={`relative flex items-center justify-center rounded-full border-2 transition-all duration-300 ${
              isGym ? 'w-14 h-14 md:w-[72px] md:h-[72px] text-2xl md:text-3xl' : 'w-12 h-12 md:w-16 md:h-16 text-xl md:text-2xl'
            } ${
              node.completed
                ? 'border-green-500/60 bg-gradient-to-b from-gray-700 to-gray-900 opacity-70'
                : isAccessible
                ? `${st.ring} bg-gradient-to-b ${st.bg} animate-node-pulse group-hover:scale-110 group-active:scale-95`
                : 'border-gray-700 bg-gradient-to-b from-gray-800 to-gray-950 opacity-40 grayscale'
            }`}
            style={!node.completed && isAccessible ? { boxShadow: `0 0 18px ${st.glow}` } : undefined}
          >
            <span className="emoji">{st.emoji}</span>
            {node.completed && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-green-200 text-white text-[10px] font-black flex items-center justify-center shadow">✓</span>
            )}
            {isCurrent && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-orange-400 text-xs animate-bounce" aria-hidden="true">📍</span>
            )}
          </span>
          <span className={`text-[10px] md:text-xs font-bold leading-none ${node.completed ? 'text-green-400/80' : isAccessible ? st.text : 'text-gray-600'}`}>
            {t(`map.${node.type}`, lang)}
          </span>
        </button>
      );
    };

    // Percorso a serpentina: riga alta 0-4 (sx->dx), riga bassa 9-5 (dx->sx)
    const rowTop = gameState.map.slice(0, 5);
    const rowBottom = gameState.map.slice(5, 10).slice().reverse();

    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#1a0b2e] via-[#0d0618] to-black">
        {/* Sfondo animato: luna, pipistrelli, particelle, orbe */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="battle-moon" />
          <span className="battle-bat" style={{ top: '12%', left: '8%', animationDelay: '0s' }}>🦇</span>
          <span className="battle-bat battle-bat-sm" style={{ top: '22%', right: '30%', animationDelay: '2s' }}>🦇</span>
          {particles.map((particle, i) => (
            <div
              key={i}
              className="absolute animate-float-particle"
              style={{ left: `${particle.left}%`, top: `${particle.top}%`, animationDelay: `${particle.delay}s`, animationDuration: `${particle.duration}s` }}
            >
              <div className="w-1 h-1 bg-purple-400/30 rounded-full" />
            </div>
          ))}
          <div className="absolute top-1/3 -left-10 w-40 h-40 bg-purple-600/15 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-10 -right-10 w-48 h-48 bg-orange-600/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto p-3 md:p-6">
          {/* Header ondata */}
          <div className="text-center mb-4 md:mb-6 animate-fade-in-down">
            <h2
              className="text-4xl md:text-6xl font-black tracking-wide"
              style={{
                background: 'linear-gradient(135deg, #fb923c, #f97316, #c026d3)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 18px rgba(249,115,22,0.45))',
              }}
            >
              {t('map.wave', lang)} {gameState.currentWave}
            </h2>
            {/* Progresso nodi della wave */}
            <div className="max-w-md mx-auto mt-2 md:mt-3">
              <div className="h-2.5 md:h-3 bg-gray-900/80 rounded-full overflow-hidden border border-purple-700/50 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-purple-500 transition-all duration-700"
                  style={{ width: `${totalNodes > 0 ? (completedCount / totalNodes) * 100 : 0}%` }}
                />
              </div>
              <p className="text-purple-300/80 text-[11px] md:text-xs mt-1 font-bold">
                {completedCount}/{totalNodes} · {t('map.nodes_completed', lang)}
              </p>
            </div>
          </div>

          {/* Risorse: dolcetti e medaglie */}
          <div className="flex justify-center gap-2 md:gap-3 mb-4 md:mb-5 animate-fade-in">
            <span className="inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-full bg-amber-950/70 border border-amber-500/50 text-amber-300 font-bold text-sm md:text-base shadow-lg shadow-amber-900/40">
              🍬 {gameState.candies} <span className="hidden md:inline font-normal text-amber-200/80 text-xs">{t('map.candies', lang)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-full bg-indigo-950/70 border border-indigo-500/50 text-indigo-300 font-bold text-sm md:text-base shadow-lg shadow-indigo-900/40">
              🏅 {gameState.medals.length} <span className="hidden md:inline font-normal text-indigo-200/80 text-xs">{t('map.medals', lang)}</span>
            </span>
          </div>

          {/* Squadra */}
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-3 md:p-4 mb-4 md:mb-5 border border-purple-700/50 shadow-xl shadow-purple-950/40 animate-fade-in-up">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs md:text-sm text-purple-300 font-black tracking-widest uppercase">🧟 {t('map.team', lang)}</span>
              <button
                onClick={() => setShowTeamOrder(!showTeamOrder)}
                className="text-xs px-3 py-1.5 min-h-[36px] bg-purple-700/80 text-white rounded-lg hover:bg-purple-600 active:scale-95 transition-all border border-purple-500/50 font-bold touch-manipulation"
              >
                {showTeamOrder ? `✓ ${t('map.done', lang)}` : `↕️ ${t('map.order', lang)}`}
              </button>
            </div>

            {showTeamOrder ? (
              <div className="space-y-2">
                {gameState.team.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 bg-purple-900/40 rounded-xl px-3 py-2 border border-purple-700/40">
                    <span className="text-orange-400 font-black text-sm w-5">{i + 1}.</span>
                    <MonsterIcon monsterId={m.id} emoji={m.emoji} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-bold truncate">{tMonster(m.id, lang)} Lv.{m.level}</div>
                      <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden mt-0.5 border border-gray-700">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.stats.maxHp > 0 ? (m.stats.hp / m.stats.maxHp) * 100 : 0}%`, background: hpColor(m.stats.hp, m.stats.maxHp) }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveMonsterUp(i)}
                        disabled={i === 0}
                        className="text-xs px-2 py-1 min-w-[36px] min-h-[32px] bg-blue-700 text-white rounded-lg hover:bg-blue-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveMonsterDown(i)}
                        disabled={i === gameState.team.length - 1}
                        className="text-xs px-2 py-1 min-w-[36px] min-h-[32px] bg-blue-700 text-white rounded-lg hover:bg-blue-600 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {gameState.team.map((m, i) => (
                  <div key={i} className={`flex items-center gap-1.5 rounded-xl pl-1.5 pr-2.5 py-1.5 border transition-all ${m.stats.hp <= 0 ? 'bg-gray-900/60 border-gray-700 opacity-50' : 'bg-purple-900/40 border-purple-700/50 hover:border-purple-500'}`}>
                    <MonsterIcon monsterId={m.id} emoji={m.emoji} size="sm" />
                    <div className="min-w-0">
                      <div className="text-[11px] md:text-xs text-white font-bold leading-tight truncate max-w-[90px] md:max-w-none">{tMonster(m.id, lang)} <span className="text-purple-300/80 font-normal">Lv.{m.level}</span></div>
                      <div className="w-16 md:w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700/60">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${m.stats.maxHp > 0 ? (m.stats.hp / m.stats.maxHp) * 100 : 0}%`, background: hpColor(m.stats.hp, m.stats.maxHp) }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Percorso della wave */}
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-purple-700/50 shadow-xl shadow-purple-950/40 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            <h3 className="text-base md:text-xl font-black text-center mb-4 md:mb-6 tracking-wide">
              <span
                style={{
                  background: 'linear-gradient(90deg, #c084fc, #fb923c)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                🗺️ {t('map.title', lang)}
              </span>
            </h3>

            <div className="relative">
              {/* Riga alta: nodi 0 -> 4 */}
              <div className="flex items-center">
                {rowTop.map((node, i) => (
                  <div key={node.id} className="contents">
                    {renderNode(node, 0)}
                    {i < rowTop.length - 1 && (
                      <div className={`flex-1 h-0.5 md:h-1 mx-0.5 rounded-full ${node.completed ? 'bg-gradient-to-r from-green-500/70 to-green-400/40' : 'bg-purple-800/40'}`} />
                    )}
                  </div>
                ))}
              </div>
              {/* Connettore verticale a destra tra le due righe */}
              <div className="flex justify-end pr-6 md:pr-8">
                <div className={`w-0.5 md:w-1 h-5 md:h-7 rounded-full ${rowTop.length > 0 && rowTop[rowTop.length - 1].completed ? 'bg-green-500/60' : 'bg-purple-800/40'}`} />
              </div>
              {/* Riga bassa: nodi 9 -> 5 (serpentina) */}
              <div className="flex items-center">
                {rowBottom.map((node, i) => (
                  <div key={node.id} className="contents">
                    {renderNode(node, 1)}
                    {i < rowBottom.length - 1 && (
                      <div className={`flex-1 h-0.5 md:h-1 mx-0.5 rounded-full ${node.completed ? 'bg-gradient-to-l from-green-500/70 to-green-400/40' : 'bg-purple-800/40'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inventario */}
          {gameState.items.some(i => i.quantity > 0) && (
            <div className="bg-black/50 backdrop-blur-sm rounded-2xl p-3 md:p-4 mt-4 md:mt-5 border border-purple-700/50 shadow-xl shadow-purple-950/40 animate-fade-in-up" style={{ animationDelay: '0.25s' }}>
              <h4 className="text-xs md:text-sm font-black text-purple-300 mb-2 tracking-widest uppercase">🎒 {t('map.inventory', lang)}</h4>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {gameState.items.filter(i => i.quantity > 0).map(item => (
                  <span key={item.id} className="bg-purple-900/50 border border-purple-700/40 rounded-full px-2.5 py-1 text-[11px] md:text-xs text-gray-200 inline-flex items-center gap-1">
                    <span className="emoji">{item.emoji}</span> {tItem(item.id, lang)} <span className="text-yellow-400 font-bold">×{item.quantity}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cura squadra */}
          <div className="mt-4 md:mt-6 text-center animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
            <button
              onClick={healTeam}
              disabled={gameState.healsUsed >= 2}
              className="group relative px-6 md:px-8 py-3 min-h-[48px] bg-gradient-to-b from-green-600 to-emerald-800 text-white rounded-2xl font-black text-sm md:text-base border-2 border-green-400/70 shadow-lg shadow-green-900/50 hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden touch-manipulation"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative">💚 {t('map.heal', lang)} <span className="text-green-200/80">({gameState.healsUsed}/2)</span></span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderBattle = () => {
    if (!activeBattle) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-950 to-black p-4 flex items-center justify-center">
          <button onClick={() => returnToMap()} className="px-6 py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-600 font-bold">
            {t('battle.return_map', lang)}
          </button>
        </div>
      );
    }
    return (
      <BattleScreen
        key={activeBattle.key}
        lang={lang}
        initial={activeBattle.state}
        cfg={activeBattle.cfg}
        encounter={activeBattle.encounter}
        wave={gameState.currentWave}
        rewards={activeBattle.rewards}
        settings={settings}
        canDoubleAd={isRewardedAvailable() && doubleAdWave !== gameState.currentWave}
        onWatchDoubleAd={async () => {
          const ok = await runRewardedAd('double');
          if (ok) setDoubleAdWave(gameState.currentWave);
          return ok;
        }}
        onTurn={onBattleTurn}
        onFinish={onBattleFinish}
      />
    );
  };

  const renderShop = () => (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-gray-900 to-black p-3 md:p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-black/60 rounded-xl p-4 md:p-6 border border-orange-800">
          <h2 className="text-2xl md:text-3xl font-bold text-orange-400 mb-2 text-center">{t('shop.title', lang)}</h2>
          <p className="text-yellow-400 text-center mb-4 md:mb-6 text-sm md:text-base">{t('map.candies', lang)}: {gameState.candies}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            {shopPrices.map(item => {
              const inventoryItem = gameState.items.find(entry => entry.id === item.id);
              const potionItem = inventoryItem?.category === 'potion';
              const capacity = potionItem ? getItemStackCapacity(item.id, persistentData.upgrades) : Infinity;
              const full = potionItem && (inventoryItem?.quantity || 0) >= capacity;
              return (
                <button
                  key={item.id}
                  onClick={() => buyItem(item.id, item.cost)}
                  disabled={gameState.candies < item.cost || full}
                  className="p-2 md:p-3 rounded-lg bg-purple-900/50 border border-purple-700 hover:bg-purple-800/50 disabled:opacity-40 transition-all text-left"
                >
                  <p className="text-white font-bold text-xs md:text-sm">{tItem(item.id, lang)}</p>
                  <p className="text-xs text-gray-400">{tItemDesc(item.id, lang)}</p>
                  {potionItem && <p className="text-xs text-gray-400">{t('shop.stock', lang)}: {inventoryItem?.quantity || 0}/{capacity}</p>}
                  <p className="text-yellow-400 text-xs md:text-sm mt-1">🍬 {item.cost}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 md:mt-6 text-center">
            <button onClick={() => returnToMap()} className="px-4 md:px-6 py-2 md:py-3 bg-orange-700 text-white rounded-lg hover:bg-orange-600 font-bold text-sm md:text-base">
              {t('battle.return_map', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEvent = () => {
    const isRest = gameState.map[gameState.currentNode]?.type === 'rest';
    const lines = gameState.battleLog?.length ? gameState.battleLog : [''];
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-950 via-gray-900 to-black p-3 md:p-4 flex items-center justify-center">
        <div className="bg-black/60 rounded-2xl p-6 md:p-8 border-2 border-purple-700 max-w-md w-full text-center shadow-2xl shadow-purple-900/50 animate-fade-in-up">
          <div className="text-6xl md:text-7xl mb-4 animate-bounce-slow">{isRest ? '🔥' : '🔮'}</div>
          {lines.map((line, i) => (
            <p key={i} className={`${i === 0 ? 'text-lg md:text-xl text-purple-100 font-bold' : 'text-sm md:text-base text-purple-300'} mb-3 px-2`}>{line}</p>
          ))}
          {isRest && (
            <div className="flex flex-wrap justify-center gap-2 my-4">
              {gameState.team.map((m, i) => (
                <div key={i} className="flex flex-col items-center bg-purple-900/40 rounded-xl px-2 py-1 border border-purple-700/50">
                  <MonsterIcon monsterId={m.id} emoji={m.emoji} size="sm" />
                  <span className="text-[11px] text-green-300 font-bold">{m.stats.hp}/{m.stats.maxHp}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => { playSfx('ui_click'); returnToMap(); }} className="mt-2 px-6 py-3 min-h-[48px] bg-gradient-to-b from-orange-500 to-orange-700 text-white rounded-xl font-black text-base border-2 border-orange-300 shadow-lg">
            {t('event.continue', lang)} ➜
          </button>
        </div>
      </div>
    );
  };

  const leaveGameOver = () => {
    endRun();
    const now = Date.now();
    if (now - lastInterstitialRef.current >= 60000) {
      lastInterstitialRef.current = now;
      showInterstitialAd('game_over');
    }
    setActiveBattle(null);
    setGameState(prev => ({
      ...prev,
      phase: 'title',
      team: [],
      items: deepClone(defaultItems),
      candies: 50,
      cursedCoins: 0,
      medals: [],
      currentWave: 1,
      map: [],
      currentNode: -1,
      battleEnemies: [],
      activeEnemyIndex: 0,
      battleCatchable: false,
      battleLog: [],
      selectedMonsterIndex: 0,
      isPlayerTurn: true,
      battleOver: false,
      battleWon: false,
      healsUsed: 0,
      revivesUsed: 0,
    }));
  };

  const renderGameOver = () => {
    const hasFainted = gameState.team.some(m => m.stats.hp <= 0);
    const amuletReady = hasUpgrade(persistentData.upgrades, 'gravedigger_amulet') && !amuletReviveUsed && hasFainted;
    const adReviveReady = hasFainted && (gameState.revivesUsed || 0) < 1 && isRewardedAvailable();
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-950 via-black to-purple-950 p-3 md:p-4 flex items-center justify-center">
        <div className="text-center px-4 max-w-md w-full animate-fade-in-up">
          <div className="text-7xl md:text-8xl mb-4 animate-float-slow">💀</div>
          <h2 className="text-4xl md:text-5xl font-black text-red-400 mb-4" style={{ textShadow: '0 0 20px #ef4444' }}>
            {t('gameover.title', lang)}
          </h2>
          <div className="bg-black/50 rounded-2xl border border-red-800/60 p-4 mb-6 space-y-1">
            <p className="text-gray-300 text-sm md:text-base">{t('gameover.run_ended', lang)} <b className="text-white">{gameState.currentWave}</b></p>
            <p className="text-purple-300 text-sm md:text-base">{t('gameover.medals', lang)} {gameState.medals.length} 🏅</p>
            <p className="text-yellow-400 text-sm md:text-base">{t('gameover.candies', lang)} {gameState.candies} 🍬</p>
          </div>
          <div className="flex flex-col gap-3 items-stretch">
            {amuletReady && (
              <button onClick={() => reviveStrongest('amulet')} className="px-6 py-3 min-h-[52px] bg-gradient-to-r from-indigo-600 to-purple-700 text-white text-lg font-black rounded-xl shadow-lg border-2 border-indigo-300">
                🔮 {t('gameover.amulet_revive', lang)}
              </button>
            )}
            {adReviveReady && (
              <button onClick={() => setAdOffer('revive')} className="px-6 py-3 min-h-[52px] bg-gradient-to-r from-purple-600 to-purple-800 text-white text-lg font-black rounded-xl shadow-lg border-2 border-purple-300">
                📺 {t('gameover.revive_ad', lang)}
              </button>
            )}
            <button onClick={() => { playSfx('ui_click'); leaveGameOver(); }} className="px-6 py-3 min-h-[52px] bg-gradient-to-r from-orange-600 to-red-700 text-white text-lg font-black rounded-xl shadow-lg border-2 border-orange-300">
              {t('gameover.new_run', lang)}
            </button>
          </div>
          <div className="mt-6 text-gray-500 text-xs md:text-sm italic px-2">{t('gameover.quote', lang)}</div>
        </div>
      </div>
    );
  };

  const renderDailyObjectives = () => {
    const objectives = challengeTab === 'daily'
      ? persistentData.dailyObjectives
      : challengeTab === 'weekly'
        ? persistentData.weeklyObjectives
        : persistentData.monthlyObjectives;
    const titleKey = challengeTab === 'daily'
      ? 'title.daily_objectives'
      : challengeTab === 'weekly'
        ? 'title.weekly_challenges'
        : 'title.monthly_challenges';
    const resetKey = challengeTab === 'daily'
      ? 'objectives.reset_daily'
      : challengeTab === 'weekly'
        ? 'objectives.reset_weekly'
        : 'objectives.reset_monthly';

    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-950 via-gray-900 to-black p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-black/60 rounded-xl p-6 border-2 border-blue-600">
            <div className="flex justify-between items-center mb-6 gap-3">
              <h2 className="text-2xl md:text-3xl font-bold text-blue-400">🎯 {t(titleKey, lang)}</h2>
              <button
                onClick={() => setGameState(prev => ({ ...prev, phase: 'title' }))}
                className="px-4 py-2 min-h-[44px] bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                ← {t('metashop.back', lang)}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5" role="tablist">
              {(['daily', 'weekly', 'monthly'] as ChallengePeriod[]).map(period => (
                <button
                  key={period}
                  role="tab"
                  aria-selected={challengeTab === period}
                  onClick={() => setChallengeTab(period)}
                  className={`px-2 py-3 min-h-[44px] rounded-lg border font-bold text-sm md:text-base transition-colors ${
                    challengeTab === period
                      ? 'bg-blue-700 border-blue-400 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {t(`objectives.tab_${period}`, lang)}
                  {objectives.length > 0 && (
                    <span className="ml-1 text-xs">
                      ({(period === 'daily'
                        ? persistentData.dailyObjectives
                        : period === 'weekly'
                          ? persistentData.weeklyObjectives
                          : persistentData.monthlyObjectives
                      ).filter(objective => objective.completed && !objective.claimed).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {objectives.map(objective => (
                <div
                  key={objective.id}
                  className={`p-4 rounded-lg border-2 ${
                    objective.completed
                      ? 'bg-green-900/30 border-green-600'
                      : 'bg-purple-900/30 border-purple-600'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <h3 className="text-white font-bold text-base md:text-lg">
                      {dailyObjectiveTranslations[lang]?.[objective.description]
                        || dailyObjectiveTranslations.en[objective.description]
                        || objective.description.replace(/_/g, ' ')}
                    </h3>
                    <span className="text-yellow-400 font-bold inline-flex items-center gap-1 whitespace-nowrap">
                      <CoinIcon size={18} /> {objective.reward}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, objective.target > 0 ? (objective.current / objective.target) * 100 : 0)}%` }}
                      />
                    </div>
                    <span className="text-white font-bold text-sm">{objective.current}/{objective.target}</span>
                  </div>
                  {objective.completed && !objective.claimed && (
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-green-400 text-sm font-bold">✓ {t('ui.completed', lang)}</p>
                      <button
                        onClick={() => claimChallengeReward(challengeTab, objective.id)}
                        className="px-4 py-2 min-h-[44px] bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:scale-105 active:scale-95 transition-all border-2 border-green-400 shadow-lg shadow-green-500/30 inline-flex items-center gap-1.5 touch-manipulation"
                      >
                        <CoinIcon size={18} /> {t('ui.claim', lang)}
                      </button>
                    </div>
                  )}
                  {objective.completed && objective.claimed && (
                    <p className="text-gray-400 text-sm mt-2 font-bold">✓ {t('ui.claimed', lang)}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-900/30 rounded-lg border border-blue-600">
              <p className="text-blue-300 text-sm text-center">{t(resetKey, lang)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAchievements = () => (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-gray-900 to-black p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-black/60 rounded-xl p-6 border-2 border-yellow-600">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-yellow-400">🏆 {t('title.achievements', lang)}</h2>
            <button
              onClick={() => setGameState(prev => ({ ...prev, phase: 'title' }))}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              ← {t('metashop.back', lang)}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {persistentData.achievements.map((achievement, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-2 ${
                  achievement.unlocked
                    ? 'bg-yellow-900/30 border-yellow-600'
                    : 'bg-gray-900/30 border-gray-600 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-white font-bold text-lg">
                    {achievement.unlocked ? '🏆' : '🔒'} {achievementTranslations[lang]?.[achievement.id]?.name || achievement.name.replace(/_/g, ' ')}
                  </h3>
                  <span className="text-yellow-400 font-bold inline-flex items-center gap-1"><CoinIcon size={18} /> {achievement.reward}</span>
                </div>
                
                <p className="text-gray-300 text-sm">{achievementTranslations[lang]?.[achievement.id]?.description || achievement.description.replace(/_/g, ' ')}</p>
                
                {achievement.unlocked && !achievement.claimed && (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-yellow-400 text-sm font-bold">✓ {t('ui.unlocked', lang)}</p>
                    <button
                      onClick={() => claimAchievementReward(achievement.id)}
                      className="px-4 py-2 min-h-[44px] bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:scale-105 active:scale-95 transition-all border-2 border-green-400 shadow-lg shadow-green-500/30 inline-flex items-center gap-1.5 touch-manipulation"
                    >
                      <CoinIcon size={18} /> {t('ui.claim', lang)}
                    </button>
                  </div>
                )}
                {achievement.unlocked && achievement.claimed && (
                  <p className="text-gray-400 text-sm mt-2 font-bold">✓ {t('ui.claimed', lang)}</p>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-yellow-900/30 rounded-lg border border-yellow-600">
            <p className="text-yellow-300 text-sm text-center">
              {t('achievements.info', lang)}
            </p>
            <p className="text-yellow-400 text-center mt-2 font-bold">
              {persistentData.achievements.filter(a => a.unlocked).length}/{persistentData.achievements.length} {t('achievements.unlocked_count', lang)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ScreenTransition isTransitioning={isTransitioning}>
      {(() => {
        switch (gameState.phase) {
          case 'title': return renderTitle();
          case 'starter_select': return renderStarterSelect();
          case 'map': return renderMap();
          case 'battle': return renderBattle();
          case 'shop': return renderShop();
          case 'event': return renderEvent();
          case 'game_over': return renderGameOver();
          case 'meta_shop': return (
            <MetaShop
              persistentData={persistentData}
              lang={lang}
              onPurchase={purchaseUpgrade}
              onWatchAdForCoins={watchAdForCoins}
              adCoinsLeft={getAdCoinsLeft(persistentData)}
              adCoinsReward={AD_COINS_REWARD}
              onBack={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setGameState(prev => ({ ...prev, phase: 'title' }));
                  setIsTransitioning(false);
                }, 300);
              }}
            />
          );
          case 'daily_objectives': return renderDailyObjectives();
          case 'achievements': return renderAchievements();
          case 'statistics': return (
            <Statistics
              persistentData={persistentData}
              lang={lang}
              onBack={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setGameState(prev => ({ ...prev, phase: 'title' }));
                  setIsTransitioning(false);
                }, 300);
              }}
            />
          );
          case 'settings': return (
            <Settings
              lang={lang}
              settings={settings}
              onChange={updateSettings}
              onLangChange={changeLanguage}
              onBack={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setGameState(prev => ({ ...prev, phase: 'title' }));
                  setIsTransitioning(false);
                }, 300);
              }}
            />
          );
          default: return renderTitle();
        }
      })()}
      {/* Modale pubblicita' globale: disponibile in ogni fase (cura, rivivi, monete) */}
      {renderAdModal()}
    </ScreenTransition>
  );
}
