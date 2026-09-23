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
from api.services.calibration import CalibrationDetector

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
        
        self.calibration_detector = CalibrationDetector(self.config)
        
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
            "calibration": None
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
            
        # 1.55 Calibration Detection
        orig_img = cv2.imread(image_path)
        
        cal_res = None
        if orig_img is not None:
            cal_res = self.calibration_detector.detect(orig_img)
            
        calib_cfg = getattr(cfg, "calibration", None)
        demo_cfg = getattr(calib_cfg, "demo", None) if calib_cfg else None
        demo_enabled = getattr(demo_cfg, "enabled", False) if demo_cfg else False
        demo_pixels = getattr(demo_cfg, "default_pixels_per_cm", 25.0) if demo_cfg else 25.0

        if cal_res and cal_res.get("detected"):
            calibration_result = cal_res
            calibration_result["source"] = "automatic"
            pixels_per_cm = cal_res.get("pixels_per_cm")
        elif pixels_per_cm is not None:
            calibration_result = {
                "source": "manual",
                "detected": False,
                "pixels_per_cm": pixels_per_cm,
                "marker_width_px": None,
                "marker_height_px": None,
                "marker_width_cm": None,
                "marker_height_cm": None,
                "confidence": None,
                "reason": "MANUAL_DEMONSTRATION",
                "label": "Manual — Demonstration"
            }
        elif demo_enabled:
            calibration_result = {
                "source": "demo",
                "detected": False,
                "pixels_per_cm": demo_pixels,
                "marker_width_px": None,
                "marker_height_px": None,
                "marker_width_cm": None,
                "marker_height_cm": None,
                "confidence": None,
                "reason": "DEMO_FALLBACK",
                "label": "Default Demonstration Scale"
            }
            pixels_per_cm = demo_pixels
        else:
            calibration_result = {
                "source": "none",
                "detected": False,
                "pixels_per_cm": None,
                "marker_width_px": None,
                "marker_height_px": None,
                "marker_width_cm": None,
                "marker_height_cm": None,
                "confidence": None,
                "reason": "CALIBRATION_MARKER_NOT_FOUND" if orig_img is not None else "FAILED_TO_LOAD_IMAGE"
            }
            pixels_per_cm = None
            
        response["calibration"] = calibration_result
            
        # 1.6 Resize if necessary after quality validation
        limits = getattr(cfg, "api_limits", None)
        max_w = getattr(limits, "max_image_width", 4096) if limits else 4096
        max_h = getattr(limits, "max_image_height", 4096) if limits else 4096
        
        orig_w = iq_result["width"]
        orig_h = iq_result["height"]
        
        if orig_w > max_w or orig_h > max_h:
            img = cv2.imread(image_path)
            if orig_w > orig_h:
                new_h = round((orig_h * max_w) / orig_w)
                new_w = max_w
                ratio = new_w / orig_w
            else:
                new_w = round((orig_w * max_h) / orig_h)
                new_h = max_h
                ratio = new_h / orig_h
                
            resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            cv2.imwrite(image_path, resized)
            
            # Scale the calibration to match the resized image
            if pixels_per_cm is not None:
                pixels_per_cm *= ratio
            
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
