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

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Wound Healing API is running",
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

app.post("/api/patients", async (req, res) => {
  try {
    const { patientCode, name, age } = req.body;

    if (!patientCode || !name) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "patientCode and name are required."
      });
    }

    const patient = await prisma.patient.create({
      data: {
        patientCode,
        name,
        age: age ? Number(age) : null
      }
    });

    res.status(201).json({
      status: "ok",
      patient
    });
  } catch (error) {
    console.error("Patient creation error:", error);
    if (error && typeof error === 'object' && ('code' in error && error.code === 'P2002' || String(error).includes('Unique constraint failed'))) {
      return res.status(409).json({
        status: "error",
        error: "PATIENT_CODE_EXISTS",
        message: "A patient with this code already exists."
      });
    }

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

    if (!patientId || !location) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "patientId and location are required."
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

    const wound = await prisma.wound.create({
      data: {
        patientId: patient.id,
        location,
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
    if (!woundIdParam) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "woundId query parameter is required."
      });
    }

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

    const assessments = await prisma.assessment.findMany({
      where: { woundId },
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

    // Calculate progress
    let areaChangePct: number | null = null;
    let progressStatus:
      | "improving"
      | "worsening"
      | "stable"
      | "insufficient_data" = "insufficient_data";

    if (
      previousAssessment != null &&
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
    
    if (!req.body.woundId || isNaN(Number(req.body.woundId))) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_WOUND",
        message: "A valid numeric wound ID is required.",
      });
    }

    const sha256Hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
    console.log(`\n[UPLOAD FORENSICS]
- source: ${req.headers['user-agent'] || 'unknown'}
- original filename: ${req.file.originalname}
- MIME type: ${req.file.mimetype}
- byte length: ${req.file.buffer.length}
- SHA-256 hash of req.file.buffer: ${sha256Hash}\n`);

    const woundId = Number(req.body.woundId);
    const woundExists = await prisma.wound.findUnique({ where: { id: woundId } });
    
    if (!woundExists) {
      return res.status(404).json({
        status: "error",
        error: "WOUND_NOT_FOUND",
        message: "The selected wound does not exist.",
      });
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
        formData.append("pixels_per_cm", req.body.pixels_per_cm);
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
            }
        });

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
      assessment: createdAssessment
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