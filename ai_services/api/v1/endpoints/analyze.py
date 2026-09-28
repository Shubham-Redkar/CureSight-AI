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
import hashlib
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
    
    sha256_hash = hashlib.sha256(content).hexdigest()
    logger.info(
        f"\n[FASTAPI IMAGE FORENSICS]\n"
        f"request_id={request_id}\n"
        f"filename={file.filename}\n"
        f"content_type={file.content_type}\n"
        f"file_size={len(content)}\n"
        f"sha256={sha256_hash}\n"
    )
    
    return await process_bytes(content, pixels_per_cm, models, cfg, request_id, file.filename, file.content_type)


async def process_bytes(image_bytes: bytes, pixels_per_cm: float | None, models: dict[str, Any], cfg: Any, request_id: str, filename: str = "unknown", content_type: str = "unknown"):
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
        
    height, width = image_bgr.shape[:2]
    channels = image_bgr.shape[2] if len(image_bgr.shape) > 2 else 1
    
    logger.info(
        f"\n[FASTAPI DECODED IMAGE FORENSICS]\n"
        f"request_id={request_id}\n"
        f"decoded_width={width}\n"
        f"decoded_height={height}\n"
        f"channels={channels}\n"
    )

    # 5. Validate dimensions
    # We will downscale oversized images later in the pipeline after quality checks,
    # but we retain a generous hard limit to prevent OOM/decompression bombs.
    height, width = image_bgr.shape[:2]
    hard_limit = 10000
    if width > hard_limit or height > hard_limit:
        raise_structured_error(
            status_code=413,
            code="FILE_TOO_LARGE",
            message=f"Image dimensions ({width}x{height}) exceed absolute security limit ({hard_limit}x{hard_limit}).",
            request_id=request_id
        )
        
    logger.info(f"[{request_id}] Successfully decoded {width}x{height} image.")
    
    # 6. Save to temporary file for the ML pipeline
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
        tmp_file.write(image_bytes)
        tmp_path = tmp_file.name

    # 7. Process
    import shutil
    debug_path = f"/home/shubham/projects/CureSight-AI/debug_{'flutter' if 'dart' in (content_type.lower() if content_type else '') or 'png' in filename.lower() or 'scaled' in filename.lower() else 'web'}_{request_id}.jpg"
    
    # Try to distinguish based on filename for the debug prefix
    if 'image_picker' in filename.lower() or 'scaled' in filename.lower() or 'normalized' in filename.lower():
        prefix = 'flutter'
    else:
        prefix = 'web'
    debug_path = os.path.join(tempfile.gettempdir(), f"debug_{prefix}_{request_id}.jpg")
    shutil.copy2(tmp_path, debug_path)
    logger.info(f"[{request_id}] Saved diagnostic copy to {debug_path}")
    
    try:
        logger.info(f"[{request_id}] Starting ML inference...")
        response = process_wound_image(tmp_path, pixels_per_cm, models, cfg, request_id)
        logger.info(
            f"\n[AI SUCCESS]\n"
            f"request_id={request_id}\n"
            f"wound_detected={response.wound_detected}\n"
            f"detection_confidence={response.detection_confidence}\n"
            f"image_width={width}\n"
            f"image_height={height}\n"
        )
        return response
    except Exception as e:
        from api.core.exceptions import StructuredError
        if isinstance(e, StructuredError) and e.status_code == 422:
            logger.error(
                f"\n[AI 422 FILE DIAGNOSTIC APPEND]\n"
                f"request_id={request_id}\n"
                f"filename={filename}\n"
                f"content_type={content_type}\n"
                f"image_width={width}\n"
                f"image_height={height}\n"
                f"file_size={len(image_bytes)}\n"
            )
        raise e
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
