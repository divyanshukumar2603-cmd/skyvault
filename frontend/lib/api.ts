export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() { return accessToken; }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // send refresh token cookie
  });

  if (res.status === 401 && path !== '/api/auth/refresh') {
    // Try token refresh
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retry = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
      if (!retry.ok) throw new Error((await retry.json()).error || 'Request failed');
      return retry.json();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// A page load fires several requests at once. Without single-flighting, each
// 401 would start its own refresh, the second would present an already-used
// token, and the server's reuse detection would revoke the whole token family
// and log the user out. All callers share one in-flight refresh instead.
let refreshInFlight: Promise<boolean> | null = null;

export function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const data: any = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      }).then((r) => r.json());
      if (data?.data?.accessToken) {
        setAccessToken(data.data.accessToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  })();

  refreshInFlight.finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

// ─── Auth ────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, displayName?: string) =>
    request<any>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, displayName }) }),
  login: (email: string, password: string) =>
    request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<any>('/api/auth/logout', { method: 'POST' }),
  me: () => request<any>('/api/auth/me'),
  refresh: () => request<any>('/api/auth/refresh', { method: 'POST' }),
};

// ─── Files ───────────────────────────────────────────────────────
export const filesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<any>(`/api/files${qs}`);
  },
  getUploadUrl: (data: { fileName: string; filePath: string; mimeType: string; sizeBytes: number }) =>
    request<any>('/api/files/upload-url', { method: 'POST', body: JSON.stringify(data) }),
  confirmUpload: (data: any) =>
    request<any>('/api/files/confirm-upload', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<any>(`/api/files/${id}`),
  update: (id: string, data: any) => request<any>(`/api/files/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  softDelete: (id: string) => request<any>(`/api/files/${id}`, { method: 'DELETE' }),
  hardDelete: (id: string) => request<any>(`/api/files/${id}/hard`, { method: 'DELETE' }),
  restore: (id: string) => request<any>(`/api/files/${id}/restore`, { method: 'POST' }),
  trash: () => request<any>('/api/files/trash'),
  stats: () => request<any>('/api/files/stats'),
  batchDownload: (fileIds: string[]) =>
    request<any>('/api/files/batch-download', { method: 'POST', body: JSON.stringify({ fileIds }) }),
};

// ─── Versions ────────────────────────────────────────────────────
export const versionsApi = {
  list: (fileId: string) => request<any>(`/api/files/${fileId}/versions`),
  download: (fileId: string, versionId: string) => request<any>(`/api/files/${fileId}/versions/${versionId}`),
  restore: (fileId: string, versionId: string) =>
    request<any>(`/api/files/${fileId}/versions/${versionId}/restore`, { method: 'POST' }),
};

// ─── Backups ─────────────────────────────────────────────────────
export const backupsApi = {
  list: (page = 1) => request<any>(`/api/backups?page=${page}`),
  trigger: () => request<any>('/api/backups/trigger', { method: 'POST' }),
  restore: (id: string) => request<any>(`/api/backups/${id}/restore`, { method: 'POST' }),
  getSchedule: () => request<any>('/api/backups/schedule'),
};

// ─── Replication ─────────────────────────────────────────────────
export const replicationApi = {
  status: () => request<any>('/api/replication/status'),
  trigger: () => request<any>('/api/replication/trigger', { method: 'POST' }),
};

// ─── Products (personalized ranking) ─────────────────────────────
export const productsApi = {
  list: (params?: { category?: string; search?: string }) => {
    const qs = params && Object.keys(params).length
      ? '?' + new URLSearchParams(params as Record<string, string>).toString()
      : '';
    return request<any>(`/api/products${qs}`);
  },
  categories: () => request<any>('/api/products/categories'),
  insights: () => request<any>('/api/products/insights'),
  get: (id: string) => request<any>(`/api/products/${id}`),
  interact: (id: string, type: 'VIEW' | 'CLICK' | 'CART' | 'PURCHASE', rank?: number) =>
    request<any>(`/api/products/${id}/interactions`, {
      method: 'POST',
      body: JSON.stringify(rank ? { type, rank } : { type }),
    }),
  resetHistory: () => request<any>('/api/products/history', { method: 'DELETE' }),
};

// ─── Analytics ───────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: (days = 30) => request<any>(`/api/analytics?days=${days}`),
  overview: (days = 30) => request<any>(`/api/analytics/overview?days=${days}`),
  funnel: (days = 30) => request<any>(`/api/analytics/funnel?days=${days}`),
  topProducts: (days = 30, limit = 10) => request<any>(`/api/analytics/top-products?days=${days}&limit=${limit}`),
  categories: (days = 30) => request<any>(`/api/analytics/categories?days=${days}`),
  trend: (days = 14) => request<any>(`/api/analytics/trend?days=${days}`),
  effectiveness: (days = 30) => request<any>(`/api/analytics/ranking-effectiveness?days=${days}`),
};
