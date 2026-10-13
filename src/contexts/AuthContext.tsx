'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithCustomToken,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  /** Exchange the token from /api/auth/otp/verify for a Firebase session. */
  signInWithLoginToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user data from Firestore
  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          id: firebaseUser.uid,
          email: firebaseUser.email || data.email || '',
          displayName: data.displayName || firebaseUser.displayName || '',
          role: data.role as UserRole,
          storageLimit: data.storageLimit,
          storageUsed: data.storageUsed,
          status: data.status,
          signupMethod: data.signupMethod,
          phone: data.phone,
          businessName: data.businessName,
          approvalRequestedAt: data.approvalRequestedAt?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  // Load the profile, creating it server-side on first sign-in. Profiles are
  // created only by /api/auth/bootstrap (it sets the approval status), never here.
  const ensureUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    const existing = await fetchUserData(firebaseUser);
    if (existing) return existing;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/auth/bootstrap', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error('[Auth] Profile bootstrap failed:', res.status);
        return null;
      }
    } catch (error) {
      console.error('[Auth] Profile bootstrap error:', error);
      return null;
    }
    return fetchUserData(firebaseUser);
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        setUser(await ensureUserData(firebaseUser));
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with Google
  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    setUser(await ensureUserData(result.user));
  };

  const signInWithLoginToken = async (token: string) => {
    const result = await signInWithCustomToken(auth, token);
    setUser(await ensureUserData(result.user));
  };

  // Sign out
  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
  };

  // Refresh user data
  const refreshUser = async () => {
    if (firebaseUser) {
      const userData = await fetchUserData(firebaseUser);
      setUser(userData);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        signInWithGoogle,
        signInWithLoginToken,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
