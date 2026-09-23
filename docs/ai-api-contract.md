# AI Service API Contract

This document outlines the internal contract between the CureSight Node.js Orchestrator and the FastAPI Inference Service.

## Endpoint

- **URL**: `POST /api/v1/analyze-wound-upload/`
- **Content-Type**: `multipart/form-data`

## Request Format

The backend must forward the image directly as a multipart file field.

### Fields
| Field Name      | Type | Description |
|-----------------|------|-------------|
| `file`          | Blob | The raw image bytes |
| `pixels_per_cm` | Float | (Optional) Scale reference for real-world metrics |

## Response Format

All responses are formatted as JSON.

### 1. Successful Analysis (Wound Detected)
**HTTP 200 OK**
```json
{
  "wound_detected": true,
  "detection_confidence": null,
  "wound_count": 1,
  "total_area_cm2": null,
  "total_perimeter_cm": null,
  "wounds": [
    {
      "wound_id": 1,
      "detection_confidence": 0.6587873697280884,
      "area_cm2": null,
      "perimeter_cm": null,
      "length_cm": null,
      "width_cm": null,
      "aspect_ratio": null,
      "circularity": null,
      "solidity": null,
      "extent": null,
      "dominant_color_hex": null,
      "mean_hsv": null,
      "mean_lab": null,
      "color_classification": null
    }
  ],
  "overall_color_hex": null,
  "overall_color_classification": null,
  "inference_time_ms": {
    "total_inference_ms": 168.59
  },
  "message": "Wound analysis completed successfully.",
  "annotated_image_base64": "..."
}
```

### 2. Successful Analysis (Wound NOT Detected)
**HTTP 422 Unprocessable Entity**
If the Wound Gate correctly executes but determines the image does not contain a wound, it rejects the pipeline execution gracefully to save compute resources.
```json
{
  "error": {
    "code": "NON_WOUND_IMAGE",
    "message": "Rejected by Wound Gate: No wound classified in image.",
    "details": [],
    "request_id": "206f59fd-7fa1-4c85-909f-46d6516097d9"
  }
}
```

## Node.js Expected Behaviors
- **Annotated Image Parsing**: The Node backend MUST extract the `annotated_image_base64` string, decode it into binary, upload it to MinIO, and **delete** it from the JSON object before storing the measurements in PostgreSQL.
- **Handling 422 Non-Wound**: Node.js MUST catch the `422` error, parse the body, and if `error.code === "NON_WOUND_IMAGE"`, it must NOT crash. It must return a `200 OK` to the frontend with an `aiAnalysis` block specifying `wound_detected: false`.
