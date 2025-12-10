// Admin API Service Layer for KUBERA Backend
// All admin-specific endpoints

import { ApiError, getToken, setTokens, clearTokens } from './api';

const API_BASE = 'http://localhost:8000';

// Admin token management (separate from user tokens)
export const getAdminToken = (): string | null => {
  return localStorage.getItem('kubera-admin-token');
};

export const setAdminToken = (token: string) => {
  localStorage.setItem('kubera-admin-token', token);
};

export const clearAdminToken = () => {
  localStorage.removeItem('kubera-admin-token');
};

// Admin API request wrapper
async function adminRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAdminToken();
  
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

  if (response.status === 401 || response.status === 403) {
    clearAdminToken();
    window.location.href = '/admin-kubera';
    throw new ApiError(response.status, 'Admin session expired');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(response.status, error.detail || error.message || 'Request failed', error.error_code);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ==================== ADMIN AUTH API ====================

export interface AdminLoginResponse {
  success: boolean;
  message: string;
  otp_sent: boolean;
  expires_in: number;
}

export interface AdminVerifyResponse {
  success: boolean;
  access_token: string;
  admin: {
    admin_id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const adminAuthApi = {
  // POST /admin-kubera/auth/request-otp - Request admin OTP
  requestOTP: async (email: string): Promise<AdminLoginResponse> => {
    const response = await fetch(`${API_BASE}/admin-kubera/auth/request-otp`, {
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

  // POST /admin-kubera/auth/verify-otp - Verify admin OTP and login
  verifyOTP: async (email: string, otpCode: string): Promise<AdminVerifyResponse> => {
    const response = await fetch(`${API_BASE}/admin-kubera/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp_code: otpCode }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.detail || 'Invalid OTP');
    }

    return response.json();
  },

  // POST /admin-kubera/auth/logout - Admin logout
  logout: async (): Promise<void> => {
    try {
      await adminRequest('/admin-kubera/auth/logout', { method: 'POST' });
    } finally {
      clearAdminToken();
    }
  },
};

// ==================== ADMIN DASHBOARD API ====================

export interface DashboardStats {
  total_users: number;
  active_users_today: number;
  total_chats: number;
  messages_today: number;
  rate_limit_violations_today: number;
  total_tokens_used_today: number;
}

export interface ChartDataPoint {
  date: string;
  messages: number;
  users: number;
  tokens: number;
}

export const adminDashboardApi = {
  // GET /admin-kubera/dashboard/stats - Get dashboard statistics
  getStats: (): Promise<{ success: boolean; stats: DashboardStats }> =>
    adminRequest('/admin-kubera/dashboard/stats'),

  // GET /admin-kubera/dashboard/chart-data - Get chart data for trends
  getChartData: (days: number = 7): Promise<{ success: boolean; data: ChartDataPoint[] }> =>
    adminRequest(`/admin-kubera/dashboard/chart-data?days=${days}`),
};

// ==================== ADMIN USERS API ====================

export interface AdminUser {
  user_id: string;
  username: string;
  email: string;
  name: string;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  last_login?: string;
  total_chats: number;
  total_messages: number;
}

export interface UserDetail extends AdminUser {
  risk_tolerance?: string;
  investment_horizon?: string;
  rate_limit_overrides?: RateLimitOverride;
  is_whitelisted: boolean;
}

export interface RateLimitOverride {
  burst?: number;
  per_chat?: number;
  hourly?: number;
  daily?: number;
}

export const adminUsersApi = {
  // GET /admin-kubera/users - Get all users
  getUsers: (page: number = 1, limit: number = 50, search?: string): Promise<{
    success: boolean;
    users: AdminUser[];
    total: number;
    page: number;
    pages: number;
  }> =>
    adminRequest(`/admin-kubera/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`),

  // GET /admin-kubera/users/{user_id} - Get user detail
  getUser: (userId: string): Promise<{ success: boolean; user: UserDetail }> =>
    adminRequest(`/admin-kubera/users/${userId}`),

  // POST /admin-kubera/users/{user_id}/deactivate - Deactivate user
  deactivateUser: (userId: string, reason?: string): Promise<{ success: boolean; message: string }> =>
    adminRequest(`/admin-kubera/users/${userId}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // POST /admin-kubera/users/{user_id}/reactivate - Reactivate user
  reactivateUser: (userId: string): Promise<{ success: boolean; message: string }> =>
    adminRequest(`/admin-kubera/users/${userId}/reactivate`, {
      method: 'POST',
    }),

  // GET /admin-kubera/users/{user_id}/chats - Get user's chats
  getUserChats: (userId: string): Promise<{ success: boolean; chats: any[] }> =>
    adminRequest(`/admin-kubera/users/${userId}/chats`),

  // GET /admin-kubera/users/{user_id}/activity - Get user activity log
  getUserActivity: (userId: string, limit: number = 50): Promise<{ success: boolean; activities: any[] }> =>
    adminRequest(`/admin-kubera/users/${userId}/activity?limit=${limit}`),
};

// ==================== ADMIN RATE LIMITS API ====================

export interface GlobalRateLimits {
  burst: number;
  per_chat: number;
  hourly: number;
  daily: number;
}

export interface RateLimitViolation {
  violation_id: string;
  user_id: string;
  username: string;
  limit_type: string;
  current_usage: number;
  limit: number;
  timestamp: string;
}

export interface WhitelistedUser {
  user_id: string;
  username: string;
  email: string;
  added_at: string;
  added_by: string;
}

export const adminRateLimitsApi = {
  // GET /admin-kubera/rate-limits - Get global rate limits
  getRateLimits: (): Promise<{ success: boolean; limits: GlobalRateLimits }> =>
    adminRequest('/admin-kubera/rate-limits'),

  // PUT /admin-kubera/rate-limits - Update global rate limits
  updateRateLimits: (limits: GlobalRateLimits): Promise<{ success: boolean; limits: GlobalRateLimits }> =>
    adminRequest('/admin-kubera/rate-limits', {
      method: 'PUT',
      body: JSON.stringify(limits),
    }),

  // GET /admin-kubera/rate-limits/violations - Get rate limit violations
  getViolations: (page: number = 1, limit: number = 50): Promise<{
    success: boolean;
    violations: RateLimitViolation[];
    total: number;
  }> =>
    adminRequest(`/admin-kubera/rate-limits/violations?page=${page}&limit=${limit}`),

  // PUT /admin-kubera/users/{user_id}/rate-limits - Set user-specific rate limits
  setUserRateLimits: (userId: string, limits: RateLimitOverride): Promise<{ success: boolean; message: string }> =>
    adminRequest(`/admin-kubera/users/${userId}/rate-limits`, {
      method: 'PUT',
      body: JSON.stringify(limits),
    }),

  // DELETE /admin-kubera/users/{user_id}/rate-limits - Remove user rate limit overrides
  removeUserRateLimits: (userId: string): Promise<{ success: boolean; message: string }> =>
    adminRequest(`/admin-kubera/users/${userId}/rate-limits`, { method: 'DELETE' }),

  // GET /admin-kubera/rate-limits/whitelist - Get whitelisted users
  getWhitelist: (): Promise<{ success: boolean; users: WhitelistedUser[] }> =>
    adminRequest('/admin-kubera/rate-limits/whitelist'),

  // POST /admin-kubera/rate-limits/whitelist - Add user to whitelist
  addToWhitelist: (userId: string): Promise<{ success: boolean; message: string }> =>
    adminRequest('/admin-kubera/rate-limits/whitelist', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  // DELETE /admin-kubera/rate-limits/whitelist/{user_id} - Remove from whitelist
  removeFromWhitelist: (userId: string): Promise<{ success: boolean; message: string }> =>
    adminRequest(`/admin-kubera/rate-limits/whitelist/${userId}`, { method: 'DELETE' }),
};

// ==================== ADMIN SYSTEM API ====================

export interface SystemStatus {
  maintenance_mode: boolean;
  scheduler_running: boolean;
  last_scheduler_run?: string;
  database_connected: boolean;
  redis_connected: boolean;
  ai_service_status: string;
}

export interface ActivityLog {
  log_id: string;
  action: string;
  user_id?: string;
  username?: string;
  details: string;
  ip_address?: string;
  timestamp: string;
}

export const adminSystemApi = {
  // GET /admin-kubera/system/status - Get system status
  getStatus: (): Promise<{ success: boolean; status: SystemStatus }> =>
    adminRequest('/admin-kubera/system/status'),

  // POST /admin-kubera/system/maintenance - Toggle maintenance mode
  toggleMaintenance: (enabled: boolean): Promise<{ success: boolean; maintenance_mode: boolean }> =>
    adminRequest('/admin-kubera/system/maintenance', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  // POST /admin-kubera/system/restart-scheduler - Restart scheduler
  restartScheduler: (): Promise<{ success: boolean; message: string }> =>
    adminRequest('/admin-kubera/system/restart-scheduler', { method: 'POST' }),

  // GET /admin-kubera/system/activity-logs - Get activity logs
  getActivityLogs: (page: number = 1, limit: number = 100): Promise<{
    success: boolean;
    logs: ActivityLog[];
    total: number;
  }> =>
    adminRequest(`/admin-kubera/system/activity-logs?page=${page}&limit=${limit}`),

  // POST /admin-kubera/system/clear-cache - Clear system cache
  clearCache: (): Promise<{ success: boolean; message: string }> =>
    adminRequest('/admin-kubera/system/clear-cache', { method: 'POST' }),
};

// ==================== ADMIN REPORTS API ====================

export interface PortfolioReport {
  user_id: string;
  username: string;
  total_holdings: number;
  total_value: number;
  top_holdings: { symbol: string; value: number }[];
}

export interface UsageReport {
  date: string;
  total_messages: number;
  total_tokens: number;
  unique_users: number;
  new_users: number;
}

export const adminReportsApi = {
  // GET /admin-kubera/reports/portfolio - Get portfolio reports
  getPortfolioReports: (): Promise<{ success: boolean; reports: PortfolioReport[] }> =>
    adminRequest('/admin-kubera/reports/portfolio'),

  // GET /admin-kubera/reports/usage - Get usage reports
  getUsageReports: (startDate: string, endDate: string): Promise<{ success: boolean; reports: UsageReport[] }> =>
    adminRequest(`/admin-kubera/reports/usage?start_date=${startDate}&end_date=${endDate}`),

  // POST /admin-kubera/reports/generate - Trigger report generation
  generateReport: (reportType: string): Promise<{ success: boolean; message: string; report_id: string }> =>
    adminRequest('/admin-kubera/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ report_type: reportType }),
    }),
};
