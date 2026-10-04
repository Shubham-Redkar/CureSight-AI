from fastapi import APIRouter

from api.v1.endpoints import analyze, tissue

api_router = APIRouter()
api_router.include_router(analyze.router, tags=["analysis"])
api_router.include_router(tissue.router, tags=["tissue"])
