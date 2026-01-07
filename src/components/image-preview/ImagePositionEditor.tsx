'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Move, ZoomIn, ZoomOut, RotateCcw, Check, X, Smartphone, Tablet, Monitor } from 'lucide-react';
import { ImagePositionConfig, DEFAULT_IMAGE_POSITION } from '@/types/qvote';

// Device configurations for preview
const DEVICE_CONFIGS = {
  mobile: {
    name: { he: 'מובייל', en: 'Mobile' },
    icon: Smartphone,
    aspectRatio: 9 / 16,
    width: 375,
    height: 667,
  },
  tablet: {
    name: { he: 'טאבלט', en: 'Tablet' },
    icon: Tablet,
    aspectRatio: 3 / 4,
    width: 768,
    height: 1024,
  },
  desktop: {
    name: { he: 'דסקטופ', en: 'Desktop' },
    icon: Monitor,
    aspectRatio: 16 / 9,
    width: 1920,
    height: 1080,
  },
} as const;

type DeviceType = keyof typeof DEVICE_CONFIGS;

interface ImagePositionEditorProps {
  imageUrl: string;
  position?: ImagePositionConfig;
  onPositionChange: (position: ImagePositionConfig) => void;
  onSave: () => void;
  onCancel: () => void;
  locale?: 'he' | 'en';
  showSafeZone?: boolean;
  defaultDevice?: DeviceType;
}

export default function ImagePositionEditor({
  imageUrl,
  position = DEFAULT_IMAGE_POSITION,
  onPositionChange,
  onSave,
  onCancel,
  locale = 'he',
  showSafeZone = true,
  defaultDevice = 'mobile',
}: ImagePositionEditorProps) {
  const isRTL = locale === 'he';

  // State
  const [mode, setMode] = useState<'natural' | 'custom'>(position.mode || 'natural');
  const [x, setX] = useState(position.x || 0);
  const [y, setY] = useState(position.y || 0);
  const [zoom, setZoom] = useState(position.zoom || 1);
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>(defaultDevice);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastPinchDistanceRef = useRef<number | null>(null);

  // Update parent when values change
  useEffect(() => {
    if (mode === 'natural') {
      onPositionChange({ mode: 'natural' });
    } else {
      onPositionChange({ mode: 'custom', x, y, zoom });
    }
  }, [mode, x, y, zoom, onPositionChange]);

  // Clamp value between min and max
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

  // Handle mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode === 'natural') return;
    e.preventDefault();
    setIsDragging(true);
    lastTouchRef.current = { x: e.clientX, y: e.clientY };
  }, [mode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || mode === 'natural' || !lastTouchRef.current) return;

    const deltaX = e.clientX - lastTouchRef.current.x;
    const deltaY = e.clientY - lastTouchRef.current.y;

    // Convert pixel movement to percentage (scaled by zoom)
    const sensitivity = 0.5 / zoom;
    setX(prev => clamp(prev + deltaX * sensitivity, -100, 100));
    setY(prev => clamp(prev + deltaY * sensitivity, -100, 100));

    lastTouchRef.current = { x: e.clientX, y: e.clientY };
  }, [isDragging, mode, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    lastTouchRef.current = null;
  }, []);

  // Handle touch drag
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (mode === 'natural') return;

    if (e.touches.length === 1) {
      // Single touch - drag
      setIsDragging(true);
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      // Two touches - pinch to zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastPinchDistanceRef.current = distance;
    }
  }, [mode]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (mode === 'natural') return;
    e.preventDefault();

    if (e.touches.length === 1 && lastTouchRef.current) {
      // Single touch - drag
      const deltaX = e.touches[0].clientX - lastTouchRef.current.x;
      const deltaY = e.touches[0].clientY - lastTouchRef.current.y;

      const sensitivity = 0.5 / zoom;
      setX(prev => clamp(prev + deltaX * sensitivity, -100, 100));
      setY(prev => clamp(prev + deltaY * sensitivity, -100, 100));

      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && lastPinchDistanceRef.current !== null) {
      // Two touches - pinch to zoom
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      const delta = distance - lastPinchDistanceRef.current;
      const zoomDelta = delta * 0.005;
      setZoom(prev => clamp(prev + zoomDelta, 0.5, 2));

      lastPinchDistanceRef.current = distance;
    }
  }, [mode, zoom]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchRef.current = null;
    lastPinchDistanceRef.current = null;
  }, []);

  // Handle scroll for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (mode === 'natural') return;
    e.preventDefault();

    const delta = -e.deltaY * 0.001;
    setZoom(prev => clamp(prev + delta, 0.5, 2));
  }, [mode]);

  // Reset position
  const handleReset = useCallback(() => {
    setX(0);
    setY(0);
    setZoom(1);
  }, []);

  // Switch to custom mode
  const handleSwitchToCustom = useCallback(() => {
    setMode('custom');
  }, []);

  // Switch to natural mode
  const handleSwitchToNatural = useCallback(() => {
    setMode('natural');
    setX(0);
    setY(0);
    setZoom(1);
  }, []);

  // Calculate object-position CSS value
  const getObjectPosition = () => {
    if (mode === 'natural') return 'center center';
    return `${50 + x}% ${50 + y}%`;
  };

  // Calculate transform for zoom
  const getTransform = () => {
    if (mode === 'natural') return 'none';
    return `scale(${zoom})`;
  };

  // Labels
  const labels = {
    title: isRTL ? 'התאמת מיקום תמונה' : 'Adjust Image Position',
    natural: isRTL ? 'טבעי' : 'Natural',
    custom: isRTL ? 'מותאם' : 'Custom',
    drag: isRTL ? 'גרור להזיז' : 'Drag to move',
    pinch: isRTL ? 'צבוט לזום' : 'Pinch to zoom',
    zoom: isRTL ? 'זום' : 'Zoom',
    reset: isRTL ? 'איפוס' : 'Reset',
    save: isRTL ? 'שמור' : 'Save',
    cancel: isRTL ? 'ביטול' : 'Cancel',
    safeZone: isRTL ? 'אזור בטוח' : 'Safe Zone',
  };

  const device = DEVICE_CONFIGS[selectedDevice];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {labels.title}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handleSwitchToNatural}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              mode === 'natural'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {labels.natural}
          </button>
          <button
            onClick={handleSwitchToCustom}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              mode === 'custom'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {labels.custom}
          </button>
        </div>

        {/* Device Selector */}
        <div className="flex items-center justify-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          {(Object.keys(DEVICE_CONFIGS) as DeviceType[]).map((deviceKey) => {
            const deviceConfig = DEVICE_CONFIGS[deviceKey];
            const Icon = deviceConfig.icon;
            return (
              <button
                key={deviceKey}
                onClick={() => setSelectedDevice(deviceKey)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  selectedDevice === deviceKey
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{deviceConfig.name[locale]}</span>
              </button>
            );
          })}
        </div>

        {/* Preview Area */}
        <div className="relative flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800">
          <div
            ref={containerRef}
            className={`relative overflow-hidden bg-black rounded-lg shadow-lg ${
              mode === 'custom' ? 'cursor-move' : 'cursor-default'
            }`}
            style={{
              aspectRatio: device.aspectRatio,
              maxHeight: '400px',
              width: 'auto',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            {/* Image */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-75"
              style={{
                objectPosition: getObjectPosition(),
                transform: getTransform(),
              }}
              onLoad={() => setImageLoaded(true)}
              draggable={false}
            />

            {/* Safe Zone Overlay */}
            {showSafeZone && mode === 'custom' && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Dark overlay on unsafe areas */}
                <div className="absolute inset-0 border-[20px] sm:border-[40px] border-black/30" />

                {/* Safe zone border */}
                <div
                  className="absolute border-2 border-dashed border-green-400"
                  style={{
                    top: '15%',
                    left: '10%',
                    right: '10%',
                    bottom: '20%',
                  }}
                >
                  {/* Corner marks */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-green-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-green-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-green-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-green-400" />

                  {/* Label */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-green-500/80 text-white text-xs rounded">
                    {labels.safeZone}
                  </div>
                </div>
              </div>
            )}

            {/* Drag hint */}
            {mode === 'custom' && !isDragging && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-black/70 text-white text-xs rounded-full">
                <Move className="w-3.5 h-3.5" />
                <span>{labels.drag}</span>
              </div>
            )}
          </div>
        </div>

        {/* Zoom Control (only in custom mode) */}
        {mode === 'custom' && (
          <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <ZoomOut className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <ZoomIn className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500 w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleReset}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title={labels.reset}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Position Info (only in custom mode) */}
        {mode === 'custom' && (
          <div className="flex items-center justify-center gap-4 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            <span>X: {x > 0 ? '+' : ''}{x.toFixed(0)}%</span>
            <span>Y: {y > 0 ? '+' : ''}{y.toFixed(0)}%</span>
            <span>{labels.zoom}: {(zoom * 100).toFixed(0)}%</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {labels.cancel}
          </button>
          <button
            onClick={onSave}
            className="flex-1 py-2.5 px-4 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}
