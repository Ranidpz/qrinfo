'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Download, Loader2, Users, Phone, UserX, RefreshCw } from 'lucide-react';
import { formatPhoneForDisplay } from '@/lib/phone-utils';
import * as XLSX from 'xlsx';

interface VoterVote {
  candidateId: string;
  candidateName: string;
  candidatePhoto: string | null;
  categoryId?: string;
  categoryName?: string;
  round: number;
  createdAt: string;
}

interface VoterEntry {
  voterId: string;
  phone: string | null;
  votes: VoterVote[];
  firstVoteAt: string;
  totalVotes: number;
}

interface QVoteVotersModalProps {
  isOpen: boolean;
  onClose: () => void;
  codeId: string;
  locale?: string;
}

const t = {
  he: {
    title: 'מצביעים',
    searchPlaceholder: 'חיפוש לפי טלפון...',
    anonymous: 'אנונימי',
    noVoters: 'אין מצביעים עדיין',
    noResults: 'לא נמצאו תוצאות',
    exportExcel: 'ייצוא לאקסל',
    round: 'סבב',
    showing: 'מציג',
    of: 'מתוך',
    voters: 'מצביעים',
    loading: 'טוען...',
    phone: 'טלפון',
    votedFor: 'הצביע/ה עבור',
    time: 'זמן',
    category: 'קטגוריה',
    refresh: 'רענן',
    error: 'שגיאה בטעינת הנתונים',
  },
  en: {
    title: 'Voters',
    searchPlaceholder: 'Search by phone...',
    anonymous: 'Anonymous',
    noVoters: 'No voters yet',
    noResults: 'No results found',
    exportExcel: 'Export to Excel',
    round: 'Round',
    showing: 'Showing',
    of: 'of',
    voters: 'voters',
    loading: 'Loading...',
    phone: 'Phone',
    votedFor: 'Voted for',
    time: 'Time',
    category: 'Category',
    refresh: 'Refresh',
    error: 'Error loading data',
  },
};

export default function QVoteVotersModal({
  isOpen,
  onClose,
  codeId,
  locale = 'he',
}: QVoteVotersModalProps) {
  const isRTL = locale === 'he';
  const labels = isRTL ? t.he : t.en;

  const [voters, setVoters] = useState<VoterEntry[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadVoters = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/qvote/voters?codeId=${encodeURIComponent(codeId)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setVoters(data.voters || []);
      setTotalVotes(data.totalVotes || 0);
    } catch (err) {
      console.error('Error loading voters:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVoters();
      setSearchQuery('');
    }
  }, [isOpen, codeId]);

  // Client-side search filter by phone
  const filteredVoters = useMemo(() => {
    if (!searchQuery.trim()) return voters;
    const query = searchQuery.replace(/[^0-9+]/g, '');
    if (!query) return voters;
    return voters.filter((voter) => {
      if (!voter.phone) return false;
      const formatted = formatPhoneForDisplay(voter.phone);
      const digits = formatted.replace(/[^0-9]/g, '');
      return digits.includes(query) || voter.phone.includes(query);
    });
  }, [voters, searchQuery]);

  const handleExportExcel = () => {
    const rows = voters.map((voter) => {
      const candidateNames = voter.votes.map((v) => v.candidateName).join(', ');
      const categories = voter.votes
        .map((v) => v.categoryName)
        .filter(Boolean)
        .join(', ');
      return {
        [labels.phone]: voter.phone ? formatPhoneForDisplay(voter.phone) : labels.anonymous,
        [labels.votedFor]: candidateNames,
        [labels.round]: voter.votes[0]?.round || 1,
        ...(categories ? { [labels.category]: categories } : {}),
        [labels.time]: new Date(voter.firstVoteAt).toLocaleString(
          isRTL ? 'he-IL' : 'en-US'
        ),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isRTL ? 'מצביעים' : 'Voters');
    XLSX.writeFile(workbook, `qvote-voters-${Date.now()}.xlsx`);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString(isRTL ? 'he-IL' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-bg-card border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">
              {labels.title}
            </h2>
            {!loading && (
              <div className="flex items-center gap-2">
                <span className="text-sm bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                  {voters.length}
                </span>
                <span className="text-xs text-text-secondary">
                  ({totalVotes} {isRTL ? 'קולות' : 'votes'})
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadVoters}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
              title={labels.refresh}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="border-b border-border px-6 py-3 shrink-0">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={labels.searchPlaceholder}
              className="w-full ps-10 pe-4 py-2 bg-bg-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent/50"
              dir="ltr"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <span className="text-sm text-text-secondary">{labels.loading}</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-text-secondary">
              {labels.error}
            </div>
          ) : filteredVoters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-secondary">
              <UserX className="w-8 h-8 opacity-50" />
              <span className="text-sm">
                {searchQuery ? labels.noResults : labels.noVoters}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredVoters.map((voter) => (
                <div
                  key={voter.voterId}
                  className="flex items-start gap-3 p-3 rounded-xl bg-bg-secondary border border-border hover:border-border/80 transition-colors"
                >
                  {/* Phone / Anonymous indicator */}
                  <div className="shrink-0 mt-0.5">
                    {voter.phone ? (
                      <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Phone className="w-4 h-4 text-green-500" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-bg-tertiary flex items-center justify-center">
                        <UserX className="w-4 h-4 text-text-secondary" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {/* Phone + time row */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-medium text-text-primary font-mono" dir="ltr">
                        {voter.phone
                          ? formatPhoneForDisplay(voter.phone)
                          : labels.anonymous}
                      </span>
                      <span className="text-xs text-text-secondary whitespace-nowrap" dir="ltr">
                        {formatTime(voter.firstVoteAt)}
                      </span>
                    </div>

                    {/* Candidate chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {voter.votes.map((vote, i) => (
                        <div
                          key={`${vote.candidateId}-${vote.round}-${i}`}
                          className="flex items-center gap-1.5 bg-bg-tertiary rounded-lg px-2 py-1"
                        >
                          {vote.candidatePhoto ? (
                            <img
                              src={vote.candidatePhoto}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-bg-hover" />
                          )}
                          {vote.candidateName && (
                            <span className="text-xs text-text-primary truncate max-w-[120px]">
                              {vote.candidateName}
                            </span>
                          )}
                          {vote.round === 2 && (
                            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1 rounded">
                              {labels.round} 2
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-bg-card border-t border-border px-6 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm text-text-secondary">
            {labels.showing} {filteredVoters.length} {labels.of} {voters.length} {labels.voters}
          </span>
          <button
            onClick={handleExportExcel}
            disabled={voters.length === 0 || loading}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            {labels.exportExcel}
          </button>
        </div>
      </div>
    </div>
  );
}
