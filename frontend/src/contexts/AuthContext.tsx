import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { usersAPI } from '../services/api';
import { DEFAULT_NATION, loadNation, parseNation, saveLastNation, saveNation, type Nation } from '../utils/nation';

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
  const stored = loadNation(user.id);
  const fromUser = parseNation(user.nation);
  const nation = stored !== DEFAULT_NATION || !user.nation ? stored : fromUser;
  return { ...user, nation };
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
    usersAPI.upsertNation(hydrated.id, hydrated.nation || DEFAULT_NATION).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    document.documentElement.lang = user.nation === 'cn' ? 'zh-CN' : 'en';
    usersAPI
      .getMe(user.id)
      .then((res) => {
        const remote = parseNation(res?.user?.nation);
        if (remote && remote !== user.nation) {
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
      nation: loadNation(DEMO_USER_ID),
    });
  };

  const loginWithGoogle = async () => {
    applyUser({
      id: createUserId(),
      email: 'user@gmail.com',
      name: 'Google User',
      role: 'police',
      rank: 'Officer',
    });
  };

  const loginWithApple = async () => {
    applyUser({
      id: createUserId(),
      email: 'user@icloud.com',
      name: 'Apple User',
      role: 'police',
      rank: 'Officer',
    });
  };

  const logout = () => {
    if (user?.nation) saveLastNation(user.nation);
    setUser(null);
    localStorage.removeItem('user');
  };

  const setNation = (nation: Nation) => {
    if (!user) return;
    applyUser({ ...user, nation: parseNation(nation) });
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
