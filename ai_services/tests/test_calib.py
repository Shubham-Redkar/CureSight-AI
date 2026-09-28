import cv2
import yaml
from api.services.calibration import CalibrationDetector
with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)
detector = CalibrationDetector(config)
img = cv2.imread('test_upload.jpg')
res = detector.detect(img)
print(res)
