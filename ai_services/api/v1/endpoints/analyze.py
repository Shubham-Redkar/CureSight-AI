import ipaddress
import logging
import os
import socket
import tempfile
import urllib.parse
import uuid
from typing import Any

import cv2
import httpx
import numpy as np
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)

from api.core.dependencies import get_config, get_ml_models
from api.schemas.wound import AnalyzeWoundRequest, AnalyzeWoundResponse
from api.services.wound_service import process_wound_image, raise_structured_error

logger = logging.getLogger(__name__)
router = APIRouter()

def ensure_models_loaded(models: dict[str, Any], request_id: str):
    if not models.get("pipeline"):
        raise_structured_error(
            status_code=503,
            code="MODELS_NOT_LOADED",
            message="AI Pipeline is not loaded. Please ensure training has been completed.",
            request_id=request_id
        )

def validate_url_for_ssrf(url_str: str, request_id: str):
    parsed = urllib.parse.urlparse(url_str)
    hostname = parsed.hostname
    if not hostname:
        raise_structured_error(status_code=400, code="INVALID_URL", message="Invalid URL hostname", request_id=request_id)
        
    try:
        addr_info = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise_structured_error(status_code=400, code="INVALID_URL", message="Could not resolve hostname", request_id=request_id)
        
    for res in addr_info:
        ip_str = res[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            continue
            
        if (ip.is_private or ip.is_loopback or ip.is_link_local or 
            ip.is_multicast or ip.is_reserved or ip.is_unspecified or 
            (isinstance(ip, ipaddress.IPv4Address) and ip_str.startswith("169.254.")) or 
            (isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped and ip.ipv4_mapped.is_private)):
            raise_structured_error(
                status_code=403,
                code="FORBIDDEN_DESTINATION",
                message="The provided URL resolves to a restricted or internal network address.",
                request_id=request_id
            )

@router.post("/analyze-wound/", response_model=AnalyzeWoundResponse)
async def analyze_wound_url(
    request_body: AnalyzeWoundRequest,
    request: Request,
    models: dict[str, Any] = Depends(get_ml_models),  # noqa: B008
    cfg: Any = Depends(get_config)  # noqa: B008
):
    """
    Analyze a wound from a provided image URL.
    This is useful if your Node.js backend uploads the image to S3/Cloudinary first
    and then passes the URL to this service.
    
    Calibration (pixels_per_cm) is strictly optional. If omitted, physical measurements
    will not be computed.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.info(f"[{request_id}] Received URL analysis request for {request_body.image_url}")
    ensure_models_loaded(models, request_id)

    # SSRF Protection
    validate_url_for_ssrf(str(request_body.image_url), request_id)

    # Limits
    limits = getattr(cfg, "api_limits", None)
    max_upload_size_bytes = 10 * 1024 * 1024
    if limits:
        max_upload_size_bytes = getattr(limits, "max_upload_size_mb", 10) * 1024 * 1024

    # 1. Download image (Streaming to prevent OOM)
    image_bytes = bytearray()
    try:
        async with httpx.AsyncClient() as client, client.stream("GET", str(request_body.image_url), timeout=15.0) as response:
                response.raise_for_status()
                
                # Check Content-Length if available
                content_length = response.headers.get("Content-Length")
                if content_length and int(content_length) > max_upload_size_bytes:
                    raise_structured_error(
                        status_code=413,
                        code="FILE_TOO_LARGE",
                        message=f"Upload exceeds maximum size limit of {max_upload_size_bytes / (1024*1024)}MB.",
                        request_id=request_id
                    )
                
                # Stream the response chunk by chunk to enforce actual byte limit regardless of headers
                async for chunk in response.aiter_bytes(chunk_size=8192):
                    image_bytes.extend(chunk)
                    if len(image_bytes) > max_upload_size_bytes:
                        raise_structured_error(
                            status_code=413,
                            code="FILE_TOO_LARGE",
                            message=f"Upload exceeds maximum size limit of {max_upload_size_bytes / (1024*1024)}MB.",
                            request_id=request_id
                        )
    except httpx.TimeoutException:
        raise_structured_error(
            status_code=504,
            code="GATEWAY_TIMEOUT",
            message="Request to the provided URL timed out.",
            request_id=request_id
        )
    except httpx.HTTPError as e:
        # Wrap HTTP errors during streaming in a safe response
        raise_structured_error(
            status_code=400,
            code="INVALID_URL",
            message=f"Failed to fetch image from URL: {e!s}",
            request_id=request_id
        )
    except Exception as e:
        # Avoid overriding our own StructuredError if it was raised (e.g. 413 Payload Too Large)
        if isinstance(e, HTTPException):
            raise
        # Also avoid overriding StructuredError directly since it inherits from Exception, 
        # wait, StructuredError inherits from Exception, so it would be caught here!
        # Let's import StructuredError and explicitly skip it.
        from api.core.exceptions import StructuredError
        if isinstance(e, StructuredError):
            raise
            
        raise_structured_error(
            status_code=400,
            code="INVALID_FILE",
            message=f"Failed to download image from URL: {e}",
            request_id=request_id
        )

    return await process_bytes(bytes(image_bytes), request_body.pixels_per_cm, models, cfg, request_id)

@router.post("/analyze-wound-upload/", response_model=AnalyzeWoundResponse)
async def analyze_wound_upload(
    request: Request,
    file: UploadFile = File(...),  # noqa: B008
    pixels_per_cm: float | None = Form(default=None, gt=0, description="Calibration scale in pixels per centimeter"),
    models: dict[str, Any] = Depends(get_ml_models),  # noqa: B008
    cfg: Any = Depends(get_config)  # noqa: B008
):
    """
    Analyze a wound from a direct multipart/form-data file upload.
    This is useful if your Node.js backend (using Multer) forwards the uploaded file
    directly to this API without saving it anywhere first.
    
    Calibration (pixels_per_cm) is strictly optional. If omitted, physical measurements
    will not be computed.
    """
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.info(f"[{request_id}] Received upload analysis request. File: {file.filename}")
    ensure_models_loaded(models, request_id)

    # 1. Read bytes
    content = await file.read()
    
    return await process_bytes(content, pixels_per_cm, models, cfg, request_id)


async def process_bytes(image_bytes: bytes, pixels_per_cm: float | None, models: dict[str, Any], cfg: Any, request_id: str):
    # 2. Extract limits
    limits = getattr(cfg, "api_limits", None)
    max_upload_size_bytes = 10 * 1024 * 1024
    max_width = 4096
    max_height = 4096
    if limits:
        max_upload_size_bytes = getattr(limits, "max_upload_size_mb", 10) * 1024 * 1024
        max_width = getattr(limits, "max_image_width", 4096)
        max_height = getattr(limits, "max_image_height", 4096)
        
    # 3. Validate file size
    if len(image_bytes) > max_upload_size_bytes:
        raise_structured_error(
            status_code=413,
            code="FILE_TOO_LARGE",
            message=f"Upload exceeds maximum size limit of {max_upload_size_bytes / (1024*1024)}MB.",
            request_id=request_id
        )
        
    # 4. Decode with OpenCV
    nparr = np.frombuffer(image_bytes, np.uint8)
    image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image_bgr is None:
        raise_structured_error(
            status_code=400,
            code="INVALID_IMAGE",
            message="Provided file is not a valid image or could not be decoded.",
            request_id=request_id
        )
        
    # 5. Validate dimensions
    height, width = image_bgr.shape[:2]
    if width > max_width or height > max_height:
        raise_structured_error(
            status_code=413,
            code="FILE_TOO_LARGE",
            message=f"Image dimensions ({width}x{height}) exceed maximum allowed ({max_width}x{max_height}).",
            request_id=request_id
        )
        
    logger.info(f"[{request_id}] Successfully decoded {width}x{height} image.")
    
    # 6. Save to temporary file for the ML pipeline
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
        tmp_file.write(image_bytes)
        tmp_path = tmp_file.name

    # 7. Process
    try:
        logger.info(f"[{request_id}] Starting ML inference...")
        return process_wound_image(tmp_path, pixels_per_cm, models, cfg, request_id)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
