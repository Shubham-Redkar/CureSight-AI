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

// Database test
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
      message: "Failed to fetch patients",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// MinIO test
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

// Image upload
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "No image uploaded",
      });
    }

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

    res.json({
      status: "ok",
      message: "Image uploaded successfully",
      bucket: bucket,
      objectName: objectName,
      originalName: req.file.originalname,
      size: req.file.size,
      contentType: req.file.mimetype,
    });
  } catch (error) {
    console.error("Image upload error:", error);

    res.status(500).json({
      status: "error",
      message: "Image upload failed",
      error: error instanceof Error ? error.message : String(error),
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