import os
from fastapi.testclient import TestClient
from api.main import app

path = os.path.join(os.path.dirname(__file__), 'fixtures', 'calibration', 'valid_marker.png')
with TestClient(app) as client:
    with open(path, "rb") as f:
        response = client.post("/api/v1/analyze-wound-upload/", files={"file": ("valid_marker.png", f, "image/png")})
    print(response.status_code)
    print(response.text)
