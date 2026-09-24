# 11. Assessment Lifecycle

The `Assessment` is the core clinical record in CureSight AI, tracking the AI analysis of a specific wound photograph and the clinician's eventual sign-off.

## 1. Image Upload
A user selects a wound in the UI and uploads a photo. The Node.js server receives it and stores the raw image in MinIO under an `imageKey` (e.g. `wounds/123456.jpg`).

## 2. AI Analysis
The photo is forwarded to the FastAPI service. The AI pipeline analyzes it and returns a JSON payload of boundary coordinates, measurements, calibration data, and a base64-encoded annotated image.

## 3. Assessment Created
The Node.js server saves the annotated image to MinIO (`analysis/123456.jpg`) and creates a new PostgreSQL `Assessment` record containing the JSON measurements. The assessment is created with:
- `status`: `"COMPLETED"`
- `verified`: `false`

## 4. Clinical Review
The clinician navigates to the Dashboard or Assessment page and reviews the AI's measurements, checking the overlaid mask.

## 5. Verification
Because CureSight AI is a clinical decision support tool (not autonomous), the doctor must verify the findings. Using the Verification UI, they may input manual overrides for dimensions and provide notes. 
When submitted (`PATCH /api/assessments/:id/verify`), the database record updates to:
- `status`: `"VERIFIED"`
- `verified`: `true`
- `verifiedResult`: A JSON snapshot of the doctor's overrides and signature.

## 6. Reports & Historical Analysis
Once verified, the assessment is effectively "locked". It flows into the `Reports` view (for PDF generation) and the `Progress Analysis` timeline. 

## Database Status Enumerations
The system strictly enforces these statuses in PostgreSQL:
- **`PENDING`**: Created, but AI analysis hasn't finished (rarely seen due to synchronous processing).
- **`COMPLETED`**: AI analysis is finished, waiting for human verification.
- **`VERIFIED`**: Clinically signed-off. Completely immutable for reporting.
