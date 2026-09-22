import numpy as np


class ROICropper:
    """
    Safely crops a Region of Interest (ROI) from an image based on bounding box coordinates,
    handling image boundaries and padding.
    """
    def __init__(self, padding_pixels: int = 20):
        self.padding = padding_pixels

    def crop(self, image: np.ndarray, bbox: list) -> dict:
        """
        Crops the bounding box out of the image with padding.
        
        Args:
            image (np.ndarray): Original image (H, W, C)
            bbox (list): [x1, y1, x2, y2]
            
        Returns:
            dict containing:
                - "roi_image": cropped np.ndarray
                - "offset": (x_min, y_min) where the crop started in the original image
                - "original_shape": shape of the original image
        """
        if image is None:
            raise ValueError("Input image is None")
            
        img_h, img_w = image.shape[:2]
        x1, y1, x2, y2 = bbox
        
        # Apply padding
        x_min = int(max(0, x1 - self.padding))
        y_min = int(max(0, y1 - self.padding))
        x_max = int(min(img_w, x2 + self.padding))
        y_max = int(min(img_h, y2 + self.padding))
        
        # Validate crop dimensions
        if x_max <= x_min or y_max <= y_min:
            raise ValueError(f"Invalid crop dimensions: x({x_min}-{x_max}), y({y_min}-{y_max})")
            
        roi_img = image[y_min:y_max, x_min:x_max]
        
        return {
            "roi_image": roi_img,
            "offset": (x_min, y_min),
            "original_shape": image.shape
        }

    def map_mask_to_original(self, roi_mask: np.ndarray, offset: tuple, original_shape: tuple) -> np.ndarray:
        """
        Takes a binary mask predicted on the ROI and places it back onto a full-size blank mask.
        """
        if len(original_shape) == 3:
            h, w, _ = original_shape
        else:
            h, w = original_shape
            
        x_min, y_min = offset
        roi_h, roi_w = roi_mask.shape[:2]
        
        full_mask = np.zeros((h, w), dtype=np.uint8)
        
        # Handle cases where ROI mask size is unexpectedly different from offset bounds
        # Usually they match, but if resizing occurred, it should have been reversed before calling this
        y_max = min(h, y_min + roi_h)
        x_max = min(w, x_min + roi_w)
        
        actual_roi_h = y_max - y_min
        actual_roi_w = x_max - x_min
        
        full_mask[y_min:y_max, x_min:x_max] = roi_mask[:actual_roi_h, :actual_roi_w]
        
        return full_mask
