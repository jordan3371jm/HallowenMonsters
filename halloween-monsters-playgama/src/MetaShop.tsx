import { MetaUpgrade, PersistentData } from './types';
import { canPurchaseUpgrade, getUpgradeCost } from './metaShop';
import { Language, t } from './i18n';
import { upgradeTranslations } from './upgradeTranslations';
import { CoinIcon, TombstoneIcon, FilmIcon } from './components/UIIcons';

interface MetaShopProps {
  persistentData: PersistentData;
  lang: Language;
  onPurchase: (upgradeId: string) => void;
  onBack: () => void;
  onWatchAdForCoins: () => void;
  adCoinsLeft: number;
  adCoinsReward: number;
}

const categoryNames: Record<string, { nameKey: string; emoji: string }> = {
  potion: { nameKey: 'metashop.category_potion', emoji: '🧪' },
  capture: { nameKey: 'metashop.category_capture', emoji: '🎃' },
  exp: { nameKey: 'metashop.category_exp', emoji: '📈' },
  item: { nameKey: 'metashop.category_item', emoji: '🎒' },
  cosmetic: { nameKey: 'metashop.category_cosmetic', emoji: '🎨' },
};

export default function MetaShop({ persistentData, lang, onPurchase, onBack, onWatchAdForCoins, adCoinsLeft, adCoinsReward }: MetaShopProps) {
  const categories = Object.keys(categoryNames);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-950 via-gray-900 to-black p-3 md:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-black/60 rounded-xl p-4 md:p-6 border-2 border-purple-600 mb-4">
          <div className="flex justify-between items-center mb-4 gap-2">
            <h1 className="text-2xl md:text-3xl font-bold text-purple-400 flex items-center gap-2">
              <TombstoneIcon size={30} /> {t('metashop.title', lang)}
            </h1>
            <button
              onClick={onBack}
              className="px-4 py-2 min-h-[44px] bg-gray-700 text-white rounded-lg hover:bg-gray-600 active:scale-95 transition-all text-sm md:text-base touch-manipulation"
            >
              ← {t('metashop.back', lang)}
            </button>
          </div>
          
          <div className="flex justify-between items-center bg-purple-900/50 rounded-lg p-3 gap-2 flex-wrap">
            <div className="text-yellow-400 font-bold text-lg md:text-xl flex items-center gap-2">
              <CoinIcon size={26} /> {persistentData.cursedCoins} {t('metashop.cursed_coins', lang)}
            </div>
            <button
              onClick={onWatchAdForCoins}
              disabled={adCoinsLeft <= 0}
              className="px-4 py-2 min-h-[44px] bg-gradient-to-r from-yellow-600 to-amber-600 text-white font-bold rounded-lg border-2 border-yellow-400 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-sm md:text-base inline-flex items-center gap-2 touch-manipulation"
              title={adCoinsLeft <= 0 ? t('ad.coins_limit', lang) : undefined}
            >
              <FilmIcon size={22} /> {t('title.free_coins', lang)} +{adCoinsReward} ({adCoinsLeft > 0 ? `${adCoinsLeft} ${t('ad.coins_left', lang)}` : t('ad.coins_limit', lang)})
            </button>
          </div>
          <div className="text-gray-400 text-xs md:text-sm mt-2 text-right">
            {t('metashop.total_runs', lang)}: {persistentData.totalRuns} | {t('metashop.best_wave', lang)}: {persistentData.bestWave}
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-6">
          {categories.map(category => {
            const upgrades = persistentData.upgrades.filter(u => u.category === category);
            if (upgrades.length === 0) return null;

            return (
              <div key={category} className="bg-black/60 rounded-xl p-4 border border-purple-800">
                <h2 className="text-xl font-bold text-orange-400 mb-4">
                  <span className="emoji">{categoryNames[category].emoji}</span> {t(categoryNames[category].nameKey, lang)}
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {upgrades.map(upgrade => {
                    const canBuy = canPurchaseUpgrade(upgrade, persistentData.upgrades, persistentData.cursedCoins);
                    const requiresMet = !upgrade.requires || persistentData.upgrades.find(u => u.id === upgrade.requires)?.purchased;
                    const currentCost = getUpgradeCost(upgrade);
                    const isMaxLevel = upgrade.maxLevel && upgrade.currentLevel && upgrade.currentLevel >= upgrade.maxLevel;
                    const isPurchased = !upgrade.maxLevel && upgrade.purchased;
                    
                    return (
                      <button
                        key={upgrade.id}
                        onClick={() => canBuy && onPurchase(upgrade.id)}
                        disabled={!canBuy}
                        className={`p-3 rounded-lg text-left transition-all border-2 ${
                          isMaxLevel || isPurchased
                            ? 'bg-green-900/30 border-green-600 opacity-70'
                            : canBuy
                            ? 'bg-purple-900/50 border-purple-600 hover:bg-purple-800/50 hover:scale-105'
                            : 'bg-gray-900/50 border-gray-700 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-2xl emoji">{upgrade.emoji}</span>
                          {isMaxLevel ? (
                            <span className="text-green-400 text-xs font-bold">✓ {t('ui.max', lang)}</span>
                          ) : isPurchased ? (
                            <span className="text-green-400 text-xs font-bold">✓ {t('ui.purchased', lang)}</span>
                          ) : upgrade.maxLevel ? (
                            <span className="text-yellow-400 text-sm font-bold inline-flex items-center gap-1"><CoinIcon size={16} /> {currentCost} ({upgrade.currentLevel || 0}/{upgrade.maxLevel})</span>
                          ) : (
                            <span className="text-yellow-400 text-sm font-bold inline-flex items-center gap-1"><CoinIcon size={16} /> {currentCost}</span>
                          )}
                        </div>
                        
                        <h3 className="text-white font-bold text-sm md:text-base mb-1">
                          {upgradeTranslations[lang]?.[upgrade.id]?.name || upgradeTranslations.en?.[upgrade.id]?.name || upgrade.id.replace(/_/g, ' ')}
                        </h3>
                        
                        <p className="text-gray-300 text-xs md:text-sm mb-2">
                          {upgradeTranslations[lang]?.[upgrade.id]?.description || upgradeTranslations.en?.[upgrade.id]?.description || upgrade.id.replace(/_/g, ' ')}
                        </p>
                        
                        {!requiresMet && upgrade.requires && (
                          <p className="text-red-400 text-xs">
                            ⚠️ {t('metashop.requires', lang)}: {upgradeTranslations[lang]?.[upgrade.requires]?.name || upgradeTranslations.en?.[upgrade.requires]?.name || upgrade.requires.replace(/_/g, ' ')}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
