import logging
import time
import base64
import cv2
import numpy as np
from typing import Any

from api.core.exceptions import StructuredError
from api.schemas.wound import AnalyzeWoundResponse, PerWoundResponse

logger = logging.getLogger(__name__)

def raise_structured_error(status_code: int, code: str, message: str, details: list[str] | None = None, request_id: str | None = None):
    raise StructuredError(
        status_code=status_code,
        code=code,
        message=message,
        details=details,
        request_id=request_id
    )

def process_wound_image(
    image_path: str,
    pixels_per_cm: float | None,
    models: dict[str, Any],
    cfg: Any,
    request_id: str | None = None
) -> AnalyzeWoundResponse:
    """
    Core business logic for processing a wound image through the AI pipeline.
    """
    timing = {}
    
    pipeline = models.get("pipeline")
    if not pipeline:
        raise_structured_error(
            status_code=500,
            code="MODELS_NOT_LOADED",
            message="ML Pipeline is not loaded.",
            request_id=request_id
        )
        
    start_time = time.perf_counter()
    # If pixels_per_cm is None, we pass None to the pipeline so physical measurements aren't calculated
    result = pipeline.process_image(image_path, pixels_per_cm=pixels_per_cm)
    timing["total_inference_ms"] = round((time.perf_counter() - start_time) * 1000, 2)
    
    if result["status"] == "error":
        error_code = result.get("error_code", "INTERNAL_ERROR")
        message = result.get("message", "An error occurred during processing.")
        
        # Decide status code based on error code
        if error_code in ["IMAGE_QUALITY_FAILED", "NON_WOUND_IMAGE", "NO_WOUND_DETECTED"]:
            status_code = 422
        elif error_code in ["INVALID_IMAGE"]:
            status_code = 400
        elif error_code == "MODELS_NOT_LOADED":
            status_code = 503
        else:
            status_code = 500
            
        raise_structured_error(
            status_code=status_code,
            code=error_code,
            message=message,
            details=result.get("reasons", []),
            request_id=request_id
        )
        
    wounds_list = []
    total_area = None
    total_perimeter = None
    
    # Global measurements
    meas = result.get("measurements", {})
    if meas and meas.get("physical"):
        total_area = meas["physical"].get("area_cm2")
        total_perimeter = meas["physical"].get("perimeter_cm")
        
    roi_measurements = result.get("roi_measurements", [])
    
    # Optional image drawing
    annotated_image_base64 = None
    try:
        if len(roi_measurements) > 0:
            img = cv2.imread(image_path)
            if img is not None:
                # Draw merged mask
                merged_mask = result.get("merged_mask")
                if merged_mask is not None:
                    color_mask = np.zeros_like(img)
                    color_mask[merged_mask > 0] = [0, 255, 0] # Green for segmentation
                    img = cv2.addWeighted(img, 1, color_mask, 0.4, 0)
                    
                # Draw YOLO bounding boxes
                for roi_meas in roi_measurements:
                    bbox = roi_meas.get("bbox")
                    if bbox:
                        xmin, ymin, xmax, ymax = map(int, bbox)
                        cv2.rectangle(img, (xmin, ymin), (xmax, ymax), (255, 0, 0), 2) # Blue for YOLO bounding box
                
                # Base64 encode
                _, buffer = cv2.imencode('.jpg', img)
                b64 = base64.b64encode(buffer).decode('utf-8')
                annotated_image_base64 = f"data:image/jpeg;base64,{b64}"
    except Exception as e:
        logger.warning(f"[{request_id}] Failed to annotate image: {e}")
    
    for i, roi_meas in enumerate(roi_measurements):
        phys = roi_meas.get("physical") or {}
        
        w = PerWoundResponse(
            wound_id=i + 1,
            detection_confidence=roi_meas.get("confidence"),
            area_cm2=phys.get("area_cm2"),
            perimeter_cm=phys.get("perimeter_cm"),
            length_cm=phys.get("height_cm"),
            width_cm=phys.get("width_cm"),
            aspect_ratio=None,
            circularity=None,
            solidity=None,
            extent=None,
            dominant_color_hex=None,
            mean_hsv=None,
            mean_lab=None,
            color_classification=None
        )
        wounds_list.append(w)
        
    return AnalyzeWoundResponse(
        wound_detected=len(wounds_list) > 0,
        detection_confidence=None,
        wound_count=len(wounds_list),
        total_area_cm2=total_area,
        total_perimeter_cm=total_perimeter,
        wounds=wounds_list,
        overall_color_hex=None,
        overall_color_classification=None,
        inference_time_ms=timing,
        message="Wound analysis completed successfully.",
        annotated_image_base64=annotated_image_base64,
        calibration=result.get("calibration"),
        physical_measurement_available=result.get("calibration", {}).get("pixels_per_cm") is not None
    )
