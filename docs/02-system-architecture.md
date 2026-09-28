# 2. System Architecture

The CureSight AI application follows a modern decoupled architecture consisting of four primary layers: a React frontend, a Node.js API backend, a PostgreSQL relational database, and a FastAPI-based AI service with local MinIO object storage.

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Client Layer
        UI[React Frontend (Vite)]
    end

    subgraph API Layer
        Node[Node.js / Express Backend]
        Prisma[Prisma ORM]
    end

    subgraph AI/ML Layer
        FastAPI[FastAPI Python Service]
        Pipeline[ML Pipeline Orchestrator]
        OpenCV[OpenCV Calibration / Masks]
    end

    subgraph Data Layer
        PG[(PostgreSQL Database)]
        MinIO[(MinIO Object Storage)]
    end

    UI <-->|JSON REST API| Node
    Node <-->|Prisma Queries| PG
    Node <-->|S3 API| MinIO
    Node <-->|HTTP Multipart| FastAPI
    FastAPI --> Pipeline
    Pipeline --> OpenCV
```

## Component Responsibilities

### 1. React Frontend (Vite)
- Renders the clinical user interface (Dashboards, Reports, Progress Analysis).
- Manages local client state and API communication.
- Handles JWT authentication storage.
- Enforces UI-side loading, error, and empty states based on API responses.

### 2. Node.js Backend (Express)
- Acts as the central traffic controller for the platform.
- Handles user authentication (JWT generation/verification).
- Protects endpoints and manages authorization.
- Interfaces with the database via Prisma to read/write Patients, Wounds, and Assessments.
- Uploads images to MinIO, forwards them to the AI service, and aggregates the results into a single transactional save.

### 3. FastAPI AI Service
- A Python-based microservice strictly responsible for image processing.
- Exposes an `/analyze` endpoint receiving multipart image files.
- Executes the `MLPipeline` to perform image quality checks, ROI cropping, wound segmentation, and calibration detection.
- Returns a structured JSON payload containing pixel measurements, physical measurements (if calibrated), and base64-encoded annotated images back to the Node.js backend.

### 4. PostgreSQL (Database)
- The absolute single source of truth for all clinical and application data.
- Stores heavily relational data linking Doctors (Users) to Patients, Wounds, and Assessments.
- Maintains strict consistency for assessment verification states and JSON-structured measurement results.

### 5. MinIO (Object Storage)
- Serves as the S3-compatible file storage mechanism.
- Stores raw uploaded wound images and their corresponding AI-annotated masks securely.
- Files are referenced by PostgreSQL using deterministic `imageKey` paths (e.g., `wounds/123.jpg`).
