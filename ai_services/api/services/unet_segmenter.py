import os

import cv2
import numpy as np
import torch

# Depending on the runtime environment, SMP might not be immediately available if the user
# has not fully installed their training suite, but the inference interface should still exist.
try:
    import segmentation_models_pytorch as smp
    SMP_AVAILABLE = True
except ImportError:
    SMP_AVAILABLE = False

from api.services.image_preprocessor import ImagePreprocessor


class UNetSegmenter:
    """
    Inference interface for the U-Net wound segmenter.
    Expects to process a cropped ROI, NOT the full original image.
    """
    def __init__(self, model_path: str, required: bool = True):
        self.model_path = model_path
        self.model = None
        self.required = required
        self.is_loaded = False
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # We explicitly use ImageNet normalization for resnet34 encoder
        self.preprocessor = ImagePreprocessor(target_size=(224, 224), use_imagenet_norm=True)

    def load(self):
        if not os.path.exists(self.model_path):
            if self.required:
                raise FileNotFoundError(f"U-Net model required but not found at {self.model_path}")
            return False
            
        if not SMP_AVAILABLE:
            raise ImportError("segmentation_models_pytorch is required to load the U-Net model.")
            
        # Hardcoding the architecture parameters matching the training script
        self.model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights=None, # Weights are loaded from our checkpoint
            in_channels=3,
            classes=1,
            activation=None 
        )
        self.model.load_state_dict(torch.load(self.model_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()
        self.is_loaded = True
        return True

    def segment(self, roi_image: np.ndarray) -> dict:
        """
        Segments the wound within the provided ROI image.
        
        Args:
            roi_image (np.ndarray): The cropped BGR image from the ROI cropper.
            
        Returns:
            dict: {
                "available": bool,
                "roi_mask": np.ndarray (binary mask same size as roi_image),
                "confidence_map": np.ndarray (optional probability map)
            }
        """
        if not self.is_loaded:
            return {"available": False, "roi_mask": None}
            
        if roi_image is None or roi_image.size == 0:
            return {"available": True, "roi_mask": None, "error": "Invalid ROI image"}
            
        orig_h, orig_w = roi_image.shape[:2]
        
        # 1. Preprocess (BGR->RGB, Resize, Normalize, CHW, batch)
        input_tensor = self.preprocessor.preprocess_inference(roi_image).to(self.device)
        
        # 2. Inference
        with torch.no_grad():
            logits = self.model(input_tensor)
            probs = torch.sigmoid(logits)
            
            # Extract 2D array
            prob_map = probs.cpu().numpy()[0, 0]
            
        # 3. Post-process (Resize back to ROI shape using Nearest Neighbor, Threshold)
        # Using OpenCV directly for speed, but matching MaskPreprocessor logic
        prob_map_resized = cv2.resize(prob_map, (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)
        binary_mask = (prob_map_resized > 0.5).astype(np.uint8)
        
        return {
            "available": True,
            "roi_mask": binary_mask,
            "confidence_map": prob_map_resized
        }
