import io
import os
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

import cv2
import numpy as np

from api.main import app
from api.schemas.tissue import AnalyzeTissueResponse
from api.core.dependencies import ml_models
from api.services.tissue_segmenter import TissueSegmenter

@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture
def mock_pipeline():
    with patch("api.services.tissue_service.process_tissue_image") as mock_process:
        yield mock_process
        
def create_test_image_bytes():
    # Create a simple valid image
    img = np.zeros((300, 300, 3), dtype=np.uint8)
    cv2.rectangle(img, (50, 50), (250, 250), (0, 0, 255), -1) # Red wound
    _, buffer = cv2.imencode('.jpg', img)
    return buffer.tobytes()

def test_missing_image(client):
    response = client.post("/api/v1/analyze-tissue-upload/")
    assert response.status_code == 422 # FastAPI validation error for missing file

def test_invalid_image(client):
    # Mocking model loading to bypass 503
    ml_models["tissue_segmenter"] = True
    ml_models["pipeline"] = True
    
    response = client.post(
        "/api/v1/analyze-tissue-upload/",
        files={"file": ("test.txt", b"not an image", "text/plain")}
    )
    # The actual image quality check or cv2.imread will fail
    assert response.status_code in [400, 422]
    
def test_model_unavailable(client):
    # Temporarily remove models
    old_tissue = ml_models.get("tissue_segmenter")
    ml_models["tissue_segmenter"] = None
    
    response = client.post(
        "/api/v1/analyze-tissue-upload/",
        files={"file": ("test.jpg", create_test_image_bytes(), "image/jpeg")}
    )
    assert response.status_code == 503
    
    # Restore
    ml_models["tissue_segmenter"] = old_tissue

def test_model_loading_through_lifespan(client):
    # The application lifespan creates tissue_segmenter
    assert "tissue_segmenter" in ml_models
    # We allow it to be None if models are missing, but the key should exist.
    # We allow it to be None if models are missing, but the key should exist.

def test_endpoint_authentication_rbac(client):
    # Existing project convention for FastAPI ML service is no direct auth
    # It relies on the Node.js backend. We verify it's accessible without tokens.
    # We just need to get a standard error rather than a 401 Unauthorized.
    ml_models["tissue_segmenter"] = True
    ml_models["pipeline"] = True
    response = client.post("/api/v1/analyze-tissue-upload/")
    assert response.status_code != 401
    assert response.status_code != 403

def test_tissue_percentage_validity():
    from api.schemas.tissue import TissueCompositionPercentages
    
    # Range [0,100]
    comp = TissueCompositionPercentages(
        epithelial=50.0,
        granulation=50.0
    )
    assert comp.epithelial == 50.0
    
    with pytest.raises(ValueError):
        TissueCompositionPercentages(epithelial=-10.0)
        
    with pytest.raises(ValueError):
        TissueCompositionPercentages(granulation=105.0)

def test_appropriate_handling_of_zero_empty_tissue_predictions():
    # Simulate TissueSegmenter logic
    from api.services.tissue_segmenter import TissueSegmenter
    
    # Create mock TissueSegmenter
    segmenter = TissueSegmenter("fake_path", required=False)
    segmenter.is_loaded = True
    segmenter.model = MagicMock()
    
    # Mock logits to predict all background (0)
    fake_logits = torch.zeros((1, 8, 224, 224))
    fake_logits[:, 0, :, :] = 10.0 # Background has highest logit
    segmenter.model.return_value = fake_logits
    
    roi_img = np.zeros((100, 100, 3), dtype=np.uint8)
    result = segmenter.segment(roi_img)
    
    assert result["available"] is True
    assert result["composition"]["epithelial"] == 0.0
    assert result["composition"]["granulation"] == 0.0
    
import torch
