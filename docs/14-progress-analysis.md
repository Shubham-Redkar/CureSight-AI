# 14. Progress Analysis

The Progress Analysis module (`frontend/src/views/ProgressAnalysis.tsx`) allows clinicians to visually and numerically track wound healing over time.

## Data Retrieval Flow

The UI uses cascaded dynamic fetching to construct the timeline:
1. `GET /api/patients` populates the Patient dropdown.
2. `GET /api/wounds?patientId={id}` populates the Wound dropdown.
3. `GET /api/assessments?woundId={id}` fetches the entire chronological history of the selected wound.

Because these queries map directly to PostgreSQL, the UI is heavily resilient. Refreshing the browser preserves data integrity because it reconstructs the state directly from the backend rather than relying on detached React Contexts.

## The Chronological Timeline

The UI renders an assessment card for every historical record. 
Each card resolves the `imageKey` to a live `/api/images/{imageKey}` route to display the original wound photograph.
The physical area (e.g. `5.84 cm²`) and physical dimensions (e.g. `3.25 cm × 2.46 cm`) are extracted from the `measurements` JSON and heavily formatted to 2 decimal places to ensure clinical readability.

## Professional Image Comparison

A critical tool for clinicians is comparing two images side-by-side to visually gauge healing progress.
- **Frame A vs Frame B**: The user can select "Initial vs Latest", "Previous vs Current", or "Custom Dates".
- The UI mounts the actual `/api/images/...` URLs side-by-side. 
- If an image was deleted or corrupted on the MinIO server, the UI safely falls back to a clean `Image unavailable` container rather than displaying broken HTML icons.

## Current Limitations

> **No real-time wound progression prediction.**

While the UI calculates basic percentage reductions between Frame A and Frame B (e.g., `-15% Area`), the AI does **not** currently implement any predictive time-series forecasting to predict *when* a wound will heal. The module is strictly a visualization engine for historical measurements.
