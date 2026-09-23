import express from "express";
import cors from "cors";
import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import minioClient from "./minio";
import upload from "./upload";

const app = express();

app.use(cors());
app.use(express.json());

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

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
    
    if (!patientId) {
      return res.status(400).json({
        status: "error",
        error: "INVALID_INPUT",
        message: "patientId query parameter is required."
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

    const wounds = await prisma.wound.findMany({
      where: { patientId: patient.id },
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

    // Construct MinIO image URLs from persisted keys
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

    // Extract the current assessment's area from its persisted measurements
    const currentMeasurements = assessment.measurements as any;
    const currentArea: number | null =
      currentMeasurements?.total_area_cm2 ?? null;

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
        const prevArea = prevMeas?.total_area_cm2;
        if (
          prev.status === "COMPLETED" &&
          prev.woundDetected === true &&
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


app.get("/api/minio-test", async (req, res) => {
  try {
    const bucket = process.env.MINIO_BUCKET || "wound-images";

    const exists = await minioClient.bucketExists(bucket);

    res.json({
      status: "ok",
      minioConnected: true,
      bucketExists: exists,
      bucket: bucket,
    });
  } catch (error) {
    console.error("MinIO connection error:", error);

    res.status(500).json({
      status: "error",
      minioConnected: false,
      message: "MinIO connection failed",
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

    const bucket = process.env.MINIO_BUCKET || "wound-images";
    
    // Check if object exists first
    try {
      await minioClient.statObject(bucket, objectName);
    } catch (e) {
      return res.status(404).send("Image not found");
    }

    const dataStream = await minioClient.getObject(bucket, objectName);
    
    // Set proper content type based on extension
    const ext = objectName.split('.').pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    else if (ext === "png") contentType = "image/png";
    
    res.setHeader("Content-Type", contentType);
    dataStream.pipe(res);
  } catch (error) {
    console.error("Image retrieval error:", error);
    res.status(500).send("Internal server error");
  }
});

// Image upload
app.post("/api/upload", upload.single("image"), async (req, res) => {
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

    const bucket = process.env.MINIO_BUCKET || "wound-images";

    const extension =
      req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";

    const objectName =
      `wounds/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${extension}`;

    await minioClient.putObject(
      bucket,
      objectName,
      req.file.buffer,
      req.file.size,
      {
        "Content-Type": req.file.mimetype,
      }
    );

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
        const aiResponse = await fetch(`${FASTAPI_URL}/api/v1/analyze-wound-upload/`, {
            method: "POST",
            body: formData,
        });
        
        if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            
            // Handle expected non-wound AI result gracefully (HTTP 422)
            if (aiResponse.status === 422) {
                try {
                    const errJson = JSON.parse(errorText);
                    if (errJson.error?.code === "NON_WOUND_IMAGE") {
                        aiAnalysis = {
                            wound_detected: false,
                            message: errJson.error.message,
                            wounds: []
                        };
                    } else {
                        console.error(`[UPLOAD] FastAPI request failed: status=${aiResponse.status} body=${errorText}`);
                        throw new Error(`FastAPI error: ${aiResponse.status} ${errorText}`);
                    }
                } catch (e) {
                    console.error(`[UPLOAD] FastAPI request failed: status=${aiResponse.status} body=${errorText}`);
                    throw new Error(`FastAPI error: ${aiResponse.status} ${errorText}`);
                }
            } else if (aiResponse.status === 413) {
                console.error(`[UPLOAD] FastAPI request failed: status=${aiResponse.status} body=${errorText}`);
                throw new Error(`Image is too large. Please use an image with dimensions up to 4096 × 4096 pixels.`);
            } else {
                console.error(`[UPLOAD] FastAPI request failed: status=${aiResponse.status} body=${errorText}`);
                throw new Error(`FastAPI error: ${aiResponse.status} ${errorText}`);
            }
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
            
            await minioClient.putObject(
                bucket,
                annotatedImageKey,
                buffer,
                buffer.length,
                { "Content-Type": "image/jpeg" }
            );
            
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
                wounds: aiAnalysis.wounds
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
        aiError = error instanceof Error ? error.message : String(error);
        
        return res.status(error.message?.includes('too large') ? 413 : 500).json({
          status: "error",
          error: "AI_ANALYSIS_FAILED",
          message: aiError
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

// Start server
const PORT = Number(process.env.PORT) || 5000;

const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error);
});

// Shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");

  await prisma.$disconnect();

  server.close(() => {
    process.exit(0);
  });
});