import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

export type UserRole = 'DOCTOR' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authenticated: boolean;
  backendReachable: boolean;
  authError: string | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendReachable, setBackendReachable] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAuth = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const res = await apiFetch('/api/auth/me', { signal: controller.signal });
      clearTimeout(timeoutId);
      setBackendReachable(true);
      setAuthError(null);

      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setUser(null);
      setBackendReachable(false);
      const isTimeout = err?.name === 'AbortError';
      const msg = isTimeout
        ? 'Session verification timed out. Backend server may be offline or slow.'
        : (err?.message || 'Unable to connect to backend server.');
      setAuthError(msg);
      console.warn("Auth check failed:", msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Listen for unauthorized events to clear local state immediately
    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener("auth_unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth_unauthorized", handleUnauthorized);
    };
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    setBackendReachable(true);
    setAuthError(null);
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', timeoutMs: 5000 });
    } catch (e) {
      console.error("Logout error", e);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authenticated: !!user,
        backendReachable,
        authError,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
