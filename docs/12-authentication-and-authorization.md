# 12. Authentication and Authorization

CureSight AI implements a robust, secure authentication system using JSON Web Tokens (JWT) protecting all clinical endpoints.

## Authentication (Who are you?)

1. **Login Flow**: The React frontend posts a `username` and `password` to `/api/auth/login`.
2. **Database Verification**: The backend queries the PostgreSQL `User` table. *Note: In the development environment, dummy users (admin/clinician) are seeded based on `.env`.*
3. **Token Generation**: If valid, the backend signs a JWT payload (containing `id` and `role`) using the secret `JWT_SECRET`.
4. **Client Storage**: The frontend stores the token in `localStorage` and embeds it as a `Bearer` token in the `Authorization` header of all subsequent `apiFetch()` requests.

## Authorization (What are you allowed to do?)

The Node.js backend uses a `requireAuth` middleware to protect routes.

### `requireAuth` Middleware
Every protected route (e.g., `/api/patients`, `/api/wounds`, `/api/upload`) runs through this middleware. It extracts the JWT, verifies the cryptographic signature against the secret, and attaches the parsed `req.user` payload. If the token is missing, expired, or tampered with, the request is rejected with a `401 Unauthorized`.

### Roles
The system defines two primary roles in the `UserRole` Prisma enum:
- **`ADMIN`**: Reserved for system configuration.
- **`DOCTOR`**: Standard clinical user permitted to interact with Patients, Wounds, and Assessments.

## Current Limitations
- **No Password Hashing (Currently)**: In the current development repository, passwords are plain-text matched against the seeded demo credentials. This must be replaced with `bcrypt` or `argon2` before production deployment.
- **No Role-Based Access Control (RBAC) Enforcement**: While roles (`ADMIN`, `DOCTOR`) exist in the database and JWT payload, the backend routes currently do not enforce role-specific permissions (e.g. preventing a DOCTOR from accessing ADMIN settings). All authenticated users currently share global read/write access.
