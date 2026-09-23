import cv2
import numpy as np
from ai_services.api.services.calibration import CalibrationDetector

def run_tests():
    config = {
        'calibration': {
            'enabled': True,
            'marker': {'type': 'green_square', 'width_cm': 2.0, 'height_cm': 2.0},
            'detection': {
                'min_area_pixels': 400,
                'max_area_ratio': 0.20,
                'aspect_ratio_tolerance': 0.20,
                'min_fill_ratio': 0.70,
                'min_confidence': 0.80,
                'confidence_margin': 0.10
            }
        }
    }
    detector = CalibrationDetector(config)

    # Test 1: Valid marker (Perfect square)
    img = np.zeros((1000, 1000, 3), dtype=np.uint8)
    # Draw a 100x100 green square (width=100, height=100 -> pixels_per_cm = 50)
    cv2.rectangle(img, (200, 200), (300, 300), (0, 255, 0), -1)
    res = detector.detect(img)
    print("Test 1 - Valid marker:", res)
    assert res['detected'] == True
    assert res['pixels_per_cm'] == 50.0

    # Test 2: No marker
    img2 = np.zeros((1000, 1000, 3), dtype=np.uint8)
    res2 = detector.detect(img2)
    print("Test 2 - No marker:", res2)
    assert res2['detected'] == False
    assert res2['pixels_per_cm'] is None

    # Test 3: Multiple markers, one clearly superior
    img3 = np.zeros((1000, 1000, 3), dtype=np.uint8)
    # Good square (100x100 -> area 10000)
    cv2.rectangle(img3, (200, 200), (300, 300), (0, 255, 0), -1)
    # Bad rectangle (100x50 -> area 5000, wrong aspect ratio)
    cv2.rectangle(img3, (500, 500), (600, 550), (0, 255, 0), -1)
    res3 = detector.detect(img3)
    print("Test 3 - Superior marker:", res3)
    assert res3['detected'] == True

    # Test 4: Multiple identical markers (Ambiguous)
    img4 = np.zeros((1000, 1000, 3), dtype=np.uint8)
    cv2.rectangle(img4, (200, 200), (300, 300), (0, 255, 0), -1)
    cv2.rectangle(img4, (500, 500), (600, 600), (0, 255, 0), -1)
    res4 = detector.detect(img4)
    print("Test 4 - Ambiguous markers:", res4)
    assert res4['detected'] == False
    assert res4['reason'] == "CALIBRATION_MARKER_AMBIGUOUS"

    # Test 5: Disabled
    cfg_disabled = config.copy()
    cfg_disabled['calibration']['enabled'] = False
    det_disabled = CalibrationDetector(cfg_disabled)
    res5 = det_disabled.detect(img)
    print("Test 5 - Disabled:", res5)
    assert res5['detected'] == False
    assert res5['reason'] == "CALIBRATION_DISABLED"
    
    print("All tests passed!")

if __name__ == "__main__":
    run_tests()
