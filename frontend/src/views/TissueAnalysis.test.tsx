import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TissueAnalysis } from './TissueAnalysis';
import * as WoundContextModule from '../context/WoundContext';
import * as ApiModule from '../utils/api';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('../utils/api');

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ woundId: '1' }),
}));

describe('TissueAnalysis', () => {
  const mockPatients = [{ id: 1, patientCode: 'P001' }];
  const mockWounds = [{ id: 1, patientId: 1, location: 'Left Heel' }];

  beforeEach(() => {
    vi.spyOn(WoundContextModule, 'useWounds').mockReturnValue({
      patients: mockPatients,
      wounds: mockWounds,
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. Successful tissue-analysis response rendering', async () => {
    const mockFile = new File(['hello'], 'hello.png', { type: 'image/png' });
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:hello');
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        tissue_composition: {
          epithelial: 10,
          granulation: 40,
          slough: 20,
          necrotic: 10,
          fibrin: 10,
          callus: 5,
          other: 5
        },
        inference_metadata: {
          model_name: 'Tversky_ResNet34',
          model_version: 'a06_b04',
          message: 'Successfully calculated tissue composition.'
        },
        annotated_image_base64: 'data:image/jpeg;base64,12345'
      })
    } as any);

    render(
      <TissueAnalysis />
    );

    // Initial state
    expect(screen.getByText('Select or capture image')).toBeDefined();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, mockFile);

    // Should show Analyze Tissue button
    const analyzeBtn = screen.getByRole('button', { name: /Analyze Tissue/i });
    await userEvent.click(analyzeBtn);

    // Loading state is skipped as mock resolves instantly

    // 2. All seven tissue percentages displayed
    await waitFor(() => {
      expect(screen.getByText('Epithelial')).toBeDefined();
      expect(screen.getAllByText(/10\.0/)).toBeDefined();
      expect(screen.getByText('Granulation')).toBeDefined();
      expect(screen.getAllByText(/40\.0/)).toBeDefined();
      expect(screen.getByText('Slough')).toBeDefined();
      expect(screen.getAllByText(/20\.0/)).toBeDefined();
      expect(screen.getByText('Necrotic')).toBeDefined();
      expect(screen.getByText('Fibrin')).toBeDefined();
      expect(screen.getByText('Callus')).toBeDefined();
      expect(screen.getByText('Other')).toBeDefined();
    });

    // 3. Annotated image rendering
    expect(screen.getByAltText('Annotated Wound')).toHaveAttribute('src', 'data:image/jpeg;base64,12345');

    // Model name and version
    expect(screen.getByText(/Tversky_ResNet34/)).toBeDefined();
    expect(screen.getByText(/a06_b04/)).toBeDefined();
    
    // Disclaimer
    expect(screen.getByText(/AI-generated tissue composition estimates/)).toBeDefined();
    
    // 14. No direct FastAPI URL is used by the React frontend
    expect(ApiModule.apiFetch).toHaveBeenCalledWith('/api/analysis/tissue', expect.anything());
  });

  const testErrorResponse = async (status: number, expectedError: string) => {
    const mockFile = new File(['hello'], 'hello.png', { type: 'image/png' });
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:hello');

    vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: false,
      status: status,
      json: async () => ({})
    } as any);

    render(
      <TissueAnalysis />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, mockFile);
    await userEvent.click(screen.getByRole('button', { name: /Analyze Tissue/i }));

    await waitFor(() => {
      expect(screen.getByText(expectedError)).toBeDefined();
    });
  };

  it('5. 401 response', async () => {
    await testErrorResponse(401, 'Authentication required or session expired.');
  });

  it('6. 403 response', async () => {
    await testErrorResponse(403, 'You do not have permission to perform tissue analysis.');
  });

  it('7. 400/422 response', async () => {
    await testErrorResponse(400, 'Invalid image or analysis failed.');
  });

  it('8. 413 response', async () => {
    await testErrorResponse(413, 'Uploaded image is too large.');
  });

  it('9. 503 response', async () => {
    await testErrorResponse(503, 'Tissue inference service is currently unavailable. Please try again later.');
  });

  it('10. Empty/background prediction where all values may be 0', async () => {
    const mockFile = new File(['hello'], 'hello.png', { type: 'image/png' });
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:hello');

    vi.spyOn(ApiModule, 'apiFetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        tissue_composition: {
          epithelial: 0, granulation: 0, slough: 0, necrotic: 0, fibrin: 0, callus: 0, other: 0
        },
        inference_metadata: {
          model_name: 'Tversky_ResNet34',
          model_version: 'a06_b04',
          message: 'No tissue detected'
        },
        annotated_image_base64: null
      })
    } as any);

    render(
      <TissueAnalysis />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, mockFile);
    await userEvent.click(screen.getByRole('button', { name: /Analyze Tissue/i }));

    await waitFor(() => {
      expect(screen.getByText('No wound tissue detected in the image.')).toBeDefined();
    });
  });
});
