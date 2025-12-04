'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      setError('אימייל או סיסמה שגויים');
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
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-xl">QR</span>
            </div>
            <span className="font-bold text-2xl text-text-primary">QR.info</span>
          </div>
          <p className="text-text-secondary">היכנס לחשבון שלך</p>
        </div>

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-2">
                אימייל
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  dir="ltr"
                  className="input pr-11"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-2">
                סיסמה
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  className="input pr-11 pl-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div className="text-left">
              <a href="#" className="text-sm text-accent hover:underline">
                שכחת סיסמה?
              </a>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-danger text-center bg-danger/10 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-base disabled:opacity-50"
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  התחברות
                </>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="mt-6 text-center text-text-secondary">
            אין לך חשבון?{' '}
            <Link href="/register" className="text-accent hover:underline font-medium">
              הירשם עכשיו
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-text-secondary">
          נבנה על ידי{' '}
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
    </div>
  );
}
