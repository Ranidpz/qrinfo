'use client';

import { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { X, Clock, BarChart3, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Translations
  const t = useTranslations('login');
  const tAuth = useTranslations('auth');
  const tTerms = useTranslations('terms');
  const tFeatures = useTranslations('features');

  // Check if user already accepted terms
  useEffect(() => {
    const accepted = localStorage.getItem('terms_accepted') === 'true';
    setTermsAccepted(accepted);
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleGoogleSignIn = async () => {
    // If terms not accepted, show terms modal first
    if (!termsAccepted) {
      setShowTerms(true);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setError(tAuth('signInError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    localStorage.setItem('terms_accepted', 'true');
    setTermsAccepted(true);
    setShowTerms(false);

    // Directly sign in after accepting terms
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setError(tAuth('signInError'));
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Hero */}
        <div className="text-center mb-8">
          {/* Logo - large with bounce-in animation */}
          <div className="w-32 h-32 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-logo-bounce-in">
            <Image
              src="/theQ.png"
              alt="The Q"
              width={128}
              height={128}
              className="rounded-2xl"
              priority
            />
          </div>

          <p className="text-lg text-accent font-medium">{t('tagline')}</p>
          <div className="flex justify-center my-3">
            <div className="w-32 h-1 bg-gradient-to-r from-transparent via-accent to-transparent rounded-full" />
          </div>
          <p className="text-sm text-text-secondary">
            {t('description')}
            <br />
            <span className="text-accent font-medium">{t('safeCode')}</span>
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-bg-card/50 rounded-lg p-2 text-center">
            <RefreshCw className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-[10px] text-text-secondary">{tFeatures('realTimeChange')}</p>
          </div>
          <div className="bg-bg-card/50 rounded-lg p-2 text-center">
            <Clock className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-[10px] text-text-secondary">{tFeatures('scheduledExperiences')}</p>
          </div>
          <div className="bg-bg-card/50 rounded-lg p-2 text-center">
            <BarChart3 className="w-4 h-4 text-accent mx-auto mb-1" />
            <p className="text-[10px] text-text-secondary">{tFeatures('liveAnalytics')}</p>
          </div>
        </div>

        {/* Login Card */}
        <div className="card text-center">
          {/* Error message */}
          {error && (
            <p className="text-sm text-danger bg-danger/10 py-2 rounded-lg mb-4">
              {error}
            </p>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-lg border border-gray-300 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full" />
            ) : (
              <>
                {/* Google Icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {tAuth('signInWithGoogle')}
              </>
            )}
          </button>

          {/* Info */}
          <p className="mt-6 text-xs text-text-secondary">
            {tAuth('bySigningIn')}{' '}
            <button
              onClick={() => setShowTerms(true)}
              className="text-accent hover:underline"
            >
              {tAuth('termsOfService')}
            </button>
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="bg-bg-card/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-accent">1</p>
            <p className="text-xs text-text-secondary">{t('freeCode')}</p>
          </div>
          <div className="bg-bg-card/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-accent">25MB</p>
            <p className="text-xs text-text-secondary">{t('freeStorage')}</p>
          </div>
        </div>

        {/* Use Cases */}
        <div className="mt-6 text-center">
          <p className="text-xs text-text-secondary mb-2">{t('suitableFor')}</p>
          <p className="text-xs text-text-secondary/70">
            {t('useCases')}
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-text-secondary">
          by{' '}
          <a
            href="https://playzone.co.il"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Playzone
          </a>
        </p>
      </div>

      {/* Terms of Service Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-card border border-border rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-primary">{tTerms('title')}</h3>
              <button
                onClick={() => setShowTerms(false)}
                className="p-1.5 rounded-lg hover:bg-bg-secondary transition-colors"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="space-y-4 text-sm text-text-secondary leading-relaxed">
              <section>
                <h4 className="font-semibold text-text-primary mb-2">{tTerms('whatIsQueue')}</h4>
                <p>{tTerms('whatIsQueueDesc')}</p>
              </section>

              <section>
                <h4 className="font-semibold text-text-primary mb-2">{tTerms('alphaVersion')}</h4>
                <p>{tTerms('alphaVersionDesc')}</p>
              </section>

              <section>
                <h4 className="font-semibold text-text-primary mb-2">{tTerms('contentResponsibility')}</h4>
                <p>{tTerms('contentResponsibilityDesc')}</p>
                <p className="mt-2">{tTerms('serviceRights')}</p>
              </section>

              <section>
                <h4 className="font-semibold text-text-primary mb-2">{tTerms('privacy')}</h4>
                <p>{tTerms('privacyDesc')}</p>
              </section>

              <section>
                <h4 className="font-semibold text-text-primary mb-2">{tTerms('liability')}</h4>
                <p>{tTerms('liabilityDesc')}</p>
              </section>

              <section>
                <h4 className="font-semibold text-text-primary mb-2">{tTerms('termsChanges')}</h4>
                <p>{tTerms('termsChangesDesc')}</p>
              </section>
            </div>

            <button
              onClick={handleAcceptTerms}
              className="mt-6 w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-gray-50 text-gray-800 font-medium rounded-lg border border-gray-300 transition-colors"
            >
              {/* Google Icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {tAuth('agreeAndSignIn')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
