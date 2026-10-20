import os
import cv2
import numpy as np
import pytest
import yaml
from unittest.mock import patch
from fastapi.testclient import TestClient
from api.services.calibration import CalibrationDetector
from api.services.measurements import WoundMeasurements
from api.main import app

# Load config to instantiate detector properly
def get_config():
    config_path = os.path.join(os.path.dirname(__file__), '..', 'config.yaml')
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

def load_fixture(name):
    path = os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration', name)
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Fixture {name} not found at {path}. Did you run generate_fixtures.py?")
    return img

def test_valid_marker():
    config = get_config()
    detector = CalibrationDetector(config)
    img = load_fixture('valid_marker.png')
    
    result = detector.detect(img)
    
    assert result["detected"] is True, "Valid marker should be detected"
    
    # Mathematical assertions
    # Marker is 50x50. The width_cm and height_cm configured is 2.0.
    # Therefore expected px/cm = 50 / 2 = 25.
    assert abs(result["marker_width_px"] - 50.0) <= 2.0, "Marker width should be ~50px"
    assert abs(result["marker_height_px"] - 50.0) <= 2.0, "Marker height should be ~50px"
    assert abs(result["pixels_per_cm"] - 25.0) <= 1.0, f"Expected ~25 px/cm, got {result['pixels_per_cm']}"

def test_no_marker_safety():
    config = get_config()
    detector = CalibrationDetector(config)
    img = load_fixture('no_marker.png')
    
    result = detector.detect(img)
    
    assert result["detected"] is False, "No marker image must fail closed"
    assert result["pixels_per_cm"] is None, "pixels_per_cm must be None"
    
    # Test that measurements service fails closed
    meas = WoundMeasurements(pixels_per_cm=result["pixels_per_cm"])
    
    # Dummy mask of size 100x100
    mask = np.ones((100, 100), dtype=np.uint8)
    calc = meas.compute(mask)
    
    assert calc["physical"] is None, "Physical measurements must be suppressed without calibration"

@pytest.mark.parametrize("fixture_name,expected_reason", [
    ('large_green_background.png', 'CALIBRATION_MARKER_NOT_FOUND'),
    ('tiny_green_noise.png', 'CALIBRATION_MARKER_NOT_FOUND'),
    ('irregular_green_region.png', 'CALIBRATION_MARKER_NOT_FOUND'),
    ('ambiguous_markers.png', 'CALIBRATION_MARKER_AMBIGUOUS'),
    ('partial_marker.png', 'CALIBRATION_MARKER_NOT_FOUND'),
])
def test_false_positives(fixture_name, expected_reason):
    config = get_config()
    detector = CalibrationDetector(config)
    img = load_fixture(fixture_name)
    
    result = detector.detect(img)
    
    assert result["detected"] is False, f"Fixture {fixture_name} should fail closed"
    assert result["pixels_per_cm"] is None, "pixels_per_cm must be None on failure"
    if expected_reason:
        assert result["reason"] == expected_reason, f"Expected reason {expected_reason} but got {result['reason']}"

def test_physical_math():
    """
    Independent deterministic mathematical test.
    Assume pixels_per_cm = 25
    area = 2500 pixels -> 2500 / 25^2 = 2500 / 625 = 4 cm2
    width = 100 pixels -> 100 / 25 = 4 cm
    height = 75 pixels -> 75 / 25 = 3 cm
    """
    meas = WoundMeasurements(pixels_per_cm=25.0)
    
    # Create a synthetic mask that is exactly 100 wide and 75 tall
    # Area = 100 * 75 = 7500 pixels (which would be 12 cm2)
    # But let's build a shape that has exactly 2500 area.
    # Actually, WoundMeasurements computes pixel area by np.sum(mask).
    # And width/height from bounding rect.
    # Let's create an L-shape or just a rectangle to test this.
    # A rectangle of 100x25 has area 2500, width 100, height 25.
    
    mask = np.zeros((150, 150), dtype=np.uint8)
    mask[10:35, 10:110] = 1 # height 25, width 100. Area = 2500.
    
    calc = meas.compute(mask)
    
    assert calc["physical"] is not None
    assert abs(calc["physical"]["area_cm2"] - 4.0) < 0.01, f"Expected area 4.0, got {calc['physical']['area_cm2']}"
    assert abs(calc["physical"]["width_cm"] - 4.0) < 0.01, f"Expected width 4.0, got {calc['physical']['width_cm']}"
    assert abs(calc["physical"]["height_cm"] - 1.0) < 0.01, f"Expected height 1.0, got {calc['physical']['height_cm']}"

@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.analyze_image_quality')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_e2e_automatic_priority(mock_validate, mock_quality, mock_segment, mock_detect, mock_predict):
    # Test 1 - Automatic Priority over manual input
    mock_predict.return_value = {"is_wound": True, "confidence": 0.99}
    mock_detect.return_value = {
        "detected": True, 
        "detections": [{"bbox": [10, 10, 100, 100], "confidence": 0.9}]
    }
    mock_segment.return_value = {"roi_mask": np.ones((90, 90), dtype=np.uint8)}
    mock_validate.return_value = {"valid": True, "message": "OK"}
    mock_quality.return_value = {"accepted": True, "reasons": [], "width": 100, "height": 100}
    
    path = os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration', 'valid_marker.png')
    
    with TestClient(app) as client:
        with open(path, "rb") as f:
            # We supply a manual calibration of 50 px/cm, but the automatic marker should override it (~25 px/cm)
            response = client.post("/api/v1/analyze-wound-upload/", data={"pixels_per_cm": 50.0}, files={"file": ("valid_marker.png", f, "image/png")})
    
    assert response.status_code == 200
    data = response.json()
    
    calib = data.get("calibration")
    assert calib is not None
    assert calib.get("detected") is True
    assert calib.get("source") == "automatic"
    assert data.get("physical_measurement_available") is True
    assert data.get("total_area_cm2") is not None
    assert data.get("total_area_pixels") is not None
    assert data.get("wounds")[0].get("area_pixels") is not None
    assert data.get("wounds")[0].get("area_cm2") is not None

@patch('api.services.pipeline.analyze_image_quality')
@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_e2e_manual_demonstration(mock_validate, mock_segment, mock_detect, mock_predict, mock_quality):
    # Test 2 - Manual Demonstration (No marker, but manual supplied)
    mock_quality.return_value = {"accepted": True, "reasons": [], "width": 100, "height": 100}
    mock_predict.return_value = {"is_wound": True, "confidence": 0.99}
    mock_detect.return_value = {
        "detected": True, 
        "detections": [{"bbox": [10, 10, 100, 100], "confidence": 0.9}]
    }
    mock_segment.return_value = {"roi_mask": np.ones((90, 90), dtype=np.uint8)}
    mock_validate.return_value = {"valid": True, "message": "OK"}
    
    path = os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration', 'no_marker.png')
    
    with TestClient(app) as client:
        with open(path, "rb") as f:
            response = client.post("/api/v1/analyze-wound-upload/", data={"pixels_per_cm": 25.0}, files={"file": ("no_marker.png", f, "image/png")})
            
    assert response.status_code == 200
    data = response.json()
    
    calib = data.get("calibration")
    assert calib.get("source") == "manual"
    assert calib.get("pixels_per_cm") == 25.0
    assert calib.get("label") == "Manual — Demonstration"
    assert calib.get("confidence") is None
    
    assert data.get("physical_measurement_available") is True

@patch('api.services.pipeline.analyze_image_quality')
@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_e2e_demo_fallback(mock_validate, mock_segment, mock_detect, mock_predict, mock_quality):
    # Test B - Demo fallback (No marker, no manual, demo enabled)
    mock_quality.return_value = {"accepted": True, "reasons": [], "width": 100, "height": 100}
    mock_predict.return_value = {"is_wound": True, "confidence": 0.99}
    mock_detect.return_value = {
        "detected": True, 
        "detections": [{"bbox": [10, 10, 100, 100], "confidence": 0.9}]
    }
    mock_segment.return_value = {"roi_mask": np.ones((90, 90), dtype=np.uint8)}
    mock_validate.return_value = {"valid": True, "message": "OK"}
    
    path = os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration', 'no_marker.png')
    
    with TestClient(app) as client:
        with open(path, "rb") as f:
            response = client.post("/api/v1/analyze-wound-upload/", files={"file": ("no_marker.png", f, "image/png")})
            
    assert response.status_code == 200
    data = response.json()
    
    calib = data.get("calibration")
    assert calib.get("source") == "demo"
    assert calib.get("pixels_per_cm") == 25.0
    assert "Default Demonstration Scale" in calib.get("label", "")
    assert calib.get("verified") is False
    assert calib.get("detected") is False
    
    # Safe fallback: physical measurements are marked unavailable, raw pixels preserved
    assert data.get("physical_measurement_available") is False
    assert data.get("total_area_cm2") is None
    assert data.get("total_area_pixels") is not None
    assert data.get("wounds")[0].get("area_pixels") is not None
    assert data.get("wounds")[0].get("area_cm2") is None

@patch('api.services.pipeline.analyze_image_quality')
@patch('api.services.pipeline.load_config')
@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_e2e_no_calibration(mock_validate, mock_segment, mock_detect, mock_predict, mock_load_config, mock_quality):
    # Test D - No Calibration (Demo disabled, no marker, no manual value)
    mock_quality.return_value = {"accepted": True, "reasons": [], "width": 100, "height": 100}
    
    # Mock config to disable demo
    from types import SimpleNamespace
    mock_cfg = SimpleNamespace(
        api_limits=SimpleNamespace(max_image_width=4096, max_image_height=4096),
        image_quality=SimpleNamespace(
            min_width=224, min_height=224, min_brightness=50.0, max_brightness=210.0,
            min_contrast=25.0, min_sharpness=5.0, max_glare_fraction=0.20,
            min_saturation=15.0, max_aspect_ratio=3.0
        ),
        calibration=SimpleNamespace(demo=SimpleNamespace(enabled=False, default_pixels_per_cm=25.0))
    )
    mock_load_config.return_value = mock_cfg

    mock_predict.return_value = {"is_wound": True, "confidence": 0.99}
    mock_detect.return_value = {
        "detected": True, 
        "detections": [{"bbox": [10, 10, 100, 100], "confidence": 0.9}]
    }
    mock_segment.return_value = {"roi_mask": np.ones((90, 90), dtype=np.uint8)}
    mock_validate.return_value = {"valid": True, "message": "OK"}
    
    path = os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration', 'no_marker.png')
    
    with TestClient(app) as client:
        with open(path, "rb") as f:
            # No manual value supplied
            response = client.post("/api/v1/analyze-wound-upload/", files={"file": ("no_marker.png", f, "image/png")})
    
    assert response.status_code == 200
    data = response.json()
    
    calib = data.get("calibration")
    if calib:
        assert calib.get("detected") is False
        assert calib.get("source") == "none"
        assert calib.get("pixels_per_cm") is None
        
    assert data.get("physical_measurement_available") is False
    assert data.get("total_area_cm2") is None
    assert data.get("total_area_pixels") is not None
    assert data.get("wounds")[0].get("area_pixels") is not None
    assert data.get("wounds")[0].get("area_cm2") is None

def test_pipeline_e2e_invalid_manual_value():
    # Test 4 - Invalid Manual Value
    path = os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration', 'no_marker.png')
    
    with TestClient(app) as client:
        with open(path, "rb") as f:
            # Negative pixels_per_cm should fail validation
            response = client.post("/api/v1/analyze-wound-upload/", data={"pixels_per_cm": -5.0}, files={"file": ("no_marker.png", f, "image/png")})
            
    assert response.status_code == 422

def test_perspective_distorted_marker():
    """
    Test that a square viewed under realistic perspective angle (~15-20 deg)
    is detected by the improved calibration detector.
    """
    config = get_config()
    detector = CalibrationDetector(config)
    img = np.zeros((800, 800, 3), dtype=np.uint8)
    # Perspective quadrilateral: top edge 44px, bottom 52px, height 48px
    pts = np.array([[204, 200], [248, 200], [252, 248], [200, 248]], dtype=np.int32)
    cv2.fillPoly(img, [pts], (0, 255, 0))

    result = detector.detect(img)
    assert result["detected"] is True, "Perspective-distorted marker should be detected"
    assert result["pixels_per_cm"] is not None
    assert result["source"] == "automatic"
    assert result["confidence"] >= 0.82

def test_rotated_marker():
    """
    Test that a valid 2cm x 2cm marker rotated by 30 degrees is detected.
    """
    config = get_config()
    detector = CalibrationDetector(config)
    img = np.zeros((600, 600, 3), dtype=np.uint8)

    # Create 50x50 square rotated by 30 deg
    rect = ((300, 300), (50, 50), 30.0)
    box = np.int32(cv2.boxPoints(rect))
    cv2.fillPoly(img, [box], (0, 255, 0))

    result = detector.detect(img)
    assert result["detected"] is True, "Rotated marker should be detected"
    assert abs(result["pixels_per_cm"] - 25.0) <= 2.0

def test_high_resolution_small_marker():
    """
    In a high-resolution image (e.g. 2000x2000 = 4MP), a 40x40 marker takes up
    1600 / 4,000,000 = 0.0004 of the image. The detector must accept it without false noise rejection.
    """
    config = get_config()
    detector = CalibrationDetector(config)
    img = np.zeros((2000, 2000, 3), dtype=np.uint8)
    cv2.rectangle(img, (500, 500), (540, 540), (0, 255, 0), -1)

    result = detector.detect(img)
    assert result["detected"] is True, "Marker in high-resolution image must be detected"
    assert abs(result["pixels_per_cm"] - 20.0) <= 1.5

def test_false_positive_skin_and_dressings():
    """
    Ensure skin tones and white dressing patches are rejected even if rectangular.
    """
    config = get_config()
    detector = CalibrationDetector(config)
    img = np.zeros((500, 500, 3), dtype=np.uint8)

    # Skin tone rectangle (BGR: peach/skin tone)
    cv2.rectangle(img, (100, 100), (160, 160), (140, 180, 220), -1)
    res_skin = detector.detect(img)
    assert res_skin["detected"] is False

    # White dressing rectangle (BGR: near-white)
    cv2.rectangle(img, (250, 250), (310, 310), (245, 245, 245), -1)
    res_dressing = detector.detect(img)
    assert res_dressing["detected"] is False

@patch('api.services.pipeline.analyze_image_quality')
@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_resize_calibration_consistency(mock_validate, mock_segment, mock_detect, mock_predict, mock_quality):
    """
    When an image exceeds api_limits (4096), pipeline downscales it.
    Verify that response['calibration'] metadata correctly scales pixels_per_cm and marker dimensions.
    """
    from api.services.pipeline import MLPipeline
    mock_quality.return_value = {"accepted": True, "reasons": [], "width": 5000, "height": 3000}
    mock_predict.return_value = {"is_wound": True, "confidence": 0.99}
    mock_detect.return_value = {
        "detected": True,
        "detections": [{"bbox": [10, 10, 100, 100], "confidence": 0.9}]
    }
    mock_segment.return_value = {"roi_mask": np.ones((90, 90), dtype=np.uint8)}
    mock_validate.return_value = {"valid": True, "message": "OK"}

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        big_img = np.zeros((3000, 5000, 3), dtype=np.uint8)
        # 100x100 marker -> in 2.0cm marker -> 50 px/cm
        cv2.rectangle(big_img, (500, 500), (600, 600), (0, 255, 0), -1)
        cv2.imwrite(tmp.name, big_img)
        tmp_path = tmp.name

    try:
        pipeline = MLPipeline()
        result = pipeline.process_image(tmp_path)
        cal = result.get("calibration")
        assert cal is not None
        assert cal.get("detected") is True
        expected_scale = round(50.0 * (4096.0 / 5000.0), 3)
        assert abs(cal.get("pixels_per_cm") - expected_scale) < 1.0
        assert cal.get("resize_ratio") == (4096.0 / 5000.0)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@patch('api.services.pipeline.analyze_image_quality')
@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_below_resize_threshold_calibration_consistency(mock_validate, mock_segment, mock_detect, mock_predict, mock_quality):
    """
    When an image is below api_limits (e.g. 1000x1000 <= 4096), pipeline does not resize.
    Verify that pixels_per_cm and coordinates remain in original image space without modification.
    """
    from api.services.pipeline import MLPipeline
    mock_quality.return_value = {"accepted": True, "reasons": [], "width": 1000, "height": 1000}
    mock_predict.return_value = {"is_wound": True, "confidence": 0.99}
    mock_detect.return_value = {
        "detected": True,
        "detections": [{"bbox": [50, 50, 200, 200], "confidence": 0.95}]
    }
    mock_segment.return_value = {"roi_mask": np.ones((150, 150), dtype=np.uint8)}
    mock_validate.return_value = {"valid": True, "message": "OK"}

    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        std_img = np.zeros((1000, 1000, 3), dtype=np.uint8)
        # 100x100 marker -> 2.0 cm -> 50 px/cm
        cv2.rectangle(std_img, (300, 300), (400, 400), (0, 255, 0), -1)
        cv2.imwrite(tmp.name, std_img)
        tmp_path = tmp.name

    try:
        pipeline = MLPipeline()
        result = pipeline.process_image(tmp_path)
        cal = result.get("calibration")
        assert cal is not None
        assert cal.get("detected") is True
        # Scale must be exactly ~50 px/cm without any downscale ratio applied
        assert abs(cal.get("pixels_per_cm") - 50.0) < 1.0
        assert cal.get("resize_ratio") is None
        # Verify physical measurements computed with the exact unscaled pixels_per_cm
        meas = result.get("measurements")
        assert meas is not None
        assert meas.get("physical") is not None
        assert meas["physical"].get("area_cm2") is not None
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
