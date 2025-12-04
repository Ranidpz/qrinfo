'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, UserRole, STORAGE_LIMITS } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
          email: firebaseUser.email || '',
          displayName: data.displayName || firebaseUser.displayName || '',
          role: data.role as UserRole,
          storageLimit: data.storageLimit,
          storageUsed: data.storageUsed,
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

  // Create user document in Firestore
  const createUserDocument = async (
    firebaseUser: FirebaseUser,
    displayName: string,
    role: UserRole = 'free'
  ): Promise<User> => {
    const userData = {
      email: firebaseUser.email,
      displayName,
      role,
      storageLimit: STORAGE_LIMITS[role],
      storageUsed: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userData);

    return {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName,
      role,
      storageLimit: STORAGE_LIMITS[role],
      storageUsed: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser);
        setUser(userData);
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const userData = await fetchUserData(result.user);
    setUser(userData);
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string, displayName: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Update Firebase profile
    await updateProfile(result.user, { displayName });

    // Create Firestore document
    const userData = await createUserDocument(result.user, displayName);
    setUser(userData);
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
        signIn,
        signUp,
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
