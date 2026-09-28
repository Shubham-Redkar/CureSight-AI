import os
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

class WoundClassifier:
    def __init__(self, effnet_path: str, resnet_path: str, num_classes: int = 12):
        self.effnet_path = effnet_path
        self.resnet_path = resnet_path
        self.num_classes = num_classes
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        self.classes = [
            'Abrasion', 'Bruise', 'Burn', 'Cut', 'Diabetic Wound', 
            'Ingrown Nail', 'Laceration', 'Normal', 'Pressure Ulcer', 
            'Stab Wound', 'Surgical Wound', 'Venous Wound'
        ]
        
        self.effnet = None
        self.resnet = None
        self.is_loaded = False
        
        # Phase 13 Squash configuration
        self.effnet_transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        # ResNet baseline configuration
        self.resnet_transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
    def _build_efficientnet(self):
        model = models.efficientnet_b0(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier[1] = nn.Linear(in_features, self.num_classes)
        return model
        
    def _build_resnet(self):
        model = models.resnet50(weights=None)
        in_features = model.fc.in_features
        model.fc = nn.Linear(in_features, self.num_classes)
        return model
        
    def load(self):
        if not os.path.exists(self.effnet_path) or not os.path.exists(self.resnet_path):
            raise FileNotFoundError("One or more classifier model files not found.")
            
        self.effnet = self._build_efficientnet()
        self.effnet.load_state_dict(torch.load(self.effnet_path, map_location=self.device))
        self.effnet.to(self.device)
        self.effnet.eval()
        
        self.resnet = self._build_resnet()
        self.resnet.load_state_dict(torch.load(self.resnet_path, map_location=self.device))
        self.resnet.to(self.device)
        self.resnet.eval()
        
        self.is_loaded = True
        return True
        
    def predict(self, image_path: str) -> dict:
        if not self.is_loaded:
            return {"available": False}
            
        image = Image.open(image_path).convert('RGB')
        
        effnet_tensor = self.effnet_transform(image).unsqueeze(0).to(self.device)
        resnet_tensor = self.resnet_transform(image).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            eff_logits = self.effnet(effnet_tensor)
            res_logits = self.resnet(resnet_tensor)
            
            eff_probs = torch.softmax(eff_logits, dim=1).cpu().numpy()[0]
            res_probs = torch.softmax(res_logits, dim=1).cpu().numpy()[0]
            
        final_probs = (eff_probs + res_probs) / 2.0
        predicted_idx = int(final_probs.argmax())
        
        class_probs = {self.classes[i]: float(final_probs[i]) for i in range(self.num_classes)}
        
        return {
            "available": True,
            "predicted_class": self.classes[predicted_idx],
            "confidence": float(final_probs[predicted_idx]),
            "class_probabilities": class_probs
        }
