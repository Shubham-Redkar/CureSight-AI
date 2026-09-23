import cv2
import numpy as np


class WoundMeasurements:
    """
    Computes geometrical properties of the wound mask.
    Enforces safe measurement handling (no hardcoded cm rules).
    """
    def __init__(self, pixels_per_cm: float | None = None):
        """
        If pixels_per_cm is provided (e.g. from a calibration coin or marker),
        physical measurements will be computed.
        """
        self.pixels_per_cm = pixels_per_cm

    def compute(self, binary_mask: np.ndarray, original_shape: tuple | None = None) -> dict:
        """
        Compute measurements from the binary mask.
        Args:
            binary_mask: 2D binary array (0 or 1)
        """
        if binary_mask is None or binary_mask.size == 0:
            return {"error": "Invalid mask"}
            
        # Compute pixel area
        area_pixels = float(np.sum(binary_mask))
        
        # Find contours to compute perimeter and bounding box
        contours, _ = cv2.findContours(
            (binary_mask * 255).astype(np.uint8), 
            cv2.RETR_EXTERNAL, 
            cv2.CHAIN_APPROX_SIMPLE
        )
        
        if not contours:
            return {"area_pixels": 0.0, "perimeter_pixels": 0.0, "width_pixels": 0.0, "height_pixels": 0.0}
            
        # Get the largest contour (assuming 1 primary wound, or we can use all)
        main_contour = max(contours, key=cv2.contourArea)
        
        perimeter_pixels = cv2.arcLength(main_contour, True)
        _x, _y, w, h = cv2.boundingRect(main_contour)
        
        results = {
            "area_pixels": area_pixels,
            "perimeter_pixels": float(perimeter_pixels),
            "width_pixels": float(w),
            "height_pixels": float(h)
        }
        
        # Safe Physical Conversion
        if self.pixels_per_cm is not None and self.pixels_per_cm > 0:
            # Area scales with the square of the linear conversion factor
            cm2_per_pixel2 = 1.0 / (self.pixels_per_cm ** 2)
            cm_per_pixel = 1.0 / self.pixels_per_cm
            
            results["physical"] = {
                "area_cm2": area_pixels * cm2_per_pixel2,
                "perimeter_cm": float(perimeter_pixels) * cm_per_pixel,
                "width_cm": float(w) * cm_per_pixel,
                "height_cm": float(h) * cm_per_pixel,
                "calibration_factor": self.pixels_per_cm
            }
        else:
            results["physical"] = None
            results["warning"] = "Physical measurements suppressed. No calibration provided."
            
        return results
