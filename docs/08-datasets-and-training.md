# 8. Datasets and Model Training

> **Not currently implemented.**

The CureSight AI repository currently functions purely as an architectural skeleton and web platform.

## ML Architecture Status

While the Python backend includes classes for `YoloDetector` and `UNetSegmenter`, there are **no training scripts, dataset preprocessing pipelines, datasets, or `.pt`/`.pth` weight files** present in the repository.

The system relies entirely on hardcoded OpenCV color-thresholding and contour heuristics to simulate the presence of an AI.

## Requirements for Future Implementation

To fully realize the clinical potential of the platform, the following will need to be developed:
1. **Clinical Image Dataset**: A large repository of diverse wound images (various skin tones, lighting conditions, wound types).
2. **Annotation**: Ground-truth polygon masks delineating the exact wound beds.
3. **Training Scripts**: A PyTorch/TensorFlow pipeline for fine-tuning a YOLOv8 (or similar) architecture for the ROI cropper, and a U-Net architecture for the semantic segmenter.
4. **Validation/Testing**: A dedicated hold-out test set to verify intersection-over-union (IoU) and Dice scores before deployment.

### Clinical Validation

**Clinical validation has not yet been performed.** 
The platform cannot currently be used to accurately measure real-world clinical wounds outside of specifically staged, highly-contrasted test photographs.
