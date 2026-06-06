'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as api from '@/lib/api';

interface AuthContextType {
  username: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await api.getSession();
      if (res.success && res.username) {
        setUsername(res.username);
      } else {
        setUsername(null);
      }
    } catch {
      setUsername(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [checkSession]);

  const loginHandler = useCallback(async (user: string, pass: string): Promise<string | null> => {
    try {
      const res = await api.login(user, pass);
      if (res.success) {
        setUsername(res.username || user);
        return null;
      }
      return res.message;
    } catch (err: unknown) {
      return err instanceof Error ? err.message : '登录失败';
    }
  }, []);

  const registerHandler = useCallback(async (user: string, pass: string): Promise<string | null> => {
    try {
      const res = await api.register(user, pass);
      if (res.success) {
        return null;
      }
      return res.message;
    } catch (err: unknown) {
      return err instanceof Error ? err.message : '注册失败';
    }
  }, []);

  const logoutHandler = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUsername(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        username,
        isLoading,
        login: loginHandler,
        register: registerHandler,
        logout: logoutHandler,
        checkSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
