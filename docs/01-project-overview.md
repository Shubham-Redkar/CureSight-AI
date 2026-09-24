# 1. Project Overview

## What is CureSight AI?

CureSight AI is an **AI-Powered Wound Intelligence Platform**. It is designed to assist clinicians in tracking, measuring, and analyzing patient wounds over time using standard digital photographs.

By automating the tedious and error-prone process of manually measuring wounds with paper rulers, CureSight AI aims to bring objective, reproducible data to wound care management. 

## Technical Objective

The technical goal of the project is to provide a complete full-stack web application that allows clinical users to upload wound images, process those images through a computer vision pipeline, extract physical measurements (area, width, length) using a known calibration reference, and securely store the resulting clinical assessments in a persistent database for reporting and historical progression analysis.

## Clinical Workflow

The system facilitates the following clinical workflow:

1. **Doctor / Clinician**: Authenticates into the secure platform.
2. **Patient**: The doctor selects or creates a patient record.
3. **Wound**: The doctor selects a specific wound site on that patient.
4. **Wound Photograph**: A photograph of the wound (ideally containing a green calibration marker) is uploaded.
5. **AI Analysis**: The photograph is sent to the AI service.
6. **Segmentation / Detection**: The system identifies the wound boundaries.
7. **Measurements**: Using the physical calibration marker, the system calculates real-world dimensions (cm² and cm).
8. **Assessment**: The AI findings are stored as an "Assessment" associated with the wound.
9. **Clinical Review**: The doctor reviews the AI-generated assessment.
10. **Verification**: The doctor verifies and approves the assessment, locking its clinical state.
11. **Reports / Historical Analysis**: The verified assessment becomes part of the patient's chronological timeline, allowing for PDF report generation and visual healing progression analysis.

## The Problem Being Solved

Traditional wound measurement relies on manual tracing or ruler approximations, leading to high inter-rater variability (different nurses get different measurements). CureSight AI attempts to solve this by providing a deterministic, mathematically consistent computer vision algorithm that derives exact pixel areas and converts them into physical dimensions using a standard reference scale.

## What the System Does vs. Does NOT Do

### What it DOES:
- Provides a secure interface for patient/wound management.
- Automates the extraction of wound boundaries from an image.
- Automatically detects a specific physical calibration marker (green square) to derive `pixels_per_cm`.
- Stores chronological assessments safely in PostgreSQL.
- Offers a structured workflow for clinicians to explicitly verify AI results.
- Provides visual tools to compare historical wound images (Frame A vs. Frame B).

### What it DOES NOT Do:
- **Autonomous Diagnosis**: CureSight AI is a **clinical decision support tool**. It does not autonomously diagnose the patient or prescribe treatments. The final verification is always performed by a human.
- **Predictive Healing**: The system tracks historical data but *does not currently implement* predictive ML models that forecast when a wound will heal.
- **Real ML Inference (Currently)**: *Demonstration functionality:* The current AI pipeline orchestrator exists, but the underlying YOLO/U-Net models are currently stubbed/mocked with OpenCV heuristic fallbacks. The architecture is ready for real weights, but they are not present.

> **Demonstration / Testing functionality:** Throughout the platform, you may see fallback calibration scales or "Demonstration" markers. These exist solely to allow software testing without requiring a real physical marker in every test image. They are strictly prevented from masquerading as actual physical measurements.
