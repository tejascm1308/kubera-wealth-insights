import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, userApi, setTokens, clearTokens, getToken, ApiError } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  email_verified?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requiresVerification: boolean;
  pendingUserId: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<{ requiresVerification: boolean; userId?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  verifyEmail: (otpCode: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  clearPendingVerification: () => void;
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
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Load user on mount if token exists
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = getToken();
      if (storedToken) {
        try {
          const response = await userApi.getProfile();
          const profile = response.user;
          setUser({
            id: profile.user_id,
            email: profile.email,
            name: profile.name,
            username: profile.username,
            email_verified: profile.email_verified,
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

  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    const response = await authApi.login(username, password);
    
    setTokens(response.access_token, response.refresh_token);
    setToken(response.access_token);
    
    const userData: User = {
      id: response.user.user_id,
      email: response.user.email,
      name: response.user.name,
      username: response.user.username,
      email_verified: response.user.email_verified,
    };
    
    setUser(userData);
    localStorage.setItem('kubera-user', JSON.stringify(userData));
    
    // Clear any pending verification state
    setRequiresVerification(false);
    setPendingUserId(null);
  };

  const register = async (data: RegisterData): Promise<{ requiresVerification: boolean; userId?: string }> => {
    const response = await authApi.register(data);
    
    if (response.requires_verification) {
      // Store pending verification state
      setRequiresVerification(true);
      setPendingUserId(response.user_id);
      return { requiresVerification: true, userId: response.user_id };
    }
    
    // If no verification required, login directly (shouldn't happen typically)
    return { requiresVerification: false };
  };

  const verifyEmail = async (otpCode: string) => {
    if (!pendingUserId) {
      throw new Error('No pending verification');
    }
    
    await authApi.verifyEmail(pendingUserId, otpCode);
    
    // Clear verification state
    setRequiresVerification(false);
    setPendingUserId(null);
  };

  const resendVerification = async () => {
    if (!pendingUserId) {
      throw new Error('No pending verification');
    }
    
    await authApi.resendVerification(pendingUserId);
  };

  const clearPendingVerification = () => {
    setRequiresVerification(false);
    setPendingUserId(null);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setToken(null);
    setRequiresVerification(false);
    setPendingUserId(null);
    clearTokens();
  };

  const refreshUser = async () => {
    try {
      const response = await userApi.getProfile();
      const profile = response.user;
      setUser({
        id: profile.user_id,
        email: profile.email,
        name: profile.name,
        username: profile.username,
        email_verified: profile.email_verified,
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
        requiresVerification,
        pendingUserId,
        login,
        register,
        logout,
        refreshUser,
        verifyEmail,
        resendVerification,
        clearPendingVerification,
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
