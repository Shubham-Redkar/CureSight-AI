import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import "dotenv/config";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import * as argon2 from "argon2";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import pg from "pg";

import { PrismaClient, UserRole } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { supabase } from "./supabase";
import upload from "./upload";
import multer from "multer";

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const frontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : undefined;

app.use(cors({
  origin: isProduction && frontendUrl ? frontendUrl : true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.set('trust proxy', 1);

// Safe Structured Request Tracing Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as any).id = reqId;
  res.setHeader("X-Request-Id", reqId);
  const start = performance.now();

  res.on("finish", () => {
    const duration = performance.now() - start;
    // Structured log: safe fields only, no passwords/tokens/cookies or patient data
    console.log(JSON.stringify({
      type: "REQUEST_LOG",
      requestId: reqId,
      method: req.method,
      path: req.baseUrl + req.path,
      status: res.statusCode,
      durationMs: Number(duration.toFixed(2)),
      timestamp: new Date().toISOString(),
    }));
  });

  next();
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "TOO_MANY_REQUESTS", message: "Too many login attempts, please try again later." },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: "TOO_MANY_REQUESTS", message: "Upload limit exceeded, please try again later." },
});

const tissueLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: "TOO_MANY_REQUESTS", message: "Tissue analysis limit exceeded, please try again later." },
});

// Resilient connection pooling with Neon pooler fallback
const dbConnectionString = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL!;
const dbPool = new pg.Pool({
  connectionString: dbConnectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

const adapter = new PrismaPg(dbPool);

const prisma = new PrismaClient({
  adapter,
});

// Health check (lightweight liveness ping)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Wound Healing API is running",
  });
});

// Readiness check (dependency readiness without leaking secrets)
app.get("/api/health/ready", async (req, res) => {
  const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
  const checks: Record<string, string> = {
    database: "unknown",
    ai_service: "unknown",
  };
  let isReady = true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "healthy";
  } catch (err: any) {
    checks.database = "unhealthy";
    isReady = false;
  }

  try {
    const aiRes = await fetch(`${FASTAPI_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (aiRes.ok) {
      checks.ai_service = "healthy";
    } else {
      checks.ai_service = `degraded (${aiRes.status})`;
      isReady = false;
    }
  } catch (err: any) {
    checks.ai_service = "unreachable";
    isReady = false;
  }

  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    status: isReady ? "ok" : "degraded",
    ready: isReady,
    checks,
  });
});


app.get("/api/db-test", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      message: "Database connection successful",
      result,
    });
  } catch (error) {
    console.error("Database connection error:", error);

    res.status(500).json({
      status: "error",
      message: "Database connection failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Authentication Middleware
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  let token = req.cookies.token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.substring(7);
  }
  if (!token) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; role: UserRole };
    (req as any).user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired token" });
  }
};

export const requireRoles = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Insufficient permissions" });
    }
    next();
  };
};

// Auth Endpoints
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "INVALID_INPUT", message: "Username and password required" });
    }

    const tDbStart = performance.now();
    const user = await prisma.user.findUnique({ where: { username } });
    const dbDuration = performance.now() - tDbStart;

    if (!user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid username or password" });
    }

    const tArgonStart = performance.now();
    const valid = await argon2.verify(user.passwordHash, password);
    const argonDuration = performance.now() - tArgonStart;

    console.log(JSON.stringify({
      type: "STAGE_TIMING",
      requestId: (req as any).id,
      stage: "login",
      dbQueryMs: Number(dbDuration.toFixed(2)),
      passwordVerifyMs: Number(argonDuration.toFixed(2)),
      success: valid,
    }));

    if (!valid) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "8h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Internal server error" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: "UNAUTHORIZED", message: "User not found" });
    }

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Internal server error" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ status: "ok", message: "Logged out" });
});

// Apply requireAuth to all clinical routes
app.use("/api/patients", requireAuth);
app.use("/api/wounds", requireAuth);
app.use("/api/assessments", requireAuth);
app.use("/api/upload", requireAuth);
app.use("/api/reports", requireAuth);
app.use("/api/dashboard", requireAuth);
app.use("/api/images", requireAuth);

// Patients
app.get("/api/patients", async (req, res) => {
  try {
    const patients = await prisma.patient.findMany();

    res.json({
      status: "ok",
      count: patients.length,
      patients,
    });
  } catch (error) {
    console.error("Patient fetch error:", error);

    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Failed to fetch patients",
    });
  }
});

function generatePatientCode(): string {
  const randomNum = crypto.randomInt(100000, 999999);
  return `PT-${randomNum}`;
}

app.post("/api/patients", async (req, res) => {
  try {
    const { patientCode, name, age } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "Patient name is required."
      });
    }

    const trimmedName = name.trim();
    const parsedAge = age !== undefined && age !== null && age !== "" ? Number(age) : null;
    if (parsedAge !== null && (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150)) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "Age must be a valid number between 0 and 150."
      });
    }

    const isCustomCodeProvided = typeof patientCode === "string" && patientCode.trim().length > 0;

    if (isCustomCodeProvided) {
      const cleanCode = patientCode.trim().toUpperCase();
      try {
        const patient = await prisma.patient.create({
          data: {
            patientCode: cleanCode,
            name: trimmedName,
            age: parsedAge
          }
        });

        return res.status(201).json({
          status: "ok",
          patient
        });
      } catch (err: any) {
        if (err && typeof err === "object" && (("code" in err && err.code === "P2002") || String(err).includes("Unique constraint failed"))) {
          return res.status(409).json({
            status: "error",
            error: "PATIENT_CODE_EXISTS",
            message: "A patient with this code already exists."
          });
        }
        throw err;
      }
    }

    // Auto-generate unique patient code with retry loop to handle collisions safely
    let patient;
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      attempts++;
      const generatedCode = generatePatientCode();

      try {
        patient = await prisma.patient.create({
          data: {
            patientCode: generatedCode,
            name: trimmedName,
            age: parsedAge
          }
        });
        break;
      } catch (err: any) {
        const isUniqueError = err && typeof err === "object" && (("code" in err && err.code === "P2002") || String(err).includes("Unique constraint failed"));
        if (isUniqueError && attempts < maxAttempts) {
          continue;
        }
        throw err;
      }
    }

    if (!patient) {
      return res.status(500).json({
        status: "error",
        error: "GENERATION_FAILED",
        message: "Failed to generate a unique patient code. Please try again."
      });
    }

    return res.status(201).json({
      status: "ok",
      patient
    });
  } catch (error) {
    console.error("Patient creation error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "An unexpected database error occurred."
    });
  }
});

// Wounds
app.post("/api/wounds", async (req, res) => {
  try {
    const { patientId, location, description } = req.body;

    if (!patientId) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "patientId is required."
      });
    }

    const numericPatientId = Number(patientId);
    if (isNaN(numericPatientId)) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "patientId must be a valid number."
      });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: numericPatientId }
    });

    if (!patient) {
      return res.status(404).json({
        status: "error",
        error: "PATIENT_NOT_FOUND",
        message: "The referenced patient does not exist in the database."
      });
    }

    const finalLocation = (location && typeof location === 'string' && location.trim().length > 0)
      ? location.trim()
      : "General Wound Site";

    const wound = await prisma.wound.create({
      data: {
        patientId: patient.id,
        location: finalLocation,
        description: description || null
      }
    });

    res.status(201).json({
      status: "ok",
      wound
    });
  } catch (error) {
    console.error("Wound creation error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Failed to create wound",
    });
  }
});

app.get("/api/wounds", async (req, res) => {
  try {
    const { patientId } = req.query;
    let whereClause: any = {};
    
    if (patientId) {
      const numericPatientId = Number(patientId);
      if (isNaN(numericPatientId)) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_INPUT",
          message: "patientId must be a valid number."
        });
      }

      const patient = await prisma.patient.findUnique({
        where: { id: numericPatientId }
      });

      if (!patient) {
        return res.status(404).json({
          status: "error",
          error: "PATIENT_NOT_FOUND",
          message: "The referenced patient does not exist in the database."
        });
      }
      whereClause = { patientId: patient.id };
    }

    const wounds = await prisma.wound.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      status: "ok",
      wounds
    });
  } catch (error) {
    console.error("Wounds fetch error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Failed to fetch wounds",
    });
  }
});

app.get("/api/assessments", async (req, res) => {
  try {
    const woundIdParam = req.query.woundId;
    const patientIdParam = req.query.patientId;

    if (!woundIdParam && !patientIdParam) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "woundId or patientId query parameter is required."
      });
    }

    let whereClause: any = {};

    if (woundIdParam) {
      const woundId = Number(woundIdParam);
      if (isNaN(woundId)) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_WOUND_ID",
          message: "Wound ID must be a number."
        });
      }

      const woundExists = await prisma.wound.findUnique({ where: { id: woundId } });
      if (!woundExists) {
        return res.status(404).json({
          status: "error",
          error: "WOUND_NOT_FOUND",
          message: "The referenced wound does not exist."
        });
      }
      whereClause.woundId = woundId;
    } else if (patientIdParam) {
      const patientId = Number(patientIdParam);
      if (isNaN(patientId)) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_PATIENT_ID",
          message: "Patient ID must be a number."
        });
      }

      const patientExists = await prisma.patient.findUnique({ where: { id: patientId } });
      if (!patientExists) {
        return res.status(404).json({
          status: "error",
          error: "PATIENT_NOT_FOUND",
          message: "The referenced patient does not exist."
        });
      }
      whereClause.wound = { patientId };
    }

    const assessments = await prisma.assessment.findMany({
      where: whereClause,
      include: { wound: true },
      orderBy: { assessmentDate: 'desc' }
    });

    res.json({
      status: "ok",
      assessments
    });
  } catch (error) {
    console.error("Assessments fetch error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Failed to fetch assessments",
    });
  }
});

app.get("/api/assessments/:id", async (req, res) => {
  try {
    const assessmentId = Number(req.params.id);
    if (isNaN(assessmentId)) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_ASSESSMENT_ID",
        message: "Assessment ID must be a number."
      });
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId }
    });

    if (!assessment) {
      return res.status(404).json({
        status: "error",
        error: "ASSESSMENT_NOT_FOUND",
        message: "The referenced assessment does not exist."
      });
    }

    res.json({
      status: "ok",
      assessment
    });
  } catch (error) {
    console.error("Assessment fetch error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Failed to fetch assessment",
    });
  }
});

app.patch("/api/assessments/:id/verify", requireRoles(["DOCTOR", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ status: "error", error: "INVALID_INPUT", message: "Invalid ID" });
    }

    const { verifiedResult } = req.body;
    if (!verifiedResult) {
      return res.status(400).json({ status: "error", error: "INVALID_INPUT", message: "Missing verifiedResult" });
    }

    const assessment = await prisma.assessment.findUnique({ where: { id } });
    if (!assessment) {
      return res.status(404).json({ status: "error", error: "NOT_FOUND", message: "Assessment not found" });
    }

    const updated = await prisma.assessment.update({
      where: { id },
      data: {
        status: "VERIFIED",
        verified: true,
        verifiedResult: verifiedResult
      }
    });

    res.json({ status: "ok", assessment: updated });
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ status: "error", error: "INTERNAL_ERROR", message: "Failed to verify assessment" });
  }
});

app.post("/api/assessments/:id/calibrate", requireRoles(["DOCTOR", "ADMIN"]), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ status: "error", error: "INVALID_INPUT", message: "Invalid assessment ID" });
    }

    const { pixels_per_cm, reference_distance_cm, point1, point2, notes } = req.body;

    let computedPxPerCm: number | null = null;
    let validRefDist: number | null = null;
    let p1Coords: [number, number] | null = null;
    let p2Coords: [number, number] | null = null;

    // Option A: Two-point calibration
    if (point1 != null && point2 != null) {
      if (reference_distance_cm == null) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_INPUT",
          message: "reference_distance_cm is required when calibrating with two points"
        });
      }

      const refDist = Number(reference_distance_cm);
      if (isNaN(refDist) || !isFinite(refDist) || refDist <= 0) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_INPUT",
          message: "reference_distance_cm must be a positive, finite number"
        });
      }

      const getCoord = (p: any): [number, number] | null => {
        if (Array.isArray(p) && p.length >= 2) {
          const x = Number(p[0]);
          const y = Number(p[1]);
          if (!isNaN(x) && isFinite(x) && !isNaN(y) && isFinite(y)) return [x, y];
        } else if (p && typeof p === "object") {
          const x = Number(p.x);
          const y = Number(p.y);
          if (!isNaN(x) && isFinite(x) && !isNaN(y) && isFinite(y)) return [x, y];
        }
        return null;
      };

      p1Coords = getCoord(point1);
      p2Coords = getCoord(point2);

      if (!p1Coords || !p2Coords) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_INPUT",
          message: "point1 and point2 must contain valid finite numeric coordinates [x, y] or {x, y}"
        });
      }

      const dx = p2Coords[0] - p1Coords[0];
      const dy = p2Coords[1] - p1Coords[1];
      const pixelDistance = Math.hypot(dx, dy);

      if (pixelDistance < 1.0) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_INPUT",
          message: "Calibration points must be distinct (distance >= 1.0 px)"
        });
      }

      computedPxPerCm = pixelDistance / refDist;
      validRefDist = refDist;
    } else if (pixels_per_cm != null) {
      // Option B: Direct scale entry
      const px = Number(pixels_per_cm);
      if (isNaN(px) || !isFinite(px) || px <= 0) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_INPUT",
          message: "pixels_per_cm must be a positive, finite number"
        });
      }
      computedPxPerCm = px;
      if (reference_distance_cm != null) {
        const refDist = Number(reference_distance_cm);
        if (!isNaN(refDist) && isFinite(refDist) && refDist > 0) {
          validRefDist = refDist;
        }
      }
    } else {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "Either two points with reference_distance_cm or pixels_per_cm must be supplied"
      });
    }

    if (!computedPxPerCm || isNaN(computedPxPerCm) || !isFinite(computedPxPerCm) || computedPxPerCm <= 0) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "Calculated scale is invalid or non-positive"
      });
    }

    const assessment = await prisma.assessment.findUnique({ where: { id } });
    if (!assessment) {
      return res.status(404).json({
        status: "error",
        error: "NOT_FOUND",
        message: "Assessment not found"
      });
    }

    const scale = Number(computedPxPerCm.toFixed(3));
    const rawMeasurements = (assessment.measurements as any) || {};
    const m = { ...rawMeasurements };

    const totalAreaPx = typeof m.total_area_pixels === "number" ? m.total_area_pixels : null;
    const totalPeriPx = typeof m.total_perimeter_pixels === "number" ? m.total_perimeter_pixels : null;

    // Proper dimensional conversion:
    // Area scales quadratically: cm2 = px2 / scale^2
    // Linear measurements scale linearly: cm = px / scale
    const scaleSq = scale * scale;
    const totalAreaCm2 = totalAreaPx !== null ? Number((totalAreaPx / scaleSq).toFixed(3)) : null;
    const totalPeriCm = totalPeriPx !== null ? Number((totalPeriPx / scale).toFixed(3)) : null;

    if (Array.isArray(m.wounds)) {
      m.wounds = m.wounds.map((w: any) => {
        const wAreaPx = typeof w.area_pixels === "number" ? w.area_pixels : null;
        const wPeriPx = typeof w.perimeter_pixels === "number" ? w.perimeter_pixels : null;
        const wWidthPx = typeof w.width_pixels === "number" ? w.width_pixels : null;
        const wHeightPx = typeof w.height_pixels === "number" ? w.height_pixels : null;
        return {
          ...w,
          area_cm2: wAreaPx !== null ? Number((wAreaPx / scaleSq).toFixed(3)) : null,
          perimeter_cm: wPeriPx !== null ? Number((wPeriPx / scale).toFixed(3)) : null,
          width_cm: wWidthPx !== null ? Number((wWidthPx / scale).toFixed(3)) : null,
          length_cm: wHeightPx !== null ? Number((wHeightPx / scale).toFixed(3)) : null,
        };
      });
    }

    const user = (req as any).user;
    const calibratedBy = user?.id || user?.role || "CLINICIAN";

    m.total_area_cm2 = totalAreaCm2;
    m.total_perimeter_cm = totalPeriCm;
    m.physical_measurement_available = true;
    m.calibration = {
      source: "manual",
      detected: false,
      verified: true,
      pixels_per_cm: scale,
      reference_distance_cm: validRefDist,
      point1: p1Coords,
      point2: p2Coords,
      calibratedAt: new Date().toISOString(),
      calibratedBy,
      label: "Clinician Manual Calibration",
      reason: "CLINICIAN_MANUAL_CALIBRATION",
      notes: notes || "Clinician confirmed physical scale reference."
    };

    const updated = await prisma.assessment.update({
      where: { id },
      data: {
        measurements: m
      }
    });

    console.log(JSON.stringify({
      type: "AUDIT_LOG",
      action: "ASSESSMENT_CALIBRATED",
      assessmentId: id,
      calibratedBy,
      pixels_per_cm: scale,
      reference_distance_cm: validRefDist,
      timestamp: new Date().toISOString()
    }));

    return res.json({
      status: "ok",
      assessment: updated,
      calibration: m.calibration
    });
  } catch (error) {
    console.error("Manual calibration error:", error);
    return res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Failed to calibrate assessment"
    });
  }
});

app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const totalPatients = await prisma.patient.count();
    const activeWounds = await prisma.wound.count();
    const pendingReview = await prisma.assessment.count({ where: { status: "COMPLETED" } });
    const verifiedAssessments = await prisma.assessment.count({ where: { verified: true } });
    const recentAssessments = await prisma.assessment.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { wound: { include: { patient: true } } }
    });

    res.json({
      status: "ok",
      data: {
        totalPatients,
        activeWounds,
        pendingReview,
        verifiedAssessments,
        recentAssessments
      }
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ status: "error", error: "INTERNAL_ERROR", message: "Failed to load dashboard summary" });
  }
});

// Clinical Report — deterministic backend-generated view of persisted data
app.get("/api/reports/:assessmentId", async (req, res) => {
  try {
    const assessmentId = Number(req.params.assessmentId);
    if (isNaN(assessmentId)) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "Assessment ID must be a number.",
      });
    }

    // Fetch assessment with its wound and patient chain
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        wound: {
          include: {
            patient: true,
          },
        },
      },
    });

    if (!assessment) {
      return res.status(404).json({
        status: "error",
        error: "ASSESSMENT_NOT_FOUND",
        message: "The requested assessment does not exist.",
      });
    }

    const wound = assessment.wound;
    const patient = wound.patient;

    // Construct Supabase image URLs from persisted keys
    const originalUrl = assessment.imageKey
      ? `/api/images/${assessment.imageKey}`
      : null;
    const annotatedUrl = assessment.annotatedImageKey
      ? `/api/images/${assessment.annotatedImageKey}`
      : null;

    // Fetch all assessments for the same wound for progress comparison
    const allWoundAssessments = await prisma.assessment.findMany({
      where: { woundId: wound.id },
      orderBy: { assessmentDate: "asc" },
    });

    let effectiveWoundDetected = assessment.woundDetected;
    if (assessment.verified === true && assessment.verifiedResult != null) {
      const verifiedResult = assessment.verifiedResult as any;
      if (typeof verifiedResult.woundDetected === "boolean") {
        effectiveWoundDetected = verifiedResult.woundDetected;
      }
    }

    // Extract the current assessment's area from its persisted measurements, giving precedence to clinician overrides
    const currentMeasurements = assessment.measurements as any;
    let currentArea: number | null = null;
    if (effectiveWoundDetected === true) {
      const vResult = assessment.verifiedResult as any;
      if (assessment.verified && vResult?.measurements?.total_area_cm2 != null) {
        currentArea = vResult.measurements.total_area_cm2;
      } else if (assessment.verified && vResult?.measurements?.areaCm2 != null) {
        currentArea = vResult.measurements.areaCm2;
      } else {
        currentArea = currentMeasurements?.total_area_cm2 ?? null;
      }
    }

    // Determine previous valid assessment (chronologically preceding with a valid area)
    let previousAssessment: {
      id: number;
      date: string;
      area_cm2: number;
    } | null = null;

    const currentIndex = allWoundAssessments.findIndex(
      (a) => a.id === assessmentId
    );
    if (currentIndex > 0) {
      // Walk backwards from the current assessment to find the previous valid one
      for (let i = currentIndex - 1; i >= 0; i--) {
        const prev = allWoundAssessments[i];
        const prevMeas = prev.measurements as any;
        let prevArea = prevMeas?.total_area_cm2;
        let prevEffectiveWoundDetected = prev.woundDetected;
        if (prev.verified === true && prev.verifiedResult != null) {
          const vResult = prev.verifiedResult as any;
          if (typeof vResult.woundDetected === "boolean") {
            prevEffectiveWoundDetected = vResult.woundDetected;
          }
          if (vResult?.measurements?.total_area_cm2 != null) {
            prevArea = vResult.measurements.total_area_cm2;
          } else if (vResult?.measurements?.areaCm2 != null) {
            prevArea = vResult.measurements.areaCm2;
          }
        }

        if (
          ["COMPLETED", "VERIFIED"].includes(prev.status) &&
          prevEffectiveWoundDetected === true &&
          prevArea != null &&
          typeof prevArea === "number"
        ) {
          previousAssessment = {
            id: prev.id,
            date: prev.assessmentDate.toISOString(),
            area_cm2: prevArea,
          };
          break;
        }
      }
    }

    // Calibration safety helper for longitudinal comparisons
    const isAssessmentCalibrationVerified = (ass: any): boolean => {
      if (!ass) return false;
      if (ass.verified === true && ass.verifiedResult != null) {
        const vResult = ass.verifiedResult as any;
        if (vResult?.measurements?.total_area_cm2 != null || vResult?.measurements?.areaCm2 != null) {
          return true;
        }
      }

      const m = ass.measurements as any;
      if (!m) return false;
      if (m.physical_measurement_available === false) return false;

      const cal = m.calibration;
      if (!cal) return false;

      if (cal.source === "demo" || cal.verified === false) {
        return false;
      }
      if (cal.source === "automatic" && (cal.detected === true || (cal.confidence != null && cal.confidence > 0))) {
        return true;
      }
      if (cal.source === "manual" && cal.verified === true && typeof cal.pixels_per_cm === "number" && cal.pixels_per_cm > 0) {
        return true;
      }

      return false;
    };

    const currentCalibrationVerified = isAssessmentCalibrationVerified(assessment);
    const prevAssModel = previousAssessment != null
      ? allWoundAssessments.find((a) => a.id === previousAssessment?.id)
      : null;
    const prevCalibrationVerified = prevAssModel != null
      ? isAssessmentCalibrationVerified(prevAssModel)
      : false;

    // Calculate progress
    let areaChangePct: number | null = null;
    let progressStatus:
      | "improving"
      | "worsening"
      | "stable"
      | "insufficient_data" = "insufficient_data";
    let calibrationNotice: string | null = null;
    if (previousAssessment != null) {
      if (!currentCalibrationVerified || !prevCalibrationVerified) {
        areaChangePct = null;
        progressStatus = "insufficient_data";
        calibrationNotice = "Physical area comparison suppressed: One or more assessments lack verified reference marker calibration.";
      } else if (
        currentArea != null &&
        previousAssessment.area_cm2 > 0
      ) {
        areaChangePct =
          ((currentArea - previousAssessment.area_cm2) /
            previousAssessment.area_cm2) *
          100;

        if (areaChangePct < -1) {
          progressStatus = "improving"; // Area decreased
        } else if (areaChangePct > 1) {
          progressStatus = "worsening"; // Area increased
        } else {
          progressStatus = "stable"; // Area within ±1%
        }
      }
    }

    const reportData = {
      patient: {
        id: patient.id,
        patientCode: patient.patientCode,
        name: patient.name,
        age: patient.age,
      },
      wound: {
        id: wound.id,
        patientId: wound.patientId,
        location: wound.location,
        description: wound.description,
      },
      assessment: {
        id: assessment.id,
        woundId: assessment.woundId,
        assessmentDate: assessment.assessmentDate.toISOString(),
        status: assessment.status,
        woundDetected: assessment.woundDetected,
        notes: assessment.notes,
        measurements: assessment.measurements,
      },
      images: {
        originalUrl,
        annotatedUrl,
      },
      progress: {
        previousAssessment,
        currentArea_cm2: currentArea,
        areaChangePct,
        status: progressStatus,
        calibrationNotice,
        calibrationVerified: currentCalibrationVerified && (previousAssessment == null || prevCalibrationVerified),
      },
    };

    res.json({
      status: "ok",
      report: reportData,
    });
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Failed to generate report.",
    });
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where = {
      status: {
        in: ["COMPLETED", "VERIFIED"]
      }
    };

    const [total, assessments] = await Promise.all([
      prisma.assessment.count({ where }),
      prisma.assessment.findMany({
        where,
        include: {
          wound: {
            include: {
              patient: true
            }
          }
        },
        orderBy: {
          assessmentDate: 'desc'
        },
        skip,
        take: limit,
      })
    ]);

    res.json({
      status: "ok",
      reports: assessments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("GET /reports Error:", error);
    res.status(500).json({ status: "error", error: "Internal Server Error" });
  }
});


app.get("/api/supabase-test", async (req, res) => {
  try {
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "wound-images";

    const { data, error } = await supabase.storage.getBucket(bucket);

    res.json({
      status: "ok",
      supabaseConnected: !error,
      bucketExists: !!data,
      bucket: bucket,
    });
  } catch (error) {
    console.error("Supabase connection error:", error);

    res.status(500).json({
      status: "error",
      supabaseConnected: false,
      message: "Supabase connection failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Image retrieval endpoint
app.get(/^\/api\/images\/(.+)$/, async (req, res) => {
  try {
    const objectName = req.params[0];
    if (!objectName || objectName.includes("..")) {
      return res.status(400).send("Invalid object key");
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "wound-images";
    
    const { data, error } = await supabase.storage.from(bucket).download(objectName);

    if (error || !data) {
      return res.status(404).send("Image not found");
    }

    const buffer = Buffer.from(await data.arrayBuffer());

    // Set proper content type based on extension
    const ext = objectName.split('.').pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    else if (ext === "png") contentType = "image/png";
    
    res.setHeader("Content-Type", contentType);
    res.send(buffer);
  } catch (error) {
    console.error("Image retrieval error:", error);
    res.status(500).send("Internal server error");
  }
});

// Image upload
app.post("/api/upload", uploadLimiter, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No image uploaded",
      });
    }
    
    const hasWoundId = req.body.woundId !== undefined && req.body.woundId !== null && req.body.woundId !== "" && !isNaN(Number(req.body.woundId));
    const hasPatientId = req.body.patientId !== undefined && req.body.patientId !== null && req.body.patientId !== "" && !isNaN(Number(req.body.patientId));

    if (!hasWoundId && !hasPatientId) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_WOUND",
        message: "A valid numeric wound ID or patient ID is required.",
      });
    }

    const sha256Hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    console.log(`\n[UPLOAD FORENSICS]
- source: ${req.headers['user-agent'] || 'unknown'}
- original filename: ${req.file.originalname}
- MIME type: ${req.file.mimetype}
- byte length: ${req.file.buffer.length}
- SHA-256 hash of req.file.buffer: ${sha256Hash}\n`);

    let wound = null;
    let woundId: number;

    if (hasWoundId) {
      woundId = Number(req.body.woundId);
      wound = await prisma.wound.findUnique({ where: { id: woundId } });

      if (!wound) {
        return res.status(404).json({
          status: "error",
          error: "WOUND_NOT_FOUND",
          message: "The selected wound does not exist.",
        });
      }
    } else {
      const patientId = Number(req.body.patientId);
      const patient = await prisma.patient.findUnique({ where: { id: patientId } });

      if (!patient) {
        return res.status(404).json({
          status: "error",
          error: "PATIENT_NOT_FOUND",
          message: "The referenced patient does not exist.",
        });
      }

      const locationStr = typeof req.body.location === 'string' && req.body.location.trim() ? req.body.location.trim() : null;

      if (locationStr) {
        const existingWound = await prisma.wound.findFirst({
          where: {
            patientId: patient.id,
            location: { equals: locationStr, mode: 'insensitive' }
          }
        });
        if (existingWound) {
          wound = existingWound;
        } else {
          wound = await prisma.wound.create({
            data: {
              patientId: patient.id,
              location: locationStr,
              description: req.body.description || null
            }
          });
        }
      } else {
        const existingWounds = await prisma.wound.findMany({
          where: { patientId: patient.id },
          orderBy: { createdAt: 'desc' }
        });

        if (existingWounds.length > 0) {
          wound = existingWounds[0];
        } else {
          wound = await prisma.wound.create({
            data: {
              patientId: patient.id,
              location: "General Wound Site",
              description: req.body.description || null
            }
          });
        }
      }
      woundId = wound.id;
    }
    console.log("[UPLOAD] req.body:", req.body);

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "wound-images";

    const extension =
      req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";

    const objectName =
      `wounds/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(objectName, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    // Call FastAPI service
    const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
    
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname);
    
    if (req.body.pixels_per_cm) {
        const parsedPx = parseFloat(req.body.pixels_per_cm);
        if (isNaN(parsedPx) || !isFinite(parsedPx) || parsedPx <= 0) {
            return res.status(400).json({
                status: "error",
                error: "INVALID_CALIBRATION",
                message: "pixels_per_cm must be a positive finite number"
            });
        }
        formData.append("pixels_per_cm", String(parsedPx));
    }

    let aiAnalysis = null;
    let aiError = null;
    
    let createdAssessment = null;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const aiResponse = await fetch(`${FASTAPI_URL}/api/v1/analyze-wound-upload/`, {
            method: "POST",
            body: formData,
            signal: controller.signal as RequestInit["signal"],
        });
        clearTimeout(timeoutId);
        
        if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            
            // Forward structured FastAPI errors directly (422 validation, 503 service unavailable)
            if (aiResponse.status === 422 || aiResponse.status === 503) {
                try {
                    const errJson = JSON.parse(errorText);
                    if (errJson.error && errJson.error.code) {
                        return res.status(aiResponse.status).json({
                            status: "error",
                            error: errJson.error.code,
                            message: errJson.error.message || "AI Analysis failed",
                            details: errJson.error.details || [],
                            requestId: errJson.error.request_id
                        });
                    }
                } catch (e) {
                    // Fall back to generic error if not JSON
                }
            } else if (aiResponse.status === 413) {
                return res.status(413).json({
                    status: "error",
                    error: "IMAGE_TOO_LARGE",
                    message: "Image is too large. Please use an image with dimensions up to 4096 × 4096 pixels."
                });
            }
            
            console.error(`[UPLOAD] FastAPI request failed: status=${aiResponse.status} body=${errorText}`);
            throw new Error(`FastAPI error: ${aiResponse.status} ${errorText}`);
        } else {
            aiAnalysis = await aiResponse.json();
        }



        let annotatedImageKey: string | null = null;
        let measurements: any = null;

        // Process successful wound detection
        if (aiAnalysis && aiAnalysis.wound_detected && aiAnalysis.annotated_image_base64) {
            let base64Data = aiAnalysis.annotated_image_base64;
            if (base64Data.includes("base64,")) {
                base64Data = base64Data.split("base64,")[1];
            }
            const buffer = Buffer.from(base64Data, 'base64');
            const assessmentId = Date.now(); // Unique ID for storage path
            annotatedImageKey = `analysis/${assessmentId}/annotated.jpg`;
            
            const { error: uploadError2 } = await supabase.storage.from(bucket).upload(annotatedImageKey, buffer, {
                contentType: "image/jpeg",
                upsert: false
            });

            if (uploadError2) {
              console.error("Annotated upload error:", uploadError2);
            }
            
            // Clean base64 out of API response
            delete aiAnalysis.annotated_image_base64;
            aiAnalysis.annotated_image_url = `/api/images/${annotatedImageKey}`;
            
            // Extract structured measurements
            measurements = {
                wound_count: aiAnalysis.wound_count,
                total_area_cm2: aiAnalysis.total_area_cm2,
                total_perimeter_cm: aiAnalysis.total_perimeter_cm,
                total_area_pixels: aiAnalysis.total_area_pixels,
                total_perimeter_pixels: aiAnalysis.total_perimeter_pixels,
                overall_color_hex: aiAnalysis.overall_color_hex,
                color_classification: aiAnalysis.overall_color_classification,
                wounds: aiAnalysis.wounds,
                calibration: aiAnalysis.calibration,
                physical_measurement_available: aiAnalysis.physical_measurement_available,
                wound_classification: aiAnalysis.wound_classification
            };
        }

        // INTEGRATION FIX: Update PostgreSQL Assessment record
        createdAssessment = await prisma.assessment.create({
            data: {
                woundId,
                imageKey: objectName,
                annotatedImageKey,
                measurements: measurements || undefined,
                woundDetected: aiAnalysis?.wound_detected ?? null,
                status: "COMPLETED",
                notes: aiAnalysis?.message || "Analysis complete"
            },
            include: {
                wound: true
            }
        });

        if (aiAnalysis?.wound_classification && (!wound.description || wound.description === 'Unspecified')) {
          try {
            wound = await prisma.wound.update({
              where: { id: woundId },
              data: { description: aiAnalysis.wound_classification }
            });
          } catch (e) {
            // non-fatal description update
          }
        }

    } catch (error: any) {
        console.error("[UPLOAD] AI Analysis Error Stage:", error);
        const isConnErr = error?.message?.includes("fetch failed") || error?.code === "ECONNREFUSED" || error?.name === "TypeError";
        aiError = isConnErr
          ? `AI inference service is unreachable at ${FASTAPI_URL}. Please ensure the FastAPI AI service is running.`
          : (error instanceof Error ? error.message : String(error));
        
        return res.status(error.message?.includes('too large') ? 413 : 500).json({
          status: "error",
          error: "AI_ANALYSIS_FAILED",
          message: aiError,
          requestId: (req as any).id
        });
    }

    res.json({
      status: "ok",
      message: "Image uploaded successfully",
      bucket: bucket,
      objectName: objectName,
      originalName: req.file.originalname,
      size: req.file.size,
      contentType: req.file.mimetype,
      aiAnalysis,
      aiError,
      assessment: createdAssessment,
      wound
    });
  } catch (error) {
    console.error("[UPLOAD] Outer Stage error:", error);

    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Image upload failed",
    });
  }
});

// Tissue Analysis Upload
app.post("/api/analysis/tissue", requireAuth, requireRoles(["DOCTOR", "ADMIN"]), tissueLimiter, upload.single("image"), async (req, res) => {
  try {
    let imageBuffer: Buffer;
    let originalName: string;
    let mimeType: string;
    let existingAssessment = null;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "wound-images";

    const timings: Record<string, number> = {};

    let woundId: number | null = null;
    if (req.body?.woundId !== undefined && req.body?.woundId !== null && req.body?.woundId !== "") {
      const parsed = Number(req.body.woundId);
      if (isNaN(parsed)) {
        return res.status(400).json({ status: "error", error: "INVALID_WOUND_ID", message: "Invalid wound ID" });
      }
      woundId = parsed;
    }

    if (req.body?.assessmentId) {
      const assessmentId = Number(req.body.assessmentId);
      if (isNaN(assessmentId)) {
        return res.status(400).json({
          status: "error",
          error: "INVALID_ASSESSMENT_ID",
          message: "A valid numeric assessment ID is required."
        });
      }

      const tDbStart = performance.now();
      existingAssessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
      timings.dbFetchMs = Number((performance.now() - tDbStart).toFixed(2));

      if (!existingAssessment || !existingAssessment.imageKey) {
        return res.status(404).json({
          status: "error",
          error: "IMAGE_NOT_FOUND",
          message: "Assessment or original source image not found."
        });
      }

      const tStorageStart = performance.now();
      const { data, error } = await supabase.storage.from(bucket).download(existingAssessment.imageKey);
      timings.storageDownloadMs = Number((performance.now() - tStorageStart).toFixed(2));

      if (error || !data) {
        return res.status(404).json({
          status: "error",
          error: "STORAGE_DOWNLOAD_FAILED",
          message: "Could not retrieve original image from storage."
        });
      }
      imageBuffer = Buffer.from(await data.arrayBuffer());
      originalName = existingAssessment.imageKey.split('/').pop() || "image.jpg";
      const ext = originalName.split('.').pop()?.toLowerCase();
      mimeType = ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg');
    } else if (req.file) {
      imageBuffer = req.file.buffer;
      originalName = req.file.originalname;
      mimeType = req.file.mimetype;
    } else {
      return res.status(400).json({
        status: "error",
        error: "NO_IMAGE_SOURCE",
        message: "No image uploaded and no valid assessmentId provided.",
      });
    }

    // Call FastAPI service
    const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
    formData.append("file", blob, originalName);

    if (!woundId && existingAssessment?.woundId) {
      woundId = existingAssessment.woundId;
    }

    // Upload original image to Supabase if it's a new upload
    let objectName = existingAssessment?.imageKey || '';
    if (!existingAssessment) {
      const extension = originalName.split(".").pop()?.toLowerCase() || "jpg";
      objectName = `tissue/${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage.from(bucket).upload(objectName, imageBuffer, {
        contentType: mimeType,
        upsert: false
      });

      if (uploadError) {
        console.error("Original image upload error:", uploadError);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const tAiStart = performance.now();
    const aiResponse = await fetch(`${FASTAPI_URL}/api/v1/analyze-tissue-upload/`, {
      method: "POST",
      body: formData,
      signal: controller.signal as RequestInit["signal"],
    });
    clearTimeout(timeoutId);
    timings.aiInferenceMs = Number((performance.now() - tAiStart).toFixed(2));

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      
      if (aiResponse.status === 422 || aiResponse.status === 400 || aiResponse.status === 503) {
        try {
          const errJson = JSON.parse(errorText);
          return res.status(aiResponse.status).json(errJson);
        } catch (e) {
          // fallback
        }
      } else if (aiResponse.status === 413) {
        return res.status(413).json({
          status: "error",
          error: "IMAGE_TOO_LARGE",
          message: "Image is too large."
        });
      }
      
      console.error(`[TISSUE UPLOAD] FastAPI request failed: status=${aiResponse.status} body=${errorText}`);
      return res.status(500).json({
        status: "error",
        error: "AI_ANALYSIS_FAILED",
        message: "Failed to process tissue analysis via AI service."
      });
    }
    
    const aiAnalysis = await aiResponse.json();
    
    let createdAssessment = existingAssessment;
    if (aiAnalysis.tissue_composition) {
        let annotatedImageKey: string | null = null;
        if (aiAnalysis.annotated_image_base64) {
            let base64Data = aiAnalysis.annotated_image_base64;
            if (base64Data.includes("base64,")) {
                base64Data = base64Data.split("base64,")[1];
            }
            const buffer = Buffer.from(base64Data, 'base64');
            annotatedImageKey = `tissue-analysis/${Date.now()}/annotated.jpg`;
            const tUploadStart = performance.now();
            const { error: uploadError2 } = await supabase.storage.from(bucket).upload(annotatedImageKey, buffer, {
                contentType: "image/jpeg",
                upsert: false
            });
            timings.storageUploadMs = Number((performance.now() - tUploadStart).toFixed(2));
            if (!uploadError2) {
                aiAnalysis.annotated_image_url = `/api/images/${annotatedImageKey}`;
            }
        }

        if (existingAssessment) {
            const updatePayload = JSON.stringify({
                tissue_composition: aiAnalysis.tissue_composition,
                inference_metadata: aiAnalysis.inference_metadata,
                tissue_annotated_image_url: aiAnalysis.annotated_image_url
            });

            const tUpdateStart = performance.now();
            try {
                const updatedRows = await prisma.$queryRaw<any[]>`
                    UPDATE "Assessment"
                    SET "measurements" = COALESCE("measurements", '{}'::jsonb) || ${updatePayload}::jsonb
                    WHERE "id" = ${existingAssessment.id}
                    RETURNING *;
                `;
                createdAssessment = updatedRows[0] || null;
            } catch (rawError) {
                console.warn("[TISSUE UPLOAD] Raw atomic update failed, falling back to transaction update:", rawError);
                createdAssessment = await prisma.$transaction(async (tx) => {
                    const fresh = await tx.assessment.findUnique({ where: { id: existingAssessment.id } });
                    const freshMeas = (fresh && typeof fresh.measurements === 'object' && fresh.measurements !== null)
                        ? (fresh.measurements as Record<string, any>)
                        : {};
                    return tx.assessment.update({
                        where: { id: existingAssessment.id },
                        data: {
                            measurements: {
                                ...freshMeas,
                                tissue_composition: aiAnalysis.tissue_composition,
                                inference_metadata: aiAnalysis.inference_metadata,
                                tissue_annotated_image_url: aiAnalysis.annotated_image_url
                            }
                        }
                    });
                });
            }
            timings.dbUpdateMs = Number((performance.now() - tUpdateStart).toFixed(2));
        } else if (woundId) {
            createdAssessment = await prisma.assessment.create({
                data: {
                    woundId,
                    imageKey: objectName,
                    annotatedImageKey,
                    measurements: {
                        tissue_composition: aiAnalysis.tissue_composition,
                        inference_metadata: aiAnalysis.inference_metadata
                    },
                    woundDetected: true,
                    status: "COMPLETED",
                    notes: "Tissue Analysis"
                }
            });
        }
    }

    console.log(JSON.stringify({
      type: "STAGE_TIMING",
      requestId: (req as any).id,
      stage: "tissue_analysis",
      assessmentId: existingAssessment?.id ?? req.body.assessmentId,
      ...timings
    }));

    res.json({
      status: "ok",
      assessment: createdAssessment,
      ...aiAnalysis
    });
  } catch (error: any) {
    console.error("[TISSUE UPLOAD] Error:", error);
    res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
      message: "Tissue upload failed",
    });
  }
});

// Global Error Handling Middleware (including Multer errors)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        status: "error",
        error: "IMAGE_TOO_LARGE",
        message: "Uploaded image exceeds the 20 MB size limit."
      });
    }
    return res.status(400).json({
      status: "error",
      error: "UPLOAD_ERROR",
      message: err.message
    });
  }
  if (err && (err.message === "Only JPEG, PNG, and WebP images are allowed" || err.message?.includes("images are allowed"))) {
    return res.status(400).json({
      status: "error",
      error: "INVALID_IMAGE_TYPE",
      message: err.message
    });
  }
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    status: "error",
    error: err.code || "INTERNAL_ERROR",
    message: err.message || "An unexpected error occurred"
  });
});

// Start server
const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);

  // Keep Render free-tier dyno warm — ping /api/health every 14 minutes.
  // Render spins down free instances after 15 min of inactivity.
  if (isProduction) {
    const KEEPALIVE_URL = process.env.RENDER_EXTERNAL_URL
      ? `${process.env.RENDER_EXTERNAL_URL}/api/health`
      : `http://localhost:${PORT}/api/health`;

    setInterval(() => {
      fetch(KEEPALIVE_URL, { signal: AbortSignal.timeout(10_000) })
        .then(() => console.log('[keepalive] ping ok'))
        .catch((err) => console.warn('[keepalive] ping failed:', err.message));
    }, 14 * 60 * 1000); // every 14 minutes
  }
});

server.on("error", (error) => {
  console.error("Server error:", error);
});

// Shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  await prisma.$disconnect();
  await dbPool.end();

  server.close(() => {
    process.exit(0);
  });
});

export { app, server, prisma, dbPool };