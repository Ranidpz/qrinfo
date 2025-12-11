'use client';

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

const STORAGE_KEY = 'analytics-section-order';

interface GridSection {
  id: string;
  component: ReactNode;
  title: string;
  visible: boolean;
}

interface AnalyticsGridLayoutProps {
  sections: GridSection[];
  onResetLayout?: () => void;
}

export default function AnalyticsGridLayout({ sections, onResetLayout }: AnalyticsGridLayoutProps) {
  const t = useTranslations('analytics');
  const [order, setOrder] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Initialize order from sections or localStorage
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedOrder = JSON.parse(saved) as string[];
        // Validate that all section IDs exist
        const sectionIds = new Set(sections.map(s => s.id));
        const isValid = savedOrder.every(id => sectionIds.has(id));
        if (isValid && savedOrder.length === sections.length) {
          setOrder(savedOrder);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load saved order:', e);
    }
    // Default order from sections
    setOrder(sections.map(s => s.id));
  }, [sections]);

  // Save order to localStorage
  const saveOrder = useCallback((newOrder: string[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
    } catch (e) {
      console.error('Failed to save order:', e);
    }
  }, []);

  // Reset to default order
  const handleResetLayout = useCallback(() => {
    const defaultOrder = sections.map(s => s.id);
    localStorage.removeItem(STORAGE_KEY);
    setOrder(defaultOrder);
    onResetLayout?.();
  }, [sections, onResetLayout]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const newOrder = [...order];
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);

    // Remove dragged item and insert at target position
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    setOrder(newOrder);
    saveOrder(newOrder);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Get sections in order, filtered by visibility
  const orderedSections = order
    .map(id => sections.find(s => s.id === id))
    .filter((s): s is GridSection => s !== undefined && s.visible);

  if (!mounted) {
    return (
      <div className="space-y-4">
        {sections.filter(s => s.visible).map(section => (
          <div key={section.id} className="card p-6 min-h-[200px] flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-bg-secondary rounded-lg" />
              <div className="w-24 h-4 bg-bg-secondary rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reset Layout Button */}
      <div className="flex justify-end">
        <button
          onClick={handleResetLayout}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
          title={t('resetLayout')}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="hidden sm:inline">{t('resetLayout')}</span>
        </button>
      </div>

      {/* Sections */}
      {orderedSections.map(section => (
        <div
          key={section.id}
          draggable
          onDragStart={(e) => handleDragStart(e, section.id)}
          onDragOver={(e) => handleDragOver(e, section.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, section.id)}
          onDragEnd={handleDragEnd}
          className={`card p-4 sm:p-6 relative group transition-all ${
            draggedId === section.id ? 'opacity-50 scale-[0.98]' : ''
          } ${
            dragOverId === section.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg-primary' : ''
          }`}
        >
          {/* Drag Handle */}
          <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-1.5 rounded-lg bg-bg-secondary/80 backdrop-blur-sm hover:bg-bg-hover cursor-grab active:cursor-grabbing transition-colors">
              <GripVertical className="w-4 h-4 text-text-secondary" />
            </div>
          </div>

          {/* Content */}
          <div className="min-h-[200px]">
            {section.component}
          </div>
        </div>
      ))}
    </div>
  );
}
