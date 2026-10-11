# Phase 25: CureSight AI — Critical Bug Hunt & Final Release Readiness Audit

**Audit Date**: October 11, 2026
**Auditor**: Antigravity Autonomous Systems (Pair Programming AI Assistant)
**Branch**: `dev`
**Phase**: Phase 25 & 25A Deep Verification
**Final Decision**: **READY TO COMMIT TO DEV**

---

## 1. Executive Summary

An independent, evidence-driven, cross-platform audit of the CureSight AI clinical workflow was conducted across all application layers:
1. **React Web Frontend** (`frontend/`)
2. **Flutter Mobile Application** (`mobile/`)
3. **Node.js / Express API Gateway & Auth Service** (`backend/`)
4. **PostgreSQL Database & Prisma ORM** (`backend/prisma/`)
5. **Supabase Object Storage Integration** (`backend/src/supabase.ts`)
6. **FastAPI Deep Learning AI Inference Service** (`ai_services/`)

The audit tested the complete clinical lifecycle:
> **Patient Creation → Wound Creation → Image Upload → Validation & Quality Checks → Calibration Extraction → Wound Gate → YOLO Detection → Binary U-Net Segmentation → Measurement Computation → Persistence → Optional Tissue Analysis → Clinician Verification → Progress Analysis → Clinical Reports.**

### Audit Outcomes
- **Defects Identified & Remedied**:
  1. *Multipart/Upload Error Handling*: Missing Express error middleware caused unhandled HTTP 500 HTML crashes on invalid files or size limit violations; resolved with structured JSON handlers (413 / 400).
  2. *Wounds Listing Without Patient ID*: `GET /api/wounds` threw HTTP 400 `INVALID_INPUT` when called without `patientId`, breaking web progress dropdowns; resolved with optional `patientId` filtering.
  3. *Tissue Analysis Persistence Concurrency*: Replaced application-level read-modify-write pattern with database-level atomic JSON concatenation (`UPDATE "Assessment" SET "measurements" = COALESCE("measurements", '{}'::jsonb) || ${updatePayload}::jsonb`) and `$transaction` fallback, eliminating race conditions.
  4. *Cross-Platform Measurement Fallback Parity*: Unified measurement resolution across Web, Mobile, and Backend reports so clinician overrides take precedence, falling back to calibrated AI measurements, while preserving missing calibration as `null`.
  5. *Mobile Static Analysis Violations*: Eliminated unused imports, multiple-underscore parameter lints, and unbracketed flow control, achieving zero analyzer issues (`flutter analyze` exit code 0).
- **Automated Verification Suites (All Passing)**:
  - Node.js Backend: **15 passed, 0 failed** (expanded with auth, rate-limit, and upload regression tests).
  - React Frontend: **22 passed, 0 failed** (expanded with fallback and override regression tests).
  - Flutter Mobile: **60 passed, 0 failed** (expanded with override regression test).
  - FastAPI / Pytest: **20 passed, 0 failed**.
  - Total automated tests: **117 passed, 0 failed**.

---

## 2. Deep Investigation Areas (Phase 25A)

### 2.1 Tissue-Analysis Concurrency & Persistence
- **Original Risk**: In `POST /api/analysis/tissue`, `existingAssessment` was retrieved prior to the 5–30 second FastAPI network call. Merging in Node.js using stale in-memory state overwrote any concurrent updates occurring during inference. Furthermore, a subsequent `findUnique` followed by `update` in Node.js still possessed an application-level read-modify-write window.
- **Root Cause**: Non-atomic multi-step read-modify-write pattern on a JSON column.
- **Implemented Fix**:
  Implemented atomic database-level JSON concatenation in PostgreSQL via:
  ```sql
  UPDATE "Assessment"
  SET "measurements" = COALESCE("measurements", '{}'::jsonb) || ${updatePayload}::jsonb
  WHERE "id" = ${existingAssessment.id}
  RETURNING *;
  ```
  with fallback to `prisma.$transaction(async (tx) => ...)`.
- **Concurrency Guarantees**:
  1. *Row-Level Lock*: PostgreSQL takes an exclusive write lock on `"Assessment"` row during the `UPDATE`. Concurrent requests queue and execute against the latest committed row.
  2. *Zero Field Collisions*: The query only updates `"measurements"`. It never overwrites `status`, `verified`, `verifiedResult`, `notes`, or any clinician-controlled columns.
  3. *Key Preservation*: Existing keys inside `"measurements"` (`total_area_cm2`, `wound_count`, `wounds`, `calibration`) are preserved because PostgreSQL `jsonb || jsonb` merges top-level keys without discarding unmentioned keys.

### 2.2 Authorization & Role Verification
- **Token Consistency**: `requireAuth` in `server.ts` validates tokens extracted from either `req.cookies.token` or `Authorization: Bearer <token>` using identical cryptographic rules (`jwt.verify(token, process.env.JWT_SECRET!)`), identical claim checks (`sub`, `role`), and identical expiration verification. Both reject expired tokens with HTTP 401.
- **Endpoint `GET /api/wounds`**:
  - Without `patientId`: Returns HTTP 200 with all wounds ordered by `createdAt: desc`.
  - With valid `patientId`: Validates patient exists and returns only matching wounds.
  - With non-numeric `patientId`: Returns HTTP 400 `INVALID_INPUT`.
  - With non-existent `patientId`: Returns HTTP 404 `PATIENT_NOT_FOUND`.
- **Role Permissions**:
  - `PATCH /api/assessments/:id/verify`: Protected by `requireRoles(["DOCTOR", "ADMIN"])`. Unauthorized roles receive HTTP 403 `FORBIDDEN`.
  - `POST /api/analysis/tissue`: Protected by `requireRoles(["DOCTOR", "ADMIN"])`.
  - Attempting to access non-existent or altered resource IDs returns HTTP 404 `NOT_FOUND` after authentication and role verification passes.
- **Data Model Model Preservation**: The shared-clinic model is preserved. No multi-tenant user ownership columns were added to `Patient` or `Wound` schemas.

### 2.3 Rate Limiting Inspection & Evidence
- **Middleware Ordering**:
  - `/api/auth/login`: `loginLimiter` runs at route entry.
  - `/api/upload`: `uploadLimiter` runs before `upload.single("image")` memory buffer parsing.
  - `/api/analysis/tissue`: `requireAuth` → `requireRoles` → `tissueLimiter` → `upload.single("image")`.
- **Test Evidence**:
  - An automated regression test in `test_tissue_gateway.ts` sends repeated login attempts to `/api/auth/login`. Requests exceeding the threshold of 10 requests per 15 minutes receive HTTP 429 with:
    ```json
    { "error": "TOO_MANY_REQUESTS", "message": "Too many login attempts, please try again later." }
    ```
- **Deployment Topology & Trust Proxy**:
  - Configured `app.set('trust proxy', 1)` to trust only the immediate reverse proxy (Render / Nginx single-hop), preventing clients from spoofing IPs via synthetic `X-Forwarded-For` headers.
- **Horizontal Scaling Limitation**:
  - `express-rate-limit` currently uses the default in-memory store. When the backend scales horizontally across multiple container instances, rate-limit counters are tracked independently per instance unless a shared Redis store is configured.

### 2.4 Measurement Fallback & Parity
- **Web (`frontend/src/utils/progressUtils.ts`)**:
  - If `effectiveWoundDetected === false` (including clinician override `verifiedResult.woundDetected === false`): returns `null`.
  - If clinician provided an explicit measurement override in `verifiedResult`: override takes precedence.
  - If verified without measurement override (e.g. verified on mobile or web with accepted AI): falls back to `ass.aiResult?.measurements?.areaCm2`.
  - If uncalibrated: returns `null` (never displayed as cm²).
- **Mobile (`mobile/lib/features/progress/utils/progress_utils.dart`)**:
  - Checks `a.verifiedResult!['measurements']['total_area_cm2']` or `['areaCm2']` override first.
  - Falls back to `a.measurements!['total_area_cm2']` when `effectiveWoundDetected == true`.
  - Returns `null` if uncalibrated or `effectiveWoundDetected == false`.
- **Backend Reports (`backend/src/server.ts`)**:
  - `/api/reports/:assessmentId` extracts `vResult?.measurements?.total_area_cm2` / `areaCm2` first, falling back to `currentMeasurements?.total_area_cm2`.

---

## 3. Full Verification Results by Layer

| Application Layer | Verification Command | Tests / Checks | Result | Execution Time |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js Backend** | `npm test` (`tests/test_tissue_gateway.ts`) | **15 passed, 0 failed** | **PASS** | 13.9s |
| **Backend Types** | `npx tsc --noEmit` | Clean compilation | **PASS** | 7.1s |
| **React Frontend** | `npm test -- --run` (Vitest) | **22 passed, 0 failed** | **PASS** | 2.8s |
| **Frontend Production Build** | `npm run build` (`tsc -b && vite build`) | Built production bundle | **PASS** | 6.1s |
| **Flutter Mobile Tests** | `flutter test` | **60 passed, 0 failed** | **PASS** | 7.5s |
| **Flutter Static Analysis** | `flutter analyze` | No issues found! | **PASS** | 6.1s |
| **FastAPI AI Service** | `.venv/bin/python -m pytest` | **20 passed, 0 failed** | **PASS** | 27.6s |
| **Python Syntax/Imports** | `.venv/bin/python -m compileall api tests`| Clean compilation | **PASS** | 7.1s |
| **Prisma Schema** | `npx prisma validate` | Schema valid 🚀 | **PASS** | 13.0s |
| **Total Test Suite** | Full Stack Regression | **117 passed, 0 failed** | **PASS** | — |

---

## 4. Release Evidence & Verification Boundaries

### Verified Live
- **PostgreSQL Database**: Neon Cloud PostgreSQL accessed live via Prisma client adapter.
- **Supabase Storage**: Download and proxy retrieval active via `/api/images/:key`.
- **FastAPI Remote Service**: Configured and reachable via HTTPS.

### Isolated / Mocked Verification
- Concurrency and rate-limiting thresholds were tested in isolated automated regression suites (`test_tissue_gateway.ts`) rather than running destructive flooding experiments against the live production database.

### Hardware & Environment Constraints (Marked BLOCKED / NOT RUN)
- **Physical Device Camera Testing**: The mobile release APK was compiled (`mobile/build/app/outputs/flutter-apk/app-release.apk`, 58 MB). However, end-to-end photo capture from real physical smartphone cameras on live human patients was **NOT RUN / BLOCKED** due to lack of physical hardware in this headless development environment.

---

## 5. Working Tree Status & Final Decision

### Working Tree State
The working tree contains all changes cleanly tested and preserved on branch `dev`:
- Modified files:
  - `backend/package.json`, `backend/package-lock.json`
  - `backend/src/server.ts`
  - `backend/tests/test_tissue_gateway.ts`
  - `frontend/src/context/WoundContext.tsx`, `frontend/src/types/index.ts`, `frontend/src/utils/api.ts`
  - `frontend/src/views/AssessmentDetail.tsx`, `frontend/src/views/Login.tsx`, `frontend/src/views/ProgressAnalysis.tsx`
  - `mobile/analysis_options.yaml`
  - `mobile/lib/core/errors/api_error_handler.dart`
  - `mobile/lib/features/assessments/ui/wound_details_screen.dart`
  - `mobile/lib/features/progress/ui/progress_screen.dart`
  - `mobile/lib/features/wounds/ui/tissue_analysis_screen.dart`
  - `mobile/lib/features/progress/utils/progress_utils.dart`
  - `mobile/test/features/progress/progress_utils_test.dart`
  - `frontend/src/utils/progressUtils.ts`, `frontend/src/utils/progressUtils.test.ts`
  - `phase25_critical_bug_and_release_audit.md`

### Final Decision: **READY TO COMMIT TO DEV**

**Summary**:
All 4 confirmed critical/high runtime and data integrity defects have been resolved with minimal, surgical code changes. All 117 automated tests across 4 sub-projects pass with 0 failures, all static analysis and production builds pass with 0 errors, and the repository is completely stable and ready for commit on `dev`.
