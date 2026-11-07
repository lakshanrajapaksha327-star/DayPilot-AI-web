import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db, testConnection } from '../lib/firebase.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors.ts';
import { UserProfile, UserPreferences } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  preferences: UserPreferences | null;
  loading: boolean;
  error: string | null;
  isGuestMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  enterGuestMode: () => void;
  updatePreferencesInDb: (prefs: Partial<UserPreferences>) => Promise<void>;
  updateUserProfileInDb: (profile: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
}

const defaultPreferences: UserPreferences = {
  theme: 'dark',
  notificationsEnabled: true,
  dailyDigest: true,
  streakWarnings: true,
  defaultReminderOffsetMinutes: 15,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  updatedAt: new Date().toISOString(),
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    return localStorage.getItem('daypilot_guest_mode') === 'true';
  });

  // Test connection on boot per Firebase skill guidelines
  useEffect(() => {
    testConnection().catch((err) => console.warn('Connection check note:', err));
  }, []);

  // Listen to Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsGuestMode(false);
        localStorage.removeItem('daypilot_guest_mode');
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const prefDocRef = doc(db, 'users', currentUser.uid, 'preferences', 'settings');

          // Load profile or initialize
          const userSnap = await getDoc(userDocRef);
          const nowStr = new Date().toISOString();

          if (userSnap.exists()) {
            setUserProfile(userSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              userId: currentUser.uid,
              displayName: currentUser.displayName || 'Pilot Explorer',
              email: currentUser.email || '',
              photoURL: currentUser.photoURL || undefined,
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              preferredLanguage: 'English',
              preferredStudyTime: 'evening',
              streakDays: 1,
              lastActiveDate: new Date().toISOString().split('T')[0],
              createdAt: nowStr,
              updatedAt: nowStr,
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }

          // Load preferences or initialize
          const prefSnap = await getDoc(prefDocRef);
          if (prefSnap.exists()) {
            setPreferences(prefSnap.data() as UserPreferences);
          } else {
            await setDoc(prefDocRef, defaultPreferences);
            setPreferences(defaultPreferences);
          }
        } catch (err) {
          console.error('Error fetching user profile from Firestore:', err);
          // If Firestore read fails due to rules or setup, do not break the whole auth state
          setUserProfile({
            userId: currentUser.uid,
            displayName: currentUser.displayName || 'Pilot Explorer',
            email: currentUser.email || '',
            photoURL: currentUser.photoURL || undefined,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            preferredLanguage: 'English',
            preferredStudyTime: 'evening',
            streakDays: 1,
            lastActiveDate: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        if (localStorage.getItem('daypilot_guest_mode') === 'true') {
          setIsGuestMode(true);
          setUserProfile({
            userId: 'guest-pilot',
            displayName: 'Guest Pilot',
            email: 'guest@daypilot.ai',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            preferredLanguage: 'English',
            preferredStudyTime: 'evening',
            streakDays: 3,
            lastActiveDate: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        } else {
          setUserProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      console.error('Sign-in error:', err);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      localStorage.removeItem('daypilot_guest_mode');
      localStorage.removeItem('daypilot_guest_plans');
      localStorage.removeItem('daypilot_guest_tasks');
      localStorage.removeItem('daypilot_guest_reminders');
      localStorage.removeItem('daypilot_guest_memories');
      setUser(null);
      setUserProfile(null);
      setIsGuestMode(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign out failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const enterGuestMode = () => {
    localStorage.setItem('daypilot_guest_mode', 'true');
    setIsGuestMode(true);
    setUserProfile({
      userId: 'guest-pilot',
      displayName: 'Guest Pilot',
      email: 'guest@daypilot.ai',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      preferredLanguage: 'English',
      preferredStudyTime: 'evening',
      streakDays: 3,
      lastActiveDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const updatePreferencesInDb = async (newPrefs: Partial<UserPreferences>) => {
    const updated = { ...preferences, ...newPrefs, updatedAt: new Date().toISOString() };
    setPreferences(updated);

    if (user) {
      const prefDocPath = `users/${user.uid}/preferences/settings`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'preferences', 'settings'), updated, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, prefDocPath);
      }
    }
  };

  const updateUserProfileInDb = async (profileUpdate: Partial<UserProfile>) => {
    if (!userProfile) return;
    const updated: UserProfile = {
      ...userProfile,
      ...profileUpdate,
      updatedAt: new Date().toISOString(),
    };
    setUserProfile(updated);

    if (user) {
      const userDocPath = `users/${user.uid}`;
      try {
        await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, userDocPath);
      }
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        preferences,
        loading,
        error,
        isGuestMode,
        signInWithGoogle,
        signOutUser,
        enterGuestMode,
        updatePreferencesInDb,
        updateUserProfileInDb,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
