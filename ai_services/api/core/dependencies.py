from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.core.config import load_config

# Global configuration and model cache
cfg = load_config()
ml_models = {}

from api.services.pipeline import MLPipeline


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading ML Pipeline...")
    
    try:
        pipeline = MLPipeline("config.yaml")
        ml_models["pipeline"] = pipeline
        print("ML Pipeline loaded successfully.")
    except Exception as e:  # noqa: BLE001
        print(f"Warning: Failed to load ML Pipeline: {e}")
        ml_models["pipeline"] = None

    yield
    
    print("Shutting down API...")
    ml_models.clear()

def get_ml_models():
    """Dependency injection for route handlers to access loaded models."""
    return ml_models

def get_config():
    """Dependency injection for config."""
    return cfg
