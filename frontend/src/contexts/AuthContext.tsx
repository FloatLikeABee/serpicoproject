import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { usersAPI } from '../services/api';
import { DEFAULT_NATION, hasExplicitNationFlag, parseNation, resolveSessionNation, saveExplicitNation, saveLastNation, saveNation, shouldApplyRemoteNation, type Nation } from '../utils/nation';

export type UserRole = 'police' | 'civilian';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  rank?: string;
  nation?: Nation;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => void;
  setNation: (nation: Nation) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Demo access for the game world. */
export const DEMO_USERNAME = 'serpico';
export const DEMO_PASSWORD = 'cops123';
export const DEMO_USER_ID = 'demo-serpico';

const createUserId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function withNation(user: User): User {
  if (hasExplicitNationFlag(user.id) && user.nation != null && String(user.nation).trim() !== '') {
    return { ...user, nation: parseNation(user.nation) };
  }
  return { ...user, nation: resolveSessionNation(user.id) };
}

function persistUser(user: User) {
  const next = withNation(user);
  localStorage.setItem('user', JSON.stringify(next));
  saveNation(next.id, next.nation || DEFAULT_NATION);
  return next;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    if (!saved) return null;
    try {
      return withNation(JSON.parse(saved) as User);
    } catch {
      return null;
    }
  });

  const applyUser = useCallback((next: User) => {
    const hydrated = persistUser(next);
    setUser(hydrated);
    document.documentElement.lang = hydrated.nation === 'cn' ? 'zh-CN' : 'en';
    if (hasExplicitNationFlag(hydrated.id)) {
      usersAPI.upsertNation(hydrated.id, hydrated.nation || DEFAULT_NATION).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    document.documentElement.lang = user.nation === 'cn' ? 'zh-CN' : 'en';
    usersAPI
      .getMe(user.id)
      .then((res) => {
        const raw = res?.user?.nation;
        if (raw == null || String(raw).trim() === '') return;
        const remote = parseNation(raw);
        if (!shouldApplyRemoteNation(user.id, remote)) return;
        if (remote !== user.nation) {
          const merged = persistUser({ ...user, nation: remote });
          setUser(merged);
          document.documentElement.lang = remote === 'cn' ? 'zh-CN' : 'en';
        }
      })
      .catch(() => undefined);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (username: string, password: string) => {
    const normalized = username.trim().toLowerCase();
    if (normalized !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
      throw new Error('Invalid username or password');
    }
    applyUser({
      id: DEMO_USER_ID,
      email: DEMO_USERNAME,
      name: 'Officer Serpico',
      role: 'police',
      rank: 'Officer',
      nation: resolveSessionNation(DEMO_USER_ID),
    });
  };

  const loginWithGoogle = async () => {
    const id = createUserId();
    applyUser({
      id,
      email: 'user@gmail.com',
      name: 'Google User',
      role: 'police',
      rank: 'Officer',
      nation: resolveSessionNation(id),
    });
  };

  const loginWithApple = async () => {
    const id = createUserId();
    applyUser({
      id,
      email: 'user@icloud.com',
      name: 'Apple User',
      role: 'police',
      rank: 'Officer',
      nation: resolveSessionNation(id),
    });
  };

  const logout = () => {
    if (user?.nation) saveLastNation(user.nation);
    setUser(null);
    localStorage.removeItem('user');
  };

  const setNation = (nation: Nation) => {
    if (!user) return;
    const next = parseNation(nation);
    saveExplicitNation(user.id, next);
    applyUser({ ...user, nation: next });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        loginWithApple,
        logout,
        setNation,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
