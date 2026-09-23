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
        if not self.is_loaded:
            return {"available": False, "detected": False, "detections": []}
            
        results = self.model.predict(source=image_path, conf=conf_thresh, verbose=False)
        result = results[0]
        
        boxes = result.boxes
        if len(boxes) == 0:
            return {"available": True, "detected": False, "detections": []}
            
        detections = []
        for box in boxes:
            class_id = int(box.cls[0])
            if class_id == 0:
                coords = box.xyxy[0].cpu().numpy().tolist()
                conf = float(box.conf[0])
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
