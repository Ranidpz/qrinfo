'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, User, UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    setLoading(true);

    try {
      // TODO: Implement Firebase registration
      // const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // await updateProfile(userCredential.user, { displayName });
      // Create user document in Firestore
      console.log('Register:', { displayName, email, password });

      // Simulate registration for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/dashboard');
    } catch (err) {
      setError('שגיאה בהרשמה. נסה שוב.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-text-secondary">צור חשבון חדש</p>
        </div>

        {/* Registration Form */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-text-primary mb-2">
                שם מלא
              </label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="השם שלך"
                  required
                  className="input pr-11"
                />
              </div>
            </div>

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
                  placeholder="לפחות 6 תווים"
                  required
                  minLength={6}
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

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-primary mb-2">
                אימות סיסמה
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="הזן שוב את הסיסמה"
                  required
                  dir="ltr"
                  className="input pr-11"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-danger text-center bg-danger/10 py-2 rounded-lg">
                {error}
              </p>
            )}

            {/* Terms */}
            <p className="text-xs text-text-secondary text-center">
              בהרשמה אתה מסכים ל
              <a href="#" className="text-accent hover:underline">תנאי השימוש</a>
              {' '}ו
              <a href="#" className="text-accent hover:underline">מדיניות הפרטיות</a>
            </p>

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
                  <UserPlus className="w-5 h-5" />
                  הירשם
                </>
              )}
            </button>
          </form>

          {/* Login link */}
          <p className="mt-6 text-center text-text-secondary">
            יש לך כבר חשבון?{' '}
            <Link href="/login" className="text-accent hover:underline font-medium">
              התחבר
            </Link>
          </p>
        </div>

        {/* Benefits */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="bg-bg-card/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-accent">1</p>
            <p className="text-xs text-text-secondary">קוד QR בחינם</p>
          </div>
          <div className="bg-bg-card/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-accent">25MB</p>
            <p className="text-xs text-text-secondary">אחסון חינם</p>
          </div>
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
