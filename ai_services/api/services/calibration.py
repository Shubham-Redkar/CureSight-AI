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
        # Standard green color ranges in HSV with lighting tolerance
        lower_green1 = np.array([32, 40, 40])
        upper_green1 = np.array([88, 255, 255])
        return cv2.inRange(hsv_img, lower_green1, upper_green1)

    def _validate_green_color(self, image: np.ndarray, contour: np.ndarray) -> bool:
        """
        Confirms genuine green dominance inside candidate contour to reject skin, dressings,
        and other non-green objects.
        """
        c_mask = np.zeros(image.shape[:2], dtype=np.uint8)
        cv2.drawContours(c_mask, [contour], -1, 255, -1)
        mean_bgr = cv2.mean(image, mask=c_mask)[:3]
        b, g, r = mean_bgr[0], mean_bgr[1], mean_bgr[2]
        # Green channel must exceed red and blue
        if g < (r + 10) or g < (b + 10):
            return False
        return True

    def _evaluate_perspective_quad(self, contour: np.ndarray, peri: float, area: float) -> Dict[str, Any] | None:
        """
        Evaluates whether a candidate contour is a valid perspective-distorted square.
        """
        # Try adaptive approximation epsilons to find a convex 4-point quad
        approx = None
        for eps_factor in [0.03, 0.04, 0.02, 0.05]:
            cand = cv2.approxPolyDP(contour, eps_factor * peri, True)
            if len(cand) == 4 and cv2.isContourConvex(cand):
                approx = cand
                break

        if approx is None:
            return None

        pts = approx.reshape(4, 2).astype(np.float32)

        # Order points: top-left, top-right, bottom-right, bottom-left
        pts = pts[np.argsort(pts[:, 1])]
        top_two = pts[:2]
        top_two = top_two[np.argsort(top_two[:, 0])]
        bottom_two = pts[2:]
        bottom_two = bottom_two[np.argsort(bottom_two[:, 0])]
        p0, p1 = top_two[0], top_two[1]
        p3, p2 = bottom_two[0], bottom_two[1]

        # Calculate edge lengths
        e_top = float(np.linalg.norm(p1 - p0))
        e_right = float(np.linalg.norm(p2 - p1))
        e_bottom = float(np.linalg.norm(p3 - p2))
        e_left = float(np.linalg.norm(p0 - p3))

        if min(e_top, e_right, e_bottom, e_left) < 15.0:
            return None

        # Opposite edge ratio (for perspective square under moderate tilt, >= 0.65)
        ratio_tb = min(e_top, e_bottom) / max(e_top, e_bottom)
        ratio_rl = min(e_right, e_left) / max(e_right, e_left)
        if ratio_tb < 0.65 or ratio_rl < 0.65:
            return None

        mean_w = (e_top + e_bottom) / 2.0
        mean_h = (e_left + e_right) / 2.0
        if mean_w == 0 or mean_h == 0:
            return None

        aspect_ratio = mean_w / mean_h if mean_w > mean_h else mean_h / mean_w
        if abs(aspect_ratio - 1.0) > 0.25:
            return None

        quad_area = cv2.contourArea(approx)
        if quad_area <= 0:
            return None
        fill_ratio = area / quad_area
        if fill_ratio < 0.85 or fill_ratio > 1.15:
            return None

        # Calculate interior corner angles
        ordered = [p0, p1, p2, p3]
        angles = []
        for i in range(4):
            prev_pt = ordered[(i - 1) % 4]
            curr_pt = ordered[i]
            next_pt = ordered[(i + 1) % 4]
            v1 = prev_pt - curr_pt
            v2 = next_pt - curr_pt
            norm_prod = np.linalg.norm(v1) * np.linalg.norm(v2)
            if norm_prod == 0:
                return None
            cos_theta = np.clip(np.dot(v1, v2) / norm_prod, -1.0, 1.0)
            angle_deg = float(np.degrees(np.arccos(cos_theta)))
            angles.append(angle_deg)

        # Check all angles are approximately orthogonal (60 to 120 degrees)
        for ang in angles:
            if ang < 60.0 or ang > 120.0:
                return None

        # Scoring
        ar_score = max(0.0, 1.0 - (abs(aspect_ratio - 1.0) / 0.25))
        sym_score = (ratio_tb + ratio_rl) / 2.0
        angle_dev = max(abs(a - 90.0) for a in angles)
        angle_score = max(0.0, 1.0 - (angle_dev / 30.0))

        confidence = (ar_score * 0.35) + (sym_score * 0.35) + (angle_score * 0.30)
        if confidence < 0.82:
            return None

        return {
            "contour": contour,
            "area": area,
            "w": max(mean_w, mean_h),
            "h": min(mean_w, mean_h),
            "confidence": confidence
        }

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

        # Size threshold adapts to resolution:
        # Standard images (<= 1M px): preserves existing 0.0005 ratio (e.g. 500 px in 1000x1000)
        # High-res images (> 1M px): allows genuine markers (>= 500 px or 0.00015 ratio) without false noise rejection
        if total_area <= 1_000_000:
            effective_min_area = self.min_area_ratio_of_image * total_area
        else:
            effective_min_area = max(500.0, total_area * 0.00015)

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
            
            if area < effective_min_area:
                continue
                
            if (area / total_area) > self.max_area_ratio:
                continue

            # Verify genuine green color evidence (rejects skin, dressings, reflections)
            if not self._validate_green_color(image, contour):
                continue

            peri = cv2.arcLength(contour, True)

            # Path 1: Pure Rectangle / minAreaRect (Baseline algorithm)
            rect = cv2.minAreaRect(contour)
            (cx, cy), (w, h), angle = rect
            
            box = cv2.boxPoints(rect)
            box_area = cv2.contourArea(box)
            
            is_valid_baseline = False
            baseline_cand = None
            if w > 0 and h > 0 and box_area > 0:
                aspect_ratio = w / h if w > h else h / w
                fill_ratio = area / box_area

                # Check approximation polygon vertex count
                approx = cv2.approxPolyDP(contour, 0.04 * peri, True)
                if 4 <= len(approx) <= 6:
                    if abs(aspect_ratio - 1.0) <= self.aspect_ratio_tolerance and fill_ratio >= self.min_fill_ratio:
                        ar_score = 1.0 - (abs(aspect_ratio - 1.0) / self.aspect_ratio_tolerance)
                        fr_score = (fill_ratio - self.min_fill_ratio) / (1.0 - self.min_fill_ratio) if fill_ratio > self.min_fill_ratio else 0
                        conf = (ar_score * 0.4) + (fr_score * 0.6)
                        if conf >= self.min_confidence:
                            is_valid_baseline = True
                            baseline_cand = {
                                "contour": contour,
                                "area": area,
                                "w": max(w, h),
                                "h": min(w, h),
                                "confidence": conf
                            }

            if is_valid_baseline and baseline_cand:
                candidates.append(baseline_cand)
            else:
                # Path 2: Perspective Quadrilateral (Rotated/Tilted Quad validation)
                quad_cand = self._evaluate_perspective_quad(contour, peri, area)
                if quad_cand:
                    candidates.append(quad_cand)

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
