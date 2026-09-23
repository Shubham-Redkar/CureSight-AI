import os

from ultralytics import YOLO


class WoundGate:
    """
    Binary classifier to determine if an image contains a wound (WOUND) 
    or does not (NON_WOUND).
    """
    def __init__(self, model_path: str, required: bool = True):
        self.model_path = model_path
        self.model = None
        self.required = required
        self.is_loaded = False
        
    def load(self):
        if not os.path.exists(self.model_path):
            if self.required:
                raise FileNotFoundError(f"Wound Gate model required but not found at {self.model_path}")
            return False
            
        # Assuming the final trained model will be a YOLO classification model (e.g. yolov8n-cls.pt)
        self.model = YOLO(self.model_path)
        self.is_loaded = True
        return True

    def predict(self, image_path: str) -> dict:
        """
        Predicts if the image is a wound or not.
        Returns:
            {"is_wound": bool, "confidence": float, "available": bool}
        """
        if not self.is_loaded:
            return {"available": False, "is_wound": False, "confidence": 0.0}
            
        results = self.model.predict(source=image_path, verbose=False)
        result = results[0]
        
        # Expected classes: 0 = NON_WOUND, 1 = WOUND (or equivalent)
        # We rely on the model's highest probability class
        class_id = int(result.probs.top1)
        confidence = float(result.probs.top1conf)
        class_name = self.model.names[class_id].lower()
        
        is_wound = class_name == "wound"
        
        return {
            "available": True,
            "is_wound": is_wound,
            "confidence": confidence,
            "class_name": class_name
        }
