# Tissue Inference API

This document describes the dedicated tissue inference service integrated into the CureSight AI FastAPI backend.

## Endpoint

**`POST /api/v1/analyze-tissue-upload/`**

Analyzes a cropped/full wound image and predicts its tissue composition.

## Request Format

- **Method**: `POST`
- **Content-Type**: `multipart/form-data`
- **Payload**:
  - `file`: The wound image file (JPEG/PNG) to analyze.

### Authentication
Following existing FastAPI conventions, this microservice endpoint does not enforce RBAC/Auth internally; it expects the Node.js API Gateway or authenticated frontend service to proxy requests and handle role-based access control.

## Response Format

The endpoint returns a strongly-typed JSON schema:

```json
{
  "tissue_composition": {
    "epithelial": 0.0,
    "granulation": 65.5,
    "slough": 20.0,
    "necrotic": 14.5,
    "fibrin": 0.0,
    "callus": 0.0,
    "other": 0.0
  },
  "inference_metadata": {
    "model_name": "Tversky_ResNet34",
    "model_version": "a06_b04",
    "message": "Successfully calculated tissue composition."
  },
  "annotated_image_base64": "data:image/jpeg;base64,..."
}
```

## Tissue Classes

The segmentation model recognizes the following 7 tissue classes (excluding background):
- Epithelial
- Granulation
- Slough
- Necrotic
- Fibrin
- Callus
- Other

## Percentage Semantics

**Denominator:** Valid predicted tissue pixels (excluding background pixels).

The composition values represent the proportion of each tissue type relative to the *total detected wound area*, ensuring the percentages sum to 100% (or 0% if no wound tissue is found). This preserves the semantics established in `ml/healing/feature_extractor.py`.

## Model Checkpoint

- **File**: `ml/models/tissue/experiments/tversky_a06_b04/best.pt`
- **Architecture**: SMP U-Net with ResNet34 encoder.
- **Loading**: The `.pt` file is loaded exactly ONCE during the FastAPI `lifespan` event and stored in the global `ml_models` dictionary to prevent re-instantiation during request handling.

## Scientific Boundaries and Limitations

> **IMPORTANT CLINICAL DISCLAIMER:**
> 
> The predictions returned by this API are strictly **model outputs (predicted tissue composition)**. 
> 
> They must **NOT** be treated as or described as:
> - Clinical diagnoses
> - Confirmed tissue pathology
> - Healing predictions
> - Treatment recommendations
> - Physical wound area or cm² measurements
> - Clinical healing stages
> - Prognosis
>
> The current longitudinal dataset lacks physical wound-area calibration and clinical healing outcomes, so supervised trajectory or physical modeling is not scientifically justified. The tissue segmentation model provides relative morphological insight only.
