// API Configuration and Service Layer for KUBERA Backend
// Complete API integration with all 50+ endpoints

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

// ==================== TOKEN MANAGEMENT ====================

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

// ==================== API REQUEST WRAPPER ====================

export class ApiError extends Error {
  status: number;
  code?: string;
  
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

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
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getToken();
      (headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
      
      if (!retryResponse.ok) {
        const error = await retryResponse.json().catch(() => ({}));
        throw new ApiError(retryResponse.status, error.detail || error.message || 'Request failed', error.error_code);
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
    throw new ApiError(response.status, error.detail || error.message || 'Request failed', error.error_code);
  }

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

// ==================== AUTH API ====================

export interface LoginResponse {
  success: boolean;
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: {
    user_id: string;
    username: string;
    email: string;
    name: string;
    email_verified: boolean;
  };
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user_id: string;
  requires_verification: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  username: string;
}

export const authApi = {
  // POST /auth/login - Login with username/password
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || error.message || 'Invalid credentials', error.error_code);
    }

    return response.json();
  },

  // POST /auth/register - Register new user
  register: async (data: RegisterData): Promise<RegisterResponse> => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || error.message || 'Registration failed', error.error_code);
    }

    return response.json();
  },

  // GET /auth/check-username/{username} - Check username availability
  checkUsername: async (username: string): Promise<{ available: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/auth/check-username/${encodeURIComponent(username)}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to check username');
    }
    return response.json();
  },

  // POST /auth/verify-email - Verify email with OTP
  verifyEmail: async (userId: string, otpCode: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, otp_code: otpCode }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Verification failed');
    }

    return response.json();
  },

  // POST /auth/resend-verification - Resend verification email
  resendVerification: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to resend verification');
    }

    return response.json();
  },

  // POST /auth/password-reset/send-otp - Send password reset OTP
  sendPasswordResetOTP: async (email: string): Promise<{ success: boolean; message: string; expires_in: number }> => {
    const response = await fetch(`${API_BASE}/auth/password-reset/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to send OTP');
    }

    return response.json();
  },

  // POST /auth/password-reset/confirm - Confirm password reset
  confirmPasswordReset: async (
    email: string,
    otpCode: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await fetch(`${API_BASE}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to reset password');
    }

    return response.json();
  },

  // POST /auth/refresh - Refresh access token
  refresh: async (refreshToken: string): Promise<{ success: boolean; access_token: string; refresh_token: string; expires_in: number }> => {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Failed to refresh token');
    }

    return response.json();
  },

  // POST /auth/logout - Logout user
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
  user_id: string;
  username: string;
  email: string;
  name: string;
  email_verified: boolean;
  risk_tolerance?: string;
  investment_horizon?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UserStats {
  total_chats: number;
  total_messages: number;
  total_tokens_used: number;
  favorite_stocks: string[];
  member_since: string;
}

export const userApi = {
  // GET /user/profile - Get current user profile
  getProfile: (): Promise<{ success: boolean; user: UserProfile }> => 
    apiRequest('/user/profile'),
  
  // PUT /user/profile - Update user profile
  updateProfile: (data: Partial<UserProfile>): Promise<{ success: boolean; user: UserProfile }> =>
    apiRequest('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // POST /user/change-password - Change password
  changePassword: (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> =>
    apiRequest('/user/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  // GET /user/stats - Get user statistics
  getStats: (): Promise<{ success: boolean; stats: UserStats }> =>
    apiRequest('/user/stats'),

  // DELETE /user/account - Delete user account
  deleteAccount: (password: string): Promise<{ success: boolean; message: string }> =>
    apiRequest('/user/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),
};

// ==================== PORTFOLIO API ====================

export interface Holding {
  holding_id: string;
  symbol: string;
  quantity: number;
  avg_price: number;
  current_price?: number;
  current_value?: number;
  pnl?: number;
  pnl_percentage?: number;
  sector?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioSummary {
  total_holdings: number;
  total_invested: number;
  current_value: number;
  total_pnl: number;
  total_pnl_percentage: number;
  holdings: Holding[];
}

export const portfolioApi = {
  // GET /portfolio - Get all holdings with summary
  getPortfolio: (): Promise<{ success: boolean; portfolio: PortfolioSummary }> =>
    apiRequest('/portfolio'),
  
  // GET /portfolio/holdings - Get holdings list
  getHoldings: (): Promise<{ success: boolean; holdings: Holding[] }> =>
    apiRequest('/portfolio/holdings'),
  
  // POST /portfolio/holdings - Add new holding
  addHolding: (data: {
    symbol: string;
    quantity: number;
    avg_price: number;
    sector?: string;
    notes?: string;
  }): Promise<{ success: boolean; holding: Holding }> =>
    apiRequest('/portfolio/holdings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // PUT /portfolio/holdings/{holding_id} - Update holding
  updateHolding: (holdingId: string, data: Partial<Holding>): Promise<{ success: boolean; holding: Holding }> =>
    apiRequest(`/portfolio/holdings/${holdingId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // DELETE /portfolio/holdings/{holding_id} - Delete holding
  deleteHolding: (holdingId: string): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/portfolio/holdings/${holdingId}`, { method: 'DELETE' }),

  // POST /portfolio/import - Import holdings from CSV
  importHoldings: (file: File): Promise<{ success: boolean; imported: number; errors: string[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/portfolio/import', {
      method: 'POST',
      headers: {}, // Let browser set Content-Type for FormData
      body: formData as unknown as BodyInit,
    });
  },

  // GET /portfolio/export - Export holdings to CSV
  exportHoldings: async (): Promise<Blob> => {
    const token = getToken();
    const response = await fetch(`${API_BASE}/portfolio/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new ApiError(response.status, 'Failed to export');
    return response.blob();
  },
};

// ==================== CHATS API ====================

export interface ChatSummary {
  chat_id: string;
  chat_name: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
}

export interface ChatMessage {
  message_id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    tokens_used?: number;
    tools_used?: string[];
    chart_url?: string;
  };
}

export interface ChatDetail {
  chat_id: string;
  chat_name: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages: ChatMessage[];
}

export const chatsApi = {
  // GET /chats - Get all chats
  getChats: (): Promise<{ success: boolean; chats: ChatSummary[]; total: number }> =>
    apiRequest('/chats'),
  
  // GET /chats/{chat_id} - Get chat with messages
  getChat: (chatId: string): Promise<{ success: boolean; chat: ChatDetail; messages: ChatMessage[] }> =>
    apiRequest(`/chats/${chatId}`),
  
  // POST /chats - Create new chat
  createChat: (chatName?: string): Promise<{ success: boolean; chat_id: string; chat_name: string; created_at: string }> =>
    apiRequest('/chats', {
      method: 'POST',
      body: JSON.stringify({ chat_name: chatName || 'New Chat' }),
    }),
  
  // PUT /chats/{chat_id} - Update chat (rename)
  updateChat: (chatId: string, data: { chat_name: string }): Promise<{ success: boolean; chat: ChatSummary }> =>
    apiRequest(`/chats/${chatId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  // DELETE /chats/{chat_id} - Delete chat
  deleteChat: (chatId: string): Promise<{ success: boolean; message: string }> =>
    apiRequest(`/chats/${chatId}`, { method: 'DELETE' }),
};

// ==================== WEBSOCKET ====================

export const getWebSocketUrl = (): string => {
  const token = getToken();
  return `${WS_BASE}/ws/chat?token=${token}`;
};

export { API_BASE, WS_BASE };
