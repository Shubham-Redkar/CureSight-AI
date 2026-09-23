import cv2
import numpy as np


class SegmentationValidator:
    """
    Sanity checks for predicted U-Net masks to catch obvious ML failures.
    These are NOT clinical validations.
    """
    def __init__(
        self, 
        min_area_ratio: float = 0.001, # Mask must be at least 0.1% of ROI area
        max_area_ratio: float = 0.98,  # Mask must not occupy 98%+ of ROI area
        max_fragments: int = 10        # Mask shouldn't be scattered into 10+ disconnected islands
    ):
        self.min_area_ratio = min_area_ratio
        self.max_area_ratio = max_area_ratio
        self.max_fragments = max_fragments

    def validate(self, binary_mask: np.ndarray, bbox: list = None) -> dict:
        """
        Validates the binary mask.
        Returns:
            {"valid": bool, "reason_code": str, "message": str}
        """
        if binary_mask is None or binary_mask.size == 0:
            return {"valid": False, "reason_code": "EMPTY_MASK", "message": "Mask is empty or None."}
            
        mask_pixels = np.sum(binary_mask)
        
        if mask_pixels == 0:
            return {"valid": False, "reason_code": "NO_WOUND_SEGMENTED", "message": "No wound pixels found."}
            
        if bbox is not None:
            # bbox is [x1, y1, x2, y2]
            x1, y1, x2, y2 = bbox
            reference_area = max(1.0, x2 - x1) * max(1.0, y2 - y1)
        else:
            reference_area = binary_mask.size
            
        area_ratio = mask_pixels / reference_area
        
        if area_ratio < self.min_area_ratio:
            return {
                "valid": False, 
                "reason_code": "MASK_TOO_SMALL", 
                "message": f"Wound mask is implausibly small ({area_ratio:.4f} < {self.min_area_ratio})"
            }
            
        if area_ratio > self.max_area_ratio:
            return {
                "valid": False, 
                "reason_code": "MASK_TOO_LARGE", 
                "message": f"Wound mask occupies almost entire ROI ({area_ratio:.4f} > {self.max_area_ratio})"
            }
            
        # Check fragmentation
        num_labels, _ = cv2.connectedComponents((binary_mask * 255).astype(np.uint8))
        num_fragments = num_labels - 1 # exclude background
        
        if num_fragments > self.max_fragments:
            return {
                "valid": False,
                "reason_code": "HIGHLY_FRAGMENTED",
                "message": f"Wound mask is scattered into {num_fragments} islands, typical of noise."
            }
            
        return {"valid": True, "reason_code": "OK", "message": "Mask passed sanity checks."}
