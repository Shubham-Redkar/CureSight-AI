# 4. Frontend

The frontend is a Single Page Application (SPA) built using React, TypeScript, and Vite.

## Routing and Authentication Flow

The application routing strictly protects clinical data.

1. **Login**: The user enters credentials at `/login`.
2. **Authentication**: A POST request is sent to `/api/auth/login`. If valid, the Node backend returns a JWT token.
3. **Session Storage**: The JWT is stored in `localStorage` and bound to the application's `AuthContext`.
4. **Protected Application**: Protected routes (Dashboard, Patients, Reports) wrap content in an `<AuthGuard>`. If the token is missing or invalid, the user is immediately redirected to `/login`.

## API Communication

All API calls are routed through a standardized helper function `apiFetch()` (`frontend/src/utils/api.ts`). This utility automatically attaches the `Authorization: Bearer <token>` header to every outgoing HTTP request to ensure secure communication with the Node.js backend.

## Major Views & Components

### `Dashboard.tsx`
Provides an overview of the system state. It fetches real-time aggregations from PostgreSQL via `/api/dashboard/summary`, displaying metrics like active patients, wound counts, and verified assessments.

### `WoundAssessment.tsx`
The primary operational screen. Allows the user to select a patient, select a wound, upload an image, and trigger the AI pipeline. It includes forms for manual data input and visualizes the AI's response before submission.

### `ProgressAnalysis.tsx`
A historical comparison tool. Users select a patient and wound to view a chronological timeline of healing. It dynamically queries `/api/assessments?woundId=...` to render the timeline and provides a "Professional Image Comparison" view to analyze `Frame A` vs `Frame B`.

### `Reports.tsx`
Displays all `COMPLETED` and `VERIFIED` clinical reports. It features a modal that generates on-the-fly downloadable PDF exports summarizing the physical measurements and annotations.

## Data Flow: PostgreSQL as the Source of Truth

The frontend operates on a strict **Database-Driven** model. 
- **No mock data**: Patients and Wounds populate dropdowns via direct `GET /api/patients` and `GET /api/wounds` calls. 
- **No detached state**: If an assessment is completed or verified, the UI updates its state by re-fetching the data from the server, ensuring that what the user sees is exactly what is stored in PostgreSQL.

> **Demonstration / Testing functionality:** The UI correctly identifies and labels AI calibrations that use the "Demonstration Fallback Scale" to ensure clinicians are never misled by test data.
