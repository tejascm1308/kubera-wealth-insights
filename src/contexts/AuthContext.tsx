import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, userApi, setTokens, clearTokens, getToken, ApiError } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  username: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => getToken());
  const [isLoading, setIsLoading] = useState(true);

  // Load user on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getToken();
      if (storedToken) {
        try {
          const profile = await userApi.getProfile();
          setUser({
            id: profile.id,
            email: profile.email,
            name: profile.name,
            username: profile.username,
          });
          setToken(storedToken);
        } catch (error) {
          console.error('Failed to load user:', error);
          clearTokens();
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    
    setTokens(response.access_token, response.refresh_token);
    setToken(response.access_token);
    setUser(response.user);
    localStorage.setItem('kubera-user', JSON.stringify(response.user));
  };

  const register = async (data: RegisterData) => {
    const response = await authApi.register(data);
    
    setTokens(response.access_token, response.refresh_token);
    setToken(response.access_token);
    setUser(response.user);
    localStorage.setItem('kubera-user', JSON.stringify(response.user));
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore logout errors, still clear local state
      console.error('Logout error:', error);
    }
    setUser(null);
    setToken(null);
    clearTokens();
  };

  const refreshUser = async () => {
    try {
      const profile = await userApi.getProfile();
      setUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        username: profile.username,
      });
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
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
