// API Configuration and Service Layer for KUBERA Backend

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

// Token management
export const getToken = (): string | null => {
  return localStorage.getItem('kubera-token');
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('kubera-refresh-token');
};

export const setTokens = (accessToken: string, refreshToken?: string) => {
  localStorage.setItem('kubera-token', accessToken);
  if (refreshToken) {
    localStorage.setItem('kubera-refresh-token', refreshToken);
  }
};

export const clearTokens = () => {
  localStorage.removeItem('kubera-token');
  localStorage.removeItem('kubera-refresh-token');
  localStorage.removeItem('kubera-user');
};

// API request wrapper with auth
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Try to refresh token
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry request with new token
      const newToken = getToken();
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
      
      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({}));
        throw new ApiError(retryResponse.status, error.detail || 'Request failed');
      }
      return retryResponse.json();
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || error.message || 'Request failed');
  }

  // Handle empty responses
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      setTokens(data.access_token, data.refresh_token);
      return true;
    }
  } catch {
    // Refresh failed
  }
  return false;
}

// Custom error class
export class ApiError extends Error {
  status: number;
  
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ==================== AUTH API ====================

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
  };
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  username: string;
}

export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Invalid credentials');
    }

    return response.json();
  },

  register: async (data: RegisterData): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE}/auth/register/step1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Registration failed');
    }

    return response.json();
  },

  checkUsername: async (username: string): Promise<{ available: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/auth/username-available?username=${encodeURIComponent(username)}`);
    return response.json();
  },

  logout: async (): Promise<void> => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      clearTokens();
    }
  },
};

// ==================== USER API ====================

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  username: string;
  risk_tolerance?: string;
  investment_horizon?: string;
  created_at?: string;
}

export const userApi = {
  getProfile: (): Promise<UserProfile> => apiRequest('/user/profile'),
  
  updateProfile: (data: Partial<UserProfile>): Promise<UserProfile> =>
    apiRequest('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ==================== PORTFOLIO API ====================

export interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  avg_price: number;
  sector?: string;
  notes?: string;
}

export const portfolioApi = {
  getHoldings: (): Promise<Holding[]> => apiRequest('/portfolio'),
  
  addHolding: (data: Omit<Holding, 'id'>): Promise<Holding> =>
    apiRequest('/portfolio', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateHolding: (id: string, data: Partial<Holding>): Promise<Holding> =>
    apiRequest(`/portfolio/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteHolding: (id: string): Promise<void> =>
    apiRequest(`/portfolio/${id}`, { method: 'DELETE' }),
};

// ==================== CHATS API ====================

export interface ChatSummary {
  id: string;
  title: string;
  last_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface ChatDetail {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export const chatsApi = {
  getChats: (): Promise<ChatSummary[]> => apiRequest('/chats'),
  
  getChat: (id: string): Promise<ChatDetail> => apiRequest(`/chats/${id}`),
  
  createChat: (title?: string): Promise<ChatSummary> =>
    apiRequest('/chats', {
      method: 'POST',
      body: JSON.stringify({ title: title || 'New Chat' }),
    }),
  
  updateChat: (id: string, data: { title: string }): Promise<ChatSummary> =>
    apiRequest(`/chats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  deleteChat: (id: string): Promise<void> =>
    apiRequest(`/chats/${id}`, { method: 'DELETE' }),
};

// ==================== WEBSOCKET ====================

export const getWebSocketUrl = (chatId: string): string => {
  const token = getToken();
  return `${WS_BASE}/ws/chat?token=${token}&chat_id=${chatId}`;
};

export { API_BASE, WS_BASE };
