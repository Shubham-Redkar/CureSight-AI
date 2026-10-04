import { render, screen } from '@testing-library/react';
import { WoundDetails } from './WoundDetails';
import * as WoundContextModule from '../context/WoundContext';
import * as AuthContextModule from '../context/AuthContext';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('../components/ui', () => ({
  Card: ({ children, title, headerAction }: any) => <div data-testid="card">{title}{headerAction}{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  Input: (props: any) => <input {...props} />,
  Select: ({ children, ...props }: any) => <select {...props}>{children}</select>,
  Modal: ({ children, isOpen }: any) => isOpen ? <div>{children}</div> : null,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ patientId: '1', woundId: '1' }),
}));

describe('RBAC for Tissue Analysis', () => {
  const mockPatients = [{ id: 1, patientCode: 'P001', name: 'John Doe', age: 30 }];
  const mockWounds = [{ id: 1, patientId: 1, location: 'Left Heel' }];

  beforeEach(() => {
    vi.spyOn(WoundContextModule, 'useWounds').mockReturnValue({
      patients: mockPatients,
      wounds: mockWounds,
      assessments: [],
      addPatient: vi.fn(),
      addWound: vi.fn(),
      isLoading: false,
      error: null
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRole = (role: 'DOCTOR' | 'ADMIN' | 'VIEWER') => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: '1', username: 'test', role: role as any },
      loading: false,
      authenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <WoundDetails />
    );
  };

  it('11. DOCTOR can access the feature', () => {
    renderWithRole('DOCTOR');
    expect(screen.getByText('Analyze Tissue')).toBeDefined();
  });

  it('12. ADMIN can access the feature', () => {
    renderWithRole('ADMIN');
    expect(screen.getByText('Analyze Tissue')).toBeDefined();
  });

  it('13. VIEWER cannot access the actionable feature', () => {
    renderWithRole('VIEWER');
    expect(screen.queryByText('Analyze Tissue')).toBeNull();
  });
});
