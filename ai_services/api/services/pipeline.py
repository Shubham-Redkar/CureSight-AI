import os

import cv2
import yaml

from api.core.config import load_config
from api.services.image_quality import analyze_image_quality
from api.services.measurements import WoundMeasurements
from api.services.roi_cropper import ROICropper
from api.services.segmentation_validator import SegmentationValidator
from api.services.unet_segmenter import UNetSegmenter
from api.services.wound_gate import WoundGate
from api.services.yolo_detector import YoloDetector


class MLPipeline:
    """
    Orchestrates the entire ML inference process:
    1. Wound Gate (is there a wound?)
    2. YOLO (where is it?)
    3. ROI Crop (extract it)
    4. U-Net (segment it)
    5. Validation (is the segmentation sane?)
    6. Measurements (compute properties)
    """
    def __init__(self, config_path: str = "config.yaml"):
        # Load config to get model paths and settings
        self.config = {}
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                self.config = yaml.safe_load(f)
                
        # Initialize components
        ml_cfg = self.config.get("ml_pipeline", {})
        
        self.wound_gate = WoundGate(
            model_path=ml_cfg.get("wound_gate_model", "ml/models/wound_gate/best.pt"),
            required=ml_cfg.get("require_wound_gate", False)
        )
        
        self.yolo = YoloDetector(
            model_path=ml_cfg.get("yolo_model", "ml/models/yolo/best.pt"),
            required=ml_cfg.get("require_yolo", True)
        )
        
        self.cropper = ROICropper(
            padding_pixels=ml_cfg.get("roi_padding", 20)
        )
        
        self.unet = UNetSegmenter(
            model_path=ml_cfg.get("unet_model", "ml/models/unet/best.pth"),
            required=ml_cfg.get("require_unet", True)
        )
        
        self.validator = SegmentationValidator(
            min_area_ratio=ml_cfg.get("min_mask_ratio", 0.001),
            max_area_ratio=ml_cfg.get("max_mask_ratio", 0.98)
        )
        
        # Load available models
        self.wound_gate.load()
        self.yolo.load()
        self.unet.load()

    def process_image(self, image_path: str, pixels_per_cm: float | None = None) -> dict:
        """
        Runs the full pipeline on a given image.
        """
        response = {
            "status": "success",
            "message": "Processed successfully",
            "is_wound": None,
            "wound_detected": False,
            "bbox": None,
            "measurements": None,
            "segmentation_valid": False,
            "mask_path": None, # If we were to save it
        }
        
        if not os.path.exists(image_path):
            return {"status": "error", "error_code": "INVALID_IMAGE", "message": f"Image not found: {image_path}"}
            
        # 1.5. Image Quality Checks
        cfg = load_config(self.config_path if hasattr(self, 'config_path') else "config.yaml")
        iq_result = analyze_image_quality(image_path, cfg)
        if not iq_result["accepted"]:
            return {
                "status": "error",
                "error_code": "IMAGE_QUALITY_FAILED",
                "message": "Image failed quality checks: " + "; ".join(iq_result["reasons"]),
                "reasons": iq_result["reasons"]
            }
            
        # 1. Wound Gate
        if self.wound_gate.required and not self.wound_gate.is_loaded:
            return {"status": "error", "error_code": "MODELS_NOT_LOADED", "message": "Wound Gate model required but not loaded."}
            
        if self.wound_gate.is_loaded:
            gate_result = self.wound_gate.predict(image_path)
            response["is_wound"] = gate_result["is_wound"]
            
            if not gate_result["is_wound"]:
                return {"status": "error", "error_code": "NON_WOUND_IMAGE", "message": "Rejected by Wound Gate: No wound classified in image."}
                
        # 2. YOLO Detection
        if not self.yolo.is_loaded:
            return {"status": "error", "error_code": "MODELS_NOT_LOADED", "message": "YOLO model not loaded."}
            
        conf_thresh = self.config.get("ml_pipeline", {}).get("yolo_confidence_threshold", 0.25)
        yolo_result = self.yolo.detect(image_path, conf_thresh=conf_thresh)
        if not yolo_result["detected"] or not yolo_result.get("detections"):
            return {"status": "error", "error_code": "NO_WOUND_DETECTED", "message": "YOLO did not detect any wounds."}
            
        response["detections"] = yolo_result["detections"]
        
        # Load image for cropping
        import numpy as np
        image_bgr = cv2.imread(image_path)
        if image_bgr is None:
            return {"status": "error", "message": "Failed to read image with OpenCV."}
            
        if not self.unet.is_loaded:
            return {"status": "error", "message": "U-Net model not loaded."}
            
        accepted_pred_masks = []
        accepted_pred_boxes = []
        roi_rejection_reasons = {}
        
        for det in yolo_result["detections"]:
            bbox = det["bbox"]
            crop_result = self.cropper.crop(image_bgr, bbox)
            roi_img = crop_result["roi_image"]
            
            unet_result = self.unet.segment(roi_img)
            roi_mask = unet_result.get("roi_mask")
            
            if roi_mask is None:
                roi_rejection_reasons["UNET_RETURNED_NONE"] = roi_rejection_reasons.get("UNET_RETURNED_NONE", 0) + 1
                continue
                
            full_mask = self.cropper.map_mask_to_original(
                roi_mask, 
                crop_result["offset"], 
                crop_result["original_shape"]
            )
            
            val_result = self.validator.validate(full_mask, bbox=bbox)
            
            if not val_result["valid"]:
                reason = val_result["message"]
                roi_rejection_reasons[reason] = roi_rejection_reasons.get(reason, 0) + 1
                continue
            accepted_pred_masks.append(full_mask)
            accepted_pred_boxes.append(bbox)
            
        if not accepted_pred_masks:
            response["wound_detected"] = False
            response["segmentation_valid"] = False
            response["message"] = f"Segmentation validation failed for all ROIs: {roi_rejection_reasons}"
            return response
            
        response["wound_detected"] = True
        response["segmentation_valid"] = True
        
        merged_mask = np.zeros_like(accepted_pred_masks[0])
        for pm in accepted_pred_masks:
            merged_mask = cv2.bitwise_or(merged_mask, pm)
            
        response["merged_mask"] = merged_mask
            
        # 6. Measurements
        measurer = WoundMeasurements(pixels_per_cm=pixels_per_cm)
        # Global measurements (for the merged mask)
        measurements = measurer.compute(merged_mask, original_shape=image_bgr.shape[:2])
        response["measurements"] = measurements
        
        # Per-ROI measurements (for PerWoundResponse)
        response["roi_measurements"] = []
        for i, pm in enumerate(accepted_pred_masks):
            meas = measurer.compute(pm, original_shape=image_bgr.shape[:2])
            meas["bbox"] = accepted_pred_boxes[i]
            meas["confidence"] = yolo_result["detections"][i]["confidence"]
            response["roi_measurements"].append(meas)
            
        return response
