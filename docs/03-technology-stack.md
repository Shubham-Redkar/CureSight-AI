# 3. Technology Stack

CureSight AI relies on a robust and modern stack, separating web application concerns from heavy AI compute concerns.

## Stack Overview

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React (Vite, TypeScript), TailwindCSS | High-performance, statically-typed UI rendering and styling. |
| **Backend** | Node.js (Express, TypeScript) | Fast, asynchronous web server managing business logic and API routing. |
| **Database** | PostgreSQL + Prisma ORM | Relational data persistence and type-safe schema modeling. |
| **Object Storage** | MinIO | S3-compatible, locally-hosted image storage for wound photos. |
| **AI API** | Python, FastAPI | High-performance Python microservice optimized for data science workloads. |
| **ML / CV** | OpenCV (`cv2`), NumPy, Scikit-Image | Image matrix manipulations, color thresholding, mask generation. |
| **Authentication**| JSON Web Tokens (JWT) | Stateless, secure authentication between the React frontend and Node backend. |
| **Testing** | Pytest, TypeScript compiler | Backend AI pipeline tests and strict frontend type validations. |
| **Infrastructure**| Docker & Docker Compose | Containerization for PostgreSQL and MinIO databases. |

## Why these technologies?

### React + TypeScript + Vite
Wound care requires highly interactive interfaces (e.g., comparing historical images side-by-side). React provides component-driven architecture, while TypeScript ensures that complex JSON assessment data passed from the backend is handled without runtime type errors.

### Node.js + Prisma + PostgreSQL
Node.js serves as an excellent IO-bound gateway, perfect for orchestrating file uploads and database reads. Prisma provides complete end-to-end type safety, ensuring that changes to the PostgreSQL schema immediately flag TypeScript errors if the backend API isn't updated to match. PostgreSQL was chosen for its strict ACID compliance, essential for clinical data integrity.

### FastAPI + OpenCV
Python is the lingua franca of machine learning. FastAPI provides asynchronous, rapidly-serializable API endpoints. While the platform is designed to eventually run PyTorch (YOLO/U-Net) models, the current iteration leans heavily on OpenCV for algorithmic calibration detection and contour approximation, which OpenCV handles exceptionally fast on CPU.

### MinIO
Storing images directly in PostgreSQL as BLOBs is a major anti-pattern that bloats database size and kills performance. MinIO provides an S3-compatible object storage layer that runs locally in Docker, allowing the system to scale image storage infinitely while keeping the PostgreSQL database lightweight.
