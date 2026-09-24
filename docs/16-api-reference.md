# 16. API Reference

This document outlines the primary API endpoints exposed by the Node.js backend. All routes except `/api/auth/login` require an `Authorization: Bearer <token>` header.

## Authentication

### `POST /api/auth/login`
- **Purpose**: Authenticates a user.
- **Body**: `{ "username": "admin", "password": "password" }`
- **Response**: `{ "token": "jwt-token-string" }`

### `GET /api/auth/me`
- **Purpose**: Validates the current JWT token.
- **Response**: `{ "id": 1, "username": "admin", "role": "ADMIN" }`

## Dashboard

### `GET /api/dashboard/summary`
- **Purpose**: Aggregates global system statistics.
- **Response**: `{ "totalPatients": 10, "activeWounds": 12, "completedAssessments": 5, "verifiedReports": 3 }`

## Core Entities

### `GET /api/patients`
- **Purpose**: Retrieves all patients.
- **Response**: `[ { "id": 1, "patientCode": "PT-001", "name": "John Doe", "age": 45 } ]`

### `GET /api/wounds`
- **Purpose**: Retrieves wounds, filterable by patient.
- **Query Params**: `?patientId=1`
- **Response**: `[ { "id": 1, "patientId": 1, "location": "Left Leg" } ]`

### `GET /api/assessments`
- **Purpose**: Retrieves assessments, filterable by wound.
- **Query Params**: `?woundId=1`
- **Response**: `[ { "id": 1, "woundId": 1, "imageKey": "wounds/...", "measurements": {...}, "status": "COMPLETED" } ]`

## Operations

### `PATCH /api/assessments/:id/verify`
- **Purpose**: Marks an assessment as verified.
- **Body**: `{ "verifiedResult": { "clinicalNotes": "Healing well" } }`
- **Response**: `{ "status": "VERIFIED", "verified": true }`

### `GET /api/reports`
- **Purpose**: Retrieves all assessments eligible for reporting (`COMPLETED` or `VERIFIED`).
- **Response**: `[ { ...assessment, wound: { ...wound, patient: { ...patient } } } ]`

### `POST /api/upload`
- **Purpose**: Orchestrates the AI analysis pipeline.
- **Body**: `multipart/form-data` with fields `image`, `woundId`.
- **Response**: The newly created `Assessment` record containing the AI's JSON measurements.

### `GET /api/images/:key`
- **Purpose**: Securely streams an image binary from MinIO object storage.
- **Response**: `image/jpeg` buffer.
