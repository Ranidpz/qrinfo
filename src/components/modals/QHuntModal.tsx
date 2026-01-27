'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Loader2, Plus, Trash2, Palette, Settings, Target, Users, Crosshair,
  Monitor, Copy, Check, ImageIcon, Upload, Timer, Play, Square, RotateCcw,
  ExternalLink, Smartphone, Download, Printer, QrCode, UserCheck, Trophy
} from 'lucide-react';
import QRCode from 'qrcode';
import { useTranslations, useLocale } from 'next-intl';
import {
  QHuntConfig,
  QHuntCode,
  QHuntTeam,
  QHuntPhase,
  DEFAULT_QHUNT_CONFIG,
  CODE_TYPE_CONFIG,
} from '@/types/qhunt';

interface QHuntModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: QHuntConfig, backgroundFile?: File) => Promise<void>;
  onPhaseChange?: (phase: QHuntPhase) => Promise<void>;
  onReset?: () => Promise<void>;
  loading?: boolean;
  initialConfig?: QHuntConfig;
  shortId?: string;
  codeId?: string;
  currentPhase?: QHuntPhase;
}

interface QHuntPlayerDisplay {
  id: string;
  name: string;
  avatarType: string;
  avatarValue: string;
  currentScore: number;
  scansCount: number;
  registeredAt: number;
  teamId?: string;
  gameStartedAt?: number;
  gameEndedAt?: number;
  isFinished?: boolean;
}

// Format game duration to mm:ss
function formatGameTime(ms: number): string {
  if (!ms || ms <= 0) return '--:--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Modern Toggle Switch Component - RTL compatible
const ToggleSwitch = ({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    dir="ltr"
    className={`
      relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full
      transition-all duration-300 ease-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
      disabled:cursor-not-allowed disabled:opacity-50
      ${checked
        ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
        : 'bg-gray-600/80 hover:bg-gray-500/80'
      }
    `}
  >
    <span
      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-all duration-300 ease-out absolute top-1"
      style={{
        left: checked ? '26px' : '4px',
        boxShadow: checked
          ? '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)'
          : '0 2px 4px rgba(0,0,0,0.2)'
      }}
    />
  </button>
);

// Preset colors for neon hunter theme
const presetColors = {
  background: ['#0a0f1a', '#0d1321', '#1a1a2e', '#16213e', '#0f172a', '#1e293b'],
  primary: ['#3b82f6', '#00d4ff', '#8b5cf6', '#ff00aa', '#f59e0b', '#00ff88'],
  success: ['#00ff88', '#22c55e', '#10b981', '#4ade80'],
  warning: ['#ffaa00', '#f59e0b', '#fbbf24', '#facc15'],
};

export default function QHuntModal({
  isOpen,
  onClose,
  onSave,
  onPhaseChange,
  onReset,
  loading = false,
  initialConfig,
  shortId,
  codeId,
  currentPhase = 'registration',
}: QHuntModalProps) {
  const t = useTranslations('modals');
  const locale = useLocale();
  const isRTL = locale === 'he';

  // Tab state
  const [activeTab, setActiveTab] = useState<'participants' | 'general' | 'codes' | 'teams' | 'branding' | 'advanced'>('participants');

  // Participants state
  const [players, setPlayers] = useState<QHuntPlayerDisplay[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Single code modal state
  const [selectedCode, setSelectedCode] = useState<QHuntCode | null>(null);
  const [selectedCodeQR, setSelectedCodeQR] = useState<string | null>(null);

  // Config state - merge initialConfig with defaults to ensure all fields exist
  const [config, setConfig] = useState<QHuntConfig>(() => ({
    ...DEFAULT_QHUNT_CONFIG,
    ...(initialConfig || {}),
    // Ensure currentPhase is always set
    currentPhase: initialConfig?.currentPhase || DEFAULT_QHUNT_CONFIG.currentPhase,
  }));

  // Background file state
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Copy state
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Dirty state tracking - to enable/disable save button
  const originalConfigRef = useRef<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize from initialConfig - merge with defaults to ensure all fields exist
  useEffect(() => {
    if (initialConfig) {
      setConfig({
        ...DEFAULT_QHUNT_CONFIG,
        ...initialConfig,
        currentPhase: initialConfig.currentPhase || DEFAULT_QHUNT_CONFIG.currentPhase,
      });
      if (initialConfig.branding?.backgroundImage) {
        setBackgroundPreview(initialConfig.branding.backgroundImage);
      }
      if (initialConfig.branding?.eventLogo) {
        setLogoPreview(initialConfig.branding.eventLogo);
      }
    }
  }, [initialConfig]);

  // Fetch players when modal opens
  const fetchPlayers = async () => {
    if (!codeId) return;

    setLoadingPlayers(true);
    try {
      const response = await fetch(`/api/qhunt/players?codeId=${codeId}`);
      const data = await response.json();
      if (data.success && data.players) {
        setPlayers(data.players);
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    } finally {
      setLoadingPlayers(false);
    }
  };

  useEffect(() => {
    if (isOpen && codeId) {
      fetchPlayers();
    }
  }, [isOpen, codeId]);

  // Store original config when modal opens to track dirty state
  useEffect(() => {
    if (isOpen && initialConfig) {
      originalConfigRef.current = JSON.stringify(initialConfig);
      setIsDirty(false);
    }
  }, [isOpen, initialConfig]);

  // Track dirty state when config changes
  useEffect(() => {
    if (originalConfigRef.current) {
      const currentConfigStr = JSON.stringify(config);
      setIsDirty(currentConfigStr !== originalConfigRef.current || backgroundFile !== null || logoFile !== null);
    }
  }, [config, backgroundFile, logoFile]);

  // Auto-refresh players every 5 seconds when on participants tab
  useEffect(() => {
    if (!isOpen || !codeId || activeTab !== 'participants') return;

    const intervalId = setInterval(() => {
      // Silent refresh - don't show loading state
      fetch(`/api/qhunt/players?codeId=${codeId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.players) {
            setPlayers(data.players);
          }
        })
        .catch(() => {}); // Ignore errors in auto-refresh
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isOpen, codeId, activeTab]);

  // Handle reset with loading state
  const handleReset = async () => {
    if (!onReset) return;

    setResetting(true);
    try {
      await onReset();
      // Refresh players list after reset
      await fetchPlayers();
    } catch (error) {
      console.error('Error resetting game:', error);
    } finally {
      setResetting(false);
    }
  };

  // Delete single player state
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [showDeleteAllCodesModal, setShowDeleteAllCodesModal] = useState(false);
  const [deleteAllCodesConfirmText, setDeleteAllCodesConfirmText] = useState('');

  // Reset game confirmation modal
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Handle delete player
  const handleDeletePlayer = async (playerId: string) => {
    if (!codeId || !confirm(isRTL ? 'למחוק את השחקן?' : 'Delete this player?')) return;

    setDeletingPlayerId(playerId);
    try {
      const response = await fetch(`/api/qhunt/players?codeId=${codeId}&playerId=${playerId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        // Remove from local state immediately
        setPlayers(prev => prev.filter(p => p.id !== playerId));
      }
    } catch (error) {
      console.error('Error deleting player:', error);
    } finally {
      setDeletingPlayerId(null);
    }
  };

  // Open single code modal
  const openCodeModal = async (code: QHuntCode) => {
    setSelectedCode(code);
    try {
      // Generate QR code with URL if shortId is available
      const qrContent = shortId
        ? `${window.location.origin}/v/${shortId}?code=${code.codeValue}`
        : code.codeValue;

      const dataUrl = await QRCode.toDataURL(qrContent, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setSelectedCodeQR(dataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // Close single code modal
  const closeCodeModal = () => {
    setSelectedCode(null);
    setSelectedCodeQR(null);
  };

  // Print single code
  const printSingleCode = () => {
    if (!selectedCode || !selectedCodeQR) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const typeConfig = CODE_TYPE_CONFIG[selectedCode.codeType];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <title>${selectedCode.codeValue}</title>
        <style>
          body {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            font-family: system-ui, -apple-system, sans-serif;
            background: #fff;
          }
          .container {
            text-align: center;
            padding: 40px;
          }
          .qr-code {
            width: 250px;
            height: 250px;
            margin-bottom: 20px;
          }
          .code-value {
            font-family: monospace;
            font-size: 32px;
            font-weight: bold;
            color: #000;
            margin-bottom: 10px;
          }
          .code-type {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            background: ${typeConfig?.color || '#3b82f6'}20;
            border: 2px solid ${typeConfig?.color || '#3b82f6'};
            border-radius: 20px;
            font-size: 18px;
            color: ${typeConfig?.color || '#3b82f6'};
          }
          .label {
            margin-top: 15px;
            font-size: 18px;
            color: #666;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <img src="${selectedCodeQR}" class="qr-code" />
          <div class="code-value">${selectedCode.codeValue}</div>
          <div class="code-type">
            ${typeConfig?.emoji || '🎯'} ${isRTL ? typeConfig?.labelHe : typeConfig?.labelEn}
          </div>
          ${selectedCode.label ? `<div class="label">${selectedCode.label}</div>` : ''}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Share single code via WhatsApp
  const shareCodeWhatsApp = () => {
    if (!selectedCode) return;

    const gameUrl = shortId ? `${window.location.origin}/v/${shortId}` : '';
    const typeConfig = CODE_TYPE_CONFIG[selectedCode.codeType];
    const typeName = isRTL ? typeConfig?.labelHe : typeConfig?.labelEn;

    const message = isRTL
      ? `🎯 קוד למשחק QHunt!\n\nקוד: ${selectedCode.codeValue}\nסוג: ${typeConfig?.emoji} ${typeName}\nנקודות: ${selectedCode.points}\n\n${gameUrl ? `🔗 קישור למשחק: ${gameUrl}` : ''}`
      : `🎯 QHunt Code!\n\nCode: ${selectedCode.codeValue}\nType: ${typeConfig?.emoji} ${typeName}\nPoints: ${selectedCode.points}\n\n${gameUrl ? `🔗 Game link: ${gameUrl}` : ''}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Update config helpers
  const updateConfig = <K extends keyof QHuntConfig>(key: K, value: QHuntConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateBranding = <K extends keyof QHuntConfig['branding']>(key: K, value: QHuntConfig['branding'][K]) => {
    setConfig(prev => ({
      ...prev,
      branding: { ...prev.branding, [key]: value },
    }));
  };

  // Code management
  const addCode = () => {
    const availableTypes = Object.keys(CODE_TYPE_CONFIG) as Array<keyof typeof CODE_TYPE_CONFIG>;
    const typeIndex = config.codes.length % availableTypes.length;
    const newCode: QHuntCode = {
      id: `code_${Date.now()}`,
      codeValue: generateCodeValue(),
      codeType: availableTypes[typeIndex],
      points: 10,
      label: '',
      isActive: true,
      createdAt: Date.now(),
    };
    updateConfig('codes', [...config.codes, newCode]);
  };

  // Add multiple codes at once - distribute evenly across types
  const addMultipleCodes = (count: number) => {
    const availableTypes = config.availableCodeTypes.length > 0
      ? config.availableCodeTypes
      : Object.keys(CODE_TYPE_CONFIG) as Array<keyof typeof CODE_TYPE_CONFIG>;

    // Count existing codes by type
    const typeCounts: Record<string, number> = {};
    availableTypes.forEach(type => {
      typeCounts[type] = config.codes.filter(c => c.codeType === type && c.isActive).length;
    });

    const newCodes: QHuntCode[] = [];

    for (let i = 0; i < count; i++) {
      // Find the type with the least codes
      let minType = availableTypes[0];
      let minCount = typeCounts[minType];
      for (const type of availableTypes) {
        if (typeCounts[type] < minCount) {
          minCount = typeCounts[type];
          minType = type;
        }
      }

      // Add code of this type
      newCodes.push({
        id: `code_${Date.now()}_${i}`,
        codeValue: generateCodeValue(),
        codeType: minType,
        points: 10,
        label: '',
        isActive: true,
        createdAt: Date.now() + i,
      });

      // Update the count
      typeCounts[minType]++;
    }

    updateConfig('codes', [...config.codes, ...newCodes]);
  };

  const updateCode = (id: string, updates: Partial<QHuntCode>) => {
    updateConfig('codes', config.codes.map(c =>
      c.id === id ? { ...c, ...updates } : c
    ));
  };

  const removeCode = (id: string) => {
    updateConfig('codes', config.codes.filter(c => c.id !== id));
  };

  // Delete all codes
  const deleteAllCodes = () => {
    updateConfig('codes', []);
    setShowDeleteAllCodesModal(false);
    setDeleteAllCodesConfirmText('');
  };

  // Team management
  const addTeam = () => {
    const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff', '#44ffff'];
    const emojis = ['🔴', '🟢', '🔵', '🟡', '🟣', '🔵'];
    const newTeam: QHuntTeam = {
      id: `team_${Date.now()}`,
      name: isRTL ? `קבוצה ${config.teams.length + 1}` : `Team ${config.teams.length + 1}`,
      color: colors[config.teams.length % colors.length],
      emoji: emojis[config.teams.length % emojis.length],
      order: config.teams.length,
    };
    updateConfig('teams', [...config.teams, newTeam]);
  };

  const updateTeam = (id: string, updates: Partial<QHuntTeam>) => {
    updateConfig('teams', config.teams.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
  };

  const removeTeam = (id: string) => {
    updateConfig('teams', config.teams.filter(t => t.id !== id));
  };

  // Generate random code value
  const generateCodeValue = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Handle file uploads
  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBackgroundFile(file);
      setBackgroundPreview(URL.createObjectURL(file));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Copy link
  const copyLink = async (type: 'player' | 'display') => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const url = type === 'display'
      ? `${baseUrl}/v/${shortId}?display=1`
      : `${baseUrl}/v/${shortId}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  // Handle save
  const handleSave = async () => {
    await onSave(config, backgroundFile || undefined);
    // Reset dirty state after successful save
    originalConfigRef.current = JSON.stringify(config);
    setBackgroundFile(null);
    setLogoFile(null);
    setIsDirty(false);
  };

  // Phase control
  const handlePhaseChange = async (phase: QHuntPhase) => {
    if (onPhaseChange) {
      await onPhaseChange(phase);
    }
  };

  // Generate printable codes page
  const generatePrintableCodes = async () => {
    const activeCodes = config.codes.filter(c => c.isActive);
    if (activeCodes.length === 0) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Get base URL for QR codes
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    // Generate QR codes for each code - include full URL so external scans redirect to game
    const qrCodes: { code: QHuntCode; dataUrl: string }[] = [];
    for (const code of activeCodes) {
      try {
        // QR contains URL: when scanned externally, opens game page
        // When scanned in-game, scanner extracts the code parameter
        const qrUrl = shortId
          ? `${baseUrl}/v/${shortId}?code=${code.codeValue}`
          : code.codeValue;

        const dataUrl = await QRCode.toDataURL(qrUrl, {
          width: 200,
          margin: 2,
          color: { dark: '#000000', light: '#ffffff' }
        });
        qrCodes.push({ code, dataUrl });
      } catch (e) {
        console.error('Error generating QR code:', e);
      }
    }

    const typeConfig = CODE_TYPE_CONFIG;

    // Create HTML content for print
    const html = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <title>QHunt Codes - ${config.branding.gameTitle || 'Code Hunt'}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            background: #fff;
          }
          h1 {
            text-align: center;
            margin-bottom: 30px;
            font-size: 28px;
            color: #1a1a2e;
          }
          .codes-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            max-width: 900px;
            margin: 0 auto;
          }
          .code-card {
            border: 2px solid #e5e7eb;
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            page-break-inside: avoid;
          }
          .qr-code {
            width: 150px;
            height: 150px;
            margin: 0 auto 12px;
          }
          .code-value {
            font-family: monospace;
            font-size: 24px;
            font-weight: bold;
            color: #1a1a2e;
            margin-bottom: 8px;
          }
          .code-label {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 4px;
          }
          .code-type {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
          }
          .code-points {
            margin-top: 8px;
            font-size: 16px;
            font-weight: 600;
            color: #10b981;
          }
          @media print {
            body { padding: 0; }
            .codes-grid { gap: 15px; }
            .code-card { border-width: 1px; padding: 15px; }
          }
        </style>
      </head>
      <body>
        <h1>${config.branding.gameTitle || (isRTL ? 'ציד הקודים' : 'Code Hunt')}</h1>
        <div class="codes-grid">
          ${qrCodes.map(({ code, dataUrl }) => {
            const tc = typeConfig[code.codeType];
            return `
              <div class="code-card" style="border-color: ${tc?.color || '#e5e7eb'}">
                <img class="qr-code" src="${dataUrl}" alt="${code.codeValue}" />
                <div class="code-value">${code.codeValue}</div>
                ${code.label ? `<div class="code-label">${code.label}</div>` : ''}
                <span class="code-type" style="background: ${tc?.color}20; color: ${tc?.color}">
                  ${tc?.emoji || '🎯'} ${isRTL ? tc?.labelHe : tc?.labelEn}
                </span>
                <div class="code-points">${code.points} ${isRTL ? 'נקודות' : 'points'}</div>
              </div>
            `;
          }).join('')}
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Download codes as JSON
  const downloadCodesAsJSON = () => {
    const activeCodes = config.codes.filter(c => c.isActive);
    const data = {
      gameTitle: config.branding.gameTitle || 'QHunt',
      exportedAt: new Date().toISOString(),
      codes: activeCodes.map(c => ({
        value: c.codeValue,
        type: c.codeType,
        points: c.points,
        label: c.label || null
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qhunt-codes-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
        style={{ background: '#1a1a2e' }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#374151' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
              }}
            >
              <Crosshair className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#ffffff' }}>
                QHunt {isRTL ? 'הגדרות' : 'Settings'}
              </h2>
              <p className="text-sm" style={{ color: '#9ca3af' }}>
                {isRTL ? 'ציד קודים בזמן אמת' : 'Real-time code hunting game'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-black/10"
          >
            <X className="w-5 h-5" style={{ color: '#9ca3af' }} />
          </button>
        </div>

        {/* Tabs */}
        <div
          className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 py-3 overflow-x-auto"
          style={{ background: '#0f172a', borderBottom: '1px solid #374151' }}
        >
          {[
            { id: 'participants', icon: UserCheck, label: isRTL ? 'משתתפים' : 'Players', badge: players.length },
            { id: 'general', icon: Settings, label: isRTL ? 'כללי' : 'General', badge: undefined },
            { id: 'codes', icon: Target, label: isRTL ? 'קודים' : 'Codes', badge: undefined },
            { id: 'teams', icon: Users, label: isRTL ? 'קבוצות' : 'Teams', badge: undefined },
            { id: 'branding', icon: Palette, label: isRTL ? 'מיתוג' : 'Branding', badge: undefined },
            { id: 'advanced', icon: Settings, label: isRTL ? 'מתקדם' : 'Advanced', badge: undefined },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="flex-shrink-0 flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors"
                style={{
                  minWidth: '90px',
                  height: '38px',
                  padding: '0 12px',
                  fontSize: '13px',
                  color: isActive ? '#ffffff' : '#9ca3af',
                  background: isActive ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                  border: isActive ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                  boxShadow: isActive ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                }}
              >
                <tab.icon style={{ width: '15px', height: '15px', flexShrink: 0 }} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className="rounded-full text-xs font-bold"
                    style={{
                      padding: '1px 6px',
                      background: isActive ? 'rgba(255,255,255,0.2)' : '#3b82f6',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <div className="text-3xl font-bold text-blue-400">{players.length}</div>
                  <div className="text-sm text-gray-400">{isRTL ? 'שחקנים רשומים' : 'Registered'}</div>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.3)' }}>
                  <div className="text-3xl font-bold" style={{ color: '#00ff88' }}>
                    {players.reduce((sum, p) => sum + p.scansCount, 0)}
                  </div>
                  <div className="text-sm text-gray-400">{isRTL ? 'סריקות' : 'Scans'}</div>
                </div>
                <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255, 170, 0, 0.1)', border: '1px solid rgba(255, 170, 0, 0.3)' }}>
                  <div className="text-3xl font-bold text-amber-400">
                    {players.reduce((sum, p) => sum + p.currentScore, 0)}
                  </div>
                  <div className="text-sm text-gray-400">{isRTL ? 'סה"כ נקודות' : 'Total Points'}</div>
                </div>
              </div>

              {/* Players List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    {isRTL ? 'טבלת מובילים' : 'Leaderboard'}
                  </h3>
                  <button
                    onClick={fetchPlayers}
                    disabled={loadingPlayers}
                    className="text-sm px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}
                  >
                    {loadingPlayers ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRTL ? 'רענן' : 'Refresh')}
                  </button>
                </div>

                {loadingPlayers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                  </div>
                ) : players.length === 0 ? (
                  <div className="text-center py-12 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-500" />
                    <p className="text-gray-400">{isRTL ? 'אין שחקנים רשומים עדיין' : 'No players registered yet'}</p>
                    <p className="text-sm text-gray-500 mt-1">{isRTL ? 'שחקנים יופיעו כאן לאחר הרשמה' : 'Players will appear here after registration'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {players
                      .sort((a, b) => b.currentScore - a.currentScore)
                      .map((player, index) => {
                        const team = config.teams?.find(t => t.id === player.teamId);
                        return (
                          <div
                            key={player.id}
                            className="flex items-center gap-3 p-3 rounded-xl transition-colors"
                            style={{
                              background: index < 3 ? 'rgba(255, 170, 0, 0.08)' : 'rgba(255,255,255,0.03)',
                              border: index < 3 ? '1px solid rgba(255, 170, 0, 0.2)' : '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            {/* Rank */}
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                              style={{
                                background: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'rgba(255,255,255,0.1)',
                                color: index < 3 ? '#000' : '#fff',
                              }}
                            >
                              {index + 1}
                            </div>

                            {/* Avatar */}
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-xl overflow-hidden"
                              style={{ background: 'rgba(255,255,255,0.1)' }}
                            >
                              {player.avatarType === 'selfie' && player.avatarValue ? (
                                <img
                                  src={player.avatarValue}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : player.avatarType === 'emoji' ? (
                                player.avatarValue
                              ) : (
                                '👤'
                              )}
                            </div>

                            {/* Name & Team */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-white truncate">{player.name}</div>
                              {team && (
                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                  <span style={{ color: team.color }}>●</span>
                                  {team.name}
                                </div>
                              )}
                            </div>

                            {/* Score & Time */}
                            <div className="text-right">
                              <div className="font-bold" style={{ color: '#00ff88' }}>{player.currentScore}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 justify-end">
                                <span>{player.scansCount} {isRTL ? 'סריקות' : 'scans'}</span>
                                {player.gameStartedAt && player.gameEndedAt && (
                                  <span className="text-gray-400">
                                    {formatGameTime(player.gameEndedAt - player.gameStartedAt)}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePlayer(player.id);
                              }}
                              disabled={deletingPlayerId === player.id}
                              className="p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                              title={isRTL ? 'מחק שחקן' : 'Delete player'}
                            >
                              {deletingPlayerId === player.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Reset Game Section */}
              {players.length > 0 && (
                <div className="pt-6 border-t" style={{ borderColor: '#374151' }}>
                  <h3 className="font-medium mb-4 text-red-400">
                    {isRTL ? 'אזור מסוכן' : 'Danger Zone'}
                  </h3>
                  <button
                    onClick={() => setShowResetConfirmModal(true)}
                    disabled={!onReset || resetting}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                    {resetting
                      ? (isRTL ? 'מאפס...' : 'Resetting...')
                      : (isRTL ? 'אפס משחק (מחק שחקנים וסריקות)' : 'Reset Game (Delete Players & Scans)')
                    }
                  </button>
                </div>
              )}
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Game Title */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                  {isRTL ? 'שם המשחק' : 'Game Title'}
                </label>
                <input
                  type="text"
                  value={config.branding.gameTitle || ''}
                  onChange={(e) => updateBranding('gameTitle', e.target.value)}
                  placeholder={isRTL ? 'ציד הקודים' : 'Code Hunt'}
                  className="w-full px-4 py-3 rounded-xl border transition-colors"
                  style={{
                    background: '#0f172a',
                    borderColor: '#374151',
                    color: '#ffffff',
                  }}
                />
              </div>

              {/* Game Mode */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                  {isRTL ? 'מצב משחק' : 'Game Mode'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => updateConfig('mode', 'individual')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      config.mode === 'individual' ? 'border-blue-500' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ background: config.mode === 'individual' ? 'rgba(59,130,246,0.15)' : '#0f172a' }}
                  >
                    <div className="text-2xl mb-2">👤</div>
                    <div className="font-medium" style={{ color: '#ffffff' }}>
                      {isRTL ? 'אישי' : 'Individual'}
                    </div>
                    <div className="text-sm" style={{ color: '#9ca3af' }}>
                      {isRTL ? 'כל שחקן לעצמו' : 'Every player for themselves'}
                    </div>
                  </button>
                  <button
                    onClick={() => updateConfig('mode', 'teams')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      config.mode === 'teams' ? 'border-blue-500' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ background: config.mode === 'teams' ? 'rgba(59,130,246,0.15)' : '#0f172a' }}
                  >
                    <div className="text-2xl mb-2">👥</div>
                    <div className="font-medium" style={{ color: '#ffffff' }}>
                      {isRTL ? 'קבוצות' : 'Teams'}
                    </div>
                    <div className="text-sm" style={{ color: '#9ca3af' }}>
                      {isRTL ? 'תחרות בין קבוצות' : 'Competition between teams'}
                    </div>
                  </button>
                </div>
              </div>

              {/* Game Duration */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                  {isRTL ? 'משך המשחק (דקות)' : 'Game Duration (minutes)'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={Math.floor(config.gameDurationSeconds / 60)}
                    onChange={(e) => updateConfig('gameDurationSeconds', parseInt(e.target.value || '0') * 60)}
                    min={0}
                    max={180}
                    className="w-32 px-4 py-3 rounded-xl border"
                    style={{
                      background: '#0f172a',
                      borderColor: '#374151',
                      color: '#ffffff',
                    }}
                  />
                  <span className="text-sm" style={{ color: '#9ca3af' }}>
                    {isRTL ? '(0 = ללא הגבלה)' : '(0 = unlimited)'}
                  </span>
                </div>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                  {isRTL ? 'שפה' : 'Language'}
                </label>
                <div className="flex gap-3">
                  {[
                    { value: 'he', label: 'עברית' },
                    { value: 'en', label: 'English' },
                    { value: 'auto', label: isRTL ? 'אוטומטי' : 'Auto' },
                  ].map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => updateConfig('language', lang.value as 'he' | 'en' | 'auto')}
                      className={`px-4 py-2 rounded-lg border transition-all ${
                        config.language === lang.value ? 'border-blue-500' : 'border-gray-600 hover:border-gray-500'
                      }`}
                      style={{
                        background: config.language === lang.value ? 'rgba(59,130,246,0.15)' : 'transparent',
                        color: '#ffffff',
                      }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Show Leaderboard to Players */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#0f172a' }}>
                <div className="flex-1 me-4">
                  <div className="font-medium" style={{ color: '#ffffff' }}>
                    {isRTL ? 'הצג טבלה לשחקנים' : 'Show Leaderboard to Players'}
                  </div>
                  <div className="text-sm" style={{ color: '#9ca3af' }}>
                    {isRTL ? 'שחקנים יראו את הטבלה המלאה בזמן משחק' : 'Players see full leaderboard during game'}
                  </div>
                </div>
                <ToggleSwitch
                  checked={config.showLeaderboardToPlayers}
                  onChange={(checked) => updateConfig('showLeaderboardToPlayers', checked)}
                />
              </div>

              {/* Enable Sound */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#0f172a' }}>
                <div className="flex-1 me-4">
                  <div className="font-medium" style={{ color: '#ffffff' }}>
                    {isRTL ? 'אפקטי צליל' : 'Sound Effects'}
                  </div>
                  <div className="text-sm" style={{ color: '#9ca3af' }}>
                    {isRTL ? 'צלילים בעת סריקה ואירועים' : 'Sounds on scan and events'}
                  </div>
                </div>
                <ToggleSwitch
                  checked={config.enableSound}
                  onChange={(checked) => updateConfig('enableSound', checked)}
                />
              </div>
            </div>
          )}

          {/* Codes Tab */}
          {activeTab === 'codes' && (
            <div className="space-y-4">
              {/* Header with actions */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-medium" style={{ color: '#ffffff' }}>
                    {isRTL ? `${config.codes.length} קודים` : `${config.codes.length} Codes`}
                  </h3>
                  {/* Color breakdown */}
                  {config.codes.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(config.availableCodeTypes.length > 0 ? config.availableCodeTypes : Object.keys(CODE_TYPE_CONFIG) as Array<keyof typeof CODE_TYPE_CONFIG>).map(type => {
                        const count = config.codes.filter(c => c.codeType === type && c.isActive).length;
                        const typeConf = CODE_TYPE_CONFIG[type];
                        return (
                          <span
                            key={type}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              background: `${typeConf.color}20`,
                              color: typeConf.color,
                              border: `1px solid ${typeConf.color}40`,
                            }}
                            title={isRTL ? typeConf.name : typeConf.nameEn}
                          >
                            <span>{typeConf.emoji}</span>
                            <span>{count}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Print Codes */}
                  <button
                    onClick={generatePrintableCodes}
                    disabled={config.codes.filter(c => c.isActive).length === 0}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}
                    title={isRTL ? 'הדפס קודים' : 'Print Codes'}
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">{isRTL ? 'הדפס' : 'Print'}</span>
                  </button>
                  {/* Download Codes */}
                  <button
                    onClick={downloadCodesAsJSON}
                    disabled={config.codes.filter(c => c.isActive).length === 0}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#a78bfa',
                      border: '1px solid rgba(139, 92, 246, 0.3)'
                    }}
                    title={isRTL ? 'הורד JSON' : 'Download JSON'}
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">{isRTL ? 'הורד' : 'Download'}</span>
                  </button>
                  {/* Add Code */}
                  <button
                    onClick={addCode}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      boxShadow: '0 2px 8px rgba(59,130,246,0.3)'
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    {isRTL ? 'הוסף קוד' : 'Add Code'}
                  </button>
                </div>
              </div>

              {config.codes.length === 0 ? (
                <div className="text-center py-12 rounded-xl border-2 border-dashed" style={{ borderColor: '#374151' }}>
                  <Target className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: '#9ca3af' }} />
                  <p style={{ color: '#9ca3af' }}>
                    {isRTL ? 'אין קודים. הוסף קודים לציד!' : 'No codes. Add codes to hunt!'}
                  </p>
                </div>
              ) : (
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
                >
                  {config.codes.map((code) => {
                    const typeConfig = CODE_TYPE_CONFIG[code.codeType];
                    return (
                      <div
                        key={code.id}
                        className="relative rounded-2xl p-4 transition-all hover:scale-[1.02] cursor-pointer group"
                        style={{
                          background: '#0f172a',
                          border: `2px solid ${code.isActive ? typeConfig?.color || '#666' : '#374151'}`,
                          opacity: code.isActive ? 1 : 0.5,
                        }}
                        onClick={() => openCodeModal(code)}
                      >
                        {/* Delete button - top right */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCode(code.id);
                          }}
                          className="absolute top-2 end-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/30 transition-all"
                          style={{ background: 'rgba(0,0,0,0.5)' }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>

                        {/* Active toggle - top left */}
                        <div
                          className="absolute top-2 start-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => updateCode(code.id, { isActive: !code.isActive })}
                            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
                            style={{
                              background: code.isActive ? typeConfig?.color : '#374151',
                              boxShadow: code.isActive ? `0 0 10px ${typeConfig?.color}60` : 'none',
                            }}
                          >
                            {code.isActive && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        </div>

                        {/* Hint indicator - next to active toggle */}
                        {code.hint && (
                          <div
                            className="absolute top-2 start-10 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(255, 215, 0, 0.3)' }}
                            title={isRTL ? 'יש רמז' : 'Has hint'}
                          >
                            <span className="text-xs">💡</span>
                          </div>
                        )}

                        {/* Code value - large and centered */}
                        <div className="text-center pt-6 pb-2">
                          <div
                            className="font-mono text-2xl font-black tracking-wider mb-1"
                            style={{ color: '#ffffff' }}
                          >
                            {code.codeValue}
                          </div>

                          {/* Label if exists */}
                          {code.label && (
                            <div className="text-xs text-gray-400 truncate">
                              {code.label}
                            </div>
                          )}
                        </div>

                        {/* Type indicator */}
                        <div className="flex justify-center mb-2">
                          <div
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                            style={{
                              background: `${typeConfig?.color}20`,
                              color: typeConfig?.color,
                              border: `1px solid ${typeConfig?.color}40`,
                            }}
                          >
                            <span>{typeConfig?.emoji}</span>
                            <span>{isRTL ? typeConfig?.labelHe : typeConfig?.labelEn}</span>
                          </div>
                        </div>

                        {/* Points */}
                        <div className="text-center">
                          <span
                            className="text-lg font-bold"
                            style={{ color: '#10b981' }}
                          >
                            {code.points}
                          </span>
                          <span className="text-sm text-gray-400 ms-1">
                            {isRTL ? 'נקודות' : 'points'}
                          </span>
                        </div>

                        {/* Click hint */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="flex items-center gap-2 text-white text-sm font-medium">
                            <QrCode className="w-5 h-5" />
                            {isRTL ? 'לחץ להצגת QR' : 'Click for QR'}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add new code card */}
                  <button
                    onClick={addCode}
                    className="rounded-2xl p-4 transition-all hover:scale-[1.02] flex flex-col items-center justify-center gap-3 min-h-[180px]"
                    style={{
                      background: 'transparent',
                      border: '2px dashed #374151',
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(59, 130, 246, 0.2)' }}
                    >
                      <Plus className="w-6 h-6 text-blue-400" />
                    </div>
                    <span className="text-gray-400 text-sm font-medium">
                      {isRTL ? 'הוסף קוד' : 'Add Code'}
                    </span>
                  </button>
                </div>
              )}

              {/* Bulk add */}
              <div className="mt-6 p-4 rounded-xl border-2 border-dashed" style={{ borderColor: '#374151' }}>
                <p className="text-sm mb-3" style={{ color: '#9ca3af' }}>
                  {isRTL ? 'הוסף קודים מהירים' : 'Quick add codes'}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => addMultipleCodes(5)}
                    className="px-4 py-2 rounded-lg border hover:bg-white/5 transition-colors"
                    style={{ borderColor: '#374151', color: '#ffffff' }}
                  >
                    <Plus className="w-4 h-4 inline me-1" />
                    5
                  </button>
                  <button
                    onClick={() => addMultipleCodes(10)}
                    className="px-4 py-2 rounded-lg border hover:bg-white/5 transition-colors"
                    style={{ borderColor: '#374151', color: '#ffffff' }}
                  >
                    <Plus className="w-4 h-4 inline me-1" />
                    10
                  </button>
                  <button
                    onClick={() => addMultipleCodes(20)}
                    className="px-4 py-2 rounded-lg border hover:bg-white/5 transition-colors"
                    style={{ borderColor: '#374151', color: '#ffffff' }}
                  >
                    <Plus className="w-4 h-4 inline me-1" />
                    20
                  </button>
                </div>
              </div>

              {/* Delete All Codes - Danger Zone */}
              {config.codes.length > 0 && (
                <div className="mt-6 pt-6 border-t" style={{ borderColor: '#374151' }}>
                  <h4 className="text-sm font-medium text-red-400 mb-3">
                    {isRTL ? 'אזור מסוכן' : 'Danger Zone'}
                  </h4>
                  <button
                    onClick={() => setShowDeleteAllCodesModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isRTL ? `מחק את כל הקודים (${config.codes.length})` : `Delete All Codes (${config.codes.length})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div className="space-y-4">
              {config.mode !== 'teams' && (
                <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/50 mb-4">
                  <p className="text-amber-400 text-sm">
                    {isRTL ? 'מצב קבוצות מושבת. הפעל אותו בלשונית "כללי".' : 'Teams mode is disabled. Enable it in the "General" tab.'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium" style={{ color: '#ffffff' }}>
                  {isRTL ? `${config.teams.length} קבוצות` : `${config.teams.length} Teams`}
                </h3>
                <button
                  onClick={addTeam}
                  disabled={config.mode !== 'teams'}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    boxShadow: '0 2px 8px rgba(59,130,246,0.3)'
                  }}
                >
                  <Plus className="w-4 h-4" />
                  {isRTL ? 'הוסף קבוצה' : 'Add Team'}
                </button>
              </div>

              {config.teams.length === 0 ? (
                <div className="text-center py-12 rounded-xl border-2 border-dashed" style={{ borderColor: '#374151' }}>
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: '#9ca3af' }} />
                  <p style={{ color: '#9ca3af' }}>
                    {isRTL ? 'אין קבוצות. הוסף קבוצות למשחק!' : 'No teams. Add teams for the game!'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {config.teams.map((team) => (
                    <div
                      key={team.id}
                      className="p-4 rounded-xl border-2"
                      style={{
                        background: team.color + '15',
                        borderColor: team.color,
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {/* Color picker */}
                        <input
                          type="color"
                          value={team.color}
                          onChange={(e) => updateTeam(team.id, { color: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer"
                        />
                        {/* Name */}
                        <input
                          type="text"
                          value={team.name}
                          onChange={(e) => updateTeam(team.id, { name: e.target.value })}
                          className="flex-1 px-3 py-2 rounded-lg bg-black/20 border-none outline-none font-medium"
                          style={{ color: '#ffffff' }}
                        />
                        {/* Delete */}
                        <button
                          onClick={() => removeTeam(team.id)}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                      {/* Team emoji */}
                      <div className="flex items-center gap-2 text-sm" style={{ color: '#9ca3af' }}>
                        <span>{isRTL ? 'אימוג\'י:' : 'Emoji:'}</span>
                        <span className="text-xl">{team.emoji || '👥'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="flex gap-6" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              {/* Phone Preview - Left Side */}
              <div className="flex-shrink-0">
                <div className="sticky top-0">
                  {/* Phone Frame */}
                  <div
                    className="relative mx-auto"
                    style={{
                      width: '220px',
                      height: '440px',
                      borderRadius: '32px',
                      background: '#1a1a1a',
                      padding: '8px',
                      boxShadow: '0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1)',
                    }}
                  >
                    {/* Notch */}
                    <div
                      className="absolute top-2 left-1/2 -translate-x-1/2 z-10"
                      style={{
                        width: '80px',
                        height: '24px',
                        background: '#1a1a1a',
                        borderRadius: '0 0 16px 16px',
                      }}
                    />
                    {/* Screen */}
                    <div
                      className="relative w-full h-full overflow-hidden"
                      style={{
                        borderRadius: '24px',
                        backgroundColor: config.branding.backgroundColor || '#0a0f1a',
                        backgroundImage: backgroundPreview ? `url(${backgroundPreview})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                      }}
                    >
                      {/* Animated Grid Background */}
                      {config.branding.showGridAnimation !== false && (
                        <div
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            backgroundImage: `
                              linear-gradient(${config.branding.primaryColor || '#00d4ff'}08 1px, transparent 1px),
                              linear-gradient(90deg, ${config.branding.primaryColor || '#00d4ff'}08 1px, transparent 1px)
                            `,
                            backgroundSize: '20px 20px',
                            animation: 'gridMove 20s linear infinite',
                          }}
                        />
                      )}

                      {/* Glowing Orbs */}
                      {config.branding.showGlowingOrbs !== false && (
                        <>
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              width: '120px',
                              height: '120px',
                              borderRadius: '50%',
                              background: config.branding.primaryColor || '#00d4ff',
                              filter: 'blur(40px)',
                              opacity: 0.25,
                              top: '-40px',
                              right: '-20px',
                              animation: 'orbFloat 8s ease-in-out infinite',
                            }}
                          />
                          <div
                            className="absolute pointer-events-none"
                            style={{
                              width: '90px',
                              height: '90px',
                              borderRadius: '50%',
                              background: config.branding.secondaryColor || '#ff00aa',
                              filter: 'blur(35px)',
                              opacity: 0.2,
                              bottom: '-30px',
                              left: '-20px',
                              animation: 'orbFloat 8s ease-in-out infinite reverse',
                            }}
                          />
                        </>
                      )}

                      {/* Overlay for background image */}
                      {backgroundPreview && (
                        <div
                          className="absolute inset-0"
                          style={{ background: 'rgba(0,0,0,0.5)' }}
                        />
                      )}

                      {/* Content */}
                      <div className="relative flex flex-col items-center h-full p-3 pt-8 text-center">
                        {/* Logo */}
                        {logoPreview && (
                          <img
                            src={logoPreview}
                            alt="Logo"
                            className="h-8 object-contain mb-2"
                          />
                        )}

                        {/* Game Title with Glow */}
                        <h3
                          className="text-base font-extrabold mb-2"
                          style={{
                            color: '#fff',
                            textShadow: `0 0 10px ${config.branding.primaryColor || '#00d4ff'}, 0 0 20px ${config.branding.primaryColor || '#00d4ff'}50`,
                          }}
                        >
                          {config.branding.gameTitle || (isRTL ? 'ציד הקודים' : 'Code Hunt')}
                        </h3>

                        {/* Subtitle */}
                        <p
                          className="text-xs mb-3"
                          style={{ color: config.branding.primaryColor || '#00d4ff', opacity: 0.9 }}
                        >
                          {isRTL ? 'הצטרפו למשחק' : 'Join the game'}
                        </p>

                        {/* Step Indicators - 2 steps (registration + ready) */}
                        <div className="flex items-center justify-center gap-1.5 mb-3">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              background: `${config.branding.primaryColor || '#00d4ff'}20`,
                              color: config.branding.primaryColor || '#00d4ff',
                              border: `1.5px solid ${config.branding.primaryColor || '#00d4ff'}`,
                              boxShadow: `0 0 8px ${config.branding.primaryColor || '#00d4ff'}40`,
                            }}
                          >
                            1
                          </div>
                          <div className="w-6 h-0.5" style={{ background: '#ffffff20' }} />
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{
                              background: '#ffffff10',
                              color: '#ffffff60',
                              border: '1.5px solid #ffffff20',
                            }}
                          >
                            2
                          </div>
                        </div>

                        {/* Name Input Preview */}
                        <div
                          className="w-full rounded-lg py-2 px-3 mb-3 text-xs text-center"
                          style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: `1.5px solid ${config.branding.primaryColor || '#00d4ff'}`,
                            color: '#ffffff80',
                            boxShadow: `0 0 10px ${config.branding.primaryColor || '#00d4ff'}30`,
                          }}
                        >
                          {isRTL ? 'בחרו כינוי...' : 'Choose a nickname...'}
                        </div>

                        {/* Emoji Grid Preview */}
                        <div className="grid grid-cols-4 gap-1 mb-3 w-full">
                          {['😊', '🎮', '⭐', '🔥', '🎯', '🚀', '💎', '🦄'].map((emoji, i) => (
                            <div
                              key={i}
                              className="aspect-square flex items-center justify-center rounded-md text-sm"
                              style={{
                                background: i === 0 ? `${config.branding.primaryColor || '#00d4ff'}20` : 'rgba(255,255,255,0.08)',
                                border: i === 0 ? `1.5px solid ${config.branding.primaryColor || '#00d4ff'}` : '1.5px solid rgba(255,255,255,0.15)',
                                boxShadow: i === 0 ? `0 0 8px ${config.branding.primaryColor || '#00d4ff'}40` : 'none',
                              }}
                            >
                              {emoji}
                            </div>
                          ))}
                        </div>

                        {/* Start Button */}
                        <button
                          className="w-full py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5"
                          style={{
                            background: `linear-gradient(135deg, ${config.branding.successColor || '#00ff88'}, #00cc6a)`,
                            color: '#000',
                            boxShadow: `0 4px 15px ${config.branding.successColor || '#00ff88'}40`,
                          }}
                        >
                          <span>🚀</span>
                          <span>{isRTL ? 'התחילו לצוד!' : 'Start Hunting!'}</span>
                        </button>

                        {/* Success indicator sample */}
                        <div
                          className="flex items-center gap-1 mt-2 text-xs"
                          style={{ color: config.branding.successColor || '#00ff88' }}
                        >
                          <span>✓</span>
                          <span>{isRTL ? '+10 נקודות!' : '+10 points!'}</span>
                        </div>
                      </div>

                      {/* CSS Keyframes */}
                      <style jsx>{`
                        @keyframes gridMove {
                          0% { transform: translate(0, 0); }
                          100% { transform: translate(20px, 20px); }
                        }
                        @keyframes orbFloat {
                          0%, 100% { transform: translate(0, 0) scale(1); }
                          50% { transform: translate(10px, 10px) scale(1.1); }
                        }
                      `}</style>
                    </div>
                  </div>

                  {/* Preview label */}
                  <p className="text-center mt-3 text-xs" style={{ color: '#9ca3af' }}>
                    {isRTL ? 'תצוגה מקדימה' : 'Live Preview'}
                  </p>
                </div>
              </div>

              {/* Controls - Right Side */}
              <div className="flex-1 space-y-5 min-w-0">
                {/* Preset Themes */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    {isRTL ? 'ערכות נושא מוכנות' : 'Color Themes'}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: isRTL ? 'ניאון' : 'Neon', bg: '#0a0f1a', primary: '#00d4ff', secondary: '#ff00aa', success: '#00ff88' },
                      { name: isRTL ? 'סגול' : 'Purple', bg: '#0f0a1a', primary: '#a855f7', secondary: '#ec4899', success: '#22c55e' },
                      { name: isRTL ? 'ירוק' : 'Green', bg: '#0a1a0f', primary: '#22c55e', secondary: '#eab308', success: '#10b981' },
                      { name: isRTL ? 'אדום' : 'Red', bg: '#1a0a0a', primary: '#ef4444', secondary: '#f97316', success: '#84cc16' },
                      { name: isRTL ? 'כחול' : 'Blue', bg: '#0a0f1a', primary: '#3b82f6', secondary: '#8b5cf6', success: '#06b6d4' },
                      { name: isRTL ? 'זהב' : 'Gold', bg: '#1a150a', primary: '#f59e0b', secondary: '#ef4444', success: '#84cc16' },
                      { name: isRTL ? 'ים' : 'Ocean', bg: '#0a1a1a', primary: '#06b6d4', secondary: '#0ea5e9', success: '#14b8a6' },
                      { name: isRTL ? 'ורוד' : 'Pink', bg: '#1a0a14', primary: '#ec4899', secondary: '#f43f5e', success: '#a3e635' },
                    ].map((theme) => (
                      <button
                        key={theme.name}
                        onClick={() => {
                          updateBranding('backgroundColor', theme.bg);
                          updateBranding('primaryColor', theme.primary);
                          updateBranding('secondaryColor', theme.secondary);
                          updateBranding('successColor', theme.success);
                        }}
                        className="relative p-2 rounded-lg border-2 transition-all hover:scale-105 group"
                        style={{
                          background: theme.bg,
                          borderColor: config.branding.primaryColor === theme.primary ? theme.primary : 'transparent',
                        }}
                      >
                        <div className="flex gap-0.5 mb-1 justify-center">
                          <div className="w-3 h-3 rounded-full" style={{ background: theme.primary }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: theme.secondary }} />
                          <div className="w-3 h-3 rounded-full" style={{ background: theme.success }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: theme.primary }}>
                          {theme.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Color */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    {isRTL ? 'צבע רקע' : 'Background Color'}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.branding.backgroundColor || '#0a0f1a'}
                      onChange={(e) => updateBranding('backgroundColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {presetColors.background.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateBranding('backgroundColor', color)}
                          className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                          style={{
                            background: color,
                            borderColor: config.branding.backgroundColor === color ? '#3b82f6' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Color */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    {isRTL ? 'צבע ראשי' : 'Primary Color'}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.branding.primaryColor || '#00d4ff'}
                      onChange={(e) => updateBranding('primaryColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {presetColors.primary.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateBranding('primaryColor', color)}
                          className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                          style={{
                            background: color,
                            borderColor: config.branding.primaryColor === color ? '#fff' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Secondary Color */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    {isRTL ? 'צבע משני' : 'Secondary Color'}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.branding.secondaryColor || '#ff00aa'}
                      onChange={(e) => updateBranding('secondaryColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {presetColors.primary.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateBranding('secondaryColor', color)}
                          className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                          style={{
                            background: color,
                            borderColor: config.branding.secondaryColor === color ? '#fff' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Success Color */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                    {isRTL ? 'צבע הצלחה' : 'Success Color'}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.branding.successColor || '#00ff88'}
                      onChange={(e) => updateBranding('successColor', e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer flex-shrink-0"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {presetColors.success.map((color) => (
                        <button
                          key={color}
                          onClick={() => updateBranding('successColor', color)}
                          className="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                          style={{
                            background: color,
                            borderColor: config.branding.successColor === color ? '#fff' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Animated Effects Section */}
                <div className="space-y-3 pt-2">
                  <label className="block text-sm font-medium" style={{ color: '#ffffff' }}>
                    {isRTL ? 'אפקטים מונפשים' : 'Animated Effects'}
                  </label>

                  {/* Grid Animation Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.branding.showGridAnimation !== false}
                        onChange={(e) => updateBranding('showGridAnimation', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 rounded-full transition-colors peer-checked:bg-blue-500" style={{ background: config.branding.showGridAnimation !== false ? '#3b82f6' : '#374151' }}>
                        <div
                          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform bg-white shadow-md"
                          style={{ transform: config.branding.showGridAnimation !== false ? 'translateX(20px)' : 'translateX(0)' }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: '#d1d5db' }}>
                        {isRTL ? 'רשת מונפשת' : 'Animated Grid'}
                      </span>
                      <div
                        className="w-5 h-5 rounded border flex items-center justify-center"
                        style={{
                          borderColor: config.branding.primaryColor || '#00d4ff',
                          backgroundImage: `linear-gradient(${config.branding.primaryColor || '#00d4ff'}10 1px, transparent 1px), linear-gradient(90deg, ${config.branding.primaryColor || '#00d4ff'}10 1px, transparent 1px)`,
                          backgroundSize: '4px 4px',
                        }}
                      />
                    </div>
                  </label>

                  {/* Glowing Orbs Toggle */}
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.branding.showGlowingOrbs !== false}
                        onChange={(e) => updateBranding('showGlowingOrbs', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 rounded-full transition-colors" style={{ background: config.branding.showGlowingOrbs !== false ? '#3b82f6' : '#374151' }}>
                        <div
                          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform bg-white shadow-md"
                          style={{ transform: config.branding.showGlowingOrbs !== false ? 'translateX(20px)' : 'translateX(0)' }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: '#d1d5db' }}>
                        {isRTL ? 'כדורים זוהרים' : 'Glowing Orbs'}
                      </span>
                      <div className="flex gap-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ background: config.branding.primaryColor || '#00d4ff', filter: 'blur(1px)', opacity: 0.8 }}
                        />
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: config.branding.secondaryColor || '#ff00aa', filter: 'blur(1px)', opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  </label>
                </div>

                {/* Divider */}
                <div className="border-t pt-5" style={{ borderColor: '#374151' }}>
                  {/* Background Image */}
                  <div className="mb-5">
                    <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                      {isRTL ? 'תמונת רקע' : 'Background Image'}
                    </label>
                    <input
                      type="file"
                      ref={backgroundInputRef}
                      accept="image/*"
                      onChange={handleBackgroundUpload}
                      className="hidden"
                    />
                    {backgroundPreview ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={backgroundPreview}
                          alt="Background"
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => backgroundInputRef.current?.click()}
                          className="px-3 py-2 rounded-lg text-sm transition-colors"
                          style={{ background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}
                        >
                          {isRTL ? 'החלף' : 'Change'}
                        </button>
                        <button
                          onClick={() => {
                            setBackgroundFile(null);
                            setBackgroundPreview(null);
                            updateBranding('backgroundImage', '');
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => backgroundInputRef.current?.click()}
                        className="w-full py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors hover:border-blue-500"
                        style={{ borderColor: '#374151', color: '#9ca3af' }}
                      >
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-sm">{isRTL ? 'העלה תמונת רקע' : 'Upload Background'}</span>
                      </button>
                    )}
                  </div>

                  {/* Event Logo */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                      {isRTL ? 'לוגו אירוע' : 'Event Logo'}
                    </label>
                    <input
                      type="file"
                      ref={logoInputRef}
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    {logoPreview ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={logoPreview}
                          alt="Logo"
                          className="h-12 object-contain rounded-lg"
                        />
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="px-3 py-2 rounded-lg text-sm transition-colors"
                          style={{ background: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}
                        >
                          {isRTL ? 'החלף' : 'Change'}
                        </button>
                        <button
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview(null);
                            updateBranding('eventLogo', '');
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        className="w-full py-3 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-colors hover:border-blue-500"
                        style={{ borderColor: '#374151', color: '#9ca3af' }}
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-sm">{isRTL ? 'העלה לוגו' : 'Upload Logo'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Intro Content Section */}
                <div className="border-t pt-5 mt-5" style={{ borderColor: '#374151' }}>
                  <h4 className="font-medium mb-4" style={{ color: '#ffffff' }}>
                    {isRTL ? 'תוכן מסך פתיחה' : 'Welcome Screen Content'}
                  </h4>

                  {/* Intro Video Toggle + URL */}
                  <div className="mb-4 p-4 rounded-xl" style={{ background: '#0f172a' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium" style={{ color: '#ffffff' }}>
                          {isRTL ? 'סרטון הקדמה' : 'Intro Video'}
                        </div>
                        <div className="text-xs" style={{ color: '#6b7280' }}>
                          {isRTL ? 'הצג סרטון במסך הפתיחה' : 'Show video on welcome screen'}
                        </div>
                      </div>
                      <ToggleSwitch
                        checked={config.branding.introVideoEnabled ?? false}
                        onChange={(checked) => updateBranding('introVideoEnabled', checked)}
                      />
                    </div>
                    {config.branding.introVideoEnabled && (
                      <div>
                        <label className="block text-sm font-medium mb-2" style={{ color: '#9ca3af' }}>
                          {isRTL ? 'קישור לסרטון הקדמה (אופציונלי)' : 'Intro Video URL (optional)'}
                        </label>
                        <input
                          type="url"
                          value={config.branding.introVideoUrl || ''}
                          onChange={(e) => updateBranding('introVideoUrl', e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full px-4 py-3 rounded-xl border transition-colors"
                          style={{
                            background: '#1a1a2e',
                            borderColor: '#374151',
                            color: '#ffffff',
                          }}
                        />
                        <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                          {isRTL ? 'תומך ב-YouTube וקישורים ישירים לסרטון' : 'Supports YouTube and direct video links'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Intro Text (Hebrew) */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                      {isRTL ? 'טקסט הקדמה (עברית)' : 'Intro Text (Hebrew)'}
                    </label>
                    <textarea
                      value={config.branding.introText || ''}
                      onChange={(e) => updateBranding('introText', e.target.value)}
                      placeholder={isRTL ? 'ברוכים הבאים למשחק! חפשו את הקודים החבויים...' : 'Welcome to the game! Search for hidden codes...'}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border transition-colors resize-none"
                      style={{
                        background: '#0f172a',
                        borderColor: '#374151',
                        color: '#ffffff',
                      }}
                      dir="rtl"
                    />
                  </div>

                  {/* Intro Text (English) */}
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                      {isRTL ? 'טקסט הקדמה (אנגלית)' : 'Intro Text (English)'}
                    </label>
                    <textarea
                      value={config.branding.introTextEn || ''}
                      onChange={(e) => updateBranding('introTextEn', e.target.value)}
                      placeholder="Welcome to the game! Search for hidden codes..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border transition-colors resize-none"
                      style={{
                        background: '#0f172a',
                        borderColor: '#374151',
                        color: '#ffffff',
                      }}
                      dir="ltr"
                    />
                    <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                      {isRTL ? 'הטקסט יופיע במסך הפתיחה אם לא הוגדר סרטון' : 'Text appears on welcome screen if no video is set'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              {/* Game Control */}
              <div>
                <h3 className="font-medium mb-4" style={{ color: '#ffffff' }}>
                  {isRTL ? 'שליטה במשחק' : 'Game Control'}
                </h3>
                <div className="flex items-center gap-3 mb-4 p-4 rounded-xl" style={{ background: '#0f172a' }}>
                  <span style={{ color: '#9ca3af' }}>
                    {isRTL ? 'שלב נוכחי:' : 'Current Phase:'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400">
                    {currentPhase}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    onClick={() => handlePhaseChange('registration')}
                    disabled={!onPhaseChange}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      currentPhase === 'registration' ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ color: '#ffffff' }}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-sm">{isRTL ? 'הרשמה' : 'Registration'}</span>
                  </button>
                  <button
                    onClick={() => handlePhaseChange('countdown')}
                    disabled={!onPhaseChange}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      currentPhase === 'countdown' ? 'border-amber-500 bg-amber-500/20' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ color: '#ffffff' }}
                  >
                    <Timer className="w-5 h-5" />
                    <span className="text-sm">{isRTL ? 'ספירה' : 'Countdown'}</span>
                  </button>
                  <button
                    onClick={() => handlePhaseChange('playing')}
                    disabled={!onPhaseChange}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      currentPhase === 'playing' ? 'border-emerald-500 bg-emerald-500/20' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ color: '#ffffff' }}
                  >
                    <Play className="w-5 h-5" />
                    <span className="text-sm">{isRTL ? 'משחק' : 'Playing'}</span>
                  </button>
                  <button
                    onClick={() => handlePhaseChange('finished')}
                    disabled={!onPhaseChange}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      currentPhase === 'finished' ? 'border-purple-500 bg-purple-500/20' : 'border-gray-600 hover:border-gray-500'
                    }`}
                    style={{ color: '#ffffff' }}
                  >
                    <Square className="w-5 h-5" />
                    <span className="text-sm">{isRTL ? 'סיום' : 'Finished'}</span>
                  </button>
                </div>
              </div>

              {/* Allow Same Code Multiple Times */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#0f172a' }}>
                <div className="flex-1 me-4">
                  <div className="font-medium" style={{ color: '#ffffff' }}>
                    {isRTL ? 'אפשר סריקת קוד יותר מפעם אחת' : 'Allow Scanning Same Code Multiple Times'}
                  </div>
                  <div className="text-sm" style={{ color: '#9ca3af' }}>
                    {isRTL ? 'שחקנים יכולים לסרוק את אותו קוד כמה פעמים' : 'Players can scan the same code multiple times'}
                  </div>
                </div>
                <ToggleSwitch
                  checked={config.allowSameCodeMultipleTimes}
                  onChange={(checked) => updateConfig('allowSameCodeMultipleTimes', checked)}
                />
              </div>

              {/* Require All Codes */}
              <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#0f172a' }}>
                <div className="flex-1 me-4">
                  <div className="font-medium" style={{ color: '#ffffff' }}>
                    {isRTL ? 'חובה למצוא את כל הקודים' : 'Require All Codes to Finish'}
                  </div>
                  <div className="text-sm" style={{ color: '#9ca3af' }}>
                    {isRTL ? 'שחקנים מסיימים רק כשמצאו את כל הקודים' : 'Players only finish when all codes are found'}
                  </div>
                </div>
                <ToggleSwitch
                  checked={config.requireAllCodesToFinish}
                  onChange={(checked) => updateConfig('requireAllCodesToFinish', checked)}
                />
              </div>

              {/* Minimum Codes */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#ffffff' }}>
                  {isRTL ? 'מינימום קודים לסיום' : 'Minimum Codes to Finish'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={config.minCodesToFinish}
                    onChange={(e) => updateConfig('minCodesToFinish', parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-24 px-4 py-3 rounded-xl border"
                    style={{
                      background: '#0f172a',
                      borderColor: '#374151',
                      color: '#ffffff',
                    }}
                  />
                  <span className="text-sm" style={{ color: '#9ca3af' }}>
                    {isRTL ? '(0 = ללא מינימום)' : '(0 = no minimum)'}
                  </span>
                </div>
              </div>

              {/* Reset Session */}
              <div className="pt-6 border-t" style={{ borderColor: '#374151' }}>
                <h3 className="font-medium mb-4 text-red-400">
                  {isRTL ? 'אזור מסוכן' : 'Danger Zone'}
                </h3>
                <button
                  onClick={() => setShowResetConfirmModal(true)}
                  disabled={!onReset || resetting}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <RotateCcw className="w-5 h-5" />}
                  {resetting
                    ? (isRTL ? 'מאפס...' : 'Resetting...')
                    : (isRTL ? 'אפס משחק (מחק שחקנים וסריקות)' : 'Reset Game (Delete Players & Scans)')
                  }
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t" style={{ borderColor: '#374151' }}>
          {/* Game Access Buttons (left side) */}
          <div className="flex items-center gap-2">
            {shortId && (
              <>
                {/* Open Player Game */}
                <a
                  href={`/v/${shortId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="hidden sm:inline">{isRTL ? 'פתח משחק' : 'Game'}</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>

                {/* Open Display Screen */}
                <a
                  href={`/v/${shortId}?display=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#a78bfa',
                    border: '1px solid rgba(139, 92, 246, 0.3)'
                  }}
                >
                  <Monitor className="w-4 h-4" />
                  <span className="hidden sm:inline">{isRTL ? 'תצוגה' : 'Display'}</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>

                {/* Copy Link */}
                <button
                  onClick={() => copyLink('player')}
                  className="p-2 rounded-lg border transition-all hover:bg-white/5"
                  style={{ borderColor: '#374151' }}
                  title={isRTL ? 'העתק קישור' : 'Copy link'}
                >
                  {copiedLink === 'player' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" style={{ color: '#9ca3af' }} />
                  )}
                </button>
              </>
            )}
          </div>

          {/* Save/Cancel Buttons (right side) */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border transition-all hover:bg-white/5"
              style={{ borderColor: '#374151', color: '#ffffff' }}
            >
              {isRTL ? 'ביטול' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !isDirty}
              className={`px-6 py-2.5 rounded-xl text-white font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 ${isDirty ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900' : ''}`}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRTL ? 'שמור' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete All Codes Confirmation Modal */}
      {showDeleteAllCodesModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setShowDeleteAllCodesModal(false);
            setDeleteAllCodesConfirmText('');
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6"
            style={{ background: '#1a1a2e' }}
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-center text-white mb-2">
              {isRTL ? 'מחיקת כל הקודים' : 'Delete All Codes'}
            </h3>

            {/* Warning text */}
            <p className="text-center text-gray-400 text-sm mb-4">
              {isRTL
                ? `פעולה זו תמחק ${config.codes.length} קודים לצמיתות. לא ניתן לשחזר פעולה זו.`
                : `This will permanently delete ${config.codes.length} codes. This action cannot be undone.`}
            </p>

            {/* Confirmation input */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2 text-center">
                {isRTL
                  ? 'הקלידו "מחיקה" לאישור:'
                  : 'Type "delete" to confirm:'}
              </label>
              <input
                type="text"
                value={deleteAllCodesConfirmText}
                onChange={(e) => setDeleteAllCodesConfirmText(e.target.value)}
                placeholder={isRTL ? 'מחיקה' : 'delete'}
                className="w-full px-4 py-3 rounded-xl text-center text-lg font-medium"
                style={{
                  background: '#0f172a',
                  border: '2px solid #374151',
                  color: '#ffffff',
                }}
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteAllCodesModal(false);
                  setDeleteAllCodesConfirmText('');
                }}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                }}
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={deleteAllCodes}
                disabled={(isRTL ? deleteAllCodesConfirmText !== 'מחיקה' : deleteAllCodesConfirmText.toLowerCase() !== 'delete')}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: (isRTL ? deleteAllCodesConfirmText === 'מחיקה' : deleteAllCodesConfirmText.toLowerCase() === 'delete')
                    ? '#ef4444'
                    : 'rgba(239, 68, 68, 0.3)',
                  color: '#ffffff',
                }}
              >
                {isRTL ? 'מחק הכל' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Game Confirmation Modal */}
      {showResetConfirmModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => {
            setShowResetConfirmModal(false);
            setResetConfirmText('');
          }}
        >
          <div
            className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6"
            style={{ background: '#1a1a2e' }}
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <RotateCcw className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-center text-white mb-2">
              {isRTL ? 'איפוס משחק' : 'Reset Game'}
            </h3>

            {/* Warning text */}
            <p className="text-center text-gray-400 text-sm mb-4">
              {isRTL
                ? `פעולה זו תמחק ${players.length} שחקנים ואת כל הסריקות לצמיתות. לא ניתן לשחזר פעולה זו.`
                : `This will permanently delete ${players.length} players and all scans. This action cannot be undone.`}
            </p>

            {/* Confirmation input */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2 text-center">
                {isRTL
                  ? 'הקלידו "מחיקה" לאישור:'
                  : 'Type "delete" to confirm:'}
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder={isRTL ? 'מחיקה' : 'delete'}
                className="w-full px-4 py-3 rounded-xl text-center text-lg font-medium"
                style={{
                  background: '#0f172a',
                  border: '2px solid #374151',
                  color: '#ffffff',
                }}
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetConfirmModal(false);
                  setResetConfirmText('');
                }}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                }}
              >
                {isRTL ? 'ביטול' : 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  setShowResetConfirmModal(false);
                  setResetConfirmText('');
                  await handleReset();
                }}
                disabled={(isRTL ? resetConfirmText !== 'מחיקה' : resetConfirmText.toLowerCase() !== 'delete')}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: (isRTL ? resetConfirmText === 'מחיקה' : resetConfirmText.toLowerCase() === 'delete')
                    ? '#ef4444'
                    : 'rgba(239, 68, 68, 0.3)',
                  color: '#ffffff',
                }}
              >
                {isRTL ? 'אפס משחק' : 'Reset Game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Code Modal */}
      {selectedCode && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeCodeModal}
        >
          <div
            className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#1a1a2e' }}
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Header */}
            <div
              className="p-4 text-center"
              style={{
                background: `linear-gradient(135deg, ${CODE_TYPE_CONFIG[selectedCode.codeType]?.color}30 0%, transparent 100%)`,
                borderBottom: `2px solid ${CODE_TYPE_CONFIG[selectedCode.codeType]?.color}`,
              }}
            >
              <button
                onClick={closeCodeModal}
                className="absolute top-3 end-3 p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              {/* Code Type Badge */}
              <div className="flex justify-center mb-3">
                <div
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
                  style={{
                    background: `${CODE_TYPE_CONFIG[selectedCode.codeType]?.color}25`,
                    color: CODE_TYPE_CONFIG[selectedCode.codeType]?.color,
                    border: `1px solid ${CODE_TYPE_CONFIG[selectedCode.codeType]?.color}50`,
                  }}
                >
                  <span className="text-lg">{CODE_TYPE_CONFIG[selectedCode.codeType]?.emoji}</span>
                  <span>{isRTL ? CODE_TYPE_CONFIG[selectedCode.codeType]?.labelHe : CODE_TYPE_CONFIG[selectedCode.codeType]?.labelEn}</span>
                </div>
              </div>

              {/* Code Value - Editable */}
              <input
                type="text"
                value={selectedCode.codeValue}
                onChange={(e) => {
                  const newValue = e.target.value.toUpperCase();
                  updateCode(selectedCode.id, { codeValue: newValue });
                  setSelectedCode({ ...selectedCode, codeValue: newValue });
                }}
                className="font-mono text-3xl font-black tracking-widest bg-transparent border-none outline-none text-center w-full"
                style={{ color: '#ffffff' }}
              />

              {/* Label - Editable */}
              <input
                type="text"
                value={selectedCode.label || ''}
                onChange={(e) => {
                  updateCode(selectedCode.id, { label: e.target.value });
                  setSelectedCode({ ...selectedCode, label: e.target.value });
                }}
                placeholder={isRTL ? 'תווית (אופציונלי)' : 'Label (optional)'}
                className="text-sm bg-transparent border-none outline-none text-center w-full mt-1"
                style={{ color: '#9ca3af' }}
              />

              {/* Hint - Editable */}
              <textarea
                value={selectedCode.hint || ''}
                onChange={(e) => {
                  updateCode(selectedCode.id, { hint: e.target.value });
                  setSelectedCode({ ...selectedCode, hint: e.target.value });
                }}
                placeholder={isRTL ? 'רמז לקוד הבא (אופציונלי)' : 'Hint for next code (optional)'}
                rows={2}
                className="text-sm rounded-lg p-2 w-full mt-2 resize-none"
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid #374151',
                  color: '#9ca3af',
                }}
              />
            </div>

            {/* QR Code */}
            <div className="p-6 flex flex-col items-center">
              {selectedCodeQR ? (
                <div
                  className="p-4 rounded-2xl mb-4"
                  style={{ background: '#ffffff' }}
                >
                  <img
                    src={selectedCodeQR}
                    alt={selectedCode.codeValue}
                    className="w-48 h-48"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 flex items-center justify-center mb-4">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              )}

              {/* Points - Editable */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  value={selectedCode.points}
                  onChange={(e) => {
                    const newPoints = parseInt(e.target.value) || 0;
                    updateCode(selectedCode.id, { points: newPoints });
                    setSelectedCode({ ...selectedCode, points: newPoints });
                  }}
                  min={1}
                  max={1000}
                  className="w-20 px-3 py-2 rounded-lg border text-center text-xl font-bold"
                  style={{
                    background: '#0f172a',
                    borderColor: '#10b981',
                    color: '#10b981',
                  }}
                />
                <span className="text-gray-400">{isRTL ? 'נקודות' : 'points'}</span>
              </div>

              {/* Type Selector */}
              <div className="w-full mb-4">
                <label className="block text-sm text-gray-400 mb-2 text-center">
                  {isRTL ? 'סוג קוד' : 'Code Type'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(CODE_TYPE_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => {
                        updateCode(selectedCode.id, { codeType: key as QHuntCode['codeType'] });
                        setSelectedCode({ ...selectedCode, codeType: key as QHuntCode['codeType'] });
                      }}
                      className="p-2 rounded-lg border-2 transition-all"
                      style={{
                        background: selectedCode.codeType === key ? `${cfg.color}20` : 'transparent',
                        borderColor: selectedCode.codeType === key ? cfg.color : '#374151',
                      }}
                    >
                      <span className="text-lg">{cfg.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 w-full">
                <button
                  onClick={printSingleCode}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all hover:scale-[1.02]"
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <Printer className="w-5 h-5" />
                  {isRTL ? 'הדפס' : 'Print'}
                </button>
                <button
                  onClick={shareCodeWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all hover:scale-[1.02]"
                  style={{
                    background: 'rgba(37, 211, 102, 0.2)',
                    color: '#25d366',
                    border: '1px solid rgba(37, 211, 102, 0.3)'
                  }}
                >
                  <ExternalLink className="w-5 h-5" />
                  WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
