import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.core.config import load_config

# Global configuration and model cache
cfg = load_config()
ml_models = {}

from api.services.pipeline import MLPipeline
from api.services.tissue_segmenter import TissueSegmenter

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
        
    print("Loading Tissue Segmenter...")
    try:
        tissue_model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "tissue", "best.pt")
        tissue_seg = TissueSegmenter(tissue_model_path, required=False)
        tissue_seg.load()
        ml_models["tissue_segmenter"] = tissue_seg
        print("Tissue Segmenter loaded successfully.")
    except Exception as e:
        print(f"Warning: Failed to load Tissue Segmenter: {e}")
        ml_models["tissue_segmenter"] = None

    yield
    
    print("Shutting down API...")
    ml_models.clear()

def get_ml_models():
    """Dependency injection for route handlers to access loaded models."""
    return ml_models

def get_config():
    """Dependency injection for config."""
    return cfg
