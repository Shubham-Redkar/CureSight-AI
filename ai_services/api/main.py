import logging
import traceback
import uuid
from typing import Any

from fastapi import Depends, FastAPI, Request, status
from fastapi.responses import JSONResponse

from api.core.dependencies import get_ml_models, lifespan
from api.core.exceptions import StructuredError
from api.schemas.wound import ErrorDetails, ErrorResponse
from api.v1.api_router import api_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Wound Analysis API",
    version="1.1.0",
    description="Enterprise standard FastAPI backend for wound analysis",
    lifespan=lifespan
)

@app.middleware("http")
async def request_id_middleware(request: Request, call_next: Any) -> Any:
    request_id = request.headers.get("X-Request-ID")
    if not request_id:
        request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

@app.exception_handler(StructuredError)
async def structured_error_handler(request: Request, exc: StructuredError) -> JSONResponse:
    request_id = exc.request_id or getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(
            error=ErrorDetails(
                code=exc.code,
                message=exc.message,
                details=exc.details,
                request_id=request_id
            )
        ).model_dump(exclude_none=True)
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error(f"Request {request_id} failed with unhandled exception: {exc}\n{traceback.format_exc()}")
    
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error=ErrorDetails(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred.",
                details=[],
                request_id=request_id
            )
        ).model_dump(exclude_none=True)
    )

# Register versioned routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/", summary="Root Endpoint", description="Minimal root endpoint confirming the service is running.")
async def read_root():
    return {
        "service": "CureSight AI ML Service",
        "status": "ok",
        "message": "AI-assisted wound analysis API is running"
    }

@app.get("/health", summary="Health Check", description="Verifies the FastAPI process is alive and ML components are initialized.")
async def health_check(models: dict[str, Any] = Depends(get_ml_models)):  # noqa: B008
    if models.get("pipeline") is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unavailable",
                "service": "curesight-ml-service",
                "models_loaded": False,
                "detail": "ML pipeline is not fully initialized."
            }
        )
    return {
        "status": "healthy",
        "service": "curesight-ml-service",
        "models_loaded": True
    }
