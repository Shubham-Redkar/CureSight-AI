import os
import cv2
import numpy as np
import torch

try:
    import segmentation_models_pytorch as smp
    SMP_AVAILABLE = True
except ImportError:
    SMP_AVAILABLE = False

from api.services.image_preprocessor import ImagePreprocessor

class TissueSegmenter:
    """
    Inference interface for the Tissue Segmenter (Tversky ResNet34).
    Expects to process a cropped ROI, NOT the full original image.
    """
    def __init__(self, model_path: str, required: bool = True):
        self.model_path = model_path
        self.model = None
        self.required = required
        self.is_loaded = False
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.preprocessor = ImagePreprocessor(target_size=(224, 224), use_imagenet_norm=True)
        
        # Classes matching the established semantics
        self.classes = {
            1: "epithelial",
            2: "slough",
            3: "granulation",
            4: "necrotic",
            5: "other",
            6: "fibrin",
            7: "callus"
        }

    def load(self):
        if not os.path.exists(self.model_path):
            if self.required:
                raise FileNotFoundError(f"Tissue model required but not found at {self.model_path}")
            return False
            
        if not SMP_AVAILABLE:
            raise ImportError("segmentation_models_pytorch is required to load the Tissue model.")
            
        self.model = smp.Unet(
            encoder_name="resnet34",
            encoder_weights=None,
            in_channels=3,
            classes=8,  # Background (0) + 7 classes
            activation=None 
        )
        self.model.load_state_dict(torch.load(self.model_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()
        self.is_loaded = True
        return True

    def segment(self, roi_image: np.ndarray) -> dict:
        """
        Segments the tissue within the provided ROI image.
        
        Args:
            roi_image (np.ndarray): The cropped BGR image from the ROI cropper.
            
        Returns:
            dict: {
                "available": bool,
                "roi_mask": np.ndarray (categorical mask same size as roi_image),
                "composition": dict (percentage of valid predicted tissue pixels)
            }
        """
        if not self.is_loaded:
            return {"available": False, "roi_mask": None, "composition": None}
            
        if roi_image is None or roi_image.size == 0:
            return {"available": True, "roi_mask": None, "composition": None, "error": "Invalid ROI image"}
            
        orig_h, orig_w = roi_image.shape[:2]
        
        input_tensor = self.preprocessor.preprocess_inference(roi_image).to(self.device)
        
        with torch.no_grad():
            logits = self.model(input_tensor)
            preds = torch.argmax(logits, dim=1).cpu().numpy()[0]
            
        # Resize nearest neighbor back to ROI shape
        mask_resized = cv2.resize(preds.astype(np.uint8), (orig_w, orig_h), interpolation=cv2.INTER_NEAREST)
        
        # Calculate composition based on total wound pixels (excluding 0)
        unique, counts = np.unique(mask_resized, return_counts=True)
        counts_dict = dict(zip(unique, counts))
        
        valid_classes = list(self.classes.keys())
        total_wound_pixels = sum(counts_dict.get(c, 0) for c in valid_classes)
        
        composition = {name: 0.0 for name in self.classes.values()}
        
        if total_wound_pixels > 0:
            for cls_id, cls_name in self.classes.items():
                composition[cls_name] = (counts_dict.get(cls_id, 0) / total_wound_pixels) * 100.0
                
        return {
            "available": True,
            "roi_mask": mask_resized,
            "composition": composition
        }
