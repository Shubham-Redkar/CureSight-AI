# 10. Calibration and Physical Measurement

Converting a 2D image pixel into a 3D physical dimension requires a reliable reference scale. CureSight AI utilizes a strictly enforced calibration protocol to ensure clinical safety.

## 1. Automatic Physical Calibration (The Primary Method)

The system expects the clinician to place a standard **2 cm × 2 cm green square marker** near the wound prior to taking the photograph.

### Detection Algorithm (`CalibrationDetector`)
1. **HSV Filtering**: The algorithm isolates green hues.
2. **Contour Analysis**: It identifies potential marker boundaries.
3. **Geometry Rules**: The contour must pass strict rectangularity (`fill ratio > 0.90`) and squareness (`aspect ratio between 0.85 and 1.15`) tests.
4. **Scale Derivation**: Once verified, the width of the marker in pixels is measured.
   ```python
   pixels_per_cm = pixel_width / 2.0
   ```

## 2. Demonstration Calibration

> **Demonstration / Testing functionality.**

Because the current repository lacks a dataset containing real physical green markers, a demonstration fallback is provided via `config.yaml`. 
If the automatic marker detection fails, the system safely falls back to a hardcoded `demo_pixels_per_cm` value (e.g. `25 px/cm`).

**Crucially, this is never presented as a physical measurement.** The frontend UI explicitly labels this as "Demonstration / Testing" data and attaches a warning badge to the assessment.

## 3. The Safety Invariant

The core safety rule of the CureSight AI platform is:
**No valid physical calibration → no physical measurement.**

If a marker is not detected, and demonstration mode is disabled, the system assigns:
```json
calibration: { "source": "none" }
```
In this scenario, pixel measurements are still derived, but physical conversion fails closed. The UI will safely display "Not available" for area, length, and width to prevent the clinician from making decisions based on uncalibrated hallucinated dimensions.
