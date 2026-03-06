'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { QGamesInventoryItem, QGamesPrizeType, RARITY_CONFIG, QGamesPrizeRarity } from '@/types/qgames';
import { useQGamesTheme } from './QGamesThemeContext';

interface QGamesInventoryProps {
  inventory: QGamesInventoryItem[];
  equippedTitle: string | null;
  equippedBorder: string | null;
  equippedCelebration: string | null;
  onEquip: (prizeId: string, type: QGamesPrizeType) => Promise<void>;
  onClose: () => void;
  isRTL: boolean;
  locale: 'he' | 'en';
}

type TabType = 'avatar_border' | 'title' | 'celebration';

const TABS: { key: TabType; emoji: string; labelEn: string; labelHe: string }[] = [
  { key: 'avatar_border', emoji: '💍', labelEn: 'Borders', labelHe: 'מסגרות' },
  { key: 'title', emoji: '🏷️', labelEn: 'Titles', labelHe: 'תארים' },
  { key: 'celebration', emoji: '🎉', labelEn: 'Celebrations', labelHe: 'חגיגות' },
];

/** Rarity sort order (legendary first) */
const RARITY_ORDER: Record<QGamesPrizeRarity, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};

export default function QGamesInventory({
  inventory,
  equippedTitle,
  equippedBorder,
  equippedCelebration,
  onEquip,
  onClose,
  isRTL,
  locale,
}: QGamesInventoryProps) {
  const theme = useQGamesTheme();
  const [activeTab, setActiveTab] = useState<TabType>('avatar_border');
  const [equipping, setEquipping] = useState<string | null>(null);

  const isHe = locale === 'he';

  const getEquippedId = (type: QGamesPrizeType): string | null => {
    if (type === 'title') return equippedTitle;
    if (type === 'avatar_border') return equippedBorder;
    return equippedCelebration;
  };

  const filteredItems = inventory
    .filter(item => item.type === activeTab)
    .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity]);

  // Count unique items per type
  const typeCounts = {
    avatar_border: new Set(inventory.filter(i => i.type === 'avatar_border').map(i => i.prizeId)).size,
    title: new Set(inventory.filter(i => i.type === 'title').map(i => i.prizeId)).size,
    celebration: new Set(inventory.filter(i => i.type === 'celebration').map(i => i.prizeId)).size,
  };

  // Deduplicate items (show count if multiples)
  const deduped = filteredItems.reduce<(QGamesInventoryItem & { count: number })[]>((acc, item) => {
    const existing = acc.find(i => i.prizeId === item.prizeId);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ ...item, count: 1 });
    }
    return acc;
  }, []);

  const handleEquip = async (item: QGamesInventoryItem) => {
    const currentEquipped = getEquippedId(item.type);
    const newId = currentEquipped === item.prizeId ? '' : item.prizeId;
    setEquipping(item.prizeId);
    try {
      await onEquip(newId, item.type);
    } finally {
      setEquipping(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl relative animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 max-h-[80vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: theme.backgroundColor }}
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-lg font-bold" style={{ color: theme.textColor }}>
            {isHe ? '🎒 האוסף שלי' : '🎒 My Collection'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3">
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const count = typeCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  backgroundColor: isActive ? `${theme.accentColor}20` : 'rgba(255,255,255,0.04)',
                  color: isActive ? theme.accentColor : 'rgba(255,255,255,0.4)',
                  ...(isActive ? { boxShadow: `0 0 0 1px ${theme.accentColor}40` } : {}),
                }}
              >
                <span>{tab.emoji}</span>
                <span>{isHe ? tab.labelHe : tab.labelEn}</span>
                {count > 0 && (
                  <span className="text-[10px] opacity-60">({count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-4 pb-6 sm:pb-4 space-y-2" style={{ scrollbarWidth: 'none' }}>
          {deduped.length === 0 && (
            <div className="text-center py-12">
              <p className="text-3xl mb-2">📦</p>
              <p className="text-sm" style={{ color: theme.textSecondary }}>
                {isHe ? 'עדיין אין פריטים מסוג זה' : 'No items of this type yet'}
              </p>
              <p className="text-xs mt-1" style={{ color: theme.textSecondary, opacity: 0.5 }}>
                {isHe ? 'שחקו עוד כדי לפתוח חבילות!' : 'Play more to earn packs!'}
              </p>
            </div>
          )}

          {deduped.map(item => {
            const rarityConfig = RARITY_CONFIG[item.rarity];
            const isEquipped = getEquippedId(item.type) === item.prizeId;
            const isLoading = equipping === item.prizeId;
            const itemName = isHe ? item.nameHe : item.nameEn;

            return (
              <button
                key={item.prizeId}
                onClick={() => handleEquip(item)}
                disabled={isLoading}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: isEquipped ? `${rarityConfig.color}1a` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isEquipped ? `${rarityConfig.color}4d` : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {/* Rarity indicator */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${rarityConfig.color}20` }}
                >
                  {item.type === 'avatar_border' ? (
                    <div
                      className="w-7 h-7 rounded-full"
                      style={{
                        border: `3px solid ${item.value.startsWith('linear') ? rarityConfig.color : item.value}`,
                        background: item.value.startsWith('linear') ? 'none' : 'none',
                        borderImage: item.value.startsWith('linear') ? `${item.value} 1` : 'none',
                      }}
                    />
                  ) : item.type === 'title' ? (
                    <span className="text-lg">🏷️</span>
                  ) : (
                    <span className="text-lg">✨</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-start">
                  <p className="font-semibold text-sm truncate" style={{ color: theme.textColor }}>
                    {item.isCustomPrize ? '🎁 ' : ''}{itemName}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">{rarityConfig.emoji}</span>
                    <span className="text-[10px] font-medium" style={{ color: rarityConfig.color }}>
                      {isHe ? rarityConfig.nameHe : rarityConfig.nameEn}
                    </span>
                    {item.count > 1 && (
                      <span className="text-[10px] text-white/30">×{item.count}</span>
                    )}
                  </div>
                </div>

                {/* Equip status */}
                <div className="shrink-0">
                  {isLoading ? (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />
                    </div>
                  ) : isEquipped ? (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${rarityConfig.color}30` }}
                    >
                      <Check className="w-4 h-4" style={{ color: rarityConfig.color }} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5">
                      <span className="text-[10px] text-white/30">{isHe ? 'צייד' : 'Use'}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
