from pydantic import BaseModel, Field

class TissueCompositionPercentages(BaseModel):
    """
    Percentages of predicted tissue types.
    The denominator for these percentages is explicitly defined as the
    'valid predicted tissue pixels' (excluding background and ignore regions).
    All values are in the range [0.0, 100.0].
    """
    epithelial: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of epithelial tissue")
    granulation: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of granulation tissue")
    slough: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of slough tissue")
    necrotic: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of necrotic tissue")
    fibrin: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of fibrin tissue")
    callus: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of callus tissue")
    other: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of other tissue")

class InferenceMetadata(BaseModel):
    model_name: str
    model_version: str
    message: str = ""

class AnalyzeTissueResponse(BaseModel):
    tissue_composition: TissueCompositionPercentages
    inference_metadata: InferenceMetadata
    annotated_image_base64: str | None = Field(default=None, description="Base64 encoded visual representation of the predicted tissue mask")
