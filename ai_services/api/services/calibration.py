import cv2
import numpy as np
from typing import Dict, Any

class CalibrationDetector:
    def __init__(self, config: Dict[str, Any]):
        self.config = config.get('calibration', {})
        self.enabled = self.config.get('enabled', True)
        self.marker_cfg = self.config.get('marker', {})
        self.detect_cfg = self.config.get('detection', {})

        self.width_cm = self.marker_cfg.get('width_cm', 2.0)
        self.height_cm = self.marker_cfg.get('height_cm', 2.0)

        self.min_area_ratio_of_image = self.detect_cfg.get('min_area_ratio_of_image', 0.0005)
        self.max_area_ratio = self.detect_cfg.get('max_area_ratio', 0.20)
        self.aspect_ratio_tolerance = self.detect_cfg.get('aspect_ratio_tolerance', 0.10)
        self.min_fill_ratio = self.detect_cfg.get('min_fill_ratio', 0.90)
        self.min_confidence = self.detect_cfg.get('min_confidence', 0.95)
        self.confidence_margin = self.detect_cfg.get('confidence_margin', 0.10)

    def _create_green_mask(self, hsv_img: np.ndarray) -> np.ndarray:
        # Standard green color ranges in HSV
        lower_green1 = np.array([35, 50, 50])
        upper_green1 = np.array([85, 255, 255])
        return cv2.inRange(hsv_img, lower_green1, upper_green1)

    def detect(self, image: np.ndarray) -> Dict[str, Any]:
        failure_result = {
            "detected": False,
            "source": "unavailable",
            "pixels_per_cm": None,
            "marker_width_px": None,
            "marker_height_px": None,
            "marker_size_cm": self.width_cm,
            "confidence": 0.0,
            "reason": "CALIBRATION_MARKER_NOT_FOUND"
        }

        if not self.enabled:
            failure_result["reason"] = "CALIBRATION_DISABLED"
            return failure_result

        total_area = image.shape[0] * image.shape[1]
        if total_area == 0:
            failure_result["reason"] = "INVALID_IMAGE_SIZE"
            return failure_result

        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        mask = self._create_green_mask(hsv)
        
        # Morphological operations to clean up mask
        kernel = np.ones((5,5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        candidates = []
        for contour in contours:
            area = cv2.contourArea(contour)
            
            if (area / total_area) < self.min_area_ratio_of_image:
                continue
                
            if (area / total_area) > self.max_area_ratio:
                continue

            peri = cv2.arcLength(contour, True)
            approx = cv2.approxPolyDP(contour, 0.04 * peri, True)

            # Not roughly quadrilateral
            if len(approx) < 4 or len(approx) > 6:
                continue

            rect = cv2.minAreaRect(contour)
            (cx, cy), (w, h), angle = rect
            
            if w == 0 or h == 0:
                continue

            aspect_ratio = w / h if w > h else h / w
            if abs(aspect_ratio - 1.0) > self.aspect_ratio_tolerance:
                continue

            box = cv2.boxPoints(rect)
            box_area = cv2.contourArea(box)
            if box_area == 0:
                continue
                
            fill_ratio = area / box_area
            if fill_ratio < self.min_fill_ratio:
                continue
                
            # Confidence calculation
            # 1. Aspect ratio score: 1.0 is perfect
            ar_score = 1.0 - (abs(aspect_ratio - 1.0) / self.aspect_ratio_tolerance)
            # 2. Fill ratio score: 1.0 is perfect solid rectangle
            fr_score = (fill_ratio - self.min_fill_ratio) / (1.0 - self.min_fill_ratio) if fill_ratio > self.min_fill_ratio else 0
            
            confidence = (ar_score * 0.4) + (fr_score * 0.6)

            if confidence >= self.min_confidence:
                candidates.append({
                    "contour": contour,
                    "area": area,
                    "w": max(w, h),
                    "h": min(w, h),
                    "confidence": confidence
                })

        if not candidates:
            return failure_result

        # Sort by confidence
        candidates.sort(key=lambda x: x["confidence"], reverse=True)

        if len(candidates) > 1:
            best = candidates[0]
            second = candidates[1]
            if (best["confidence"] - second["confidence"]) < self.confidence_margin:
                failure_result["reason"] = "CALIBRATION_MARKER_AMBIGUOUS"
                return failure_result

        best_candidate = candidates[0]
        
        marker_width_px = best_candidate["w"]
        marker_height_px = best_candidate["h"]

        pixels_per_cm_width = marker_width_px / self.width_cm
        pixels_per_cm_height = marker_height_px / self.height_cm
        pixels_per_cm = (pixels_per_cm_width + pixels_per_cm_height) / 2.0

        return {
            "detected": True,
            "source": "automatic",
            "pixels_per_cm": round(pixels_per_cm, 3),
            "marker_width_px": round(marker_width_px, 1),
            "marker_height_px": round(marker_height_px, 1),
            "marker_width_cm": self.width_cm,
            "marker_height_cm": self.height_cm,
            "pixels_per_cm_width": round(pixels_per_cm_width, 3),
            "pixels_per_cm_height": round(pixels_per_cm_height, 3),
            "confidence": round(best_candidate["confidence"], 3),
            "reason": None
        }
