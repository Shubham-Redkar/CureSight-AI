# CureSight AI: The Complete Developer Guide

Welcome to CureSight AI. This document serves as the master entry point for new engineers, data scientists, and product managers joining the project. 

It organizes our comprehensive documentation suite into a logical learning path.

---

## 30-Minute Understanding Path

If you need to understand this system quickly, read these core files in the repository:
1. `backend/prisma/schema.prisma` (Understand the data model)
2. `backend/src/server.ts` (Understand the Express routing and MinIO connections)
3. `ai_services/api/services/pipeline.py` (Understand the AI orchestrator)
4. `frontend/src/views/WoundAssessment.tsx` (Understand the main user operation)
5. `frontend/src/utils/api.ts` (Understand how the frontend talks to the backend)

## Guided Reading List

To understand the project conceptually without reading the source code, read the following documentation files in order:

### Part 1: The Big Picture
1. **[Project Overview](./01-project-overview.md)**: What problem are we solving?
2. **[System Architecture](./02-system-architecture.md)**: How do the Frontend, Backend, Database, and AI communicate?
3. **[Technology Stack](./03-technology-stack.md)**: Why did we choose React, Node, PostgreSQL, MinIO, and FastAPI?

### Part 2: Data & Backend
4. **[Database Schema](./06-database.md)**: How are Patients, Wounds, and Assessments linked?
5. **[Backend API](./05-backend.md)**: How does Node orchestrate the file uploads and database saves?
6. **[API Reference](./16-api-reference.md)**: The exact endpoints available.

### Part 3: The AI Engine
7. **[AI/ML Pipeline](./07-ai-ml-pipeline.md)**: How does the FastAPI service process an image?
8. **[Calibration & Measurement](./10-calibration-and-physical-measurement.md)**: How do we convert pixels into physical cm²? (Crucial safety invariant).
9. **[Image Processing & Segmentation](./09-image-processing-and-segmentation.md)**: How are the masks and bounding boxes drawn?

### Part 4: Clinical Interface
10. **[Frontend Applications](./04-frontend.md)**: How does the React SPA operate?
11. **[Assessment Lifecycle](./11-assessment-lifecycle.md)**: The journey from upload to verified clinical record.
12. **[Reports & PDF Generation](./13-reports-and-pdf-generation.md)**: How we generate static exports without a backend renderer.
13. **[Progress Analysis](./14-progress-analysis.md)**: Visualizing historical Frame A vs Frame B.

### Part 5: Infrastructure & Reality Check
14. **[Data Integrity & Safety](./15-data-integrity-and-safety.md)**: Why PostgreSQL is the single source of truth.
15. **[Project Status & Limitations](./18-project-status-and-limitations.md)**: What is actually implemented vs. what is a simulated stub.

---

## Glossary of Project Terms

- **Assessment**: A single chronological record of an AI analysis on a specific wound photograph. It has a `status` (PENDING, COMPLETED, VERIFIED).
- **Wound**: A physical location on a patient's body (e.g. "Left Leg"). A wound has many Assessments.
- **Patient**: A human subject tracked in the database, uniquely identified by a `patientCode` (e.g. PT-001).
- **Segmentation**: The process of separating the wound tissue from the surrounding healthy skin and background.
- **Mask**: A binary image overlay where white pixels represent the wound and black pixels represent the background.
- **ROI (Region of Interest)**: A cropped section of the image isolating the wound before segmentation.
- **YOLO (You Only Look Once)**: An object detection model architecture intended to find the ROI bounding box.
- **U-Net**: A deep learning architecture designed for biomedical image segmentation.
- **Calibration**: The process of detecting a known physical marker (a 2cm green square) in the image.
- **pixels_per_cm**: The conversion scale derived from Calibration, used to translate pixel area into physical cm².
- **Demonstration Calibration**: A hardcoded fallback scale used only for software testing when a real marker is absent.
- **Verification**: The explicit clinical sign-off by a Doctor. The AI does not diagnose; the doctor verifies.
- **imageKey**: The file path string (e.g., `wounds/123.jpg`) used to locate a specific photo in the MinIO bucket.
- **MinIO**: The S3-compatible local object storage server used for hosting raw and annotated images.
- **Prisma**: The Object-Relational Mapper (ORM) used by the Node.js backend to interface safely with PostgreSQL.
- **FastAPI**: The high-performance Python framework running the AI processing microservice.
