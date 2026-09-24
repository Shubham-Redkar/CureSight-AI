# Project Documentation Audit

This document certifies the process used to generate the CureSight AI technical documentation suite.

## Verification Checklist

The following repository components were physically inspected via source code review to generate this documentation:

- `[x]` **Files Inspected**: `server.ts`, `schema.prisma`, `pipeline.py`, `ProgressAnalysis.tsx`, `WoundAssessment.tsx`, `.env`, `package.json`, `config.yaml`, and `ai_services/tests/`.
- `[x]` **Architecture Verified**: Confirmed the 4-layer separation (React, Node, PostgreSQL, FastAPI/MinIO).
- `[x]` **Database Verified**: Confirmed the 4 primary Prisma models (`User`, `Patient`, `Wound`, `Assessment`) and their strict relationships.
- `[x]` **APIs Verified**: Confirmed the actual implementation of `/api/reports`, `/api/dashboard/summary`, `/api/upload`, and `/api/assessments/:id/verify`.
- `[x]` **AI Pipeline Verified**: Confirmed the presence of the `MLPipeline` orchestrator and the specific use of OpenCV thresholding heuristics.
- `[x]` **Frontend Verified**: Confirmed the React SPA architecture, JWT authentication flow, and HTML2Canvas PDF generation.
- `[x]` **ML Training Verified**: **CONFIRMED ABSENT**. Verified that no datasets, PyTorch `.pt` weights, or training scripts exist in the repository.
- `[x]` **Testing Verified**: Confirmed the presence of `pytest` unit tests for the OpenCV calibration module.

## Undocumented / Uncertain Areas
- **Clinical Validation**: There are no documented clinical trials, accuracy metrics (IoU/Dice), or IRB approvals in this repository. The system's clinical efficacy is entirely unproven.
- **Production Deployment**: Docker compose files exist for local databases, but there are no production Kubernetes manifests, CI/CD pipelines, or secure environment variable injection scripts documented.

## Implemented vs Planned Functionality

| Feature | State in Codebase | State in Documentation |
| :--- | :--- | :--- |
| Database & ORM | Fully Implemented | Documented |
| API Gateway | Fully Implemented | Documented |
| Frontend UI | Fully Implemented | Documented |
| Auth (JWT) | Implemented (Plain text pwds) | Documented (with limitations) |
| OpenCV Detection | Implemented | Documented |
| YOLO/U-Net AI | **Stubbed (Missing Weights)** | Documented as "Simulated/Stubbed" |
| Clinical Validation | **Missing** | Documented as "Not performed" |

All documentation accurately reflects the **current codebase state**, avoiding marketing fluff and strictly highlighting the differences between simulated demonstration behavior and actual production-ready functionality.
