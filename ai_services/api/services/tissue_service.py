import logging
import time
import base64
import cv2
import numpy as np
from typing import Any

from api.core.exceptions import StructuredError
from api.schemas.tissue import AnalyzeTissueResponse, TissueCompositionPercentages, InferenceMetadata
from api.services.wound_service import raise_structured_error

logger = logging.getLogger(__name__)

def process_tissue_image(
    image_path: str,
    models: dict[str, Any],
    cfg: Any,
    request_id: str | None = None
) -> AnalyzeTissueResponse:
    pipeline = models.get("pipeline")
    tissue_seg = models.get("tissue_segmenter")
    
    if not pipeline or not tissue_seg:
        raise_structured_error(
            status_code=503,
            code="MODELS_NOT_LOADED",
            message="ML Pipeline or Tissue Segmenter is not loaded.",
            request_id=request_id
        )
        
    # Quality check
    from api.services.image_quality import analyze_image_quality
    iq_result = analyze_image_quality(image_path, cfg)
    if not iq_result.get("accepted"):
        reasons = iq_result.get("reasons", [iq_result.get("reason", "Unknown image quality error")])
        raise_structured_error(
            status_code=422,
            code="IMAGE_QUALITY_FAILED",
            message="Image failed quality checks: " + "; ".join(reasons),
            details=reasons,
            request_id=request_id
        )
        
    image_bgr = cv2.imread(image_path)
    if image_bgr is None:
        raise_structured_error(status_code=400, code="INVALID_IMAGE", message="Failed to read image", request_id=request_id)
        
    # Wound gate
    if pipeline.wound_gate.required and pipeline.wound_gate.is_loaded:
        gate_result = pipeline.wound_gate.predict(image_path)
        if not gate_result["is_wound"]:
            raise_structured_error(
                status_code=422, 
                code="NON_WOUND_IMAGE", 
                message="Rejected by Wound Gate",
                request_id=request_id
            )
            
    # YOLO
    conf_thresh = pipeline.config.get("ml_pipeline", {}).get("yolo_confidence_threshold", 0.25)
    yolo_result = pipeline.yolo.detect(image_path, conf_thresh=conf_thresh)
    
    if not yolo_result["detected"] or not yolo_result.get("detections"):
        return AnalyzeTissueResponse(
            tissue_composition=TissueCompositionPercentages(),
            inference_metadata=InferenceMetadata(
                model_name="Tversky_ResNet34",
                model_version="a06_b04",
                message="No wound detected in image."
            ),
            annotated_image_base64=None
        )
        
    # Get largest bounding box
    largest_det = max(yolo_result["detections"], key=lambda d: (d["bbox"][2]-d["bbox"][0])*(d["bbox"][3]-d["bbox"][1]))
    crop_result = pipeline.cropper.crop(image_bgr, largest_det["bbox"])
    
    # Tissue Segmenter
    seg_result = tissue_seg.segment(crop_result["roi_image"])
    
    if not seg_result["available"] or seg_result["composition"] is None:
        raise_structured_error(500, "TISSUE_INFERENCE_FAILED", "Tissue segmentation failed.", request_id=request_id)
        
    comp_data = seg_result["composition"]
    tissue_comp = TissueCompositionPercentages(
        epithelial=comp_data.get("epithelial", 0.0),
        granulation=comp_data.get("granulation", 0.0),
        slough=comp_data.get("slough", 0.0),
        necrotic=comp_data.get("necrotic", 0.0),
        fibrin=comp_data.get("fibrin", 0.0),
        callus=comp_data.get("callus", 0.0),
        other=comp_data.get("other", 0.0)
    )
    
    annotated_image_base64 = None
    if seg_result["roi_mask"] is not None:
        full_mask = pipeline.cropper.map_mask_to_original(
            seg_result["roi_mask"],
            crop_result["offset"],
            crop_result["original_shape"]
        )
        
        color_mask = np.zeros_like(image_bgr)
        colors = {
            1: [255, 150, 150], # Epithelial (BGR)
            2: [0, 255, 255],   # Slough (Yellow)
            3: [0, 0, 255],     # Granulation (Red)
            4: [0, 0, 0],       # Necrotic (Black)
            5: [128, 128, 128], # Other (Gray)
            6: [0, 255, 255],   # Fibrin (Yellow)
            7: [200, 200, 200]  # Callus (Light Gray)
        }
        for cls_id, color in colors.items():
            color_mask[full_mask == cls_id] = color
            
        annotated_img = cv2.addWeighted(image_bgr, 1, color_mask, 0.4, 0)
        _, buffer = cv2.imencode('.jpg', annotated_img)
        annotated_image_base64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')
        
    return AnalyzeTissueResponse(
        tissue_composition=tissue_comp,
        inference_metadata=InferenceMetadata(
            model_name="Tversky_ResNet34",
            model_version="a06_b04",
            message="Successfully calculated tissue composition."
        ),
        annotated_image_base64=annotated_image_base64
    )
