import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getApiBaseUrl,
  getApiHost,
  buildApiUrl,
  buildImageUrl,
  apiFetch
} from './api';

describe('CureSight AI — API Client & URL Resolution', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore environment
    Object.assign(import.meta.env, originalEnv);
  });

  describe('1. Production API Base URL Resolution & Localhost Prevention', () => {
    it('resolves production base URL when VITE_API_URL is explicitly set to production', () => {
      import.meta.env.VITE_API_URL = 'https://curesight-ai.onrender.com/api';
      expect(getApiBaseUrl()).toBe('https://curesight-ai.onrender.com/api');
      expect(getApiHost()).toBe('https://curesight-ai.onrender.com');
    });

    it('normalizes VITE_API_URL when set without /api prefix', () => {
      import.meta.env.VITE_API_URL = 'https://curesight-ai.onrender.com';
      expect(getApiBaseUrl()).toBe('https://curesight-ai.onrender.com/api');
      expect(getApiHost()).toBe('https://curesight-ai.onrender.com');
    });

    it('strips trailing slashes from VITE_API_URL', () => {
      import.meta.env.VITE_API_URL = 'https://curesight-ai.onrender.com/api/';
      expect(getApiBaseUrl()).toBe('https://curesight-ai.onrender.com/api');
      expect(getApiHost()).toBe('https://curesight-ai.onrender.com');
    });

    it('falls back to VITE_API_BASE_URL if VITE_API_URL is unset', () => {
      delete import.meta.env.VITE_API_URL;
      import.meta.env.VITE_API_BASE_URL = 'https://curesight-ai.onrender.com/api';
      expect(getApiBaseUrl()).toBe('https://curesight-ai.onrender.com/api');
    });

    it('ensures no production URL targets localhost or 127.0.0.1 in production mode', () => {
      delete import.meta.env.VITE_API_URL;
      delete import.meta.env.VITE_API_BASE_URL;
      (import.meta.env as any).PROD = true;
      (import.meta.env as any).MODE = 'production';

      const prodApiUrl = getApiBaseUrl();
      const loginUrl = buildApiUrl('/api/auth/login');

      expect(prodApiUrl).not.toContain('localhost');
      expect(prodApiUrl).not.toContain('127.0.0.1');
      expect(prodApiUrl).toBe('https://curesight-ai.onrender.com/api');

      expect(loginUrl).not.toContain('localhost');
      expect(loginUrl).toBe('https://curesight-ai.onrender.com/api/auth/login');
    });

    it('falls back to http://localhost:5000 in development mode when unset', () => {
      delete import.meta.env.VITE_API_URL;
      delete import.meta.env.VITE_API_BASE_URL;
      (import.meta.env as any).PROD = false;
      (import.meta.env as any).MODE = 'development';

      expect(getApiBaseUrl()).toBe('http://localhost:5000/api');
      expect(getApiHost()).toBe('http://localhost:5000');
    });
  });

  describe('2. Endpoint Construction & Deduplication (no /api/api)', () => {
    beforeEach(() => {
      import.meta.env.VITE_API_URL = 'https://curesight-ai.onrender.com/api';
    });

    it('constructs correct login endpoint without duplicate /api when given /api/auth/login', () => {
      const url = buildApiUrl('/api/auth/login');
      expect(url).toBe('https://curesight-ai.onrender.com/api/auth/login');
      expect(url).not.toContain('/api/api');
    });

    it('constructs correct login endpoint when given /auth/login without leading api', () => {
      const url = buildApiUrl('/auth/login');
      expect(url).toBe('https://curesight-ai.onrender.com/api/auth/login');
      expect(url).not.toContain('/api/api');
    });

    it('handles relative endpoints without leading slash (api/auth/login)', () => {
      const url = buildApiUrl('api/auth/login');
      expect(url).toBe('https://curesight-ai.onrender.com/api/auth/login');
    });

    it('handles relative endpoints without leading slash (auth/login)', () => {
      const url = buildApiUrl('auth/login');
      expect(url).toBe('https://curesight-ai.onrender.com/api/auth/login');
    });

    it('constructs health check endpoint correctly (/api/health)', () => {
      const url = buildApiUrl('/api/health');
      expect(url).toBe('https://curesight-ai.onrender.com/api/health');
    });

    it('leaves fully-qualified absolute HTTP/HTTPS URLs untouched', () => {
      const absoluteUrl = 'https://external-auth.example.com/oauth/token';
      expect(buildApiUrl(absoluteUrl)).toBe(absoluteUrl);
    });
  });

  describe('3. Image URL Resolution & Deduplication', () => {
    beforeEach(() => {
      import.meta.env.VITE_API_URL = 'https://curesight-ai.onrender.com/api';
    });

    it('constructs image URL from raw image key', () => {
      const url = buildImageUrl('1728639201-wound.jpg');
      expect(url).toBe('https://curesight-ai.onrender.com/api/images/1728639201-wound.jpg');
    });

    it('constructs image URL from /api/images/ path without duplicate /api', () => {
      const url = buildImageUrl('/api/images/1728639201-annotated.jpg');
      expect(url).toBe('https://curesight-ai.onrender.com/api/images/1728639201-annotated.jpg');
      expect(url).not.toContain('/api/api');
    });

    it('constructs image URL from /images/ path', () => {
      const url = buildImageUrl('/images/1728639201-wound.jpg');
      expect(url).toBe('https://curesight-ai.onrender.com/api/images/1728639201-wound.jpg');
    });

    it('returns absolute external image URLs untouched', () => {
      const external = 'https://pswnmrmtayhgwfgqnvxe.supabase.co/storage/v1/object/public/wound-images/photo.jpg';
      expect(buildImageUrl(external)).toBe(external);
    });

    it('returns undefined for null, undefined, or empty image key', () => {
      expect(buildImageUrl(null)).toBeUndefined();
      expect(buildImageUrl(undefined)).toBeUndefined();
      expect(buildImageUrl('')).toBeUndefined();
      expect(buildImageUrl('   ')).toBeUndefined();
    });
  });

  describe('4. apiFetch Behavior', () => {
    it('always passes credentials: include and dispatches auth_unauthorized on 401', async () => {
      import.meta.env.VITE_API_URL = 'https://curesight-ai.onrender.com/api';

      const mockFetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: async () => ({ error: 'UNAUTHORIZED' }),
      });
      globalThis.fetch = mockFetch;

      const eventSpy = vi.fn();
      window.addEventListener('auth_unauthorized', eventSpy);

      const response = await apiFetch('/api/auth/me');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://curesight-ai.onrender.com/api/auth/me',
        expect.objectContaining({ credentials: 'include' })
      );
      expect(response.status).toBe(401);
      expect(eventSpy).toHaveBeenCalledTimes(1);

      window.removeEventListener('auth_unauthorized', eventSpy);
    });
  });
});
