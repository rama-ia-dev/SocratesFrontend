import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, SESSION_EXPIRED_EVENT, USE_MOCK } from '../lib/api';
import { UserPublic } from '../types/api';

interface AuthContextType {
  user: UserPublic | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserLocal: (updated: Partial<UserPublic>) => void;
  switchMockRole: (role: 'superadmin' | 'professor' | 'student') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  // isLoading es solo para el chequeo inicial de sesión: si el login lo activara, las rutas
  // mostrarían el spinner, desmontarían el formulario y se perdería el mensaje de error.
  const login = async (email: string, pass: string) => {
    await api.login({ email, password: pass });
    const me = await api.getMe();
    setUser(me);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  const updateUserLocal = (updated: Partial<UserPublic>) => {
    if (user) {
      setUser({ ...user, ...updated });
    }
  };

  const switchMockRole = async (role: 'superadmin' | 'professor' | 'student') => {
    if (USE_MOCK) {
      api.setMockRole(role);
      const me = await api.getMe();
      setUser(me);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        logout,
        refreshUser,
        updateUserLocal,
        switchMockRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
