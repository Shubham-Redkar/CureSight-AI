# 18. Project Status and Limitations

This matrix reflects the current implementation status of the CureSight AI repository.

## Status Matrix

| Feature | Status | Evidence |
| :--- | :--- | :--- |
| **Authentication** | Implemented | JWT middleware in Node.js; `<AuthGuard>` in React. |
| **Patient Management** | Implemented | Prisma `Patient` model; frontend `Patients.tsx` CRUD. |
| **Wound Management** | Implemented | Prisma `Wound` model linked to Patients. |
| **AI Inference** | Simulated / Stubbed | `YoloDetector` and `UNetSegmenter` use OpenCV fallbacks. No `.pt` weights exist. |
| **Automatic Calibration**| Implemented | OpenCV HSV thresholding accurately detects square markers in tests. |
| **Demo Calibration** | Implemented | Configurable fallback inside `config.yaml` and pipeline. |
| **Reports** | Implemented | `GET /api/reports` returns joined relation data. |
| **PDF Export** | Implemented | `html2canvas` generating `jsPDF` blobs in `PdfReportTemplate.tsx`. |
| **Verification** | Implemented | `PATCH /api/assessments/:id/verify` persists doctor overrides to DB. |
| **Progress Analysis** | Implemented | Dynamic timeline and Frame A vs B comparison in UI. |
| **Multi-Wound UI** | Not Implemented | The DB supports it, but UI assumes 1 active wound context. |
| **Clinical Validation** | Not Implemented | No clinical dataset or accuracy tests present in the repository. |

## Important Limitations

1. **No Real AI Weights**: The repository provides the architectural skeleton for a PyTorch pipeline but lacks the actual trained models. It relies on standard OpenCV techniques which will fail on complex, real-world clinical images.
2. **Demonstration Metrics**: Unless a perfect 2cm green square is placed in the photo, the system defaults to "Demonstration Calibration". This must be replaced with a robust physical marker detection system before production.
3. **Password Security**: The current authentication system checks plain-text environment variables. It lacks a real hashed password database (`bcrypt`).
4. **Predictive Modeling**: The system visualizes historical data but makes zero attempts to predict future healing trajectories.
5. **Role-Based Access Control**: `DOCTOR` and `ADMIN` roles exist, but route-level permissions are not currently restricted based on role.
