import os

from ultralytics import YOLO


class YoloDetector:
    """
    Object detector interface to find the bounding box of a wound in an image.
    Outputs structured bounding box coordinates instead of classification probabilities.
    """
    def __init__(self, model_path: str, required: bool = True):
        self.model_path = model_path
        self.model = None
        self.required = required
        self.is_loaded = False
        
    def load(self):
        if not os.path.exists(self.model_path):
            if self.required:
                raise FileNotFoundError(f"YOLO detection model required but not found at {self.model_path}")
            return False
            
        # The trained model should be an object detection model (e.g., yolov8n.pt), not classification.
        self.model = YOLO(self.model_path)
        self.is_loaded = True
        return True

    def detect(self, image_path: str, conf_thresh: float = 0.25) -> dict:
        """
        Detects wounds in the image.
        Returns ALL valid detections with confidence >= conf_thresh.
        
        Returns:
            {
                "available": bool,
                "detected": bool,
                "detections": [
                    {
                        "confidence": float,
                        "bbox": [x1, y1, x2, y2]
                    }, ...
                ]
            }
        """
        import logging
        logger = logging.getLogger(__name__)

        if not self.is_loaded:
            return {"available": False, "detected": False, "detections": []}
            
        results = self.model.predict(source=image_path, conf=0.01, verbose=False) # run with very low conf for diagnostics
        result = results[0]
        
        boxes = result.boxes
        
        # Diagnostics
        raw_boxes_count = len(boxes)
        raw_confs = []
        raw_classes = []
        if raw_boxes_count > 0:
            raw_confs = boxes.conf.cpu().numpy().tolist()
            raw_classes = boxes.cls.cpu().numpy().tolist()
            
        max_conf = max(raw_confs) if raw_confs else 0.0
        
        logger.info(
            f"\n[YOLO RAW FORENSICS]\n"
            f"image={image_path}\n"
            f"raw_boxes_count={raw_boxes_count}\n"
            f"max_confidence={max_conf}\n"
            f"raw_confidences={raw_confs}\n"
            f"raw_classes={raw_classes}\n"
            f"applied_conf_thresh={conf_thresh}\n"
        )
        
        # Apply actual threshold manually since we ran with 0.01 for forensics
        if raw_boxes_count == 0:
            return {"available": True, "detected": False, "detections": []}
            
        detections = []
        for box in boxes:
            class_id = int(box.cls[0])
            conf = float(box.conf[0])
            if class_id == 0 and conf >= conf_thresh:
                coords = box.xyxy[0].cpu().numpy().tolist()
                detections.append({
                    "confidence": conf,
                    "bbox": coords
                })
                
        if not detections:
            return {"available": True, "detected": False, "detections": []}
            
        return {
            "available": True,
            "detected": True,
            "detections": detections
        }
