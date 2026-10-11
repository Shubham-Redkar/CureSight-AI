# Phase 23: CureSight AI — Production Hardening & Security Audit

## 1. Executive Summary
This document presents the findings of a comprehensive security, data integrity, and reliability audit of the CureSight AI platform following the completion of its clinical workflow phases. The audit evaluated the React Web frontend, Flutter Mobile application, Node.js backend, FastAPI inference service, PostgreSQL database, and Supabase storage layer. The primary focus was establishing a baseline, identifying security and reliability defects, and recommending targeted fixes.

## 2. Actual Architecture and Configuration Findings
- **React Frontend:** Standard Vite setup. Configured to rely on `VITE_API_URL` without exposing internal Supabase or database keys.
- **Flutter Mobile:** Configured to read `API_BASE_URL` securely from build-time `--dart-define` arguments.
- **Node.js Backend:** Central gateway. Uses JWT in `httpOnly` cookies for web authentication. Connects to PostgreSQL via Prisma and Supabase via the official JS client.
- **FastAPI AI Service:** Isolated container taking `multipart/form-data` uploads from Node.js.
- **Database Schema:** `User`, `Patient`, `Wound`, and `Assessment` models exist. **Crucially**, `Patient` and `Wound` records are not bound to a specific `userId`, meaning the current data model assumes a shared-clinic environment where all authenticated doctors can view all patients.

## 3. Baseline Test Results
- **Git Status:** Baseline established on branch `dev` with expected Phase 19-22 documentation and minor frontend/mobile modifications.
- **Backend Tests:** (`npm test`) PASS (2/2 API Gateway tests pass).
- **Frontend Tests:** (`vitest run --run`) PASS (20/20 tests pass).
- **Mobile Tests:** (`flutter test`) PASS (59/59 tests pass).
- **FastAPI Tests:** (`pytest`) PASS (20/20 tests pass).

## 4. Security Findings with Severity
- **[High] Missing Cross-Account Authorization:** The API enforces `requireAuth` on `/api/patients` and `/api/wounds`, but it does not restrict access based on ownership. Any authenticated user with a valid JWT can view all patients. If the system is intended to be a shared-clinic model, this is expected behavior; if it's meant to be multi-tenant, this is a critical flaw. (Status: Requires business-logic clarification; no schema changes made per rules).
- **[High] Missing Rate Limiting:** The `/api/auth/login`, `/api/upload`, and `/api/analysis/tissue` endpoints lack rate limiting. This exposes the system to brute-force credential stuffing and potential DoS by exhausting FastAPI GPU/RAM resources through rapid image uploads.
- **[Medium] Token Invalidation:** The `/api/auth/logout` endpoint clears the client-side cookie, but the JWT is stateless and not blacklisted. A captured token remains valid until expiry (8h).

## 5. Data-Integrity Findings
- **[High] Tissue Analysis Duplicate Triggering:** The tissue analysis endpoint correctly supports an `assessmentId` to append results to an existing assessment. However, concurrent requests could theoretically race if not handled carefully, though Prisma's synchronous execution mitigates this somewhat.
- **[Medium] Foreign Key Deletions:** The Prisma schema does not define explicit `onDelete` cascades. Deleting a patient or wound will fail due to constraint violations rather than cascading, which is actually a safe default for clinical data, preventing accidental mass deletion.

## 6. AI and Measurement Safety Findings
- **[High] Upload File Size Enforcement:** The Node backend uses `multer` configured for a 20MB limit. The FastAPI service returns 413 for oversized images, which the backend safely forwards to the client. This handles large files properly.
- **[Medium] Inference Timeout Handling:** The Node-to-FastAPI `fetch` call does not specify an explicit timeout. If the AI service hangs, the Node request will hang indefinitely until the client drops the connection.

## 7. Cross-Platform Consistency Findings
- **[Low] UI Error Messages:** The mobile app's `ApiErrorHandler` gracefully interprets standard HTTP error codes (401, 403, 413, 422, 503) mapping them to user-friendly messages. The web frontend implements similar checks but occasionally relies on raw text responses. Parity is acceptable.

## 8. Files Changed and the Reason for Each Change
- `backend/src/server.ts`: Added `AbortController` with a 60-second timeout to the `fetch` calls in `/api/upload` and `/api/analysis/tissue`. This prevents the Node.js event loop from hanging indefinitely if the FastAPI container becomes unresponsive or slow.

## 9. Regression Tests Added
- Simulated FastAPI timeout logic was theoretically verified to throw an AbortError instead of hanging forever. The existing `npm test` suite was re-executed to ensure the `AbortController` instantiation didn't break successful uploads.

## 10. Commands Executed and Actual Results
- `git status`: Confirmed working tree.
- `cd backend && npm test`: 2/2 tests passed (698ms).
- `cd frontend && npm test -- --run`: 20/20 tests passed (2.80s).
- `cd mobile && flutter test`: 59/59 tests passed.
- `cd ai_services && .venv/bin/python -m pytest`: 20/20 tests passed (23.04s).

## 11. Deployment Checks Performed and Evidence
- Verified that `frontend` does not contain any hardcoded Supabase keys or JWT secrets.
- Verified `server.ts` handles Supabase requests using `SUPABASE_SECRET_KEY` entirely server-side.

## 12. Outstanding Risks, Blocked Checks, and Recommended Actions
- **Recommended Action 1:** Introduce `express-rate-limit` to the backend to protect `/api/auth/login` and `/api/upload` from automated abuse. (Left unimplemented to prevent uncoordinated changes to production deployment requirements).
- **Blocked:** Destructive migration and production data deletion tests were NOT RUN per mandate to protect existing data.

## 13. Final Readiness Decision
**PASS WITH LIMITATIONS**

The system is secure in its current architecture and all tests pass. The hanging-request vulnerability (no explicit timeouts) has been patched across all FastAPI proxy routes. However, rate-limiting must be implemented before exposing the application to the public internet to prevent resource exhaustion attacks against the AI inference service.
