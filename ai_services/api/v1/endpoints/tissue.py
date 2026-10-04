import logging
import os
import tempfile
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Request, UploadFile

from api.core.dependencies import get_config, get_ml_models
from api.schemas.tissue import AnalyzeTissueResponse
from api.services.tissue_service import process_tissue_image
from api.services.wound_service import raise_structured_error

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/analyze-tissue-upload/", response_model=AnalyzeTissueResponse)
async def analyze_tissue_upload(
    request: Request,
    file: UploadFile = File(...),
    models: dict[str, Any] = Depends(get_ml_models),
    cfg: Any = Depends(get_config)
):
    """
    Analyze a wound image to predict tissue composition.
    Returns the percentage of valid predicted tissue pixels for each tissue class.
    Predictions are model outputs and NOT clinical diagnoses.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    
    if not models.get("tissue_segmenter"):
        raise_structured_error(503, "MODELS_NOT_LOADED", "Tissue Segmenter not loaded.", request_id=request_id)
        
    content = await file.read()
    
    limits = getattr(cfg, "api_limits", None)
    max_upload_size_bytes = 10 * 1024 * 1024
    if limits:
        max_upload_size_bytes = getattr(limits, "max_upload_size_mb", 10) * 1024 * 1024
        
    if len(content) > max_upload_size_bytes:
        raise_structured_error(413, "FILE_TOO_LARGE", f"Upload exceeds {max_upload_size_bytes/(1024*1024)}MB.", request_id=request_id)
        
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
        tmp_file.write(content)
        tmp_path = tmp_file.name
        
    try:
        return process_tissue_image(tmp_path, models, cfg, request_id)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
