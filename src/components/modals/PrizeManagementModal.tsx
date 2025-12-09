'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Gift, AlertCircle } from 'lucide-react';
import { Prize, PrizeRarity, RARITY_CONFIG, DEFAULT_DROP_RATES } from '@/types';
import { getRoutePrizes, createPrize, updatePrize, deletePrize } from '@/lib/db';

interface PrizeManagementModalProps {
  routeId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  locale?: 'he' | 'en';
}

const translations = {
  he: {
    title: 'ניהול פרסים',
    addPrize: 'הוסף פרס',
    editPrize: 'ערוך פרס',
    noPrizes: 'אין פרסים',
    addFirstPrize: 'הוסף את הפרס הראשון למסלול',
    name: 'שם הפרס',
    nameEn: 'שם באנגלית',
    namePlaceholder: 'למשל: גלידה חינם',
    nameEnPlaceholder: 'e.g., Free Ice Cream',
    rarity: 'נדירות',
    dropRate: 'סיכוי',
    totalAvailable: 'כמות במלאי',
    claimed: 'חולקו',
    remaining: 'נותרו',
    active: 'פעיל',
    save: 'שמור',
    cancel: 'ביטול',
    delete: 'מחק',
    deleteConfirm: 'האם למחוק את הפרס?',
    dropRateSum: 'סה"כ סיכויים',
    dropRateSumError: 'סכום הסיכויים צריך להיות 100%',
    outOfStock: 'אזל',
    common: 'רגיל',
    rare: 'נדיר',
    epic: 'אפי',
    legendary: 'אגדי',
  },
  en: {
    title: 'Prize Management',
    addPrize: 'Add Prize',
    editPrize: 'Edit Prize',
    noPrizes: 'No prizes',
    addFirstPrize: 'Add your first prize to this route',
    name: 'Prize Name',
    nameEn: 'English Name',
    namePlaceholder: 'e.g., Free Ice Cream',
    nameEnPlaceholder: 'e.g., Free Ice Cream',
    rarity: 'Rarity',
    dropRate: 'Drop Rate',
    totalAvailable: 'Total Available',
    claimed: 'Claimed',
    remaining: 'Remaining',
    active: 'Active',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    deleteConfirm: 'Delete this prize?',
    dropRateSum: 'Total Drop Rate',
    dropRateSumError: 'Drop rates must sum to 100%',
    outOfStock: 'Out of Stock',
    common: 'Common',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
  },
};

const rarityOptions: PrizeRarity[] = ['common', 'rare', 'epic', 'legendary'];

interface PrizeFormData {
  name: string;
  nameEn: string;
  rarity: PrizeRarity;
  dropRate: number;
  totalAvailable: number;
  isActive: boolean;
}

const defaultFormData: PrizeFormData = {
  name: '',
  nameEn: '',
  rarity: 'common',
  dropRate: DEFAULT_DROP_RATES.common,
  totalAvailable: 10,
  isActive: true,
};

export default function PrizeManagementModal({
  routeId,
  isOpen,
  onClose,
  onUpdate,
  locale = 'he',
}: PrizeManagementModalProps) {
  const t = translations[locale];
  const isRTL = locale === 'he';

  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  const [formData, setFormData] = useState<PrizeFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Load prizes
  useEffect(() => {
    if (isOpen) {
      loadPrizes();
    }
  }, [isOpen, routeId]);

  const loadPrizes = async () => {
    setLoading(true);
    try {
      const data = await getRoutePrizes(routeId);
      setPrizes(data);
    } catch (error) {
      console.error('Error loading prizes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setEditingPrize(null);
    setFormData(defaultFormData);
    setShowForm(true);
  };

  const handleEdit = (prize: Prize) => {
    setEditingPrize(prize);
    setFormData({
      name: prize.name,
      nameEn: prize.nameEn,
      rarity: prize.rarity,
      dropRate: prize.dropRate,
      totalAvailable: prize.totalAvailable,
      isActive: prize.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    setSaving(true);
    try {
      if (editingPrize) {
        await updatePrize(editingPrize.id, formData);
      } else {
        await createPrize(routeId, formData);
      }
      await loadPrizes();
      onUpdate();
      setShowForm(false);
      setEditingPrize(null);
    } catch (error) {
      console.error('Error saving prize:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (prizeId: string) => {
    try {
      await deletePrize(prizeId);
      await loadPrizes();
      onUpdate();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting prize:', error);
    }
  };

  const handleRarityChange = (rarity: PrizeRarity) => {
    setFormData({
      ...formData,
      rarity,
      dropRate: DEFAULT_DROP_RATES[rarity],
    });
  };

  const totalDropRate = prizes
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + p.dropRate, 0);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className={`
          relative w-full max-w-2xl max-h-[85vh] overflow-hidden
          bg-bg-card border border-border rounded-xl shadow-xl
          flex flex-col
          ${isRTL ? 'text-right' : 'text-left'}
        `}
        dir={isRTL ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Gift className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="text-lg font-bold text-text-primary">{t.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Drop Rate Summary */}
          {prizes.length > 0 && (
            <div className={`
              flex items-center justify-between p-3 rounded-lg
              ${Math.abs(totalDropRate - 100) > 0.1 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-bg-secondary'}
            `}>
              <span className="text-sm text-text-secondary">{t.dropRateSum}</span>
              <span className={`
                font-bold
                ${Math.abs(totalDropRate - 100) > 0.1 ? 'text-yellow-400' : 'text-green-400'}
              `}>
                {totalDropRate}%
              </span>
            </div>
          )}

          {/* Prize List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : prizes.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <Gift className="w-12 h-12 mx-auto text-text-secondary opacity-50" />
              <p className="text-text-secondary">{t.noPrizes}</p>
              <p className="text-sm text-text-secondary opacity-70">{t.addFirstPrize}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {prizes.map((prize) => (
                <div
                  key={prize.id}
                  className={`
                    p-3 rounded-lg border transition-colors
                    ${prize.isActive ? 'bg-bg-secondary border-border' : 'bg-bg-tertiary border-transparent opacity-60'}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{RARITY_CONFIG[prize.rarity].emoji}</span>
                      <div>
                        <p className="font-medium text-text-primary">{prize.name}</p>
                        <div className="flex items-center gap-2 text-xs text-text-secondary">
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: RARITY_CONFIG[prize.rarity].bgColor,
                              color: RARITY_CONFIG[prize.rarity].color,
                            }}
                          >
                            {t[prize.rarity as keyof typeof t]}
                          </span>
                          <span>{prize.dropRate}%</span>
                          <span>•</span>
                          <span>
                            {prize.claimed}/{prize.totalAvailable}
                            {prize.claimed >= prize.totalAvailable && (
                              <span className="text-red-400 ms-1">({t.outOfStock})</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(prize)}
                        className="p-2 rounded-lg hover:bg-bg-tertiary transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-text-secondary" />
                      </button>
                      {deleteConfirm === prize.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(prize.id)}
                            className="px-2 py-1 text-xs bg-red-500 text-white rounded"
                          >
                            {t.delete}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-bg-tertiary text-text-secondary rounded"
                          >
                            {t.cancel}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(prize.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Prize Button */}
          {!showForm && (
            <button
              onClick={handleAddNew}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-border hover:border-purple-500 hover:bg-purple-500/5 transition-colors"
            >
              <Plus className="w-5 h-5 text-purple-400" />
              <span className="font-medium text-purple-400">{t.addPrize}</span>
            </button>
          )}

          {/* Prize Form */}
          {showForm && (
            <div className="p-4 rounded-xl bg-bg-secondary border border-border space-y-4">
              <h3 className="font-medium text-text-primary">
                {editingPrize ? t.editPrize : t.addPrize}
              </h3>

              {/* Name */}
              <div className="space-y-2">
                <label className="block text-sm text-text-secondary">{t.name}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t.namePlaceholder}
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border focus:outline-none focus:ring-2 focus:ring-purple-500 text-text-primary"
                />
              </div>

              {/* English Name */}
              <div className="space-y-2">
                <label className="block text-sm text-text-secondary">{t.nameEn}</label>
                <input
                  type="text"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                  placeholder={t.nameEnPlaceholder}
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border focus:outline-none focus:ring-2 focus:ring-purple-500 text-text-primary"
                  dir="ltr"
                />
              </div>

              {/* Rarity */}
              <div className="space-y-2">
                <label className="block text-sm text-text-secondary">{t.rarity}</label>
                <div className="grid grid-cols-4 gap-2">
                  {rarityOptions.map((rarity) => (
                    <button
                      key={rarity}
                      type="button"
                      onClick={() => handleRarityChange(rarity)}
                      className={`
                        p-2 rounded-lg border-2 transition-all text-center
                        ${formData.rarity === rarity
                          ? 'border-purple-500 bg-purple-500/10'
                          : 'border-border hover:border-purple-500/50'
                        }
                      `}
                    >
                      <span className="text-lg">{RARITY_CONFIG[rarity].emoji}</span>
                      <p className="text-xs text-text-secondary mt-1">
                        {t[rarity as keyof typeof t]}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drop Rate & Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm text-text-secondary">{t.dropRate} (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.dropRate}
                    onChange={(e) => setFormData({ ...formData, dropRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border focus:outline-none focus:ring-2 focus:ring-purple-500 text-text-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm text-text-secondary">{t.totalAvailable}</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.totalAvailable}
                    onChange={(e) => setFormData({ ...formData, totalAvailable: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-border focus:outline-none focus:ring-2 focus:ring-purple-500 text-text-primary"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary">
                <span className="text-sm text-text-primary">{t.active}</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`
                    relative w-10 h-5 rounded-full transition-colors cursor-pointer
                    ${formData.isActive ? 'bg-green-500' : 'bg-bg-secondary'}
                  `}
                >
                  <div
                    className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200
                      ${formData.isActive ? (isRTL ? 'left-0.5' : 'right-0.5') : (isRTL ? 'right-0.5' : 'left-0.5')}
                    `}
                  />
                </button>
              </div>

              {/* Form Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingPrize(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.name.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : t.save}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
