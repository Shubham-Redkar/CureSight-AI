import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Login } from './Login';
import * as AuthContextModule from '../context/AuthContext';
import * as ApiModule from '../utils/api';

describe('Login Flow & Error Handling', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      authenticated: false,
      backendReachable: true,
      authError: null,
      login: mockLogin,
      logout: vi.fn(),
      checkAuth: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const submitLoginForm = (username = 'testclinician', password = 'securepassword') => {
    render(<Login />);
    const usernameInput = screen.getByPlaceholderText(/Enter your clinical username/i);
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    const submitButton = screen.getByRole('button', { name: /Sign in/i });

    fireEvent.change(usernameInput, { target: { value: username } });
    fireEvent.change(passwordInput, { target: { value: password } });
    fireEvent.click(submitButton);
  };

  it('1. Sends correct payload and Content-Type to /api/auth/login', async () => {
    const apiFetchSpy = vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: '1', username: 'testclinician', role: 'DOCTOR' } }),
    } as any);

    submitLoginForm('testclinician', 'securepassword');

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledTimes(1);
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testclinician', password: 'securepassword' }),
        })
      );
    });

    expect(mockLogin).toHaveBeenCalledWith({ id: '1', username: 'testclinician', role: 'DOCTOR' });
  });

  it('2. Correctly handles HTTP 401 Unauthorized', async () => {
    vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'UNAUTHORIZED', message: 'Invalid username or password' }),
    } as any);

    submitLoginForm('wronguser', 'wrongpass');

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password.')).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('3. Correctly handles HTTP 403 Forbidden', async () => {
    vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Access denied. You do not have permission to access this clinical workspace.' }),
    } as any);

    submitLoginForm('unauthorized_role', 'pass');

    await waitFor(() => {
      expect(screen.getByText(/Access denied/i)).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('4. Correctly handles HTTP 404 Endpoint Not Found', async () => {
    vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    } as any);

    submitLoginForm('user', 'pass');

    await waitFor(() => {
      expect(screen.getByText(/Authentication endpoint not found \(HTTP 404\)/i)).toBeInTheDocument();
    });
  });

  it('5. Correctly handles HTTP 429 Too Many Requests', async () => {
    vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Too many login attempts, please try again later.' }),
    } as any);

    submitLoginForm('user', 'pass');

    await waitFor(() => {
      expect(screen.getByText(/Too many login attempts/i)).toBeInTheDocument();
    });
  });

  it('6. Correctly handles HTTP 500 Internal Server Error', async () => {
    vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'INTERNAL_ERROR' }),
    } as any);

    submitLoginForm('user', 'pass');

    await waitFor(() => {
      expect(screen.getByText(/Server error \(HTTP 500\)/i)).toBeInTheDocument();
    });
  });

  it('7. Correctly handles network failure (fetch throws TypeError / Failed to fetch)', async () => {
    vi.spyOn(ApiModule, 'apiFetch').mockRejectedValue(new TypeError('Failed to fetch'));

    submitLoginForm('user', 'pass');

    await waitFor(() => {
      expect(
        screen.getByText(/Unable to sign in\. Network error/i)
      ).toBeInTheDocument();
    });
  });

  it('8. Displays backend offline banner when backendReachable is false', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      loading: false,
      authenticated: false,
      backendReachable: false,
      authError: 'Session verification timed out. Backend server may be offline or slow.',
      login: mockLogin,
      logout: vi.fn(),
      checkAuth: vi.fn(),
    });

    render(<Login />);
    expect(screen.getByText(/Backend Offline or Slow/i)).toBeInTheDocument();
    expect(screen.getByText(/Session verification timed out/i)).toBeInTheDocument();
  });

  it('9. Handles login request timeout gracefully', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    vi.spyOn(ApiModule, 'apiFetch').mockRejectedValue(abortErr);

    submitLoginForm('user', 'pass');

    await waitFor(() => {
      expect(screen.getByText(/Login request timed out after 10s/i)).toBeInTheDocument();
    });
  });
});
