/**
 * CureSight AI — Unified API Client & URL Resolution
 *
 * Single source of truth for backend URL construction across React Web.
 * Guarantees correct prefixing (/api), prevents duplicate /api/api paths,
 * and eliminates hardcoded localhost references in production builds.
 */

export const getRawBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  // In production builds, default to deployed Render backend rather than localhost
  if (import.meta.env.PROD || import.meta.env.MODE === 'production') {
    return 'https://curesight-ai.onrender.com/api';
  }
  return 'http://localhost:5000';
};

/**
 * Returns API base URL guaranteed to end with '/api' for backend endpoints.
 * E.g. "https://curesight-ai.onrender.com/api" or "http://localhost:5000/api"
 */
export const getApiBaseUrl = (): string => {
  const raw = getRawBaseUrl();
  return raw.endsWith('/api') ? raw : `${raw}/api`;
};

/**
 * Returns the host origin without '/api'.
 * E.g. "https://curesight-ai.onrender.com" or "http://localhost:5000"
 */
export const getApiHost = (): string => {
  const raw = getRawBaseUrl();
  return raw.endsWith('/api') ? raw.slice(0, -4) : raw;
};

/**
 * Backwards compatibility export for any component expecting API_URL.
 */
export const API_URL = getApiBaseUrl();

/**
 * Constructs a normalized, full API URL for any backend endpoint.
 * Handles endpoints with or without leading slashes and with or without '/api' prefix.
 * Avoids duplicate '/api/api' paths under all conditions.
 */
export const buildApiUrl = (endpoint: string): string => {
  if (!endpoint) return getApiBaseUrl();
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const apiBase = getApiBaseUrl();
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (path === '/api' || path === '/api/') {
    return apiBase;
  }

  if (path.startsWith('/api/')) {
    path = path.slice(4); // leaves '/...'
  }

  return `${apiBase}${path}`;
};

/**
 * Constructs a normalized URL for image and asset retrieval.
 * Supports image keys, paths starting with /api/images/, /images/, or full URLs.
 */
export const buildImageUrl = (imagePathOrKey?: string | null): string | undefined => {
  if (!imagePathOrKey || typeof imagePathOrKey !== 'string') return undefined;
  const trimmed = imagePathOrKey.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const apiBase = getApiBaseUrl();
  let path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

  if (path.startsWith('/api/images/')) {
    return `${apiBase}${path.slice(4)}`;
  } else if (path.startsWith('/images/')) {
    return `${apiBase}${path}`;
  } else if (path.startsWith('/api/')) {
    return `${apiBase}${path.slice(4)}`;
  }

  // Raw image key or filename
  return `${apiBase}/images${path}`;
};

export interface ApiFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export const apiFetch = async (endpoint: string, options: ApiFetchOptions = {}) => {
  const { timeoutMs, signal: userSignal, ...restOptions } = options;

  const mergedOptions: RequestInit = {
    ...restOptions,
    credentials: 'include',
  };

  let controller: AbortController | undefined;
  let timeoutId: any;

  if (timeoutMs && timeoutMs > 0 && !userSignal) {
    controller = new AbortController();
    mergedOptions.signal = controller.signal;
    timeoutId = setTimeout(() => controller?.abort(), timeoutMs);
  } else if (userSignal) {
    mergedOptions.signal = userSignal;
  }

  try {
    const url = buildApiUrl(endpoint);
    const response = await fetch(url, mergedOptions);

    if (response.status === 401) {
      window.dispatchEvent(new Event('auth_unauthorized'));
    }

    return response;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};
