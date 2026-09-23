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
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_e2e_automatic_priority(mock_validate, mock_segment, mock_detect, mock_predict):
    # Test 1 - Automatic Priority over manual input
    mock_predict.return_value = {"is_wound": True, "confidence": 0.99}
    mock_detect.return_value = {
        "detected": True, 
        "detections": [{"bbox": [10, 10, 100, 100], "confidence": 0.9}]
    }
    mock_segment.return_value = {"roi_mask": np.ones((90, 90), dtype=np.uint8)}
    mock_validate.return_value = {"valid": True, "message": "OK"}
    
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
    assert abs(calib.get("pixels_per_cm", 0) - 25.0) <= 1.0, "Automatic scale should be ~25, ignoring manual 50"
    
    assert data.get("physical_measurement_available") is True

@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_e2e_manual_demonstration(mock_validate, mock_segment, mock_detect, mock_predict):
    # Test 2 - Manual Demonstration (No marker, but manual supplied)
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

@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_e2e_demo_fallback(mock_validate, mock_segment, mock_detect, mock_predict):
    # Test B - Demo fallback (No marker, no manual, demo enabled)
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
    assert calib.get("label") == "Default Demonstration Scale"
    
    assert data.get("physical_measurement_available") is True

@patch('api.services.pipeline.load_config')
@patch('api.services.pipeline.WoundGate.predict')
@patch('api.services.pipeline.YoloDetector.detect')
@patch('api.services.pipeline.UNetSegmenter.segment')
@patch('api.services.pipeline.SegmentationValidator.validate')
def test_pipeline_e2e_no_calibration(mock_validate, mock_segment, mock_detect, mock_predict, mock_load_config):
    # Test D - No Calibration (Demo disabled, no marker, no manual value)
    
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

def test_pipeline_e2e_invalid_manual_value():
    # Test 4 - Invalid Manual Value
    path = os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration', 'no_marker.png')
    
    with TestClient(app) as client:
        with open(path, "rb") as f:
            # Negative pixels_per_cm should fail validation
            response = client.post("/api/v1/analyze-wound-upload/", data={"pixels_per_cm": -5.0}, files={"file": ("no_marker.png", f, "image/png")})
            
    assert response.status_code == 422
