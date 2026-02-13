'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
  X,
  Search,
  Users,
  Check,
  Trash2,
  Download,
  Copy,
  Loader2,
  MessageCircle,
  ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import type { QTagGuest, QTagStats } from '@/types/qtag';

interface QTagGuestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  codeId: string;
  shortId: string;
}

type FilterTab = 'all' | 'registered' | 'arrived' | 'cancelled';

export default function QTagGuestsModal({ isOpen, onClose, codeId, shortId }: QTagGuestsModalProps) {
  const t = useTranslations('modals');
  const [guests, setGuests] = useState<QTagGuest[]>([]);
  const [stats, setStats] = useState<QTagStats>({
    totalRegistered: 0, totalGuests: 0, totalArrived: 0, totalArrivedGuests: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);
  const [confirmDeleteGuest, setConfirmDeleteGuest] = useState<{ id: string; name: string } | null>(null);
  const [sendingQrGuestId, setSendingQrGuestId] = useState<string | null>(null);
  const [expandedGuestId, setExpandedGuestId] = useState<string | null>(null);

  // Real-time guest updates
  useEffect(() => {
    if (!isOpen || !db || !codeId) return;

    setLoading(true);
    const guestsRef = collection(db, 'codes', codeId, 'qtagGuests');
    const unsubscribe = onSnapshot(guestsRef, (snapshot) => {
      const guestList: QTagGuest[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          codeId: data.codeId,
          name: data.name,
          phone: data.phone,
          plusOneCount: data.plusOneCount || 0,
          plusOneDetails: data.plusOneDetails || [],
          qrToken: data.qrToken,
          isVerified: data.isVerified || false,
          verifiedAt: data.verifiedAt instanceof Timestamp ? data.verifiedAt.toDate() : undefined,
          status: data.status || 'registered',
          arrivedAt: data.arrivedAt instanceof Timestamp ? data.arrivedAt.toDate() : undefined,
          arrivedMarkedBy: data.arrivedMarkedBy,
          qrSentViaWhatsApp: data.qrSentViaWhatsApp || false,
          qrSentAt: data.qrSentAt instanceof Timestamp ? data.qrSentAt.toDate() : undefined,
          registeredAt: data.registeredAt instanceof Timestamp ? data.registeredAt.toDate() : new Date(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined,
          registeredByAdmin: data.registeredByAdmin || false,
        };
      });

      // Sort by registeredAt descending
      guestList.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
      setGuests(guestList);

      // Compute stats
      const arrived = guestList.filter(g => g.status === 'arrived');
      setStats({
        totalRegistered: guestList.filter(g => g.status !== 'cancelled').length,
        totalGuests: guestList.reduce((sum, g) => g.status !== 'cancelled' ? sum + 1 + g.plusOneCount : sum, 0),
        totalArrived: arrived.length,
        totalArrivedGuests: arrived.reduce((sum, g) => sum + 1 + g.plusOneCount, 0),
      });

      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, codeId]);

  // Toggle arrival status
  const toggleArrival = useCallback(async (guest: QTagGuest) => {
    const newStatus = guest.status === 'arrived' ? 'registered' : 'arrived';
    try {
      const res = await fetchWithAuth('/api/qtag/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeId,
          guestId: guest.id,
          status: newStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[QTag] Check-in failed:', res.status, data);
      }
    } catch (err) {
      console.error('[QTag] Check-in error:', err);
    }
  }, [codeId]);

  // Delete guest - show confirmation first
  const handleDeleteClick = useCallback((guest: QTagGuest) => {
    setConfirmDeleteGuest({ id: guest.id, name: guest.name });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!confirmDeleteGuest) return;
    setDeletingGuestId(confirmDeleteGuest.id);
    try {
      const res = await fetchWithAuth(`/api/qtag/guests?codeId=${codeId}&guestId=${confirmDeleteGuest.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[QTag] Delete failed:', res.status, data);
      }
    } catch (err) {
      console.error('[QTag] Delete error:', err);
    } finally {
      setDeletingGuestId(null);
      setConfirmDeleteGuest(null);
    }
  }, [codeId, confirmDeleteGuest]);

  // Send QR via WhatsApp
  const handleSendQR = useCallback(async (guest: QTagGuest) => {
    setSendingQrGuestId(guest.id);
    try {
      const res = await fetchWithAuth('/api/qtag/send-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeId, guestId: guest.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[QTag] Send QR failed:', res.status, data);
      }
    } catch (err) {
      console.error('[QTag] Send QR error:', err);
    } finally {
      setSendingQrGuestId(null);
    }
  }, [codeId]);

  // Export to Excel (client-side generation)
  const handleExport = () => {
    setExporting(true);
    try {
      const rows = guests.map(g => ({
        'Name': g.name,
        'Phone': formatPhoneForDisplay(g.phone || ''),
        '+1 Count': g.plusOneCount || 0,
        '+1 Name': g.plusOneDetails?.[0]?.name || '',
        '+1 Gender': g.plusOneDetails?.[0]?.gender === 'male' ? 'Male' : g.plusOneDetails?.[0]?.gender === 'female' ? 'Female' : '',
        'Status': g.status === 'arrived' ? 'Arrived' : g.status === 'cancelled' ? 'Cancelled' : 'Registered',
        'Registered At': g.registeredAt ? new Date(g.registeredAt).toLocaleString('he-IL') : '',
        'Arrived At': g.arrivedAt ? new Date(g.arrivedAt).toLocaleString('he-IL') : '',
        'Verified': g.isVerified ? 'Yes' : 'No',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 10 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Guests');
      XLSX.writeFile(workbook, `qtag-export-${new Date().toISOString().split('T')[0]}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  // Copy scanner link
  const copyScannerLink = () => {
    const url = `${window.location.origin}/he/dashboard/qtag/${codeId}/scanner`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Filter guests
  const filteredGuests = guests.filter(g => {
    // Tab filter
    if (activeFilter === 'registered' && g.status !== 'registered') return false;
    if (activeFilter === 'arrived' && g.status !== 'arrived') return false;
    if (activeFilter === 'cancelled' && g.status !== 'cancelled') return false;

    // Search filter (name, phone, plus-one names)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (g.name.toLowerCase().includes(q)) return true;
      if (g.phone.includes(q)) return true;
      if (g.plusOneDetails?.some(p => p.name?.toLowerCase().includes(q))) return true;
      return false;
    }

    return true;
  });

  if (!isOpen) return null;

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: t('qtagFilterAll'), count: guests.length },
    { key: 'registered', label: t('qtagFilterRegistered'), count: guests.filter(g => g.status === 'registered').length },
    { key: 'arrived', label: t('qtagFilterArrived'), count: guests.filter(g => g.status === 'arrived').length },
    { key: 'cancelled', label: t('qtagFilterCancelled'), count: guests.filter(g => g.status === 'cancelled').length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/10 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white font-assistant">{t('qtagGuestManagement')}</h2>
            <p className="text-xs text-white/40 mt-0.5">{t('qtagRealTimeUpdates')}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 px-6 py-3 border-b border-white/5">
          <StatBadge label={t('qtagRegistered')} value={stats.totalRegistered} total={stats.totalGuests} color="blue" t={t} />
          <StatBadge label={t('qtagArrived')} value={stats.totalArrived} total={stats.totalArrivedGuests} color="green" t={t} />
          <StatBadge label={t('qtagPending')} value={stats.totalRegistered - stats.totalArrived} color="amber" t={t} />
        </div>

        {/* Actions bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('qtagSearchGuests')}
              className="w-full ps-10 pe-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-assistant text-sm"
              dir="rtl"
            />
          </div>

          {/* Scanner link */}
          <button
            onClick={copyScannerLink}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-assistant"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? t('qtagCopied') : t('qtagScannerLink')}
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-assistant"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {t('qtagExport')}
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-6 py-2 border-b border-white/5">
          {filterTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all font-assistant ${
                activeFilter === tab.key
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Guest list */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-1.5" dir="rtl">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          )}

          {!loading && filteredGuests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-assistant">{t('qtagNoGuests')}</p>
            </div>
          )}

          {filteredGuests.map((guest) => {
            const isExpanded = expandedGuestId === guest.id;
            return (
              <div
                key={guest.id}
                className="rounded-xl bg-white/[0.03] border border-white/5 transition-colors overflow-hidden"
              >
                {/* Collapsed row - tap to expand */}
                <button
                  type="button"
                  onClick={() => setExpandedGuestId(isExpanded ? null : guest.id)}
                  className="flex items-center gap-3 px-4 py-3 w-full text-start hover:bg-white/[0.04] transition-colors"
                >
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    guest.status === 'arrived' ? 'bg-green-400' :
                    guest.status === 'cancelled' ? 'bg-red-400' : 'bg-gray-500'
                  }`} />

                  {/* Name + badges */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-semibold text-white text-sm font-assistant truncate">
                      {guest.name}
                    </span>
                    {guest.plusOneCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex-shrink-0">
                        +{guest.plusOneCount}
                      </span>
                    )}
                    {guest.isVerified && (
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    )}
                  </div>

                  {/* Check-in button + chevron */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); toggleArrival(guest); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); toggleArrival(guest); } }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all font-assistant cursor-pointer ${
                        guest.status === 'arrived'
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {guest.status === 'arrived' ? t('qtagArrivedStatus') : t('qtagCheckIn')}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-0 border-t border-white/5 space-y-2.5">
                    {/* Phone + time */}
                    <div className="flex items-center gap-3 text-xs text-white/50 pt-2.5 flex-wrap">
                      {guest.phone && <span dir="ltr">{guest.phone}</span>}
                      {guest.phone && <span className="text-white/20">|</span>}
                      {guest.status === 'arrived' && guest.arrivedAt ? (
                        <span className="text-green-400/70">
                          {t('qtagArrivedStatus')} {new Date(guest.arrivedAt).toLocaleString('he-IL', {
                            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                          })}
                        </span>
                      ) : (
                        <span>
                          {new Date(guest.registeredAt).toLocaleString('he-IL', {
                            hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
                          })}
                        </span>
                      )}
                    </div>

                    {/* Plus-one details */}
                    {guest.plusOneCount > 0 && guest.plusOneDetails && guest.plusOneDetails.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Users className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>
                          {guest.plusOneDetails
                            .filter(p => p.name)
                            .map(p => p.name)
                            .join(', ') || `+${guest.plusOneCount}`}
                        </span>
                      </div>
                    )}

                    {/* Actions row */}
                    <div className="flex items-center gap-2 pt-1">
                      {/* Send QR via WhatsApp */}
                      {guest.phone && (
                        <button
                          onClick={() => handleSendQR(guest)}
                          disabled={sendingQrGuestId === guest.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 font-assistant ${
                            guest.qrSentViaWhatsApp
                              ? 'text-green-400/70 bg-green-500/10 hover:bg-green-500/15'
                              : 'text-white/50 bg-white/5 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {sendingQrGuestId === guest.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <MessageCircle className="w-3.5 h-3.5" />}
                          {guest.qrSentViaWhatsApp ? t('qtagResendQR') : t('qtagSendQR')}
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteClick(guest)}
                        disabled={deletingGuestId === guest.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-400/70 bg-red-500/10 hover:bg-red-500/15 transition-all disabled:opacity-50 font-assistant ms-auto"
                      >
                        {deletingGuestId === guest.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                        {t('qtagDeleteConfirmYes')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Delete confirmation dialog */}
        {confirmDeleteGuest && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl">
            <div className="bg-[#1e1e38] border border-white/10 rounded-xl p-6 mx-6 max-w-sm w-full shadow-2xl" dir="rtl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold font-assistant text-sm">{t('qtagDeleteConfirm')}</h3>
                  <p className="text-white/40 text-xs mt-0.5 font-assistant">{confirmDeleteGuest.name}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmDelete}
                  disabled={!!deletingGuestId}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium text-sm transition-all font-assistant disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deletingGuestId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {t('qtagDeleteConfirmYes')}
                </button>
                <button
                  onClick={() => setConfirmDeleteGuest(null)}
                  disabled={!!deletingGuestId}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white font-medium text-sm transition-all font-assistant"
                >
                  {t('qtagDeleteConfirmNo')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBadge({ label, value, total, color, t }: {
  label: string;
  value: number;
  total?: number;
  color: 'blue' | 'green' | 'amber';
  t: (key: string) => string;
}) {
  const colors = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  };

  return (
    <div className={`flex-1 text-center py-2 rounded-lg border ${colors[color]}`}>
      <div className="font-bold text-lg">{value}</div>
      <div className="text-[10px] text-white/40">{label}{total !== undefined && total !== value ? ` (${total} ${t('qtagTotal')})` : ''}</div>
    </div>
  );
}
