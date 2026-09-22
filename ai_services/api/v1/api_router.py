from fastapi import APIRouter

from api.v1.endpoints import analyze

api_router = APIRouter()
api_router.include_router(analyze.router, tags=["analysis"])
