# AI-Based Wound Healing Progress Analysis

An AI-powered wound assessment system designed to analyze wound images, measure wound dimensions, track healing progress over time, and generate clinically useful reports.

> **Project Status:** 🚧 Initial Planning / Architecture Phase
> **Implementation Status:** No implementation has been completed yet.

---

## 📌 Overview

Wound healing is commonly monitored by visually inspecting the wound and manually estimating its size and progress. This process can be subjective, time-consuming, and difficult to compare consistently across multiple assessments.

This project aims to develop an AI-assisted system that can analyze wound images and provide objective measurements and progress information.

The proposed system will:

* Detect the wound region in an image
* Precisely segment the wound boundary
* Calculate wound area and other measurements
* Compare wound assessments across time
* Estimate healing progress
* Provide a recovery timeline
* Generate an automated clinical report
* Allow a clinician to review and verify AI-generated results

The project is intended as a **clinical decision-support system**, not as an autonomous diagnostic system.

---

## 🎯 Problem Statement

Doctors and healthcare professionals often estimate wound size and healing progress manually.

This can introduce:

* Subjectivity in measurements
* Variation between different assessments
* Difficulty comparing images taken at different times
* Additional workload for clinicians
* Limited quantitative information about healing trends

The goal of this project is to develop an AI-assisted workflow that converts wound images into measurable and trackable healing information.

---

## 🎯 Objectives

The primary objectives of the project are:

1. Capture and upload wound images.
2. Detect the wound region using deep learning.
3. Segment the wound at pixel level.
4. Calculate wound dimensions and area.
5. Compare current and previous wound assessments.
6. Estimate healing percentage and healing trends.
7. Provide a recovery timeline.
8. Generate an automated clinical report.
9. Allow clinicians to verify or adjust AI-generated measurements.
10. Maintain historical assessment data for each wound.

---

## 🧠 Proposed AI Pipeline

The core AI pipeline is planned as:

```text
Wound Image
     │
     ▼
┌─────────────┐
│    YOLO     │
│   Detection │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    U-Net    │
│ Segmentation│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   OpenCV    │
│ Measurement │
└──────┬──────┘
       │
       ▼
Wound Measurements
       │
       ▼
Healing Progress Analysis
       │
       ▼
Clinical Report
```

### YOLO

YOLO is planned for **wound detection**.

Its purpose is to identify the approximate location of the wound within the image before performing detailed segmentation.

### U-Net

U-Net is planned for **pixel-level wound segmentation**.

Instead of only producing a bounding box, U-Net will be used to identify the precise wound boundary.

### OpenCV

OpenCV will be used for image processing and measurement operations, including:

* Image preprocessing
* Cropping
* Contrast adjustment
* Mask processing
* Contour extraction
* Pixel-area calculation
* Geometric measurements
* Calibration

The proposed YOLO → U-Net → OpenCV pipeline is described in the project architecture document.

---

## 📏 Measurement and Calibration

A major consideration of this project is converting image pixels into meaningful physical measurements.

A segmentation model can determine the number of wound pixels, but pixel measurements alone do not directly represent real-world dimensions such as cm or cm².

Therefore, the proposed system will investigate:

* A physical reference marker/ruler in the image
* A controlled image-capture setup
* Consistent camera distance and angle
* Lighting and image-quality requirements

The calibration strategy will be finalized before implementing clinical area measurements.

> **Important:** Reporting a measurement such as `4.2 cm²` without a reliable physical reference would create a false sense of precision.

The architecture proposal specifically identifies calibration as an important design decision that should be addressed before measurement implementation.

---

## 🏗️ Proposed System Architecture

The planned system will be divided into separate application and machine-learning services.

```text
                    ┌──────────────────────┐
                    │     React + TS       │
                    │   Clinical Dashboard │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Node.js + Express  │
                    │    Main Backend API  │
                    └───────┬───────┬──────┘
                            │       │
                 ┌──────────┘       └───────────┐
                 ▼                              ▼
        ┌─────────────────┐            ┌─────────────────┐
        │   PostgreSQL    │            │ MinIO / S3      │
        │ Clinical Data   │            │ Image Storage   │
        └─────────────────┘            └─────────────────┘
                            │
                            ▼
                    ┌──────────────────────┐
                    │       FastAPI        │
                    │      ML Service      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   YOLO → U-Net →     │
                    │       OpenCV         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Measurements + AI    │
                    │ Results + Confidence │
                    └──────────────────────┘
```

The architecture separates the **application/clinical workflow** from the **machine-learning workload**. Node.js/TypeScript is planned for the application layer, while FastAPI/Python will handle the AI pipeline.

---

## 🛠️ Proposed Technology Stack

| Layer            | Technology                     | Planned Purpose                                   |
| ---------------- | ------------------------------ | ------------------------------------------------- |
| Frontend         | React + TypeScript             | Clinical dashboard and image comparison interface |
| Main Backend     | Node.js + Express + TypeScript | Application and clinical workflow                 |
| ORM              | Prisma                         | Database access and type-safe queries             |
| Database         | PostgreSQL                     | Patients, wounds, assessments and measurements    |
| Image Storage    | MinIO / S3                     | Wound image storage                               |
| ML API           | FastAPI                        | AI inference service                              |
| Object Detection | YOLO                           | Wound localization                                |
| Segmentation     | U-Net                          | Precise wound boundary segmentation               |
| Image Processing | OpenCV                         | Preprocessing and measurements                    |
| Cache            | Redis                          | Optional caching/rate limiting                    |
| Async Processing | RabbitMQ                       | Optional future asynchronous inference            |
| Interoperability | FHIR                           | Future healthcare-system integration              |
| Deployment       | Docker                         | Containerized development and deployment          |

These technologies are **proposed**, not yet implemented. The architecture document describes PostgreSQL, MinIO, FastAPI, YOLO, U-Net and OpenCV as the core planned components, with Redis and RabbitMQ as later/optional additions.

---

## 🗃️ Planned Data Model

The clinical data is expected to follow a relational structure:

```text
Patient
   │
   ├── Wound
   │      │
   │      ├── Assessment
   │      │      │
   │      │      ├── Image
   │      │      ├── AI Result
   │      │      ├── Measurements
   │      │      └── Clinician Review
   │      │
   │      └── Assessment
   │
   └── Wound
```

### Planned entities

* Patient
* Wound
* Assessment
* Image
* Measurement
* AI Result
* Clinician Review
* Report

PostgreSQL is proposed because the project contains naturally relational data such as **patient → wound → assessment → measurement**, with relationships and constraints that should be enforced by the database.

---

## 🖼️ Image Storage Strategy

Wound images are planned to be stored separately from clinical metadata.

```text
PostgreSQL
    │
    ├── Patient information
    ├── Wound information
    ├── Assessment information
    └── Image object key / metadata

MinIO / S3
    │
    ├── wound-image-001
    ├── wound-image-002
    └── wound-image-003
```

The database will store metadata and references to images, while the actual image files will reside in object storage.

For local development, **MinIO** is proposed, with an S3-compatible storage system planned for deployment.

This keeps large binary image data separate from structured clinical data.

---

## 🔄 Planned Workflow

The intended workflow is:

```text
1. Clinician uploads wound image
              ↓
2. Backend validates the image
              ↓
3. Image stored in MinIO / S3
              ↓
4. Assessment record created
              ↓
5. Node.js sends image for AI analysis
              ↓
6. FastAPI receives analysis request
              ↓
7. YOLO detects wound
              ↓
8. U-Net segments wound
              ↓
9. OpenCV calculates measurements
              ↓
10. AI result stored
              ↓
11. Clinician reviews result
              ↓
12. Current assessment compared
    with previous assessments
              ↓
13. Healing trend calculated
              ↓
14. Clinical report generated
```

This workflow follows the proposed upload and retrieval flow in the architecture document.

---

## 📊 Expected Output

The system is planned to produce the following outputs:

### 1. Wound Boundary

A segmentation mask showing the detected wound region.

```text
Original Image
      +
Segmentation Mask
      ↓
Detected Wound Boundary
```

### 2. Area Measurement

Estimated wound area based on the segmented region and the selected calibration method.

### 3. Healing Percentage

A comparison between previous and current wound measurements.

For example:

```text
Previous Area : 10.0 cm²
Current Area  : 7.5 cm²

Estimated reduction = 25%
```

> The exact healing metric and formula will be defined during implementation and validation.

### 4. Recovery Timeline

The system will maintain historical assessments to visualize wound progression over time.

```text
Day 0    → 10.0 cm²
Day 7    → 8.5 cm²
Day 14   → 7.1 cm²
Day 21   → 5.8 cm²
   ↓
Healing Trend
```

### 5. Automatic Clinical Report

A future report may contain:

* Patient/wound information
* Assessment date
* Original wound image
* Segmentation result
* Wound measurements
* Previous measurements
* Healing trend
* AI confidence
* Model version
* Clinician verification
* Observations

---

## 👨‍⚕️ Clinician Verification

The AI output will **not automatically be treated as the final clinical measurement**.

The proposed workflow allows a clinician to:

1. Review the AI-generated wound boundary.
2. Accept the result.
3. Adjust the boundary if required.
4. Verify the measurement.
5. Store both the original AI result and the clinician-verified result.

This distinction is important because it allows the project to evaluate how closely the model agrees with clinical assessment over time.

---

## 🔐 Security and Healthcare Considerations

Since the project deals with potentially sensitive medical information, security will be considered from the beginning.

Planned considerations include:

* Authentication
* Role-based access control
* Audit logging
* HTTPS/TLS
* Protected image access
* Upload validation
* Consent tracking
* Model version tracking

These are planned architectural requirements and are **not currently implemented**.

---

## 🏥 Future FHIR Integration

FHIR is planned as a future interoperability layer.

Potential FHIR resources include:

* `Patient`
* `Observation`
* `DiagnosticReport`
* `DocumentReference`

FHIR would allow the system to exchange relevant information with external healthcare systems without replacing the project's internal REST API.

---

## 🗺️ Development Roadmap

The project will be developed incrementally.

### Phase 1 — Foundation

* [ ] Design PostgreSQL schema
* [ ] Set up Node.js/Express backend
* [ ] Set up React frontend
* [ ] Implement Patient → Wound → Assessment structure
* [ ] Implement secure image upload
* [ ] Set up MinIO object storage

### Phase 2 — AI Pipeline

* [ ] Set up FastAPI ML service
* [ ] Implement image preprocessing
* [ ] Prepare wound detection dataset
* [ ] Train/evaluate YOLO model
* [ ] Prepare wound segmentation dataset
* [ ] Train/evaluate U-Net model
* [ ] Implement wound segmentation
* [ ] Implement OpenCV measurement pipeline
* [ ] Define and implement calibration
* [ ] Store AI results

### Phase 3 — Clinical Workflow

* [ ] Build wound history/timeline
* [ ] Compare previous and current images
* [ ] Compare segmentation masks
* [ ] Implement clinician verification
* [ ] Calculate healing percentage/trends
* [ ] Generate clinical reports

### Phase 4 — Healthcare & Security

* [ ] Implement RBAC
* [ ] Implement audit logging
* [ ] Protect image access
* [ ] Add model versioning
* [ ] Explore FHIR integration

### Phase 5 — Optional Engineering Improvements

* [ ] Redis caching
* [ ] RabbitMQ asynchronous inference
* [ ] Application/ML monitoring
* [ ] Cloud deployment

The phase structure follows the proposed build order in the architecture document.

---

## 📁 Planned Repository Structure

The repository structure is expected to evolve during implementation. An initial target structure is:

```text
wound-healing-analysis/
│
├── frontend/
│   └── React + TypeScript application
│
├── backend/
│   └── Node.js + Express + TypeScript
│
├── ml-service/
│   └── FastAPI + Python
│
├── ml/
│   ├── yolo/
│   ├── unet/
│   ├── preprocessing/
│   └── measurement/
│
├── data/
│   └── Dataset documentation
│
├── docs/
│   ├── architecture/
│   └── research/
│
├── docker/
│
├── README.md
└── .gitignore
```

> This is a **planned structure**. Directories will be added as implementation begins.

---

## 📐 Important Technical Challenges

Several challenges will need to be addressed during development.

### Dataset Availability

A suitable wound-image dataset with reliable annotations will be required for training and evaluation.

### Segmentation Accuracy

The wound boundary may be difficult to identify because of:

* Different wound types
* Lighting variations
* Skin-tone variation
* Shadows
* Blood or exudate
* Irregular wound boundaries
* Background objects

### Measurement Calibration

Pixel measurements cannot automatically be interpreted as real-world measurements without a reliable scale.

### Image Consistency

Healing comparisons become more meaningful when images are captured under reasonably consistent conditions.

### Clinical Validation

AI-generated measurements should be evaluated against appropriate ground-truth or clinician-verified measurements.

### Model Versioning

Every AI-generated assessment should eventually record which model/version produced the result so that historical results remain traceable.

## The architecture proposal specifically highlights calibration, clinician verification, model versioning, and consistent capture conditions as important considerations.

## ⚠️ Current Limitations

At the current stage:

* No AI model has been implemented.
* No YOLO model has been trained.
* No U-Net model has been trained.
* No image segmentation pipeline exists yet.
* No wound measurement pipeline exists yet.
* No healing prediction model exists yet.
* No frontend has been implemented.
* No backend has been implemented.
* No database has been implemented.
* No clinical report generator has been implemented.

This repository currently represents the **planning and architecture stage** of the project.

---

## 🚀 Future Scope

Possible future improvements include:

* Improved wound segmentation models
* More accurate wound-area estimation
* Multi-class wound analysis
* Wound severity assessment
* Tissue classification
* Healing-rate prediction
* Personalized recovery estimates
* Automated longitudinal trend analysis
* Model confidence visualization
* Explainable AI features
* FHIR-based interoperability
* Cloud deployment
* Monitoring and model performance tracking

---

## 🧪 Evaluation Strategy

Model evaluation will be introduced once the dataset and models are available.

Potential evaluation metrics include:

### Object Detection

* Precision
* Recall
* mAP

### Segmentation

* Dice Score
* Intersection over Union (IoU)
* Precision
* Recall

### Measurement

* Mean Absolute Error
* Relative measurement error

### Healing Progress

The final evaluation methodology will depend on the available longitudinal dataset and clinically validated ground truth.

---

## ⚕️ Disclaimer

This project is being developed as an **academic/research prototype and clinical decision-support concept**.

It is **not intended to replace professional medical judgment, diagnosis, or treatment decisions**.

AI-generated measurements and predictions should be reviewed by a qualified healthcare professional before being used for clinical decision-making.

---

## 📚 Project Documentation

The repository will gradually include documentation covering:

* System architecture
* Dataset selection
* Data preprocessing
* YOLO training
* U-Net training
* Image segmentation
* Wound measurement
* Calibration
* Healing-progress calculation
* Backend API
* Database design
* Clinical workflow
* Model evaluation
* Deployment

---

## 📌 Project Status

**Current Stage:** 🟡 Planning / Architecture

```text
Architecture        ██████████  Planned
Backend             ░░░░░░░░░░  Not Started
Frontend            ░░░░░░░░░░  Not Started
Dataset             ░░░░░░░░░░  To Be Finalized
YOLO                ░░░░░░░░░░  Not Started
U-Net               ░░░░░░░░░░  Not Started
OpenCV Pipeline     ░░░░░░░░░░  Not Started
Measurement         ░░░░░░░░░░  Not Started
Healing Analysis    ░░░░░░░░░░  Not Started
Clinical Report     ░░░░░░░░░░  Not Started
```

---

## 👥 Project

**AI-Based Wound Healing Progress Analysis**

The project aims to combine **computer vision, deep learning, backend engineering, and healthcare-oriented software design** into an end-to-end wound assessment platform.

---

## ⭐ Vision

The long-term goal is to build a system where a clinician can upload a wound image and receive a structured assessment containing:

```text
Wound Image
     ↓
Wound Detection
     ↓
Precise Segmentation
     ↓
Measurements
     ↓
Historical Comparison
     ↓
Healing Trend
     ↓
Clinician Verification
     ↓
Clinical Report
```

The focus is not simply to build an image-classification model, but to develop a complete and traceable workflow around **wound measurement and longitudinal healing assessment**.

## 🖥️ Web Interface (React + Node.js)
The clinical dashboard is built with React and Vite. It connects to the Node.js backend to manage patient data and wound assessments.
