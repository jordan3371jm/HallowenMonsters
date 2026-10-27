import { Language } from '../i18n';
import { PersistentData } from '../types';

interface StatisticsProps {
  persistentData: PersistentData;
  lang: Language;
  onBack: () => void;
}

export default function Statistics({ persistentData, lang, onBack }: StatisticsProps) {
  const translations = {
    en: {
      title: 'Statistics',
      back: 'Back',
      totalPlayTime: 'Total Play Time',
      totalRuns: 'Total Runs',
      bestWave: 'Best Wave',
      totalBattles: 'Total Battles',
      wins: 'Wins',
      losses: 'Losses',
      winRate: 'Win Rate',
      monstersDefeated: 'Monsters Defeated',
      monstersCaught: 'Monsters Caught',
      gymLeadersDefeated: 'Gym Leaders Defeated',
      longestStreak: 'Longest Win Streak',
      favoriteMonster: 'Favorite Monster',
      hours: 'hours',
      minutes: 'minutes',
    },
    it: {
      title: 'Statistiche',
      back: 'Indietro',
      totalPlayTime: 'Tempo di Gioco Totale',
      totalRuns: 'Run Totali',
      bestWave: 'Miglior Ondata',
      totalBattles: 'Battaglie Totali',
      wins: 'Vittorie',
      losses: 'Sconfitte',
      winRate: 'Percentuale Vittorie',
      monstersDefeated: 'Mostri Sconfitti',
      monstersCaught: 'Mostri Catturati',
      gymLeadersDefeated: 'Capipalestra Sconfitti',
      longestStreak: 'Serie Vittorie Più Lunga',
      favoriteMonster: 'Mostro Preferito',
      hours: 'ore',
      minutes: 'minuti',
    },
    fr: {
      title: 'Statistiques',
      back: 'Retour',
      totalPlayTime: 'Temps de Jeu Total',
      totalRuns: 'Runs Totaux',
      bestWave: 'Meilleure Vague',
      totalBattles: 'Batailles Totales',
      wins: 'Victoires',
      losses: 'Défaites',
      winRate: 'Taux de Victoire',
      monstersDefeated: 'Monstres Vaincus',
      monstersCaught: 'Monstres Capturés',
      gymLeadersDefeated: 'Champions Vaincus',
      longestStreak: 'Plus Longue Série de Victoires',
      favoriteMonster: 'Monstre Favori',
      hours: 'heures',
      minutes: 'minutes',
    },
    es: {
      title: 'Estadísticas',
      back: 'Volver',
      totalPlayTime: 'Tiempo de Juego Total',
      totalRuns: 'Partidas Totales',
      bestWave: 'Mejor Oleada',
      totalBattles: 'Batallas Totales',
      wins: 'Victorias',
      losses: 'Derrotas',
      winRate: 'Tasa de Victoria',
      monstersDefeated: 'Monstruos Derrotados',
      monstersCaught: 'Monstruos Capturados',
      gymLeadersDefeated: 'Líderes Derrotados',
      longestStreak: 'Racha de Victorias Más Larga',
      favoriteMonster: 'Monstruo Favorito',
      hours: 'horas',
      minutes: 'minutos',
    },
    tr: {
      title: 'İstatistikler',
      back: 'Geri',
      totalPlayTime: 'Toplam Oyun Süresi',
      totalRuns: 'Toplam Koşu',
      bestWave: 'En İyi Dalga',
      totalBattles: 'Toplam Savaş',
      wins: 'Zaferler',
      losses: 'Yenilgiler',
      winRate: 'Kazanma Oranı',
      monstersDefeated: 'Yenilen Canavarlar',
      monstersCaught: 'Yakalanan Canavarlar',
      gymLeadersDefeated: 'Yenilen Liderler',
      longestStreak: 'En Uzun Galibiyet Serisi',
      favoriteMonster: 'Favori Canavar',
      hours: 'saat',
      minutes: 'dakika',
    },
  };

  const t = translations[lang];

  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} ${t.hours} ${minutes} ${t.minutes}`;
    }
    return `${minutes} ${t.minutes}`;
  };

  const winRate = persistentData.totalBattles > 0
    ? ((persistentData.totalWins / persistentData.totalBattles) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-gray-900 to-black p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-black/60 rounded-xl p-6 border-2 border-cyan-600">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-cyan-400">
              📊 {t.title}
            </h1>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-bold"
            >
              ← {t.back}
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
              <h3 className="text-white font-bold text-lg mb-3">{t.totalPlayTime}</h3>
              <p className="text-cyan-400 text-2xl font-bold">{formatPlayTime(persistentData.totalPlayTime)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
                <p className="text-gray-400 text-sm">{t.totalRuns}</p>
                <p className="text-white font-bold text-2xl">{persistentData.totalRuns}</p>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
                <p className="text-gray-400 text-sm">{t.bestWave}</p>
                <p className="text-white font-bold text-2xl">{persistentData.bestWave}</p>
              </div>
            </div>

            <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
              <h3 className="text-white font-bold text-lg mb-3">{t.totalBattles}</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-gray-400 text-sm">{t.wins}</p>
                  <p className="text-green-400 font-bold text-xl">{persistentData.totalWins}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{t.losses}</p>
                  <p className="text-red-400 font-bold text-xl">{persistentData.totalLosses}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{t.winRate}</p>
                  <p className="text-cyan-400 font-bold text-xl">{winRate}%</p>
                </div>
              </div>
            </div>

            <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
              <h3 className="text-white font-bold text-lg mb-3">Monsters</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-400 text-sm">{t.monstersDefeated}</p>
                  <p className="text-white font-bold text-xl">{persistentData.totalMonstersDefeated}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">{t.monstersCaught}</p>
                  <p className="text-white font-bold text-xl">{persistentData.totalMonstersCaught}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
                <p className="text-gray-400 text-sm">{t.gymLeadersDefeated}</p>
                <p className="text-yellow-400 font-bold text-2xl">{persistentData.totalGymLeadersDefeated}</p>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
                <p className="text-gray-400 text-sm">{t.longestStreak}</p>
                <p className="text-orange-400 font-bold text-2xl">{persistentData.longestWinStreak}</p>
              </div>
            </div>

            {persistentData.favoriteMonster && (
              <div className="bg-purple-900/30 rounded-lg p-4 border border-purple-600">
                <p className="text-gray-400 text-sm">{t.favoriteMonster}</p>
                <p className="text-white font-bold text-xl capitalize">{persistentData.favoriteMonster.replace(/_/g, ' ')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
