import cv2
import numpy as np
import yaml
import sys
from api.services.calibration import CalibrationDetector

with open('config.yaml', 'r') as f:
    config = yaml.safe_load(f)
detector = CalibrationDetector(config)

def check_image(name, img_array, expect_detected):
    cv2.imwrite(name, img_array)
    res = detector.detect(img_array)
    passed = (res['detected'] == expect_detected)
    print(f"Test {name}: {'PASS' if passed else 'FAIL'} (Expected detected={expect_detected}, got detected={res['detected']}, reason={res.get('reason')})")
    if not passed:
        sys.exit(1)

# 1. Large green background (e.g. surgical drape)
# Image 2000x2000, solid green taking up half the screen.
img1 = np.zeros((2000, 2000, 3), dtype=np.uint8)
# BGR: green is (0, 255, 0)
img1[500:1500, 500:1500] = [0, 255, 0]
check_image("test_large_green.jpg", img1, False)

# 2. Small green noise
img2 = np.zeros((1000, 1000, 3), dtype=np.uint8)
img2[500:520, 500:520] = [0, 255, 0] # 20x20 is 400 pixels, min ratio is 0.0005 (0.05% of 1,000,000 is 500)
check_image("test_small_noise.jpg", img2, False)

# 3. Irregular green object (e.g. wrinkled fabric)
img3 = np.zeros((1000, 1000, 3), dtype=np.uint8)
points = np.array([[200, 200], [400, 150], [500, 400], [250, 450]], np.int32)
cv2.fillPoly(img3, [points], (0, 255, 0))
check_image("test_irregular_green.jpg", img3, False)

# 4. Valid green marker
img4 = np.zeros((1000, 1000, 3), dtype=np.uint8)
# 100x100 square in 1000x1000 image. Area=10,000. 10000 / 1M = 0.01 (1%), passes min_area_ratio_of_image (0.0005).
img4[450:550, 450:550] = [0, 255, 0]
check_image("test_valid_marker.jpg", img4, True)

print("All tests passed!")
