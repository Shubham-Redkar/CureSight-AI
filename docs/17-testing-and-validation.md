# 17. Testing and Validation

The testing philosophy for CureSight AI divides software validation (does the code work?) from clinical validation (does the AI work accurately on real humans?).

## 1. Software Validation (Backend AI)

The Python FastAPI service includes a suite of `pytest` unit tests targeting algorithmic edge cases in the OpenCV calibration and detection logic.
Location: `ai_services/tests/`

### Test Coverage Includes:
- **`test_calib.py`**: Ensures the `CalibrationDetector` correctly identifies a perfect green square marker and extracts its pixel width.
- **`test_false_positives.py`**: Ensures the `CalibrationDetector` correctly *rejects* incorrect markers (e.g. `test_large_green.jpg`, `test_irregular_green.jpg`, `test_small_noise.jpg`). This enforces the primary Safety Invariant.
- **Integration Tests**: Tests that the FastAPI orchestrator successfully returns the expected JSON structure when given a mock image (`test_upload.jpg`).

## 2. Frontend Validation

The React frontend relies on strict TypeScript compilation (`tsc -b`) to validate data structures. By sharing Prisma-like interfaces with the backend (e.g., the `Assessment` interface), the frontend guarantees that it will not attempt to render properties that do not exist.

## 3. Clinical Validation

**Clinical validation has NOT yet been performed.**

The current OpenCV heuristics and YOLO/U-Net stubs have only been tested against synthetic lab fixtures (perfectly lit green squares on clean backgrounds). 

Before this system can be deployed in a real clinical setting, it must undergo extensive validation against a varied dataset of real human wound photographs to calculate exact IoU (Intersection over Union), Dice coefficients, and error margins for the physical measurements.
