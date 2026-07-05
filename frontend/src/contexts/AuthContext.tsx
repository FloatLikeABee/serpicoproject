import React, { createContext, useContext, useState, ReactNode } from 'react';

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
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const createUserId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `user-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email: string, password: string) => {
    const mockUser: User = {
      id: createUserId(),
      email: email || 'demo@serpico.com',
      name: 'Demo User',
      role: 'police',
      rank: 'Officer',
    };
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
  };

  const loginWithGoogle = async () => {
    const mockUser: User = {
      id: createUserId(),
      email: 'user@gmail.com',
      name: 'Google User',
      role: 'police',
      rank: 'Officer',
    };
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
  };

  const loginWithApple = async () => {
    const mockUser: User = {
      id: createUserId(),
      email: 'user@icloud.com',
      name: 'Apple User',
      role: 'police',
      rank: 'Officer',
    };
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
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

