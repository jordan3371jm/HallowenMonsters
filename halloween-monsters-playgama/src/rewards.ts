import { DailyObjective, GameAchievement } from './types';

// ============================================================
// DAILY OBJECTIVES
// ============================================================

const objectivePool = [
  { id: 'defeat_5_monsters', description: 'defeat_5_monsters', trackId: 'defeat_monster', target: 5, reward: 30 },
  { id: 'catch_2_monsters', description: 'catch_2_monsters', trackId: 'catch_monster', target: 2, reward: 25 },
  { id: 'win_3_battles', description: 'win_3_battles', trackId: 'win_battle', target: 3, reward: 35 },
  { id: 'use_10_moves', description: 'use_10_moves', trackId: 'use_move', target: 10, reward: 20 },
  { id: 'reach_wave_5', description: 'reach_wave_5', trackId: 'reach_wave', target: 5, reward: 40 },
  { id: 'daily_trainer_2', description: 'daily_trainer_2', trackId: 'defeat_trainer', target: 2, reward: 35 },
  { id: 'daily_flawless_2', description: 'daily_flawless_2', trackId: 'flawless_win', target: 2, reward: 40 },
  { id: 'daily_super_5', description: 'daily_super_5', trackId: 'super_effective', target: 5, reward: 25 },
  { id: 'daily_crit_2', description: 'daily_crit_2', trackId: 'land_crit', target: 2, reward: 30 },
  { id: 'daily_status_3', description: 'daily_status_3', trackId: 'inflict_status', target: 3, reward: 25 },
  { id: 'daily_items_3', description: 'daily_items_3', trackId: 'use_item', target: 3, reward: 20 },
];

const weeklyObjectivePool = [
  { id: 'weekly_win_10', description: 'weekly_win_10', trackId: 'win_battle', target: 10, reward: 120 },
  { id: 'weekly_defeat_25', description: 'weekly_defeat_25', trackId: 'defeat_monster', target: 25, reward: 100 },
  { id: 'weekly_catch_5', description: 'weekly_catch_5', trackId: 'catch_monster', target: 5, reward: 140 },
  { id: 'weekly_reach_wave_10', description: 'weekly_reach_wave_10', trackId: 'reach_wave', target: 10, reward: 160 },
  { id: 'weekly_use_50', description: 'weekly_use_50', trackId: 'use_move', target: 50, reward: 90 },
  { id: 'weekly_defeat_gym', description: 'weekly_defeat_gym', trackId: 'defeat_gym', target: 1, reward: 150 },
  { id: 'weekly_trainer_8', description: 'weekly_trainer_8', trackId: 'defeat_trainer', target: 8, reward: 100 },
  { id: 'weekly_flawless_8', description: 'weekly_flawless_8', trackId: 'flawless_win', target: 8, reward: 130 },
  { id: 'weekly_super_25', description: 'weekly_super_25', trackId: 'super_effective', target: 25, reward: 100 },
  { id: 'weekly_crit_10', description: 'weekly_crit_10', trackId: 'land_crit', target: 10, reward: 110 },
  { id: 'weekly_evolve_2', description: 'weekly_evolve_2', trackId: 'evolve', target: 2, reward: 150 },
  { id: 'weekly_status_15', description: 'weekly_status_15', trackId: 'inflict_status', target: 15, reward: 90 },
];

const monthlyObjectivePool = [
  { id: 'monthly_win_40', description: 'monthly_win_40', trackId: 'win_battle', target: 40, reward: 450 },
  { id: 'monthly_defeat_100', description: 'monthly_defeat_100', trackId: 'defeat_monster', target: 100, reward: 400 },
  { id: 'monthly_catch_15', description: 'monthly_catch_15', trackId: 'catch_monster', target: 15, reward: 500 },
  { id: 'monthly_reach_wave_20', description: 'monthly_reach_wave_20', trackId: 'reach_wave', target: 20, reward: 600 },
  { id: 'monthly_use_200', description: 'monthly_use_200', trackId: 'use_move', target: 200, reward: 350 },
  { id: 'monthly_defeat_3_gyms', description: 'monthly_defeat_3_gyms', trackId: 'defeat_gym', target: 3, reward: 550 },
  { id: 'monthly_trainer_30', description: 'monthly_trainer_30', trackId: 'defeat_trainer', target: 30, reward: 400 },
  { id: 'monthly_flawless_30', description: 'monthly_flawless_30', trackId: 'flawless_win', target: 30, reward: 500 },
  { id: 'monthly_super_100', description: 'monthly_super_100', trackId: 'super_effective', target: 100, reward: 400 },
  { id: 'monthly_crit_40', description: 'monthly_crit_40', trackId: 'land_crit', target: 40, reward: 420 },
  { id: 'monthly_evolve_6', description: 'monthly_evolve_6', trackId: 'evolve', target: 6, reward: 550 },
  { id: 'monthly_items_60', description: 'monthly_items_60', trackId: 'use_item', target: 60, reward: 350 },
];

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateObjectives(pool: typeof objectivePool): DailyObjective[] {
  return shuffled(pool).slice(0, 4).map(obj => ({
    ...obj,
    current: 0,
    completed: false,
    claimed: false,
  }));
}

export function generateDailyObjectives(): DailyObjective[] {
  return generateObjectives(objectivePool);
}

export function generateWeeklyObjectives(): DailyObjective[] {
  return generateObjectives(weeklyObjectivePool);
}

export function generateMonthlyObjectives(): DailyObjective[] {
  return generateObjectives(monthlyObjectivePool);
}

export function getDailyPeriodKey(date = new Date()): string {
  return date.toDateString();
}

export function getWeeklyPeriodKey(date = new Date()): string {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday.toDateString();
}

export function getMonthlyPeriodKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function migrateObjectives(objectives: DailyObjective[] = []): DailyObjective[] {
  const knownTrackIds: Record<string, string> = {
    defeat_5_monsters: 'defeat_monster',
    catch_2_monsters: 'catch_monster',
    win_3_battles: 'win_battle',
    use_10_moves: 'use_move',
    reach_wave_5: 'reach_wave',
  };
  return objectives.map(objective => ({
    ...objective,
    current: Math.max(0, Number(objective.current) || 0),
    target: Math.max(1, Number(objective.target) || 1),
    reward: Math.max(0, Number(objective.reward) || 0),
    completed: Boolean(objective.completed),
    claimed: objective.claimed !== undefined ? Boolean(objective.claimed) : Boolean(objective.completed),
    trackId: objective.trackId || knownTrackIds[objective.id] || objective.id,
  }));
}

export function advanceObjectives(
  objectives: DailyObjective[],
  trackId: string,
  amount = 1,
  mode: 'add' | 'max' = 'add',
): DailyObjective[] {
  return objectives.map(objective => {
    if ((objective.trackId || objective.id) !== trackId || objective.completed) return objective;
    const next = mode === 'max'
      ? Math.max(objective.current, amount)
      : objective.current + amount;
    const current = Math.min(objective.target, Math.max(0, next));
    const completed = current >= objective.target;
    return { ...objective, current, completed };
  });
}

// ============================================================
// LOGIN REWARDS
// ============================================================

export function getLoginReward(streak: number): number {
  if (streak >= 30) return 200;
  if (streak >= 14) return 100;
  if (streak >= 7) return 60;
  if (streak >= 3) return 30;
  return 15;
}

// ============================================================
// ACHIEVEMENTS
// ============================================================

const achievementPool: Omit<GameAchievement, 'unlocked' | 'claimed'>[] = [
  { id: 'first_battle', name: 'first_battle', description: 'Win your first battle', reward: 20 },
  { id: 'catch_10', name: 'catch_10', description: 'Catch 10 monsters', reward: 50 },
  { id: 'catch_50', name: 'catch_50', description: 'Catch 50 monsters', reward: 150 },
  { id: 'defeat_50', name: 'defeat_50', description: 'Defeat 50 monsters', reward: 50 },
  { id: 'defeat_200', name: 'defeat_200', description: 'Defeat 200 monsters', reward: 150 },
  { id: 'wave_5', name: 'wave_5', description: 'Reach wave 5', reward: 30 },
  { id: 'wave_10', name: 'wave_10', description: 'Reach wave 10', reward: 60 },
  { id: 'wave_20', name: 'wave_20', description: 'Reach wave 20', reward: 120 },
  { id: 'first_gym', name: 'first_gym', description: 'Defeat your first gym leader', reward: 50 },
  { id: 'five_gyms', name: 'five_gyms', description: 'Defeat 5 gym leaders', reward: 200 },
  { id: 'streak_5', name: 'streak_5', description: 'Win 5 battles in a row', reward: 80 },
  { id: 'streak_10', name: 'streak_10', description: 'Win 10 battles in a row', reward: 150 },
  { id: 'streak_20', name: 'streak_20', description: 'Win 20 battles in a row', reward: 300 },
  { id: 'catch_100', name: 'catch_100', description: 'Catch 100 monsters', reward: 300 },
  { id: 'defeat_500', name: 'defeat_500', description: 'Defeat 500 monsters', reward: 300 },
  { id: 'defeat_1000', name: 'defeat_1000', description: 'Defeat 1000 monsters', reward: 600 },
  { id: 'wave_30', name: 'wave_30', description: 'Reach wave 30', reward: 250 },
  { id: 'wave_50', name: 'wave_50', description: 'Reach wave 50', reward: 500 },
  { id: 'ten_gyms', name: 'ten_gyms', description: 'Defeat 10 gym leaders', reward: 400 },
  { id: 'twenty_gyms', name: 'twenty_gyms', description: 'Defeat 20 gym leaders', reward: 800 },
  { id: 'wins_100', name: 'wins_100', description: 'Win 100 battles', reward: 200 },
  { id: 'wins_500', name: 'wins_500', description: 'Win 500 battles', reward: 500 },
  { id: 'runs_10', name: 'runs_10', description: 'Complete 10 runs', reward: 60 },
  { id: 'runs_50', name: 'runs_50', description: 'Complete 50 runs', reward: 200 },
];

export function initializeAchievements(): GameAchievement[] {
  return achievementPool.map(a => ({
    ...a,
    unlocked: false,
    claimed: false,
  }));
}

export function checkAchievements(
  current: GameAchievement[],
  stats: {
    totalRuns: number;
    totalWins: number;
    bestWave: number;
    totalMonstersDefeated: number;
    totalMonstersCaught: number;
    totalGymLeadersDefeated: number;
    longestWinStreak: number;
  }
): { newAchievements: string[]; updatedAchievements: GameAchievement[] } {
  const newAchievements: string[] = [];

  const updated = current.map(ach => {
    if (ach.unlocked) return ach;

    let shouldUnlock = false;
    switch (ach.id) {
      case 'first_battle': shouldUnlock = stats.totalWins >= 1; break;
      case 'catch_10': shouldUnlock = stats.totalMonstersCaught >= 10; break;
      case 'catch_50': shouldUnlock = stats.totalMonstersCaught >= 50; break;
      case 'defeat_50': shouldUnlock = stats.totalMonstersDefeated >= 50; break;
      case 'defeat_200': shouldUnlock = stats.totalMonstersDefeated >= 200; break;
      case 'wave_5': shouldUnlock = stats.bestWave >= 5; break;
      case 'wave_10': shouldUnlock = stats.bestWave >= 10; break;
      case 'wave_20': shouldUnlock = stats.bestWave >= 20; break;
      case 'first_gym': shouldUnlock = stats.totalGymLeadersDefeated >= 1; break;
      case 'five_gyms': shouldUnlock = stats.totalGymLeadersDefeated >= 5; break;
      case 'streak_5': shouldUnlock = stats.longestWinStreak >= 5; break;
      case 'streak_10': shouldUnlock = stats.longestWinStreak >= 10; break;
      case 'streak_20': shouldUnlock = stats.longestWinStreak >= 20; break;
      case 'catch_100': shouldUnlock = stats.totalMonstersCaught >= 100; break;
      case 'defeat_500': shouldUnlock = stats.totalMonstersDefeated >= 500; break;
      case 'defeat_1000': shouldUnlock = stats.totalMonstersDefeated >= 1000; break;
      case 'wave_30': shouldUnlock = stats.bestWave >= 30; break;
      case 'wave_50': shouldUnlock = stats.bestWave >= 50; break;
      case 'ten_gyms': shouldUnlock = stats.totalGymLeadersDefeated >= 10; break;
      case 'twenty_gyms': shouldUnlock = stats.totalGymLeadersDefeated >= 20; break;
      case 'wins_100': shouldUnlock = stats.totalWins >= 100; break;
      case 'wins_500': shouldUnlock = stats.totalWins >= 500; break;
      case 'runs_10': shouldUnlock = stats.totalRuns >= 10; break;
      case 'runs_50': shouldUnlock = stats.totalRuns >= 50; break;
      default: break;
    }

    if (shouldUnlock) {
      newAchievements.push(ach.id);
      return { ...ach, unlocked: true, claimed: false };
    }
    return ach;
  });

  return { newAchievements, updatedAchievements: updated };
}
