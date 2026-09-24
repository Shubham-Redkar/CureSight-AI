# 5. Backend

The CureSight Node.js (Express) backend functions as the primary security gateway and data orchestrator for the platform.

## Server Structure

The primary entry point is `backend/src/server.ts`. It initializes the Express application, configures CORS, connects the Prisma ORM to PostgreSQL, establishes the MinIO object storage connection, and registers all API routes.

## Core Responsibilities

1. **Authentication**: Exposes `/api/auth/login` and validates all incoming requests using JWT middleware.
2. **Database Operations**: Handles full CRUD (Create, Read, Update, Delete) operations for Patients, Wounds, and Assessments using strict Prisma schemas.
3. **Storage & AI Broker**: Receives image uploads via `multer`, pipes them to MinIO, streams them to the Python AI service for analysis, and parses the response.

## API Route Table

The following routes are actively implemented and confirmed in the repository:

| Method | Endpoint | Purpose | Auth Required | Source Data |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate user | No | `User` |
| `GET` | `/api/auth/me` | Retrieve active user profile | Yes | JWT Payload |
| `GET` | `/api/dashboard/summary`| Aggregate global clinical stats | Yes | `Patient, Wound, Assessment` |
| `GET` | `/api/patients` | Retrieve all patients | Yes | `Patient` |
| `GET` | `/api/wounds` | Retrieve wounds by `?patientId=` | Yes | `Wound` |
| `GET` | `/api/assessments` | Retrieve assessments by `?woundId=`| Yes | `Assessment` |
| `PATCH` | `/api/assessments/:id/verify`| Mark assessment as verified | Yes | `Assessment` |
| `GET` | `/api/reports` | Retrieve all COMPLETED & VERIFIED | Yes | `Assessment` |
| `POST` | `/api/upload` | Orchestrate AI pipeline and storage | Yes | Multipart Image -> AI -> PG |
| `GET` | `/api/images/:key` | Serve image binaries from MinIO | Yes | MinIO `wound-images` bucket |

## The AI Orchestration Flow (`POST /api/upload`)

When a user submits a new wound photograph:
1. Express intercepts the file using `multer`.
2. The file is uploaded directly to the local MinIO `wound-images` bucket under `wounds/{timestamp}-{id}.jpg`.
3. Express constructs a form-data request and forwards the image to the FastAPI Python service at `/analyze`.
4. The Python service returns a JSON payload containing segmentation, pixel measurements, and calibration status, alongside a base64 string of the annotated image.
5. Express decodes the base64 annotated image and uploads it to MinIO under `analysis/{timestamp}/annotated.jpg`.
6. Express creates a new `Assessment` record in PostgreSQL via Prisma, storing both the `imageKey`, `annotatedImageKey`, and the raw `measurements` JSON.
