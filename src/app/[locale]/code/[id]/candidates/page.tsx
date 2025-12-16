'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCandidates, updateCandidate, deleteCandidate, batchUpdateCandidateStatus } from '@/lib/qvote';
import { Candidate, QVoteConfig } from '@/types/qvote';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowRight,
  Check,
  XCircle,
  Eye,
  EyeOff,
  Trophy,
  Loader2,
  User,
  Calendar,
  Image as ImageIcon,
  RefreshCw,
  X,
  Vote,
  ExternalLink,
} from 'lucide-react';

export default function QVoteCandidatesPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const codeId = params.id as string;
  const locale = (params.locale as string) || 'he';
  const isRTL = locale === 'he';

  const [code, setCode] = useState<{ title?: string; shortId?: string; ownerId?: string } | null>(null);
  const [qvoteConfig, setQvoteConfig] = useState<QVoteConfig | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'finalists'>('all');
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load code and candidates
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load code document
        const codeDoc = await getDoc(doc(db, 'codes', codeId));
        if (!codeDoc.exists()) {
          setError(isRTL ? 'הקוד לא נמצא' : 'Code not found');
          setLoading(false);
          return;
        }

        const codeData = codeDoc.data();
        setCode({
          title: codeData.title,
          shortId: codeData.shortId,
          ownerId: codeData.ownerId,
        });

        // Find Q.Vote config
        const qvoteMedia = codeData.media?.find((m: { type: string }) => m.type === 'qvote');
        if (qvoteMedia?.qvoteConfig) {
          setQvoteConfig(qvoteMedia.qvoteConfig);
        }

        // Load candidates
        const loaded = await getCandidates(codeId);
        setCandidates(loaded);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(isRTL ? 'שגיאה בטעינת הנתונים' : 'Error loading data');
      } finally {
        setLoading(false);
      }
    };

    if (codeId) {
      loadData();
    }
  }, [codeId, isRTL]);

  // Check authorization
  const isAuthorized = user && code && (code.ownerId === user.id || user.role === 'super_admin');

  // Filter candidates
  const filteredCandidates = candidates.filter((c) => {
    switch (filter) {
      case 'pending':
        return !c.isApproved && !c.isHidden;
      case 'approved':
        return c.isApproved;
      case 'finalists':
        return c.isFinalist;
      default:
        return true;
    }
  });

  // Actions
  const handleApprove = async (candidateId: string, approve: boolean) => {
    setUpdating(candidateId);
    try {
      await updateCandidate(codeId, candidateId, { isApproved: approve });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, isApproved: approve } : c))
      );
    } catch (error) {
      console.error('Error updating candidate:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleHidden = async (candidateId: string, hide: boolean) => {
    setUpdating(candidateId);
    try {
      await updateCandidate(codeId, candidateId, { isHidden: hide });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, isHidden: hide } : c))
      );
    } catch (error) {
      console.error('Error updating candidate:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggleFinalist = async (candidateId: string, isFinalist: boolean) => {
    setUpdating(candidateId);
    try {
      await updateCandidate(codeId, candidateId, { isFinalist });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidateId ? { ...c, isFinalist } : c))
      );
    } catch (error) {
      console.error('Error updating candidate:', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (candidateId: string) => {
    if (!confirm(isRTL ? 'למחוק את המועמד?' : 'Delete candidate?')) return;

    setUpdating(candidateId);
    try {
      await deleteCandidate(codeId, candidateId);
      setCandidates((prev) => prev.filter((c) => c.id !== candidateId));
    } catch (error) {
      console.error('Error deleting candidate:', error);
    } finally {
      setUpdating(null);
    }
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    if (selectedCandidates.length === 0) return;
    setUpdating('bulk');
    try {
      await batchUpdateCandidateStatus(codeId, selectedCandidates, { isApproved: true });
      setCandidates((prev) =>
        prev.map((c) =>
          selectedCandidates.includes(c.id) ? { ...c, isApproved: true } : c
        )
      );
      setSelectedCandidates([]);
    } catch (error) {
      console.error('Error bulk approving:', error);
    } finally {
      setUpdating(null);
    }
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.length === filteredCandidates.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(filteredCandidates.map((c) => c.id));
    }
  };

  const refreshCandidates = async () => {
    setLoading(true);
    try {
      const loaded = await getCandidates(codeId);
      setCandidates(loaded);
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const pendingCount = candidates.filter((c) => !c.isApproved && !c.isHidden).length;
  const approvedCount = candidates.filter((c) => c.isApproved).length;
  const finalistCount = candidates.filter((c) => c.isFinalist).length;

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <p className="text-danger mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="btn bg-accent text-white hover:bg-accent-hover"
          >
            {isRTL ? 'חזרה' : 'Go back'}
          </button>
        </div>
      </div>
    );
  }

  // Unauthorized
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="text-center">
          <p className="text-text-secondary mb-4">
            {isRTL ? 'אין לך הרשאה לצפות בדף זה' : 'You do not have permission to view this page'}
          </p>
          <button
            onClick={() => router.push(`/${locale}/login`)}
            className="btn bg-accent text-white hover:bg-accent-hover"
          >
            {isRTL ? 'התחברות' : 'Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/${locale}/code/${codeId}`)}
                className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
              >
                <ArrowRight className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <Vote className="w-5 h-5 text-accent" />
                  <h1 className="text-lg font-semibold text-text-primary">
                    {isRTL ? 'ניהול מועמדים' : 'Manage Candidates'}
                  </h1>
                </div>
                {code?.title && (
                  <p className="text-sm text-text-secondary">{code.title}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {code?.shortId && (
                <a
                  href={`/v/${code.shortId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn bg-bg-secondary text-text-primary hover:bg-bg-hover text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {isRTL ? 'צפה בדף' : 'View page'}
                </a>
              )}
              <button
                onClick={refreshCandidates}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary"
                title={isRTL ? 'רענן' : 'Refresh'}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="bg-bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-accent text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {isRTL ? 'הכל' : 'All'} ({candidates.length})
              </button>
              <button
                onClick={() => setFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'pending'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {isRTL ? 'ממתינים' : 'Pending'} ({pendingCount})
              </button>
              <button
                onClick={() => setFilter('approved')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === 'approved'
                    ? 'bg-green-500 text-white'
                    : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                }`}
              >
                {isRTL ? 'מאושרים' : 'Approved'} ({approvedCount})
              </button>
              {qvoteConfig?.enableFinals && (
                <button
                  onClick={() => setFilter('finalists')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filter === 'finalists'
                      ? 'bg-purple-500 text-white'
                      : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {isRTL ? 'פינליסטים' : 'Finalists'} ({finalistCount})
                </button>
              )}
            </div>

            {/* Bulk actions */}
            {selectedCandidates.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">
                  {isRTL ? `${selectedCandidates.length} נבחרו` : `${selectedCandidates.length} selected`}
                </span>
                <button
                  onClick={handleBulkApprove}
                  disabled={updating === 'bulk'}
                  className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50"
                >
                  {updating === 'bulk' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    isRTL ? 'אשר הכל' : 'Approve All'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{isRTL ? 'אין מועמדים להצגה' : 'No candidates to display'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Select all */}
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <input
                type="checkbox"
                checked={selectedCandidates.length === filteredCandidates.length && filteredCandidates.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
              />
              <span className="text-sm text-text-secondary">
                {isRTL ? 'בחר הכל' : 'Select all'}
              </span>
            </div>

            {/* Candidates list */}
            {filteredCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  candidate.isHidden
                    ? 'bg-bg-secondary/50 border-border opacity-60'
                    : candidate.isApproved
                    ? 'bg-green-500/5 border-green-500/30'
                    : 'bg-bg-card border-border'
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedCandidates.includes(candidate.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedCandidates((prev) => [...prev, candidate.id]);
                    } else {
                      setSelectedCandidates((prev) => prev.filter((id) => id !== candidate.id));
                    }
                  }}
                  className="w-4 h-4 rounded border-border text-accent focus:ring-accent shrink-0"
                />

                {/* Photo */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-bg-hover shrink-0">
                  {candidate.photos[0] ? (
                    <img
                      src={candidate.photos[0].thumbnailUrl || candidate.photos[0].url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-text-secondary" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-primary truncate">
                      {candidate.name || candidate.formData?.name || (isRTL ? 'ללא שם' : 'No name')}
                    </p>
                    {candidate.isFinalist && (
                      <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(candidate.createdAt).toLocaleDateString(locale)}
                    </span>
                    {candidate.voteCount > 0 && (
                      <span>{candidate.voteCount} {isRTL ? 'קולות' : 'votes'}</span>
                    )}
                  </div>
                  {/* Form data */}
                  {Object.entries(candidate.formData || {}).slice(0, 2).map(([key, value]) => (
                    <p key={key} className="text-xs text-text-secondary truncate mt-0.5">
                      {value}
                    </p>
                  ))}
                </div>

                {/* Status badges */}
                <div className="flex items-center gap-2 shrink-0">
                  {candidate.isApproved ? (
                    <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-500 text-xs font-medium">
                      {isRTL ? 'מאושר' : 'Approved'}
                    </span>
                  ) : candidate.isHidden ? (
                    <span className="px-2 py-1 rounded-full bg-gray-500/20 text-gray-400 text-xs font-medium">
                      {isRTL ? 'מוסתר' : 'Hidden'}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-500 text-xs font-medium">
                      {isRTL ? 'ממתין' : 'Pending'}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {updating === candidate.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-accent" />
                  ) : (
                    <>
                      {/* Approve/Reject */}
                      {!candidate.isApproved ? (
                        <button
                          onClick={() => handleApprove(candidate.id, true)}
                          className="p-2 rounded-lg hover:bg-green-500/20 text-green-500 transition-colors"
                          title={isRTL ? 'אשר' : 'Approve'}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApprove(candidate.id, false)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                          title={isRTL ? 'בטל אישור' : 'Unapprove'}
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      )}

                      {/* Toggle visibility */}
                      <button
                        onClick={() => handleToggleHidden(candidate.id, !candidate.isHidden)}
                        className={`p-2 rounded-lg transition-colors ${
                          candidate.isHidden
                            ? 'hover:bg-accent/20 text-accent'
                            : 'hover:bg-bg-hover text-text-secondary'
                        }`}
                        title={candidate.isHidden ? (isRTL ? 'הצג' : 'Show') : (isRTL ? 'הסתר' : 'Hide')}
                      >
                        {candidate.isHidden ? (
                          <Eye className="w-5 h-5" />
                        ) : (
                          <EyeOff className="w-5 h-5" />
                        )}
                      </button>

                      {/* Toggle finalist */}
                      {qvoteConfig?.enableFinals && candidate.isApproved && (
                        <button
                          onClick={() => handleToggleFinalist(candidate.id, !candidate.isFinalist)}
                          className={`p-2 rounded-lg transition-colors ${
                            candidate.isFinalist
                              ? 'bg-yellow-500/20 text-yellow-500'
                              : 'hover:bg-yellow-500/20 text-text-secondary hover:text-yellow-500'
                          }`}
                          title={isRTL ? 'פינליסט' : 'Finalist'}
                        >
                          <Trophy className="w-5 h-5" />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(candidate.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-text-secondary hover:text-red-500 transition-colors"
                        title={isRTL ? 'מחק' : 'Delete'}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer stats */}
      <footer className="fixed bottom-0 left-0 right-0 bg-bg-card border-t border-border py-3">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="text-sm text-text-secondary">
            {isRTL
              ? `${approvedCount} מאושרים מתוך ${candidates.length}`
              : `${approvedCount} approved out of ${candidates.length}`}
          </div>
          <div className="text-sm text-text-secondary">
            {isRTL ? `${pendingCount} ממתינים לאישור` : `${pendingCount} pending approval`}
          </div>
        </div>
      </footer>
    </div>
  );
}
