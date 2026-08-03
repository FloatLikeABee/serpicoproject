import React, { createContext, useContext, useState, ReactNode } from 'react';
import { authAPI, clearAuthSession, setAuthSession } from '../services/api';
import { syncChatFromServer } from '../utils/userSync';

export type UserRole = 'police' | 'civilian';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  rank?: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => void;
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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (username: string, password: string) => {
    const normalized = username.trim().toLowerCase();
    if (normalized !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
      throw new Error('Invalid username or password');
    }

    const { user: remoteUser, token } = await authAPI.login(normalized, password);
    const loggedIn: User = {
      id: remoteUser.id,
      email: remoteUser.email,
      name: remoteUser.name,
      role: remoteUser.role as UserRole,
      rank: remoteUser.rank,
    };
    setAuthSession(token, loggedIn);
    setUser(loggedIn);
    void syncChatFromServer(loggedIn.id);
  };

  const loginWithGoogle = async () => {
    const mockUser: User = {
      id: createUserId(),
      email: 'user@gmail.com',
      name: 'Google User',
      role: 'police',
      rank: 'Officer',
    };
    setAuthSession(null, mockUser);
    setUser(mockUser);
  };

  const loginWithApple = async () => {
    const mockUser: User = {
      id: createUserId(),
      email: 'user@icloud.com',
      name: 'Apple User',
      role: 'police',
      rank: 'Officer',
    };
    setAuthSession(null, mockUser);
    setUser(mockUser);
  };

  const logout = () => {
    setUser(null);
    clearAuthSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginWithGoogle,
        loginWithApple,
        logout,
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
