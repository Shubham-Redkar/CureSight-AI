# Phase 21A: Web Login Network Error & Tissue Results

## 1. Web Login Network Error Fix
**Root Cause:**
The React frontend's `apiFetch` was appending `/api/auth/login` to `VITE_API_URL`. When deployed, if `VITE_API_URL` is configured with a trailing `/api` (e.g. `https://curesight-ai.onrender.com/api`), the resulting URL would become `/api/api/auth/login`. This 404 error was causing CORS failures in some browsers or unhandled fetch rejections, presenting as a "Network error" to the user.
Furthermore, the `server.ts` CORS configuration used `FRONTEND_URL` strictly. If it contained a trailing slash, it would cause strict CORS failures on legitimate preflight requests.

**Changes:**
1. Modified `frontend/src/utils/api.ts` to cleanly deduplicate `/api` paths and strip trailing slashes.
2. Updated `backend/src/server.ts` CORS check to strip trailing slashes from `process.env.FRONTEND_URL`.
3. Improved error handling in `frontend/src/views/Login.tsx` to correctly display "Invalid username or password" on 401s, and distinguish actual network errors.

## 2. Display Tissue Analysis in Wound Assessment Results
**Root Cause & Audit:**
Ordinary wound analysis (via `/api/upload` calling `/api/v1/analyze-wound-upload/`) only produces a binary wound mask. It does not run multiclass tissue segmentation. Therefore, regular assessments lack `tissue_composition`.

The existing tissue analysis feature (`POST /api/analysis/tissue`) was designed to upload a *new* image and create a *separate* Assessment with `notes: "Tissue Analysis"`. However, users expect to see tissue composition on an existing assessment, and if missing, trigger the analysis for the *same* image without re-uploading.

**Changes:**
1. Updated `backend/src/server.ts` (`POST /api/analysis/tissue`) to accept an `assessmentId` without an image file. It now downloads the existing image from Supabase, runs tissue inference, and updates the *existing* assessment's `measurements` instead of creating a duplicate assessment.
2. Updated `frontend/src/types/index.ts` to include `tissueComposition` and `tissueAnnotatedUrl`.
3. Updated `frontend/src/context/WoundContext.tsx` to map these new properties into the `aiResult` object when loading assessments.
4. Added a "Tissue Composition" section to `frontend/src/views/AssessmentDetail.tsx`. If `tissueComposition` exists, it displays the percentages and annotated map. If missing, it shows an empty state with an "Analyze Tissue" button that triggers the analysis on the existing assessment.

## 3. Test & Verification
- **Backend Tests:** Passed.
- **Frontend Build:** The React production build (`npm run build`) succeeded without errors.
- **AI Service Tests:** Pytest suite confirmed all tests passing.
- **Verification:** Login now gracefully handles network errors vs HTTP 401. Tissue analysis correctly attaches to the existing assessment and survives a browser refresh since it persists directly to the PostgreSQL database. No duplicate assessments are created when simply opening a result or requesting tissue analysis on an existing assessment.
