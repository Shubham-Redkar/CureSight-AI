# Phase 21B: Wound Healing Progress Analysis

## 1. Audit of Existing Data Model and API

**Data Model (Prisma `Assessment`):**
- **Wound and Patient Linking:** Wound isolation is naturally enforced because assessments are strictly associated with a specific `woundId`, which in turn belongs to a `patientId`.
- **Measurements Structure:** Calibrated physical measurements are stored as JSON in `measurements.total_area_cm2`, `measurements.wounds[0].length_cm`, etc.
- **Tissue Persistence:** Tissue composition is stored directly within `measurements.tissue_composition` following our Phase 21A implementation.
- **Images:** The `imageKey` and `annotatedImageKey` hold original and ML-segmented bounding box/mask overlays respectively.

**Unit & Calibration Audit:**
- Analysis via `api/services/measurements.py` reveals that `total_area_cm2` is ONLY calculated and populated if a valid calibration (e.g., `pixels_per_cm`) is supplied and detected.
- If calibration is missing, physical measurements are suppressed and `total_area_cm2` is strictly omitted (resulting in `null` / `None`). Pixel areas are retained but never silently substituted as physical areas.

## 2. Implemented Functionality

1. **Longitudinal Progress Area Chart (React Web & Flutter Mobile):**
   - Renders a chronological plot of `total_area_cm2` over time.
   - Strictly omits uncalibrated/pixel-only measurements from the chart, preventing silent mixing of units.
   - Shows missing values as "Not available" rather than zero.
   - Requires at least 2 valid historical data points to chart an area trend.

2. **Tissue Composition Trends (React Web & Flutter Mobile):**
   - Added a new chronological trend section for tissue composition.
   - Uses a stacked bar design (Web) and proportional segment rows (Mobile) representing Granulation, Slough, Eschar/Necrotic, and Epithelial tissue percentages.
   - Persisted classes are extracted directly from the assessment's JSON measurements.
   - Bypasses missing entries to only chart dates where valid tissue composition inference results exist.

3. **Absolute and Percentage Area Change Formula:**
   - **Absolute change:** `latestArea - baselineArea` (where baseline is either the previous or initial depending on context).
   - **Percentage change:** `((latestArea - baselineArea) / baselineArea) * 100`.
   - Positive implies wound area growth (requires attention); negative implies reduction (improving). Zero means stable.

## 3. Explicit Distinctions & Known Limitations

- **Calibration Validity:** The progression area chart strictly relies on physical calibration markers. However, variations in camera angle and lighting can influence absolute area boundaries. Trends should be verified clinically.
- **AI-Generated Tissue Estimates:** Tissue percentages are presented with explicit warnings that they are **"AI-generated tissue estimates. Not a clinical diagnosis."** We clearly label that percentages should only be compared when class definitions (underlying segmentation models) are compatible.
- **Clinical Integrity Preserved:** No fabricated scores, recovery duration predictions, or invented pixel-to-cm conversions were added. Healing trajectories remain purely observational based on validated historical boundaries.

## 4. Files Changed

- **React Web:**
  - `frontend/src/views/ProgressAnalysis.tsx` (Added Tissue Composition Trends chart, ensured uncalibrated assessments are omitted from graphical Area change).
- **Flutter Mobile:**
  - `mobile/lib/features/progress/ui/progress_screen.dart` (Added `_buildTissueCompositionTrends` Sliver block matching React Web design, improved missing-data warnings).

## 5. Test and Build Results

- **React Web Build:** `npm run build` executed successfully without compilation errors.
- **Flutter Mobile Analyze:** `flutter analyze` passed with no critical errors, confirming Dart types safely handle potential `null` nested tissue maps.
- **End-to-End Consistency:** Both client applications retrieve from the exact same PostgreSQL backend payload and interpret `total_area_cm2` exclusively for size dynamics.
