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

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email: string, password: string) => {
    // Mock login - just create a user
    const mockUser: User = {
      id: '1',
      email: email || 'demo@serpico.com',
      name: 'Demo User',
      role: 'police', // Default to police, can be changed in settings
      rank: 'Officer',
    };
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
  };

  const loginWithGoogle = async () => {
    // Mock Google login
    const mockUser: User = {
      id: '1',
      email: 'user@gmail.com',
      name: 'Google User',
      role: 'police',
      rank: 'Officer',
    };
    setUser(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
  };

  const loginWithApple = async () => {
    // Mock Apple login
    const mockUser: User = {
      id: '1',
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

