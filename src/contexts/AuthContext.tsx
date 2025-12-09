import React, { createContext, useContext, useState, useEffect } from 'react';

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
  logout: () => void;
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
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('kubera-token');
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('kubera-user');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, [token]);

  const login = async (email: string, password: string) => {
    // Simulate API call - replace with actual backend integration
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    // Mock successful login
    const mockUser: User = {
      id: '1',
      email,
      name: 'Demo User',
      username: 'demouser',
    };
    const mockToken = 'mock-jwt-token-' + Date.now();
    
    setUser(mockUser);
    setToken(mockToken);
    localStorage.setItem('kubera-token', mockToken);
    localStorage.setItem('kubera-user', JSON.stringify(mockUser));
  };

  const register = async (data: RegisterData) => {
    // Simulate API call - replace with actual backend integration
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const mockUser: User = {
      id: '1',
      email: data.email,
      name: data.name,
      username: data.username,
    };
    const mockToken = 'mock-jwt-token-' + Date.now();
    
    setUser(mockUser);
    setToken(mockToken);
    localStorage.setItem('kubera-token', mockToken);
    localStorage.setItem('kubera-user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('kubera-token');
    localStorage.removeItem('kubera-user');
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
