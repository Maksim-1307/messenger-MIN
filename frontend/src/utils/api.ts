import { config } from './config';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

interface RequestConfig extends RequestInit {
  token?: string | null;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestConfig = {}
): Promise<T> {
  const { token, headers: customHeaders, ...restConfig } = options;

  const headers: Record<string, string> = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...customHeaders,
  } as Record<string, string>;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${config.apiUrl}${endpoint}`;

  const response = await fetch(url, {
    ...restConfig,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(response.status, data.message || 'Request failed');
  }

  return data as T;
}

/**
 * Convert a relative API path to a full URL (for use in img src, links, etc.)
 */
export function toFullUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${config.apiUrl}${path}`;
}

export const api = {
  get: <T>(endpoint: string, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'GET', token }),

  post: <T>(endpoint: string, body?: unknown, token?: string | null) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, token?: string | null) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, token?: string | null) =>
    apiRequest<T>(endpoint, { method: 'DELETE', token }),

  uploadFile: <T>(endpoint: string, formData: FormData, token?: string | null) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      token,
      body: formData,
    }),
};

export { ApiError };
