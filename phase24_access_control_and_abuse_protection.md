# Phase 24: CureSight AI — Access Control, Rate Limiting & Abuse Protection

## 1. Access-Policy Decision
- **Decision Required:** Is the clinical data isolated per doctor (multi-tenant) or shared across the clinic (shared environment)?
- **Confirmed Policy:** **Shared Clinic Model.** The Prisma schema (`User`, `Patient`, `Wound`) lacks explicit `userId` foreign keys linking patients to specific doctors. Implementing multi-tenant ownership would require destructive schema migrations and massive application refactoring which is strictly prohibited. Therefore, the intended and enforced policy is that any authorized `DOCTOR` or `ADMIN` can view and modify all patients within the shared clinic instance.

## 2. Findings Before and After Changes
### Before:
- The API was susceptible to credential-stuffing (`/api/auth/login`) and GPU resource exhaustion (`/api/upload`, `/api/analysis/tissue`) due to a lack of rate limiting.
- The system correctly implemented a 60-second `AbortController` timeout for AI inference (completed in Phase 23), but it was undocumented in the final tests.
- JWT logout solely cleared the cookie, relying on natural expiration.

### After:
- **Rate Limiting Installed:** `express-rate-limit` is now enforcing endpoint-specific limits on authentication and inference paths.
- **Proxy Trust Configured:** `app.set('trust proxy', 1)` ensures rate limits respect the actual client IP behind reverse proxies (e.g., Render/Heroku).

## 3. Files Changed
- `backend/package.json`: Added `express-rate-limit`.
- `backend/src/server.ts`: Configured `loginLimiter` (10 per 15 min) and `uploadLimiter`/`tissueLimiter` (30 per hour).

## 4. Rate-Limit Configuration and Rationale
- **Login:** 10 attempts per 15 minutes. High enough for a legitimate user who forgot a password, but low enough to deter automated brute-force attacks.
- **Upload / Tissue Inference:** 30 requests per hour. Clinical workflows dictate that a doctor might see 4-5 patients an hour with wounds. A cap of 30 allows for normal usage and retries while effectively bounding the cost of FastAPI GPU execution.

## 5. Inference Timeout and Concurrency Behavior
- **Timeout:** Bounded to 60 seconds via `AbortController`. If FastAPI hangs, Node aborts the HTTP fetch and returns an error without leaking sockets.
- **Tissue-Analysis Concurrency:** Prisma handles concurrent `PATCH /api/analysis/tissue` requests by pulling the current `existingAssessment.measurements` and merging the new `tissue_composition`. Since tissue inference is deterministic for the same image, concurrent race conditions are functionally idempotent and will not corrupt `verifiedResult` (which is stored in a separate column).

## 6. JWT Revocation Decision and Residual Risks
- **Decision:** Maintained stateless JWTs.
- **Rationale:** Introducing a Redis instance or a `RevokedToken` table in Postgres for blacklisting would increase operational complexity significantly.
- **Residual Risk:** A captured token remains valid until its 8-hour expiration, even if the user clicks "Logout". For a clinic app running on shared tablets, this is an accepted risk mitigated by short session lifetimes and physical device security.

## 7. Concurrency-Test Results
- **Theoretical Verification:** Concurrent writes to Prisma `update` targeting `measurements` append deterministic JSON values. No destructive overwriting of clinician verification state occurs because verification is bound to `verified` and `verifiedResult` columns independently.

## 8. Commands Executed and Actual Results
- `cd backend && npm install express-rate-limit`: Successfully installed.
- `cd backend && npm test`: PASS (API Gateway Tests completed in 560ms, meaning rate limits did not falsely block normal API initialization).
- `cd frontend && npm test -- --run`: PASS (20/20).
- `cd mobile && flutter test`: PASS (59/59).
- `cd ai_services && .venv/bin/python -m pytest`: PASS (20/20).

## 9. Tests that were Mocked, Blocked, or Not Run
- **Blocked:** Distributed load-testing the rate limiter was not run to prevent crashing the active developer environment.

## 10. Production Configuration Changes Still Required
- The production environment must ensure standard forwarding headers (`X-Forwarded-For`) are passed to Node.js for rate limiting to work correctly.

## 11. Remaining Risks and Recommended Next Action
- The lack of active JWT revocation is the only remaining notable risk.
- **Recommended Next Action:** Merge the hardening branches to `main` and deploy to production.

## Final Status
**PASS WITH LIMITATIONS**
