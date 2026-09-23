import albumentations as A
import cv2
import numpy as np
import torch


class ImagePreprocessor:
    """
    Unified image preprocessing for training, evaluation, and inference.
    Ensures identical resizing, colorspace, and normalization.
    """
    def __init__(self, target_size=(224, 224), use_imagenet_norm=True):
        self.target_size = target_size
        self.use_imagenet_norm = use_imagenet_norm
        
        # Standard ImageNet normalization values
        self.mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        self.std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        
        self.resize_transform = A.Compose([
            A.Resize(self.target_size[0], self.target_size[1])
        ])

    def preprocess_inference(self, image_bgr: np.ndarray) -> torch.Tensor:
        """
        Preprocess an OpenCV BGR image into a batch tensor (1, C, H, W) for inference.
        """
        if image_bgr is None:
            raise ValueError("Input image is None")
            
        # 1. BGR -> RGB
        img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        
        # 2. Resize
        resized = self.resize_transform(image=img_rgb)["image"]
        
        # 3. HWC -> CHW and float32
        tensor_img = np.transpose(resized, (2, 0, 1)).astype(np.float32)
        
        # 4. Normalize
        tensor_img /= 255.0
        if self.use_imagenet_norm:
            # Broadcast mean/std to (3, H, W)
            mean_chw = self.mean[:, None, None]
            std_chw = self.std[:, None, None]
            tensor_img = (tensor_img - mean_chw) / std_chw
            
        # 5. Add batch dimension
        tensor_batch = torch.tensor(tensor_img).unsqueeze(0)
        return tensor_batch
        
    def preprocess_training_pair(self, image_bgr: np.ndarray, mask: np.ndarray, augmentations=None):
        """
        Preprocess image and mask together for training dataset.
        Returns: (image_tensor (C, H, W), mask_tensor (1, H, W))
        """
        # 1. BGR -> RGB
        img_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        
        # 2. Apply combined augmentations/resizing
        if augmentations:
            augmented = augmentations(image=img_rgb, mask=mask)
            img_rgb = augmented["image"]
            mask = augmented["mask"]
        else:
            augmented = self.resize_transform(image=img_rgb, mask=mask)
            img_rgb = augmented["image"]
            mask = augmented["mask"]
            
        # 3. HWC -> CHW, Normalize image
        img_chw = np.transpose(img_rgb, (2, 0, 1)).astype(np.float32)
        img_chw /= 255.0
        
        if self.use_imagenet_norm:
            mean_chw = self.mean[:, None, None]
            std_chw = self.std[:, None, None]
            img_chw = (img_chw - mean_chw) / std_chw
            
        # 4. Format Mask (1, H, W)
        mask_chw = np.expand_dims(mask, axis=0).astype(np.float32)
        
        return torch.tensor(img_chw), torch.tensor(mask_chw)
