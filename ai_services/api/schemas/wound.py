from pydantic import BaseModel, Field, HttpUrl


class AnalyzeWoundRequest(BaseModel):
    image_url: HttpUrl
    pixels_per_cm: float | None = Field(
        default=None, 
        gt=0, 
        description="Calibration scale in pixels per centimeter"
    )

class WoundStageResponse(BaseModel):
    label: str
    emoji: str
    description: str

class PerWoundResponse(BaseModel):
    wound_id: int
    detection_confidence: float | None = None
    area_cm2: float | None = None
    perimeter_cm: float | None = None
    length_cm: float | None = None
    width_cm: float | None = None
    aspect_ratio: float | None = None
    circularity: float | None = None
    solidity: float | None = None
    extent: float | None = None
    dominant_color_hex: str | None = None
    mean_hsv: list[int] | None = None
    mean_lab: list[int] | None = None
    color_classification: WoundStageResponse | None = None

class AnalyzeWoundResponse(BaseModel):
    wound_detected: bool
    detection_confidence: float | None = None
    wound_count: int = 0
    total_area_cm2: float | None = None
    total_perimeter_cm: float | None = None
    wounds: list[PerWoundResponse] = []
    overall_color_hex: str | None = None
    overall_color_classification: WoundStageResponse | None = None
    inference_time_ms: dict[str, float] = {}
    message: str = ""
    annotated_image_base64: str | None = None
    calibration: dict | None = None
    physical_measurement_available: bool = False

class ErrorDetails(BaseModel):
    code: str
    message: str
    details: list[str] | dict | None = None
    request_id: str | None = None

class ErrorResponse(BaseModel):
    error: ErrorDetails
