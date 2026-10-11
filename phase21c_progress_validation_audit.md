# Phase 21C: Wound Progress Analysis Validation & Regression Audit

## Objective
Validate the Phase 21B longitudinal wound-progress implementation across React Web, Flutter Mobile, and the supporting APIs. Ensure parity, verify clinical measurement handling (especially concerning calibration and area changes), and fortify the logic through regression testing.

## 1. Actual Issues Found During Audit
- **Baseline Selection Desync:** The React Web frontend originally selected the absolute first assessment (`woundAssessments[0]`) as the baseline for percentage and absolute area change. If this initial assessment lacked physical calibration, the entire calculation would fail and display "Not available," even if the 2nd, 3rd, and 4th assessments were fully calibrated.
- **Code Duplication & Flutter Test Regression:** The area change formula was implemented inline in both `ProgressAnalysis.tsx` and `progress_screen.dart`, risking divergence. Furthermore, a previous mobile refactor accidentally removed the `_getEffectiveWoundDetected()` method, causing doctor-override test scenarios to fail (because the system defaulted back to the unverified AI prediction).

## 2. Fixes Made & Files Changed
We extracted the mathematical trend logic into testable helper utilities on both platforms.

- **React Web:**
  - Created `frontend/src/utils/progressUtils.ts`.
  - Updated `frontend/src/views/ProgressAnalysis.tsx` to filter for `validCalibratedAssessments` before determining the "Baseline" and "Latest" measurements.
  - Updated UI labels from "Initial Area" to "Baseline Area" to match Mobile exactly and clarify that it represents the *first valid calibrated* area, not just chronologically the first.
- **Flutter Mobile:**
  - Created `mobile/lib/features/progress/utils/progress_utils.dart`.
  - Restored `_getEffectiveWoundDetected()` in `mobile/lib/features/progress/ui/progress_screen.dart`.
  - Plumbed the UI to utilize the dedicated `ProgressUtils` class.

## 3. Test Cases and Results
- **Frontend Tests (`npm test`):**
  - Added `frontend/src/utils/progressUtils.test.ts`.
  - Validated zero-division prevention (baseline = 0 returns null).
  - Validated positive (growth) and negative (reduction) changes.
  - Verified fallbacks between `verifiedResult` and `aiResult`.
  - **Result:** Vitest runner passed successfully.

- **Mobile Tests (`flutter test`):**
  - Added `mobile/test/features/progress/progress_utils_test.dart` containing unit equivalents of the React tests.
  - Ensured UI widget tests handling clinical override bounds pass perfectly.
  - **Result:** Flutter test suite passed completely with 0 errors.

## 4. Web/Mobile Parity Results
- **Assessment Dates:** Both platforms securely interpret dates.
- **Area Values & Units:** Identical behavior. Uncalibrated/pixel-only data is entirely suppressed from the area charts, displaying as "Not available".
- **Baseline Selection:** Both platforms correctly scan chronological structures and latch onto the *first formally calibrated* assessment as the baseline.
- **Missing Data:** Missing calibration or missing tissue analysis arrays are safely ignored without interpolating zeros.
- **Cross-Wound Leakage:** The `woundId` routing explicitly binds data payloads, preventing cross-pollution.

## 5. Remaining Data Limitations
- **Hardware/Calibration Provenance:** The system verifies if a calibration factor exists but it cannot inherently verify if the *physical camera angle* remained constant across weeks. The UI accurately calculates changes based on the pixel-to-cm ratio, but this math heavily depends on the user maintaining consistent clinical photography standards.
- **Tissue Evolution Limits:** We render tissue percentages identically across platforms with a persistent AI disclaimer. If underlying model schemas change (e.g. adding a 5th tissue class), current visualization logic dynamically maps whatever classes are present.

## 6. Final Status
**PASS**

The mathematical logic is isolated, strictly typed, rigorously unit-tested against division-by-zero, fully parity-checked across React and Flutter, and visually distinguishes calibrated vs uncalibrated historical points correctly.
